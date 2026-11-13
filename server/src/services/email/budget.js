'use strict';

const { EmailLog } = require('../../models/EmailLog');

// Brevo's free plan allows 300 emails a day; critical mail (codes, resets) keeps a small reserve.
const CRITICAL_CEILING = 290;

const startOfUtcDay = (now = new Date()) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

/** Emails actually sent since 00:00 UTC (platform-wide, as the provider quota is). */
function sentToday(now = new Date()) {
  return EmailLog.countDocuments({ status: 'sent', createdAt: { $gte: startOfUtcDay(now) } });
}

const limitFor = (priority, dailyBudget) => (priority === 'critical' ? CRITICAL_CEILING : dailyBudget);

/**
 * Critical emails may be sent while fewer than 290 were sent today; normal emails while fewer than
 * EMAIL_DAILY_BUDGET were sent.
 */
async function canSend(priority, dailyBudget, now = new Date()) {
  return (await sentToday(now)) < limitFor(priority, dailyBudget);
}

// Sends in flight in this process. Checking and reserving happen under one lock so parallel
// fan-out lanes cannot all pass the check before any of them is logged.
let inFlight = 0;
let lock = Promise.resolve();

/**
 * Reserve one slot of today's budget. Resolves to a release function, or null when the budget is
 * used up. Call release() after the EmailLog row is written (sent or failed).
 */
function reserve(priority, dailyBudget) {
  const attempt = lock.then(async () => {
    // Read in-flight sends BEFORE counting: a send that finishes during the count is then counted at
    // least once (possibly twice, which only errs on the safe side).
    const pending = inFlight;
    if ((await sentToday()) + pending >= limitFor(priority, dailyBudget)) return null;
    inFlight += 1;
    let released = false;
    return () => {
      if (!released) {
        released = true;
        inFlight -= 1;
      }
    };
  });
  lock = attempt.catch(() => undefined);
  return attempt;
}

module.exports = { canSend, reserve, sentToday, startOfUtcDay, CRITICAL_CEILING };

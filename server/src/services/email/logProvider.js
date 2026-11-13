'use strict';

const OUTBOX_LIMIT = 200;

/**
 * Development/test provider: keeps the last messages in memory (tests read them). In development
 * only it prints one line per email with the recipient, subject and, for verification/reset
 * emails, the code or link so a developer can finish the flow locally. It prints nothing in
 * test or production.
 */
function createLogProvider({ nodeEnv, sink = (line) => console.log(line) }) {
  const outbox = [];
  return {
    name: 'log',
    outbox,
    async send(message) {
      outbox.push({ ...message, at: new Date() });
      if (outbox.length > OUTBOX_LIMIT) outbox.shift();
      if (nodeEnv === 'development') {
        const extra = message.devCode ? ` code=${message.devCode}` : message.devLink ? ` link=${message.devLink}` : '';
        sink(`[email:log] to=${message.to} subject="${message.subject}"${extra}`);
      }
      return { messageId: `log-${outbox.length}-${Date.now()}` };
    },
  };
}

module.exports = { createLogProvider, OUTBOX_LIMIT };

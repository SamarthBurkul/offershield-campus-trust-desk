'use strict';

const { simhash64, hamming, normalizeForHash, isComparable } = require('../src/services/linking/simhash');
const { config } = require('../src/config/env');

const THRESHOLD = config.simhashMaxDistance;

const TEMPLATE_A =
  'Dear Rahul, congratulations! You have been selected for the Infosys remote internship. To confirm your seat pay a refundable onboarding fee of Rs 999 to infosys.onboard@ybl within 24 hours. Contact HR at hr.infosys.careers@gmail.com or +91 98765 43210. Limited seats.';
const TEMPLATE_B =
  'Dear Priya, congratulations! You have been selected for the Infosys remote internship. To confirm your seat pay a refundable onboarding fee of Rs 1,499 to wipro.fee@paytm within 24 hours. Contact HR at talent.desk@gmail.com or +91 91234 56789. Limited seats.';
const REWORDED =
  'Dear Priya, congratulations! You have been shortlisted for the Infosys remote internship. To confirm your seat pay a refundable onboarding fee of Rs 1,499 to wipro.fee@paytm within 24 hours. Contact HR at talent.desk@gmail.com or +91 91234 56789. Limited seats.';
const UNRELATED_1 =
  'Hi team, the library will be closed on Friday for maintenance. Please return borrowed books by Thursday evening and collect your exam hall tickets from the office.';
const UNRELATED_2 =
  'Hello Amit, we are pleased to offer you a full-time analyst role at our Bengaluru office starting next month. Please confirm acceptance by replying to this email and attend orientation on Monday.';

describe('SimHash', () => {
  it('produces 16 hex chars and normalises contacts, numbers and salutation names', () => {
    expect(simhash64(TEMPLATE_A)).toMatch(/^[0-9a-f]{16}$/);
    expect(normalizeForHash('Dear Rahul, pay Rs 999 to a.b@ybl or mail x@y.com or call 9876543210 at https://x.in/a')).toBe(
      'dear nametoken pay rs # to upitoken or mail emailtoken or call phonetoken at urltoken',
    );
    expect(THRESHOLD).toBe(6);
  });

  it('5. identical = 0, template variants within the threshold, unrelated texts beyond it', () => {
    const a = simhash64(TEMPLATE_A);
    const distances = {
      identical: hamming(a, simhash64(TEMPLATE_A)),
      templateNameAmountContacts: hamming(a, simhash64(TEMPLATE_B)),
      templateOneWordReworded: hamming(a, simhash64(REWORDED)),
      unrelatedLibraryNotice: hamming(a, simhash64(UNRELATED_1)),
      unrelatedGenuineOffer: hamming(a, simhash64(UNRELATED_2)),
      unrelatedPair: hamming(simhash64(UNRELATED_1), simhash64(UNRELATED_2)),
    };
    // Reported in the Phase 5 report.
    process.stdout.write(`SIMHASH_DISTANCES ${JSON.stringify(distances)}\n`);

    expect(distances.identical).toBe(0);
    expect(distances.templateNameAmountContacts).toBeLessThanOrEqual(THRESHOLD);
    expect(distances.unrelatedLibraryNotice).toBeGreaterThan(THRESHOLD);
    expect(distances.unrelatedGenuineOffer).toBeGreaterThan(THRESHOLD);
    expect(distances.unrelatedPair).toBeGreaterThan(THRESHOLD);
  });

  it('treats very short messages as not comparable', () => {
    expect(isComparable('Pay now')).toBe(false);
    expect(isComparable(TEMPLATE_A)).toBe(true);
  });
});

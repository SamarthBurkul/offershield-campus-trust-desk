'use strict';

const { useTestDatabase } = require('./helpers/db');
const { createTestApp } = require('./helpers/auth');
const { validCaseBody, setupTwoColleges, createCaseAs } = require('./helpers/cases');
const { isValidVerhoeff, verhoeffCheckDigit } = require('../src/utils/verhoeff');
const { containsSensitiveId } = require('../src/utils/privacyGuard');
const { Case } = require('../src/models/Case');

// Synthetic, generated test numbers (not anyone's real Aadhaar).
const AADHAAR_BASE = '23456789012';
const VALID_AADHAAR = AADHAAR_BASE + verhoeffCheckDigit(AADHAAR_BASE);
const INVALID_AADHAAR = AADHAAR_BASE + ((verhoeffCheckDigit(AADHAAR_BASE) + 1) % 10);
const grouped = (digits, sep) => `${digits.slice(0, 4)}${sep}${digits.slice(4, 8)}${sep}${digits.slice(8)}`;
const TEST_PAN = 'ABCPE1234F';

describe('Verhoeff checksum', () => {
  it('matches reference values and rejects altered numbers', () => {
    expect(verhoeffCheckDigit('236')).toBe(3);
    expect(isValidVerhoeff('2363')).toBe(true);
    expect(isValidVerhoeff('2364')).toBe(false);
    expect(verhoeffCheckDigit('12345')).toBe(1);
    expect(isValidVerhoeff('123451')).toBe(true);
    expect(isValidVerhoeff(VALID_AADHAAR)).toBe(true);
    expect(isValidVerhoeff(INVALID_AADHAAR)).toBe(false);
    // Swapping two adjacent digits is always detected.
    expect(isValidVerhoeff(VALID_AADHAAR.slice(0, 2) + VALID_AADHAAR[3] + VALID_AADHAAR[2] + VALID_AADHAAR.slice(4))).toBe(false);
    expect(isValidVerhoeff('12a4')).toBe(false);
  });
});

describe('privacy guard', () => {
  it('detects grouped and plain Aadhaar and PAN, but not phones or checksum failures', () => {
    expect(containsSensitiveId(`id ${VALID_AADHAAR}`)).toBe(true);
    expect(containsSensitiveId(grouped(VALID_AADHAAR, ' '))).toBe(true);
    expect(containsSensitiveId(grouped(VALID_AADHAAR, '-'))).toBe(true);
    expect(containsSensitiveId(`pan: ${TEST_PAN.toLowerCase()}`)).toBe(true);
    expect(containsSensitiveId(INVALID_AADHAAR)).toBe(false);
    expect(containsSensitiveId('+91 98765 43210 or 9876543210')).toBe(false);
    expect(containsSensitiveId(`0${VALID_AADHAAR.slice(1)}`)).toBe(false); // first digit 0 or 1 is not an Aadhaar
    expect(containsSensitiveId(`${VALID_AADHAAR}5`)).toBe(false); // 13 digits
  });
});

describe('privacy guard on the API', () => {
  useTestDatabase();

  let app;
  let ctx;
  beforeAll(() => {
    app = createTestApp();
  });
  beforeEach(async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    ctx = await setupTwoColleges(app);
  });
  const student = () => ctx.as('student@demo-alpha.test.edu');

  it.each([
    ['spaced', grouped(VALID_AADHAAR, ' ')],
    ['hyphenated', grouped(VALID_AADHAAR, '-')],
    ['plain', VALID_AADHAAR],
  ])('14. rejects a %s Aadhaar in messageText without echoing it', async (_label, aadhaar) => {
    const res = await (await student())
      .post('/api/v1/cases')
      .send(validCaseBody({ messageText: `They asked me to send my Aadhaar ${aadhaar} on WhatsApp` }));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('SENSITIVE_ID_DETECTED');
    expect(res.body.error.message).toMatch(/remove|mask/i);
    expect(res.text).not.toContain(aadhaar);
    expect(res.text).not.toContain(VALID_AADHAAR);
    expect(await Case.countDocuments()).toBe(0);
  });

  it('15. accepts a 12-digit number failing Verhoeff and Indian phone numbers', async () => {
    const res = await (await student()).post('/api/v1/cases').send(
      validCaseBody({ messageText: `Ref no ${INVALID_AADHAAR}. Call +91 98765 43210 or 9876543210.`, contacts: { phones: ['+91 98765 43210'] } }),
    );

    expect(res.status).toBe(201);
  });

  it('16. rejects a PAN in studentNote, in contacts and in a reply', async () => {
    const agent = await student();

    const note = await agent.post('/api/v1/cases').send(validCaseBody({ studentNote: `My PAN is ${TEST_PAN}` }));
    expect(note.status).toBe(400);
    expect(note.body.error.code).toBe('SENSITIVE_ID_DETECTED');
    expect(note.text).not.toContain(TEST_PAN);

    const contact = await agent
      .post('/api/v1/cases')
      .send(validCaseBody({ contacts: { emails: [`${TEST_PAN.toLowerCase()}@example.com`] } }));
    expect(contact.body.error.code).toBe('SENSITIVE_ID_DETECTED');

    const created = await createCaseAs(agent);
    const reply = await agent.post(`/api/v1/cases/${created.id}/messages`).send({ body: `aadhaar ${grouped(VALID_AADHAAR, ' ')}` });
    expect(reply.status).toBe(400);
    expect(reply.body.error.code).toBe('SENSITIVE_ID_DETECTED');
  });

  it('does not log the matched value', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await (await student()).post('/api/v1/cases').send(validCaseBody({ messageText: `aadhaar number ${VALID_AADHAAR} please` }));

    expect(JSON.stringify(warn.mock.calls)).not.toContain(VALID_AADHAAR);
  });
});

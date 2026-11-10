'use strict';

const { createHash } = require('node:crypto');
const mongoose = require('mongoose');
const { useTestDatabase } = require('./helpers/db');
const { createTestApp, loginAgent } = require('./helpers/auth');
const { setupTwoColleges, createCaseAs } = require('./helpers/cases');
const { TEST_PASSWORD, createSuperAdmin } = require('./helpers/factories');
const { makePng, makeJpeg, makePdf, fakePng, jpegMarkers } = require('./fixtures/files');
const { Case } = require('../src/models/Case');
const { CaseEvent } = require('../src/models/CaseEvent');
const { Evidence } = require('../src/models/Evidence');
const { AuditLog } = require('../src/models/AuditLog');

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

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');

/** Collect a binary response body as a Buffer. */
function binary(res, callback) {
  const chunks = [];
  res.on('data', (chunk) => chunks.push(chunk));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
}

function upload(agent, caseId, files) {
  let req = agent.post(`/api/v1/cases/${caseId}/evidence`);
  for (const file of files) req = req.attach('files', file.buffer, { filename: file.name, contentType: file.type ?? 'application/octet-stream' });
  return req;
}

const png = (name = 'screenshot.png') => ({ buffer: makePng(), name, type: 'image/png' });

async function ownerWithCase() {
  const owner = await ctx.as('student@demo-alpha.test.edu');
  const created = await createCaseAs(owner);
  return { owner, caseId: created.id };
}

async function link(agent, caseId, evidenceId) {
  return agent.post(`/api/v1/cases/${caseId}/evidence/${evidenceId}/link`);
}

describe('POST /cases/:id/evidence', () => {
  it('27. stores PNG, JPEG and PDF with hashes, tenant GridFS metadata and an evidence_added event', async () => {
    const { owner, caseId } = await ownerWithCase();
    const files = [
      { buffer: makePng({ text: true }), name: 'chat.png', type: 'image/png' },
      { buffer: makeJpeg({ exif: true }), name: 'C:\\Users\\me\\Desktop\\offer photo.jpeg', type: 'image/jpeg' },
      { buffer: makePdf(), name: '../../offer letter.pdf', type: 'application/pdf' },
    ];

    const res = await upload(owner, caseId, files);

    expect(res.status).toBe(201);
    expect(res.body.evidence.map((item) => [item.originalName, item.mime])).toEqual([
      ['chat.png', 'image/png'],
      ['offer photo.jpg', 'image/jpeg'],
      ['offer letter.pdf', 'application/pdf'],
    ]);
    for (const item of res.body.evidence) expect(Object.keys(item).sort()).toEqual(['createdAt', 'id', 'mime', 'originalName', 'size']);

    const stored = await Evidence.find({ caseId }).sort({ createdAt: 1 }).lean();
    expect(stored.map((item) => item.metadataStripped)).toEqual([true, true, false]);
    expect(stored[2].sha256).toBe(sha256(makePdf()));
    for (const item of stored) {
      expect(item.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(String(item.collegeId)).toBe(String(ctx.alpha.college._id));
      const gridFile = await mongoose.connection.db.collection('evidence.files').findOne({ _id: item.gridFsId });
      expect(String(gridFile.metadata.collegeId)).toBe(String(ctx.alpha.college._id));
      expect(String(gridFile.metadata.caseId)).toBe(caseId);
    }

    const event = await CaseEvent.findOne({ caseId, type: 'evidence_added' }).lean();
    expect(event).toMatchObject({ visibleToStudent: true, metadata: { count: 3 } });
    const detail = await owner.get(`/api/v1/cases/${caseId}`);
    expect(detail.body.evidence).toHaveLength(3);
    expect(detail.text).not.toMatch(/gridFsId|sha256/);
  });

  it('28a. rejects a text file named .png with 400 UNSUPPORTED_FILE_TYPE and stores nothing', async () => {
    const { owner, caseId } = await ownerWithCase();

    const res = await upload(owner, caseId, [png(), { buffer: fakePng(), name: 'photo.png', type: 'image/png' }]);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('UNSUPPORTED_FILE_TYPE');
    expect(await Evidence.countDocuments()).toBe(0);
    expect(await mongoose.connection.db.collection('evidence.files').countDocuments()).toBe(0);
  });

  it('28b. rejects a file over 3 MB with 413 FILE_TOO_LARGE', async () => {
    const { owner, caseId } = await ownerWithCase();
    const big = Buffer.concat([makePng(), Buffer.alloc(3 * 1024 * 1024)]);

    const res = await upload(owner, caseId, [{ buffer: big, name: 'big.png', type: 'image/png' }]);

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('FILE_TOO_LARGE');
    expect(await Evidence.countDocuments()).toBe(0);
  });

  it('28c. rejects more than 5 files per request and more than 10 per case with 400 TOO_MANY_FILES', async () => {
    const { owner, caseId } = await ownerWithCase();

    const six = await upload(owner, caseId, Array.from({ length: 6 }, (_, i) => png(`s${i}.png`)));
    expect(six.status).toBe(400);
    expect(six.body.error.code).toBe('TOO_MANY_FILES');

    expect((await upload(owner, caseId, Array.from({ length: 5 }, (_, i) => png(`a${i}.png`)))).status).toBe(201);
    expect((await upload(owner, caseId, Array.from({ length: 5 }, (_, i) => png(`b${i}.png`)))).status).toBe(201);
    const eleventh = await upload(owner, caseId, [png('c.png')]);
    expect(eleventh.status).toBe(400);
    expect(eleventh.body.error.code).toBe('TOO_MANY_FILES');
    expect(await Evidence.countDocuments({ caseId })).toBe(10);
  });

  it('29. non-owner (same college) and other-college students get 404; a closed case gets 409', async () => {
    const { owner, caseId } = await ownerWithCase();

    const sameCollege = await upload(await ctx.as('student2@demo-alpha.test.edu'), caseId, [png()]);
    const otherCollege = await upload(await ctx.as('student@demo-beta.test.edu'), caseId, [png()]);
    expect(sameCollege.status).toBe(404);
    expect(otherCollege.status).toBe(404);

    await Case.updateOne({ _id: caseId }, { status: 'verified_genuine' });
    const closed = await upload(owner, caseId, [png()]);
    expect(closed.status).toBe(409);
    expect(closed.body.error.code).toBe('CASE_CLOSED');
    expect(await Evidence.countDocuments()).toBe(0);
  });
});

describe('evidence links and downloads', () => {
  async function ownerWithEvidence(agentApp = app) {
    const owner = await loginAgent(agentApp, 'student@demo-alpha.test.edu', TEST_PASSWORD);
    const created = await createCaseAs(owner);
    const res = await upload(owner, created.id, [
      { buffer: makePdf(), name: 'offer.pdf', type: 'application/pdf' },
      { buffer: makePng(), name: 'chat.png', type: 'image/png' },
      { buffer: makeJpeg({ exif: true }), name: 'photo.jpg', type: 'image/jpeg' },
    ]);
    const [pdf, pngItem, jpeg] = res.body.evidence;
    return { owner, caseId: created.id, pdf, png: pngItem, jpeg };
  }

  it('30. the owner downloads identical bytes with safe headers; the JPEG has no APP1', async () => {
    const { owner, caseId, pdf, png: pngItem, jpeg } = await ownerWithEvidence();

    const pdfLink = await link(owner, caseId, pdf.id);
    expect(pdfLink.status).toBe(200);
    expect(pdfLink.body.url).toMatch(/^\/api\/v1\/files\/[\w-]+\.[\w-]+\.[\w-]+$/);
    expect(new Date(pdfLink.body.expiresAt).getTime()).toBeGreaterThan(Date.now());

    const pdfRes = await owner.get(pdfLink.body.url).buffer(true).parse(binary);
    expect(pdfRes.status).toBe(200);
    expect(pdfRes.body.equals(makePdf())).toBe(true);
    expect(pdfRes.headers).toMatchObject({
      'content-type': 'application/pdf',
      'x-content-type-options': 'nosniff',
      'cache-control': 'no-store',
      'content-security-policy': 'sandbox',
      'content-disposition': 'attachment; filename="offer.pdf"',
    });

    const pngRes = await owner.get((await link(owner, caseId, pngItem.id)).body.url).buffer(true).parse(binary);
    expect(pngRes.body.equals(makePng())).toBe(true);
    expect(pngRes.headers['content-disposition']).toBe('inline; filename="chat.png"');
    expect(pngRes.headers['content-security-policy']).toBe('sandbox');

    const jpegRes = await owner.get((await link(owner, caseId, jpeg.id)).body.url).buffer(true).parse(binary);
    expect(jpegRes.headers['content-type']).toBe('image/jpeg');
    expect(jpegMarkers(jpegRes.body)).not.toContain(0xe1);
    expect(jpegRes.body.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
  });

  it('31a. an expired link returns 401 LINK_INVALID', async () => {
    const shortApp = createTestApp({ EVIDENCE_LINK_TTL_SECONDS: '1' });
    const { owner, caseId, pdf } = await ownerWithEvidence(shortApp);
    const { url } = (await link(owner, caseId, pdf.id)).body;

    await new Promise((resolve) => setTimeout(resolve, 2100));
    const res = await owner.get(url);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('LINK_INVALID');
  });

  it('31b. tampered token, missing session and a different user all get 401; evidence of another case gets 404', async () => {
    const { owner, caseId, pdf } = await ownerWithEvidence();
    const { url } = (await link(owner, caseId, pdf.id)).body;

    const tampered = await owner.get(`${url.slice(0, -3)}abc`);
    expect(tampered.status).toBe(401);
    expect(tampered.body.error.code).toBe('LINK_INVALID');

    const request = require('supertest');
    const noSession = await request(app).get(url);
    expect(noSession.status).toBe(401);
    expect(noSession.body.error.code).toBe('UNAUTHENTICATED');

    const otherUser = await (await ctx.as('student2@demo-alpha.test.edu')).get(url);
    expect(otherUser.status).toBe(401);
    expect(otherUser.body.error.code).toBe('LINK_INVALID');
    const officer = await (await ctx.as('officer@demo-alpha.test.edu')).get(url);
    expect(officer.status).toBe(401);

    const secondCase = await createCaseAs(owner);
    const crossCase = await link(owner, secondCase.id, pdf.id);
    expect(crossCase.status).toBe(404);
    expect((await link(owner, caseId, 'not-an-id')).status).toBe(404);
  });

  it('32. same-college staff can open evidence; other-college staff get 404; super admin gets 403', async () => {
    const { caseId, pdf } = await ownerWithEvidence();
    await createSuperAdmin();

    for (const email of ['officer@demo-alpha.test.edu', 'head@demo-alpha.test.edu']) {
      const staff = await ctx.as(email);
      const res = await link(staff, caseId, pdf.id);
      expect(res.status).toBe(200);
      const file = await staff.get(res.body.url).buffer(true).parse(binary);
      expect(file.status).toBe(200);
      expect(file.body.equals(makePdf())).toBe(true);
    }
    for (const email of ['officer@demo-beta.test.edu', 'head@demo-beta.test.edu']) {
      expect((await link(await ctx.as(email), caseId, pdf.id)).status).toBe(404);
    }
    const root = await link(await ctx.as('root@platform.test'), caseId, pdf.id);
    expect(root.status).toBe(403);
    // Staff still cannot upload: uploads are for the owning student only.
    expect((await upload(await ctx.as('head@demo-alpha.test.edu'), caseId, [png()])).status).toBe(403);
  });

  it('33. audits uploads and accesses without file contents or tokens', async () => {
    const { owner, caseId, pdf } = await ownerWithEvidence();
    const { url } = (await link(owner, caseId, pdf.id)).body;
    await owner.get(url).buffer(true).parse(binary);
    const token = url.split('/').pop();

    const uploads = await AuditLog.find({ action: 'evidence.upload' }).lean();
    const accesses = await AuditLog.find({ action: 'evidence.access' }).lean();

    expect(uploads).toHaveLength(1);
    expect(uploads[0]).toMatchObject({ actorRole: 'student', entityType: 'case' });
    expect(uploads[0].metadata.evidenceIds).toHaveLength(3);
    expect(accesses).toHaveLength(1);
    expect(accesses[0]).toMatchObject({ actorRole: 'student', entityType: 'evidence', metadata: { caseId } });
    expect(String(accesses[0].entityId)).toBe(pdf.id);
    expect(String(accesses[0].collegeId)).toBe(String(ctx.alpha.college._id));

    const serialized = JSON.stringify([...uploads, ...accesses]);
    expect(serialized).not.toContain(token);
    expect(serialized).not.toContain('%PDF');
    expect(serialized).not.toMatch(/sha256|gridFsId|[a-f0-9]{64}/);
  });
});

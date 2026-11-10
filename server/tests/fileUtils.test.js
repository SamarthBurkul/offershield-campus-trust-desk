'use strict';

const { detectFileType } = require('../src/utils/fileSignature');
const { stripImageMetadata, MalformedImageError } = require('../src/utils/stripImageMetadata');
const { signEvidenceLink, verifyEvidenceLink } = require('../src/utils/evidenceToken');
const { createTestConfig } = require('./helpers/auth');
const { makePng, makeJpeg, makePdf, fakePng, jpegMarkers, pngChunks } = require('./fixtures/files');

describe('24. detectFileType (magic bytes)', () => {
  it('accepts PNG, JPEG and PDF by content', () => {
    expect(detectFileType(makePng())).toEqual({ mime: 'image/png', extension: 'png' });
    expect(detectFileType(makeJpeg())).toEqual({ mime: 'image/jpeg', extension: 'jpg' });
    expect(detectFileType(makePdf())).toEqual({ mime: 'application/pdf', extension: 'pdf' });
  });

  it('rejects a text file renamed .png and other types', () => {
    expect(detectFileType(fakePng())).toBeNull();
    expect(detectFileType(Buffer.from('GIF89a'))).toBeNull();
    expect(detectFileType(Buffer.from([0x89, 0x50]))).toBeNull();
    expect(detectFileType(Buffer.alloc(0))).toBeNull();
    expect(detectFileType('not a buffer')).toBeNull();
  });
});

describe('stripImageMetadata', () => {
  it('25. removes APP1 (EXIF) and APP13 from a JPEG and keeps SOI/EOI', () => {
    const original = makeJpeg({ exif: true, app13: true });
    expect(jpegMarkers(original)).toEqual(expect.arrayContaining([0xe1, 0xed]));

    const { buffer, metadataStripped } = stripImageMetadata(original, 'image/jpeg');

    expect(metadataStripped).toBe(true);
    expect(jpegMarkers(buffer)).not.toContain(0xe1);
    expect(jpegMarkers(buffer)).not.toContain(0xed);
    expect(jpegMarkers(buffer)).toEqual([0xe0, 0xdb, 0xda]);
    expect(buffer.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
    expect(buffer.subarray(-2)).toEqual(Buffer.from([0xff, 0xd9]));
    expect(buffer.toString('latin1')).not.toContain('GPS');
    expect(buffer.length).toBeLessThan(original.length);
  });

  it('26. removes PNG tEXt and eXIf chunks and leaves valid chunks', () => {
    const original = makePng({ text: true, exif: true });

    const { buffer, metadataStripped } = stripImageMetadata(original, 'image/png');
    const chunks = pngChunks(buffer);

    expect(metadataStripped).toBe(true);
    expect(chunks.map((chunk) => chunk.type)).toEqual(['IHDR', 'IDAT', 'IEND']);
    expect(chunks.every((chunk) => chunk.crcValid)).toBe(true);
    expect(buffer.toString('latin1')).not.toContain('Camera Owner');
    // A clean PNG passes through byte-for-byte.
    expect(stripImageMetadata(makePng(), 'image/png').buffer.equals(makePng())).toBe(true);
  });

  it('returns PDFs unchanged with metadataStripped=false', () => {
    const pdf = makePdf();
    const result = stripImageMetadata(pdf, 'application/pdf');

    expect(result.metadataStripped).toBe(false);
    expect(result.buffer.equals(pdf)).toBe(true);
  });

  it('throws MalformedImageError for truncated images', () => {
    expect(() => stripImageMetadata(makePng().subarray(0, 20), 'image/png')).toThrow(MalformedImageError);
    expect(() => stripImageMetadata(Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff]), 'image/jpeg')).toThrow(MalformedImageError);
  });
});

describe('evidence link tokens', () => {
  const config = createTestConfig();
  const ids = { evidenceId: 'e1', caseId: 'c1', userId: 'u1' };

  it('round-trips, and rejects tampered tokens and session-key forgeries', () => {
    const { token, expiresAt } = signEvidenceLink(ids, config);
    expect(verifyEvidenceLink(token, config)).toMatchObject({ eid: 'e1', cid: 'c1', uid: 'u1', purpose: 'evidence' });
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());

    const [h, p, s] = token.split('.');
    expect(verifyEvidenceLink(`${h}.${p}.${s.slice(0, -2)}xx`, config)).toBeNull();

    const jwt = require('jsonwebtoken');
    const signedWithSessionKey = jwt.sign({ eid: 'e1', cid: 'c1', uid: 'u1', purpose: 'evidence' }, config.jwtSecret);
    expect(verifyEvidenceLink(signedWithSessionKey, config)).toBeNull();
  });
});

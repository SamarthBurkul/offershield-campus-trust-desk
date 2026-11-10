'use strict';

// Minimal synthetic evidence files, generated in code. They contain no personal data.
const zlib = require('node:zlib');

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, crc]);
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** A real 1x1 RGB PNG; optionally with metadata chunks before the image data. */
function makePng({ text = false, exif = false } = {}) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1, 0);
  ihdr.writeUInt32BE(1, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  const idat = zlib.deflateSync(Buffer.from([0, 0x22, 0x88, 0xcc]));
  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk('IHDR', ihdr),
    ...(text ? [pngChunk('tEXt', Buffer.from('Author\0Test Camera Owner', 'latin1'))] : []),
    ...(exif ? [pngChunk('eXIf', Buffer.from('MM\0*fake-exif', 'latin1'))] : []),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function jpegSegment(marker, payload) {
  const length = Buffer.alloc(2);
  length.writeUInt16BE(payload.length + 2);
  return Buffer.concat([Buffer.from([0xff, marker]), length, payload]);
}

/** A structurally valid JPEG (SOI, APP0, optional APP1 EXIF/APP13, DQT, SOS + data, EOI). */
function makeJpeg({ exif = true, app13 = false } = {}) {
  return Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    jpegSegment(0xe0, Buffer.from('JFIF\0\x01\x01\0\0\x01\0\x01\0\0', 'latin1')),
    ...(exif ? [jpegSegment(0xe1, Buffer.from('Exif\0\0GPS 19.07N 72.87E camera-serial-123', 'latin1'))] : []),
    ...(app13 ? [jpegSegment(0xed, Buffer.from('Photoshop 3.0\0IPTC caption', 'latin1'))] : []),
    jpegSegment(0xdb, Buffer.alloc(65, 1)),
    jpegSegment(0xda, Buffer.from([0x01, 0x01, 0x00, 0x00, 0x3f, 0x00])),
    Buffer.from([0x12, 0x34, 0xff, 0x00, 0x56]), // entropy-coded data (with a stuffed 0xFF00)
    Buffer.from([0xff, 0xd9]),
  ]);
}

function makePdf() {
  return Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n', 'latin1');
}

/** Plain text that merely claims to be an image. */
const fakePng = () => Buffer.from('this is just text pretending to be a png', 'utf8');

/** Iterate JPEG markers up to SOS. */
function jpegMarkers(buffer) {
  const markers = [];
  let offset = 2;
  while (offset < buffer.length && buffer[offset] === 0xff) {
    const marker = buffer[offset + 1];
    markers.push(marker);
    if (marker === 0xda || marker === 0xd9) break;
    offset += 2 + buffer.readUInt16BE(offset + 2);
  }
  return markers;
}

/** Chunk types of a PNG, verifying every CRC. */
function pngChunks(buffer) {
  const chunks = [];
  let offset = 8;
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('latin1', offset + 4, offset + 8);
    const crc = buffer.readUInt32BE(offset + 8 + length);
    chunks.push({ type, crcValid: crc === crc32(buffer.subarray(offset + 4, offset + 8 + length)) });
    offset += 12 + length;
  }
  return chunks;
}

module.exports = { makePng, makeJpeg, makePdf, fakePng, jpegMarkers, pngChunks };

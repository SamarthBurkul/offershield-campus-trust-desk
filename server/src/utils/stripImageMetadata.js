'use strict';

/**
 * Remove embedded metadata (location, device, author, comments) from images without decoding pixels.
 * Pure JavaScript; throws MalformedImageError if the container structure is invalid.
 */
class MalformedImageError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MalformedImageError';
  }
}

const JPEG_DROPPED_MARKERS = new Set([0xe1, 0xed]); // APP1 (EXIF/XMP), APP13 (Photoshop/IPTC)
const JPEG_STANDALONE_MARKERS = new Set([0x01, 0xd0, 0xd1, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7]);
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_DROPPED_CHUNKS = new Set(['eXIf', 'tEXt', 'iTXt', 'zTXt']);

function stripJpeg(buffer) {
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) throw new MalformedImageError('Not a JPEG');
  const parts = [buffer.subarray(0, 2)];
  let offset = 2;

  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) throw new MalformedImageError('Expected a JPEG marker');
    let markerOffset = offset + 1;
    while (buffer[markerOffset] === 0xff) markerOffset += 1; // fill bytes
    const marker = buffer[markerOffset];
    if (marker === undefined) throw new MalformedImageError('Truncated JPEG');

    if (marker === 0xd9) {
      parts.push(buffer.subarray(offset, markerOffset + 1)); // EOI
      return Buffer.concat(parts);
    }
    if (JPEG_STANDALONE_MARKERS.has(marker)) {
      parts.push(buffer.subarray(offset, markerOffset + 1));
      offset = markerOffset + 1;
      continue;
    }
    if (markerOffset + 2 >= buffer.length) throw new MalformedImageError('Truncated JPEG segment');
    const length = buffer.readUInt16BE(markerOffset + 1);
    const end = markerOffset + 1 + length;
    if (length < 2 || end > buffer.length) throw new MalformedImageError('Invalid JPEG segment length');

    if (marker === 0xda) {
      // Start of scan: entropy-coded data follows; keep everything from here to the end.
      parts.push(buffer.subarray(offset));
      return Buffer.concat(parts);
    }
    if (!JPEG_DROPPED_MARKERS.has(marker)) parts.push(buffer.subarray(offset, end));
    offset = end;
  }
  throw new MalformedImageError('JPEG has no image data');
}

function stripPng(buffer) {
  if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) throw new MalformedImageError('Not a PNG');
  const parts = [PNG_SIGNATURE];
  let offset = 8;

  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('latin1', offset + 4, offset + 8);
    const end = offset + 12 + length;
    if (!/^[A-Za-z]{4}$/.test(type) || end > buffer.length) throw new MalformedImageError('Invalid PNG chunk');
    if (!PNG_DROPPED_CHUNKS.has(type)) parts.push(buffer.subarray(offset, end));
    offset = end;
    if (type === 'IEND') return Buffer.concat(parts);
  }
  throw new MalformedImageError('PNG has no IEND chunk');
}

/**
 * @param {Buffer} buffer
 * @param {string} mime detected MIME type
 * @returns {{ buffer: Buffer, metadataStripped: boolean }} PDFs (and other types) are returned unchanged.
 */
function stripImageMetadata(buffer, mime) {
  if (mime === 'image/jpeg') return { buffer: stripJpeg(buffer), metadataStripped: true };
  if (mime === 'image/png') return { buffer: stripPng(buffer), metadataStripped: true };
  return { buffer, metadataStripped: false };
}

module.exports = { stripImageMetadata, MalformedImageError };

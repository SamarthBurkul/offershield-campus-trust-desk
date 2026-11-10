'use strict';

// Accepted evidence types, identified only by their leading "magic" bytes.
const SIGNATURES = [
  { mime: 'image/png', extension: 'png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: 'image/jpeg', extension: 'jpg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'application/pdf', extension: 'pdf', bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] }, // "%PDF-"
];

/**
 * Detect the file type from its content. The client-supplied name and MIME type are ignored.
 * @param {Buffer} buffer
 * @returns {{ mime: string, extension: string } | null}
 */
function detectFileType(buffer) {
  if (!Buffer.isBuffer(buffer)) return null;
  const match = SIGNATURES.find(({ bytes }) => buffer.length >= bytes.length && bytes.every((byte, i) => buffer[i] === byte));
  return match ? { mime: match.mime, extension: match.extension } : null;
}

module.exports = { detectFileType };

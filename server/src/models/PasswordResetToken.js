'use strict';

const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;
const MAX_ACTIVE_RESET_TOKENS = 3;

// Self-service password reset. Only the SHA-256 of the token is stored; the token travels in the email link.
const passwordResetTokenSchema = new mongoose.Schema(
  {
    userId: { type: ObjectId, ref: 'User', required: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

passwordResetTokenSchema.index({ userId: 1, usedAt: 1, expiresAt: 1 });
// MongoDB removes the record once it expires.
passwordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const PasswordResetToken = mongoose.models.PasswordResetToken || mongoose.model('PasswordResetToken', passwordResetTokenSchema);

module.exports = { PasswordResetToken, RESET_TOKEN_TTL_MS, MAX_ACTIVE_RESET_TOKENS };

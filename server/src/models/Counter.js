'use strict';

const mongoose = require('mongoose');

// Per-college sequences (e.g. key "case" -> case numbers). Incremented atomically with $inc + upsert.
const counterSchema = new mongoose.Schema({
  collegeId: { type: mongoose.Schema.Types.ObjectId, ref: 'College', required: true },
  key: { type: String, required: true, maxlength: 50 },
  seq: { type: Number, default: 0, min: 0 },
});

counterSchema.index({ collegeId: 1, key: 1 }, { unique: true });

const Counter = mongoose.models.Counter || mongoose.model('Counter', counterSchema);

module.exports = { Counter };

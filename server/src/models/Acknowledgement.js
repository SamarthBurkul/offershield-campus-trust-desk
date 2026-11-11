'use strict';

const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

/**
 * A student's "I've read this" for an advisory. Year and branch are a snapshot taken at
 * acknowledgement time so staff get count-only breakdowns without joining student records.
 */
const acknowledgementSchema = new mongoose.Schema(
  {
    collegeId: { type: ObjectId, ref: 'College', required: true },
    advisoryId: { type: ObjectId, ref: 'Advisory', required: true },
    userId: { type: ObjectId, ref: 'User', required: true },
    year: { type: Number, default: null },
    branch: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

acknowledgementSchema.index({ advisoryId: 1, userId: 1 }, { unique: true });
acknowledgementSchema.index({ collegeId: 1, advisoryId: 1 });

const Acknowledgement = mongoose.models.Acknowledgement || mongoose.model('Acknowledgement', acknowledgementSchema);

module.exports = { Acknowledgement };

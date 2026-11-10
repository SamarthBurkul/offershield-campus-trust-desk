'use strict';

const mongoose = require('mongoose');
const { appendOnly } = require('./plugins/appendOnly');

const { ObjectId } = mongoose.Schema.Types;

// Staff-only internal notes. A separate collection so no student-facing code path can read them.
const noteSchema = new mongoose.Schema(
  {
    collegeId: { type: ObjectId, ref: 'College', required: true },
    caseId: { type: ObjectId, ref: 'Case', required: true },
    authorId: { type: ObjectId, ref: 'User', required: true },
    authorRole: { type: String, required: true },
    body: { type: String, required: true, trim: true, minlength: 1, maxlength: 5000 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

noteSchema.index({ collegeId: 1, caseId: 1, createdAt: 1 });

appendOnly(noteSchema, { name: 'Note' });

const Note = mongoose.models.Note || mongoose.model('Note', noteSchema);

module.exports = { Note };

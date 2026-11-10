'use strict';

const { caseRepository, noteRepository } = require('../repositories');
const { findCaseOr404, recordAudit, usersById } = require('./staffCase.service');
const { toNoteView } = require('../utils/caseViews');

/** Staff-only internal note. Allowed on open and closed cases. The body never goes into the audit log. */
async function addNote(user, caseId, { body }, { ip }) {
  const found = await findCaseOr404(user, caseId);
  const note = await noteRepository.forTenant(user.collegeId).create({
    caseId: found._id,
    authorId: user.id,
    authorRole: user.role,
    body,
  });
  await caseRepository.forTenant(user.collegeId).updateOne({ _id: found._id }, { $set: { lastActivityAt: new Date() } });
  await recordAudit(user, found._id, 'case.note_add', { noteId: String(note._id), length: body.length }, ip);
  return toNoteView(note, await usersById(user.collegeId, [user.id]));
}

module.exports = { addNote };

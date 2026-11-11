'use strict';

const staffCaseService = require('../services/staffCase.service');
const noteService = require('../services/note.service');
const decisionService = require('../services/decision.service');
const linkService = require('../services/linking/link.service');
const { refreshCaseSignals } = require('../services/signals/loader');

function createStaffCaseController(config) {
  const options = { staleDays: config.caseStaleDays };
  // Mutations answer with the refreshed staff view so the desk always shows the stored state.
  const respondWithCase = async (req, res, status = 200) =>
    res.status(status).json({ case: await staffCaseService.getCaseForStaff(req.user, req.params.id, options) });

  return {
    async listQueue(req, res) {
      res.status(200).json(await staffCaseService.listQueue(req.user, req.validatedQuery, options));
    },
    async getCounts(req, res) {
      res.status(200).json({ counts: await staffCaseService.getCounts(req.user, options) });
    },
    async getCase(req, res) {
      await respondWithCase(req, res);
    },
    async assign(req, res) {
      await staffCaseService.assignCase(req.user, req.params.id, req.body.assigneeId, { ip: req.ip });
      await respondWithCase(req, res);
    },
    async changeStatus(req, res) {
      await staffCaseService.changeStatus(req.user, req.params.id, req.body, { ip: req.ip });
      await respondWithCase(req, res);
    },
    async requestInfo(req, res) {
      await staffCaseService.requestInfo(req.user, req.params.id, req.body, { ip: req.ip });
      await respondWithCase(req, res, 201);
    },
    async sendMessage(req, res) {
      await staffCaseService.sendStaffMessage(req.user, req.params.id, req.body, { ip: req.ip });
      await respondWithCase(req, res, 201);
    },
    async addNote(req, res) {
      await noteService.addNote(req.user, req.params.id, req.body, { ip: req.ip });
      await respondWithCase(req, res, 201);
    },
    async recommend(req, res) {
      await staffCaseService.recommend(req.user, req.params.id, req.body, { ip: req.ip });
      await respondWithCase(req, res);
    },
    async decide(req, res) {
      await decisionService.recordDecision(req.user, req.params.id, req.body, { ip: req.ip });
      await respondWithCase(req, res);
    },
    async link(req, res) {
      await linkService.linkManually(req.user, req.params.id, req.body.caseId, { ip: req.ip });
      await respondWithCase(req, res, 201);
    },
    async unlink(req, res) {
      await linkService.unlink(req.user, req.params.id, req.params.otherId, { ip: req.ip });
      await respondWithCase(req, res);
    },
    async recomputeSignals(req, res) {
      const found = await staffCaseService.findCaseOr404(req.user, req.params.id);
      await refreshCaseSignals(req.user.collegeId, found._id);
      await respondWithCase(req, res);
    },
    async reopen(req, res) {
      await decisionService.reopenCase(req.user, req.params.id, req.body, { ip: req.ip });
      await respondWithCase(req, res);
    },
  };
}

module.exports = { createStaffCaseController };

'use strict';

const recruiterService = require('../services/registry/recruiter.service');
const indicatorService = require('../services/registry/indicator.service');

function createRegistryController(config) {
  const ip = (req) => ({ ip: req.ip });

  return {
    async listRecruiters(req, res) {
      res.status(200).json(await recruiterService.listRecruiters(req.user, req.validatedQuery));
    },
    async createRecruiter(req, res) {
      res.status(201).json({ recruiter: await recruiterService.createRecruiter(req.user, req.body, config, ip(req)) });
    },
    async updateRecruiter(req, res) {
      res.status(200).json({ recruiter: await recruiterService.updateRecruiter(req.user, req.params.id, req.body, config, ip(req)) });
    },
    async approveRecruiter(req, res) {
      res.status(200).json({ recruiter: await recruiterService.approveRecruiter(req.user, req.params.id, ip(req)) });
    },
    async renewRecruiter(req, res) {
      res.status(200).json({ recruiter: await recruiterService.renewRecruiter(req.user, req.params.id, req.body, config, ip(req)) });
    },
    async suspendRecruiter(req, res) {
      res.status(200).json({ recruiter: await recruiterService.suspendRecruiter(req.user, req.params.id, req.body, ip(req)) });
    },
    async listIndicators(req, res) {
      res.status(200).json(await indicatorService.listIndicators(req.user, req.validatedQuery));
    },
    async revokeIndicator(req, res) {
      await indicatorService.revokeManually(req.user, req.params.id, req.body, ip(req));
      res.status(200).json({ revoked: true });
    },
  };
}

module.exports = { createRegistryController };

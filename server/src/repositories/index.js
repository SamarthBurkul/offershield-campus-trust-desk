'use strict';

const { createTenantRepository } = require('./tenantRepository');
const { User } = require('../models/User');
const { Counter } = require('../models/Counter');
const { Case } = require('../models/Case');
const { CaseEvent } = require('../models/CaseEvent');
const { Evidence } = require('../models/Evidence');
const { Note } = require('../models/Note');
const { AuditLog } = require('../models/AuditLog');
const { FraudIndicator } = require('../models/FraudIndicator');
const { Recruiter } = require('../models/Recruiter');
const { LookupEvent } = require('../models/LookupEvent');
const { Advisory } = require('../models/Advisory');
const { Acknowledgement } = require('../models/Acknowledgement');
const { Notification } = require('../models/Notification');

// College-owned collections. Services reach these models only through these repositories.
const userRepository = createTenantRepository(User);
const counterRepository = createTenantRepository(Counter);
const caseRepository = createTenantRepository(Case);
const caseEventRepository = createTenantRepository(CaseEvent);
const evidenceRepository = createTenantRepository(Evidence);
const noteRepository = createTenantRepository(Note);
// Read-only use: audit entries are written by audit.service and can never be updated or deleted.
const auditLogRepository = createTenantRepository(AuditLog);
// Written only by decision.service and indicator.service.
const fraudIndicatorRepository = createTenantRepository(FraudIndicator);
const recruiterRepository = createTenantRepository(Recruiter);
const lookupEventRepository = createTenantRepository(LookupEvent);
const advisoryRepository = createTenantRepository(Advisory);
const acknowledgementRepository = createTenantRepository(Acknowledgement);
// Always additionally filtered by userId in notification services.
const notificationRepository = createTenantRepository(Notification);

module.exports = {
  userRepository,
  counterRepository,
  caseRepository,
  caseEventRepository,
  evidenceRepository,
  noteRepository,
  auditLogRepository,
  fraudIndicatorRepository,
  recruiterRepository,
  lookupEventRepository,
  advisoryRepository,
  acknowledgementRepository,
  notificationRepository,
};

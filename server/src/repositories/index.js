'use strict';

const { createTenantRepository } = require('./tenantRepository');
const { User } = require('../models/User');
const { Counter } = require('../models/Counter');
const { Case } = require('../models/Case');
const { CaseEvent } = require('../models/CaseEvent');
const { Evidence } = require('../models/Evidence');

// College-owned collections. Services reach these models only through these repositories.
const userRepository = createTenantRepository(User);
const counterRepository = createTenantRepository(Counter);
const caseRepository = createTenantRepository(Case);
const caseEventRepository = createTenantRepository(CaseEvent);
const evidenceRepository = createTenantRepository(Evidence);

module.exports = { userRepository, counterRepository, caseRepository, caseEventRepository, evidenceRepository };

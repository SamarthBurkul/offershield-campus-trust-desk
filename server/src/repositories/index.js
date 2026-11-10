'use strict';

const { createTenantRepository } = require('./tenantRepository');
const { User } = require('../models/User');

// College-owned collections. Services reach these models only through these repositories.
const userRepository = createTenantRepository(User);

module.exports = { userRepository };

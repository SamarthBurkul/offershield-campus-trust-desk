'use strict';

const { Router } = require('express');
const healthRoutes = require('./health.routes');

// Mounted at /api/v1 by app.js. Feature routers are added here in later phases.
const router = Router();

router.use('/health', healthRoutes);

module.exports = router;

'use strict';

const { Router } = require('express');
const healthController = require('../controllers/health.controller');

const router = Router();

router.get('/', healthController.getHealth);
router.get('/ready', healthController.getReady);

module.exports = router;

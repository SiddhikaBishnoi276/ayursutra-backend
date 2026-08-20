const express = require('express');
const router = express.Router();
const { mockLoginHandler } = require('../Controllers/authController');

router.post('/mock-login', mockLoginHandler);

module.exports = router;

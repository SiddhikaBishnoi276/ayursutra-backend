const express = require('express');
const router = express.Router();
const { loginHandler, mockLoginHandler } = require('../Controllers/authController');

router.post('/login', loginHandler);
router.post('/mock-login', mockLoginHandler);

module.exports = router;


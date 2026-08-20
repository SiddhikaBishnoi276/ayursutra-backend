const express = require('express');
const router = express.Router();
const therapistController = require('../Controllers/therapistController');
const asyncHandler = require('../../Common/Middleware/asyncHandler');

/**
 * @route   GET /api/therapist/queue/:therapistId
 * @desc    Fetch daily active/pending sessions assigned to the therapist
 * @access  Protected / Therapist
 */
router.get('/queue/:therapistId', asyncHandler(therapistController.getTherapistQueue));

module.exports = router;

const express = require('express');
const router = express.Router();
const therapistController = require('../Controllers/therapistController');
const asyncHandler = require('../../Common/Middleware/asyncHandler');

/**
 * @route   PATCH /api/sessions/:sessionId/start
 * @desc    Start an active therapy session (status: in_progress)
 * @access  Protected / Therapist
 */
router.patch('/:sessionId/start', asyncHandler(therapistController.startSession));

/**
 * @route   POST /api/sessions/:sessionId/complete
 * @desc    Submit observation, complete session, and trigger sequential stage-locking / alert progression logic
 * @access  Protected / Therapist
 */
router.post('/:sessionId/complete', asyncHandler(therapistController.completeSession));

module.exports = router;

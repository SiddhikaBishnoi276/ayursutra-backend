const express = require('express');
const router = express.Router();
const therapistController = require('../Controllers/therapistController');
const asyncHandler = require('../../Common/Middleware/asyncHandler');

/**
 * @route   PATCH /api/sessions/:sessionId/start
 * @route   POST /api/sessions/:sessionId/start
 * @desc    Start an active therapy session (status: in_progress)
 * @access  Protected / Therapist
 */
router.patch('/:sessionId/start', asyncHandler(therapistController.startSession));
router.post('/:sessionId/start', asyncHandler(therapistController.startSession));

/**
 * @route   POST /api/sessions/:sessionId/complete
 * @desc    Submit observation, complete session, and trigger sequential stage-locking / alert progression logic
 * @access  Protected / Therapist
 */
router.post('/:sessionId/complete', asyncHandler(therapistController.completeSession));

/**
 * @route   POST /api/sessions/:sessionId/pause
 * @route   PATCH /api/sessions/:sessionId/pause
 * @desc    Emergency pause an ongoing therapy session and alert treating doctor
 * @access  Protected / Therapist
 */
router.post('/:sessionId/pause', asyncHandler(therapistController.pauseSession));
router.patch('/:sessionId/pause', asyncHandler(therapistController.pauseSession));

/**
 * @route   POST /api/sessions/:sessionId/handover
 * @route   PATCH /api/sessions/:sessionId/handover
 * @desc    Reassign a specific therapy session to another therapist
 * @access  Protected / Therapist / Clinic Admin
 */
router.post('/:sessionId/handover', asyncHandler(therapistController.shiftHandover));
router.patch('/:sessionId/handover', asyncHandler(therapistController.shiftHandover));

module.exports = router;

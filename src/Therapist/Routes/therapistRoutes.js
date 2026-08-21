const express = require('express');
const router = express.Router();
const therapistController = require('../Controllers/therapistController');
const asyncHandler = require('../../Common/Middleware/asyncHandler');

/**
 * @route   GET /api/therapist/queue/:therapistId
 * @desc    Fetch daily active/pending sessions assigned to the therapist with rich prep metadata
 * @access  Protected / Therapist / Solo Practitioner
 */
router.get('/queue/:therapistId', asyncHandler(therapistController.getTherapistQueue));

/**
 * @route   POST /api/therapist/shift-handover or POST /api/therapist/handover
 * @desc    Reassign scheduled sessions during shift change from source to target therapist
 * @access  Protected / Therapist / Clinic Admin
 */
router.post('/shift-handover', asyncHandler(therapistController.shiftHandover));
router.post('/handover', asyncHandler(therapistController.shiftHandover));

/**
 * @route   GET /api/therapist/shifts/:therapistId or /weekly-shifts/:therapistId
 * @desc    Get therapist recurring weekly shift schedule
 * @access  Protected / Therapist / Doctor / Clinic Admin
 */
router.get('/shifts/:therapistId', asyncHandler(therapistController.getWeeklyShifts));
router.get('/weekly-shifts/:therapistId', asyncHandler(therapistController.getWeeklyShifts));

/**
 * @route   POST /api/therapist/shifts or /weekly-shifts or PUT /shifts/:therapistId
 * @desc    Save or bulk update therapist recurring weekly shifts
 * @access  Protected / Therapist / Clinic Admin
 */
router.post('/shifts', asyncHandler(therapistController.saveWeeklyShifts));
router.post('/weekly-shifts', asyncHandler(therapistController.saveWeeklyShifts));
router.put('/shifts/:therapistId', asyncHandler(therapistController.saveWeeklyShifts));

/**
 * @route   GET /api/therapist/availability/:therapistId
 * @desc    Get therapist working / leave schedule (date-specific exceptions)
 * @access  Protected / Therapist / Doctor / Clinic Admin
 */
router.get('/availability/:therapistId', asyncHandler(therapistController.getTherapistAvailability));

/**
 * @route   POST /api/therapist/availability
 * @desc    Record or declare therapist availability or leave
 * @access  Protected / Therapist / Clinic Admin
 */
router.post('/availability', asyncHandler(therapistController.createAvailability));

/**
 * @route   PUT /api/therapist/availability/:availabilityId
 * @route   PATCH /api/therapist/availability/:availabilityId
 * @desc    Update therapist availability entry
 * @access  Protected / Therapist / Clinic Admin
 */
router.put('/availability/:availabilityId', asyncHandler(therapistController.updateAvailability));
router.patch('/availability/:availabilityId', asyncHandler(therapistController.updateAvailability));

/**
 * @route   DELETE /api/therapist/availability/:availabilityId
 * @desc    Remove therapist availability entry
 * @access  Protected / Therapist / Clinic Admin
 */
router.delete('/availability/:availabilityId', asyncHandler(therapistController.deleteAvailability));

/**
 * @route   POST /api/therapist/sessions/:sessionId/pause
 * @route   PATCH /api/therapist/sessions/:sessionId/pause
 * @desc    Emergency pause active session and alert doctor
 * @access  Protected / Therapist
 */
router.post('/sessions/:sessionId/pause', asyncHandler(therapistController.pauseSession));
router.patch('/sessions/:sessionId/pause', asyncHandler(therapistController.pauseSession));

/**
 * @route   POST /api/therapist/sessions/:sessionId/handover
 * @route   PATCH /api/therapist/sessions/:sessionId/handover
 * @desc    Single-session handover
 * @access  Protected / Therapist
 */
router.post('/sessions/:sessionId/handover', asyncHandler(therapistController.shiftHandover));
router.patch('/sessions/:sessionId/handover', asyncHandler(therapistController.shiftHandover));

module.exports = router;

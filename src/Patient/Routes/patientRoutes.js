const express = require('express');
const router = express.Router();
const patientController = require('../Controllers/patientController');
const asyncHandler = require('../../Common/Middleware/asyncHandler');

/**
 * @route   GET /api/patient/dashboard/:patientId
 * @desc    Fetch patient active treatment summary, session timeline, diet guidelines, and reminders
 * @access  Protected / Patient
 */
router.get('/dashboard/:patientId', asyncHandler(patientController.getPatientDashboard));

/**
 * @route   POST /api/patient/feedback
 * @desc    Submit patient post-session feedback
 * @access  Protected / Patient
 */
router.post('/feedback', asyncHandler(patientController.submitFeedback));

/**
 * @route   GET /api/patient/feedback/:patientId
 * @desc    Get patient past feedback submissions
 * @access  Protected / Patient
 */
router.get('/feedback/:patientId', asyncHandler(patientController.getPatientFeedback));

module.exports = router;

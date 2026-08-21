const express = require('express');
const router = express.Router();
const attachUser = require('../../Common/Middleware/attachUser');
const requireRole = require('../../Common/Middleware/requireRole');
const { getQuestionsHandler, submitAssessmentHandler } = require('../Controllers/prakritiController');

router.get('/questions', attachUser, requireRole(['doctor', 'solo_practitioner']), getQuestionsHandler);
router.post('/patients/:patientId/assessment', attachUser, requireRole(['doctor', 'solo_practitioner']), submitAssessmentHandler);

module.exports = router;

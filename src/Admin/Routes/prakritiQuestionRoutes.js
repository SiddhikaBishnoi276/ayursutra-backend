const express = require('express');
const router = express.Router();
const questionController = require('../Controllers/prakritiQuestionController');

// ── Question Level Operations ─────────────────────────────────────────────────

// POST   /api/prakriti-questions          — Add a new Prakriti Diagnostic Question (with options)
router.post('/', questionController.createQuestion);

// GET    /api/prakriti-questions          — List all diagnostic questions (filters: ?is_active=true & ?search=body)
router.get('/', questionController.getAllQuestions);

// GET    /api/prakriti-questions/:id      — Retrieve single question with options & dosha weights
router.get('/:id', questionController.getQuestionById);

// PUT    /api/prakriti-questions/:id      — Full update question & replace options
router.put('/:id', questionController.updateQuestion);

// PATCH  /api/prakriti-questions/:id      — Partial update question & options
router.patch('/:id', questionController.updateQuestion);

// DELETE /api/prakriti-questions/:id      — Remove / deactivate question (?permanent=true for hard delete)
router.delete('/:id', questionController.deleteQuestion);

// ── Nested Option Level Operations ───────────────────────────────────────────

// POST   /api/prakriti-questions/:id/options          — Add a single option to a question
router.post('/:id/options', questionController.addOption);

// DELETE /api/prakriti-questions/:id/options/:optionId — Remove an option from a question
router.delete('/:id/options/:optionId', questionController.removeOption);

module.exports = router;

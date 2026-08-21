const questionService = require('../Services/prakritiQuestionService');

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * PRAKRITI QUESTION CONTROLLER (Admin Module)
 * Clinical Diagnostic Questionnaire Management
 * ─────────────────────────────────────────────────────────────────────────────
 */

// Helper to validate options array
const validateOptions = (options) => {
  if (!Array.isArray(options)) {
    return '"options" must be an array of option objects.';
  }

  for (let i = 0; i < options.length; i++) {
    const opt = options[i];
    if (!opt.option_text || typeof opt.option_text !== 'string' || !opt.option_text.trim()) {
      return `Option at index ${i}: "option_text" is required and cannot be empty.`;
    }
  }

  return null;
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/prakriti-questions — Add a new Diagnostic Question with options
// ─────────────────────────────────────────────────────────────────────────────
const createQuestion = async (req, res) => {
  try {
    const { question_text, is_active = true, options = [] } = req.body;

    // Required field validation
    if (!question_text || typeof question_text !== 'string' || !question_text.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: "question_text" is required.',
      });
    }

    // Validate options if provided
    if (options.length > 0) {
      const optErr = validateOptions(options);
      if (optErr) {
        return res.status(400).json({ success: false, message: optErr });
      }
    }

    const newQuestion = await questionService.createQuestion({
      question_text: question_text.trim(),
      is_active: is_active !== false,
      options,
    });

    return res.status(201).json({
      success: true,
      message: 'Prakriti diagnostic question created successfully.',
      data: newQuestion,
    });
  } catch (err) {
    console.error('[createQuestion]', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/prakriti-questions — List all questions with filters
// Query params: ?is_active=true  &  ?search=frame
// ─────────────────────────────────────────────────────────────────────────────
const getAllQuestions = async (req, res) => {
  try {
    const { is_active, search } = req.query;

    const questions = await questionService.getAllQuestions({
      is_active,
      search,
    });

    return res.status(200).json({
      success: true,
      count: questions.length,
      data: questions,
    });
  } catch (err) {
    console.error('[getAllQuestions]', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/prakriti-questions/:id — Retrieve single question with options
// ─────────────────────────────────────────────────────────────────────────────
const getQuestionById = async (req, res) => {
  try {
    const questionId = parseInt(req.params.id, 10);

    if (isNaN(questionId)) {
      return res.status(400).json({ success: false, message: 'Invalid question ID.' });
    }

    const question = await questionService.getQuestionById(questionId);

    if (!question) {
      return res.status(404).json({
        success: false,
        message: `Prakriti diagnostic question with ID ${questionId} not found.`,
      });
    }

    return res.status(200).json({ success: true, data: question });
  } catch (err) {
    console.error('[getQuestionById]', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT / PATCH /api/prakriti-questions/:id — Update question & replace/update options
// ─────────────────────────────────────────────────────────────────────────────
const updateQuestion = async (req, res) => {
  try {
    const questionId = parseInt(req.params.id, 10);

    if (isNaN(questionId)) {
      return res.status(400).json({ success: false, message: 'Invalid question ID.' });
    }

    const { question_text, is_active, options } = req.body;

    if (options !== undefined) {
      const optErr = validateOptions(options);
      if (optErr) {
        return res.status(400).json({ success: false, message: optErr });
      }
    }

    const updated = await questionService.updateQuestion(questionId, {
      question_text: question_text !== undefined ? question_text.trim() : undefined,
      is_active,
      options,
    });

    return res.status(200).json({
      success: true,
      message: 'Prakriti diagnostic question updated successfully.',
      data: updated,
    });
  } catch (err) {
    if (err.statusCode === 404) {
      return res.status(404).json({ success: false, message: err.message });
    }
    console.error('[updateQuestion]', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/prakriti-questions/:id — Remove or Deactivate Question
// Query param: ?permanent=true (optional, default is soft deactivate is_active=false)
// ─────────────────────────────────────────────────────────────────────────────
const deleteQuestion = async (req, res) => {
  try {
    const questionId = parseInt(req.params.id, 10);

    if (isNaN(questionId)) {
      return res.status(400).json({ success: false, message: 'Invalid question ID.' });
    }

    const isPermanent = req.query.permanent === 'true';

    const result = await questionService.deleteQuestion(questionId, {
      permanent: isPermanent,
    });

    return res.status(200).json({
      success: true,
      message: isPermanent
        ? 'Prakriti diagnostic question permanently deleted.'
        : 'Prakriti diagnostic question deactivated (removed from active pool).',
      data: result,
    });
  } catch (err) {
    if (err.statusCode === 404) {
      return res.status(404).json({ success: false, message: err.message });
    }
    console.error('[deleteQuestion]', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/prakriti-questions/:id/options — Add an option to an existing question
// ─────────────────────────────────────────────────────────────────────────────
const addOption = async (req, res) => {
  try {
    const questionId = parseInt(req.params.id, 10);
    const { option_text, dosha_weight } = req.body;

    if (isNaN(questionId)) {
      return res.status(400).json({ success: false, message: 'Invalid question ID.' });
    }

    if (!option_text || !option_text.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: "option_text" is required.',
      });
    }

    const newOption = await questionService.addOption(questionId, {
      option_text: option_text.trim(),
      dosha_weight: dosha_weight || {},
    });

    return res.status(201).json({
      success: true,
      message: 'Question option added successfully.',
      data: newOption,
    });
  } catch (err) {
    if (err.statusCode === 404) {
      return res.status(404).json({ success: false, message: err.message });
    }
    console.error('[addOption]', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/prakriti-questions/:id/options/:optionId — Remove an option
// ─────────────────────────────────────────────────────────────────────────────
const removeOption = async (req, res) => {
  try {
    const questionId = parseInt(req.params.id, 10);
    const optionId = parseInt(req.params.optionId, 10);

    if (isNaN(questionId) || isNaN(optionId)) {
      return res.status(400).json({ success: false, message: 'Invalid question or option ID.' });
    }

    const deleted = await questionService.removeOption(questionId, optionId);

    return res.status(200).json({
      success: true,
      message: 'Question option removed successfully.',
      data: deleted,
    });
  } catch (err) {
    if (err.statusCode === 404) {
      return res.status(404).json({ success: false, message: err.message });
    }
    console.error('[removeOption]', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

module.exports = {
  createQuestion,
  getAllQuestions,
  getQuestionById,
  updateQuestion,
  deleteQuestion,
  addOption,
  removeOption,
};

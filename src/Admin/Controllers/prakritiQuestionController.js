const questionService = require('../Services/prakritiQuestionService');

// Helper to validate options array
const validateOptions = (options) => {
  if (!Array.isArray(options)) {
    return '"options" must be an array of option objects.';
  }

  for (let i = 0; i < options.length; i++) {
    const opt = options[i];
    if (!opt.text || typeof opt.text !== 'string' || !opt.text.trim()) {
      return `Option at index ${i}: "text" is required and cannot be empty.`;
    }
  }

  return null;
};

const createQuestion = async (req, res, next) => {
  try {
    const { questionText, attribute, is_active = true, options = [] } = req.body;

    if (!questionText || typeof questionText !== 'string' || !questionText.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: "questionText" is required.',
      });
    }

    if (options.length > 0) {
      const optErr = validateOptions(options);
      if (optErr) {
        return res.status(400).json({ success: false, message: optErr });
      }
    }

    const newQuestion = await questionService.createQuestion({
      question_text: questionText.trim(),
      attribute: attribute ? attribute.trim() : null,
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
    next(err);
  }
};

const getAllQuestions = async (req, res, next) => {
  try {
    const { is_active, search } = req.query;
    const questions = await questionService.getAllQuestions({ is_active, search });

    return res.status(200).json({
      success: true,
      count: questions.length,
      data: questions,
    });
  } catch (err) {
    console.error('[getAllQuestions]', err);
    next(err);
  }
};

const getQuestionById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const rawId = parseInt(id.replace('Q-', ''), 10);

    if (isNaN(rawId)) {
      return res.status(400).json({ success: false, message: 'Invalid question ID.' });
    }

    const question = await questionService.getQuestionById(rawId);

    if (!question) {
      return res.status(404).json({
        success: false,
        message: `Prakriti diagnostic question with ID ${rawId} not found.`,
      });
    }

    return res.status(200).json({
      success: true,
      data: question,
    });
  } catch (err) {
    console.error('[getQuestionById]', err);
    next(err);
  }
};

const updateQuestion = async (req, res, next) => {
  try {
    const { id } = req.params;
    const rawId = parseInt(id.replace('Q-', ''), 10);

    if (isNaN(rawId)) {
      return res.status(400).json({ success: false, message: 'Invalid question ID.' });
    }

    const { questionText, attribute, is_active, options } = req.body;

    if (options !== undefined) {
      const optErr = validateOptions(options);
      if (optErr) {
        return res.status(400).json({ success: false, message: optErr });
      }
    }

    const updated = await questionService.updateQuestion(rawId, {
      question_text: questionText !== undefined ? questionText.trim() : undefined,
      attribute: attribute !== undefined ? attribute.trim() : undefined,
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
    next(err);
  }
};

const deleteQuestion = async (req, res, next) => {
  try {
    const { id } = req.params;
    const rawId = parseInt(id.replace('Q-', ''), 10);

    if (isNaN(rawId)) {
      return res.status(400).json({ success: false, message: 'Invalid question ID.' });
    }

    const { permanent } = req.query;

    const result = await questionService.deleteQuestion(rawId, {
      permanent: permanent === 'true',
    });

    return res.status(200).json({
      success: true,
      message: permanent 
        ? 'Prakriti diagnostic question permanently deleted.' 
        : 'Prakriti diagnostic question deactivated successfully.',
      data: result,
    });
  } catch (err) {
    if (err.statusCode === 404) {
      return res.status(404).json({ success: false, message: err.message });
    }
    console.error('[deleteQuestion]', err);
    next(err);
  }
};

const addOption = async (req, res, next) => {
  try {
    const { id } = req.params;
    const rawId = parseInt(id.replace('Q-', ''), 10);
    const { text, vata, pitta, kapha } = req.body;

    if (isNaN(rawId)) {
      return res.status(400).json({ success: false, message: 'Invalid question ID.' });
    }

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: "text" is required.',
      });
    }

    const dosha_weight = { vata: vata || 0, pitta: pitta || 0, kapha: kapha || 0 };

    const newOption = await questionService.addOption(rawId, {
      option_text: text.trim(),
      dosha_weight,
    });

    return res.status(201).json({
      success: true,
      message: 'Option added successfully.',
      data: newOption,
    });
  } catch (err) {
    if (err.statusCode === 404) {
      return res.status(404).json({ success: false, message: err.message });
    }
    console.error('[addOption]', err);
    next(err);
  }
};

const removeOption = async (req, res, next) => {
  try {
    const { id, optionId } = req.params;
    const rawId = parseInt(id.replace('Q-', ''), 10);
    const optId = parseInt(optionId, 10);

    if (isNaN(rawId) || isNaN(optId)) {
      return res.status(400).json({ success: false, message: 'Invalid question or option ID.' });
    }

    const removed = await questionService.removeOption(rawId, optId);

    return res.status(200).json({
      success: true,
      message: 'Option removed successfully.',
      data: removed,
    });
  } catch (err) {
    if (err.statusCode === 404) {
      return res.status(404).json({ success: false, message: err.message });
    }
    console.error('[removeOption]', err);
    next(err);
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

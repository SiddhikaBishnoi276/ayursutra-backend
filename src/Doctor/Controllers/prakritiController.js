const { getActiveQuestions, submitAssessment } = require('../Services/prakritiService');

async function getQuestionsHandler(req, res) {
  try {
    const questions = await getActiveQuestions();
    res.json(questions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function submitAssessmentHandler(req, res) {
  try {
    const { patientId } = req.params;
    const { answers, clinical_observation } = req.body;
    if (!Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({ error: 'answers array is required' });
    }
    const assessment = await submitAssessment(patientId, req.user, { answers, clinical_observation });
    res.status(201).json({ message: 'Prakriti confirmed & locked', assessment });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { getQuestionsHandler, submitAssessmentHandler };

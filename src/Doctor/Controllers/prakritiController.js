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
    const { answers, clinical_observation, confirmed_dosha, dominantPrakriti, notes } = req.body;

    const resolvedDosha = confirmed_dosha || dominantPrakriti;
    const resolvedObservation = clinical_observation || notes || 'Prakriti assessment confirmed & locked by doctor.';

    const assessment = await submitAssessment(patientId, req.user, {
      answers: Array.isArray(answers) ? answers : [],
      clinical_observation: resolvedObservation,
      confirmed_dosha: resolvedDosha,
    });

    res.status(201).json({
      success: true,
      message: 'Prakriti confirmed & locked',
      assessment,
      ...assessment,
    });
  } catch (err) {
    console.error('Error in submitAssessmentHandler:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { getQuestionsHandler, submitAssessmentHandler };


const { pool, query } = require('../../config/db');

async function getActiveQuestions() {
  const questionsResult = await query(
    `SELECT id, question_text FROM prakriti_questions WHERE is_active = true ORDER BY id ASC`
  );
  const optionsResult = await query(
    `SELECT id, question_id, option_text, dosha_weight FROM prakriti_question_options ORDER BY question_id, id`
  );

  return questionsResult.rows.map((q) => ({
    ...q,
    options: optionsResult.rows.filter((o) => o.question_id === q.id),
  }));
}

function calculateDoshaScores(selectedOptions) {
  const scores = { vata: 0, pitta: 0, kapha: 0 };
  selectedOptions.forEach((opt) => {
    const w = opt.dosha_weight || {};
    scores.vata += w.vata || 0;
    scores.pitta += w.pitta || 0;
    scores.kapha += w.kapha || 0;
  });
  return scores;
}

function determineConfirmedDosha(scores) {
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [topDosha, topScore] = sorted[0];
  const [secondDosha, secondScore] = sorted[1];
  const label = (d) => d.charAt(0).toUpperCase() + d.slice(1);

  if (topScore === 0) return 'Undetermined';
  if (topScore - secondScore <= 1 && secondScore > 0) {
    return `${label(topDosha)}-${label(secondDosha)}`;
  }
  return `${label(topDosha)}-dominant`;
}

async function submitAssessment(patientId, doctorUser, { answers, clinical_observation }) {
  const optionIds = answers.map((a) => a.option_id);
  const optionsResult = await query(
    `SELECT id, dosha_weight FROM prakriti_question_options WHERE id = ANY($1::int[])`,
    [optionIds]
  );

  const scores = calculateDoshaScores(optionsResult.rows);
  const confirmedDosha = determineConfirmedDosha(scores);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const assessmentResult = await client.query(
      `INSERT INTO prakriti_assessments
        (patient_id, conducted_by, tentative_vata, tentative_pitta, tentative_kapha, clinical_observation, confirmed_dosha)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, tentative_vata, tentative_pitta, tentative_kapha, confirmed_dosha, assessed_at`,
      [patientId, doctorUser.id, scores.vata, scores.pitta, scores.kapha, clinical_observation || null, confirmedDosha]
    );
    const assessment = assessmentResult.rows[0];

    for (const ans of answers) {
      await client.query(
        `INSERT INTO prakriti_assessment_answers (assessment_id, question_id, option_id) VALUES ($1, $2, $3)`,
        [assessment.id, ans.question_id, ans.option_id]
      );
    }

    await client.query('COMMIT');
    return assessment;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { getActiveQuestions, submitAssessment };

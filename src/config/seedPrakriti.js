const { pool } = require('./db');

const questions = [
  { text: 'How would you describe your body frame?', options: [
    { text: 'Thin and lean, find it hard to gain weight', weight: { vata: 1, pitta: 0, kapha: 0 } },
    { text: 'Medium build, athletic', weight: { vata: 0, pitta: 1, kapha: 0 } },
    { text: 'Broad and heavy, gain weight easily', weight: { vata: 0, pitta: 0, kapha: 1 } },
  ]},
  { text: 'How is your skin usually?', options: [
    { text: 'Dry and rough', weight: { vata: 1, pitta: 0, kapha: 0 } },
    { text: 'Warm, oily, prone to rashes/acne', weight: { vata: 0, pitta: 1, kapha: 0 } },
    { text: 'Thick, moist, and cool', weight: { vata: 0, pitta: 0, kapha: 1 } },
  ]},
  { text: 'How is your appetite?', options: [
    { text: 'Irregular, sometimes hungry, sometimes not', weight: { vata: 1, pitta: 0, kapha: 0 } },
    { text: 'Strong and sharp, get irritable if I skip a meal', weight: { vata: 0, pitta: 1, kapha: 0 } },
    { text: 'Slow but steady, can skip meals easily', weight: { vata: 0, pitta: 0, kapha: 1 } },
  ]},
  { text: 'How do you usually sleep?', options: [
    { text: 'Light sleeper, easily disturbed', weight: { vata: 1, pitta: 0, kapha: 0 } },
    { text: 'Moderate, sound sleep', weight: { vata: 0, pitta: 1, kapha: 0 } },
    { text: 'Deep, heavy sleeper, hard to wake up', weight: { vata: 0, pitta: 0, kapha: 1 } },
  ]},
  { text: 'How would you describe your temperament?', options: [
    { text: 'Quick, restless, anxious at times', weight: { vata: 1, pitta: 0, kapha: 0 } },
    { text: 'Intense, focused, can get irritable', weight: { vata: 0, pitta: 1, kapha: 0 } },
    { text: 'Calm, steady, slow to anger', weight: { vata: 0, pitta: 1, kapha: 0 } },
  ]},
  { text: 'Which weather do you dislike the most?', options: [
    { text: 'Cold and dry weather', weight: { vata: 1, pitta: 0, kapha: 0 } },
    { text: 'Hot weather', weight: { vata: 0, pitta: 1, kapha: 0 } },
    { text: 'Cold and damp weather', weight: { vata: 0, pitta: 0, kapha: 1 } },
  ]},
];

async function seedPrakritiQuestions() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const q of questions) {
      const existing = await client.query('SELECT id FROM prakriti_questions WHERE question_text = $1', [q.text]);
      let questionId = existing.rows[0]?.id;
      if (!questionId) {
        const r = await client.query(
          'INSERT INTO prakriti_questions (question_text, is_active) VALUES ($1, true) RETURNING id',
          [q.text]
        );
        questionId = r.rows[0].id;
      }
      for (const opt of q.options) {
        const existingOpt = await client.query(
          'SELECT id FROM prakriti_question_options WHERE question_id = $1 AND option_text = $2',
          [questionId, opt.text]
        );
        if (existingOpt.rows.length === 0) {
          await client.query(
            'INSERT INTO prakriti_question_options (question_id, option_text, dosha_weight) VALUES ($1, $2, $3)',
            [questionId, opt.text, JSON.stringify(opt.weight)]
          );
        }
      }
    }
    await client.query('COMMIT');
    console.log('✅ Prakriti question bank seeded successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Prakriti seeding failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) seedPrakritiQuestions();
module.exports = seedPrakritiQuestions;

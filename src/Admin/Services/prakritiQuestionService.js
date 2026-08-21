const { pool } = require('../../config/db');

const formatQuestionForUI = (row) => ({
  id: `Q-${row.id.toString().padStart(2, '0')}`,
  _raw_id: row.id,
  attribute: row.attribute,
  questionText: row.question_text,
  is_active: row.is_active,
  hasHistoricalResponses: false,
  options: (row.options || []).map(opt => ({
    id: opt.id,
    text: opt.option_text,
    vata: opt.dosha_weight?.vata || 0,
    pitta: opt.dosha_weight?.pitta || 0,
    kapha: opt.dosha_weight?.kapha || 0
  }))
});

const createQuestion = async ({ question_text, attribute, is_active = true, options = [] }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const questionResult = await client.query(
      `INSERT INTO prakriti_questions (question_text, attribute, is_active)
       VALUES ($1, $2, $3)
       RETURNING id, question_text, attribute, is_active`,
      [question_text, attribute, is_active !== false]
    );

    const newQuestion = questionResult.rows[0];
    const insertedOptions = [];
    for (const opt of options) {
      const optionResult = await client.query(
        `INSERT INTO prakriti_question_options (question_id, option_text, dosha_weight)
         VALUES ($1, $2, $3)
         RETURNING id, question_id, option_text, dosha_weight`,
        [
          newQuestion.id,
          opt.text,
          JSON.stringify({ vata: opt.vata || 0, pitta: opt.pitta || 0, kapha: opt.kapha || 0 }),
        ]
      );
      insertedOptions.push(optionResult.rows[0]);
    }

    await client.query('COMMIT');
    return formatQuestionForUI({ ...newQuestion, options: insertedOptions });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const getAllQuestions = async ({ is_active, search } = {}) => {
  const conditions = [];
  const params = [];

  if (is_active !== undefined) {
    params.push(is_active === 'true' || is_active === true);
    conditions.push(`q.is_active = $${params.length}`);
  }

  if (search && search.trim()) {
    params.push(`%${search.trim()}%`);
    conditions.push(`q.question_text ILIKE $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const queryText = `
    SELECT 
      q.id,
      q.question_text,
      q.attribute,
      q.is_active,
      COALESCE(
        json_agg(
          json_build_object(
            'id', o.id,
            'question_id', o.question_id,
            'option_text', o.option_text,
            'dosha_weight', o.dosha_weight
          ) ORDER BY o.id ASC
        ) FILTER (WHERE o.id IS NOT NULL),
        '[]'::json
      ) AS options
    FROM prakriti_questions q
    LEFT JOIN prakriti_question_options o ON q.id = o.question_id
    ${whereClause}
    GROUP BY q.id
    ORDER BY q.id ASC;
  `;

  const result = await pool.query(queryText, params);
  return result.rows.map(formatQuestionForUI);
};

const getQuestionById = async (id) => {
  const queryText = `
    SELECT 
      q.id,
      q.question_text,
      q.attribute,
      q.is_active,
      COALESCE(
        json_agg(
          json_build_object(
            'id', o.id,
            'question_id', o.question_id,
            'option_text', o.option_text,
            'dosha_weight', o.dosha_weight
          ) ORDER BY o.id ASC
        ) FILTER (WHERE o.id IS NOT NULL),
        '[]'::json
      ) AS options
    FROM prakriti_questions q
    LEFT JOIN prakriti_question_options o ON q.id = o.question_id
    WHERE q.id = $1
    GROUP BY q.id;
  `;

  const result = await pool.query(queryText, [id]);
  return result.rows[0] ? formatQuestionForUI(result.rows[0]) : null;
};

const updateQuestion = async (id, { question_text, attribute, is_active, options }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const checkRes = await client.query(
      `SELECT id, question_text, attribute, is_active FROM prakriti_questions WHERE id = $1`,
      [id]
    );

    if (checkRes.rows.length === 0) {
      const err = new Error(`Prakriti question with ID ${id} not found.`);
      err.statusCode = 404;
      throw err;
    }

    const current = checkRes.rows[0];
    const newText = question_text !== undefined ? question_text : current.question_text;
    const newAttr = attribute !== undefined ? attribute : current.attribute;
    const newActive = is_active !== undefined ? is_active : current.is_active;

    const updateRes = await client.query(
      `UPDATE prakriti_questions
       SET question_text = $1, attribute = $2, is_active = $3
       WHERE id = $4
       RETURNING id, question_text, attribute, is_active`,
      [newText, newAttr, newActive, id]
    );

    const updatedQuestion = updateRes.rows[0];
    let currentOptions = [];
    
    if (Array.isArray(options)) {
      await client.query(`DELETE FROM prakriti_question_options WHERE question_id = $1`, [id]);
      for (const opt of options) {
        const optRes = await client.query(
          `INSERT INTO prakriti_question_options (question_id, option_text, dosha_weight)
           VALUES ($1, $2, $3)
           RETURNING id, question_id, option_text, dosha_weight`,
          [
            id,
            opt.text,
            JSON.stringify({ vata: opt.vata || 0, pitta: opt.pitta || 0, kapha: opt.kapha || 0 }),
          ]
        );
        currentOptions.push(optRes.rows[0]);
      }
    } else {
      const optRes = await client.query(
        `SELECT id, question_id, option_text, dosha_weight
         FROM prakriti_question_options
         WHERE question_id = $1
         ORDER BY id ASC`,
        [id]
      );
      currentOptions = optRes.rows;
    }

    await client.query('COMMIT');
    return formatQuestionForUI({ ...updatedQuestion, options: currentOptions });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const deleteQuestion = async (id, { permanent = false } = {}) => {
  if (permanent) {
    const result = await pool.query(
      `DELETE FROM prakriti_questions
       WHERE id = $1
       RETURNING id, question_text, is_active`,
      [id]
    );

    if (result.rows.length === 0) {
      const err = new Error(`Prakriti question with ID ${id} not found.`);
      err.statusCode = 404;
      throw err;
    }

    return { ...result.rows[0], deleted: true, mode: 'permanent' };
  }

  const result = await pool.query(
    `UPDATE prakriti_questions
     SET is_active = FALSE
     WHERE id = $1
     RETURNING id, question_text, is_active`,
    [id]
  );

  if (result.rows.length === 0) {
    const err = new Error(`Prakriti question with ID ${id} not found.`);
    err.statusCode = 404;
    throw err;
  }

  return { ...result.rows[0], deleted: true, mode: 'deactivated' };
};

const addOption = async (questionId, { option_text, dosha_weight }) => {
  const qCheck = await pool.query(`SELECT id FROM prakriti_questions WHERE id = $1`, [questionId]);
  if (qCheck.rows.length === 0) {
    const err = new Error(`Prakriti question with ID ${questionId} not found.`);
    err.statusCode = 404;
    throw err;
  }

  const result = await pool.query(
    `INSERT INTO prakriti_question_options (question_id, option_text, dosha_weight)
     VALUES ($1, $2, $3)
     RETURNING id, question_id, option_text, dosha_weight`,
    [questionId, option_text, JSON.stringify(dosha_weight || {})]
  );
  return result.rows[0];
};

const removeOption = async (questionId, optionId) => {
  const result = await pool.query(
    `DELETE FROM prakriti_question_options
     WHERE id = $1 AND question_id = $2
     RETURNING id, question_id, option_text`,
    [optionId, questionId]
  );

  if (result.rows.length === 0) {
    const err = new Error(`Option with ID ${optionId} for question ${questionId} not found.`);
    err.statusCode = 404;
    throw err;
  }
  return result.rows[0];
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

const { pool } = require('../../config/db');

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * PRAKRITI QUESTION SERVICE
 * Handles CRUD operations for Prakriti Assessment Diagnostic Questionnaire
 * Strictly utilizes existing schema tables:
 * - prakriti_questions (id, question_text, is_active)
 * - prakriti_question_options (id, question_id, option_text, dosha_weight)
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * 1. CREATE QUESTION (Deep insert with options)
 * Wrapped in a DB transaction for atomicity.
 */
const createQuestion = async ({ question_text, is_active = true, options = [] }) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Insert question into prakriti_questions
    const questionResult = await client.query(
      `INSERT INTO prakriti_questions (question_text, is_active)
       VALUES ($1, $2)
       RETURNING id, question_text, is_active`,
      [question_text, is_active !== false]
    );

    const newQuestion = questionResult.rows[0];

    // 2. Insert nested options if provided
    const insertedOptions = [];
    for (const opt of options) {
      const optionResult = await client.query(
        `INSERT INTO prakriti_question_options (question_id, option_text, dosha_weight)
         VALUES ($1, $2, $3)
         RETURNING id, question_id, option_text, dosha_weight`,
        [
          newQuestion.id,
          opt.option_text,
          opt.dosha_weight ? JSON.stringify(opt.dosha_weight) : JSON.stringify({}),
        ]
      );
      insertedOptions.push(optionResult.rows[0]);
    }

    await client.query('COMMIT');

    return {
      ...newQuestion,
      options: insertedOptions,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * 2. GET ALL QUESTIONS
 * Supports filtering by is_active and optional text search.
 * Deeply aggregates options ordered by id.
 */
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
  return result.rows;
};

/**
 * 3. GET QUESTION BY ID
 */
const getQuestionById = async (id) => {
  const queryText = `
    SELECT 
      q.id,
      q.question_text,
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
  return result.rows[0] || null;
};

/**
 * 4. UPDATE QUESTION
 * Allows updating question_text, is_active status, and optionally replacing/updating options array.
 */
const updateQuestion = async (id, { question_text, is_active, options }) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Verify existence
    const checkRes = await client.query(
      `SELECT id, question_text, is_active FROM prakriti_questions WHERE id = $1`,
      [id]
    );

    if (checkRes.rows.length === 0) {
      const err = new Error(`Prakriti question with ID ${id} not found.`);
      err.statusCode = 404;
      throw err;
    }

    const current = checkRes.rows[0];
    const newText = question_text !== undefined ? question_text : current.question_text;
    const newActive = is_active !== undefined ? is_active : current.is_active;

    // 2. Update question table
    const updateRes = await client.query(
      `UPDATE prakriti_questions
       SET question_text = $1, is_active = $2
       WHERE id = $3
       RETURNING id, question_text, is_active`,
      [newText, newActive, id]
    );

    const updatedQuestion = updateRes.rows[0];

    // 3. Update options if explicitly supplied
    let currentOptions = [];
    if (Array.isArray(options)) {
      // Remove old options and insert new set
      await client.query(`DELETE FROM prakriti_question_options WHERE question_id = $1`, [id]);

      for (const opt of options) {
        const optRes = await client.query(
          `INSERT INTO prakriti_question_options (question_id, option_text, dosha_weight)
           VALUES ($1, $2, $3)
           RETURNING id, question_id, option_text, dosha_weight`,
          [
            id,
            opt.option_text,
            opt.dosha_weight ? JSON.stringify(opt.dosha_weight) : JSON.stringify({}),
          ]
        );
        currentOptions.push(optRes.rows[0]);
      }
    } else {
      // Fetch existing options
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

    return {
      ...updatedQuestion,
      options: currentOptions,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * 5. DELETE / REMOVE QUESTION
 * Supports soft-delete (default, is_active = false) or hard-delete (permanent = true).
 */
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

    return {
      ...result.rows[0],
      deleted: true,
      mode: 'permanent',
    };
  }

  // Soft delete (deactivate)
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

  return {
    ...result.rows[0],
    deleted: true,
    mode: 'deactivated',
  };
};

/**
 * 6. ADD OPTION TO QUESTION
 */
const addOption = async (questionId, { option_text, dosha_weight }) => {
  // Check question existence
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
    [
      questionId,
      option_text,
      dosha_weight ? JSON.stringify(dosha_weight) : JSON.stringify({}),
    ]
  );

  return result.rows[0];
};

/**
 * 7. REMOVE OPTION FROM QUESTION
 */
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

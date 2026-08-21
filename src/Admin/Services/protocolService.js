const { pool } = require('../../config/db');

// ─────────────────────────────────────────────────────────────────────────────
// CREATE PROTOCOL (Deep Insert: therapy_packages + therapy_package_stages)
// Wrapped in a DB transaction for atomicity.
// ─────────────────────────────────────────────────────────────────────────────
const createProtocol = async ({
  name,
  therapy_type,
  clinic_id,
  created_by,
  stages = [],
}) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Insert parent record into therapy_packages
    const packageResult = await client.query(
      `INSERT INTO therapy_packages (name, therapy_type, clinic_id, created_by, is_active)
       VALUES ($1, $2, $3, $4, TRUE)
       RETURNING id, name, therapy_type, clinic_id, created_by, is_active, created_at`,
      [name, therapy_type, clinic_id, created_by || null]
    );

    const newProtocol = packageResult.rows[0];

    // 2. Insert child stages if provided
    const insertedStages = [];
    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i];
      const stageResult = await client.query(
        `INSERT INTO therapy_package_stages
           (package_id, stage_type, sequence_order, day_offset, duration_days,
            session_duration_minutes, pre_instructions, post_instructions, base_diet_framework)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, package_id, stage_type, sequence_order, day_offset,
                   duration_days, session_duration_minutes, pre_instructions, post_instructions, base_diet_framework`,
        [
          newProtocol.id,
          stage.stage_type,
          stage.sequence_order !== undefined ? stage.sequence_order : i + 1,
          stage.day_offset || 0,
          stage.duration_days,
          stage.session_duration_minutes || 45,
          stage.pre_instructions || null,
          stage.post_instructions || null,
          stage.base_diet_framework ? JSON.stringify(stage.base_diet_framework) : null,
        ]
      );
      insertedStages.push(stageResult.rows[0]);
    }

    await client.query('COMMIT');

    const totalDurationDays = insertedStages.reduce(
      (sum, s) => sum + (parseInt(s.duration_days, 10) || 0),
      0
    );

    return {
      ...newProtocol,
      total_duration_days: totalDurationDays,
      stages: insertedStages,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET ALL PROTOCOLS (List with filtering & aggregated duration)
// Filters: clinic_id, therapy_type, is_active
// ─────────────────────────────────────────────────────────────────────────────
const getAllProtocols = async ({ clinic_id, therapy_type, is_active }) => {
  const conditions = [];
  const params = [];

  if (clinic_id) {
    params.push(clinic_id);
    conditions.push(`tp.clinic_id = $${params.length}`);
  }

  if (therapy_type) {
    params.push(therapy_type);
    conditions.push(`tp.therapy_type = $${params.length}`);
  }

  if (is_active !== undefined) {
    params.push(is_active === 'true' || is_active === true);
    conditions.push(`tp.is_active = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await pool.query(
    `SELECT
       tp.id,
       tp.name,
       tp.therapy_type,
       tp.clinic_id,
       tp.created_by,
       tp.is_active,
       tp.created_at,
       COUNT(tps.id)::INT AS total_stages,
       COALESCE(SUM(tps.duration_days), 0)::INT AS total_duration_days
     FROM therapy_packages tp
     LEFT JOIN therapy_package_stages tps ON tps.package_id = tp.id
     ${whereClause}
     GROUP BY tp.id
     ORDER BY tp.created_at DESC`,
    params
  );

  return result.rows;
};

// ─────────────────────────────────────────────────────────────────────────────
// GET PROTOCOL BY ID (Deep fetch with ordered child stages)
// ─────────────────────────────────────────────────────────────────────────────
const getProtocolById = async (id) => {
  // 1. Fetch parent package
  const packageResult = await pool.query(
    `SELECT id, name, therapy_type, clinic_id, created_by, is_active, created_at
     FROM therapy_packages
     WHERE id = $1`,
    [id]
  );

  if (packageResult.rows.length === 0) {
    return null;
  }

  const protocol = packageResult.rows[0];

  // 2. Fetch all child stages ordered by sequence_order ASC
  const stagesResult = await pool.query(
    `SELECT id, package_id, stage_type, sequence_order, day_offset,
            duration_days, session_duration_minutes, pre_instructions, post_instructions, base_diet_framework
     FROM therapy_package_stages
     WHERE package_id = $1
     ORDER BY sequence_order ASC`,
    [id]
  );

  const totalDurationDays = stagesResult.rows.reduce(
    (sum, s) => sum + (parseInt(s.duration_days, 10) || 0),
    0
  );

  return {
    ...protocol,
    total_stages: stagesResult.rows.length,
    total_duration_days: totalDurationDays,
    stages: stagesResult.rows,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE PROTOCOL (Deep update: parent fields + full replacement of stages)
// ─────────────────────────────────────────────────────────────────────────────
const updateProtocol = async (id, { name, therapy_type, is_active, stages }) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Verify existence
    const checkRes = await client.query(
      `SELECT id FROM therapy_packages WHERE id = $1`,
      [id]
    );
    if (checkRes.rows.length === 0) {
      const err = new Error('Protocol not found.');
      err.statusCode = 404;
      throw err;
    }

    // 2. Build dynamic UPDATE for parent fields
    const updateFields = [];
    const updateParams = [];

    if (name !== undefined) {
      updateParams.push(name);
      updateFields.push(`name = $${updateParams.length}`);
    }
    if (therapy_type !== undefined) {
      updateParams.push(therapy_type);
      updateFields.push(`therapy_type = $${updateParams.length}`);
    }
    if (is_active !== undefined) {
      updateParams.push(is_active);
      updateFields.push(`is_active = $${updateParams.length}`);
    }

    if (updateFields.length > 0) {
      updateParams.push(id);
      await client.query(
        `UPDATE therapy_packages
         SET ${updateFields.join(', ')}
         WHERE id = $${updateParams.length}`,
        updateParams
      );
    }

    // 3. If stages array is provided, replace all existing stages
    if (Array.isArray(stages)) {
      // Delete old stages (CASCADE safe — only therapy_package_stages, not plan stages)
      await client.query(
        `DELETE FROM therapy_package_stages WHERE package_id = $1`,
        [id]
      );

      // Insert replacement stages
      for (let i = 0; i < stages.length; i++) {
        const stage = stages[i];
        await client.query(
          `INSERT INTO therapy_package_stages
             (package_id, stage_type, sequence_order, day_offset, duration_days,
              session_duration_minutes, pre_instructions, post_instructions, base_diet_framework)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            id,
            stage.stage_type,
            stage.sequence_order !== undefined ? stage.sequence_order : i + 1,
            stage.day_offset || 0,
            stage.duration_days,
            stage.session_duration_minutes || 45,
            stage.pre_instructions || null,
            stage.post_instructions || null,
            stage.base_diet_framework ? JSON.stringify(stage.base_diet_framework) : null,
          ]
        );
      }
    }

    await client.query('COMMIT');

    // Return the full updated protocol
    return await getProtocolById(id);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE PROTOCOL (Soft delete: set is_active = FALSE)
// ─────────────────────────────────────────────────────────────────────────────
const deleteProtocol = async (id) => {
  const result = await pool.query(
    `UPDATE therapy_packages
     SET is_active = FALSE
     WHERE id = $1
     RETURNING id, name, is_active`,
    [id]
  );

  if (result.rows.length === 0) {
    const err = new Error('Protocol not found.');
    err.statusCode = 404;
    throw err;
  }

  return result.rows[0];
};

module.exports = {
  createProtocol,
  getAllProtocols,
  getProtocolById,
  updateProtocol,
  deleteProtocol,
};

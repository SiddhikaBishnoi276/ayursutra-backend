// src/Admin/Services/protocolService.js
const { pool } = require('../../config/db');

// Allowed enums
const VALID_THERAPY_TYPES = ['Vamana', 'Virechana', 'Basti', 'Nasya', 'Raktamokshana'];
const VALID_STAGE_TYPES = ['Poorvakarma', 'Pradhanakarma', 'Paschatkarma'];

function sanitizeTherapyType(type) {
  if (!type) return 'Virechana';
  const matched = VALID_THERAPY_TYPES.find(
    (t) => t.toLowerCase() === String(type).trim().toLowerCase()
  );
  if (matched) return matched;
  const lower = String(type).toLowerCase();
  if (lower.includes('basti')) return 'Basti';
  if (lower.includes('nasya')) return 'Nasya';
  if (lower.includes('vamana')) return 'Vamana';
  if (lower.includes('rakta')) return 'Raktamokshana';
  return 'Virechana';
}

function sanitizeStageType(type, index = 0) {
  if (!type) {
    return VALID_STAGE_TYPES[index] || 'Pradhanakarma';
  }
  const matched = VALID_STAGE_TYPES.find(
    (t) => t.toLowerCase() === String(type).trim().toLowerCase()
  );
  if (matched) return matched;
  const lower = String(type).toLowerCase();
  if (lower.includes('poorva')) return 'Poorvakarma';
  if (lower.includes('paschat')) return 'Paschatkarma';
  return 'Pradhanakarma';
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE PROTOCOL / PACKAGE (Deep Insert: therapy_packages + therapy_package_stages)
// ─────────────────────────────────────────────────────────────────────────────
const createProtocol = async ({
  name,
  therapy_type,
  targetDosha,
  description,
  base_price,
  clinic_id,
  created_by,
  stages = [],
}) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const resolvedName = name ? name.trim() : 'Custom Therapy Protocol';
    const resolvedTherapyType = sanitizeTherapyType(therapy_type || targetDosha);
    const resolvedClinicId = parseInt(clinic_id, 10) || 1;
    const resolvedDescription = description || `Classical clinical protocol for ${resolvedName}.`;
    const resolvedPrice = base_price !== undefined && base_price !== null ? parseFloat(base_price) : 0;

    // 1. Insert parent record into therapy_packages
    const packageResult = await client.query(
      `INSERT INTO therapy_packages (name, therapy_type, description, base_price, clinic_id, created_by, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE)
       RETURNING id, name, therapy_type, description, base_price, clinic_id, created_by, is_active, created_at`,
      [
        resolvedName,
        resolvedTherapyType,
        resolvedDescription,
        resolvedPrice,
        resolvedClinicId,
        created_by || null,
      ]
    );

    const newProtocol = packageResult.rows[0];

    const inputStages = Array.isArray(stages) && stages.length > 0
      ? stages
      : [
          { stage_type: 'Poorvakarma', duration_days: 2, session_duration_minutes: 45 },
          { stage_type: 'Pradhanakarma', duration_days: 4, session_duration_minutes: 60 },
          { stage_type: 'Paschatkarma', duration_days: 1, session_duration_minutes: 30 },
        ];

    // 2. Insert child stages with running day offsets
    const insertedStages = [];
    let runningOffset = 0;

    for (let i = 0; i < inputStages.length; i++) {
      const stage = inputStages[i];
      const stageType = sanitizeStageType(stage.stage_type || stage.stageCategory || stage.category || stage.name, i);
      const sequenceOrder = stage.sequence_order !== undefined ? stage.sequence_order : (stage.sequenceOrder !== undefined ? stage.sequenceOrder : i + 1);
      const durationDays = parseInt(stage.duration_days || stage.durationDays || 1, 10);
      const sessionDurationMinutes = parseInt(stage.session_duration_minutes || stage.durationMinutes || 60, 10);
      const dayOffset = stage.day_offset !== undefined ? stage.day_offset : (stage.dayOffset !== undefined ? stage.dayOffset : runningOffset);
      const preInstructions = stage.pre_instructions || stage.preInstructions || null;
      const postInstructions = stage.post_instructions || stage.postInstructions || null;
      const baseDietFramework = stage.base_diet_framework || (stage.baseDietGuidelines ? { guidelines: stage.baseDietGuidelines } : null);

      const stageResult = await client.query(
        `INSERT INTO therapy_package_stages
           (package_id, stage_type, sequence_order, day_offset, duration_days,
            session_duration_minutes, pre_instructions, post_instructions, base_diet_framework)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, package_id, stage_type, sequence_order, day_offset,
                   duration_days, session_duration_minutes, pre_instructions, post_instructions, base_diet_framework`,
        [
          newProtocol.id,
          stageType,
          sequenceOrder,
          dayOffset,
          durationDays,
          sessionDurationMinutes,
          preInstructions,
          postInstructions,
          baseDietFramework ? JSON.stringify(baseDietFramework) : null,
        ]
      );

      const row = stageResult.rows[0];
      insertedStages.push({
        id: row.id,
        package_id: row.package_id,
        stage_type: row.stage_type,
        stageName: `${row.stage_type} Stage`,
        category: row.stage_type,
        stageCategory: row.stage_type,
        sequence_order: row.sequence_order,
        sequenceOrder: row.sequence_order,
        day_offset: row.day_offset,
        dayOffset: row.day_offset,
        duration_days: row.duration_days,
        durationDays: row.duration_days,
        session_duration_minutes: row.session_duration_minutes,
        durationMinutes: row.session_duration_minutes,
        pre_instructions: row.pre_instructions || '',
        preInstructions: row.pre_instructions || '',
        post_instructions: row.post_instructions || '',
        postInstructions: row.post_instructions || '',
        base_diet_framework: row.base_diet_framework,
      });

      runningOffset += durationDays;
    }

    await client.query('COMMIT');

    const totalDurationDays = insertedStages.reduce(
      (sum, s) => sum + (parseInt(s.duration_days, 10) || 0),
      0
    );

    return {
      id: newProtocol.id,
      _raw_id: newProtocol.id,
      name: newProtocol.name,
      therapy_type: newProtocol.therapy_type,
      targetDosha: newProtocol.therapy_type,
      description: newProtocol.description,
      base_price: parseFloat(newProtocol.base_price || 0),
      clinic_id: newProtocol.clinic_id,
      created_by: newProtocol.created_by,
      is_active: newProtocol.is_active,
      created_at: newProtocol.created_at,
      status: newProtocol.is_active ? 'Active' : 'Inactive',
      total_stages: insertedStages.length,
      total_duration_days: totalDurationDays,
      durationDays: totalDurationDays,
      duration_days: totalDurationDays,
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
       tp.description,
       tp.base_price,
       tp.clinic_id,
       tp.created_by,
       u.name AS author_name,
       tp.is_active,
       tp.created_at,
       COUNT(tps.id)::INT AS total_stages,
       COALESCE(SUM(tps.duration_days), 0)::INT AS total_duration_days,
       COALESCE(
         JSON_AGG(
           JSON_BUILD_OBJECT(
             'id', tps.id,
             'package_id', tps.package_id,
             'stage_type', tps.stage_type,
             'stageName', tps.stage_type || ' Stage',
             'category', tps.stage_type,
             'stageCategory', tps.stage_type,
             'sequence_order', tps.sequence_order,
             'sequenceOrder', tps.sequence_order,
             'day_offset', tps.day_offset,
             'dayOffset', tps.day_offset,
             'duration_days', tps.duration_days,
             'durationDays', tps.duration_days,
             'session_duration_minutes', tps.session_duration_minutes,
             'durationMinutes', tps.session_duration_minutes,
             'pre_instructions', COALESCE(tps.pre_instructions, ''),
             'preInstructions', COALESCE(tps.pre_instructions, ''),
             'post_instructions', COALESCE(tps.post_instructions, ''),
             'postInstructions', COALESCE(tps.post_instructions, ''),
             'base_diet_framework', tps.base_diet_framework
           ) ORDER BY tps.sequence_order ASC
         ) FILTER (WHERE tps.id IS NOT NULL),
         '[]'::json
       ) AS stages
     FROM therapy_packages tp
     LEFT JOIN therapy_package_stages tps ON tps.package_id = tp.id
     LEFT JOIN users u ON tp.created_by = u.id
     ${whereClause}
     GROUP BY tp.id, tp.name, tp.therapy_type, tp.description, tp.base_price, tp.clinic_id, tp.created_by, u.name, tp.is_active, tp.created_at
     ORDER BY tp.created_at DESC`,
    params
  );

  return result.rows.map((row) => ({
    id: `PKG-${row.id.toString().padStart(3, '0')}`,
    _raw_id: row.id,
    name: row.name,
    therapy_type: row.therapy_type,
    targetDosha: row.therapy_type,
    description: row.description || `Classical clinical protocol for ${row.name}.`,
    base_price: parseFloat(row.base_price || 0),
    clinic_id: row.clinic_id,
    created_by: row.created_by,
    authorName: row.author_name || 'Clinic Administrator',
    is_active: row.is_active,
    status: row.is_active ? 'Active' : 'Inactive',
    total_stages: row.total_stages || (row.stages ? row.stages.length : 0),
    total_duration_days: row.total_duration_days || 7,
    durationDays: row.total_duration_days || 7,
    duration_days: row.total_duration_days || 7,
    stages: row.stages || [],
  }));
};

// ─────────────────────────────────────────────────────────────────────────────
// GET PROTOCOL BY ID (Deep fetch with ordered child stages)
// ─────────────────────────────────────────────────────────────────────────────
const getProtocolById = async (id) => {
  const packageResult = await pool.query(
    `SELECT tp.id, tp.name, tp.therapy_type, tp.description, tp.base_price, tp.clinic_id, tp.created_by, tp.is_active, tp.created_at, u.name AS author_name
     FROM therapy_packages tp
     LEFT JOIN users u ON tp.created_by = u.id
     WHERE tp.id = $1`,
    [id]
  );

  if (packageResult.rows.length === 0) {
    return null;
  }

  const protocol = packageResult.rows[0];

  const stagesResult = await pool.query(
    `SELECT id, package_id, stage_type, sequence_order, day_offset,
            duration_days, session_duration_minutes, pre_instructions, post_instructions, base_diet_framework
     FROM therapy_package_stages
     WHERE package_id = $1
     ORDER BY sequence_order ASC`,
    [id]
  );

  const formattedStages = stagesResult.rows.map((row) => ({
    id: row.id,
    package_id: row.package_id,
    stage_type: row.stage_type,
    stageName: `${row.stage_type} Stage`,
    category: row.stage_type,
    stageCategory: row.stage_type,
    sequence_order: row.sequence_order,
    sequenceOrder: row.sequence_order,
    day_offset: row.day_offset,
    dayOffset: row.day_offset,
    duration_days: row.duration_days,
    durationDays: row.duration_days,
    session_duration_minutes: row.session_duration_minutes,
    durationMinutes: row.session_duration_minutes,
    pre_instructions: row.pre_instructions || '',
    preInstructions: row.pre_instructions || '',
    post_instructions: row.post_instructions || '',
    postInstructions: row.post_instructions || '',
    base_diet_framework: row.base_diet_framework,
  }));

  const totalDurationDays = formattedStages.reduce(
    (sum, s) => sum + (parseInt(s.duration_days, 10) || 0),
    0
  );

  return {
    id: `PKG-${protocol.id.toString().padStart(3, '0')}`,
    _raw_id: protocol.id,
    name: protocol.name,
    therapy_type: protocol.therapy_type,
    targetDosha: protocol.therapy_type,
    description: protocol.description || `Classical clinical protocol for ${protocol.name}.`,
    base_price: parseFloat(protocol.base_price || 0),
    clinic_id: protocol.clinic_id,
    created_by: protocol.created_by,
    authorName: protocol.author_name || 'Clinic Administrator',
    is_active: protocol.is_active,
    status: protocol.is_active ? 'Active' : 'Inactive',
    total_stages: formattedStages.length,
    total_duration_days: totalDurationDays,
    durationDays: totalDurationDays,
    duration_days: totalDurationDays,
    stages: formattedStages,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE PROTOCOL (Deep update: parent fields + full replacement of stages)
// ─────────────────────────────────────────────────────────────────────────────
const updateProtocol = async (id, { name, therapy_type, description, base_price, is_active, stages }) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const checkRes = await client.query(
      `SELECT id FROM therapy_packages WHERE id = $1`,
      [id]
    );
    if (checkRes.rows.length === 0) {
      const err = new Error('Protocol not found.');
      err.statusCode = 404;
      throw err;
    }

    const updateFields = [];
    const updateParams = [];

    if (name !== undefined) {
      updateParams.push(name.trim());
      updateFields.push(`name = $${updateParams.length}`);
    }
    if (therapy_type !== undefined) {
      updateParams.push(sanitizeTherapyType(therapy_type));
      updateFields.push(`therapy_type = $${updateParams.length}`);
    }
    if (description !== undefined) {
      updateParams.push(description);
      updateFields.push(`description = $${updateParams.length}`);
    }
    if (base_price !== undefined) {
      updateParams.push(parseFloat(base_price));
      updateFields.push(`base_price = $${updateParams.length}`);
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

    if (Array.isArray(stages)) {
      await client.query(
        `DELETE FROM therapy_package_stages WHERE package_id = $1`,
        [id]
      );

      let runningOffset = 0;
      for (let i = 0; i < stages.length; i++) {
        const stage = stages[i];
        const stageType = sanitizeStageType(stage.stage_type || stage.stageCategory || stage.category, i);
        const sequenceOrder = stage.sequence_order !== undefined ? stage.sequence_order : (stage.sequenceOrder !== undefined ? stage.sequenceOrder : i + 1);
        const durationDays = parseInt(stage.duration_days || stage.durationDays || 1, 10);
        const sessionDurationMinutes = parseInt(stage.session_duration_minutes || stage.durationMinutes || 60, 10);
        const dayOffset = stage.day_offset !== undefined ? stage.day_offset : (stage.dayOffset !== undefined ? stage.dayOffset : runningOffset);
        const preInstructions = stage.pre_instructions || stage.preInstructions || null;
        const postInstructions = stage.post_instructions || stage.postInstructions || null;
        const baseDietFramework = stage.base_diet_framework || (stage.baseDietGuidelines ? { guidelines: stage.baseDietGuidelines } : null);

        await client.query(
          `INSERT INTO therapy_package_stages
             (package_id, stage_type, sequence_order, day_offset, duration_days,
              session_duration_minutes, pre_instructions, post_instructions, base_diet_framework)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            id,
            stageType,
            sequenceOrder,
            dayOffset,
            durationDays,
            sessionDurationMinutes,
            preInstructions,
            postInstructions,
            baseDietFramework ? JSON.stringify(baseDietFramework) : null,
          ]
        );
        runningOffset += durationDays;
      }
    }

    await client.query('COMMIT');
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
  sanitizeTherapyType,
  sanitizeStageType,
};

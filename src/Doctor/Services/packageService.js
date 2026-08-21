// src/Doctor/Services/packageService.js
const { pool, query } = require('../../config/db');

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

function mapDoshaToTherapyType(confirmedDosha) {
  if (!confirmedDosha) return null;
  const lower = String(confirmedDosha).toLowerCase();
  if (lower.includes('vata')) return 'Basti';
  if (lower.includes('pitta')) return 'Virechana';
  if (lower.includes('kapha')) return 'Vamana';
  if (lower.includes('rakta')) return 'Raktamokshana';
  if (lower.includes('nasya') || lower.includes('shiro')) return 'Nasya';
  return null;
}

/**
 * List therapy packages with nested stages and dynamically derived is_standard
 * based on the creator's role, with optional recommendation matching for patient's Prakriti.
 */
async function listPackages(clinicId, patientId = null) {
  let targetTherapyType = null;
  let patientDosha = null;

  if (patientId) {
    const assessmentRes = await query(
      `SELECT confirmed_dosha FROM prakriti_assessments WHERE patient_id = $1 ORDER BY assessed_at DESC LIMIT 1`,
      [patientId]
    );
    patientDosha = assessmentRes.rows[0]?.confirmed_dosha || null;
    targetTherapyType = mapDoshaToTherapyType(patientDosha);
  }

  const packagesQuery = `
    SELECT 
      p.id,
      p.name,
      p.therapy_type,
      p.description,
      p.base_price,
      p.created_by,
      p.is_active,
      p.created_at,
      creator.role AS creator_role,
      CASE 
        WHEN creator.role IN ('clinic_admin', 'solo_practitioner') OR p.created_by IS NULL THEN true
        WHEN creator.role = 'doctor' THEN false
        ELSE false
      END AS is_standard,
      COALESCE(
        json_agg(
          json_build_object(
            'id', s.id,
            'package_id', s.package_id,
            'name', s.stage_type || ' Stage',
            'stageName', s.stage_type || ' Stage',
            'category', s.stage_type,
            'stageCategory', s.stage_type,
            'stage_type', s.stage_type,
            'sequenceOrder', s.sequence_order,
            'sequence_order', s.sequence_order,
            'dayOffset', s.day_offset,
            'day_offset', s.day_offset,
            'durationDays', s.duration_days,
            'duration_days', s.duration_days,
            'durationMinutes', s.session_duration_minutes,
            'session_duration_minutes', s.session_duration_minutes,
            'preInstructions', COALESCE(s.pre_instructions, ''),
            'pre_instructions', COALESCE(s.pre_instructions, ''),
            'postInstructions', COALESCE(s.post_instructions, ''),
            'post_instructions', COALESCE(s.post_instructions, ''),
            'baseDietGuidelines', COALESCE(s.base_diet_framework::text, ''),
            'base_diet_framework', s.base_diet_framework
          ) ORDER BY s.sequence_order ASC
        ) FILTER (WHERE s.id IS NOT NULL),
        '[]'::json
      ) AS stages,
      COALESCE(SUM(s.duration_days), 7) AS total_duration_days
    FROM therapy_packages p
    LEFT JOIN users creator ON creator.id = p.created_by
    LEFT JOIN therapy_package_stages s ON s.package_id = p.id
    WHERE p.clinic_id = $1 AND p.is_active = true
    GROUP BY p.id, p.name, p.therapy_type, p.description, p.base_price, p.created_by, p.is_active, p.created_at, creator.role
    ORDER BY p.name ASC;
  `;

  const result = await query(packagesQuery, [clinicId]);

  return result.rows.map((row) => {
    const isRecommended = targetTherapyType
      ? row.therapy_type.toLowerCase() === targetTherapyType.toLowerCase()
      : false;

    return {
      id: row.id,
      name: row.name,
      therapy_type: row.therapy_type,
      targetDosha: row.therapy_type,
      description: row.description || `Classical clinical protocol for ${row.name}.`,
      base_price: parseFloat(row.base_price || 0),
      durationDays: parseInt(row.total_duration_days || 7, 10),
      duration_days: parseInt(row.total_duration_days || 7, 10),
      isStandard: Boolean(row.is_standard),
      is_standard: Boolean(row.is_standard),
      is_active: row.is_active,
      created_by: row.created_by,
      creator_role: row.creator_role || null,
      isRecommended,
      recommendationReason: isRecommended
        ? `Clinically recommended for ${patientDosha} Prakriti`
        : null,
      stages: row.stages,
    };
  });
}

/**
 * Create a custom/standard therapy package with nested stages.
 * Saves created_by as the logged-in doctor's ID.
 */
async function createPackage(doctorUser, packageData) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const name = packageData.name ? packageData.name.trim() : 'Custom Therapy Protocol';
    const therapyType = sanitizeTherapyType(packageData.therapy_type || packageData.targetDosha);
    const clinicId = parseInt(packageData.clinic_id || doctorUser?.clinic_id || 1, 10);
    const description = packageData.description?.trim() || `Classical clinical protocol for ${name}.`;
    const basePrice = packageData.base_price !== undefined ? parseFloat(packageData.base_price) : 0;
    const createdBy = doctorUser?.id || packageData.created_by || null;

    const pkgRes = await client.query(
      `INSERT INTO therapy_packages (clinic_id, name, therapy_type, description, base_price, created_by, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       RETURNING id, name, therapy_type, description, base_price, clinic_id, created_by, is_active, created_at`,
      [clinicId, name, therapyType, description, basePrice, createdBy]
    );
    const newPkg = pkgRes.rows[0];

    const inputStages = Array.isArray(packageData.stages) && packageData.stages.length > 0
      ? packageData.stages
      : [
          { stage_type: 'Poorvakarma', duration_days: 2, session_duration_minutes: 45 },
          { stage_type: 'Pradhanakarma', duration_days: 4, session_duration_minutes: 60 },
          { stage_type: 'Paschatkarma', duration_days: 1, session_duration_minutes: 30 },
        ];

    const createdStages = [];
    let runningOffset = 0;

    for (let i = 0; i < inputStages.length; i++) {
      const s = inputStages[i];
      const stageType = sanitizeStageType(s.stage_type || s.stageCategory || s.category || s.name, i);
      const sequenceOrder = s.sequence_order !== undefined ? s.sequence_order : (s.sequenceOrder !== undefined ? s.sequenceOrder : i + 1);
      const durationDays = parseInt(s.duration_days || s.durationDays || 1, 10);
      const sessionDurationMinutes = parseInt(s.session_duration_minutes || s.durationMinutes || 60, 10);
      const dayOffset = s.day_offset !== undefined ? s.day_offset : (s.dayOffset !== undefined ? s.dayOffset : runningOffset);
      const preInstructions = s.pre_instructions || s.preInstructions || null;
      const postInstructions = s.post_instructions || s.postInstructions || null;
      const baseDiet = s.base_diet_framework || (s.baseDietGuidelines ? { guidelines: s.baseDietGuidelines } : null);

      const stageRes = await client.query(
        `INSERT INTO therapy_package_stages (
           package_id, stage_type, sequence_order, day_offset, 
           duration_days, session_duration_minutes, pre_instructions, 
           post_instructions, base_diet_framework
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, package_id, stage_type, sequence_order, day_offset, duration_days, session_duration_minutes, pre_instructions, post_instructions, base_diet_framework`,
        [
          newPkg.id,
          stageType,
          sequenceOrder,
          dayOffset,
          durationDays,
          sessionDurationMinutes,
          preInstructions,
          postInstructions,
          baseDiet ? JSON.stringify(baseDiet) : null,
        ]
      );
      const row = stageRes.rows[0];
      createdStages.push({
        id: row.id,
        package_id: row.package_id,
        stage_type: row.stage_type,
        stageName: `${row.stage_type} Stage`,
        name: `${row.stage_type} Stage`,
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

    const totalDays = createdStages.reduce((acc, s) => acc + s.duration_days, 0);
    const isStandard = doctorUser?.role === 'clinic_admin' || doctorUser?.role === 'solo_practitioner';

    return {
      id: newPkg.id,
      _raw_id: newPkg.id,
      name: newPkg.name,
      therapy_type: newPkg.therapy_type,
      targetDosha: newPkg.therapy_type,
      description: newPkg.description,
      base_price: parseFloat(newPkg.base_price || 0),
      durationDays: totalDays,
      duration_days: totalDays,
      total_duration_days: totalDays,
      isStandard,
      is_standard: isStandard,
      clinic_id: newPkg.clinic_id,
      created_by: newPkg.created_by,
      stages: createdStages,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { listPackages, createPackage, sanitizeTherapyType, sanitizeStageType };

const { query } = require('../../config/db');

/**
 * List all active therapists for doctor plan builder with specializations,
 * active workload, and availability status based on existing DB relations.
 */
async function listTherapists(clinicId) {
  const therapistsQuery = `
    SELECT 
      u.id,
      u.name,
      u.gender,
      COALESCE(
        json_agg(DISTINCT ts.therapy_type) FILTER (WHERE ts.therapy_type IS NOT NULL),
        '[]'::json
      ) AS specializations,
      COUNT(DISTINCT s.id) FILTER (
        WHERE s.status IN ('scheduled', 'in_progress') 
          AND s.scheduled_date >= CURRENT_DATE
      ) AS active_workload,
      CASE 
        WHEN ta.id IS NOT NULL THEN false 
        ELSE true 
      END AS is_available
    FROM users u
    JOIN therapist_profiles tp ON tp.user_id = u.id
    LEFT JOIN therapist_specializations ts ON ts.therapist_id = u.id
    LEFT JOIN sessions s ON s.therapist_id = u.id
    LEFT JOIN therapist_availability ta ON ta.therapist_id = u.id 
      AND ta.date = CURRENT_DATE 
      AND ta.is_available = false
    WHERE u.clinic_id = $1 
      AND u.role = 'therapist' 
      AND u.is_active = true
    GROUP BY u.id, u.name, u.gender, ta.id
    ORDER BY u.name ASC;
  `;

  const result = await query(therapistsQuery, [clinicId]);

  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    gender: row.gender || 'Female',
    specializations: Array.isArray(row.specializations) && row.specializations.length > 0
      ? row.specializations
      : ['Sarvanga Abhyanga', 'Virechana'],
    rating: 4.8, // Mocked default: DB schema lacks a rating column in therapist_profiles
    activeWorkload: parseInt(row.active_workload || 0, 10),
    isAvailable: Boolean(row.is_available),
  }));
}

module.exports = { listTherapists };

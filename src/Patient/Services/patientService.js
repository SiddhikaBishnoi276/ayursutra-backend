const { pool } = require('../../config/db');
const { formatTime12Hour } = require('../../Common/Utils/paramUtils');

/**
 * Classical Ayurvedic Diet Guidelines mapped by Panchakarma stage type
 */
const STAGE_DIET_GUIDELINES = {
  Poorvakarma: {
    stage: 'Poorvakarma',
    pathya: 'Warm water, lightly spiced soups, Khichdi, ghee-infused warm meals',
    apathya: 'Cold water, refrigerated items, heavy sweets, daytime sleep',
  },
  Pradhanakarma: {
    stage: 'Pradhanakarma',
    pathya: 'Warm water, Thin Rice Gruel (Peya), light steamed vegetables',
    apathya: 'Heavy dairy, cold drinks, fried/spicy food, raw salads',
  },
  Paschatkarma: {
    stage: 'Paschatkarma',
    pathya: 'Gradual diet progression: Peya (thin gruel) -> Vilepi (thick gruel) -> Yusha (lentil soup) -> Odana (cooked rice)',
    apathya: 'Instant heavy meals, irregular eating times, direct sun/wind exposure',
  },
};

/**
 * Dosha-targeted Diet Frameworks (Master Defaults)
 */
const DOSHA_DIET_PLANS = {
  'Vata-Kapha': {
    planTitle: 'AI & Doctor Prescribed Vata-Kapha Pacifying Diet',
    doshaTarget: 'Vata-Kapha Balance',
    dietaryGuidelines: [
      'All meals must be consumed warm and freshly prepared within 3 hours of cooking.',
      'Maintain a 4-hour gap between primary meals to allow complete digestion.',
      'Incorporate mild warming digestive spices like ginger, cumin, coriander, and black pepper.',
    ],
    forbiddenFoods: [
      'Sour Yogurt / Curd (Dahi) especially during evening and night hours',
      'Cold water, ice creams, iced beverages, and refrigerated foods',
      'Deep fried, excessively heavy, and processed junk food',
      'Dry, stale, and carbonated beverages',
    ],
    permittedDrinks: [
      'Lukewarm water boiled with Cumin & Fennel seeds',
      'Fresh Takra (Spiced Buttermilk with roasted cumin)',
      'Herbal CCF (Cumin, Coriander, Fennel) infusion',
    ],
    lifestyleTips: [
      'Sleep by 10:00 PM and wake up before sunrise.',
      'Never suppress natural biological urges (Vega Dharana).',
      'Avoid strenuous exercise during active Panchakarma detox days.',
    ],
  },
  'Vata-Pitta': {
    planTitle: 'AI & Doctor Prescribed Vata-Pitta Pacifying Diet',
    doshaTarget: 'Vata-Pitta Balance',
    dietaryGuidelines: [
      'Warm, sweet, bitter, and astringent nourishing meals.',
      'Use cooling digestive spices like fennel, coriander, cardamom, and mint.',
      'Consume food in a calm, unhurried atmosphere.',
    ],
    forbiddenFoods: [
      'Excessively spicy, pungent, and salty snacks',
      'Fermented foods, vinegar, and hot chilies',
      'Alcohol, coffee, and energy drinks',
    ],
    permittedDrinks: [
      'Fennel and Coriander infused lukewarm water',
      'Fresh Coconut water (room temperature)',
      'Medicated pomegranate juice',
    ],
    lifestyleTips: [
      'Maintain regular meal timings.',
      'Avoid exposure to extreme afternoon heat and direct sun.',
      'Practice gentle cooling pranayama (Sheetali / Sheetkari).',
    ],
  },
  'Pitta-Kapha': {
    planTitle: 'AI & Doctor Prescribed Pitta-Kapha Pacifying Diet',
    doshaTarget: 'Pitta-Kapha Balance',
    dietaryGuidelines: [
      'Light, warm, dry, and easily digestible foods.',
      'Focus on bitter, pungent, and astringent tastes.',
      'Keep dinner light and finish at least 3 hours before sleep.',
    ],
    forbiddenFoods: [
      'Heavy oily gravies, cheese, and refined flour (Maida)',
      'Cold drinks, ice creams, and sweets',
      'Excessively salty or sour foods',
    ],
    permittedDrinks: [
      'Warm ginger-coriander decoction',
      'Warm water with a hint of dried ginger and Tulsi',
      'Barley water (Yava Udaka)',
    ],
    lifestyleTips: [
      'Engage in brisk morning walking.',
      'Avoid daytime sleeping (Diva Swapna).',
      'Keep living spaces well-ventilated and dry.',
    ],
  },
};

/**
 * Standard Prescribed Ayurvedic Medications
 */
const DEFAULT_MEDICATIONS = [
  {
    id: 'MED-01',
    name: 'Sahacharadi Kashayam Tablets',
    dosage: '2 Tablets (500mg each)',
    timing: 'Before Meals',
    frequency: 'Twice daily',
    duration: '21 Days',
    anupana: 'Warm Lukewarm Water',
  },
  {
    id: 'MED-02',
    name: 'Yogaraja Guggulu',
    dosage: '2 Tablets',
    timing: 'After Meals',
    frequency: 'Twice daily',
    duration: '30 Days',
    anupana: 'Warm Water',
  },
];

/**
 * Stage Care Notes Defaults
 */
const STAGE_CARE_NOTES = {
  Poorvakarma: {
    preCareNotes: [
      'Light digestible meal 2 hours prior to session.',
      'Bladder and bowels evacuated before entering chamber.',
      'Wear loose-fitting comfortable cotton attire.',
    ],
    postCareNotes: [
      'Avoid direct cold wind, air conditioning, and day sleep.',
      'Consume only warm liquid gruel (Peya) if hungry.',
      'Rest in a quiet room for at least 1 hour post-therapy.',
    ],
    therapistNotesSummary: 'Chamber prepared with warm medicated Taila/Ghrita.',
  },
  Pradhanakarma: {
    preCareNotes: [
      'Complete fasting from early morning as instructed by doctor.',
      'Bladder and bowels evacuated before entering chamber.',
      'Baseline vitals (BP, pulse) verified by nursing staff.',
    ],
    postCareNotes: [
      'Complete physical and mental rest; avoid talking loudly.',
      'Follow strict Samsarjana Krama diet starting with thin rice water (Peya).',
      'Report any dizziness or acute fatigue immediately.',
    ],
    therapistNotesSummary: 'Targeted chamber prepared with warm herbal formulations and emergency vitals kit verified.',
  },
  Paschatkarma: {
    preCareNotes: [
      'Maintain light warm diet as per prescribed Krama schedule.',
      'Arrive 15 minutes before scheduled therapy.',
    ],
    postCareNotes: [
      'Gradual reintroduction of routine food items over 3-7 days.',
      'Continue prescribed herbal supplements with lukewarm water.',
      'Avoid bending forward or lifting heavy objects.',
    ],
    therapistNotesSummary: 'Follow-up assessment and post-cleansing tonics prepared.',
  },
};

const patientService = {
  /**
   * 1. Fetch patient dashboard data with dynamic end times, joined stage instructions, AI diet plans, and dual contracts
   */
  getDashboardData: async (patientId) => {
    // 1. Fetch patient profile, confirmed Prakriti, and active therapy plan details
    const patientQuery = `
      SELECT 
        p.user_id AS patient_id,
        u.name,
        u.gender,
        u.email,
        u.phone,
        p.age,
        p.chief_complaint,
        p.diagnosis,
        pa.confirmed_dosha,
        tp.id AS plan_id,
        tp.status AS plan_status,
        COALESCE(tp_pkg.name, 'Custom Therapy Plan') AS active_package,
        doc_user.name AS doctor_name
      FROM patients p
      JOIN users u ON p.user_id = u.id
      LEFT JOIN (
        SELECT DISTINCT ON (patient_id) patient_id, confirmed_dosha 
        FROM prakriti_assessments 
        ORDER BY patient_id, assessed_at DESC
      ) pa ON p.user_id = pa.patient_id
      LEFT JOIN therapy_plans tp ON p.user_id = tp.patient_id AND tp.status = 'active'
      LEFT JOIN therapy_packages tp_pkg ON tp.package_id = tp_pkg.id
      LEFT JOIN users doc_user ON tp.doctor_id = doc_user.id
      WHERE p.user_id = $1;
    `;

    const patientRes = await pool.query(patientQuery, [patientId]);

    if (patientRes.rows.length === 0) {
      return null;
    }

    const patientData = patientRes.rows[0];

    let sessionsTimeline = [];
    let currentStageType = 'Poorvakarma';
    let totalPlanDays = 7;
    let aiDietExercisePlan = null;

    // 2. Query Sessions Timeline joining therapy_package_stages and patient_feedback
    const timelineQuery = `
      SELECT 
        s.id AS session_id,
        s.plan_stage_id,
        TO_CHAR(s.scheduled_date, 'YYYY-MM-DD') AS scheduled_date,
        s.scheduled_time::text AS scheduled_time,
        COALESCE(s.scheduled_start_time::text, s.scheduled_time::text) AS scheduled_start_time,
        COALESCE(s.scheduled_end_time::text, (s.scheduled_time + INTERVAL '60 minutes')::TIME::text) AS scheduled_end_time,
        s.status AS session_status,
        tps.sequence_order,
        tps.stage_type,
        tps.status AS stage_status,
        tps.duration_days,
        COALESCE(tps_master.session_duration_minutes, 60) AS session_duration_minutes,
        COALESCE(tps_master.pre_instructions, 'Light digestible meal 2 hours prior.') AS pre_instructions,
        COALESCE(tps_master.post_instructions, 'Avoid cold drafts and AC exposure.') AS post_instructions,
        r.name AS room_name,
        u_therapist.id AS therapist_id,
        u_therapist.name AS therapist_name,
        u_therapist.phone AS therapist_phone,
        pf.id AS feedback_id,
        pf.pain_scale,
        pf.sleep_quality,
        pf.energy_level,
        pf.side_effects
      FROM sessions s
      JOIN therapy_plan_stages tps ON s.plan_stage_id = tps.id
      LEFT JOIN therapy_package_stages tps_master ON tps.package_stage_id = tps_master.id
      LEFT JOIN rooms r ON s.room_id = r.id
      LEFT JOIN users u_therapist ON s.therapist_id = u_therapist.id
      LEFT JOIN patient_feedback pf ON pf.session_id = s.id
      WHERE s.patient_id = $1
      ORDER BY s.scheduled_date ASC, s.scheduled_time ASC;
    `;

    const timelineRes = await pool.query(timelineQuery, [patientId]);
    const rawRows = timelineRes.rows;

    if (rawRows.length > 0) {
      // Calculate total days
      const stageDaysSum = rawRows.reduce((acc, row) => acc + (row.duration_days || 0), 0);
      totalPlanDays = stageDaysSum > 0 ? stageDaysSum : rawRows.length;

      // Determine current active stage
      const inProgressStage = rawRows.find((item) => item.stage_status === 'in_progress');
      const unlockedStage = rawRows.find((item) => item.stage_status === 'unlocked');

      if (inProgressStage) {
        currentStageType = inProgressStage.stage_type;
      } else if (unlockedStage) {
        currentStageType = unlockedStage.stage_type;
      } else {
        const allCompleted = rawRows.every((item) => item.stage_status === 'complete');
        currentStageType = allCompleted
          ? rawRows[rawRows.length - 1].stage_type
          : rawRows[0].stage_type;
      }

      // Map sessions to rich dual contract
      sessionsTimeline = rawRows.map((row, index) => {
        const stageKey = row.stage_type || 'Poorvakarma';
        const careNotes = STAGE_CARE_NOTES[stageKey] || STAGE_CARE_NOTES.Poorvakarma;
        const formattedTime = formatTime12Hour(row.scheduled_time);
        const dayNumber = row.sequence_order ? row.sequence_order : index + 1;
        const stageName = `Day ${dayNumber}: ${row.stage_type}`;

        const isScheduled = row.session_status === 'scheduled';
        const frontendStatus = isScheduled ? 'upcoming' : row.session_status;
        const feedbackSubmitted = row.feedback_id !== null && row.feedback_id !== undefined;
        const canReschedule = row.session_status === 'scheduled';

        const preCareNotes = row.pre_instructions
          ? [row.pre_instructions, ...careNotes.preCareNotes.slice(1)]
          : careNotes.preCareNotes;

        const postCareNotes = row.post_instructions
          ? [row.post_instructions, ...careNotes.postCareNotes.slice(1)]
          : careNotes.postCareNotes;

        return {
          id: `APT-${row.session_id}`,
          sessionId: `SES-${row.session_id}`,
          session_id: row.session_id,
          date: row.scheduled_date,
          scheduledDate: row.scheduled_date,
          scheduled_date: row.scheduled_date,
          time: formattedTime,
          scheduledTime: row.scheduled_time,
          scheduled_time: row.scheduled_time,
          scheduledStartTime: row.scheduled_start_time || row.scheduled_time,
          scheduled_start_time: row.scheduled_start_time || row.scheduled_time,
          scheduledEndTime: row.scheduled_end_time,
          scheduled_end_time: row.scheduled_end_time,
          startTime: row.scheduled_start_time || row.scheduled_time,
          endTime: row.scheduled_end_time,
          end_time: row.scheduled_end_time,
          durationMinutes: row.session_duration_minutes,
          duration_minutes: row.session_duration_minutes,
          therapistId: row.therapist_id,
          therapist_id: row.therapist_id,
          therapistName: row.therapist_name || 'Assigned Therapist',
          therapist_name: row.therapist_name || 'Assigned Therapist',
          therapistPhone: row.therapist_phone || '',
          therapist_phone: row.therapist_phone || '',
          roomNumber: row.room_name || 'Unassigned',
          roomName: row.room_name || 'Unassigned',
          room_name: row.room_name || 'Unassigned',
          stageName,
          stage_name: stageName,
          stageCategory: row.stage_type,
          stage_type: row.stage_type,
          sequence_order: row.sequence_order,
          sequenceOrder: row.sequence_order,
          dayNumber,
          day_number: dayNumber,
          totalDays: totalPlanDays,
          total_days: totalPlanDays,
          status: frontendStatus,
          session_status: row.session_status,
          stageStatus: row.stage_status,
          stage_status: row.stage_status,
          preCareNotes,
          pre_care_notes: preCareNotes,
          postCareNotes,
          post_care_notes: postCareNotes,
          therapistNotesSummary: careNotes.therapistNotesSummary,
          therapist_notes_summary: careNotes.therapistNotesSummary,
          feedbackSubmitted,
          feedback_submitted: feedbackSubmitted,
          canReschedule,
          can_reschedule: canReschedule,
          feedback: feedbackSubmitted
            ? {
                id: row.feedback_id,
                painScale: row.pain_scale,
                pain_scale: row.pain_scale,
                sleepQuality: row.sleep_quality,
                sleep_quality: row.sleep_quality,
                energyLevel: row.energy_level,
                energy_level: row.energy_level,
                sideEffects: row.side_effects,
                side_effects: row.side_effects,
              }
            : null,
        };
      });
    }

    // 3. Stage-wise AI Diet & Exercise Extraction from diet_exercise_plans
    if (patientData.plan_id) {
      const dietQuery = `
        SELECT 
          id,
          stage_type,
          diet_chart,
          exercise_plan,
          status
        FROM diet_exercise_plans
        WHERE plan_id = $1
        ORDER BY ai_generated_at DESC;
      `;
      const dietRes = await pool.query(dietQuery, [patientData.plan_id]);
      if (dietRes.rows.length > 0) {
        aiDietExercisePlan = dietRes.rows.find((d) => d.stage_type === currentStageType) || dietRes.rows[0];
      }
    }

    // 4. Dosha-targeted & Stage-specific Diet Guidelines
    const confirmedDosha = patientData.confirmed_dosha || 'Vata-Kapha';
    const doshaKey = DOSHA_DIET_PLANS[confirmedDosha]
      ? confirmedDosha
      : Object.keys(DOSHA_DIET_PLANS).find((k) => confirmedDosha.includes(k.split('-')[0])) ||
        'Vata-Kapha';
    const masterDoshaPlan = DOSHA_DIET_PLANS[doshaKey] || DOSHA_DIET_PLANS['Vata-Kapha'];

    let dietPlan = {
      planTitle: aiDietExercisePlan?.diet_chart?.planTitle || masterDoshaPlan.planTitle,
      doshaTarget: masterDoshaPlan.doshaTarget,
      dietaryGuidelines: aiDietExercisePlan?.diet_chart?.dietaryGuidelines || masterDoshaPlan.dietaryGuidelines,
      forbiddenFoods: aiDietExercisePlan?.diet_chart?.forbiddenFoods || masterDoshaPlan.forbiddenFoods,
      permittedDrinks: aiDietExercisePlan?.diet_chart?.permittedDrinks || masterDoshaPlan.permittedDrinks,
      lifestyleTips: aiDietExercisePlan?.diet_chart?.lifestyleTips || masterDoshaPlan.lifestyleTips,
      exercisePlan: aiDietExercisePlan?.exercise_plan || null,
      exercise_plan: aiDietExercisePlan?.exercise_plan || null,
    };

    // 5. Backwards-compatible Stage Diet instructions
    const currentDietInstructions = STAGE_DIET_GUIDELINES[currentStageType] || {
      stage: currentStageType,
      pathya: 'Warm water, lightly cooked nourishing sattvic meals',
      apathya: 'Heavy, fried, oily, and cold foods',
    };

    // 6. Simulated Contextual Reminder
    let simulatedReminder = 'Your next detox session is scheduled for tomorrow. Maintain light fasting 2 hours prior.';
    const nextSession = sessionsTimeline.find(
      (s) => s.session_status === 'scheduled' || s.session_status === 'in_progress'
    );

    if (nextSession) {
      simulatedReminder = `Your next ${nextSession.stage_type} session is scheduled for ${nextSession.scheduled_date} at ${nextSession.scheduled_time}. Maintain light fasting 2 hours prior.`;
    } else if (sessionsTimeline.length > 0) {
      simulatedReminder = 'All sessions in your active protocol are completed. Please consult your Ayurvedic doctor for a follow-up assessment.';
    } else {
      simulatedReminder = 'No upcoming sessions scheduled. Please contact your clinic administrator.';
    }

    // 7. Patient Info object with dual keys
    const patientInfo = {
      id: `PT-${patientData.patient_id ? String(patientData.patient_id).slice(-4).toUpperCase() : '104'}`,
      patientId: patientData.patient_id,
      patient_id: patientData.patient_id,
      name: patientData.name,
      patientName: patientData.name,
      patient_name: patientData.name,
      age: patientData.age || 42,
      gender: patientData.gender,
      phone: patientData.phone || '',
      email: patientData.email || '',
      prakritiType: patientData.confirmed_dosha || 'Pending Assessment',
      confirmed_dosha: patientData.confirmed_dosha || 'Pending Assessment',
      chiefComplaint: patientData.chief_complaint || '',
      chief_complaint: patientData.chief_complaint || '',
      diagnosis: patientData.diagnosis || '',
      activePackage: patientData.active_package,
      active_package: patientData.active_package,
      doctorName: patientData.doctor_name || 'Dr. Shrikant Sharma',
      doctor_name: patientData.doctor_name || 'Dr. Shrikant Sharma',
      planStatus: patientData.plan_status || 'inactive',
      plan_status: patientData.plan_status || 'inactive',
    };

    return {
      patient_info: patientInfo,
      patientInfo,
      sessions_timeline: sessionsTimeline,
      sessionsTimeline,
      dietPlan,
      diet_plan: dietPlan,
      current_diet_instructions: currentDietInstructions,
      currentDietInstructions,
      simulated_reminder: simulatedReminder,
      simulatedReminder,
      medications: DEFAULT_MEDICATIONS,
    };
  },

  /**
   * 2. Submit post-session feedback with flexible payload mapping
   */
  submitFeedback: async ({
    sessionId,
    patientId,
    painScale,
    sleepQuality,
    energyLevel,
    sideEffects,
  }) => {
    const queryText = `
      INSERT INTO patient_feedback (
        session_id,
        patient_id,
        pain_scale,
        sleep_quality,
        energy_level,
        side_effects
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, session_id, patient_id, pain_scale, sleep_quality, energy_level, side_effects, submitted_at;
    `;

    const result = await pool.query(queryText, [
      sessionId,
      patientId,
      painScale !== null && painScale !== undefined ? parseInt(painScale, 10) : null,
      sleepQuality !== null && sleepQuality !== undefined ? parseInt(sleepQuality, 10) : null,
      energyLevel !== null && energyLevel !== undefined ? parseInt(energyLevel, 10) : null,
      sideEffects || null,
    ]);

    const createdFeedback = result.rows[0];

    return {
      success: true,
      message: 'Feedback submitted successfully',
      feedbackId: createdFeedback.id,
      feedback_id: createdFeedback.id,
      sessionId: createdFeedback.session_id,
      session_id: createdFeedback.session_id,
      patientId: createdFeedback.patient_id,
      patient_id: createdFeedback.patient_id,
      painScale: createdFeedback.pain_scale,
      pain_scale: createdFeedback.pain_scale,
      sleepQuality: createdFeedback.sleep_quality,
      sleep_quality: createdFeedback.sleep_quality,
      energyLevel: createdFeedback.energy_level,
      energy_level: createdFeedback.energy_level,
      sideEffects: createdFeedback.side_effects,
      side_effects: createdFeedback.side_effects,
      submittedAt: createdFeedback.submitted_at,
      submitted_at: createdFeedback.submitted_at,
    };
  },
};

module.exports = patientService;

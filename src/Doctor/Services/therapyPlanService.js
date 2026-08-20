const { generateTherapyPlan } = require('../../Scheduling/Services/schedulingEngine');
const { query } = require('../../config/db');

async function createPlanForPatient(doctorUser, patientId, packageId) {
  const scheduleResult = await generateTherapyPlan(doctorUser, patientId, packageId);

  const patientResult = await query('SELECT name, phone FROM users WHERE id = $1', [patientId]);
  const patient = patientResult.rows[0];
  if (!patient) throw new Error('Patient not found');

  return {
    ...scheduleResult,
    simulated_sms: {
      to: `+91-${patient.phone}`,
      message: `SMS sent to +91-${patient.phone}: Login ID: ${patient.phone}, Password: ****** — ${patient.name} can now log in to view their schedule`,
    },
  };
}

module.exports = { createPlanForPatient };

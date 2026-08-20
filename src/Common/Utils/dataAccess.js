const { users, rooms, therapistSpecializations } = require('../Data/mockDb');

async function findUserByRole(role) {
  return users.find((u) => u.role === role) || null;
}

async function findUserById(id) {
  return users.find((u) => u.id === Number(id)) || null;
}

async function getClinicResources(clinicId) {
  const cid = Number(clinicId);

  const doctors = users
    .filter((u) => u.clinic_id === cid && u.role === 'doctor' && u.is_active)
    .map(({ id, full_name, gender, registration_num }) => ({ id, full_name, gender, registration_num }));

  const therapists = users
    .filter((u) => u.clinic_id === cid && u.role === 'therapist' && u.is_active)
    .map((t) => ({
      id: t.id,
      full_name: t.full_name,
      gender: t.gender,
      specializations: therapistSpecializations
        .filter((s) => s.therapist_id === t.id)
        .map((s) => s.therapy_type),
    }));

  const clinicRooms = rooms.filter((r) => r.clinic_id === cid);

  return { doctors, therapists, rooms: clinicRooms };
}

module.exports = { findUserByRole, findUserById, getClinicResources };

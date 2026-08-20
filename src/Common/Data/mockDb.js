const clinics = [
  { id: 1, name: 'AyurSutra Demo Clinic', practice_mode: 'clinic' },
  { id: 2, name: 'Suresh Solo Practice', practice_mode: 'solo' },
];

const users = [
  { id: 1, full_name: 'Anjali Verma', phone_number: '9000000001', role: 'clinic_admin', practice_mode: 'clinic', clinic_id: 1, is_active: true, gender: null, registration_num: null },
  { id: 2, full_name: 'Dr. Ravi Sharma', phone_number: '9000000002', role: 'doctor', practice_mode: 'clinic', clinic_id: 1, is_active: true, gender: 'male', registration_num: 'AY-2024-1123' },
  { id: 3, full_name: 'Suresh Yadav', phone_number: '9000000003', role: 'therapist', practice_mode: 'clinic', clinic_id: 1, is_active: true, gender: 'male', registration_num: null },
  { id: 4, full_name: 'Priya Nair', phone_number: '9000000004', role: 'therapist', practice_mode: 'clinic', clinic_id: 1, is_active: true, gender: 'female', registration_num: null },
  { id: 5, full_name: 'Dr. Suresh Solo', phone_number: '9000000005', role: 'solo_practitioner', practice_mode: 'solo', clinic_id: 2, is_active: true, gender: 'male', registration_num: 'AY-2024-9981' },
  { id: 6, full_name: 'Meera Patel', phone_number: '9000000006', role: 'patient', practice_mode: null, clinic_id: 1, is_active: true, gender: 'female', registration_num: null },
];

const rooms = [
  { id: 1, clinic_id: 1, name: 'Droni Room', status: 'available' },
  { id: 2, clinic_id: 1, name: 'Steam Chamber', status: 'available' },
];

const therapistSpecializations = [
  { id: 1, therapist_id: 3, therapy_type: 'Basti' },
  { id: 2, therapist_id: 4, therapy_type: 'Virechana' },
];

module.exports = { clinics, users, rooms, therapistSpecializations };

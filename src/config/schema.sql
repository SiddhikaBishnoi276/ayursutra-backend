-- ==============================================================================
-- AyurSutra — Complete Unified Database Schema (PostgreSQL / Neon)
-- Covers Clinic Mode + Solo Practitioner Mode
-- ==============================================================================

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. CLINIC / PRACTICE STRUCTURE & IDENTITY CORE
-- ==============================================================================

-- 1.1 Clinics / Practice
CREATE TABLE IF NOT EXISTS clinics (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    owner_user_id UUID, -- Foreign key added after users table creation
    practitioner_mode VARCHAR(20) NOT NULL DEFAULT 'clinic' CHECK (practitioner_mode IN ('clinic', 'solo')),
    address TEXT,
    contact_phone VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 1.2 Central Users Identity Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role VARCHAR(50) NOT NULL CHECK (role IN ('clinic_admin', 'solo_practitioner', 'doctor', 'therapist', 'patient')),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    gender VARCHAR(20) CHECK (gender IN ('Male', 'Female', 'Other')),
    clinic_id INT REFERENCES clinics(id) ON DELETE SET NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    credentials_sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add owner constraint back to clinics
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_clinics_owner_user'
    ) THEN
        ALTER TABLE clinics
        ADD CONSTRAINT fk_clinics_owner_user
        FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 1.3 Onboarding Audit Log
CREATE TABLE IF NOT EXISTS onboarding_audit_log (
    id SERIAL PRIMARY KEY,
    created_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    role_assigned VARCHAR(50) NOT NULL,
    verification_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 1.4 Credential Delivery Log
CREATE TABLE IF NOT EXISTS credential_delivery_log (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel VARCHAR(20) NOT NULL CHECK (channel IN ('sms', 'whatsapp', 'email')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'sent', 'failed')),
    attempted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- 2. PRACTITIONER & THERAPIST EXTENSIONS
-- ==============================================================================

-- 2.1 Doctor Profiles
CREATE TABLE IF NOT EXISTS doctor_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    qualification VARCHAR(255),
    registration_number VARCHAR(100) UNIQUE,
    verified_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- 2.2 Therapist Profiles
CREATE TABLE IF NOT EXISTS therapist_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    verified_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- 2.3 Therapist Specializations
CREATE TABLE IF NOT EXISTS therapist_specializations (
    id SERIAL PRIMARY KEY,
    therapist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    therapy_type VARCHAR(50) NOT NULL CHECK (therapy_type IN ('Vamana', 'Virechana', 'Basti', 'Nasya', 'Raktamokshana'))
);

-- 2.4 Therapist Availability
CREATE TABLE IF NOT EXISTS therapist_availability (
    id SERIAL PRIMARY KEY,
    therapist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'leave'))
);

-- ==============================================================================
-- 3. RESOURCE MANAGEMENT (ROOMS & EQUIPMENT)
-- ==============================================================================

-- 3.1 Rooms
CREATE TABLE IF NOT EXISTS rooms (
    id SERIAL PRIMARY KEY,
    clinic_id INT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'under_maintenance'))
);

-- 3.2 Equipment
CREATE TABLE IF NOT EXISTS equipment (
    id SERIAL PRIMARY KEY,
    room_id INT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'available' CHECK (status IN ('available', 'in_use', 'maintenance'))
);

-- ==============================================================================
-- 4. THERAPY PROTOCOL / TEMPLATES & PRAKRITI QUESTION BANK
-- ==============================================================================

-- 4.1 Therapy Packages (Master Templates)
CREATE TABLE IF NOT EXISTS therapy_packages (
    id SERIAL PRIMARY KEY,
    clinic_id INT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    therapy_type VARCHAR(50) NOT NULL CHECK (therapy_type IN ('Vamana', 'Virechana', 'Basti', 'Nasya', 'Raktamokshana')),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4.2 Therapy Package Stages (Master Template Sequence)
CREATE TABLE IF NOT EXISTS therapy_package_stages (
    id SERIAL PRIMARY KEY,
    package_id INT NOT NULL REFERENCES therapy_packages(id) ON DELETE CASCADE,
    stage_type VARCHAR(50) NOT NULL CHECK (stage_type IN ('Poorvakarma', 'Pradhanakarma', 'Paschatkarma')),
    sequence_order INT NOT NULL,
    day_offset INT DEFAULT 0,
    duration_days INT NOT NULL,
    pre_instructions TEXT,
    post_instructions TEXT,
    base_diet_framework JSONB
);

-- 4.3 Prakriti Questions
CREATE TABLE IF NOT EXISTS prakriti_questions (
    id SERIAL PRIMARY KEY,
    question_text TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);

-- 4.4 Prakriti Question Options
CREATE TABLE IF NOT EXISTS prakriti_question_options (
    id SERIAL PRIMARY KEY,
    question_id INT NOT NULL REFERENCES prakriti_questions(id) ON DELETE CASCADE,
    option_text VARCHAR(255) NOT NULL,
    dosha_weight JSONB
);

-- ==============================================================================
-- 5. PATIENTS & ASSESSMENT TABLES
-- ==============================================================================

-- 5.1 Patients
CREATE TABLE IF NOT EXISTS patients (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    clinic_id INT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    age INT,
    chief_complaint TEXT,
    diagnosis TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5.2 Prakriti Assessments
CREATE TABLE IF NOT EXISTS prakriti_assessments (
    id SERIAL PRIMARY KEY,
    patient_id UUID NOT NULL REFERENCES patients(user_id) ON DELETE CASCADE,
    conducted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    tentative_vata INT DEFAULT 0,
    tentative_pitta INT DEFAULT 0,
    tentative_kapha INT DEFAULT 0,
    clinical_observation TEXT,
    confirmed_dosha VARCHAR(100),
    assessed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5.3 Prakriti Assessment Answers
CREATE TABLE IF NOT EXISTS prakriti_assessment_answers (
    id SERIAL PRIMARY KEY,
    assessment_id INT NOT NULL REFERENCES prakriti_assessments(id) ON DELETE CASCADE,
    question_id INT NOT NULL REFERENCES prakriti_questions(id) ON DELETE CASCADE,
    option_id INT NOT NULL REFERENCES prakriti_question_options(id) ON DELETE CASCADE
);

-- ==============================================================================
-- 6. THERAPY PLANS, SEQUENTIAL STAGES & SESSIONS
-- ==============================================================================

-- 6.1 Therapy Plans (Patient-Specific Instance)
CREATE TABLE IF NOT EXISTS therapy_plans (
    id SERIAL PRIMARY KEY,
    patient_id UUID NOT NULL REFERENCES patients(user_id) ON DELETE CASCADE,
    package_id INT REFERENCES therapy_packages(id) ON DELETE SET NULL,
    doctor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'modified')),
    start_date DATE,
    end_date DATE,
    customization_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6.2 Therapy Plan Stages (With Sequential Stage-Locking)
CREATE TABLE IF NOT EXISTS therapy_plan_stages (
    id SERIAL PRIMARY KEY,
    plan_id INT NOT NULL REFERENCES therapy_plans(id) ON DELETE CASCADE,
    package_stage_id INT REFERENCES therapy_package_stages(id) ON DELETE SET NULL,
    stage_type VARCHAR(50) NOT NULL CHECK (stage_type IN ('Poorvakarma', 'Pradhanakarma', 'Paschatkarma')),
    sequence_order INT NOT NULL,
    scheduled_start_date DATE,
    duration_days INT NOT NULL,
    status VARCHAR(50) DEFAULT 'locked' CHECK (status IN ('locked', 'unlocked', 'in_progress', 'complete'))
);

-- 6.3 Sessions
CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    plan_stage_id INT NOT NULL REFERENCES therapy_plan_stages(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES patients(user_id) ON DELETE CASCADE,
    therapist_id UUID REFERENCES users(id) ON DELETE SET NULL,
    room_id INT REFERENCES rooms(id) ON DELETE SET NULL,
    scheduled_date DATE NOT NULL,
    scheduled_time TIME NOT NULL,
    status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'no_show')),
    actual_start_time TIMESTAMP WITH TIME ZONE,
    actual_end_time TIMESTAMP WITH TIME ZONE
);

-- 6.4 Session Equipment Usage
CREATE TABLE IF NOT EXISTS session_equipment_usage (
    id SERIAL PRIMARY KEY,
    session_id INT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    equipment_id INT NOT NULL REFERENCES equipment(id) ON DELETE CASCADE
);

-- 6.5 Session Observations
CREATE TABLE IF NOT EXISTS session_observations (
    id SERIAL PRIMARY KEY,
    session_id INT UNIQUE NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    dosage_given VARCHAR(255),
    patient_response VARCHAR(50) DEFAULT 'normal' CHECK (patient_response IN ('normal', 'abnormal')),
    vitals JSONB,
    complication_notes TEXT,
    recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6.6 Complication Alerts
CREATE TABLE IF NOT EXISTS complication_alerts (
    id SERIAL PRIMARY KEY,
    session_observation_id INT NOT NULL REFERENCES session_observations(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- 7. AI DIET/EXERCISE, PATIENT FEEDBACK, PROGRESS & FOLLOW-UPS
-- ==============================================================================

-- 7.1 Diet & Exercise Plans
CREATE TABLE IF NOT EXISTS diet_exercise_plans (
    id SERIAL PRIMARY KEY,
    plan_id INT NOT NULL REFERENCES therapy_plans(id) ON DELETE CASCADE,
    stage_type VARCHAR(50) NOT NULL CHECK (stage_type IN ('Poorvakarma', 'Pradhanakarma', 'Paschatkarma')),
    diet_chart JSONB,
    exercise_plan JSONB,
    ai_generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'approved'))
);

-- 7.2 Patient Feedback
CREATE TABLE IF NOT EXISTS patient_feedback (
    id SERIAL PRIMARY KEY,
    session_id INT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES patients(user_id) ON DELETE CASCADE,
    pain_scale INT,
    sleep_quality INT,
    energy_level INT,
    side_effects TEXT,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7.3 Progress Reports
CREATE TABLE IF NOT EXISTS progress_reports (
    id SERIAL PRIMARY KEY,
    plan_id INT UNIQUE NOT NULL REFERENCES therapy_plans(id) ON DELETE CASCADE,
    pre_treatment_data JSONB,
    post_treatment_data JSONB,
    symptom_relief_score DECIMAL(5, 2),
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7.4 Follow Ups
CREATE TABLE IF NOT EXISTS follow_ups (
    id SERIAL PRIMARY KEY,
    plan_id INT NOT NULL REFERENCES therapy_plans(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES patients(user_id) ON DELETE CASCADE,
    follow_up_date DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'missed'))
);

-- ==============================================================================
-- 8. NOTIFICATION ENGINE
-- ==============================================================================

-- 8.1 Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('reminder', 'pre_instruction', 'post_instruction', 'credential', 'complication_alert', 'no_show')),
    channel VARCHAR(20) NOT NULL CHECK (channel IN ('sms', 'whatsapp', 'push')),
    content TEXT NOT NULL,
    related_session_id INT REFERENCES sessions(id) ON DELETE SET NULL,
    scheduled_at TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,
    delivery_status VARCHAR(20) DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'failed'))
);

-- ==============================================================================
-- 9. PERFORMANCE INDEXES
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_clinic_id ON users(clinic_id);
CREATE INDEX IF NOT EXISTS idx_users_created_by ON users(created_by);

CREATE INDEX IF NOT EXISTS idx_therapist_spec_therapist_id ON therapist_specializations(therapist_id);
CREATE INDEX IF NOT EXISTS idx_therapist_spec_type ON therapist_specializations(therapy_type);
CREATE INDEX IF NOT EXISTS idx_therapist_avail_date ON therapist_availability(therapist_id, date);

CREATE INDEX IF NOT EXISTS idx_rooms_clinic_id ON rooms(clinic_id);
CREATE INDEX IF NOT EXISTS idx_equipment_room_id ON equipment(room_id);

CREATE INDEX IF NOT EXISTS idx_therapy_packages_clinic_id ON therapy_packages(clinic_id);
CREATE INDEX IF NOT EXISTS idx_therapy_plan_patient_id ON therapy_plans(patient_id);
CREATE INDEX IF NOT EXISTS idx_therapy_plan_stages_plan_id ON therapy_plan_stages(plan_id);

CREATE INDEX IF NOT EXISTS idx_sessions_scheduled_date ON sessions(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_sessions_patient_id ON sessions(patient_id);
CREATE INDEX IF NOT EXISTS idx_sessions_therapist_id ON sessions(therapist_id);
CREATE INDEX IF NOT EXISTS idx_sessions_room_id ON sessions(room_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);

CREATE INDEX IF NOT EXISTS idx_complication_alerts_doctor_id ON complication_alerts(doctor_id);
CREATE INDEX IF NOT EXISTS idx_complication_alerts_status ON complication_alerts(status);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_id ON notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(delivery_status);
CREATE INDEX IF NOT EXISTS idx_notifications_scheduled_at ON notifications(scheduled_at);

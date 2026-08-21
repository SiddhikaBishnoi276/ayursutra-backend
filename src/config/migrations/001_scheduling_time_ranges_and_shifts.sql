-- ==============================================================================
-- Migration 001: Scheduling Time Ranges, Stage Durations & 2-Layer Availability
-- ==============================================================================

-- 1. Update therapy_package_stages Table: Add session_duration_minutes
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'therapy_package_stages' AND column_name = 'session_duration_minutes'
    ) THEN
        ALTER TABLE therapy_package_stages 
        ADD COLUMN session_duration_minutes INT NOT NULL DEFAULT 60;
    END IF;
END $$;

-- 2. Update sessions Table: Add scheduled_start_time and scheduled_end_time
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sessions' AND column_name = 'scheduled_start_time'
    ) THEN
        ALTER TABLE sessions 
        ADD COLUMN scheduled_start_time TIME;

        -- Backfill from existing scheduled_time if present
        UPDATE sessions 
        SET scheduled_start_time = scheduled_time 
        WHERE scheduled_start_time IS NULL AND scheduled_time IS NOT NULL;

        -- Set fallback for any remaining rows
        UPDATE sessions 
        SET scheduled_start_time = '10:00:00' 
        WHERE scheduled_start_time IS NULL;

        ALTER TABLE sessions 
        ALTER COLUMN scheduled_start_time SET NOT NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sessions' AND column_name = 'scheduled_end_time'
    ) THEN
        ALTER TABLE sessions 
        ADD COLUMN scheduled_end_time TIME;

        -- Backfill scheduled_end_time = scheduled_start_time + 60 minutes
        UPDATE sessions 
        SET scheduled_end_time = (scheduled_start_time + INTERVAL '60 minutes')::TIME 
        WHERE scheduled_end_time IS NULL;

        ALTER TABLE sessions 
        ALTER COLUMN scheduled_end_time SET NOT NULL;
    END IF;
END $$;

-- 3. Update status CHECK constraint on sessions to include 'cancelled' if not already permitted
DO $$
BEGIN
    -- Drop old check constraint on status if needed and replace with expanded one
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'sessions_status_check'
    ) THEN
        ALTER TABLE sessions DROP CONSTRAINT sessions_status_check;
    END IF;

    ALTER TABLE sessions 
    ADD CONSTRAINT sessions_status_check 
    CHECK (status IN ('scheduled', 'in_progress', 'completed', 'no_show', 'cancelled'));
END $$;

-- 4. Create therapist_weekly_shifts Table
CREATE TABLE IF NOT EXISTS therapist_weekly_shifts (
    id SERIAL PRIMARY KEY,
    therapist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_working BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_therapist_weekly_shifts UNIQUE(therapist_id, day_of_week)
);

-- 5. Update therapist_availability Table (Override / Exception Table)
DO $$
BEGIN
    -- Add is_available column if not present
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'therapist_availability' AND column_name = 'is_available'
    ) THEN
        ALTER TABLE therapist_availability 
        ADD COLUMN is_available BOOLEAN DEFAULT TRUE;
    END IF;

    -- Add reason column if not present
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'therapist_availability' AND column_name = 'reason'
    ) THEN
        ALTER TABLE therapist_availability 
        ADD COLUMN reason TEXT;
    END IF;

    -- Add created_at column if not present
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'therapist_availability' AND column_name = 'created_at'
    ) THEN
        ALTER TABLE therapist_availability 
        ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    END IF;

    -- Make start_time and end_time nullable for full-day leaves
    ALTER TABLE therapist_availability ALTER COLUMN start_time DROP NOT NULL;
    ALTER TABLE therapist_availability ALTER COLUMN end_time DROP NOT NULL;
END $$;

-- 6. Performance & Range Conflict Indexes
CREATE INDEX IF NOT EXISTS idx_sessions_therapist_range 
ON sessions (therapist_id, scheduled_date, scheduled_start_time, scheduled_end_time);

CREATE INDEX IF NOT EXISTS idx_sessions_room_range 
ON sessions (room_id, scheduled_date, scheduled_start_time, scheduled_end_time);

CREATE INDEX IF NOT EXISTS idx_therapist_weekly_shifts_therapist_id 
ON therapist_weekly_shifts(therapist_id);

CREATE INDEX IF NOT EXISTS idx_therapist_avail_therapist_date 
ON therapist_availability(therapist_id, date);

-- VoxHire Complete Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
CREATE TYPE user_role AS ENUM ('super_admin', 'org_admin', 'recruiter');
CREATE TYPE interview_status AS ENUM ('scheduled', 'in_progress', 'completed', 'terminated', 'cancelled');
CREATE TYPE evaluation_rating AS ENUM ('Strong', 'Medium', 'Weak', 'Pending');
CREATE TYPE skill_difficulty AS ENUM ('Easy', 'Medium', 'Hard');
CREATE TYPE skill_category AS ENUM ('Primary', 'Secondary', 'Bonus');
CREATE TYPE transcript_speaker AS ENUM ('ai', 'candidate');
CREATE TYPE violation_type AS ENUM ('TAB_SWITCH', 'FULLSCREEN_EXIT', 'MULTIPLE_SCREENS', 'DEVTOOLS_OPEN', 'COPY_PASTE', 'SCREEN_SHARE_STOP');

-- Organizations
CREATE TABLE organizations (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(200) UNIQUE NOT NULL,
    logo_url VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users
CREATE TABLE users (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    email VARCHAR(320) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role DEFAULT 'recruiter',
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_org_id ON users(org_id);

-- Invites
CREATE TABLE invites (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    token TEXT UNIQUE NOT NULL,
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    invited_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    email VARCHAR(320) NOT NULL,
    name VARCHAR(200) NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_invites_token ON invites(token);

-- Candidates
CREATE TABLE candidates (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    name VARCHAR(200) NOT NULL,
    email VARCHAR(320) NOT NULL,
    phone VARCHAR(20),
    location VARCHAR(200),
    linkedin VARCHAR(500),
    github VARCHAR(500),
    resume_url VARCHAR(500),
    resume_text TEXT,
    parsed_profile JSONB,
    total_experience_years FLOAT,
    summary TEXT,
    applied_role VARCHAR(200),
    overall_rating evaluation_rating,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_candidates_org_id ON candidates(org_id);
CREATE INDEX idx_candidates_email ON candidates(email);

-- Candidate Skills (HR selected for interview)
CREATE TABLE candidate_skills (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    candidate_id TEXT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    skill VARCHAR(100) NOT NULL,
    category skill_category DEFAULT 'Primary',
    difficulty skill_difficulty DEFAULT 'Medium',
    weight_percent INTEGER DEFAULT 0,
    interview_areas JSONB
);
CREATE INDEX idx_candidate_skills_candidate_id ON candidate_skills(candidate_id);

-- Interview Sessions
CREATE TABLE interview_sessions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    candidate_id TEXT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    scheduled_at TIMESTAMPTZ,
    duration_minutes INTEGER DEFAULT 45,
    interview_link VARCHAR(500),
    link_token TEXT UNIQUE,
    status interview_status DEFAULT 'scheduled',
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    actual_duration_minutes INTEGER,
    recording_url VARCHAR(500),
    recording_size_mb FLOAT,
    overall_rating evaluation_rating,
    ai_summary TEXT,
    strengths JSONB,
    weak_areas JSONB,
    invite_email_sent BOOLEAN DEFAULT FALSE,
    invite_email_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_sessions_candidate_id ON interview_sessions(candidate_id);
CREATE INDEX idx_sessions_org_id ON interview_sessions(org_id);
CREATE INDEX idx_sessions_link_token ON interview_sessions(link_token);

-- Skill Evaluations
CREATE TABLE skill_evaluations (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    session_id TEXT NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
    skill VARCHAR(100) NOT NULL,
    rating evaluation_rating,
    score INTEGER,
    questions_asked INTEGER DEFAULT 0,
    ai_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_skill_evals_session_id ON skill_evaluations(session_id);

-- Transcript Entries
CREATE TABLE transcript_entries (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    session_id TEXT NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
    sequence INTEGER NOT NULL,
    speaker transcript_speaker NOT NULL,
    text TEXT NOT NULL,
    timestamp_seconds FLOAT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_transcript_session_id ON transcript_entries(session_id);

-- Anti Cheat Violations
CREATE TABLE anti_cheat_violations (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    session_id TEXT NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
    violation_type violation_type NOT NULL,
    count INTEGER DEFAULT 1,
    timestamp_seconds FLOAT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_violations_session_id ON anti_cheat_violations(session_id);

-- Updated_at auto-update trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_candidates_updated_at BEFORE UPDATE ON candidates FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_sessions_updated_at BEFORE UPDATE ON interview_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Done!
SELECT 'VoxHire schema created successfully' AS status;

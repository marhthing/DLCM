
-- Create attendance_records table
CREATE TABLE IF NOT EXISTS attendance_records (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  branch TEXT NOT NULL DEFAULT 'Pontypridd',
  stream_session_id TEXT NOT NULL,
  stream_title TEXT DEFAULT 'Live Service',
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ NOT NULL,
  duration_seconds INTEGER DEFAULT 0,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(email, stream_session_id, branch)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_attendance_email_session ON attendance_records(email, stream_session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_timestamp ON attendance_records(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_branch ON attendance_records(branch);

-- Create stream_settings table
CREATE TABLE IF NOT EXISTS stream_settings (
  id UUID PRIMARY KEY,
  youtube_url TEXT NOT NULL,
  is_attendance_active TEXT DEFAULT 'false',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security (optional - remove if you want to disable)
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_settings ENABLE ROW LEVEL SECURITY;

-- Create policies to allow all operations (adjust as needed)
CREATE POLICY "Allow all operations on attendance_records" ON attendance_records
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on stream_settings" ON stream_settings
  FOR ALL USING (true) WITH CHECK (true);

-- Migration: Add branch column to existing tables (if upgrading)
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS branch TEXT DEFAULT 'Pontypridd';

-- Migration: Update unique constraint to include branch
ALTER TABLE attendance_records DROP CONSTRAINT IF EXISTS attendance_records_email_stream_session_id_key;
ALTER TABLE attendance_records ADD CONSTRAINT attendance_records_email_session_branch_key UNIQUE(email, stream_session_id, branch);

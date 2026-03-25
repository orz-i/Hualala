ALTER TABLE preview_runtimes
  ADD COLUMN IF NOT EXISTS playback_timeline jsonb;

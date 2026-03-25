ALTER TABLE preview_runtimes
  ADD COLUMN IF NOT EXISTS playback_delivery_mode text,
  ADD COLUMN IF NOT EXISTS playback_url text,
  ADD COLUMN IF NOT EXISTS playback_poster_url text,
  ADD COLUMN IF NOT EXISTS playback_duration_ms integer,
  ADD COLUMN IF NOT EXISTS export_download_url text,
  ADD COLUMN IF NOT EXISTS export_mime_type text,
  ADD COLUMN IF NOT EXISTS export_file_name text,
  ADD COLUMN IF NOT EXISTS export_size_bytes bigint,
  ADD COLUMN IF NOT EXISTS last_error_code text,
  ADD COLUMN IF NOT EXISTS last_error_message text;

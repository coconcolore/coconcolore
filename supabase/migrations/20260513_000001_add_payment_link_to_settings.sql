ALTER TABLE platform_settings
  ADD COLUMN IF NOT EXISTS payment_link TEXT;

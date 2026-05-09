alter table public.platform_settings
  add column if not exists platform_iban text,
  add column if not exists platform_iban_owner text,
  add column if not exists platform_bank text;

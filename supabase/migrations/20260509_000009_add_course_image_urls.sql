-- Add image_urls array to course table for multiple gallery images
alter table public.course add column if not exists image_urls text[] default '{}';

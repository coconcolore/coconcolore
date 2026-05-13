-- Delete all test data, keeping only users and platform_settings (Rechtstexte)
-- Run this in the Supabase Dashboard → SQL Editor

-- Order matters due to foreign key constraints

-- 1. Bookings & enrollments
delete from public.booking;
delete from public.enrollment;

-- 2. Payouts & invoices
delete from public.payout_request;
delete from public.invoice;

-- 3. Calendar slots & rooms
delete from public.calendar_slot;
delete from public.room;

-- 4. Lessons (cascade would handle this, but explicit is safer)
delete from public.lesson;

-- 5. Courses
delete from public.course;

-- 6. Artist profiles
delete from public.artist_profile;

-- Kept: public.users
-- Kept: public.platform_settings (Rechtstexte: legal_impressum, legal_agb, legal_datenschutz)

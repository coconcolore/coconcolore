-- Add address field to room table
alter table public.room add column if not exists address text;

-- Add room_id FK to course table so courses can reference their room
alter table public.course add column if not exists room_id uuid references public.room(id) on delete set null;

create index if not exists idx_course_room_id on public.course(room_id);

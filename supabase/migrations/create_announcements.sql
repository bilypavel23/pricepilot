-- announcements table
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists announcements_created_at_idx
  on public.announcements(created_at desc);

-- announcement_reads table
create table if not exists public.announcement_reads (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  read_at timestamptz not null default now()
);

create unique index if not exists announcement_reads_unique_idx
  on public.announcement_reads(user_id, announcement_id);

create index if not exists announcement_reads_user_id_idx
  on public.announcement_reads(user_id);

-- Enable RLS
alter table public.announcements enable row level security;
alter table public.announcement_reads enable row level security;

-- RLS Policies for announcements
-- SELECT: allow authenticated users
create policy "announcements_select_authenticated"
  on public.announcements
  for select
  to authenticated
  using (true);

-- INSERT/UPDATE/DELETE: admin only
create policy "announcements_insert_admin"
  on public.announcements
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.is_admin = true
    )
  );

create policy "announcements_update_admin"
  on public.announcements
  for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.is_admin = true
    )
  );

create policy "announcements_delete_admin"
  on public.announcements
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.is_admin = true
    )
  );

-- RLS Policies for announcement_reads
-- SELECT/INSERT/UPDATE/DELETE: only the owner
create policy "announcement_reads_select_owner"
  on public.announcement_reads
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "announcement_reads_insert_owner"
  on public.announcement_reads
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "announcement_reads_update_owner"
  on public.announcement_reads
  for update
  to authenticated
  using (user_id = auth.uid());

create policy "announcement_reads_delete_owner"
  on public.announcement_reads
  for delete
  to authenticated
  using (user_id = auth.uid());





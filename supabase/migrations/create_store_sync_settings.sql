-- Create store_sync_settings table for competitor sync scheduling
create table if not exists public.store_sync_settings (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  timezone text not null default 'Europe/Prague',
  -- array of "HH:MM" strings, e.g. ['06:00','12:00','18:00','00:00']
  daily_sync_times text[] not null default array['06:00'],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (store_id)
);

-- Enable RLS
alter table public.store_sync_settings enable row level security;

-- RLS policies: users can only access their own store's sync settings
create policy "Users can view their own store sync settings"
  on public.store_sync_settings
  for select
  using (
    exists (
      select 1 from public.stores
      where stores.id = store_sync_settings.store_id
      and stores.owner_id = auth.uid()
    )
  );

create policy "Users can insert their own store sync settings"
  on public.store_sync_settings
  for insert
  with check (
    exists (
      select 1 from public.stores
      where stores.id = store_sync_settings.store_id
      and stores.owner_id = auth.uid()
    )
  );

create policy "Users can update their own store sync settings"
  on public.store_sync_settings
  for update
  using (
    exists (
      select 1 from public.stores
      where stores.id = store_sync_settings.store_id
      and stores.owner_id = auth.uid()
    )
  );

create policy "Users can delete their own store sync settings"
  on public.store_sync_settings
  for delete
  using (
    exists (
      select 1 from public.stores
      where stores.id = store_sync_settings.store_id
      and stores.owner_id = auth.uid()
    )
  );


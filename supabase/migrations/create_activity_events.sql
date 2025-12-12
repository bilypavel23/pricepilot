-- activity_events table
create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  type text not null, -- e.g. "price_updated", "products_sync", "competitor_sync"
  title text not null,
  meta jsonb null,
  created_at timestamptz not null default now()
);

create index if not exists activity_events_store_created_idx
  on public.activity_events(store_id, created_at desc);

-- RLS policies
alter table public.activity_events enable row level security;

-- Allow users to read events for their store
create policy "Allow users to read their store's activity events"
on public.activity_events for select
to authenticated
using (
  exists (
    select 1 from public.stores s
    where s.id = activity_events.store_id
      and s.owner_id = auth.uid()
  )
);

-- Allow authenticated users to insert events (for server-side use)
create policy "Allow authenticated users to insert activity events"
on public.activity_events for insert
to authenticated
with check (
  exists (
    select 1 from public.stores s
    where s.id = activity_events.store_id
      and s.owner_id = auth.uid()
  )
);


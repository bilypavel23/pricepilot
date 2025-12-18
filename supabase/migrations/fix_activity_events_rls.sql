-- Fix RLS policies for activity_events to use owner_id instead of user_id

-- Drop existing policies if they exist
drop policy if exists "Allow users to read their store's activity events" on public.activity_events;
drop policy if exists "Allow authenticated users to insert activity events" on public.activity_events;

-- Recreate policies with correct column name (owner_id)
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




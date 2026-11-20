-- PHYSICS DIGITAL HUB — initial database schema
-- Run this migration in the Supabase SQL Editor before enabling the Edge Functions.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  member_code text not null unique check (member_code in ('01','02','03','04','05','06')),
  display_name text not null,
  email_alias text not null unique,
  role text not null check (role in ('admin','member')),
  created_at timestamptz not null default now(),
  constraint profiles_role_matches_member_code check (
    (member_code = '01' and role = 'admin') or
    (member_code <> '01' and role = 'member')
  )
);
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_role_matches_member_code'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles add constraint profiles_role_matches_member_code check (
      (member_code = '01' and role = 'admin') or
      (member_code <> '01' and role = 'member')
    );
  end if;
end $$;
create unique index if not exists profiles_single_admin_idx on public.profiles ((role)) where role = 'admin';

create table if not exists public.site_settings (
  id smallint primary key default 1 check (id = 1),
  active_vimeo_id text not null default '',
  active_vimeo_hash text not null default '',
  active_mp4_url text not null default '',
  announcement text not null default '',
  exhibition_info text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.site_settings add column if not exists active_vimeo_hash text not null default '';
insert into public.site_settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  content text not null check (char_length(content) between 2 and 500),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint comments_expiry_72_hours check (expires_at <= created_at + interval '72 hours' + interval '1 minute')
);
create index if not exists comments_active_idx on public.comments (expires_at desc, created_at desc);

create table if not exists public.comment_deletion_audit (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null,
  deleted_by_profile_id uuid references public.profiles(id) on delete set null,
  deleted_by_name text not null,
  deleted_at timestamptz not null default now()
);

create table if not exists public.analytics_events (
  id bigint generated always as identity primary key,
  event_type text not null check (event_type in ('page_visit','page_heartbeat','video_play','comment_post')),
  visitor_hash text not null,
  page text not null default 'video',
  created_at timestamptz not null default now()
);
create index if not exists analytics_events_created_idx on public.analytics_events (created_at desc);
create index if not exists analytics_events_visitor_idx on public.analytics_events (visitor_hash, event_type);

create table if not exists public.likes (
  visitor_hash text primary key,
  created_at timestamptz not null default now()
);

create table if not exists public.request_limit_buckets (
  bucket_key text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (bucket_key, window_start)
);

-- Atomic request-rate limiter. Only Edge Functions using the server secret can call this RPC.
create or replace function public.consume_rate_limit(
  p_bucket_key text,
  p_limit integer,
  p_window_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_window_start timestamptz;
  v_hits integer;
begin
  if p_limit < 1 or p_window_seconds < 1 then
    return false;
  end if;
  v_window_start := to_timestamp(floor(extract(epoch from clock_timestamp()) / p_window_seconds) * p_window_seconds);
  insert into public.request_limit_buckets (bucket_key, window_start, hits)
  values (p_bucket_key, v_window_start, 1)
  on conflict (bucket_key, window_start)
  do update set hits = public.request_limit_buckets.hits + 1
  returning hits into v_hits;
  delete from public.request_limit_buckets where window_start < now() - interval '2 days';
  return v_hits <= p_limit;
end;
$$;

-- Atomic Like/Unlike operation for each privacy-friendly browser identifier.
create or replace function public.toggle_like(p_visitor_hash text)
returns table (liked boolean, total_likes bigint)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_liked boolean;
  v_total bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_visitor_hash, 0));
  if exists (select 1 from public.likes where visitor_hash = p_visitor_hash) then
    delete from public.likes where visitor_hash = p_visitor_hash;
    v_liked := false;
  else
    insert into public.likes (visitor_hash) values (p_visitor_hash) on conflict do nothing;
    v_liked := true;
  end if;
  select count(*) into v_total from public.likes;
  return query select v_liked, v_total;
end;
$$;

-- Return complete date-range aggregates and a small recent-activity feed in SQL.
-- This avoids silently truncating dashboard metrics at the REST API row limit.
create or replace function public.get_analytics_summary(p_days integer)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  with params as (
    select case when p_days in (7, 30, 90) then p_days else 30 end as days
  ),
  bounds as (
    select (now() - make_interval(days => (select days - 1 from params))) as since_ts,
           (now() at time zone 'UTC')::date as today_utc,
           (now() - interval '5 minutes') as live_since
  ),
  filtered as (
    select e.event_type, e.visitor_hash, e.page, e.created_at
    from public.analytics_events e, bounds b
    where e.created_at >= b.since_ts
  ),
  daily_series as (
    select generate_series(
      (select (today_utc - (days - 1))::timestamp from params, bounds),
      (select today_utc::timestamp from bounds),
      interval '1 day'
    )::date as day
  ),
  daily_counts as (
    select (f.created_at at time zone 'UTC')::date as day,
           count(*) filter (where f.event_type = 'page_visit')::integer as visits,
           count(*) filter (where f.event_type = 'video_play')::integer as plays
    from filtered f
    group by (f.created_at at time zone 'UTC')::date
  ),
  recent_events as (
    select f.event_type, f.created_at
    from filtered f
    where f.event_type <> 'page_heartbeat'
    order by f.created_at desc
    limit 30
  )
  select jsonb_build_object(
    'analytics', jsonb_build_object(
      'visits', (select count(*) from filtered where event_type = 'page_visit'),
      'uniqueVisitors', (select count(distinct visitor_hash) from filtered where event_type = 'page_visit'),
      'plays', (select count(*) from filtered where event_type = 'video_play'),
      'uniqueViewers', (select count(distinct visitor_hash) from filtered where event_type = 'video_play'),
      'comments', (select count(*) from filtered where event_type = 'comment_post'),
      'liveVisitorsEstimate', (
        select count(distinct e.visitor_hash)
        from public.analytics_events e, bounds b
        where e.created_at >= b.live_since and e.event_type in ('page_visit','page_heartbeat')
      )
    ),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', to_char(ds.day, 'YYYY-MM-DD'),
        'visits', coalesce(dc.visits, 0),
        'plays', coalesce(dc.plays, 0)
      ) order by ds.day)
      from daily_series ds left join daily_counts dc on dc.day = ds.day
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object('event_type', re.event_type, 'created_at', re.created_at) order by re.created_at desc)
      from recent_events re
    ), '[]'::jsonb)
  );
$$;

-- All application data is served through Edge Functions using the server-side secret key.
-- Browser roles receive no direct table access. This prevents clients bypassing role/gate checks.
do $$
declare
  t text;
begin
  foreach t in array array['profiles','site_settings','comments','comment_deletion_audit','analytics_events','likes','request_limit_buckets'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
  end loop;
end $$;

revoke all on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;
revoke all on function public.toggle_like(text) from public, anon, authenticated;
grant execute on function public.toggle_like(text) to service_role;
revoke all on function public.get_analytics_summary(integer) from public, anon, authenticated;
grant execute on function public.get_analytics_summary(integer) to service_role;

-- PHYSICS DIGITAL HUB — scheduled deletion for expired anonymous comments.
-- 1. Enable the pg_cron extension in Supabase Dashboard -> Database -> Extensions.
-- 2. Run this script once in the Supabase SQL Editor.
-- Public queries already hide comments at expires_at and perform opportunistic cleanup.
-- This job physically deletes expired rows even when no visitor opens the website.

select cron.unschedule(jobid)
from cron.job
where jobname = 'pdh-delete-expired-comments';

select cron.schedule(
  'pdh-delete-expired-comments',
  '* * * * *',
  $$delete from public.comments where expires_at <= now();$$
);

-- PHYSICS DIGITAL HUB — Phase 3A eight-member roster upgrade
-- Apply this migration to an existing project before running scripts/bootstrap-members.mjs.
-- Existing profile IDs, Auth users, roles, and passwords are preserved.

begin;

-- Drop the old six-code constraint so the current member codes can be remapped safely.
alter table public.profiles
  drop constraint if exists profiles_member_code_check;

-- Move the three profiles whose codes change to temporary unique values first.
-- This avoids conflicts with the unique member_code constraint while the final
-- assignments are made. The operation is repeatable for this fixed roster.
update public.profiles
set member_code = 'MIG-' || replace(auth_user_id::text, '-', '')
where email_alias in (
  'sandipan@physicsdigitalhub.test',
  'neha@physicsdigitalhub.test',
  'khushi@physicsdigitalhub.test'
);

update public.profiles
set member_code = case email_alias
  when 'sandipan@physicsdigitalhub.test' then '05'
  when 'neha@physicsdigitalhub.test' then '07'
  when 'khushi@physicsdigitalhub.test' then '08'
end
where email_alias in (
  'sandipan@physicsdigitalhub.test',
  'neha@physicsdigitalhub.test',
  'khushi@physicsdigitalhub.test'
);

alter table public.profiles
  add constraint profiles_member_code_check
  check (member_code in ('01','02','03','04','05','06','07','08'));

commit;

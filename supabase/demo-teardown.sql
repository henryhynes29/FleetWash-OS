-- ============================================================
-- FleetWash OS — REMOVE DEMO ACTIVITY
-- Clears everything demo-seed.sql added (jobs, checkoffs, map pin,
-- demo invoices/notes/complaints). KEEPS your real accounts.
--
-- Run in Supabase -> SQL Editor. Safe to run anytime.
-- (To also remove the accounts, delete rows from the clients table.)
-- ============================================================

do $$
declare
  v_company uuid;
  demo uuid := 'dddddddd-dddd-dddd-dddd-dddddddddddd';
begin
  select company_id into v_company from profiles where role = 'owner' order by created_at limit 1;
  if v_company is null then raise exception 'No owner profile found.'; end if;

  delete from complaints where company_id = v_company and body like 'DEMO:%';
  delete from notes      where company_id = v_company and body like 'DEMO:%';
  delete from invoices   where company_id = v_company and number like 'DEMO-%';

  -- Deleting the demo jobs cascades their unit_checkoffs automatically.
  delete from jobs  where company_id = v_company and series_id = demo;
  delete from units where company_id = v_company and number in ('AG-101','AG-102','BK-11','BB-3');

  delete from positions where company_id = v_company and lat = 46.7867 and lng = -92.1005;

  raise notice 'Demo activity removed for company %', v_company;
end $$;

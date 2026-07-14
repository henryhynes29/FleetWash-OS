-- ============================================================
-- FleetWash OS — DEMO ACTIVITY (jobs, standings, map, flags)
-- Fills the app with sample activity so Field mode looks "full".
-- Wires everything to your REAL accounts by name.
--
-- ORDER:
--   1. Run companies-seed.sql FIRST (loads your real accounts).
--   2. Then run this file.
--   3. Refresh the app.
--
-- What it adds, all tagged for clean removal:
--   - jobs         tagged series_id = dddddddd-…-dddd  (today + week + past)
--   - units        AG-101/AG-102/BK-11/BB-3
--   - unit_checkoffs feeds Standings ("trucks washed")
--   - positions    one live-map pin (Duluth)
--   - invoices     number starts with 'DEMO-'
--   - notes        body starts with 'DEMO:'  (Feed)
--   - complaints   body starts with 'DEMO:'  (Flags)
--
-- Remove it all later with demo-teardown.sql (keeps your accounts).
-- ============================================================

do $$
declare
  v_company uuid;
  v_owner   uuid;
  today     timestamptz := date_trunc('day', now());
  demo      uuid := 'dddddddd-dddd-dddd-dddd-dddddddddddd';  -- sentinel to find/remove demo jobs

  c_airgas  uuid; c_bernick uuid; c_bimbo uuid; c_barr uuid; c_bix uuid; c_adamich uuid;
  u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid();
  u3 uuid := gen_random_uuid(); u4 uuid := gen_random_uuid();
  j_past uuid := gen_random_uuid();
begin
  select company_id, user_id into v_company, v_owner
  from profiles where role = 'owner' order by created_at limit 1;
  if v_company is null then
    raise exception 'No owner profile found. Log into the app once, then re-run.';
  end if;

  select id into c_airgas  from clients where company_id = v_company and name = 'Airgas - Duluth' limit 1;
  select id into c_bernick from clients where company_id = v_company and name = 'Bernick''s Duluth' limit 1;
  select id into c_bimbo   from clients where company_id = v_company and name = 'Bimbo Bakeries Superior' limit 1;
  select id into c_barr    from clients where company_id = v_company and name = 'Barr Engineering Duluth' limit 1;
  select id into c_bix     from clients where company_id = v_company and name = 'Bix Produce' limit 1;
  select id into c_adamich from clients where company_id = v_company and name = 'Adamich Trucking' limit 1;
  if c_airgas is null then
    raise exception 'Real accounts not found — run companies-seed.sql first.';
  end if;

  -- Units (so Standings has something to count)
  insert into units (id, company_id, client_id, number) values
    (u1, v_company, c_airgas,  'AG-101'),
    (u2, v_company, c_airgas,  'AG-102'),
    (u3, v_company, c_bernick, 'BK-11'),
    (u4, v_company, c_bimbo,   'BB-3');

  -- TODAY, assigned to YOU (Field Home "My Jobs Today" + Team + Map)
  insert into jobs (company_id, client_id, starts_at, duration_min, truck_id, worker_ids, unit_ids, status, series_id) values
    (v_company, c_airgas,  today + interval '7 hours',  45,  'blue',  array[v_owner], array[u1,u2], 'scheduled', demo),
    (v_company, c_bernick, today + interval '9 hours',  120, 'grey',  array[v_owner], array[u3],    'scheduled', demo),
    (v_company, c_bimbo,   today + interval '13 hours', 90,  'black', array[v_owner], array[u4],    'scheduled', demo);

  -- TODAY, not yours (shows on the team board)
  insert into jobs (company_id, client_id, starts_at, duration_min, truck_id, worker_ids, status, series_id) values
    (v_company, c_barr, today + interval '8 hours', 40, 'blue', '{}', 'scheduled', demo);

  -- THIS WEEK (Team schedule)
  insert into jobs (company_id, client_id, starts_at, duration_min, truck_id, worker_ids, status, series_id) values
    (v_company, c_bix,     today + interval '1 day 7 hours',   30, 'blue', array[v_owner], 'scheduled', demo),
    (v_company, c_adamich, today + interval '2 days 16 hours', 20, 'own',  array[v_owner], 'scheduled', demo),
    (v_company, c_airgas,  today + interval '3 days 15 hours', 45, 'grey', '{}', 'scheduled', demo);

  -- PAST (Metrics history + Standings checkoffs)
  insert into jobs (id, company_id, client_id, starts_at, duration_min, truck_id, worker_ids, unit_ids, status, series_id) values
    (j_past, v_company, c_airgas, today - interval '5 days' + interval '7 hours', 45, 'blue', array[v_owner], array[u1,u2], 'done', demo);
  insert into jobs (company_id, client_id, starts_at, duration_min, truck_id, worker_ids, status, series_id) values
    (v_company, c_bernick, today - interval '3 days' + interval '9 hours', 120, 'grey', array[v_owner], 'invoiced', demo);

  -- Standings: trucks washed this week (attributed to you)
  insert into unit_checkoffs (job_id, unit_id, company_id, checked_by, checked_at) values
    (j_past, u1, v_company, v_owner, now() - interval '5 days'),
    (j_past, u2, v_company, v_owner, now() - interval '5 days');

  -- Live Map pin (Duluth area)
  insert into positions (user_id, company_id, lat, lng, updated_at) values
    (v_owner, v_company, 46.7867, -92.1005, now())
  on conflict (user_id) do update set lat = excluded.lat, lng = excluded.lng, updated_at = now();

  -- Invoices
  insert into invoices (company_id, client_id, number, status, lines) values
    (v_company, c_airgas,  'DEMO-1001', 'sent', '[{"desc":"Box truck wash","qty":3,"rate_cents":3200}]'),
    (v_company, c_bernick, 'DEMO-1002', 'paid', '[{"desc":"Tractor wash","qty":5,"rate_cents":4500},{"desc":"Trailer wash","qty":5,"rate_cents":3500}]');

  -- Feed (notes)
  insert into notes (company_id, category, body, author_id) values
    (v_company, 'Gate/Access', 'DEMO: Airgas — bring the gate opener; the backs of the trucks are only reachable from the dock.', v_owner),
    (v_company, 'Hazard',      'DEMO: Bimbo Superior requires training — door code 1425, liftgates up before moving.', v_owner);

  -- Flags (complaints table)
  insert into complaints (company_id, client_id, body, resolved) values
    (v_company, c_airgas,  'DEMO: Backs of trucks left dirty where they meet the dock.', false),
    (v_company, c_bernick, 'DEMO: A couple drivers flag windshields and mudflaps.', false),
    (v_company, c_bix,     'DEMO: Backs not sprayed out well — leftover veggies.', true);

  raise notice 'Demo activity loaded for company %', v_company;
end $$;

-- Scénarios de vérification du schéma rh (après schema.sql, paie/06-schema-paie.sql, rh/06-schema-rh.sql)
SET search_path = rh, paie, compta, public;
\set QUIET on
INSERT INTO compta.tenant (id, name) VALUES ('00000000-0000-0000-0000-000000000001', 'Yiel Group') ON CONFLICT DO NOTHING;
INSERT INTO compta.company (id, tenant_id, name, capital) VALUES ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000001', 'Yiel Group Holding SA', 50000000) ON CONFLICT DO NOTHING;
SELECT set_config('app.company_id', '00000000-0000-0000-0000-0000000000c1', false) \g /dev/null
SELECT set_config('app.gta_track', 'on', false) \g /dev/null
INSERT INTO paie.establishment (id, company_id, code, label, at_rate) VALUES ('00000000-0000-0000-0000-0000000000e5', current_setting('app.company_id')::uuid, 'DLA', 'Siège', 1.75);
INSERT INTO paie.convention (id, company_id, code, label) VALUES ('00000000-0000-0000-0000-0000000000cc', current_setting('app.company_id')::uuid, 'CC-COM', 'Commerce');
INSERT INTO paie.employee (id, company_id, matricule, last_name, first_name, job_title, department, establishment_id, convention_id, category, contract, hire_date) VALUES
 ('00000000-0000-0000-0000-0000000000a1', current_setting('app.company_id')::uuid, 'YG0010', 'FOTSO', 'Brice', 'Lead développeur', 'Produit', '00000000-0000-0000-0000-0000000000e5', '00000000-0000-0000-0000-0000000000cc', '4', 'CDI', '2021-08-16'),
 ('00000000-0000-0000-0000-0000000000a2', current_setting('app.company_id')::uuid, 'YG0009', 'NANA', 'Rodrigue', 'Directeur technique', 'Produit', '00000000-0000-0000-0000-0000000000e5', '00000000-0000-0000-0000-0000000000cc', '5', 'CDI', '2020-11-02');

-- 1. Lien de pointage : usage unique, limité, personnel
INSERT INTO site (company_id, code, label, lat, lng, radius_m, qr_token) VALUES (current_setting('app.company_id')::uuid, 'SIEGE', 'Siège', 4.0263, 9.6957, 150, 'YQ-TEST');
INSERT INTO punch_link (token, company_id, employee_id, kind, created_at, expires_at) VALUES ('L1', current_setting('app.company_id')::uuid, '00000000-0000-0000-0000-0000000000a1', 'in', '2026-10-21 07:40+01', '2026-10-21 07:50+01');
INSERT INTO punch (company_id, employee_id, at, kind, site_code, score, status, channel, link_token) VALUES (current_setting('app.company_id')::uuid, '00000000-0000-0000-0000-0000000000a1', '2026-10-21 07:45+01', 'in', 'SIEGE', 90, 'valide', 'whatsapp', 'L1');
DO $$ BEGIN BEGIN INSERT INTO rh.punch (company_id, employee_id, at, kind, status, channel, link_token) VALUES (current_setting('app.company_id')::uuid, '00000000-0000-0000-0000-0000000000a1', '2026-10-21 07:46+01', 'in', 'valide', 'whatsapp', 'L1'); RAISE EXCEPTION 'KO'; EXCEPTION WHEN raise_exception OR unique_violation THEN IF SQLERRM = 'KO' THEN RAISE; END IF; END; END $$;
DO $$ BEGIN BEGIN INSERT INTO rh.punch_link (token, company_id, employee_id, kind, created_at, expires_at) VALUES ('L2', current_setting('app.company_id')::uuid, '00000000-0000-0000-0000-0000000000a1', 'in', now(), now() + interval '2 hours'); RAISE EXCEPTION 'KO'; EXCEPTION WHEN check_violation THEN NULL; END; END $$;
INSERT INTO punch_link (token, company_id, employee_id, kind, created_at, expires_at) VALUES ('L3', current_setting('app.company_id')::uuid, '00000000-0000-0000-0000-0000000000a1', 'out', '2026-10-21 17:00+01', '2026-10-21 17:10+01');
DO $$ BEGIN BEGIN INSERT INTO rh.punch (company_id, employee_id, at, kind, status, channel, link_token) VALUES (current_setting('app.company_id')::uuid, '00000000-0000-0000-0000-0000000000a1', '2026-10-21 17:30+01', 'out', 'valide', 'whatsapp', 'L3'); RAISE EXCEPTION 'KO'; EXCEPTION WHEN raise_exception THEN IF SQLERRM = 'KO' THEN RAISE; END IF; END; END $$;
DO $$ BEGIN BEGIN INSERT INTO rh.punch (company_id, employee_id, at, kind, status, channel) VALUES (current_setting('app.company_id')::uuid, '00000000-0000-0000-0000-0000000000a1', '2026-10-21 17:30+01', 'out', 'valide', 'manager'); RAISE EXCEPTION 'KO'; EXCEPTION WHEN check_violation THEN NULL; END; END $$;

-- 2. Mission : positions seulement pendant la mission
INSERT INTO mission (id, company_id, ref, label, from_label, to_label, to_lat, to_lng, route, planned_start, planned_arrival, planned_end) VALUES ('00000000-0000-0000-0000-0000000000f1', current_setting('app.company_id')::uuid, 'OM-1', 'Test', 'Douala', 'Kribi', 2.94, 9.91, '[]', '2026-10-21 07:00+01', '2026-10-21 10:00+01', '2026-10-21');
DO $$ BEGIN BEGIN INSERT INTO rh.mission_position (mission_id, company_id, at, lat, lng) VALUES ('00000000-0000-0000-0000-0000000000f1', current_setting('app.company_id')::uuid, '2026-10-21 06:50+01', 4.05, 9.7); RAISE EXCEPTION 'KO'; EXCEPTION WHEN raise_exception THEN IF SQLERRM = 'KO' THEN RAISE; END IF; END; END $$;
UPDATE mission SET status = 'en_route', started_at = '2026-10-21 07:05+01' WHERE ref = 'OM-1';
INSERT INTO mission_position (mission_id, company_id, at, lat, lng) VALUES ('00000000-0000-0000-0000-0000000000f1', current_setting('app.company_id')::uuid, '2026-10-21 08:00+01', 3.8, 10.1);
UPDATE mission SET status = 'terminee', ended_at = '2026-10-21 18:00+01' WHERE ref = 'OM-1';
DO $$ BEGIN BEGIN INSERT INTO rh.mission_position (mission_id, company_id, at, lat, lng) VALUES ('00000000-0000-0000-0000-0000000000f1', current_setting('app.company_id')::uuid, '2026-10-21 19:00+01', 4.05, 9.7); RAISE EXCEPTION 'KO'; EXCEPTION WHEN raise_exception THEN IF SQLERRM = 'KO' THEN RAISE; END IF; END; END $$;

-- 3. Absences : chevauchement interdit, pas d'auto-validation
INSERT INTO absence_type (company_id, code, label, icon, color, unit, paid, pay_code, counter, approval) VALUES (current_setting('app.company_id')::uuid, 'CP', 'Congés payés', 'sun', '#F28C28', 'ouvrable', true, 'CONGE', 'CP', 'workflow');
INSERT INTO absence_request (id, company_id, ref, employee_id, type_code, start_d, end_d, days, status, steps, approver_id, created_by_user) VALUES ('00000000-0000-0000-0000-0000000000b1', current_setting('app.company_id')::uuid, 'ABS-1', '00000000-0000-0000-0000-0000000000a1', 'CP', '2026-11-02', '2026-11-13', 11, 'en_attente_n1', '{n1,notify}', '00000000-0000-0000-0000-0000000000a2', gen_random_uuid());
DO $$ BEGIN BEGIN INSERT INTO rh.absence_request (company_id, ref, employee_id, type_code, start_d, end_d, days, status, steps, created_by_user) VALUES (current_setting('app.company_id')::uuid, 'ABS-2', '00000000-0000-0000-0000-0000000000a1', 'CP', '2026-11-10', '2026-11-11', 2, 'en_attente_n1', '{n1,notify}', gen_random_uuid()); RAISE EXCEPTION 'KO'; EXCEPTION WHEN exclusion_violation THEN NULL; END; END $$;
DO $$ BEGIN BEGIN UPDATE rh.absence_request SET status = 'a_notifier', step = 1, decided_by_employee = '00000000-0000-0000-0000-0000000000a1' WHERE ref = 'ABS-1'; RAISE EXCEPTION 'KO'; EXCEPTION WHEN raise_exception THEN IF SQLERRM = 'KO' THEN RAISE; END IF; END; END $$;
UPDATE absence_request SET status = 'a_notifier', step = 1, decided_by_employee = '00000000-0000-0000-0000-0000000000a2' WHERE ref = 'ABS-1';

-- 4. Stocks : pas de stock négatif, inventaire validé par un tiers
INSERT INTO warehouse (company_id, code, label) VALUES (current_setting('app.company_id')::uuid, 'MAG', 'Magasin'), (current_setting('app.company_id')::uuid, 'YDE', 'Agence');
INSERT INTO stock_article (company_id, code, label, family) VALUES (current_setting('app.company_id')::uuid, 'TAB-10', 'Tablette', 'marchandise');
INSERT INTO stock_move (company_id, num, move_date, type, article, wh, qty, unit_cost, value) VALUES (current_setting('app.company_id')::uuid, 'MV-1', '2026-10-01', 'entree', 'TAB-10', 'MAG', 10, 95000, 950000);
INSERT INTO stock_move (company_id, num, move_date, type, article, wh, wh_to, qty, value) VALUES (current_setting('app.company_id')::uuid, 'MV-2', '2026-10-02', 'transfert', 'TAB-10', 'MAG', 'YDE', 4, 380000);
DO $$ BEGIN BEGIN INSERT INTO rh.stock_move (company_id, num, move_date, type, article, wh, qty, value) VALUES (current_setting('app.company_id')::uuid, 'MV-3', '2026-10-03', 'sortie', 'TAB-10', 'YDE', 5, 475000); RAISE EXCEPTION 'KO'; EXCEPTION WHEN raise_exception THEN IF SQLERRM = 'KO' THEN RAISE; END IF; END; END $$;
DO $$ BEGIN ASSERT (SELECT qty FROM rh.stock_position WHERE article = 'TAB-10' AND wh = 'YDE') = 4, 'position après transfert'; END $$;
INSERT INTO stock_count (id, company_id, ref, count_date, wh, opened_by) VALUES ('00000000-0000-0000-0000-0000000000d1', current_setting('app.company_id')::uuid, 'INV-1', '2026-10-20', 'MAG', '00000000-0000-0000-0000-00000000aaaa');
DO $$ BEGIN BEGIN INSERT INTO rh.stock_count (company_id, ref, count_date, wh, opened_by) VALUES (current_setting('app.company_id')::uuid, 'INV-2', '2026-10-21', 'MAG', gen_random_uuid()); RAISE EXCEPTION 'KO'; EXCEPTION WHEN unique_violation THEN NULL; END; END $$;
DO $$ BEGIN BEGIN UPDATE rh.stock_count SET status = 'valide', validated_by = '00000000-0000-0000-0000-00000000aaaa' WHERE ref = 'INV-1'; RAISE EXCEPTION 'KO'; EXCEPTION WHEN check_violation THEN NULL; END; END $$;
UPDATE stock_count SET status = 'valide', validated_by = '00000000-0000-0000-0000-00000000bbbb' WHERE ref = 'INV-1';

\echo 'Schéma rh : 15 scénarios OK'

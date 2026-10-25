-- Scénario de vérification du schéma paie (après docs/schema.sql et 06-schema-paie.sql)
SET search_path = paie, compta, public;
\set QUIET on

INSERT INTO compta.tenant (id, name) VALUES ('00000000-0000-0000-0000-000000000001', 'Yiel Group') ON CONFLICT DO NOTHING;
INSERT INTO compta.company (id, tenant_id, name, capital) VALUES ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000001', 'Yiel Group Holding SA', 50000000) ON CONFLICT DO NOTHING;
\set QUIET on
SELECT set_config('app.company_id', '00000000-0000-0000-0000-0000000000c1', false) \g /dev/null
SELECT set_config('app.pay_sensitive', 'on', false);

-- 1. Réglementation datée : SMIG selon la date
DO $$ BEGIN
  ASSERT paie.param_at('CM', 'SMIG', NULL, '2023-12-31') = 41875, 'SMIG 2023';
  ASSERT paie.param_at('CM', 'SMIG', NULL, '2026-10-31') = 43969, 'SMIG en vigueur';
END $$;
-- surcharge société prioritaire
INSERT INTO param_version (country, code, company_id, valid_from, value, reason, created_by)
VALUES ('CM', 'CNPS_PLAFOND', current_setting('app.company_id')::uuid, '2026-11-01', 800000, 'Test surcharge', 'test');
DO $$ BEGIN
  ASSERT paie.param_at('CM', 'CNPS_PLAFOND', current_setting('app.company_id')::uuid, '2026-10-31') = 750000, 'avant surcharge';
  ASSERT paie.param_at('CM', 'CNPS_PLAFOND', current_setting('app.company_id')::uuid, '2026-11-30') = 800000, 'après surcharge';
END $$;

-- 2. Version non modifiable
DO $$ BEGIN
  BEGIN UPDATE paie.param_version SET value = 1 WHERE code = 'SMIG'; RAISE EXCEPTION 'KO';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM = 'KO' THEN RAISE; END IF; END;
END $$;

-- 3. Organisation, salarié, période
INSERT INTO establishment (id, company_id, code, label, at_rate) VALUES ('00000000-0000-0000-0000-0000000000e5', current_setting('app.company_id')::uuid, 'DLA', 'Siège Douala', 1.75);
INSERT INTO convention (id, company_id, code, label) VALUES ('00000000-0000-0000-0000-0000000000cc', current_setting('app.company_id')::uuid, 'CC-COM', 'Commerce');
INSERT INTO employee (id, company_id, matricule, last_name, first_name, job_title, establishment_id, convention_id, category, contract, hire_date)
VALUES ('00000000-0000-0000-0000-0000000000a1', current_setting('app.company_id')::uuid, 'YG0001', 'TCHOUMI', 'Paul-Henri', 'DAF',
        '00000000-0000-0000-0000-0000000000e5', '00000000-0000-0000-0000-0000000000cc', '12A', 'CDI', '2019-02-01');
INSERT INTO employee_sensitive (employee_id, company_id, base_salary, iban_rib) VALUES ('00000000-0000-0000-0000-0000000000a1', current_setting('app.company_id')::uuid, 1450000, 'CM21 10005 00001 12345678901 23');

-- 4. CDD sans date de fin refusé
DO $$ BEGIN
  BEGIN
    INSERT INTO paie.employee (company_id, matricule, last_name, first_name, job_title, establishment_id, convention_id, category, contract, hire_date)
    VALUES (current_setting('app.company_id')::uuid, 'YG0002', 'X', 'Y', 'Z', '00000000-0000-0000-0000-0000000000e5', '00000000-0000-0000-0000-0000000000cc', '5', 'CDD', '2026-01-01');
    RAISE EXCEPTION 'KO';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;

INSERT INTO pay_period (id, company_id, pkey, pack_version, submitted_by) VALUES ('00000000-0000-0000-0000-0000000000f1', current_setting('app.company_id')::uuid, '2026-10', 'CM 2026.10', 'B. Ngono');
INSERT INTO payslip (id, period_id, company_id, employee_id, brut, nature, brut_taxable, base_cnps, cot_sal, impots, retenues, net, employer, cost, snapshot)
VALUES ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000f1', current_setting('app.company_id')::uuid, '00000000-0000-0000-0000-0000000000a1',
        2134500, 189500, 2134500, 2084500, 52845, 453212, 0, 1438943, 312000, 2446500, '{}');
INSERT INTO payslip_line (payslip_id, company_id, line_no, code, label, kind, base, gain) VALUES
 ('00000000-0000-0000-0000-0000000000b1', current_setting('app.company_id')::uuid, 1, 'SB', 'Salaire de base', 'gain', 1450000, 1450000);

-- 5. Anomalie bloquante → soumission refusée
INSERT INTO anomaly (period_id, company_id, employee_id, code, level, message) VALUES ('00000000-0000-0000-0000-0000000000f1', current_setting('app.company_id')::uuid, '00000000-0000-0000-0000-0000000000a1', 'B05', 'bloquante', 'CNPS manquant');
DO $$ BEGIN
  BEGIN UPDATE paie.pay_period SET status = 'soumise' WHERE id = '00000000-0000-0000-0000-0000000000f1'; RAISE EXCEPTION 'KO';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM = 'KO' THEN RAISE; END IF; END;
END $$;
DELETE FROM anomaly WHERE code = 'B05';
UPDATE pay_period SET status = 'soumise' WHERE id = '00000000-0000-0000-0000-0000000000f1';

-- 6. Séparation des tâches : le préparateur ne valide pas sa propre paie
DO $$ BEGIN
  BEGIN UPDATE paie.pay_period SET status = 'validee', approved_by = 'B. Ngono' WHERE id = '00000000-0000-0000-0000-0000000000f1'; RAISE EXCEPTION 'KO';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;

-- 7. Télétransmission avant intégration comptable refusée
INSERT INTO declaration (company_id, period_id, organism, amount, due_date) VALUES (current_setting('app.company_id')::uuid, '00000000-0000-0000-0000-0000000000f1', 'CNPS', 650000, '2026-11-15');
DO $$ BEGIN
  BEGIN UPDATE paie.declaration SET status = 'transmise' WHERE organism = 'CNPS'; RAISE EXCEPTION 'KO';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM = 'KO' THEN RAISE; END IF; END;
END $$;

UPDATE pay_period SET status = 'validee', approved_by = 'E. Fouda', batch_ref = 'PAIE-2026-10', hash = repeat('a', 64) WHERE id = '00000000-0000-0000-0000-0000000000f1';
UPDATE declaration SET status = 'transmise', transmitted_by = 'P. Tchoumi' WHERE organism = 'CNPS';

-- 8. Période validée : bulletin gelé, mais signature autorisée une seule fois
DO $$ BEGIN
  BEGIN UPDATE paie.payslip SET net = net + 1, brut = brut + 1 WHERE id = '00000000-0000-0000-0000-0000000000b1'; RAISE EXCEPTION 'KO';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM = 'KO' THEN RAISE; END IF; END;
END $$;
UPDATE payslip SET signed_at = now(), signed_by = 'E. Fouda' WHERE id = '00000000-0000-0000-0000-0000000000b1';
DO $$ BEGIN
  BEGIN UPDATE paie.payslip SET signed_at = now() + interval '1 day' WHERE id = '00000000-0000-0000-0000-0000000000b1'; RAISE EXCEPTION 'KO';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM = 'KO' THEN RAISE; END IF; END;
END $$;

-- 9. Clôture
UPDATE pay_period SET status = 'cloturee', closed_by = 'P. Tchoumi' WHERE id = '00000000-0000-0000-0000-0000000000f1';
DO $$ BEGIN
  BEGIN UPDATE paie.pay_period SET status = 'validee' WHERE pkey = '2026-10'; RAISE EXCEPTION 'KO';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM = 'KO' THEN RAISE; END IF; END;
END $$;

-- 10. Données sensibles : invisibles sans le droit (rôle applicatif non superutilisateur, soumis à la RLS)
DROP ROLE IF EXISTS paie_app_test;
CREATE ROLE paie_app_test;
GRANT USAGE ON SCHEMA paie, compta TO paie_app_test;
GRANT SELECT ON paie.employee_sensitive, paie.employee_public, paie.employee TO paie_app_test;
SET ROLE paie_app_test;
SELECT set_config('app.pay_sensitive', 'off', false);
DO $$ BEGIN ASSERT (SELECT count(*) FROM paie.employee_sensitive) = 0, 'sensible masqué'; ASSERT (SELECT count(*) FROM paie.employee_public) = 1, 'effectif visible'; END $$;
SELECT set_config('app.pay_sensitive', 'on', false);
DO $$ BEGIN ASSERT (SELECT count(*) FROM paie.employee_sensitive) = 1, 'sensible visible'; END $$;
RESET ROLE;
DROP OWNED BY paie_app_test; DROP ROLE paie_app_test;

\echo 'Schéma paie : 10 scénarios OK'

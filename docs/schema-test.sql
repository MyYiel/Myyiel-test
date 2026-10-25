-- Scénario de vérification du schéma (à lancer après schema.sql, en superutilisateur ou propriétaire des tables).
-- psql -v ON_ERROR_STOP=1 -f schema.sql -f schema-test.sql
SET search_path = compta, public;
\set QUIET on

-- Le propriétaire contourne la RLS ; on la force pour vérifier les politiques en fin de script.
INSERT INTO tenant (id, name) VALUES ('00000000-0000-0000-0000-000000000001', 'Yiel Group');
INSERT INTO company (id, tenant_id, name, capital) VALUES ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000001', 'Yiel Group Holding SA', 50000000);
SELECT set_config('app.company_id', '00000000-0000-0000-0000-0000000000c1', false);

INSERT INTO account (company_id, num, label, nature, lettrable) VALUES
 (current_setting('app.company_id')::uuid, '41',   'Clients', 'general', false),
 (current_setting('app.company_id')::uuid, '411',  'Clients', 'general', false),
 (current_setting('app.company_id')::uuid, '4111', 'Clients', 'tiers', true),
 (current_setting('app.company_id')::uuid, '4431', 'TVA collectée', 'general', false),
 (current_setting('app.company_id')::uuid, '7062', 'Services vendus', 'general', false),
 (current_setting('app.company_id')::uuid, '5211', 'Banque principale', 'tresorerie', false);
INSERT INTO journal (company_id, code, label, type, counterpart, seq_format) VALUES
 (current_setting('app.company_id')::uuid, 'VTE', 'Ventes', 'sale', '4111', 'VTE-{YYYY}-{0000}');
INSERT INTO fiscal_year (company_id, year, start_date, end_date) VALUES (current_setting('app.company_id')::uuid, 2026, '2026-01-01', '2026-12-31');
INSERT INTO period (company_id, year, month) SELECT current_setting('app.company_id')::uuid, 2026, m FROM generate_series(1, 12) m;
INSERT INTO third_party (id, company_id, code, type, name, collective) VALUES ('00000000-0000-0000-0000-0000000000a1', current_setting('app.company_id')::uuid, 'C0001', 'client', 'Client test', '4111');

-- 1. Écriture équilibrée : brouillon, lignes, validation avec numéro → OK
BEGIN;
INSERT INTO entry (id, company_id, journal_code, date, label) VALUES ('00000000-0000-0000-0000-0000000000e1', current_setting('app.company_id')::uuid, 'VTE', '2026-10-21', 'Facture FA-2026-0001');
INSERT INTO entry_line (entry_id, company_id, line_no, account_num, debit, credit, third_party_id) VALUES
 ('00000000-0000-0000-0000-0000000000e1', current_setting('app.company_id')::uuid, 1, '4111', 1192500, 0, '00000000-0000-0000-0000-0000000000a1'),
 ('00000000-0000-0000-0000-0000000000e1', current_setting('app.company_id')::uuid, 2, '7062', 0, 1000000, NULL),
 ('00000000-0000-0000-0000-0000000000e1', current_setting('app.company_id')::uuid, 3, '4431', 0, 192500, NULL);
UPDATE entry SET status = 'validated', number = next_entry_number(company_id, journal_code, 2026::smallint), validated_at = now() WHERE id = '00000000-0000-0000-0000-0000000000e1';
COMMIT;
SELECT 'T1 validation + numéro : ' || number FROM entry WHERE id = '00000000-0000-0000-0000-0000000000e1';

-- 2. Écriture déséquilibrée → refus au COMMIT (RG-E02)
DO $$ BEGIN
  BEGIN
    INSERT INTO entry (id, company_id, journal_code, date, label) VALUES ('00000000-0000-0000-0000-0000000000e2', current_setting('app.company_id')::uuid, 'VTE', '2026-10-21', 'Déséquilibrée');
    INSERT INTO entry_line (entry_id, company_id, line_no, account_num, debit, credit, third_party_id) VALUES
      ('00000000-0000-0000-0000-0000000000e2', current_setting('app.company_id')::uuid, 1, '4111', 1000, 0, '00000000-0000-0000-0000-0000000000a1'),
      ('00000000-0000-0000-0000-0000000000e2', current_setting('app.company_id')::uuid, 2, '7062', 0, 999, NULL);
    UPDATE entry SET status = 'validated', number = 'X', validated_at = now() WHERE id = '00000000-0000-0000-0000-0000000000e2';
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE NOTICE 'T2 ÉCHEC : déséquilibre accepté';
  EXCEPTION WHEN others THEN RAISE NOTICE 'T2 refus attendu : %', SQLERRM;
  END;
END $$;

-- 3. Modification d'un montant validé → refus (RG-E12)
DO $$ BEGIN
  BEGIN UPDATE entry_line SET debit = 1 WHERE entry_id = '00000000-0000-0000-0000-0000000000e1' AND line_no = 1; RAISE NOTICE 'T3 ÉCHEC';
  EXCEPTION WHEN others THEN RAISE NOTICE 'T3 refus attendu : %', SQLERRM; END;
END $$;

-- 4. Lettrage autorisé après validation
UPDATE entry_line SET letter = 'AA' WHERE entry_id = '00000000-0000-0000-0000-0000000000e1' AND line_no = 1;
SELECT 'T4 lettrage autorisé : ' || letter FROM entry_line WHERE entry_id = '00000000-0000-0000-0000-0000000000e1' AND line_no = 1;

-- 5. Suppression d'une écriture validée → refus
DO $$ BEGIN
  BEGIN DELETE FROM entry WHERE id = '00000000-0000-0000-0000-0000000000e1'; RAISE NOTICE 'T5 ÉCHEC';
  EXCEPTION WHEN others THEN RAISE NOTICE 'T5 refus attendu : %', SQLERRM; END;
END $$;

-- 6. Compte de regroupement (411) → refus à la validation (RG-E05)
DO $$ BEGIN
  BEGIN
    INSERT INTO entry (id, company_id, journal_code, date, label) VALUES ('00000000-0000-0000-0000-0000000000e3', current_setting('app.company_id')::uuid, 'VTE', '2026-10-21', 'Compte de regroupement');
    INSERT INTO entry_line (entry_id, company_id, line_no, account_num, debit, credit) VALUES
      ('00000000-0000-0000-0000-0000000000e3', current_setting('app.company_id')::uuid, 1, '411', 500, 0),
      ('00000000-0000-0000-0000-0000000000e3', current_setting('app.company_id')::uuid, 2, '7062', 0, 500);
    UPDATE entry SET status = 'validated', number = 'Y', validated_at = now() WHERE id = '00000000-0000-0000-0000-0000000000e3';
    RAISE NOTICE 'T6 ÉCHEC';
  EXCEPTION WHEN others THEN RAISE NOTICE 'T6 refus attendu : %', SQLERRM; END;
END $$;

-- 7. Période verrouillée → refus (RG-E09)
UPDATE period SET locked = true WHERE company_id = current_setting('app.company_id')::uuid AND year = 2026 AND month = 9;
DO $$ BEGIN
  BEGIN
    INSERT INTO entry (id, company_id, journal_code, date, label) VALUES ('00000000-0000-0000-0000-0000000000e4', current_setting('app.company_id')::uuid, 'VTE', '2026-09-15', 'Période verrouillée');
    INSERT INTO entry_line (entry_id, company_id, line_no, account_num, debit, credit, third_party_id) VALUES
      ('00000000-0000-0000-0000-0000000000e4', current_setting('app.company_id')::uuid, 1, '4111', 500, 0, '00000000-0000-0000-0000-0000000000a1'),
      ('00000000-0000-0000-0000-0000000000e4', current_setting('app.company_id')::uuid, 2, '7062', 0, 500, NULL);
    UPDATE entry SET status = 'validated', number = 'Z', validated_at = now() WHERE id = '00000000-0000-0000-0000-0000000000e4';
    RAISE NOTICE 'T7 ÉCHEC';
  EXCEPTION WHEN others THEN RAISE NOTICE 'T7 refus attendu : %', SQLERRM; END;
END $$;

-- 8. Piste d'audit chaînée, vérifiable, en ajout seul
INSERT INTO audit_event (company_id, user_name, action, object, detail) VALUES (current_setting('app.company_id')::uuid, 'A. Mbarga', 'Validation', 'VTE-2026-0001', '1 192 500');
INSERT INTO audit_event (company_id, user_name, action, object, detail) VALUES (current_setting('app.company_id')::uuid, 'A. Mbarga', 'Lettrage', '4111', 'AA');
SELECT 'T8 audit intègre : ' || ok FROM verify_audit(current_setting('app.company_id')::uuid);
DO $$ BEGIN
  BEGIN UPDATE audit_event SET detail = 'falsifié'; RAISE NOTICE 'T8b ÉCHEC';
  EXCEPTION WHEN others THEN RAISE NOTICE 'T8b refus attendu : %', SQLERRM; END;
END $$;

-- 9. Balance
SELECT 'T9 balance ' || account_num || ' net ' || closing_net FROM v_trial_balance ORDER BY account_num;

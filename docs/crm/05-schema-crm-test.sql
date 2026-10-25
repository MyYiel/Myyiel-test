-- Scénarios de vérification du schéma crm (après schema.sql et crm/05-schema-crm.sql)
-- psql -v ON_ERROR_STOP=1 -f docs/schema.sql -f docs/crm/05-schema-crm.sql -f docs/crm/05-schema-crm-test.sql
SET search_path = crm, compta, public;
\set QUIET on
\pset tuples_only on
\pset format unaligned
CREATE OR REPLACE FUNCTION pg_temp.must_fail(label text, q text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE q; EXCEPTION WHEN others THEN RAISE NOTICE '% → refus attendu : %', label, SQLERRM; RETURN; END;
  RAISE EXCEPTION '% : ÉCHEC, aucun refus', label;
END $$;

INSERT INTO tenant (id, name) VALUES ('00000000-0000-0000-0000-000000000001', 'Yiel Group');
INSERT INTO company (id, tenant_id, name) VALUES ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000001', 'Yiel Group Holding SA'), ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-000000000001', 'DeyGo SARL');
INSERT INTO app_user (id, email, name) VALUES
 ('00000000-0000-0000-0000-00000000bb20', 'pdg@yielgroup.com', 'PDG'), ('00000000-0000-0000-0000-00000000bb21', 'c.abena@yielgroup.com', 'Resp. commercial'),
 ('00000000-0000-0000-0000-00000000bb22', 'l.mvondo@yielgroup.com', 'Commerciale'), ('00000000-0000-0000-0000-00000000bb24', 'n.edimo@yielgroup.com', 'Marketing'), ('00000000-0000-0000-0000-00000000bb25', 'k.ndzana@yielgroup.com', 'Admin CRM');
SELECT set_config('app.company_id', '00000000-0000-0000-0000-0000000000c1', false) \g /dev/null
INSERT INTO crm_setting (company_id) VALUES (current_setting('app.company_id')::uuid);
INSERT INTO crm_member (company_id, user_id, role, team) VALUES
 (current_setting('app.company_id')::uuid, '00000000-0000-0000-0000-00000000bb20', 'owner', 'Direction'), (current_setting('app.company_id')::uuid, '00000000-0000-0000-0000-00000000bb21', 'sales_manager', 'Grands comptes'),
 (current_setting('app.company_id')::uuid, '00000000-0000-0000-0000-00000000bb22', 'sales', 'Santé & éducation'), (current_setting('app.company_id')::uuid, '00000000-0000-0000-0000-00000000bb24', 'marketing', 'Marketing'), (current_setting('app.company_id')::uuid, '00000000-0000-0000-0000-00000000bb25', 'crm_admin', NULL);

-- 1. Gouvernance des plafonds
SELECT pg_temp.must_fail('T1 plafond de boîte au-delà de la limite du fournisseur', $q$ UPDATE crm.crm_setting SET cap_mailbox_day = 900 $q$);
SELECT pg_temp.must_fail('T1b suspension globale sans motif', $q$ UPDATE crm.crm_setting SET global_stop = true $q$);
SELECT 'T1 MFA exigée : ' || string_agg(role::text, ', ' ORDER BY role) FROM crm_member WHERE mfa_required;

-- 2. Base : provenance, adresses déduites, doublons, historique des coordonnées
INSERT INTO crm_company (id, company_id, ref, legal_name, city, website, sector, size_band, source_type, source_label, collected_at, owner_id, team) VALUES
 ('00000000-0000-0000-0000-00000000cc01', current_setting('app.company_id')::uuid, 'E0001', 'Polyclinique du Wouri', 'Douala', 'https://www.polyclinique-wouri-exemple.cm', 'Santé', '50-249', 'public', 'Site web de l''entreprise', '2026-10-01', '00000000-0000-0000-0000-00000000bb22', 'Santé & éducation');
SELECT pg_temp.must_fail('T2 entreprise en double (même domaine)', $q$ INSERT INTO crm.crm_company (company_id, ref, legal_name, website, source_type, source_label, collected_at) VALUES (current_setting('app.company_id')::uuid, 'E0002', 'Polyclinique Wouri', 'polyclinique-wouri-exemple.cm', 'public', 'x', '2026-10-02') $q$);
SELECT pg_temp.must_fail('T2b entreprise sans provenance', $q$ INSERT INTO crm.crm_company (company_id, ref, legal_name) VALUES (current_setting('app.company_id')::uuid, 'E0003', 'Sans source') $q$);
INSERT INTO crm_contact (id, company_id, ref, crm_company_id, civility, first_name, last_name, job_title, email, email_status, email_confidence, source_type, source_label, collected_at, owner_id, team) VALUES
 ('00000000-0000-0000-0000-00000000dd01', current_setting('app.company_id')::uuid, 'P0001', '00000000-0000-0000-0000-00000000cc01', 'Mme', 'Odette', 'KOUMA', 'DRH', 'o.kouma@polyclinique-wouri-exemple.cm', 'verifie', 95, 'public', 'Site web', '2026-10-01', '00000000-0000-0000-0000-00000000bb22', 'Santé & éducation'),
 ('00000000-0000-0000-0000-00000000dd02', current_setting('app.company_id')::uuid, 'P0002', '00000000-0000-0000-0000-00000000cc01', 'M.', 'Hervé', 'BELLA', 'DAF', 'h.bella@polyclinique-wouri-exemple.cm', 'deduit', 35, 'public', 'Site web', '2026-10-01', '00000000-0000-0000-0000-00000000bb22', 'Santé & éducation'),
 ('00000000-0000-0000-0000-00000000dd03', current_setting('app.company_id')::uuid, 'P0003', '00000000-0000-0000-0000-00000000cc01', 'M.', 'Joseph', 'NDEDI', 'Principal', 'principal@lareussite-exemple.cm', 'verifie', 95, 'public', 'Annuaire', '2026-10-01', '00000000-0000-0000-0000-00000000bb21', 'Grands comptes');
SELECT pg_temp.must_fail('T2c adresse déduite présentée comme fiable', $q$ INSERT INTO crm.crm_contact (company_id, ref, last_name, email, email_status, email_confidence, source_type, source_label, collected_at) VALUES (current_setting('app.company_id')::uuid, 'P0009', 'X', 'x@exemple-test.cm', 'deduit', 90, 'public', 'x', '2026-10-01') $q$);
SELECT pg_temp.must_fail('T2d contact en double (même e-mail, casse différente)', $q$ INSERT INTO crm.crm_contact (company_id, ref, last_name, email, source_type, source_label, collected_at) VALUES (current_setting('app.company_id')::uuid, 'P0010', 'KOUMA', 'O.Kouma@polyclinique-wouri-exemple.cm', 'import', 'salon.csv', '2026-10-20') $q$);
UPDATE crm_contact SET email = 'odette.kouma@polyclinique-wouri-exemple.cm' WHERE ref = 'P0001';
SELECT 'T2 historique des coordonnées : ' || field || ' ' || old_value || ' → ' || new_value FROM crm_contact_history;

-- 3. Pipeline : gagné / perdu, historique
INSERT INTO opportunity (id, company_id, ref, crm_company_id, offer, amount, probability, stage, owner_id) VALUES ('00000000-0000-0000-0000-00000000ee01', current_setting('app.company_id')::uuid, 'OPP-0001', '00000000-0000-0000-0000-00000000cc01', 'myyiel RH & Paie', 7200000, 20, 'contacte', '00000000-0000-0000-0000-00000000bb22');
SELECT pg_temp.must_fail('T3 « Gagné » sans date de signature', $q$ UPDATE crm.opportunity SET stage = 'gagne', probability = 100 WHERE ref = 'OPP-0001' $q$);
SELECT pg_temp.must_fail('T3b « Perdu » sans motif', $q$ UPDATE crm.opportunity SET stage = 'perdu', probability = 0 WHERE ref = 'OPP-0001' $q$);
SELECT pg_temp.must_fail('T3c motif de perte hors liste', $q$ UPDATE crm.opportunity SET stage = 'perdu', probability = 0, lost_reason = 'Météo' WHERE ref = 'OPP-0001' $q$);
UPDATE opportunity SET stage = 'proposition', probability = 60 WHERE ref = 'OPP-0001';
UPDATE opportunity SET stage = 'gagne', probability = 100, signed_at = '2026-10-21' WHERE ref = 'OPP-0001';
SELECT 'T3 historique : ' || string_agg(coalesce(from_stage::text, '∅') || '→' || to_stage, ', ' ORDER BY id) FROM opportunity_stage_history;
SELECT 'T3 cockpit (vue) signé : ' || signed FROM v_signed;

-- 4. Activités
SELECT pg_temp.must_fail('T4 activité sans rattachement', $q$ INSERT INTO crm.activity (company_id, ref, type, title, at) VALUES (current_setting('app.company_id')::uuid, 'A-00001', 'appel', 'Appel', now()) $q$);

-- 5. Délégation et approbation
SELECT pg_temp.must_fail('T5 délégation à l’administrateur technique', $q$ INSERT INTO crm.approval_delegation (company_id, user_id, granted_by) VALUES (current_setting('app.company_id')::uuid, '00000000-0000-0000-0000-00000000bb25', '00000000-0000-0000-0000-00000000bb20') $q$);
SELECT pg_temp.must_fail('T5b délégation accordée par un non-dirigeant', $q$ INSERT INTO crm.approval_delegation (company_id, user_id, granted_by) VALUES (current_setting('app.company_id')::uuid, '00000000-0000-0000-0000-00000000bb21', '00000000-0000-0000-0000-00000000bb24') $q$);
INSERT INTO template (id, company_id, ref, name, current_version) VALUES ('00000000-0000-0000-0000-00000000aa01', current_setting('app.company_id')::uuid, 'M-001', 'RH & Paie · premier contact', 1);
INSERT INTO template_version (template_id, version, subject, body) VALUES ('00000000-0000-0000-0000-00000000aa01', 1, '{{entreprise.nom}} : la paie sans ressaisie', 'Bonjour {{contact.civilite}} {{contact.nom}}, …');
INSERT INTO campaign (id, company_id, ref, name, version, status, starts_on, ends_on, cap_day, created_by) VALUES ('00000000-0000-0000-0000-00000000ca01', current_setting('app.company_id')::uuid, 'CMP-001', 'Santé & éducation', 1, 'brouillon', '2026-10-19', '2026-11-30', 2, '00000000-0000-0000-0000-00000000bb24');
INSERT INTO campaign_step VALUES ('00000000-0000-0000-0000-00000000ca01', 0, '00000000-0000-0000-0000-00000000aa01', 0);
SELECT pg_temp.must_fail('T5c relance sans délai', $q$ INSERT INTO crm.campaign_step VALUES ('00000000-0000-0000-0000-00000000ca01', 1, '00000000-0000-0000-0000-00000000aa01', 0) $q$);
SELECT pg_temp.must_fail('T5d campagne « en cours » sans approbation', $q$ UPDATE crm.campaign SET status = 'en_cours' WHERE ref = 'CMP-001' $q$);
SELECT pg_temp.must_fail('T5e approbation d’une campagne non soumise', $q$ INSERT INTO crm.campaign_approval (company_id, campaign_id, version, approved_by, fingerprint, steps, schedule, caps, volume) VALUES (current_setting('app.company_id')::uuid, '00000000-0000-0000-0000-00000000ca01', 1, '00000000-0000-0000-0000-00000000bb20', 'fp', '[]', '{}', '{}', 0) $q$);
UPDATE campaign SET status = 'attente_pdg' WHERE ref = 'CMP-001';
SELECT pg_temp.must_fail('T5f approbation par le marketing', $q$ INSERT INTO crm.campaign_approval (company_id, campaign_id, version, approved_by, fingerprint, steps, schedule, caps, volume) VALUES (current_setting('app.company_id')::uuid, '00000000-0000-0000-0000-00000000ca01', 1, '00000000-0000-0000-0000-00000000bb24', 'fp', '[]', '{}', '{}', 0) $q$);
SELECT pg_temp.must_fail('T5g approbation par l’administrateur CRM', $q$ INSERT INTO crm.campaign_approval (company_id, campaign_id, version, approved_by, fingerprint, steps, schedule, caps, volume) VALUES (current_setting('app.company_id')::uuid, '00000000-0000-0000-0000-00000000ca01', 1, '00000000-0000-0000-0000-00000000bb25', 'fp', '[]', '{}', '{}', 0) $q$);
SELECT pg_temp.must_fail('T5h responsable commercial sans délégation', $q$ INSERT INTO crm.campaign_approval (company_id, campaign_id, version, approved_by, fingerprint, steps, schedule, caps, volume) VALUES (current_setting('app.company_id')::uuid, '00000000-0000-0000-0000-00000000ca01', 1, '00000000-0000-0000-0000-00000000bb21', 'fp', '[]', '{}', '{}', 0) $q$);
INSERT INTO approval_delegation (company_id, user_id, granted_by, until) VALUES (current_setting('app.company_id')::uuid, '00000000-0000-0000-0000-00000000bb21', '00000000-0000-0000-0000-00000000bb20', current_date + 30);
SELECT 'T5 délégation explicite : ' || crm.can_approve(current_setting('app.company_id')::uuid, '00000000-0000-0000-0000-00000000bb21');
UPDATE approval_delegation SET revoked_at = now();
INSERT INTO campaign_approval (id, company_id, campaign_id, version, approved_by, comment, fingerprint, steps, schedule, caps, volume) VALUES ('00000000-0000-0000-0000-00000000ab01', current_setting('app.company_id')::uuid, '00000000-0000-0000-0000-00000000ca01', 1, '00000000-0000-0000-0000-00000000bb20', 'Périmètre validé', 'fp1', '[{"step":0,"template":"M-001","version":1}]', '{"from":"08:30"}', '{"day":2}', 3);
INSERT INTO campaign_approval_recipient VALUES ('00000000-0000-0000-0000-00000000ab01', '00000000-0000-0000-0000-00000000dd01'), ('00000000-0000-0000-0000-00000000ab01', '00000000-0000-0000-0000-00000000dd03');
UPDATE campaign SET status = 'en_cours', approved_version = 1 WHERE ref = 'CMP-001';
SELECT pg_temp.must_fail('T5i approbation modifiée a posteriori', $q$ UPDATE crm.campaign_approval SET comment = 'modifié' $q$);

-- 6. Envois : périmètre, version, idempotence, plafonds
INSERT INTO send_queue (id, company_id, idem_key, campaign_id, approval_id, step, contact_id, to_email, template_id, template_version, due_at) VALUES
 ('00000000-0000-0000-0000-0000000005a1', current_setting('app.company_id')::uuid, 'CMP-001|0|P0001', '00000000-0000-0000-0000-00000000ca01', '00000000-0000-0000-0000-00000000ab01', 0, '00000000-0000-0000-0000-00000000dd01', 'odette.kouma@polyclinique-wouri-exemple.cm', '00000000-0000-0000-0000-00000000aa01', 1, '2026-10-19 08:30+01'),
 ('00000000-0000-0000-0000-0000000005a2', current_setting('app.company_id')::uuid, 'CMP-001|0|P0002', '00000000-0000-0000-0000-00000000ca01', '00000000-0000-0000-0000-00000000ab01', 0, '00000000-0000-0000-0000-00000000dd02', 'h.bella@polyclinique-wouri-exemple.cm', '00000000-0000-0000-0000-00000000aa01', 1, '2026-10-19 08:30+01'),
 ('00000000-0000-0000-0000-0000000005a3', current_setting('app.company_id')::uuid, 'CMP-001|0|P0003', '00000000-0000-0000-0000-00000000ca01', '00000000-0000-0000-0000-00000000ab01', 0, '00000000-0000-0000-0000-00000000dd03', 'principal@lareussite-exemple.cm', '00000000-0000-0000-0000-00000000aa01', 2, '2026-10-19 08:30+01');
SELECT pg_temp.must_fail('T6 doublon d’envoi (même clé d’idempotence)', $q$ INSERT INTO crm.send_queue (company_id, idem_key, contact_id, to_email, due_at) VALUES (current_setting('app.company_id')::uuid, 'CMP-001|0|P0001', '00000000-0000-0000-0000-00000000dd01', 'x@y.cm', now()) $q$);
UPDATE send_queue SET status = 'envoye', sent_at = '2026-10-19 08:30+01', attempts = 1 WHERE idem_key = 'CMP-001|0|P0001';
SELECT pg_temp.must_fail('T6b destinataire hors du périmètre approuvé', $q$ UPDATE crm.send_queue SET status = 'envoye', sent_at = '2026-10-19 08:31+01' WHERE idem_key = 'CMP-001|0|P0002' $q$);
SELECT pg_temp.must_fail('T6c modèle différent de la version approuvée', $q$ UPDATE crm.send_queue SET status = 'envoye', sent_at = '2026-10-19 08:31+01' WHERE idem_key = 'CMP-001|0|P0003' $q$);
SELECT pg_temp.must_fail('T6d envoi manuel sans approbation rattaché à une campagne', $q$ INSERT INTO crm.send_queue (company_id, idem_key, campaign_id, contact_id, to_email, due_at) VALUES (current_setting('app.company_id')::uuid, 'k-x', '00000000-0000-0000-0000-00000000ca01', '00000000-0000-0000-0000-00000000dd01', 'x@y.cm', now()) $q$);
UPDATE send_queue SET template_version = 1 WHERE idem_key = 'CMP-001|0|P0003';
UPDATE send_queue SET status = 'envoye', sent_at = '2026-10-19 08:31+01' WHERE idem_key = 'CMP-001|0|P0003';
INSERT INTO campaign_approval_recipient VALUES ('00000000-0000-0000-0000-00000000ab01', '00000000-0000-0000-0000-00000000dd02');
SELECT pg_temp.must_fail('T6e plafond journalier de la campagne atteint (2)', $q$ UPDATE crm.send_queue SET status = 'envoye', sent_at = '2026-10-19 09:00+01' WHERE idem_key = 'CMP-001|0|P0002' $q$);
UPDATE crm_setting SET global_stop = true, global_stop_reason = 'Test';
SELECT pg_temp.must_fail('T6f suspension globale', $q$ UPDATE crm.send_queue SET status = 'envoye', sent_at = '2026-10-20 09:00+01' WHERE idem_key = 'CMP-001|0|P0002' $q$);
UPDATE crm_setting SET global_stop = false, global_stop_reason = NULL;
UPDATE campaign SET status = 'suspendue' WHERE ref = 'CMP-001';
SELECT pg_temp.must_fail('T6g arrêt d’urgence', $q$ UPDATE crm.send_queue SET status = 'envoye', sent_at = '2026-10-20 09:00+01' WHERE idem_key = 'CMP-001|0|P0002' $q$);
UPDATE campaign SET status = 'en_cours' WHERE ref = 'CMP-001';

-- 7. Opposition : annulation immédiate et blocage
INSERT INTO send_queue (company_id, idem_key, campaign_id, approval_id, step, contact_id, to_email, template_id, template_version, due_at) VALUES (current_setting('app.company_id')::uuid, 'CMP-001|1|P0003', '00000000-0000-0000-0000-00000000ca01', '00000000-0000-0000-0000-00000000ab01', 1, '00000000-0000-0000-0000-00000000dd03', 'principal@lareussite-exemple.cm', '00000000-0000-0000-0000-00000000aa01', 1, '2026-10-23 08:30+01');
INSERT INTO exclusion (company_id, contact_id, email_hash, reason, source) VALUES (current_setting('app.company_id')::uuid, '00000000-0000-0000-0000-00000000dd03', md5('principal@lareussite-exemple.cm'), 'Désinscription', 'Réponse e-mail');
SELECT 'T7 opposition : relance ' || status || ' (' || reason || '), consentement ' || (SELECT consent_status FROM crm_contact WHERE ref = 'P0003') FROM send_queue WHERE idem_key = 'CMP-001|1|P0003';
SELECT pg_temp.must_fail('T7b envoi vers un contact en opposition', $q$ UPDATE crm.send_queue SET status = 'envoye', sent_at = '2026-10-23 09:00+01' WHERE idem_key = 'CMP-001|1|P0003' $q$);
-- suppression : l'empreinte de l'adresse bloque une réimportation sous une autre fiche
UPDATE crm_contact SET last_name = 'Contact supprimé', first_name = NULL, email = NULL, deleted_at = now() WHERE ref = 'P0003';
INSERT INTO crm_contact (id, company_id, ref, last_name, email, source_type, source_label, collected_at) VALUES ('00000000-0000-0000-0000-00000000dd09', current_setting('app.company_id')::uuid, 'P0099', 'NDEDI', 'PRINCIPAL@lareussite-exemple.cm', 'import', 'salon.csv', '2026-10-25');
SELECT 'T7 réimportation détectée comme exclue : ' || crm.is_excluded(current_setting('app.company_id')::uuid, '00000000-0000-0000-0000-00000000dd09', 'email');

-- 8. Journal en ajout seul, intégrations
INSERT INTO run_log (company_id, idem_key, result, detail) VALUES (current_setting('app.company_id')::uuid, 'CMP-001|0|P0001', 'envoye', 'Accepté');
SELECT pg_temp.must_fail('T8 journal d’exécution modifié', $q$ DELETE FROM crm.run_log $q$);
SELECT pg_temp.must_fail('T8b secret d’intégration en clair', $q$ INSERT INTO crm.integration (company_id, code, label, secret_ref) VALUES (current_setting('app.company_id')::uuid, 'mailbox', 'Boîte', 'ya29.token-en-clair') $q$);
INSERT INTO notification (company_id, dedup_key, type, text, priority) VALUES (current_setting('app.company_id')::uuid, 'rep_1', 'reponse', 'Réponse positive', 'haute');
SELECT pg_temp.must_fail('T8c notification en double (même événement)', $q$ INSERT INTO crm.notification (company_id, dedup_key, type, text) VALUES (current_setting('app.company_id')::uuid, 'rep_1', 'reponse', 'Réponse positive') $q$);

-- 9. Isolation des organisations et périmètre « portefeuille »
DROP ROLE IF EXISTS crm_app_test; CREATE ROLE crm_app_test NOLOGIN; GRANT USAGE ON SCHEMA crm, compta TO crm_app_test; GRANT SELECT ON ALL TABLES IN SCHEMA crm TO crm_app_test;
SET ROLE crm_app_test;
SELECT set_config('app.crm_scope', 'own', false), set_config('app.user_id', '00000000-0000-0000-0000-00000000bb22', false) \g /dev/null
SELECT 'T9 commerciale (portefeuille) : ' || count(*) || ' contact(s) visibles' FROM crm.crm_contact;
SELECT set_config('app.crm_scope', 'all', false) \g /dev/null
SELECT 'T9 direction : ' || count(*) || ' contact(s) visibles' FROM crm.crm_contact;
SELECT set_config('app.company_id', '00000000-0000-0000-0000-0000000000c2', false) \g /dev/null
SELECT 'T9 autre organisation (DeyGo) : ' || count(*) || ' contact(s) visibles' FROM crm.crm_contact;
RESET ROLE;
REVOKE ALL ON ALL TABLES IN SCHEMA crm FROM crm_app_test; REVOKE USAGE ON SCHEMA crm, compta FROM crm_app_test; DROP ROLE crm_app_test;
SELECT 'Schéma crm : tous les scénarios sont passés.';

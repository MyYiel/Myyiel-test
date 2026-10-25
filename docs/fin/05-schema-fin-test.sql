-- Scénarios de vérification du schéma fin (après schema.sql, paie/06-schema-paie.sql, fin/05-schema-fin.sql)
-- psql -v ON_ERROR_STOP=1 -f docs/schema.sql -f docs/paie/06-schema-paie.sql -f docs/fin/05-schema-fin.sql -f docs/fin/05-schema-fin-test.sql
-- Chaque refus attendu est affiché en NOTICE ; un refus manquant arrête le script (ON_ERROR_STOP).
SET search_path = fin, compta, public;
\set QUIET on
\pset tuples_only on
\pset format unaligned
CREATE OR REPLACE FUNCTION pg_temp.must_fail(label text, q text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE q; EXCEPTION WHEN others THEN RAISE NOTICE '% → refus attendu : %', label, SQLERRM; RETURN; END;
  RAISE EXCEPTION '% : ÉCHEC, aucun refus', label;
END $$;

-- ------------------------------------------------------------- données de base
INSERT INTO tenant (id, name) VALUES ('00000000-0000-0000-0000-000000000001', 'Yiel Group') ON CONFLICT DO NOTHING;
INSERT INTO company (id, tenant_id, name, capital) VALUES ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000001', 'Yiel Group Holding SA', 50000000) ON CONFLICT DO NOTHING;
SELECT set_config('app.company_id', '00000000-0000-0000-0000-0000000000c1', false) \g /dev/null
INSERT INTO app_user (id, email, name) VALUES
 ('00000000-0000-0000-0000-00000000aa02', 'comptable@exemple.cm', 'A. Mbarga'),
 ('00000000-0000-0000-0000-00000000aa07', 'daf@exemple.cm', 'P. Tchoumi'),
 ('00000000-0000-0000-0000-00000000aa01', 'dg@exemple.cm', 'S. Nkomane');
INSERT INTO account (company_id, num, label, nature, lettrable) VALUES
 (current_setting('app.company_id')::uuid, '4011', 'Fournisseurs', 'tiers', true),
 (current_setting('app.company_id')::uuid, '4111', 'Clients', 'tiers', true),
 (current_setting('app.company_id')::uuid, '5211', 'Banque principale', 'tresorerie', false),
 (current_setting('app.company_id')::uuid, '5521', 'MTN Mobile Money', 'tresorerie', false),
 (current_setting('app.company_id')::uuid, '605', 'Autres achats', 'general', false);
INSERT INTO journal (company_id, code, label, type, counterpart, seq_format) VALUES
 (current_setting('app.company_id')::uuid, 'ACH', 'Achats', 'purchase', '4011', 'ACH-{YYYY}-{0000}'),
 (current_setting('app.company_id')::uuid, 'BQ1', 'Banque principale', 'bank', '5211', 'BQ1-{YYYY}-{0000}'),
 (current_setting('app.company_id')::uuid, 'MTN', 'MTN Mobile Money', 'bank', '5521', 'MTN-{YYYY}-{0000}');
INSERT INTO fiscal_year (company_id, year, start_date, end_date) VALUES (current_setting('app.company_id')::uuid, 2026, '2026-01-01', '2026-12-31');
INSERT INTO period (company_id, year, month) SELECT current_setting('app.company_id')::uuid, 2026, m FROM generate_series(1, 12) m;
INSERT INTO third_party (id, company_id, code, type, name, collective) VALUES
 ('00000000-0000-0000-0000-0000000000f2', current_setting('app.company_id')::uuid, 'F0002', 'fournisseur', 'Douala Informatique Services', '4011'),
 ('00000000-0000-0000-0000-0000000000f8', current_setting('app.company_id')::uuid, 'F0008', 'fournisseur', 'Imprimerie du Wouri', '4011'),
 ('00000000-0000-0000-0000-0000000000c5', current_setting('app.company_id')::uuid, 'C0005', 'client', 'Cabinet Ngono & Associés', '4111');
INSERT INTO fin_setting (company_id) VALUES (current_setting('app.company_id')::uuid);
INSERT INTO cash_account (id, company_id, label, kind, account_num, journal_code) VALUES
 ('00000000-0000-0000-0000-0000000000b1', current_setting('app.company_id')::uuid, 'Banque principale', 'bank', '5211', 'BQ1'),
 ('00000000-0000-0000-0000-0000000000b2', current_setting('app.company_id')::uuid, 'MTN MoMo marchand', 'momo', '5521', 'MTN');
INSERT INTO sales_document (id, company_id, type, number, status, third_party_id, date, due_date) VALUES
 ('00000000-0000-0000-0000-0000000000d1', current_setting('app.company_id')::uuid, 'FA', 'FA-2026-0067', 'emitted', '00000000-0000-0000-0000-0000000000c5', '2026-10-21', '2026-11-05');

-- 1. Paramètres honnêtes
SELECT pg_temp.must_fail('T1 mode fiscal sans homologation', $q$ UPDATE fin.fin_setting SET compliance_mode = 'fiscale' $q$);
SELECT pg_temp.must_fail('T1b prestataire « production » sans identifiant marchand', $q$ INSERT INTO fin.payment_provider (company_id, code, state) VALUES (current_setting('app.company_id')::uuid, 'mtn', 'production') $q$);
SELECT pg_temp.must_fail('T1c délai de carence < 24 h', $q$ UPDATE fin.fin_setting SET cooling_hours = 2 $q$);
INSERT INTO payment_provider (company_id, code, state) VALUES (current_setting('app.company_id')::uuid, 'mtn', 'sandbox'), (current_setting('app.company_id')::uuid, 'card', 'indisponible');

-- 2. Fiche fournisseur validée par une autre personne que son créateur
SELECT pg_temp.must_fail('T2 fiche validée par son créateur', $q$ INSERT INTO fin.party_profile (third_party_id, company_id, status, created_by, validated_by, validated_at) VALUES ('00000000-0000-0000-0000-0000000000f8', current_setting('app.company_id')::uuid, 'actif', '00000000-0000-0000-0000-00000000aa02', '00000000-0000-0000-0000-00000000aa02', now()) $q$);
INSERT INTO party_profile (third_party_id, company_id, status, created_by, validated_by, validated_at, email_domain) VALUES
 ('00000000-0000-0000-0000-0000000000f2', current_setting('app.company_id')::uuid, 'actif', '00000000-0000-0000-0000-00000000aa02', '00000000-0000-0000-0000-00000000aa07', now(), 'douala-informatique-exemple.cm'),
 ('00000000-0000-0000-0000-0000000000f8', current_setting('app.company_id')::uuid, 'actif', '00000000-0000-0000-0000-00000000aa02', '00000000-0000-0000-0000-00000000aa07', now(), 'imprimerie-wouri-exemple.cm');
INSERT INTO party_contact (id, company_id, third_party_id, name, phone, is_main, created_at) VALUES
 ('00000000-0000-0000-0000-0000000001c2', current_setting('app.company_id')::uuid, '00000000-0000-0000-0000-0000000000f2', 'M. ESSOMBA Roger', '+237 6 00 00 12 01', true, '2026-01-10'),
 ('00000000-0000-0000-0000-0000000001c8', current_setting('app.company_id')::uuid, '00000000-0000-0000-0000-0000000000f8', 'M. ETOUNDI', '+237 6 00 00 20 02', true, '2026-01-10');
SELECT pg_temp.must_fail('T2b deux contacts principaux', $q$ INSERT INTO fin.party_contact (company_id, third_party_id, name, is_main) VALUES (current_setting('app.company_id')::uuid, '00000000-0000-0000-0000-0000000000f8', 'Autre', true) $q$);

-- 3. Changement de coordonnées : quarantaine, séparation des tâches, rappel obligatoire
INSERT INTO bank_change_request (id, company_id, ref, third_party_id, account, momo, operator, source, sender_email, requested_by, requested_at) VALUES
 ('00000000-0000-0000-0000-000000000c01', current_setting('app.company_id')::uuid, 'CHG-0001', '00000000-0000-0000-0000-0000000000f2', NULL, '+237 6 00 11 22 33', 'MTN', 'E-mail', 'compta@douala-informatiques-exemple.cm', '00000000-0000-0000-0000-00000000aa02', '2026-10-21 08:14+01'),
 ('00000000-0000-0000-0000-000000000c02', current_setting('app.company_id')::uuid, 'CHG-0002', '00000000-0000-0000-0000-0000000000f8', 'CM21 10005 00010 09876543210 77', NULL, NULL, 'Courrier signé', NULL, '00000000-0000-0000-0000-00000000aa02', '2026-10-20 15:40+01');
SELECT pg_temp.must_fail('T3 confirmation par la personne qui a saisi', $q$ UPDATE fin.bank_change_request SET status = 'confirme', callback_contact = '00000000-0000-0000-0000-0000000001c8', decision_by = '00000000-0000-0000-0000-00000000aa02', decision_at = now(), decision_comment = 'ok' WHERE ref = 'CHG-0002' $q$);
SELECT pg_temp.must_fail('T3b confirmation sans rappel', $q$ UPDATE fin.bank_change_request SET status = 'confirme', decision_by = '00000000-0000-0000-0000-00000000aa07', decision_at = now(), decision_comment = 'ok' WHERE ref = 'CHG-0002' $q$);
SELECT pg_temp.must_fail('T3c coordonnées « vérifiées » sans demande confirmée', $q$ INSERT INTO fin.party_bank (company_id, third_party_id, account, status, verified_by, verified_at, available_from) VALUES (current_setting('app.company_id')::uuid, '00000000-0000-0000-0000-0000000000f8', 'CM21 10005 00010 09876543210 77', 'verifie', '00000000-0000-0000-0000-00000000aa07', now(), now() + interval '48 hours') $q$);

-- 4. Refus d'une usurpation → liste de vigilance alimentée automatiquement
UPDATE bank_change_request SET status = 'refuse', decision_by = '00000000-0000-0000-0000-00000000aa07', decision_at = now(), decision_comment = 'Le fournisseur n''a rien demandé' WHERE ref = 'CHG-0001';
SELECT 'T4 vigilance après refus : ' || string_agg(kind || ' ' || value, ', ' ORDER BY kind) FROM watch_entry;
SELECT pg_temp.must_fail('T4b doublon dans la liste de vigilance', $q$ INSERT INTO fin.watch_entry (company_id, kind, value, norm_key, reason, source) VALUES (current_setting('app.company_id')::uuid, 'momo', '237600112233', fin.norm_key('momo', '237600112233'), 'x', 'test') $q$);

-- 5. Confirmation régulière : rappel d'un contact antérieur, autre personne, carence imposée
UPDATE bank_change_request SET status = 'confirme', callback_contact = '00000000-0000-0000-0000-0000000001c8', decision_by = '00000000-0000-0000-0000-00000000aa07', decision_at = now(), decision_comment = 'Rappel de M. ETOUNDI au numéro du référentiel' WHERE ref = 'CHG-0002';
SELECT pg_temp.must_fail('T5 carence non respectée', $q$ INSERT INTO fin.party_bank (company_id, third_party_id, account, status, change_request_id, verified_by, verified_at, available_from) VALUES (current_setting('app.company_id')::uuid, '00000000-0000-0000-0000-0000000000f8', 'CM21 10005 00010 09876543210 77', 'verifie', '00000000-0000-0000-0000-000000000c02', '00000000-0000-0000-0000-00000000aa07', now(), now() + interval '2 hours') $q$);
SELECT pg_temp.must_fail('T5b compte différent de la demande', $q$ INSERT INTO fin.party_bank (company_id, third_party_id, account, status, change_request_id, verified_by, verified_at, available_from) VALUES (current_setting('app.company_id')::uuid, '00000000-0000-0000-0000-0000000000f8', 'CM21 99999 00010 09876543210 77', 'verifie', '00000000-0000-0000-0000-000000000c02', '00000000-0000-0000-0000-00000000aa07', now(), now() + interval '48 hours') $q$);
INSERT INTO party_bank (id, company_id, third_party_id, bank_name, account, status, is_main, change_request_id, verified_by, verified_at, available_from, first_payment_cap) VALUES
 ('00000000-0000-0000-0000-0000000b0008', current_setting('app.company_id')::uuid, '00000000-0000-0000-0000-0000000000f8', 'Banque exemple', 'CM21 10005 00010 09876543210 77', 'verifie', true, '00000000-0000-0000-0000-000000000c02', '00000000-0000-0000-0000-00000000aa07', now(), now() + interval '48 hours', 500000);
SELECT 'T5 coordonnées vérifiées, utilisables le ' || to_char(available_from, 'DD/MM HH24:MI') FROM party_bank WHERE id = '00000000-0000-0000-0000-0000000b0008';
-- contact créé après la demande : refusé (un fraudeur ajoute « son » contact puis le rappelle)
INSERT INTO party_contact (id, company_id, third_party_id, name, phone, created_at) VALUES ('00000000-0000-0000-0000-0000000001c9', current_setting('app.company_id')::uuid, '00000000-0000-0000-0000-0000000000f2', 'Nouveau contact', '+237 6 00 99 88 77', '2026-10-21 09:00+01');
INSERT INTO bank_change_request (id, company_id, ref, third_party_id, account, source, requested_by, requested_at, status, callback_contact, decision_by, decision_at, decision_comment) VALUES
 ('00000000-0000-0000-0000-000000000c03', current_setting('app.company_id')::uuid, 'CHG-0003', '00000000-0000-0000-0000-0000000000f2', 'CM21 10033 05202 11112222333 01', 'WhatsApp', '00000000-0000-0000-0000-00000000aa02', '2026-10-21 08:30+01', 'confirme', '00000000-0000-0000-0000-0000000001c9', '00000000-0000-0000-0000-00000000aa07', now(), 'rappel');
SELECT pg_temp.must_fail('T5c rappel d''un contact ajouté après la demande', $q$ INSERT INTO fin.party_bank (company_id, third_party_id, account, status, change_request_id, verified_by, verified_at, available_from) VALUES (current_setting('app.company_id')::uuid, '00000000-0000-0000-0000-0000000000f2', 'CM21 10033 05202 11112222333 01', 'verifie', '00000000-0000-0000-0000-000000000c03', '00000000-0000-0000-0000-00000000aa07', now(), now() + interval '48 hours') $q$);

-- 6. Encaissement en ligne : signature, montant, idempotence, un seul encaissement
INSERT INTO pay_link (id, company_id, document_id, token, check_code, methods, expires_at) VALUES ('00000000-0000-0000-0000-0000000001a1', current_setting('app.company_id')::uuid, '00000000-0000-0000-0000-0000000000d1', 'PAE7F6539XYZ01', 'F47640', '{momo,om,bank}', now() + interval '30 days');
SELECT pg_temp.must_fail('T6 deux liens actifs pour une facture', $q$ INSERT INTO fin.pay_link (company_id, document_id, token, check_code, methods, expires_at) VALUES (current_setting('app.company_id')::uuid, '00000000-0000-0000-0000-0000000000d1', 'PAUTRELIEN0001', 'X', '{momo}', now() + interval '1 day') $q$);
INSERT INTO pay_tx (id, company_id, ref, link_id, document_id, method, provider, provider_ref, amount, fee, payer_phone) VALUES ('00000000-0000-0000-0000-0000000007a1', current_setting('app.company_id')::uuid, 'TX-000101', '00000000-0000-0000-0000-0000000001a1', '00000000-0000-0000-0000-0000000000d1', 'momo', 'mtn', '7712345678', 1000000, 10000, '+237 6 99 00 00 02');
INSERT INTO payment (id, company_id, document_id, date, method, amount, fees, ext_ref) VALUES ('00000000-0000-0000-0000-0000000009a1', current_setting('app.company_id')::uuid, '00000000-0000-0000-0000-0000000000d1', '2026-10-21', 'momo', 1000000, 10000, '7712345678');
SELECT pg_temp.must_fail('T6b confirmée sans notification', $q$ UPDATE fin.pay_tx SET status = 'confirmee', payment_id = '00000000-0000-0000-0000-0000000009a1', confirmed_at = now() WHERE ref = 'TX-000101' $q$);
INSERT INTO provider_event (company_id, provider, provider_ref, announced, amount, signature_ok, payload) VALUES (current_setting('app.company_id')::uuid, 'mtn', '7712345678', 'SUCCESSFUL', 1000000, false, '{"signature": "deadbeef"}');
SELECT pg_temp.must_fail('T6c confirmée sur notification falsifiée', $q$ UPDATE fin.pay_tx SET status = 'confirmee', payment_id = '00000000-0000-0000-0000-0000000009a1', confirmed_at = now() WHERE ref = 'TX-000101' $q$);
INSERT INTO provider_event (company_id, provider, provider_ref, announced, amount, signature_ok, payload) VALUES (current_setting('app.company_id')::uuid, 'mtn', '7712345678', 'SUCCESSFUL', 999990, true, '{"ok": 1}');
SELECT pg_temp.must_fail('T6d confirmée avec un montant différent', $q$ UPDATE fin.pay_tx SET status = 'confirmee', payment_id = '00000000-0000-0000-0000-0000000009a1', confirmed_at = now() WHERE ref = 'TX-000101' $q$);
DELETE FROM provider_event WHERE amount = 999990;
INSERT INTO provider_event (company_id, provider, provider_ref, announced, amount, signature_ok, payload, processed) VALUES (current_setting('app.company_id')::uuid, 'mtn', '7712345678', 'SUCCESSFUL', 1000000, true, '{"ok": 1}', true);
UPDATE pay_tx SET status = 'confirmee', payment_id = '00000000-0000-0000-0000-0000000009a1', confirmed_at = now() WHERE ref = 'TX-000101';
SELECT 'T6 transaction confirmée : ' || status FROM pay_tx WHERE ref = 'TX-000101';
SELECT pg_temp.must_fail('T6e notification rejouée', $q$ INSERT INTO fin.provider_event (company_id, provider, provider_ref, announced, amount, signature_ok, payload) VALUES (current_setting('app.company_id')::uuid, 'mtn', '7712345678', 'SUCCESSFUL', 1000000, true, '{"ok": 1}') $q$);
SELECT pg_temp.must_fail('T6f second encaissement comptable pour la même référence', $q$ INSERT INTO compta.payment (company_id, document_id, date, method, amount, ext_ref) VALUES (current_setting('app.company_id')::uuid, '00000000-0000-0000-0000-0000000000d1', '2026-10-21', 'momo', 1000000, '7712345678') $q$);
SELECT pg_temp.must_fail('T6g statut confirmé définitif', $q$ UPDATE fin.pay_tx SET status = 'echouee', payment_id = NULL, confirmed_at = NULL WHERE ref = 'TX-000101' $q$);

-- 7. Justificatif déclaré : jamais payé sur capture seule ; une ligne de relevé ne sert qu'une fois
INSERT INTO bank_transaction (id, cash_account_id, company_id, date, label, ref, amount, dedup_key) VALUES ('00000000-0000-0000-0000-0000000005b1', '00000000-0000-0000-0000-0000000000b1', current_setting('app.company_id')::uuid, '2026-10-20', 'VIR CLINIQUE BONAMOUSSADI', 'VIR 4471', 62000, 'k1');
INSERT INTO payment (id, company_id, document_id, date, method, amount, ext_ref) VALUES ('00000000-0000-0000-0000-0000000009a2', current_setting('app.company_id')::uuid, '00000000-0000-0000-0000-0000000000d1', '2026-10-20', 'bank', 62000, 'VIR 4471');
INSERT INTO payment_proof (id, company_id, document_id, method, ref, amount, sms_text, status) VALUES
 ('00000000-0000-0000-0000-0000000006f1', current_setting('app.company_id')::uuid, '00000000-0000-0000-0000-0000000000d1', 'om', '12345', 450000, 'Orang Money: renvoyer les frais de deblocage', 'falsifie'),
 ('00000000-0000-0000-0000-0000000006f2', current_setting('app.company_id')::uuid, '00000000-0000-0000-0000-0000000000d1', 'bank', 'VIR 4471', 62000, NULL, 'a_verifier'),
 ('00000000-0000-0000-0000-0000000006f3', current_setting('app.company_id')::uuid, '00000000-0000-0000-0000-0000000000d1', 'bank', 'VIR 4471', 62000, NULL, 'a_verifier');
SELECT pg_temp.must_fail('T7 justificatif confirmé sans ligne de relevé', $q$ UPDATE fin.payment_proof SET status = 'confirme', payment_id = '00000000-0000-0000-0000-0000000009a2' WHERE id = '00000000-0000-0000-0000-0000000006f1' $q$);
UPDATE payment_proof SET status = 'confirme', bank_transaction_id = '00000000-0000-0000-0000-0000000005b1', payment_id = '00000000-0000-0000-0000-0000000009a2' WHERE id = '00000000-0000-0000-0000-0000000006f2';
SELECT pg_temp.must_fail('T7b même ligne de relevé pour un second justificatif', $q$ UPDATE fin.payment_proof SET status = 'confirme', bank_transaction_id = '00000000-0000-0000-0000-0000000005b1', payment_id = '00000000-0000-0000-0000-0000000009a2' WHERE id = '00000000-0000-0000-0000-0000000006f3' $q$);

-- 8. Facture fournisseur comptabilisée une seule fois
INSERT INTO entry (id, company_id, journal_code, date, label) VALUES ('00000000-0000-0000-0000-0000000000e8', current_setting('app.company_id')::uuid, 'ACH', '2026-10-19', 'Facture BPA-2026-311');
INSERT INTO inbox_document (company_id, ref, source, sender, extracted, third_party_id, status, entry_id, decided_by) VALUES (current_setting('app.company_id')::uuid, 'IN-0001', 'email', 'ventes@imprimerie-wouri-exemple.cm', '{"invoiceNo": "IW-2026-412", "ttc": 1729125}', '00000000-0000-0000-0000-0000000000f8', 'comptabilisee', '00000000-0000-0000-0000-0000000000e8', '00000000-0000-0000-0000-00000000aa02');
SELECT pg_temp.must_fail('T8 même facture comptabilisée deux fois (numéro avec espace)', $q$ INSERT INTO fin.inbox_document (company_id, ref, source, extracted, third_party_id, status, entry_id) VALUES (current_setting('app.company_id')::uuid, 'IN-0002', 'whatsapp', '{"invoiceNo": "IW-2026- 412"}', '00000000-0000-0000-0000-0000000000f8', 'comptabilisee', '00000000-0000-0000-0000-0000000000e8') $q$);
SELECT pg_temp.must_fail('T8b fraude signalée sans motif', $q$ INSERT INTO fin.inbox_document (company_id, ref, source, extracted, status) VALUES (current_setting('app.company_id')::uuid, 'IN-0004', 'email', '{"supplier": "Douala Informatiques Services"}', 'fraude') $q$);
SELECT pg_temp.must_fail('T8c comptabilisée sans écriture', $q$ INSERT INTO fin.inbox_document (company_id, ref, source, extracted, third_party_id, status) VALUES (current_setting('app.company_id')::uuid, 'IN-0005', 'depot', '{}', '00000000-0000-0000-0000-0000000000f8', 'comptabilisee') $q$);

-- 9. Paiement fournisseur : approbations distinctes, exécution contrôlée
INSERT INTO payment_proposal (id, company_id, ref, third_party_id, party_bank_id, method, amount, motif, risk_score, required, prepared_by) VALUES
 ('00000000-0000-0000-0000-0000000008a1', current_setting('app.company_id')::uuid, 'PAY-2026-0006', '00000000-0000-0000-0000-0000000000f8', '00000000-0000-0000-0000-0000000b0008', 'bank', 1729125, 'Règlement IW-2026-412', 45, 2, '00000000-0000-0000-0000-00000000aa02');
SELECT pg_temp.must_fail('T9 approbation par le préparateur', $q$ INSERT INTO fin.payment_approval (proposal_id, company_id, approver, comment) VALUES ('00000000-0000-0000-0000-0000000008a1', current_setting('app.company_id')::uuid, '00000000-0000-0000-0000-00000000aa02', 'ok') $q$);
SELECT pg_temp.must_fail('T9b paiement à risque approuvé sans commentaire', $q$ INSERT INTO fin.payment_approval (proposal_id, company_id, approver) VALUES ('00000000-0000-0000-0000-0000000008a1', current_setting('app.company_id')::uuid, '00000000-0000-0000-0000-00000000aa07') $q$);
INSERT INTO payment_approval (proposal_id, company_id, approver, comment) VALUES ('00000000-0000-0000-0000-0000000008a1', current_setting('app.company_id')::uuid, '00000000-0000-0000-0000-00000000aa07', 'Rappel fournisseur fait');
SELECT pg_temp.must_fail('T9c double approbation par la même personne', $q$ INSERT INTO fin.payment_approval (proposal_id, company_id, approver, comment) VALUES ('00000000-0000-0000-0000-0000000008a1', current_setting('app.company_id')::uuid, '00000000-0000-0000-0000-00000000aa07', 'encore') $q$);
SELECT pg_temp.must_fail('T9d « approuvée » avec 1 approbation sur 2', $q$ UPDATE fin.payment_proposal SET status = 'approuvee' WHERE ref = 'PAY-2026-0006' $q$);
INSERT INTO payment_approval (proposal_id, company_id, approver, comment) VALUES ('00000000-0000-0000-0000-0000000008a1', current_setting('app.company_id')::uuid, '00000000-0000-0000-0000-00000000aa01', 'Validé DG');
UPDATE payment_proposal SET status = 'approuvee' WHERE ref = 'PAY-2026-0006';
SELECT pg_temp.must_fail('T9e exécution par le préparateur', $q$ UPDATE fin.payment_proposal SET status = 'executee', executed_by = '00000000-0000-0000-0000-00000000aa02', executed_at = now() WHERE ref = 'PAY-2026-0006' $q$);
SELECT pg_temp.must_fail('T9f exécution pendant le délai de carence', $q$ UPDATE fin.payment_proposal SET status = 'executee', executed_by = '00000000-0000-0000-0000-00000000aa07', executed_at = now() WHERE ref = 'PAY-2026-0006' $q$);
UPDATE party_bank SET available_from = now() - interval '1 hour' WHERE id = '00000000-0000-0000-0000-0000000b0008';
SELECT pg_temp.must_fail('T9g premier paiement au-delà du plafond', $q$ UPDATE fin.payment_proposal SET status = 'executee', executed_by = '00000000-0000-0000-0000-00000000aa07', executed_at = now() WHERE ref = 'PAY-2026-0006' $q$);
UPDATE payment_proposal SET amount = 450000 WHERE ref = 'PAY-2026-0006';
UPDATE payment_proposal SET status = 'executee', executed_by = '00000000-0000-0000-0000-00000000aa07', executed_at = now() WHERE ref = 'PAY-2026-0006';
SELECT 'T9 paiement test exécuté : ' || ref || ' ' || amount FROM payment_proposal WHERE ref = 'PAY-2026-0006';
-- coordonnées mises en vigilance après coup : l'exécution suivante est bloquée
INSERT INTO payment_proposal (id, company_id, ref, third_party_id, party_bank_id, method, amount, motif, required, prepared_by, status) VALUES ('00000000-0000-0000-0000-0000000008a2', current_setting('app.company_id')::uuid, 'PAY-2026-0007', '00000000-0000-0000-0000-0000000000f8', '00000000-0000-0000-0000-0000000b0008', 'bank', 1279125, 'Solde IW-2026-412', 1, '00000000-0000-0000-0000-00000000aa02', 'a_approuver');
INSERT INTO payment_approval (proposal_id, company_id, approver) VALUES ('00000000-0000-0000-0000-0000000008a2', current_setting('app.company_id')::uuid, '00000000-0000-0000-0000-00000000aa07');
UPDATE payment_proposal SET status = 'approuvee' WHERE ref = 'PAY-2026-0007';
INSERT INTO watch_entry (company_id, kind, value, norm_key, reason, source) VALUES (current_setting('app.company_id')::uuid, 'iban', 'CM21 10005 00010 09876543210 77', fin.norm_key('iban', 'CM21 10005 00010 09876543210 77'), 'Compte signalé par la banque', 'Test');
SELECT pg_temp.must_fail('T9h exécution sur coordonnées en vigilance', $q$ UPDATE fin.payment_proposal SET status = 'executee', executed_by = '00000000-0000-0000-0000-00000000aa01', executed_at = now() WHERE ref = 'PAY-2026-0007' $q$);
UPDATE party_profile SET status = 'suspendu' WHERE third_party_id = '00000000-0000-0000-0000-0000000000f8';
SELECT pg_temp.must_fail('T9i exécution vers un fournisseur suspendu', $q$ UPDATE fin.payment_proposal SET status = 'executee', executed_by = '00000000-0000-0000-0000-00000000aa01', executed_at = now() WHERE ref = 'PAY-2026-0007' $q$);

-- 10. Facturation : empreinte figée, niveau fiscal impossible sans homologation, promesse future
INSERT INTO invoice_meta (document_id, company_id, level, seal_hash, sealed_at) VALUES ('00000000-0000-0000-0000-0000000000d1', current_setting('app.company_id')::uuid, 'commerciale', '3c73413d821c', now());
SELECT pg_temp.must_fail('T10 empreinte modifiée après envoi', $q$ UPDATE fin.invoice_meta SET seal_hash = 'autre' WHERE document_id = '00000000-0000-0000-0000-0000000000d1' $q$);
SELECT pg_temp.must_fail('T10b niveau « fiscalement conforme » sans homologation', $q$ UPDATE fin.invoice_meta SET level = 'fiscale' WHERE document_id = '00000000-0000-0000-0000-0000000000d1' $q$);
SELECT pg_temp.must_fail('T10c promesse de paiement dans le passé', $q$ INSERT INTO fin.payment_promise (company_id, document_id, promised_for, amount) VALUES (current_setting('app.company_id')::uuid, '00000000-0000-0000-0000-0000000000d1', '2026-01-01', 1000) $q$);
INSERT INTO payment_promise (company_id, document_id, promised_for, amount, contact) VALUES (current_setting('app.company_id')::uuid, '00000000-0000-0000-0000-0000000000d1', current_date + 7, 1000000, 'Me NGONO');
SELECT pg_temp.must_fail('T10d deux promesses en cours sur la même facture', $q$ INSERT INTO fin.payment_promise (company_id, document_id, promised_for, amount) VALUES (current_setting('app.company_id')::uuid, '00000000-0000-0000-0000-0000000000d1', current_date + 9, 1000) $q$);

-- 11. Isolation des sociétés (RLS) pour un rôle applicatif
DROP ROLE IF EXISTS fin_app_test;
CREATE ROLE fin_app_test NOLOGIN;
GRANT USAGE ON SCHEMA fin, compta TO fin_app_test;
GRANT SELECT ON ALL TABLES IN SCHEMA fin TO fin_app_test;
SET ROLE fin_app_test;
SELECT 'T11 société courante : ' || count(*) || ' entrée(s) de vigilance visibles' FROM fin.watch_entry;
SELECT set_config('app.company_id', '00000000-0000-0000-0000-0000000000c9', false) \g /dev/null
SELECT 'T11 autre société : ' || count(*) || ' entrée(s) visibles' FROM fin.watch_entry;
RESET ROLE;
SELECT set_config('app.company_id', '00000000-0000-0000-0000-0000000000c1', false) \g /dev/null
REVOKE ALL ON ALL TABLES IN SCHEMA fin FROM fin_app_test; REVOKE USAGE ON SCHEMA fin, compta FROM fin_app_test; DROP ROLE fin_app_test;

SELECT 'Schéma fin : tous les scénarios sont passés.';

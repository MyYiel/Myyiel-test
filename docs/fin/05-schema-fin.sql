-- =====================================================================
-- myyiel Module 4 · Trésorerie, facturation et paiements — schéma PostgreSQL de référence (15+)
-- À lancer après docs/schema.sql et docs/paie/06-schema-paie.sql :
-- psql -v ON_ERROR_STOP=1 -f docs/schema.sql -f docs/paie/06-schema-paie.sql -f docs/fin/05-schema-fin.sql -f docs/fin/05-schema-fin-test.sql
-- Règles imposées en base (et pas seulement dans l'interface) :
--  * une notification de prestataire n'est traitée qu'une fois (idempotence) et seulement si sa signature est valide ;
--  * une transaction ne génère qu'un seul encaissement comptable ;
--  * un justificatif déclaré (capture, SMS) ne devient un paiement qu'avec une ligne de relevé, utilisée une seule fois ;
--  * des coordonnées bancaires ne deviennent « vérifiées » que par rappel d'un contact déjà enregistré,
--    confirmé par une autre personne que celle qui a saisi la demande, avec délai de carence ;
--  * un paiement fournisseur n'est exécuté qu'avec le nombre d'approbations requis, par des personnes
--    distinctes du préparateur, sur des coordonnées vérifiées, hors carence et hors liste de vigilance ;
--  * une facture fournisseur n'est comptabilisée qu'une fois (fournisseur + numéro) ;
--  * l'empreinte d'archivage d'une facture envoyée est figée.
-- =====================================================================
SET search_path = compta, public;
DROP SCHEMA IF EXISTS fin CASCADE;
CREATE SCHEMA fin;
SET search_path = fin, compta, public;

CREATE TYPE party_status   AS ENUM ('actif', 'a_valider', 'suspendu');
CREATE TYPE bank_status    AS ENUM ('a_confirmer', 'verifie', 'revoque');
CREATE TYPE change_status  AS ENUM ('quarantaine', 'confirme', 'refuse');
CREATE TYPE watch_kind     AS ENUM ('momo', 'iban', 'phone', 'email', 'domain', 'name');
CREATE TYPE pay_method     AS ENUM ('momo', 'om', 'bank', 'card');
CREATE TYPE provider_code  AS ENUM ('mtn', 'orange', 'bank', 'card');
CREATE TYPE provider_state AS ENUM ('sandbox', 'production', 'import', 'indisponible');
CREATE TYPE tx_status      AS ENUM ('en_attente', 'confirmee', 'echouee', 'ecart', 'rejetee');
CREATE TYPE proof_status   AS ENUM ('a_verifier', 'suspect', 'falsifie', 'confirme', 'rejete');
CREATE TYPE inbox_status   AS ENUM ('a_traiter', 'comptabilisee', 'rejetee', 'doublon', 'fraude');
CREATE TYPE prop_status    AS ENUM ('a_approuver', 'bloquee', 'approuvee', 'executee', 'rejetee', 'annulee');
CREATE TYPE promise_status AS ENUM ('en_cours', 'tenue', 'non_tenue', 'remplacee');
CREATE TYPE compliance     AS ENUM ('commerciale', 'fiscale');

-- -------------------------------------------------------------- paramètres
CREATE TABLE fin_setting (
  company_id         uuid PRIMARY KEY REFERENCES company(id),
  approval_single    bigint NOT NULL DEFAULT 1000000 CHECK (approval_single >= 0),
  approval_double    bigint NOT NULL DEFAULT 5000000,
  risk_review        smallint NOT NULL DEFAULT 40 CHECK (risk_review BETWEEN 1 AND 100),
  risk_block         smallint NOT NULL DEFAULT 70 CHECK (risk_block BETWEEN 1 AND 100),
  cooling_hours      smallint NOT NULL DEFAULT 48 CHECK (cooling_hours >= 24),
  first_payment_cap  bigint NOT NULL DEFAULT 500000,
  min_cash           bigint NOT NULL DEFAULT 0,
  link_days          smallint NOT NULL DEFAULT 30 CHECK (link_days BETWEEN 1 AND 180),
  allow_partial      boolean NOT NULL DEFAULT true,
  compliance_mode    compliance NOT NULL DEFAULT 'commerciale',
  homologation       text,
  CHECK (approval_double >= approval_single),
  CHECK (risk_block > risk_review),
  CHECK (compliance_mode = 'commerciale' OR homologation IS NOT NULL)   -- jamais « fiscale » sans homologation
);
CREATE TABLE payment_provider (
  company_id   uuid NOT NULL REFERENCES company(id),
  code         provider_code NOT NULL,
  state        provider_state NOT NULL DEFAULT 'indisponible',
  merchant_id  text,
  secret_ref   text,                         -- référence du secret dans le coffre (jamais le secret en clair)
  PRIMARY KEY (company_id, code),
  CHECK (state <> 'production' OR (merchant_id IS NOT NULL AND secret_ref IS NOT NULL)),
  CHECK (code <> 'card' OR state <> 'import')
);

-- ---------------------------------------------------- répertoire étendu
CREATE TABLE party_profile (
  third_party_id  uuid PRIMARY KEY REFERENCES third_party(id) ON DELETE CASCADE,
  company_id      uuid NOT NULL REFERENCES company(id),
  trade_name      text, legal_form text, category text, district text, po_box text, website text,
  email_domain    text,
  status          party_status NOT NULL DEFAULT 'a_valider',
  validated_by    uuid REFERENCES app_user(id),
  validated_at    timestamptz,
  created_by      uuid REFERENCES app_user(id),
  pay_modes       text[] NOT NULL DEFAULT '{}',
  CHECK (status <> 'actif' OR validated_by IS NOT NULL),
  CHECK (validated_by IS NULL OR created_by IS NULL OR validated_by <> created_by)   -- validation par une autre personne
);
CREATE TABLE party_contact (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES company(id),
  third_party_id  uuid NOT NULL REFERENCES third_party(id) ON DELETE CASCADE,
  name            text NOT NULL, role text,
  phone           text, whatsapp text, email text,
  is_main         boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX party_contact_main_uq ON party_contact (third_party_id) WHERE is_main;
CREATE TABLE party_address (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES company(id), third_party_id uuid NOT NULL REFERENCES third_party(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'siege' CHECK (kind IN ('siege', 'facturation', 'livraison', 'etablissement')), label text, address text, city text, country text NOT NULL DEFAULT 'Cameroun'
);
CREATE TABLE party_document (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES company(id), third_party_id uuid NOT NULL REFERENCES third_party(id) ON DELETE CASCADE,
  type text NOT NULL, file_key text NOT NULL, valid_until date, uploaded_by uuid REFERENCES app_user(id), uploaded_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE party_evaluation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES company(id), third_party_id uuid NOT NULL REFERENCES third_party(id) ON DELETE CASCADE,
  quality smallint NOT NULL CHECK (quality BETWEEN 1 AND 5), delay smallint NOT NULL CHECK (delay BETWEEN 1 AND 5), price smallint NOT NULL CHECK (price BETWEEN 1 AND 5), comment text,
  by_user uuid REFERENCES app_user(id), at timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------- liste de vigilance
CREATE TABLE watch_entry (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES company(id),
  kind        watch_kind NOT NULL,
  value       text NOT NULL,
  norm_key    text NOT NULL,                 -- chiffres seuls (9 derniers pour un mobile), minuscules pour un domaine
  reason      text NOT NULL CHECK (length(trim(reason)) > 0),
  source      text NOT NULL,
  by_user     uuid REFERENCES app_user(id),
  at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, kind, norm_key)
);
CREATE OR REPLACE FUNCTION norm_key(k watch_kind, v text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN k IN ('momo', 'phone') THEN right(regexp_replace(v, '\D', '', 'g'), 9)
              WHEN k = 'iban' THEN regexp_replace(v, '\D', '', 'g')
              ELSE lower(trim(v)) END $$;
CREATE OR REPLACE FUNCTION on_watch(c uuid, k watch_kind, v text) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT v IS NOT NULL AND EXISTS (SELECT 1 FROM fin.watch_entry w WHERE w.company_id = c AND (w.kind = k OR (k IN ('momo', 'phone') AND w.kind IN ('momo', 'phone'))) AND w.norm_key = fin.norm_key(k, v)) $$;

-- --------------------------------------- coordonnées bancaires sous contrôle
CREATE TABLE bank_change_request (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       uuid NOT NULL REFERENCES company(id),
  ref              text NOT NULL,
  third_party_id   uuid NOT NULL REFERENCES third_party(id),
  bank_name        text, holder text, account text, momo text, operator text CHECK (operator IS NULL OR operator IN ('MTN', 'Orange')),
  source           text NOT NULL,            -- e-mail, WhatsApp, courrier…
  sender_email     text, sender_phone text, message text,
  checks           jsonb NOT NULL DEFAULT '[]',
  status           change_status NOT NULL DEFAULT 'quarantaine',
  requested_by     uuid NOT NULL REFERENCES app_user(id),
  requested_at     timestamptz NOT NULL DEFAULT now(),
  callback_contact uuid REFERENCES party_contact(id),
  decision_by      uuid REFERENCES app_user(id),
  decision_at      timestamptz,
  decision_comment text,
  UNIQUE (company_id, ref),
  CHECK (account IS NOT NULL OR momo IS NOT NULL),
  CHECK (status = 'quarantaine' OR (decision_by IS NOT NULL AND decision_comment IS NOT NULL AND decision_at IS NOT NULL)),
  CHECK (decision_by IS NULL OR decision_by <> requested_by),                       -- séparation des tâches
  CHECK (status <> 'confirme' OR callback_contact IS NOT NULL)                       -- rappel obligatoire
);
CREATE TABLE party_bank (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id         uuid NOT NULL REFERENCES company(id),
  third_party_id     uuid NOT NULL REFERENCES third_party(id) ON DELETE CASCADE,
  bank_name          text, holder text, account text, momo text, operator text,
  status             bank_status NOT NULL DEFAULT 'a_confirmer',
  is_main            boolean NOT NULL DEFAULT false,
  change_request_id  uuid REFERENCES bank_change_request(id),
  verified_by        uuid REFERENCES app_user(id),
  verified_at        timestamptz,
  available_from     timestamptz,             -- fin du délai de carence
  first_payment_cap  bigint,
  source             text NOT NULL DEFAULT 'saisie',
  CHECK (account IS NOT NULL OR momo IS NOT NULL),
  CHECK (status <> 'verifie' OR (verified_by IS NOT NULL AND verified_at IS NOT NULL AND available_from IS NOT NULL))
);
CREATE UNIQUE INDEX party_bank_main_uq ON party_bank (third_party_id) WHERE is_main AND status = 'verifie';
-- Une coordonnée vérifiée provient d'une demande confirmée, par rappel d'un contact créé AVANT la demande, avec carence.
CREATE OR REPLACE FUNCTION trg_bank_verified() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r fin.bank_change_request; s fin.fin_setting; ct fin.party_contact;
BEGIN
  IF NEW.status <> 'verifie' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'verifie' AND OLD.account IS NOT DISTINCT FROM NEW.account AND OLD.momo IS NOT DISTINCT FROM NEW.momo THEN RETURN NEW; END IF;
  SELECT * INTO r FROM fin.bank_change_request WHERE id = NEW.change_request_id;
  IF r.id IS NULL OR r.status <> 'confirme' THEN RAISE EXCEPTION 'Coordonnées vérifiées sans demande confirmée par rappel' USING ERRCODE = 'check_violation'; END IF;
  IF r.third_party_id <> NEW.third_party_id OR r.account IS DISTINCT FROM NEW.account OR r.momo IS DISTINCT FROM NEW.momo THEN RAISE EXCEPTION 'Coordonnées différentes de la demande confirmée' USING ERRCODE = 'check_violation'; END IF;
  SELECT * INTO ct FROM fin.party_contact WHERE id = r.callback_contact;
  IF ct.third_party_id <> NEW.third_party_id OR ct.created_at >= r.requested_at THEN RAISE EXCEPTION 'Le rappel doit viser un contact du référentiel enregistré avant la demande' USING ERRCODE = 'check_violation'; END IF;
  SELECT * INTO s FROM fin.fin_setting WHERE company_id = NEW.company_id;
  IF NEW.available_from < NEW.verified_at + make_interval(hours => COALESCE(s.cooling_hours, 48)) THEN RAISE EXCEPTION 'Délai de carence non respecté' USING ERRCODE = 'check_violation'; END IF;
  IF fin.on_watch(NEW.company_id, 'momo', NEW.momo) OR fin.on_watch(NEW.company_id, 'iban', NEW.account) THEN RAISE EXCEPTION 'Coordonnées dans la liste de vigilance' USING ERRCODE = 'check_violation'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER party_bank_verified BEFORE INSERT OR UPDATE ON party_bank FOR EACH ROW EXECUTE FUNCTION trg_bank_verified();
-- Refus d'une demande : ses coordonnées et le domaine de l'expéditeur entrent dans la liste de vigilance.
CREATE OR REPLACE FUNCTION trg_change_refused() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'refuse' AND OLD.status = 'quarantaine' THEN
    IF NEW.momo IS NOT NULL THEN INSERT INTO fin.watch_entry (company_id, kind, value, norm_key, reason, source, by_user) VALUES (NEW.company_id, 'momo', NEW.momo, fin.norm_key('momo', NEW.momo), 'Usurpation refusée ' || NEW.ref, 'Changement de coordonnées', NEW.decision_by) ON CONFLICT DO NOTHING; END IF;
    IF NEW.account IS NOT NULL THEN INSERT INTO fin.watch_entry (company_id, kind, value, norm_key, reason, source, by_user) VALUES (NEW.company_id, 'iban', NEW.account, fin.norm_key('iban', NEW.account), 'Usurpation refusée ' || NEW.ref, 'Changement de coordonnées', NEW.decision_by) ON CONFLICT DO NOTHING; END IF;
    IF NEW.sender_email LIKE '%@%' THEN INSERT INTO fin.watch_entry (company_id, kind, value, norm_key, reason, source, by_user) VALUES (NEW.company_id, 'domain', split_part(NEW.sender_email, '@', 2), fin.norm_key('domain', split_part(NEW.sender_email, '@', 2)), 'Domaine utilisé pour ' || NEW.ref, 'Changement de coordonnées', NEW.decision_by) ON CONFLICT DO NOTHING; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER bank_change_refused AFTER UPDATE ON bank_change_request FOR EACH ROW EXECUTE FUNCTION trg_change_refused();

-- -------------------------------------------------------- facturation
CREATE TABLE invoice_template (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES company(id), name text NOT NULL,
  base text NOT NULL DEFAULT 'myyiel' CHECK (base IN ('myyiel', 'import')), source_file text, style text NOT NULL DEFAULT 'classique',
  color text NOT NULL DEFAULT '#141A3A', accent text NOT NULL DEFAULT '#F25C2A', zones jsonb NOT NULL DEFAULT '{"groups": false, "pay": true}', show_qr boolean NOT NULL DEFAULT true, footer text,
  is_default boolean NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX invoice_template_default_uq ON invoice_template (company_id) WHERE is_default;
CREATE TABLE invoice_meta (
  document_id  uuid PRIMARY KEY REFERENCES sales_document(id),
  company_id   uuid NOT NULL REFERENCES company(id),
  template_id  uuid REFERENCES invoice_template(id),
  level        text NOT NULL CHECK (level IN ('incomplete', 'commerciale', 'fiscale')),
  seal_hash    text,                          -- empreinte de la forme canonique à l'envoi
  sealed_at    timestamptz,
  viewed_at    timestamptz,
  CHECK ((seal_hash IS NULL) = (sealed_at IS NULL))
);
CREATE OR REPLACE FUNCTION trg_seal_frozen() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.seal_hash IS NOT NULL AND NEW.seal_hash IS DISTINCT FROM OLD.seal_hash THEN RAISE EXCEPTION 'Empreinte d''archivage figée' USING ERRCODE = 'check_violation'; END IF;
  IF NEW.level = 'fiscale' AND NOT EXISTS (SELECT 1 FROM fin.fin_setting s WHERE s.company_id = NEW.company_id AND s.compliance_mode = 'fiscale' AND s.homologation IS NOT NULL) THEN RAISE EXCEPTION 'Niveau fiscal sans homologation' USING ERRCODE = 'check_violation'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER invoice_meta_seal BEFORE INSERT OR UPDATE ON invoice_meta FOR EACH ROW EXECUTE FUNCTION trg_seal_frozen();
CREATE TABLE invoice_event (
  id bigserial PRIMARY KEY, company_id uuid NOT NULL REFERENCES company(id), document_id uuid NOT NULL REFERENCES sales_document(id),
  type text NOT NULL, text text, channel text, by_user uuid REFERENCES app_user(id), at timestamptz NOT NULL DEFAULT now()
);

-- -------------------------------------------- encaissements en ligne
CREATE TABLE pay_link (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid NOT NULL REFERENCES company(id),
  document_id  uuid NOT NULL REFERENCES sales_document(id),
  token        text NOT NULL UNIQUE CHECK (length(token) >= 12),
  check_code   text NOT NULL,
  methods      pay_method[] NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  status       text NOT NULL DEFAULT 'actif' CHECK (status IN ('actif', 'solde', 'expire', 'revoque')),
  views        integer NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX pay_link_active_uq ON pay_link (document_id) WHERE status = 'actif';
CREATE TABLE pay_tx (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES company(id),
  ref           text NOT NULL,
  link_id       uuid NOT NULL REFERENCES pay_link(id),
  document_id   uuid NOT NULL REFERENCES sales_document(id),
  method        pay_method NOT NULL,
  provider      provider_code NOT NULL,
  provider_ref  text NOT NULL,
  amount        bigint NOT NULL CHECK (amount > 0),
  fee           bigint NOT NULL DEFAULT 0 CHECK (fee >= 0),
  payer_phone   text,
  status        tx_status NOT NULL DEFAULT 'en_attente',
  payment_id    uuid UNIQUE REFERENCES payment(id),   -- un seul encaissement par transaction
  created_at    timestamptz NOT NULL DEFAULT now(),
  confirmed_at  timestamptz,
  UNIQUE (company_id, ref),
  UNIQUE (provider, provider_ref),
  CHECK (status <> 'confirmee' OR (payment_id IS NOT NULL AND confirmed_at IS NOT NULL)),
  CHECK (payment_id IS NULL OR status = 'confirmee')
);
-- Journal brut des notifications reçues : idempotence par (prestataire, référence, statut annoncé).
CREATE TABLE provider_event (
  id            bigserial PRIMARY KEY,
  company_id    uuid NOT NULL REFERENCES company(id),
  provider      provider_code NOT NULL,
  provider_ref  text NOT NULL,
  announced     text NOT NULL,                -- SUCCESSFUL, FAILED…
  amount        bigint,
  signature_ok  boolean NOT NULL,
  payload       jsonb NOT NULL,
  received_at   timestamptz NOT NULL DEFAULT now(),
  processed     boolean NOT NULL DEFAULT false,
  UNIQUE (provider, provider_ref, announced, signature_ok)
);
-- Une transaction ne passe « confirmée » que sur une notification signée, de même montant, déjà journalisée.
CREATE OR REPLACE FUNCTION trg_tx_confirm() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'confirmee' AND (TG_OP = 'INSERT' OR OLD.status <> 'confirmee') THEN
    IF NOT EXISTS (SELECT 1 FROM fin.provider_event e WHERE e.provider = NEW.provider AND e.provider_ref = NEW.provider_ref AND e.announced = 'SUCCESSFUL' AND e.signature_ok AND e.amount = NEW.amount) THEN
      RAISE EXCEPTION 'Confirmation sans notification signée du prestataire pour ce montant' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'confirmee' AND NEW.status <> 'confirmee' THEN RAISE EXCEPTION 'Transaction confirmée : statut définitif' USING ERRCODE = 'check_violation'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER pay_tx_confirm BEFORE INSERT OR UPDATE ON pay_tx FOR EACH ROW EXECUTE FUNCTION trg_tx_confirm();

-- -------------------------------- justificatifs déclarés par les clients
CREATE TABLE payment_proof (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id           uuid NOT NULL REFERENCES company(id),
  document_id          uuid NOT NULL REFERENCES sales_document(id),
  method               pay_method NOT NULL,
  ref                  text,
  amount               bigint NOT NULL CHECK (amount > 0),
  declared_date        date,
  payer                text, payee text, sms_text text, file_key text,
  source               text NOT NULL DEFAULT 'WhatsApp',
  checks               jsonb NOT NULL DEFAULT '[]',
  status               proof_status NOT NULL DEFAULT 'a_verifier',
  bank_transaction_id  uuid UNIQUE REFERENCES bank_transaction(id),   -- une ligne de relevé ne prouve qu'un seul paiement
  payment_id           uuid REFERENCES payment(id),
  decided_by           uuid REFERENCES app_user(id),
  received_at          timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'confirme' OR (bank_transaction_id IS NOT NULL AND payment_id IS NOT NULL))   -- jamais sur capture seule
);

-- ---------------------------------------- boîte de réception fournisseurs
CREATE TABLE inbox_document (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       uuid NOT NULL REFERENCES company(id),
  ref              text NOT NULL,
  source           text NOT NULL CHECK (source IN ('email', 'whatsapp', 'depot', 'scan')),
  sender           text, file_key text,
  extracted        jsonb NOT NULL DEFAULT '{}',   -- supplier, niu, invoiceNo, date, due, ht, tva, ttc, account, momo
  confidence       smallint CHECK (confidence BETWEEN 0 AND 100),
  third_party_id   uuid REFERENCES third_party(id),
  invoice_no       text GENERATED ALWAYS AS (upper(regexp_replace(extracted->>'invoiceNo', '\s', '', 'g'))) STORED,
  checks           jsonb NOT NULL DEFAULT '[]',
  risk             smallint NOT NULL DEFAULT 0 CHECK (risk BETWEEN 0 AND 100),
  status           inbox_status NOT NULL DEFAULT 'a_traiter',
  entry_id         uuid REFERENCES entry(id),
  decided_by       uuid REFERENCES app_user(id),
  decision_comment text,
  override_alerts  boolean NOT NULL DEFAULT false,
  received_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, ref),
  CHECK (status <> 'comptabilisee' OR (entry_id IS NOT NULL AND third_party_id IS NOT NULL)),
  CHECK (status NOT IN ('rejetee', 'fraude') OR decision_comment IS NOT NULL),
  CHECK (NOT override_alerts OR decision_comment IS NOT NULL)
);
CREATE UNIQUE INDEX inbox_once_uq ON inbox_document (company_id, third_party_id, invoice_no) WHERE status = 'comptabilisee' AND invoice_no IS NOT NULL;

-- ---------------------------------------------- paiements fournisseurs
CREATE TABLE payment_proposal (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES company(id),
  ref             text NOT NULL,
  third_party_id  uuid NOT NULL REFERENCES third_party(id),
  party_bank_id   uuid REFERENCES party_bank(id),
  method          text NOT NULL CHECK (method IN ('bank', 'momo', 'om', 'cash', 'cheque')),
  amount          bigint NOT NULL CHECK (amount > 0),
  motif           text NOT NULL,
  risk_score      smallint NOT NULL DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),
  risk_reasons    jsonb NOT NULL DEFAULT '[]',
  required        smallint NOT NULL DEFAULT 1 CHECK (required BETWEEN 1 AND 3),
  status          prop_status NOT NULL DEFAULT 'a_approuver',
  prepared_by     uuid NOT NULL REFERENCES app_user(id),
  prepared_at     timestamptz NOT NULL DEFAULT now(),
  executed_by     uuid REFERENCES app_user(id),
  executed_at     timestamptz,
  bank_ref        text,
  UNIQUE (company_id, ref),
  CHECK (executed_by IS NULL OR executed_by <> prepared_by),
  CHECK (status <> 'executee' OR (executed_by IS NOT NULL AND executed_at IS NOT NULL))
);
CREATE TABLE payment_proposal_item (
  proposal_id    uuid NOT NULL REFERENCES payment_proposal(id) ON DELETE CASCADE,
  entry_line_id  uuid NOT NULL REFERENCES entry_line(id),
  amount         bigint NOT NULL CHECK (amount > 0),
  PRIMARY KEY (proposal_id, entry_line_id)
);
CREATE TABLE payment_approval (
  proposal_id  uuid NOT NULL REFERENCES payment_proposal(id) ON DELETE CASCADE,
  company_id   uuid NOT NULL REFERENCES company(id),
  approver     uuid NOT NULL REFERENCES app_user(id),
  comment      text,
  at           timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (proposal_id, approver)          -- deux approbateurs distincts
);
CREATE OR REPLACE FUNCTION trg_approval() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p fin.payment_proposal;
BEGIN
  SELECT * INTO p FROM fin.payment_proposal WHERE id = NEW.proposal_id;
  IF p.prepared_by = NEW.approver THEN RAISE EXCEPTION 'Le préparateur n''approuve pas son paiement' USING ERRCODE = 'check_violation'; END IF;
  IF p.status NOT IN ('a_approuver') THEN RAISE EXCEPTION 'Proposition non approuvable (statut %)', p.status USING ERRCODE = 'check_violation'; END IF;
  IF p.risk_score >= (SELECT risk_review FROM fin.fin_setting WHERE company_id = p.company_id) AND coalesce(trim(NEW.comment), '') = '' THEN RAISE EXCEPTION 'Commentaire obligatoire sur un paiement à risque' USING ERRCODE = 'check_violation'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER payment_approval_chk BEFORE INSERT ON payment_approval FOR EACH ROW EXECUTE FUNCTION trg_approval();
-- Exécution : approbations suffisantes, coordonnées vérifiées, carence échue, plafond du premier paiement, hors vigilance.
CREATE OR REPLACE FUNCTION trg_execute() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE b fin.party_bank; n int; prof fin.party_profile; paid int;
BEGIN
  IF NEW.status = 'approuvee' AND OLD.status <> 'approuvee' THEN
    SELECT count(*) INTO n FROM fin.payment_approval WHERE proposal_id = NEW.id;
    IF n < NEW.required THEN RAISE EXCEPTION 'Approbations insuffisantes (% / %)', n, NEW.required USING ERRCODE = 'check_violation'; END IF;
  END IF;
  IF NEW.status = 'executee' AND OLD.status <> 'executee' THEN
    IF OLD.status <> 'approuvee' THEN RAISE EXCEPTION 'Paiement non approuvé' USING ERRCODE = 'check_violation'; END IF;
    IF NEW.executed_by = NEW.prepared_by THEN RAISE EXCEPTION 'Séparation des tâches : le préparateur n''exécute pas son paiement' USING ERRCODE = 'check_violation'; END IF;
    SELECT * INTO prof FROM fin.party_profile WHERE third_party_id = NEW.third_party_id;
    IF prof.status IS DISTINCT FROM 'actif' THEN RAISE EXCEPTION 'Fournisseur non validé ou suspendu' USING ERRCODE = 'check_violation'; END IF;
    IF NEW.method IN ('bank', 'momo', 'om') THEN
      SELECT * INTO b FROM fin.party_bank WHERE id = NEW.party_bank_id;
      IF b.id IS NULL OR b.status <> 'verifie' THEN RAISE EXCEPTION 'Coordonnées non vérifiées' USING ERRCODE = 'check_violation'; END IF;
      IF b.available_from > now() THEN RAISE EXCEPTION 'Délai de carence en cours' USING ERRCODE = 'check_violation'; END IF;
      IF fin.on_watch(NEW.company_id, 'momo', b.momo) OR fin.on_watch(NEW.company_id, 'iban', b.account) THEN RAISE EXCEPTION 'Coordonnées dans la liste de vigilance' USING ERRCODE = 'check_violation'; END IF;
      SELECT count(*) INTO paid FROM fin.payment_proposal WHERE party_bank_id = b.id AND status = 'executee' AND id <> NEW.id;
      IF paid = 0 AND b.first_payment_cap IS NOT NULL AND NEW.amount > b.first_payment_cap THEN RAISE EXCEPTION 'Premier paiement sur nouvelles coordonnées au-delà du plafond' USING ERRCODE = 'check_violation'; END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER payment_proposal_exec BEFORE UPDATE ON payment_proposal FOR EACH ROW EXECUTE FUNCTION trg_execute();

-- --------------------------------------------- relances et promesses
CREATE TABLE reminder (
  id bigserial PRIMARY KEY, company_id uuid NOT NULL REFERENCES company(id), document_id uuid NOT NULL REFERENCES sales_document(id),
  step_day smallint NOT NULL, channel text NOT NULL CHECK (channel IN ('whatsapp', 'email', 'appel', 'courrier')), label text NOT NULL, text text, by_user uuid REFERENCES app_user(id), at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE payment_promise (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES company(id), document_id uuid NOT NULL REFERENCES sales_document(id),
  promised_for date NOT NULL, amount bigint NOT NULL CHECK (amount > 0), contact text, channel text, paid_before bigint NOT NULL DEFAULT 0,
  status promise_status NOT NULL DEFAULT 'en_cours', by_user uuid REFERENCES app_user(id), at timestamptz NOT NULL DEFAULT now(),
  CHECK (promised_for >= at::date)
);
CREATE UNIQUE INDEX promise_open_uq ON payment_promise (document_id) WHERE status = 'en_cours';

-- --------------------------------------------------- incidents de sécurité
CREATE TABLE security_event (
  id bigserial PRIMARY KEY, company_id uuid NOT NULL REFERENCES company(id),
  type text NOT NULL CHECK (type IN ('usurpation', 'signature', 'faux_justificatif', 'fausse_facture', 'webhook_inconnu', 'compte_partage')),
  text text NOT NULL, ref text, by_user uuid REFERENCES app_user(id), at timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------- RLS
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['fin_setting', 'payment_provider', 'party_profile', 'party_contact', 'party_address', 'party_document', 'party_evaluation', 'watch_entry', 'bank_change_request', 'party_bank', 'invoice_template', 'invoice_meta', 'invoice_event', 'pay_link', 'pay_tx', 'provider_event', 'payment_proof', 'inbox_document', 'payment_proposal', 'payment_approval', 'reminder', 'payment_promise', 'security_event'] LOOP
    EXECUTE format('ALTER TABLE fin.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON fin.%I USING (company_id = current_setting(''app.company_id'', true)::uuid) WITH CHECK (company_id = current_setting(''app.company_id'', true)::uuid)', t || '_tenant', t);
  END LOOP;
END $$;

-- Vue : coordonnées masquées pour les rôles sans habilitation (l'API choisit la vue selon le rôle).
CREATE VIEW party_bank_masked AS
  SELECT id, company_id, third_party_id, bank_name, holder, '••• ' || right(regexp_replace(coalesce(account, momo), '\D', '', 'g'), 4) AS masked, status, is_main, available_from FROM party_bank;

-- =====================================================================
-- Yiel CRM · schéma PostgreSQL de référence (15+) — multi-organisation (préparation SaaS)
-- psql -v ON_ERROR_STOP=1 -f docs/schema.sql -f docs/crm/05-schema-crm.sql -f docs/crm/05-schema-crm-test.sql
-- Règles imposées en base, en plus de l'API :
--  * isolation stricte par organisation (sécurité par ligne) ;
--  * chaque contact et chaque donnée importée garde provenance, date de collecte et statut de vérification ;
--  * une adresse « déduite » n'est jamais marquée vérifiée ;
--  * « Gagné » exige montant et date de signature, « Perdu » un motif de la liste de la direction ; chaque changement d'étape est historisé ;
--  * une campagne n'est exécutée que sur une version approuvée, par une personne habilitée (jamais l'administrateur technique sans délégation) ;
--  * un envoi n'a lieu que pour un destinataire du périmètre approuvé, non exclu, avec une clé d'idempotence unique ;
--  * une opposition annule immédiatement les envois planifiés ; les plafonds par campagne et par jour sont respectés ;
--  * approbations, envois et oppositions sont conservés (journal en ajout seul).
-- =====================================================================
SET search_path = compta, public;
DROP SCHEMA IF EXISTS crm CASCADE;
CREATE SCHEMA crm;
SET search_path = crm, compta, public;

CREATE TYPE crm_role     AS ENUM ('owner', 'sales_manager', 'sales', 'marketing', 'crm_admin', 'cfo');
CREATE TYPE source_type  AS ENUM ('public', 'utilisateur', 'verifie', 'import', 'carte', 'deduit');
CREATE TYPE opp_stage    AS ENUM ('a_qualifier', 'qualifie', 'a_preparer', 'contacte', 'echange', 'rdv', 'proposition', 'negociation', 'gagne', 'perdu');
CREATE TYPE camp_status  AS ENUM ('brouillon', 'prevalidation', 'attente_pdg', 'autorisee', 'programmee', 'en_cours', 'suspendue', 'terminee', 'annulee');
CREATE TYPE send_status  AS ENUM ('planifie', 'envoye', 'bloque', 'echec', 'reessai', 'reporte', 'annule', 'attente_canal');
CREATE TYPE reply_kind   AS ENUM ('positive', 'question', 'negative', 'absence', 'opposition');
CREATE TYPE act_type     AS ENUM ('appel', 'email', 'tache', 'rdv', 'note');
CREATE TYPE act_status   AS ENUM ('a_faire', 'fait', 'reporte', 'annule');
CREATE TYPE integ_status AS ENUM ('actif', 'expire', 'erreur', 'autorisation_requise', 'non_disponible', 'demo', 'deconnecte');

-- --------------------------------------------------------------- organisation et accès
-- L'organisation CRM réutilise compta.company (une entité Yiel ou un futur client SaaS).
CREATE TABLE crm_setting (
  company_id        uuid PRIMARY KEY REFERENCES company(id),
  currency          char(3) NOT NULL DEFAULT 'XAF',
  hours_from        time NOT NULL DEFAULT '08:00', hours_to time NOT NULL DEFAULT '17:30',
  send_days         smallint[] NOT NULL DEFAULT '{1,2,3,4,5}',
  cap_mailbox_day   int NOT NULL DEFAULT 150, cap_campaign_day int NOT NULL DEFAULT 60, cap_campaign_week int NOT NULL DEFAULT 250, cap_recipient_week smallint NOT NULL DEFAULT 2,
  provider_limit_day int NOT NULL DEFAULT 400,
  retry_max         smallint NOT NULL DEFAULT 3 CHECK (retry_max BETWEEN 0 AND 5),
  global_stop       boolean NOT NULL DEFAULT false, global_stop_reason text,
  lost_reasons      text[] NOT NULL DEFAULT '{Prix,"Concurrent retenu","Pas de budget","Projet reporté","Pas de réponse","Besoin non avéré"}',
  CHECK (cap_mailbox_day <= provider_limit_day),           -- jamais au-delà des limites du fournisseur
  CHECK (cap_campaign_day <= cap_mailbox_day AND cap_campaign_week >= cap_campaign_day),
  CHECK (cap_recipient_week BETWEEN 1 AND 5),
  CHECK (NOT global_stop OR global_stop_reason IS NOT NULL)
);
CREATE TABLE crm_member (
  company_id  uuid NOT NULL REFERENCES company(id),
  user_id     uuid NOT NULL REFERENCES app_user(id),
  role        crm_role NOT NULL,
  team        text,
  mfa_required boolean GENERATED ALWAYS AS (role IN ('owner', 'sales_manager', 'crm_admin', 'cfo')) STORED,
  active      boolean NOT NULL DEFAULT true,
  PRIMARY KEY (company_id, user_id)
);
CREATE TABLE approval_delegation (
  company_id uuid NOT NULL REFERENCES company(id), user_id uuid NOT NULL, granted_by uuid NOT NULL REFERENCES app_user(id), until date, granted_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz,
  PRIMARY KEY (company_id, user_id, granted_at),
  FOREIGN KEY (company_id, user_id) REFERENCES crm_member(company_id, user_id)
);
CREATE OR REPLACE FUNCTION trg_delegation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT role FROM crm.crm_member WHERE company_id = NEW.company_id AND user_id = NEW.user_id) <> 'sales_manager' THEN RAISE EXCEPTION 'Délégation de validation réservée à un responsable commercial' USING ERRCODE = 'check_violation'; END IF;
  IF (SELECT role FROM crm.crm_member WHERE company_id = NEW.company_id AND user_id = NEW.granted_by) <> 'owner' THEN RAISE EXCEPTION 'Seule la direction délègue la validation' USING ERRCODE = 'check_violation'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER approval_delegation_chk BEFORE INSERT ON approval_delegation FOR EACH ROW EXECUTE FUNCTION trg_delegation();
CREATE OR REPLACE FUNCTION can_approve(c uuid, u uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM crm.crm_member m WHERE m.company_id = c AND m.user_id = u AND m.active AND m.role = 'owner')
      OR EXISTS (SELECT 1 FROM crm.approval_delegation d WHERE d.company_id = c AND d.user_id = u AND d.revoked_at IS NULL AND (d.until IS NULL OR d.until >= current_date)) $$;
CREATE TABLE auth_event (id bigserial PRIMARY KEY, company_id uuid, email text NOT NULL, ok boolean NOT NULL, reason text NOT NULL, ip inet, at timestamptz NOT NULL DEFAULT now());

-- --------------------------------------------------------------- base CRM
CREATE TABLE crm_company (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES company(id), ref text NOT NULL,
  legal_name text NOT NULL, trade_name text, country text NOT NULL DEFAULT 'Cameroun', city text, website text, sector text, sub_sector text, size_band text CHECK (size_band IS NULL OR size_band IN ('1-9', '10-19', '20-49', '50-249', '250+')), org_type text,
  status text NOT NULL DEFAULT 'prospect' CHECK (status IN ('prospect', 'client', 'ancien_client', 'ecarte')),
  source_type source_type NOT NULL, source_label text NOT NULL, source_url text, collected_at date NOT NULL, verified_at date,
  owner_id uuid REFERENCES app_user(id), team text, third_party_id uuid REFERENCES third_party(id),   -- lien comptable (saisie unique)
  deleted_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, ref)
);
CREATE UNIQUE INDEX crm_company_domain_uq ON crm_company (company_id, lower(regexp_replace(website, '^(https?://)?(www\.)?', ''))) WHERE website IS NOT NULL AND deleted_at IS NULL;
CREATE TABLE crm_contact (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES company(id), ref text NOT NULL,
  crm_company_id uuid REFERENCES crm_company(id), civility text, first_name text, last_name text NOT NULL, job_title text,
  email text CHECK (email IS NULL OR email ~* '^[^@\s]+@[^@\s]+\.[a-z]{2,}$'), email_status source_type, email_confidence smallint CHECK (email_confidence BETWEEN 0 AND 100), email_invalid boolean NOT NULL DEFAULT false,
  phone text, phone_confidence smallint, country text, city text,
  source_type source_type NOT NULL, source_label text NOT NULL, collected_at date NOT NULL,
  owner_id uuid REFERENCES app_user(id), team text, status text NOT NULL DEFAULT 'nouveau', pref_channel text DEFAULT 'email', pref_lang text DEFAULT 'fr',
  consent_status text NOT NULL DEFAULT 'non_renseigne' CHECK (consent_status IN ('non_renseigne', 'consentement', 'interet_legitime', 'opposition')),
  deleted_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, ref),
  CHECK (email_status IS DISTINCT FROM 'deduit' OR email_confidence < 50)   -- une adresse déduite n'est jamais présentée comme fiable
);
CREATE UNIQUE INDEX crm_contact_email_uq ON crm_contact (company_id, lower(email)) WHERE email IS NOT NULL AND deleted_at IS NULL;   -- doublon bloqué en base
-- Historique des coordonnées (l'historique commercial reste attaché au contact par son identifiant).
CREATE TABLE crm_contact_history (id bigserial PRIMARY KEY, company_id uuid NOT NULL, contact_id uuid NOT NULL REFERENCES crm_contact(id), field text NOT NULL, old_value text, new_value text, by_user uuid, at timestamptz NOT NULL DEFAULT now());
CREATE OR REPLACE FUNCTION trg_contact_hist() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['email', 'phone', 'job_title', 'last_name', 'first_name'] LOOP
    IF (to_jsonb(OLD)->>f) IS DISTINCT FROM (to_jsonb(NEW)->>f) THEN INSERT INTO crm.crm_contact_history (company_id, contact_id, field, old_value, new_value, by_user) VALUES (NEW.company_id, NEW.id, f, to_jsonb(OLD)->>f, to_jsonb(NEW)->>f, nullif(current_setting('app.user_id', true), '')::uuid); END IF;
  END LOOP; RETURN NEW;
END $$;
CREATE TRIGGER crm_contact_hist AFTER UPDATE ON crm_contact FOR EACH ROW EXECUTE FUNCTION trg_contact_hist();

-- Exclusions et oppositions : au niveau du contact, de l'adresse (empreinte, survit à la suppression) et du canal.
CREATE TABLE exclusion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES company(id),
  contact_id uuid REFERENCES crm_contact(id), email_hash text, channel text NOT NULL DEFAULT 'tous' CHECK (channel IN ('tous', 'email', 'whatsapp', 'sms', 'appel')),
  purpose text NOT NULL DEFAULT 'prospection', reason text NOT NULL, source text NOT NULL, active boolean NOT NULL DEFAULT true, by_user uuid, at timestamptz NOT NULL DEFAULT now(),
  CHECK (contact_id IS NOT NULL OR email_hash IS NOT NULL)
);
CREATE OR REPLACE FUNCTION is_excluded(c uuid, ct uuid, ch text) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM crm.exclusion x LEFT JOIN crm.crm_contact k ON k.id = ct WHERE x.company_id = c AND x.active AND (x.channel = 'tous' OR x.channel = ch)
    AND (x.contact_id = ct OR (k.email IS NOT NULL AND x.email_hash = md5(lower(k.email))))) $$;

-- --------------------------------------------------------------- recherche d'entreprises
CREATE TABLE search_result (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES company(id), name text NOT NULL, payload jsonb NOT NULL,
  source_type source_type NOT NULL, source_label text NOT NULL, source_url text, collected_at date NOT NULL,
  discarded_reason text, discarded_by uuid, imported_company_id uuid REFERENCES crm_company(id)
);
CREATE TABLE saved_search (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES company(id), name text NOT NULL, criteria jsonb NOT NULL, by_user uuid, at timestamptz NOT NULL DEFAULT now());
CREATE TABLE prospect_list (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES company(id), name text NOT NULL, by_user uuid, at timestamptz NOT NULL DEFAULT now(), UNIQUE (company_id, name));
CREATE TABLE prospect_list_member (list_id uuid NOT NULL REFERENCES prospect_list(id) ON DELETE CASCADE, contact_id uuid NOT NULL REFERENCES crm_contact(id), PRIMARY KEY (list_id, contact_id));

-- --------------------------------------------------------------- ventes
CREATE TABLE opportunity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES company(id), ref text NOT NULL,
  crm_company_id uuid NOT NULL REFERENCES crm_company(id), offer text NOT NULL, amount bigint NOT NULL DEFAULT 0 CHECK (amount >= 0), currency char(3) NOT NULL DEFAULT 'XAF',
  close_date date, probability smallint NOT NULL CHECK (probability BETWEEN 0 AND 100), stage opp_stage NOT NULL DEFAULT 'a_qualifier',
  signed_at date, lost_reason text, owner_id uuid REFERENCES app_user(id), team text, campaign_id uuid, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, ref),
  CHECK (stage <> 'gagne' OR (amount > 0 AND signed_at IS NOT NULL)),
  CHECK (stage <> 'perdu' OR lost_reason IS NOT NULL)
);
CREATE TABLE opportunity_contact (opportunity_id uuid NOT NULL REFERENCES opportunity(id) ON DELETE CASCADE, contact_id uuid NOT NULL REFERENCES crm_contact(id), PRIMARY KEY (opportunity_id, contact_id));
CREATE TABLE opportunity_stage_history (id bigserial PRIMARY KEY, company_id uuid NOT NULL, opportunity_id uuid NOT NULL REFERENCES opportunity(id), from_stage opp_stage, to_stage opp_stage NOT NULL, note text, by_user uuid, at timestamptz NOT NULL DEFAULT now());
CREATE OR REPLACE FUNCTION trg_opp_stage() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.stage = 'perdu' AND NOT EXISTS (SELECT 1 FROM crm.crm_setting s WHERE s.company_id = NEW.company_id AND NEW.lost_reason = ANY (s.lost_reasons)) THEN RAISE EXCEPTION 'Motif de perte non prévu par la direction' USING ERRCODE = 'check_violation'; END IF;
  IF TG_OP = 'INSERT' OR OLD.stage IS DISTINCT FROM NEW.stage THEN INSERT INTO crm.opportunity_stage_history (company_id, opportunity_id, from_stage, to_stage, by_user) VALUES (NEW.company_id, NEW.id, CASE WHEN TG_OP = 'UPDATE' THEN OLD.stage END, NEW.stage, nullif(current_setting('app.user_id', true), '')::uuid); END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER opportunity_stage AFTER INSERT OR UPDATE OF stage ON opportunity FOR EACH ROW EXECUTE FUNCTION trg_opp_stage();
CREATE TABLE activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES company(id), ref text NOT NULL, type act_type NOT NULL, title text NOT NULL,
  at timestamptz NOT NULL, duration_min smallint, place text, crm_company_id uuid REFERENCES crm_company(id), contact_id uuid REFERENCES crm_contact(id), opportunity_id uuid REFERENCES opportunity(id),
  owner_id uuid REFERENCES app_user(id), status act_status NOT NULL DEFAULT 'a_faire', reminder_min smallint, result text,
  gcal_sync text CHECK (gcal_sync IS NULL OR gcal_sync IN ('ok', 'indisponible')), gcal_event_id text,
  UNIQUE (company_id, ref), CHECK (crm_company_id IS NOT NULL OR contact_id IS NOT NULL OR opportunity_id IS NOT NULL)
);
CREATE TABLE activity_history (id bigserial PRIMARY KEY, company_id uuid NOT NULL, activity_id uuid NOT NULL REFERENCES activity(id), text text NOT NULL, old_at timestamptz, new_at timestamptz, by_user uuid, at timestamptz NOT NULL DEFAULT now());
CREATE TABLE objective (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES company(id), period text NOT NULL, date_from date NOT NULL, date_to date NOT NULL, team text NOT NULL DEFAULT '', target bigint NOT NULL CHECK (target > 0), UNIQUE (company_id, period, team), CHECK (date_to > date_from));
CREATE TABLE objective_history (id bigserial PRIMARY KEY, objective_id uuid NOT NULL REFERENCES objective(id), old_target bigint, new_target bigint, by_user uuid, at timestamptz NOT NULL DEFAULT now());
-- Vue du cockpit : chiffres calculés depuis les dossiers, jamais saisis.
CREATE VIEW v_pipeline AS SELECT company_id, sum(amount) FILTER (WHERE stage NOT IN ('gagne', 'perdu')) AS pipeline, sum(amount * probability / 100) FILTER (WHERE stage NOT IN ('gagne', 'perdu')) AS weighted, count(*) FILTER (WHERE stage NOT IN ('gagne', 'perdu')) AS open_count FROM opportunity GROUP BY company_id;
CREATE VIEW v_signed AS SELECT company_id, date_trunc('quarter', signed_at)::date AS quarter, sum(amount) AS signed, count(*) AS won FROM opportunity WHERE stage = 'gagne' GROUP BY 1, 2;

-- --------------------------------------------------------------- messages et campagnes
CREATE TABLE template (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES company(id), ref text NOT NULL, name text NOT NULL, offer text, segment text, stage opp_stage, persona text, tone text, required_vars text[] NOT NULL DEFAULT '{contact.nom,entreprise.nom}', current_version int NOT NULL DEFAULT 1, UNIQUE (company_id, ref));
CREATE TABLE template_version (template_id uuid NOT NULL REFERENCES template(id), version int NOT NULL, subject text NOT NULL, body text NOT NULL, by_user uuid, at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (template_id, version));
CREATE TABLE campaign (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES company(id), ref text NOT NULL, name text NOT NULL, objective text, offer text,
  version int NOT NULL DEFAULT 1, status camp_status NOT NULL DEFAULT 'brouillon', segment jsonb NOT NULL DEFAULT '{}', starts_on date, ends_on date, send_from time, send_to time,
  cap_day int, cap_week int, cap_recipient_week smallint, stop_on_reply boolean NOT NULL DEFAULT true, stop_bounce_pct smallint NOT NULL DEFAULT 10,
  approved_version int, created_by uuid REFERENCES app_user(id), created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, ref), CHECK (ends_on IS NULL OR starts_on IS NULL OR ends_on >= starts_on),
  CHECK (status NOT IN ('autorisee', 'programmee', 'en_cours') OR (approved_version IS NOT NULL AND approved_version = version))   -- exécutable seulement sur la version approuvée
);
CREATE TABLE campaign_step (campaign_id uuid NOT NULL REFERENCES campaign(id) ON DELETE CASCADE, step smallint NOT NULL, template_id uuid NOT NULL REFERENCES template(id), delay_days smallint NOT NULL DEFAULT 0, PRIMARY KEY (campaign_id, step), CHECK (step = 0 OR delay_days > 0));
-- Approbation figée d'une version : périmètre, versions des modèles, calendrier, plafonds (append-only).
CREATE TABLE campaign_approval (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES company(id), campaign_id uuid NOT NULL REFERENCES campaign(id), version int NOT NULL,
  approved_by uuid NOT NULL REFERENCES app_user(id), approved_at timestamptz NOT NULL DEFAULT now(), comment text, fingerprint text NOT NULL,
  steps jsonb NOT NULL, schedule jsonb NOT NULL, caps jsonb NOT NULL, volume int NOT NULL,
  UNIQUE (campaign_id, version)
);
CREATE TABLE campaign_approval_recipient (approval_id uuid NOT NULL REFERENCES campaign_approval(id), contact_id uuid NOT NULL REFERENCES crm_contact(id), PRIMARY KEY (approval_id, contact_id));
CREATE OR REPLACE FUNCTION trg_approval() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT crm.can_approve(NEW.company_id, NEW.approved_by) THEN RAISE EXCEPTION 'Approbation réservée à la direction ou à un délégué explicite' USING ERRCODE = 'check_violation'; END IF;
  IF (SELECT status FROM crm.campaign WHERE id = NEW.campaign_id) <> 'attente_pdg' THEN RAISE EXCEPTION 'Campagne non soumise à validation' USING ERRCODE = 'check_violation'; END IF;
  IF (SELECT version FROM crm.campaign WHERE id = NEW.campaign_id) <> NEW.version THEN RAISE EXCEPTION 'La version approuvée doit être la version courante' USING ERRCODE = 'check_violation'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER campaign_approval_chk BEFORE INSERT ON campaign_approval FOR EACH ROW EXECUTE FUNCTION trg_approval();
CREATE OR REPLACE FUNCTION trg_append_only() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Journal en ajout seul : % non modifiable', TG_TABLE_NAME USING ERRCODE = 'check_violation'; END $$;
CREATE TRIGGER campaign_approval_ro BEFORE UPDATE OR DELETE ON campaign_approval FOR EACH ROW EXECUTE FUNCTION trg_append_only();
CREATE OR REPLACE FUNCTION trg_campaign_status() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IN ('autorisee', 'programmee', 'en_cours') AND NOT EXISTS (SELECT 1 FROM crm.campaign_approval a WHERE a.campaign_id = NEW.id AND a.version = NEW.version) THEN RAISE EXCEPTION 'Aucune approbation enregistrée pour la version %', NEW.version USING ERRCODE = 'check_violation'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER campaign_status_chk BEFORE UPDATE OF status, version ON campaign FOR EACH ROW EXECUTE FUNCTION trg_campaign_status();
CREATE TABLE campaign_event (id bigserial PRIMARY KEY, company_id uuid NOT NULL, campaign_id uuid NOT NULL REFERENCES campaign(id), text text NOT NULL, by_user uuid, at timestamptz NOT NULL DEFAULT now());

-- File d'envoi : une ligne par (campagne, étape, destinataire) ; la clé d'idempotence empêche tout doublon.
CREATE TABLE send_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES company(id), idem_key text NOT NULL,
  campaign_id uuid REFERENCES campaign(id), approval_id uuid REFERENCES campaign_approval(id), step smallint, contact_id uuid NOT NULL REFERENCES crm_contact(id), to_email text NOT NULL,
  template_id uuid, template_version int, subject text, due_at timestamptz NOT NULL, status send_status NOT NULL DEFAULT 'planifie', attempts smallint NOT NULL DEFAULT 0, reason text, sent_at timestamptz, provider_id text,
  UNIQUE (company_id, idem_key),
  CHECK (status <> 'envoye' OR sent_at IS NOT NULL),
  CHECK (campaign_id IS NULL OR approval_id IS NOT NULL)
);
CREATE INDEX send_queue_due_ix ON send_queue (company_id, status, due_at);
-- Les règles 1, 2, 3, 5 et 7 vérifiées en base au moment de l'envoi (les autres dans le moteur).
CREATE OR REPLACE FUNCTION trg_send() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c crm.campaign; a crm.campaign_approval; s crm.crm_setting; n int;
BEGIN
  IF NEW.status <> 'envoye' OR (TG_OP = 'UPDATE' AND OLD.status = 'envoye') THEN RETURN NEW; END IF;
  SELECT * INTO s FROM crm.crm_setting WHERE company_id = NEW.company_id;
  IF s.global_stop THEN RAISE EXCEPTION 'Suspension globale des envois' USING ERRCODE = 'check_violation'; END IF;
  IF crm.is_excluded(NEW.company_id, NEW.contact_id, 'email') THEN RAISE EXCEPTION 'Destinataire exclu (opposition)' USING ERRCODE = 'check_violation'; END IF;
  IF NEW.campaign_id IS NOT NULL THEN
    SELECT * INTO c FROM crm.campaign WHERE id = NEW.campaign_id; SELECT * INTO a FROM crm.campaign_approval WHERE id = NEW.approval_id;
    IF c.status <> 'en_cours' THEN RAISE EXCEPTION 'Campagne non en cours (%)', c.status USING ERRCODE = 'check_violation'; END IF;
    IF a.version <> c.approved_version THEN RAISE EXCEPTION 'Envoi rattaché à une approbation périmée' USING ERRCODE = 'check_violation'; END IF;
    IF NEW.sent_at::date > c.ends_on THEN RAISE EXCEPTION 'Campagne expirée' USING ERRCODE = 'check_violation'; END IF;
    IF NOT EXISTS (SELECT 1 FROM crm.campaign_approval_recipient r WHERE r.approval_id = a.id AND r.contact_id = NEW.contact_id) THEN RAISE EXCEPTION 'Destinataire hors du périmètre approuvé' USING ERRCODE = 'check_violation'; END IF;
    IF NEW.template_version IS DISTINCT FROM (SELECT (x->>'version')::int FROM jsonb_array_elements(a.steps) x WHERE (x->>'step')::int = NEW.step) THEN RAISE EXCEPTION 'Modèle différent de la version approuvée' USING ERRCODE = 'check_violation'; END IF;
    SELECT count(*) INTO n FROM crm.send_queue q WHERE q.campaign_id = NEW.campaign_id AND q.status = 'envoye' AND q.sent_at::date = NEW.sent_at::date AND q.id <> NEW.id;
    IF n >= least(coalesce(c.cap_day, s.cap_campaign_day), s.cap_campaign_day) THEN RAISE EXCEPTION 'Plafond journalier de la campagne atteint' USING ERRCODE = 'check_violation'; END IF;
  END IF;
  SELECT count(*) INTO n FROM crm.send_queue q WHERE q.company_id = NEW.company_id AND q.status = 'envoye' AND q.sent_at::date = NEW.sent_at::date AND q.id <> NEW.id;
  IF n >= s.cap_mailbox_day THEN RAISE EXCEPTION 'Plafond de la boîte d''envoi atteint' USING ERRCODE = 'check_violation'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER send_queue_chk BEFORE INSERT OR UPDATE ON send_queue FOR EACH ROW EXECUTE FUNCTION trg_send();
-- Opposition : annulation immédiate des envois planifiés, quelles que soient les campagnes.
CREATE OR REPLACE FUNCTION trg_exclusion() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE crm.send_queue q SET status = 'annule', reason = 'Opposition du destinataire'
   WHERE q.company_id = NEW.company_id AND q.status IN ('planifie', 'reessai', 'reporte', 'attente_canal')
     AND (q.contact_id = NEW.contact_id OR (NEW.email_hash IS NOT NULL AND md5(lower(q.to_email)) = NEW.email_hash));
  IF NEW.contact_id IS NOT NULL THEN UPDATE crm.crm_contact SET consent_status = 'opposition' WHERE id = NEW.contact_id; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER exclusion_apply AFTER INSERT ON exclusion FOR EACH ROW EXECUTE FUNCTION trg_exclusion();
CREATE TABLE inbound_reply (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES company(id), contact_id uuid NOT NULL REFERENCES crm_contact(id), campaign_id uuid REFERENCES campaign(id), kind reply_kind NOT NULL, body_excerpt text, back_on date, task_id uuid REFERENCES activity(id), handled boolean NOT NULL DEFAULT false, received_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE run_log (id bigserial PRIMARY KEY, company_id uuid NOT NULL, idem_key text NOT NULL, result text NOT NULL, detail text, at timestamptz NOT NULL DEFAULT now());
CREATE TRIGGER run_log_ro BEFORE UPDATE OR DELETE ON run_log FOR EACH ROW EXECUTE FUNCTION trg_append_only();

-- --------------------------------------------------------------- intégrations et notifications
CREATE TABLE integration (company_id uuid NOT NULL REFERENCES company(id), code text NOT NULL, label text NOT NULL, provider text, account text, status integ_status NOT NULL DEFAULT 'non_disponible', secret_ref text, limit_day int, changed_at timestamptz, PRIMARY KEY (company_id, code), CHECK (secret_ref IS NULL OR secret_ref LIKE 'vault://%'));
CREATE TABLE notification (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES company(id), dedup_key text NOT NULL, type text NOT NULL, text text NOT NULL, priority text NOT NULL DEFAULT 'normale' CHECK (priority IN ('haute', 'normale', 'basse')), link jsonb, read_by uuid[] NOT NULL DEFAULT '{}', at timestamptz NOT NULL DEFAULT now(), UNIQUE (company_id, dedup_key));
CREATE TABLE whatsapp_alert (id bigserial PRIMARY KEY, company_id uuid NOT NULL REFERENCES company(id), dedup_key text NOT NULL, text text NOT NULL, status text NOT NULL CHECK (status IN ('envoyee', 'non_envoyee', 'echec')), reason text, at timestamptz NOT NULL DEFAULT now(), UNIQUE (company_id, dedup_key));

-- --------------------------------------------------------------- RLS
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['crm_setting', 'crm_member', 'approval_delegation', 'crm_company', 'crm_contact', 'crm_contact_history', 'exclusion', 'search_result', 'saved_search', 'prospect_list', 'opportunity', 'opportunity_stage_history', 'activity', 'activity_history', 'objective', 'template', 'campaign', 'campaign_approval', 'campaign_event', 'send_queue', 'inbound_reply', 'run_log', 'integration', 'notification', 'whatsapp_alert'] LOOP
    EXECUTE format('ALTER TABLE crm.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON crm.%I USING (company_id = current_setting(''app.company_id'', true)::uuid) WITH CHECK (company_id = current_setting(''app.company_id'', true)::uuid)', t || '_tenant', t);
  END LOOP;
END $$;
-- Périmètre « portefeuille » pour les commerciaux : politique supplémentaire (restrictive) sur les contacts.
CREATE POLICY crm_contact_scope ON crm_contact AS RESTRICTIVE USING (
  coalesce(current_setting('app.crm_scope', true), 'all') = 'all'
  OR (current_setting('app.crm_scope', true) = 'team' AND team = current_setting('app.crm_team', true))
  OR owner_id = nullif(current_setting('app.user_id', true), '')::uuid);

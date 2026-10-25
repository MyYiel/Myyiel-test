-- =====================================================================
-- myyiel Temps & présence · Congés & absences · Stocks — schéma PostgreSQL de référence (15+)
-- À lancer après docs/schema.sql et docs/paie/06-schema-paie.sql :
-- psql -v ON_ERROR_STOP=1 -f docs/schema.sql -f docs/paie/06-schema-paie.sql -f docs/rh/06-schema-rh.sql -f docs/rh/06-schema-rh-test.sql
-- Règles imposées en base :
--  * lien de pointage à usage unique et à durée limitée ;
--  * aucune position GPS de mission hors de la fenêtre démarrage → fin (RG-G20) ;
--  * le N+1 ne valide pas sa propre absence, la personne qui saisit ne valide pas (RG-A10) ;
--  * inventaire validé par une autre personne que celle qui l'a ouvert (RG-S10) ;
--  * stock jamais négatif par article et dépôt (RG-S01).
-- =====================================================================
SET search_path = paie, compta, public;
DROP SCHEMA IF EXISTS rh CASCADE;
CREATE SCHEMA rh;
SET search_path = rh, paie, compta, public;

CREATE TYPE punch_status   AS ENUM ('valide', 'a_verifier', 'rejete');
CREATE TYPE punch_kind     AS ENUM ('in', 'out', 'control');
CREATE TYPE mission_status AS ENUM ('planifiee', 'en_route', 'sur_site', 'terminee', 'annulee');
CREATE TYPE abs_status     AS ENUM ('en_attente_n1', 'en_attente_rh', 'a_notifier', 'approuvee', 'refusee', 'annulee');
CREATE TYPE sheet_status   AS ENUM ('ouverte', 'validee', 'transmise');
CREATE TYPE move_type      AS ENUM ('entree', 'sortie', 'transfert', 'ajustement', 'inventaire');
CREATE TYPE count_status   AS ENUM ('en_cours', 'a_valider', 'valide', 'annule');

-- ------------------------------------------------------------------ GTA
CREATE TABLE site (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES compta.company(id),
  code varchar(20) NOT NULL, label text NOT NULL, type varchar(12) NOT NULL DEFAULT 'agence',
  lat numeric(9,6) NOT NULL CHECK (lat BETWEEN 1.5 AND 13.2), lng numeric(9,6) NOT NULL CHECK (lng BETWEEN 8.3 AND 16.3),
  radius_m int NOT NULL CHECK (radius_m BETWEEN 30 AND 2000), qr_token text NOT NULL, wifi text[] NOT NULL DEFAULT '{}', active boolean NOT NULL DEFAULT true,
  UNIQUE (company_id, code), UNIQUE (qr_token)
);
CREATE TABLE work_schedule (
  company_id uuid NOT NULL REFERENCES compta.company(id), code varchar(10) NOT NULL, label text NOT NULL,
  days smallint[] NOT NULL, start_t time NOT NULL, end_t time NOT NULL CHECK (end_t > start_t), break_min int NOT NULL DEFAULT 0, tolerance_min int NOT NULL DEFAULT 10,
  PRIMARY KEY (company_id, code)
);
CREATE TABLE gta_assignment (
  employee_id uuid PRIMARY KEY REFERENCES paie.employee(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES compta.company(id), schedule_code varchar(10) NOT NULL, site_codes text[] NOT NULL DEFAULT '{}', mode varchar(10) NOT NULL DEFAULT 'site',
  device_id text, device_label text, device_at timestamptz, consent_at timestamptz, consent_version text, home_lat numeric(9,6), home_lng numeric(9,6),
  FOREIGN KEY (company_id, schedule_code) REFERENCES work_schedule(company_id, code)
);
CREATE TABLE punch_link (
  token text PRIMARY KEY, company_id uuid NOT NULL REFERENCES compta.company(id), employee_id uuid NOT NULL REFERENCES paie.employee(id),
  kind punch_kind NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL, used_at timestamptz,
  CHECK (expires_at > created_at AND expires_at <= created_at + interval '30 minutes'),
  CHECK (used_at IS NULL OR used_at <= expires_at)
);
CREATE TABLE punch (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES compta.company(id), employee_id uuid NOT NULL REFERENCES paie.employee(id),
  at timestamptz NOT NULL, kind punch_kind NOT NULL, site_code varchar(20), lat numeric(9,6), lng numeric(9,6), accuracy_m int, distance_m int,
  score smallint CHECK (score BETWEEN 0 AND 100), signals jsonb NOT NULL DEFAULT '[]', status punch_status NOT NULL, channel varchar(10) NOT NULL,
  link_token text UNIQUE REFERENCES punch_link(token), reviewed_by text, review_comment text, purged boolean NOT NULL DEFAULT false,
  CHECK (channel <> 'manager' OR review_comment IS NOT NULL),          -- saisie manuelle toujours motivée
  CHECK (channel <> 'whatsapp' OR link_token IS NOT NULL)
);
-- Lien : usage unique, non expiré, émis pour ce salarié
CREATE FUNCTION trg_punch_link() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE l rh.punch_link;
BEGIN
  IF NEW.link_token IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO l FROM rh.punch_link WHERE token = NEW.link_token FOR UPDATE;
  IF l.used_at IS NOT NULL THEN RAISE EXCEPTION 'RG-G01 : lien déjà utilisé'; END IF;
  IF NEW.at > l.expires_at THEN RAISE EXCEPTION 'RG-G01 : lien expiré'; END IF;
  IF l.employee_id <> NEW.employee_id THEN RAISE EXCEPTION 'RG-G01 : lien émis pour un autre salarié'; END IF;
  UPDATE rh.punch_link SET used_at = NEW.at WHERE token = NEW.link_token;
  RETURN NEW;
END $$;
CREATE TRIGGER punch_link_check BEFORE INSERT ON punch FOR EACH ROW EXECUTE FUNCTION trg_punch_link();

CREATE TABLE mission (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES compta.company(id), ref varchar(20) NOT NULL,
  label text NOT NULL, from_label text NOT NULL, to_label text NOT NULL, to_lat numeric(9,6) NOT NULL, to_lng numeric(9,6) NOT NULL, route jsonb NOT NULL,
  planned_start timestamptz NOT NULL, planned_arrival timestamptz NOT NULL CHECK (planned_arrival > planned_start), planned_end date NOT NULL,
  status mission_status NOT NULL DEFAULT 'planifiee', started_at timestamptz, arrived_at timestamptz, ended_at timestamptz, per_diem bigint NOT NULL DEFAULT 0,
  UNIQUE (company_id, ref), CHECK (ended_at IS NULL OR ended_at >= started_at)
);
CREATE TABLE mission_employee (mission_id uuid REFERENCES mission(id) ON DELETE CASCADE, employee_id uuid REFERENCES paie.employee(id), company_id uuid NOT NULL, PRIMARY KEY (mission_id, employee_id));
CREATE TABLE mission_position (
  mission_id uuid NOT NULL REFERENCES mission(id) ON DELETE CASCADE, company_id uuid NOT NULL, at timestamptz NOT NULL,
  lat numeric(9,6) NOT NULL, lng numeric(9,6) NOT NULL, accuracy_m int, PRIMARY KEY (mission_id, at)
);
-- RG-G20 : fin de mission = fin du suivi. Aucune position hors de la fenêtre démarrage → fin.
CREATE FUNCTION trg_mission_position() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE m rh.mission;
BEGIN
  SELECT * INTO m FROM rh.mission WHERE id = NEW.mission_id;
  IF m.status NOT IN ('en_route', 'sur_site') OR m.started_at IS NULL OR NEW.at < m.started_at OR (m.ended_at IS NOT NULL AND NEW.at > m.ended_at) THEN
    RAISE EXCEPTION 'RG-G20 : suivi inactif, position refusée';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER mission_position_window BEFORE INSERT ON mission_position FOR EACH ROW EXECUTE FUNCTION trg_mission_position();

CREATE TABLE timesheet (
  company_id uuid NOT NULL REFERENCES compta.company(id), employee_id uuid NOT NULL REFERENCES paie.employee(id), pkey char(7) NOT NULL,
  status sheet_status NOT NULL DEFAULT 'ouverte', ot_decisions jsonb NOT NULL DEFAULT '{}', abs_decisions jsonb NOT NULL DEFAULT '{}',
  validated_by_user uuid, validated_at timestamptz, transmitted_at timestamptz,
  PRIMARY KEY (employee_id, pkey)
);

-- ------------------------------------------------------------------ absences
CREATE TABLE absence_type (
  company_id uuid NOT NULL REFERENCES compta.company(id), code varchar(10) NOT NULL, label text NOT NULL, icon varchar(20) NOT NULL, color char(7) NOT NULL CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
  unit varchar(12) NOT NULL CHECK (unit IN ('ouvrable', 'ouvre', 'calendaire')), paid boolean NOT NULL, pay_code varchar(10), counter varchar(6),
  proof boolean NOT NULL DEFAULT false, notice_days int NOT NULL DEFAULT 0, max_days int, half_day boolean NOT NULL DEFAULT false,
  approval varchar(12) NOT NULL CHECK (approval IN ('workflow', 'declaration')), self_service boolean NOT NULL DEFAULT true, active boolean NOT NULL DEFAULT true,
  PRIMARY KEY (company_id, code)
);
CREATE TABLE service_manager (company_id uuid NOT NULL, service text NOT NULL, manager_id uuid NOT NULL REFERENCES paie.employee(id), PRIMARY KEY (company_id, service));
CREATE TABLE absence_request (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES compta.company(id), ref varchar(20) NOT NULL,
  employee_id uuid NOT NULL REFERENCES paie.employee(id), type_code varchar(10) NOT NULL, start_d date NOT NULL, end_d date NOT NULL, start_half char(2), end_half char(2),
  days numeric(6,2) NOT NULL CHECK (days > 0), status abs_status NOT NULL, steps text[] NOT NULL, step smallint NOT NULL DEFAULT 0,
  approver_id uuid REFERENCES paie.employee(id), created_by_user uuid NOT NULL, on_behalf boolean NOT NULL DEFAULT false, proof_file text,
  decided_by_user uuid, decided_by_employee uuid, notified_at timestamptz, history jsonb NOT NULL DEFAULT '[]',
  UNIQUE (company_id, ref), CHECK (end_d >= start_d),
  FOREIGN KEY (company_id, type_code) REFERENCES absence_type(company_id, code)
);
-- RG-A01 : pas de chevauchement de deux demandes actives d'un même salarié
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE absence_request ADD CONSTRAINT absence_no_overlap EXCLUDE USING gist (employee_id WITH =, daterange(start_d, end_d, '[]') WITH &&) WHERE (status NOT IN ('refusee', 'annulee'));
-- RG-A10 : séparation des tâches au moment de la décision
CREATE FUNCTION trg_absence_decision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approuvee', 'a_notifier', 'en_attente_rh', 'refusee') THEN
    IF NEW.decided_by_employee = NEW.employee_id THEN RAISE EXCEPTION 'RG-A10 : on ne valide pas sa propre absence'; END IF;
    IF OLD.on_behalf AND OLD.steps[OLD.step + 1] = 'rh' AND NEW.decided_by_user = OLD.created_by_user THEN RAISE EXCEPTION 'RG-A10 : la personne qui saisit ne valide pas'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER absence_decision BEFORE UPDATE ON absence_request FOR EACH ROW EXECUTE FUNCTION trg_absence_decision();
CREATE TABLE company_holiday (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL, day date NOT NULL, label text NOT NULL, kind text NOT NULL DEFAULT 'Entreprise', UNIQUE (company_id, day));
CREATE TABLE manager_delegation (company_id uuid NOT NULL, from_id uuid NOT NULL REFERENCES paie.employee(id), to_id uuid NOT NULL REFERENCES paie.employee(id), start_d date NOT NULL, end_d date NOT NULL, CHECK (from_id <> to_id AND end_d >= start_d));

-- ------------------------------------------------------------------ stocks
CREATE TABLE warehouse (company_id uuid NOT NULL REFERENCES compta.company(id), code varchar(12) NOT NULL, label text NOT NULL, keeper text, PRIMARY KEY (company_id, code));
CREATE TABLE stock_article (
  company_id uuid NOT NULL REFERENCES compta.company(id), code varchar(20) NOT NULL, label text NOT NULL,
  family varchar(14) NOT NULL CHECK (family IN ('marchandise', 'matiere', 'fourniture', 'produit_fini')), unit text NOT NULL DEFAULT 'unité',
  min_qty numeric(14,3) NOT NULL DEFAULT 0, ref_cost bigint NOT NULL DEFAULT 0, sale_item_code text, PRIMARY KEY (company_id, code)
);
CREATE TABLE stock_move (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES compta.company(id), num varchar(20) NOT NULL, seq bigserial,
  move_date date NOT NULL, type move_type NOT NULL, article varchar(20) NOT NULL, wh varchar(12) NOT NULL, wh_to varchar(12),
  qty numeric(14,3) NOT NULL CHECK (qty <> 0), unit_cost bigint, value bigint NOT NULL, ref text, motif text, entry_num text, count_id uuid,
  UNIQUE (company_id, num),
  FOREIGN KEY (company_id, article) REFERENCES stock_article(company_id, code), FOREIGN KEY (company_id, wh) REFERENCES warehouse(company_id, code),
  CHECK (type IN ('ajustement', 'inventaire') OR qty > 0), CHECK (type <> 'transfert' OR (wh_to IS NOT NULL AND wh_to <> wh)), CHECK (type <> 'entree' OR unit_cost > 0)
);
CREATE VIEW stock_position AS
  SELECT company_id, article, wh, sum(q) AS qty FROM (
    SELECT company_id, article, wh, CASE WHEN type = 'entree' THEN qty WHEN type IN ('sortie', 'transfert') THEN -qty ELSE qty END AS q FROM stock_move
    UNION ALL SELECT company_id, article, wh_to, qty FROM stock_move WHERE type = 'transfert') x GROUP BY 1, 2, 3;
-- RG-S01 : pas de stock négatif
CREATE FUNCTION trg_stock_non_negative() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM rh.stock_position WHERE company_id = NEW.company_id AND article = NEW.article AND wh = NEW.wh AND qty < 0) THEN
    RAISE EXCEPTION 'RG-S01 : stock insuffisant pour % au dépôt %', NEW.article, NEW.wh;
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER stock_non_negative AFTER INSERT ON stock_move DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION trg_stock_non_negative();
CREATE TABLE stock_count (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES compta.company(id), ref varchar(20) NOT NULL, count_date date NOT NULL, wh varchar(12) NOT NULL,
  blind boolean NOT NULL DEFAULT true, status count_status NOT NULL DEFAULT 'en_cours', opened_by uuid NOT NULL, validated_by uuid, lines jsonb NOT NULL DEFAULT '[]',
  UNIQUE (company_id, ref), CHECK (validated_by IS NULL OR validated_by <> opened_by)   -- RG-S10
);
CREATE UNIQUE INDEX one_open_count_per_wh ON stock_count (company_id, wh) WHERE status IN ('en_cours', 'a_valider');

-- ------------------------------------------------------------------ RLS
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['site','work_schedule','gta_assignment','punch_link','punch','mission','mission_employee','mission_position','timesheet','absence_type','service_manager','absence_request','company_holiday','manager_delegation','warehouse','stock_article','stock_move','stock_count'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON %I USING (company_id = current_setting(''app.company_id'', true)::uuid) WITH CHECK (company_id = current_setting(''app.company_id'', true)::uuid)', t || '_tenant', t);
  END LOOP;
END $$;
-- Positions de mission : visibles par le salarié, son N+1 et les rôles gta.track uniquement (positionné par l'API)
CREATE POLICY mission_position_scope ON mission_position AS RESTRICTIVE USING (current_setting('app.gta_track', true) = 'on');

-- =====================================================================
-- myyiel Paie · schéma PostgreSQL de référence (15+), à lancer APRÈS docs/schema.sql
-- psql -v ON_ERROR_STOP=1 -f docs/schema.sql -f docs/paie/06-schema-paie.sql -f docs/paie/06-schema-paie-test.sql
--
-- Principes :
--  * réglementation datée et versionnée (aucun taux en dur dans le code) ;
--  * période validée = gelée : bulletins immuables, empreinte SHA-256, rappels en N+1 ;
--  * séparation des tâches garantie en base (préparateur ≠ approbateur, gestionnaire ne signe pas) ;
--  * données sensibles (salaire, RIB, CNI) dans une table à part, accès restreint par RLS + rôle ;
--  * multi-tenant par company_id (RLS), montants BIGINT en XAF.
-- =====================================================================
SET search_path = compta, public;

DROP SCHEMA IF EXISTS paie CASCADE;
CREATE SCHEMA paie;
SET search_path = paie, compta, public;

-- ---------------------------------------------------------------- types
CREATE TYPE period_status  AS ENUM ('preparation', 'calculee', 'controlee', 'soumise', 'validee', 'cloturee');
CREATE TYPE rubric_kind    AS ENUM ('gain', 'nature', 'cotisation', 'impot', 'retenue');
CREATE TYPE contract_type  AS ENUM ('CDI', 'CDD', 'STAGE', 'CONSULTANT', 'JOURNALIER');
CREATE TYPE pay_mode       AS ENUM ('virement', 'momo', 'om', 'especes', 'cheque');
CREATE TYPE order_status   AS ENUM ('brouillon', 'soumis', 'valide', 'envoye', 'execute', 'rejete');
CREATE TYPE advance_status AS ENUM ('demandee', 'approuvee', 'refusee', 'versee', 'retenue');
CREATE TYPE decl_status    AS ENUM ('a_declarer', 'transmise', 'payee');
CREATE TYPE anomaly_level  AS ENUM ('bloquante', 'non_bloquante');
CREATE TYPE bareme_mode    AS ENUM ('progressif', 'forfait');

-- --------------------------------------------- réglementation versionnée
-- Un « pack pays » (CM, CI, SN, GA…) porte paramètres, barèmes et rubriques par défaut.
CREATE TABLE country_pack (
  code        char(2) PRIMARY KEY,
  label       text NOT NULL,
  currency    char(3) NOT NULL DEFAULT 'XAF'
);

CREATE TABLE param_def (
  country     char(2) NOT NULL REFERENCES country_pack(code),
  code        varchar(40) NOT NULL,
  label       text NOT NULL,
  unit        varchar(12) NOT NULL DEFAULT '',          -- '%', 'XAF', 'h', 'j'
  source      text NOT NULL DEFAULT '',                  -- texte légal de référence
  PRIMARY KEY (country, code)
);

-- Une ligne par version : jamais d'UPDATE, on ajoute une version datée (RG-P01).
-- company_id NULL = valeur du pack pays ; non NULL = surcharge propre à la société.
CREATE TABLE param_version (
  id          bigserial PRIMARY KEY,
  country     char(2) NOT NULL,
  code        varchar(40) NOT NULL,
  company_id  uuid REFERENCES compta.company(id),
  valid_from  date NOT NULL,
  value       numeric(18,4) NOT NULL,
  reason      text NOT NULL,
  created_by  text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (country, code) REFERENCES param_def(country, code),
  UNIQUE NULLS NOT DISTINCT (country, code, company_id, valid_from)
);

CREATE TABLE bareme_def (
  country     char(2) NOT NULL REFERENCES country_pack(code),
  code        varchar(40) NOT NULL,
  label       text NOT NULL,
  mode        bareme_mode NOT NULL,
  PRIMARY KEY (country, code)
);

CREATE TABLE bareme_version (
  id          bigserial PRIMARY KEY,
  country     char(2) NOT NULL,
  code        varchar(40) NOT NULL,
  company_id  uuid REFERENCES compta.company(id),
  valid_from  date NOT NULL,
  rows        jsonb NOT NULL CHECK (jsonb_typeof(rows) = 'array'),   -- [{upTo, rate} | {upTo, amount}]
  reason      text NOT NULL,
  created_by  text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (country, code) REFERENCES bareme_def(country, code),
  UNIQUE NULLS NOT DISTINCT (country, code, company_id, valid_from)
);

-- Valeur en vigueur à une date (surcharge société prioritaire).
CREATE FUNCTION param_at(p_country char(2), p_code text, p_company uuid, p_date date) RETURNS numeric LANGUAGE sql STABLE AS $$
  SELECT value FROM paie.param_version
   WHERE country = p_country AND code = p_code AND (company_id = p_company OR company_id IS NULL) AND valid_from <= p_date
   ORDER BY (company_id IS NULL), valid_from DESC LIMIT 1
$$;

CREATE FUNCTION trg_version_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'RG-P01 : une version réglementaire ne se modifie pas, ajoutez une nouvelle version datée'; END $$;
CREATE TRIGGER param_append_only  BEFORE UPDATE OR DELETE ON param_version  FOR EACH ROW EXECUTE FUNCTION trg_version_append_only();
CREATE TRIGGER bareme_append_only BEFORE UPDATE OR DELETE ON bareme_version FOR EACH ROW EXECUTE FUNCTION trg_version_append_only();

-- ------------------------------------------------- organisation société
CREATE TABLE establishment (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES compta.company(id),
  code          varchar(10) NOT NULL,
  label         text NOT NULL,
  city          text,
  address       text,
  cnps_employer text,
  at_rate       numeric(5,2) NOT NULL CHECK (at_rate IN (1.75, 2.5, 5)),
  commune       text,
  UNIQUE (company_id, code)
);

CREATE TABLE convention (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES compta.company(id),
  code        varchar(20) NOT NULL,
  label       text NOT NULL,
  seniority   jsonb NOT NULL DEFAULT '[]',     -- paliers d'ancienneté [{years, rate}]
  UNIQUE (company_id, code)
);

-- Grille catégorielle datée (minimum conventionnel → anomalie B02)
CREATE TABLE convention_grade (
  convention_id uuid NOT NULL REFERENCES convention(id) ON DELETE CASCADE,
  company_id    uuid NOT NULL REFERENCES compta.company(id),
  category      varchar(10) NOT NULL,
  valid_from    date NOT NULL,
  min_salary    bigint NOT NULL CHECK (min_salary > 0),
  PRIMARY KEY (convention_id, category, valid_from)
);

-- Rubriques de la société (copiées du pack puis personnalisables), versionnées.
CREATE TABLE rubric (
  id          bigserial PRIMARY KEY,
  company_id  uuid NOT NULL REFERENCES compta.company(id),
  code        varchar(20) NOT NULL,
  version     int NOT NULL DEFAULT 1,
  valid_from  date NOT NULL,
  label       text NOT NULL,
  label_en    text,
  kind        rubric_kind NOT NULL,
  ord         int NOT NULL,                  -- 100-499 gains, 600 cotisations, 700 impôts, 800 retenues
  cond_expr   text,                          -- condition d'apparition (langage d'expression, docs/paie/02)
  base_expr   text,
  qty_expr    text,
  rate_expr   text,
  amount_expr text,
  pat_rate_expr text,
  taxable     boolean NOT NULL DEFAULT true,
  cnps        boolean NOT NULL DEFAULT true,
  account_group varchar(20) NOT NULL DEFAULT 'salaire',
  active      boolean NOT NULL DEFAULT true,
  UNIQUE (company_id, code, version)
);

CREATE TABLE account_mapping (
  company_id  uuid NOT NULL REFERENCES compta.company(id),
  grp         varchar(20) NOT NULL,
  role        varchar(20) NOT NULL,          -- debit, debitExpat, credit, salCredit, patDebit, patCredit
  account_num varchar(12) NOT NULL,
  PRIMARY KEY (company_id, grp, role)
);

-- ------------------------------------------------------------ salariés
CREATE TABLE employee (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     uuid NOT NULL REFERENCES compta.company(id),
  matricule      varchar(12) NOT NULL,
  last_name      text NOT NULL,
  first_name     text NOT NULL,
  sex            char(1) CHECK (sex IN ('M', 'F')),
  birth_date     date,
  family_status  text,
  children       smallint NOT NULL DEFAULT 0 CHECK (children >= 0),
  email          text,
  phone          text,
  job_title      text NOT NULL,
  department     text,
  analytic_code  varchar(12),
  establishment_id uuid NOT NULL REFERENCES establishment(id),
  convention_id  uuid NOT NULL REFERENCES convention(id),
  category       varchar(10) NOT NULL,
  contract       contract_type NOT NULL,
  hire_date      date NOT NULL,
  contract_end   date,
  trial_end      date,
  exit_date      date,
  exit_reason    text,
  expatriate     boolean NOT NULL DEFAULT false,
  manager_id     uuid REFERENCES employee(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, matricule),
  CHECK (contract <> 'CDD' OR contract_end IS NOT NULL),
  CHECK (exit_date IS NULL OR exit_date >= hire_date)
);

-- Données sensibles isolées : seuls les rôles pay.sensitive y accèdent (voir policies plus bas).
CREATE TABLE employee_sensitive (
  employee_id   uuid PRIMARY KEY REFERENCES employee(id) ON DELETE CASCADE,
  company_id    uuid NOT NULL REFERENCES compta.company(id),
  base_salary   bigint NOT NULL CHECK (base_salary > 0),
  monthly_hours numeric(6,2) NOT NULL DEFAULT 173.33,
  id_number     text,           -- CNI / passeport
  cnps_number   text,
  niu           text,
  pay_mode      pay_mode NOT NULL DEFAULT 'virement',
  bank_name     text,
  iban_rib      text,
  momo_number   text,
  fixed_items   jsonb NOT NULL DEFAULT '{}'   -- éléments fixes : {IND_LOG: 150000, AN_VEH: true, ...}
);

-- Historique des modifications de dossier (qui, quand, avant → après)
CREATE TABLE employee_history (
  id          bigserial PRIMARY KEY,
  employee_id uuid NOT NULL REFERENCES employee(id) ON DELETE CASCADE,
  company_id  uuid NOT NULL REFERENCES compta.company(id),
  at          timestamptz NOT NULL DEFAULT now(),
  user_name   text NOT NULL,
  field       text NOT NULL,
  old_value   text,
  new_value   text,
  sensitive   boolean NOT NULL DEFAULT false
);

CREATE TABLE leave_balance (
  employee_id uuid PRIMARY KEY REFERENCES employee(id) ON DELETE CASCADE,
  company_id  uuid NOT NULL REFERENCES compta.company(id),
  acquired    numeric(6,2) NOT NULL DEFAULT 0,
  taken       numeric(6,2) NOT NULL DEFAULT 0
);

-- ------------------------------------------------------ périodes & paie
CREATE TABLE pay_period (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES compta.company(id),
  pkey          char(7) NOT NULL CHECK (pkey ~ '^\d{4}-\d{2}$'),
  status        period_status NOT NULL DEFAULT 'preparation',
  pack_version  text NOT NULL,                -- ex. 'CM 2026.10' : versions figées au calcul
  prepared_by   text,
  submitted_by  text,
  submitted_at  timestamptz,
  approved_by   text,
  approved_at   timestamptz,
  closed_by     text,
  closed_at     timestamptz,
  hash          char(64),                     -- empreinte de l'ensemble des bulletins à la validation
  batch_ref     text,                         -- lot comptable intégré (PAIE-AAAA-MM)
  UNIQUE (company_id, pkey),
  -- RG-P10 : séparation des tâches
  CHECK (approved_by IS NULL OR approved_by <> submitted_by)
);

-- Éléments variables saisis, importés (GTA) ou automatiques (avances, prêts)
CREATE TABLE pay_variable (
  id          bigserial PRIMARY KEY,
  period_id   uuid NOT NULL REFERENCES pay_period(id) ON DELETE CASCADE,
  company_id  uuid NOT NULL REFERENCES compta.company(id),
  employee_id uuid NOT NULL REFERENCES employee(id),
  code        varchar(20) NOT NULL,
  qty         numeric(12,2),
  amount      bigint,
  origin      varchar(12) NOT NULL DEFAULT 'saisie' CHECK (origin IN ('saisie', 'import', 'gta', 'auto', 'regul')),
  comment     text,
  created_by  text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Événements de temps reçus de la GTA (format myyiel.time-events/1), dédoublonnés par source_id
CREATE TABLE time_event (
  id          bigserial PRIMARY KEY,
  company_id  uuid NOT NULL REFERENCES compta.company(id),
  source_id   text NOT NULL,
  employee_id uuid NOT NULL REFERENCES employee(id),
  ev_date     date NOT NULL,
  type        varchar(12) NOT NULL,
  qty         numeric(8,2) NOT NULL,
  approved    boolean NOT NULL DEFAULT true,
  period_id   uuid REFERENCES pay_period(id),
  UNIQUE (company_id, source_id)
);

CREATE TABLE payslip (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id   uuid NOT NULL REFERENCES pay_period(id),
  company_id  uuid NOT NULL REFERENCES compta.company(id),
  employee_id uuid NOT NULL REFERENCES employee(id),
  brut        bigint NOT NULL,
  nature      bigint NOT NULL DEFAULT 0,
  brut_taxable bigint NOT NULL,
  base_cnps   bigint NOT NULL,
  cot_sal     bigint NOT NULL,
  impots      bigint NOT NULL,
  retenues    bigint NOT NULL,
  net         bigint NOT NULL,
  employer    bigint NOT NULL,
  cost        bigint NOT NULL,
  snapshot    jsonb NOT NULL,              -- contexte figé : paramètres, barèmes, variables, dossier
  hash        char(64),
  signed_at   timestamptz,
  signed_by   text,
  sent_email_at timestamptz,
  sent_whatsapp_at timestamptz,
  UNIQUE (period_id, employee_id),
  CHECK (brut - cot_sal - impots - retenues - nature = net)
);

CREATE TABLE payslip_line (
  payslip_id  uuid NOT NULL REFERENCES payslip(id) ON DELETE CASCADE,
  company_id  uuid NOT NULL REFERENCES compta.company(id),
  line_no     smallint NOT NULL,
  code        varchar(20) NOT NULL,
  label       text NOT NULL,
  kind        rubric_kind NOT NULL,
  base        bigint,
  qty         numeric(12,2),
  rate        numeric(9,4),
  gain        bigint NOT NULL DEFAULT 0,
  deduction   bigint NOT NULL DEFAULT 0,
  pat_rate    numeric(9,4),
  pat_amount  bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (payslip_id, line_no)
);

CREATE TABLE anomaly (
  id          bigserial PRIMARY KEY,
  period_id   uuid NOT NULL REFERENCES pay_period(id) ON DELETE CASCADE,
  company_id  uuid NOT NULL REFERENCES compta.company(id),
  employee_id uuid REFERENCES employee(id),
  code        char(3) NOT NULL,
  level       anomaly_level NOT NULL,
  message     text NOT NULL,
  acknowledged_by text,                    -- non bloquante : prise en compte motivée
  ack_comment text
);

-- Période validée : bulletins et lignes immuables (RG-P12), sauf signature et horodatages d'envoi.
CREATE FUNCTION trg_payslip_frozen() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE st period_status;
BEGIN
  SELECT status INTO st FROM paie.pay_period WHERE id = COALESCE(OLD.period_id, NEW.period_id);
  IF st IN ('validee', 'cloturee') THEN
    IF TG_OP = 'UPDATE' AND (NEW.brut, NEW.net, NEW.cot_sal, NEW.impots, NEW.retenues, NEW.employer, NEW.snapshot, NEW.hash)
                        IS NOT DISTINCT FROM (OLD.brut, OLD.net, OLD.cot_sal, OLD.impots, OLD.retenues, OLD.employer, OLD.snapshot, OLD.hash) THEN
      RETURN NEW;   -- seuls signature / envoi changent
    END IF;
    RAISE EXCEPTION 'RG-P12 : période % gelée, passez par une régularisation sur la période ouverte', st;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
CREATE TRIGGER payslip_frozen BEFORE UPDATE OR DELETE ON payslip FOR EACH ROW EXECUTE FUNCTION trg_payslip_frozen();

CREATE FUNCTION trg_line_frozen() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE st period_status;
BEGIN
  SELECT p.status INTO st FROM paie.payslip s JOIN paie.pay_period p ON p.id = s.period_id WHERE s.id = COALESCE(OLD.payslip_id, NEW.payslip_id);
  IF st IN ('validee', 'cloturee') THEN RAISE EXCEPTION 'RG-P12 : lignes d''un bulletin validé non modifiables'; END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
CREATE TRIGGER payslip_line_frozen BEFORE INSERT OR UPDATE OR DELETE ON payslip_line FOR EACH ROW EXECUTE FUNCTION trg_line_frozen();

-- Validation impossible avec une anomalie bloquante ; transitions de statut contrôlées.
CREATE FUNCTION trg_period_transition() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  IF OLD.status = 'cloturee' THEN RAISE EXCEPTION 'RG-P13 : période clôturée'; END IF;
  IF NEW.status IN ('soumise', 'validee') AND EXISTS (SELECT 1 FROM paie.anomaly WHERE period_id = NEW.id AND level = 'bloquante') THEN
    RAISE EXCEPTION 'RG-P11 : anomalies bloquantes non corrigées';
  END IF;
  IF NEW.status = 'validee' AND OLD.status <> 'soumise' THEN RAISE EXCEPTION 'RG-P10 : seule une paie soumise peut être validée'; END IF;
  IF NEW.status = 'cloturee' AND (OLD.status <> 'validee' OR NEW.batch_ref IS NULL) THEN RAISE EXCEPTION 'RG-P13 : clôture après validation et intégration comptable'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER period_transition BEFORE UPDATE ON pay_period FOR EACH ROW EXECUTE FUNCTION trg_period_transition();

-- Signature : cachet + signature DRH, une seule fois par bulletin (RG-P20)
CREATE TABLE signature_specimen (
  company_id  uuid PRIMARY KEY REFERENCES compta.company(id),
  signer_name text NOT NULL,
  signer_title text NOT NULL,
  signature_png bytea NOT NULL,
  stamp_png   bytea,
  updated_by  text NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE FUNCTION trg_sign_once() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.signed_at IS NOT NULL AND NEW.signed_at IS DISTINCT FROM OLD.signed_at THEN
    RAISE EXCEPTION 'RG-P20 : bulletin déjà signé le %', OLD.signed_at;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER payslip_sign_once BEFORE UPDATE OF signed_at ON payslip FOR EACH ROW EXECUTE FUNCTION trg_sign_once();

-- ---------------------------------------------- avances, prêts, sorties
CREATE TABLE advance (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES compta.company(id),
  employee_id uuid NOT NULL REFERENCES employee(id),
  requested_at date NOT NULL,
  amount      bigint NOT NULL CHECK (amount > 0),
  retain_pkey char(7) NOT NULL,            -- période de retenue (après la date limite → mois suivant)
  status      advance_status NOT NULL DEFAULT 'demandee',
  reason      text,
  decided_by  text,
  entry_ref   text                         -- écriture de versement (421 / trésorerie)
);

CREATE TABLE loan (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES compta.company(id),
  employee_id uuid NOT NULL REFERENCES employee(id),
  amount      bigint NOT NULL CHECK (amount > 0),
  monthly     bigint NOT NULL CHECK (monthly > 0),
  start_pkey  char(7) NOT NULL,
  remaining   bigint NOT NULL CHECK (remaining >= 0),
  entry_ref   text
);

CREATE TABLE employee_exit (
  employee_id uuid PRIMARY KEY REFERENCES employee(id),
  company_id  uuid NOT NULL REFERENCES compta.company(id),
  exit_date   date NOT NULL,
  reason      text NOT NULL,
  notice_comp bigint NOT NULL DEFAULT 0,
  leave_comp  bigint NOT NULL DEFAULT 0,
  severance   bigint NOT NULL DEFAULT 0,
  stc_pkey    char(7) NOT NULL,            -- période portant le solde de tout compte
  documents   jsonb NOT NULL DEFAULT '[]'  -- certificat de travail, reçu pour solde, attestation CNPS
);

-- ------------------------------------------- virements & déclarations
CREATE TABLE bank_advisor (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES compta.company(id),
  bank        text NOT NULL,
  name        text NOT NULL,
  email       text NOT NULL,
  phone       text,
  cash_account_num varchar(12) NOT NULL
);

CREATE TABLE transfer_order (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES compta.company(id),
  reference   varchar(30) NOT NULL,         -- OV-AAAA-MM-NN
  period_id   uuid NOT NULL REFERENCES pay_period(id),
  advisor_id  uuid REFERENCES bank_advisor(id),
  motif       text NOT NULL,
  comment     text,
  value_date  date NOT NULL,
  total       bigint NOT NULL CHECK (total > 0),
  lines       int NOT NULL,
  confidentiality varchar(10) NOT NULL CHECK (confidentiality IN ('matricule', 'complet')),
  status      order_status NOT NULL DEFAULT 'brouillon',
  created_by  text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  validated_by text,
  sent_at     timestamptz,
  executed_at timestamptz,
  entry_ref   text,
  history     jsonb NOT NULL DEFAULT '[]',
  UNIQUE (company_id, reference),
  CHECK (validated_by IS NULL OR validated_by <> created_by)
);

CREATE TABLE declaration (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES compta.company(id),
  period_id   uuid NOT NULL REFERENCES pay_period(id),
  organism    varchar(10) NOT NULL CHECK (organism IN ('CNPS', 'DGI', 'COMMUNE')),
  amount      bigint NOT NULL,
  due_date    date NOT NULL,
  status      decl_status NOT NULL DEFAULT 'a_declarer',
  transmitted_by text,
  transmitted_at timestamptz,
  receipt     text,
  paid_at     date,
  entry_ref   text,
  UNIQUE (period_id, organism)
);

-- RG-P30 : télétransmission CNPS uniquement après intégration comptable de la paie
CREATE FUNCTION trg_decl_after_posting() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status <> 'a_declarer' AND OLD.status = 'a_declarer'
     AND (SELECT batch_ref FROM paie.pay_period WHERE id = NEW.period_id) IS NULL THEN
    RAISE EXCEPTION 'RG-P30 : écritures de paie non intégrées en comptabilité';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER declaration_after_posting BEFORE UPDATE ON declaration FOR EACH ROW EXECUTE FUNCTION trg_decl_after_posting();

-- -------------------------------------------------- paramètres société
CREATE TABLE pay_setting (
  company_id         uuid PRIMARY KEY REFERENCES compta.company(id),
  country            char(2) NOT NULL REFERENCES country_pack(code),
  pay_day            smallint NOT NULL DEFAULT 28 CHECK (pay_day BETWEEN 1 AND 31),
  advance_cutoff_day smallint NOT NULL DEFAULT 15 CHECK (advance_cutoff_day BETWEEN 1 AND 31),
  advance_max_month  smallint NOT NULL DEFAULT 1,
  confidentiality    varchar(10) NOT NULL DEFAULT 'matricule',
  bulletin_lang      char(2) NOT NULL DEFAULT 'fr',
  notify             jsonb NOT NULL DEFAULT '{}'
);

-- ------------------------------------------------------------- RLS
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['establishment','convention','convention_grade','rubric','account_mapping','employee','employee_history',
    'leave_balance','pay_period','pay_variable','time_event','payslip','payslip_line','anomaly','signature_specimen','advance','loan',
    'employee_exit','bank_advisor','transfer_order','declaration','pay_setting'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON %I USING (company_id = current_setting(''app.company_id'', true)::uuid) WITH CHECK (company_id = current_setting(''app.company_id'', true)::uuid)', t || '_tenant', t);
  END LOOP;
END $$;

-- Données sensibles : société ET droit pay.sensitive (positionné par l'API : SET app.pay_sensitive = 'on')
ALTER TABLE employee_sensitive ENABLE ROW LEVEL SECURITY;
CREATE POLICY employee_sensitive_guard ON employee_sensitive
  USING (company_id = current_setting('app.company_id', true)::uuid AND current_setting('app.pay_sensitive', true) = 'on')
  WITH CHECK (company_id = current_setting('app.company_id', true)::uuid AND current_setting('app.pay_sensitive', true) = 'on');

-- Vue non sensible : effectif sans salaire ni RIB (pour managers, lecteurs)
CREATE VIEW employee_public WITH (security_barrier) AS
  SELECT id, company_id, matricule, last_name, first_name, job_title, department, establishment_id, convention_id, category, contract, hire_date, exit_date
    FROM employee;

-- ------------------------------------------------------- pack Cameroun (extrait)
INSERT INTO country_pack VALUES ('CM', 'Cameroun', 'XAF');
INSERT INTO param_def (country, code, label, unit, source) VALUES
 ('CM', 'SMIG', 'Salaire minimum interprofessionnel garanti', 'XAF', 'Décret n° 2024/0168/PM'),
 ('CM', 'CNPS_PLAFOND', 'Plafond mensuel CNPS', 'XAF', 'CNPS'),
 ('CM', 'PVID_SAL', 'Pension vieillesse, part salariale', '%', 'CNPS'),
 ('CM', 'PVID_PAT', 'Pension vieillesse, part patronale', '%', 'CNPS'),
 ('CM', 'PF_PAT', 'Prestations familiales', '%', 'CNPS'),
 ('CM', 'CFC_SAL', 'Crédit foncier, part salariale', '%', 'CGI'),
 ('CM', 'CFC_PAT', 'Crédit foncier, part patronale', '%', 'CGI'),
 ('CM', 'FNE_PAT', 'Fonds national de l''emploi', '%', 'CGI'),
 ('CM', 'ABATT_FP', 'Abattement frais professionnels IRPP', '%', 'CGI art. 33'),
 ('CM', 'ABATT_IRPP_AN', 'Abattement annuel IRPP', 'XAF', 'CGI'),
 ('CM', 'CAC_TAUX', 'Centimes additionnels communaux', '%', 'CGI');
INSERT INTO param_version (country, code, valid_from, value, reason, created_by) VALUES
 ('CM', 'SMIG', '2014-07-01', 36270, 'Décret 2014', 'pack'),
 ('CM', 'SMIG', '2023-03-21', 41875, 'Décret 2023', 'pack'),
 ('CM', 'SMIG', '2024-02-23', 43969, 'Décret n° 2024/0168/PM', 'pack'),
 ('CM', 'CNPS_PLAFOND', '2016-01-01', 750000, 'CNPS', 'pack'),
 ('CM', 'PVID_SAL', '2016-01-01', 4.2, 'CNPS', 'pack'),
 ('CM', 'PVID_PAT', '2016-01-01', 4.2, 'CNPS', 'pack'),
 ('CM', 'PF_PAT', '2016-01-01', 7, 'CNPS régime général', 'pack'),
 ('CM', 'CFC_SAL', '2000-01-01', 1, 'CGI', 'pack'),
 ('CM', 'CFC_PAT', '2000-01-01', 1.5, 'CGI', 'pack'),
 ('CM', 'FNE_PAT', '2000-01-01', 1, 'CGI', 'pack'),
 ('CM', 'ABATT_FP', '2000-01-01', 30, 'CGI', 'pack'),
 ('CM', 'ABATT_IRPP_AN', '2000-01-01', 500000, 'CGI', 'pack'),
 ('CM', 'CAC_TAUX', '2000-01-01', 10, 'CGI', 'pack');
INSERT INTO bareme_def VALUES ('CM', 'IRPP', 'Barème annuel IRPP', 'progressif');
INSERT INTO bareme_version (country, code, valid_from, rows, reason, created_by) VALUES
 ('CM', 'IRPP', '2004-01-01', '[{"upTo":2000000,"rate":10},{"upTo":3000000,"rate":15},{"upTo":5000000,"rate":25},{"upTo":null,"rate":35}]', 'CGI art. 69', 'pack');

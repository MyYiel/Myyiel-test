-- =====================================================================
-- myyiel Comptabilité · schéma PostgreSQL de référence (15+)
-- Multi-tenant (RLS), montants en BIGINT (XAF/XOF sans décimales),
-- intangibilité et équilibre des écritures garantis en base,
-- numérotation continue, piste d'audit chaînée en ajout seul.
-- Vérifié sur PostgreSQL 16 : création complète + scénario de test
-- (docs/schema-test.sql).
-- =====================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP SCHEMA IF EXISTS compta CASCADE;
CREATE SCHEMA compta;
SET search_path = compta, public;

-- ---------------------------------------------------------------- types
CREATE TYPE entry_status   AS ENUM ('draft', 'validated');
CREATE TYPE journal_type   AS ENUM ('opening', 'purchase', 'sale', 'bank', 'cash', 'misc', 'payroll');
CREATE TYPE party_type     AS ENUM ('client', 'fournisseur', 'personnel', 'associe');
CREATE TYPE account_nature AS ENUM ('general', 'tiers', 'tresorerie', 'analytique');
CREATE TYPE member_role    AS ENUM ('owner', 'accountant', 'reader');
CREATE TYPE doc_type       AS ENUM ('DV', 'FA', 'AV');
CREATE TYPE cash_kind      AS ENUM ('bank', 'momo', 'cash');

-- ---------------------------------------------------- tenants & sociétés
CREATE TABLE tenant (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE company (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenant(id),
  name             text NOT NULL,
  legal_form       text NOT NULL DEFAULT 'SARL',
  niu              text,
  rccm             text,
  capital          bigint NOT NULL DEFAULT 0 CHECK (capital >= 0),
  address          text,
  city             text,
  country          text NOT NULL DEFAULT 'Cameroun',
  currency         char(3) NOT NULL DEFAULT 'XAF' CHECK (currency IN ('XAF', 'XOF')),
  framework        text NOT NULL DEFAULT 'SYSCOHADA révisé',
  system           text NOT NULL DEFAULT 'normal' CHECK (system IN ('normal', 'smt')),
  tax_regime       text NOT NULL DEFAULT 'Réel',
  tax_center       text,
  cnps_number      text,
  statements_lang  char(2) NOT NULL DEFAULT 'fr',
  invoice_footer   text,
  iban             text,
  momo_merchant    text,
  om_merchant      text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

-- Paramètres versionnés (taux IS, minimum, IRCM, réserve légale, taux sociaux, intégrations…)
CREATE TABLE company_setting (
  company_id  uuid NOT NULL REFERENCES company(id),
  key         text NOT NULL,
  value       jsonb NOT NULL,
  valid_from  date NOT NULL DEFAULT current_date,
  PRIMARY KEY (company_id, key, valid_from)
);

-- ------------------------------------------------- utilisateurs & droits
CREATE TABLE app_user (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email        text NOT NULL,
  name         text NOT NULL,
  mfa_enabled  boolean NOT NULL DEFAULT true,
  last_login   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX app_user_email_uq ON app_user (lower(email));

CREATE TABLE membership (
  user_id     uuid NOT NULL REFERENCES app_user(id),
  company_id  uuid NOT NULL REFERENCES company(id),
  role        member_role NOT NULL,
  invited_at  timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  PRIMARY KEY (user_id, company_id)
);

-- ------------------------------------------------------- référentiels
CREATE TABLE account (
  company_id         uuid NOT NULL REFERENCES company(id),
  num                varchar(10) NOT NULL CHECK (num ~ '^[1-9][0-9]{1,9}$'),
  label              text NOT NULL,
  label_en           text,
  class              smallint GENERATED ALWAYS AS (substr(num, 1, 1)::smallint) STORED,
  normal_side        char(1) CHECK (normal_side IN ('D', 'C')),
  nature             account_nature NOT NULL DEFAULT 'general',
  lettrable          boolean NOT NULL DEFAULT false,
  bank_reconcile     boolean NOT NULL DEFAULT false,
  analytic_required  boolean NOT NULL DEFAULT false,
  default_tax_code   text,
  active             boolean NOT NULL DEFAULT true,
  custom             boolean NOT NULL DEFAULT false,
  PRIMARY KEY (company_id, num)
);

CREATE TABLE journal (
  company_id   uuid NOT NULL REFERENCES company(id),
  code         varchar(6) NOT NULL CHECK (code ~ '^[A-Z0-9]{2,6}$'),
  label        text NOT NULL,
  type         journal_type NOT NULL,
  counterpart  varchar(10),
  seq_format   text NOT NULL CHECK (seq_format ~ '\{0+\}'),
  source       text,
  active       boolean NOT NULL DEFAULT true,
  system       boolean NOT NULL DEFAULT false,
  PRIMARY KEY (company_id, code),
  FOREIGN KEY (company_id, counterpart) REFERENCES account(company_id, num),
  CHECK (type <> 'bank' OR counterpart IS NOT NULL)
);

CREATE TABLE journal_sequence (
  company_id    uuid NOT NULL,
  journal_code  varchar(6) NOT NULL,
  year          smallint NOT NULL,
  last_value    integer NOT NULL DEFAULT 0,
  PRIMARY KEY (company_id, journal_code, year),
  FOREIGN KEY (company_id, journal_code) REFERENCES journal(company_id, code)
);

CREATE TABLE tax_code (
  company_id      uuid NOT NULL REFERENCES company(id),
  code            varchar(12) NOT NULL,
  label           text NOT NULL,
  rate            numeric(5,2) NOT NULL CHECK (rate >= 0),
  principal       numeric(5,2) NOT NULL DEFAULT 0,
  cac             numeric(5,2) NOT NULL DEFAULT 0,
  collect_account varchar(10),
  deduct_goods    varchar(10),
  deduct_assets   varchar(10),
  deductible      boolean NOT NULL DEFAULT true,
  active          boolean NOT NULL DEFAULT true,
  valid_from      date NOT NULL DEFAULT '2000-01-01',
  PRIMARY KEY (company_id, code, valid_from),
  CHECK (principal + cac = rate)
);

CREATE TABLE analytic_section (
  company_id  uuid NOT NULL REFERENCES company(id),
  code        varchar(8) NOT NULL,
  label       text NOT NULL,
  axis        text NOT NULL DEFAULT 'ACT' CHECK (axis IN ('ACT', 'SIT', 'PRJ')),
  type        text NOT NULL DEFAULT 'principale' CHECK (type IN ('principale', 'auxiliaire')),
  owner       text,
  active      boolean NOT NULL DEFAULT true,
  PRIMARY KEY (company_id, code)
);

CREATE TABLE allocation_key (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES company(id),
  label         text NOT NULL,
  from_section  varchar(8) NOT NULL,
  base          text,
  FOREIGN KEY (company_id, from_section) REFERENCES analytic_section(company_id, code)
);
CREATE TABLE allocation_key_share (
  key_id      uuid NOT NULL REFERENCES allocation_key(id) ON DELETE CASCADE,
  company_id  uuid NOT NULL,
  section     varchar(8) NOT NULL,
  pct         numeric(6,3) NOT NULL CHECK (pct > 0 AND pct <= 100),
  PRIMARY KEY (key_id, section),
  FOREIGN KEY (company_id, section) REFERENCES analytic_section(company_id, code)
);
CREATE TABLE analytic_budget (
  company_id  uuid NOT NULL REFERENCES company(id),
  year        smallint NOT NULL,
  section     varchar(8) NOT NULL,
  products    bigint NOT NULL DEFAULT 0,
  charges     bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (company_id, year, section),
  FOREIGN KEY (company_id, section) REFERENCES analytic_section(company_id, code)
);

-- ---------------------------------------------------- exercices & périodes
CREATE TABLE fiscal_year (
  company_id  uuid NOT NULL REFERENCES company(id),
  year        smallint NOT NULL,
  start_date  date NOT NULL,
  end_date    date NOT NULL,
  status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  closed_at   timestamptz,
  PRIMARY KEY (company_id, year),
  CHECK (end_date > start_date)
);
CREATE TABLE period (
  company_id  uuid NOT NULL,
  year        smallint NOT NULL,
  month       smallint NOT NULL CHECK (month BETWEEN 1 AND 12),
  locked      boolean NOT NULL DEFAULT false,
  locked_at   timestamptz,
  locked_by   uuid REFERENCES app_user(id),
  PRIMARY KEY (company_id, year, month),
  FOREIGN KEY (company_id, year) REFERENCES fiscal_year(company_id, year)
);

-- ---------------------------------------------------------------- tiers
CREATE TABLE third_party (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES company(id),
  code          varchar(12) NOT NULL,
  type          party_type NOT NULL,
  name          text NOT NULL,
  collective    varchar(10) NOT NULL,
  niu           text CHECK (niu IS NULL OR niu ~* '^[A-Z0-9]{8,20}$'),
  rccm          text,
  regime        text,
  email         text,
  phone         text,
  momo          text CHECK (momo IS NULL OR momo ~ '^\+?[0-9][0-9 ]{7,20}$'),
  momo_operator text CHECK (momo_operator IS NULL OR momo_operator IN ('MTN', 'Orange')),
  address       text, city text, country text,
  terms_days    smallint NOT NULL DEFAULT 30,
  credit_limit  bigint NOT NULL DEFAULT 0,
  notes         text,
  active        boolean NOT NULL DEFAULT true,
  UNIQUE (company_id, code),
  FOREIGN KEY (company_id, collective) REFERENCES account(company_id, num)
);

-- ------------------------------------------------------------- écritures
CREATE TABLE entry (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES company(id),
  journal_code  varchar(6) NOT NULL,
  number        text,                      -- attribué à la validation (RG-E11)
  status        entry_status NOT NULL DEFAULT 'draft',
  date          date NOT NULL,
  piece_date    date,
  ref           text,
  label         text NOT NULL CHECK (length(trim(label)) > 0),
  source        text NOT NULL DEFAULT 'manual',
  reversal_of   uuid REFERENCES entry(id),
  reversed_by   uuid REFERENCES entry(id),
  is_inventory  boolean NOT NULL DEFAULT false,   -- à extourner au 01/01/N+1
  created_by    uuid REFERENCES app_user(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  validated_by  uuid REFERENCES app_user(id),
  validated_at  timestamptz,
  FOREIGN KEY (company_id, journal_code) REFERENCES journal(company_id, code),
  CHECK ((status = 'draft' AND number IS NULL) OR (status = 'validated' AND number IS NOT NULL AND validated_at IS NOT NULL))
);
CREATE UNIQUE INDEX entry_number_uq ON entry (company_id, journal_code, number) WHERE status = 'validated';
CREATE INDEX entry_date_ix ON entry (company_id, date);
CREATE UNIQUE INDEX entry_reversal_once ON entry (reversal_of) WHERE reversal_of IS NOT NULL;

CREATE TABLE entry_line (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id        uuid NOT NULL REFERENCES entry(id) ON DELETE CASCADE,
  company_id      uuid NOT NULL,
  line_no         smallint NOT NULL,
  account_num     varchar(10) NOT NULL,
  label           text,
  debit           bigint NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit          bigint NOT NULL DEFAULT 0 CHECK (credit >= 0),
  third_party_id  uuid REFERENCES third_party(id),
  section         varchar(8),
  tax_code        varchar(12),
  due_date        date,
  letter          varchar(8),               -- MAJUSCULE = total, minuscule = partiel
  reconciled_tx   uuid,                     -- bank_transaction.id
  UNIQUE (entry_id, line_no),
  FOREIGN KEY (company_id, account_num) REFERENCES account(company_id, num),
  FOREIGN KEY (company_id, section) REFERENCES analytic_section(company_id, code),
  CHECK ((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0))   -- RG-E03
);
CREATE INDEX entry_line_account_ix ON entry_line (company_id, account_num);
CREATE INDEX entry_line_open_tiers_ix ON entry_line (company_id, third_party_id) WHERE letter IS NULL;

CREATE TABLE attachment (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES company(id),
  entry_id    uuid REFERENCES entry(id),
  file_name   text NOT NULL,
  mime        text NOT NULL,
  size_bytes  bigint NOT NULL,
  sha256      char(64) NOT NULL,
  storage_key text NOT NULL,                -- objet S3 chiffré
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

-- -------------------------------------------- règles en base (écritures)
-- RG-E12 : intangibilité des écritures validées
CREATE FUNCTION trg_entry_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'validated' THEN RAISE EXCEPTION 'RG-E12 : une écriture validée ne peut pas être supprimée (contre-passez-la)'; END IF;
    RETURN OLD;
  END IF;
  IF OLD.status = 'validated' THEN
    IF NEW.journal_code <> OLD.journal_code OR NEW.number <> OLD.number OR NEW.date <> OLD.date OR NEW.label <> OLD.label
       OR NEW.status <> OLD.status OR NEW.company_id <> OLD.company_id THEN
      RAISE EXCEPTION 'RG-E12 : écriture % validée, modification interdite', OLD.number;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER entry_immutable BEFORE UPDATE OR DELETE ON entry FOR EACH ROW EXECUTE FUNCTION trg_entry_immutable();

-- Lignes : seules lettre, rapprochement et section restent modifiables après validation
CREATE FUNCTION trg_line_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE st entry_status;
BEGIN
  SELECT status INTO st FROM entry WHERE id = COALESCE(NEW.entry_id, OLD.entry_id);
  IF st = 'validated' THEN
    IF TG_OP IN ('INSERT', 'DELETE') THEN RAISE EXCEPTION 'RG-E12 : lignes d''une écriture validée non modifiables'; END IF;
    IF NEW.account_num <> OLD.account_num OR NEW.debit <> OLD.debit OR NEW.credit <> OLD.credit
       OR NEW.third_party_id IS DISTINCT FROM OLD.third_party_id OR NEW.line_no <> OLD.line_no THEN
      RAISE EXCEPTION 'RG-E12 : seuls le lettrage, le rapprochement et la section sont modifiables après validation';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
CREATE TRIGGER line_immutable BEFORE INSERT OR UPDATE OR DELETE ON entry_line FOR EACH ROW EXECUTE FUNCTION trg_line_immutable();

-- RG-E02 : équilibre vérifié en fin de transaction (contrainte différée)
CREATE FUNCTION trg_entry_balanced() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE d bigint; c bigint; n int; st entry_status; eid uuid;
BEGIN
  eid := COALESCE(NEW.id, OLD.id);
  SELECT status INTO st FROM entry WHERE id = eid;
  IF st IS DISTINCT FROM 'validated' THEN RETURN NULL; END IF;
  SELECT COALESCE(sum(debit), 0), COALESCE(sum(credit), 0), count(*) INTO d, c, n FROM entry_line WHERE entry_id = eid;
  IF n < 2 THEN RAISE EXCEPTION 'RG-E01 : une écriture comporte au moins deux lignes'; END IF;
  IF d <> c THEN RAISE EXCEPTION 'RG-E02 : écriture déséquilibrée (débit % ≠ crédit %)', d, c; END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER entry_balanced AFTER INSERT OR UPDATE ON entry
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION trg_entry_balanced();

-- RG-E05 / RG-E09 : compte de détail et période ouverte, contrôlés à la validation
CREATE FUNCTION trg_entry_validate() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE bad text; fy_status text; per_locked boolean;
BEGIN
  IF NEW.status = 'validated' AND (TG_OP = 'INSERT' OR OLD.status = 'draft') THEN
    SELECT status INTO fy_status FROM fiscal_year WHERE company_id = NEW.company_id AND year = extract(year FROM NEW.date);
    IF fy_status IS NULL THEN RAISE EXCEPTION 'RG-E09 : aucun exercice pour %', NEW.date; END IF;
    IF NEW.journal_code <> 'AN' AND NEW.source NOT IN ('inventory', 'income-tax', 'opening', 'extourne') THEN
      IF fy_status = 'closed' THEN RAISE EXCEPTION 'RG-E09 : exercice clôturé'; END IF;
      SELECT locked INTO per_locked FROM period WHERE company_id = NEW.company_id AND year = extract(year FROM NEW.date) AND month = extract(month FROM NEW.date);
      IF per_locked THEN RAISE EXCEPTION 'RG-E09 : période verrouillée'; END IF;
    END IF;
    SELECT l.account_num INTO bad FROM entry_line l
      WHERE l.entry_id = NEW.id AND (EXISTS (SELECT 1 FROM account a WHERE a.company_id = l.company_id AND a.num <> l.account_num AND a.num LIKE l.account_num || '%')
                                      OR substr(l.account_num, 1, 1) = '9')
      LIMIT 1;
    IF bad IS NOT NULL THEN RAISE EXCEPTION 'RG-E05 : le compte % n''est pas imputable', bad; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER entry_validate BEFORE INSERT OR UPDATE ON entry FOR EACH ROW EXECUTE FUNCTION trg_entry_validate();

-- RG-E11 : numérotation continue (appelée dans la transaction de validation)
CREATE FUNCTION next_entry_number(p_company uuid, p_journal varchar, p_year smallint) RETURNS text LANGUAGE plpgsql AS $$
DECLARE v integer; fmt text;
BEGIN
  INSERT INTO journal_sequence (company_id, journal_code, year, last_value) VALUES (p_company, p_journal, p_year, 0)
    ON CONFLICT DO NOTHING;
  UPDATE journal_sequence SET last_value = last_value + 1
    WHERE company_id = p_company AND journal_code = p_journal AND year = p_year RETURNING last_value INTO v;   -- verrou de ligne
  SELECT seq_format INTO fmt FROM journal WHERE company_id = p_company AND code = p_journal;
  RETURN replace(regexp_replace(fmt, '\{0+\}', lpad(v::text, 4, '0')), '{YYYY}', p_year::text);
END $$;

-- ---------------------------------------------------------- ventes
CREATE TABLE item (
  company_id   uuid NOT NULL REFERENCES company(id),
  code         varchar(20) NOT NULL,
  label        text NOT NULL,
  unit         text NOT NULL DEFAULT 'unité',
  price        bigint NOT NULL CHECK (price >= 0),
  tax_code     varchar(12),
  account_num  varchar(10) NOT NULL,
  section      varchar(8),
  PRIMARY KEY (company_id, code),
  FOREIGN KEY (company_id, account_num) REFERENCES account(company_id, num)
);
CREATE TABLE sales_document (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES company(id),
  type            doc_type NOT NULL,
  number          text,
  status          text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'emitted', 'sent', 'accepted', 'refused', 'invoiced', 'cancelled')),
  third_party_id  uuid NOT NULL REFERENCES third_party(id),
  date            date NOT NULL,
  due_date        date,
  terms_days      smallint,
  ref             text,
  section         varchar(8),
  notes           text,
  origin_id       uuid REFERENCES sales_document(id),   -- devis → facture, facture → avoir
  entry_id        uuid REFERENCES entry(id),
  emitted_at      timestamptz,
  UNIQUE (company_id, type, number)
);
CREATE TABLE sales_document_line (
  document_id  uuid NOT NULL REFERENCES sales_document(id) ON DELETE CASCADE,
  line_no      smallint NOT NULL,
  item_code    varchar(20),
  label        text NOT NULL,
  qty          numeric(12,3) NOT NULL CHECK (qty > 0),
  unit_price   bigint NOT NULL CHECK (unit_price >= 0),
  discount_pct numeric(5,2) NOT NULL DEFAULT 0 CHECK (discount_pct BETWEEN 0 AND 100),
  tax_code     varchar(12),
  account_num  varchar(10),
  section      varchar(8),
  PRIMARY KEY (document_id, line_no)
);
CREATE TABLE payment (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid NOT NULL REFERENCES company(id),
  document_id  uuid NOT NULL REFERENCES sales_document(id),
  date         date NOT NULL,
  method       text NOT NULL CHECK (method IN ('bank', 'bank2', 'momo', 'om', 'cash')),
  amount       bigint NOT NULL CHECK (amount > 0),
  fees         bigint NOT NULL DEFAULT 0 CHECK (fees >= 0),
  ext_ref      text,                                     -- n° de transaction MoMo/OM, virement
  entry_id     uuid REFERENCES entry(id),
  UNIQUE (company_id, method, ext_ref)                   -- idempotence des webhooks
);

-- ------------------------------------------------------ trésorerie
CREATE TABLE cash_account (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id         uuid NOT NULL REFERENCES company(id),
  label              text NOT NULL,
  kind               cash_kind NOT NULL,
  account_num        varchar(10) NOT NULL CHECK (account_num ~ '^5[257][0-9]{2,}$'),
  journal_code       varchar(6) NOT NULL,
  provider           text,
  iban_or_merchant   text,
  sync_mode          text NOT NULL DEFAULT 'import' CHECK (sync_mode IN ('api', 'import', 'manual')),
  alert_below        bigint NOT NULL DEFAULT 0,
  opening_statement  bigint NOT NULL DEFAULT 0,
  recon_from         date,
  last_sync          timestamptz,
  UNIQUE (company_id, account_num),
  FOREIGN KEY (company_id, account_num) REFERENCES account(company_id, num),
  FOREIGN KEY (company_id, journal_code) REFERENCES journal(company_id, code)
);
CREATE TABLE bank_transaction (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cash_account_id  uuid NOT NULL REFERENCES cash_account(id),
  company_id       uuid NOT NULL REFERENCES company(id),
  date             date NOT NULL,
  label            text NOT NULL,
  ref              text,
  amount           bigint NOT NULL CHECK (amount <> 0),
  dedup_key        text NOT NULL,                        -- RG-R02
  status           text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'matched', 'ignored')),
  entry_line_id    uuid REFERENCES entry_line(id),
  imported_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cash_account_id, dedup_key)
);
CREATE INDEX bank_tx_open_ix ON bank_transaction (cash_account_id, status, date);
ALTER TABLE entry_line ADD CONSTRAINT entry_line_tx_fk FOREIGN KEY (reconciled_tx) REFERENCES bank_transaction(id);

CREATE TABLE bank_rule (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid NOT NULL REFERENCES company(id),
  label        text NOT NULL,
  contains     text NOT NULL,
  sign         text CHECK (sign IN ('in', 'out')),
  accounts     varchar(10)[] NOT NULL DEFAULT '{}',
  account_num  varchar(10) NOT NULL,
  tax_code     varchar(12),
  section      varchar(8),
  active       boolean NOT NULL DEFAULT true,
  uses         integer NOT NULL DEFAULT 0
);
CREATE TABLE cash_count (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cash_account_id  uuid NOT NULL REFERENCES cash_account(id),
  date             date NOT NULL,
  denominations    jsonb NOT NULL,                       -- {"10000": 12, "5000": 3, …}
  counted          bigint NOT NULL,
  book             bigint NOT NULL,
  gap              bigint GENERATED ALWAYS AS (counted - book) STORED,
  entry_id         uuid REFERENCES entry(id),
  counted_by       uuid REFERENCES app_user(id)
);

-- ---------------------------------------------------- immobilisations
CREATE TABLE fixed_asset (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES company(id),
  code            varchar(20) NOT NULL,
  label           text NOT NULL,
  account_num     varchar(10) NOT NULL CHECK (account_num ~ '^2[1-5]'),
  amort_account   varchar(10) NOT NULL,
  dot_account     varchar(10) NOT NULL,
  value           bigint NOT NULL CHECK (value > 0),
  residual        bigint NOT NULL DEFAULT 0,
  acq_date        date NOT NULL,
  service_date    date NOT NULL,
  years           smallint NOT NULL CHECK (years > 0),
  method          char(1) NOT NULL DEFAULT 'L' CHECK (method IN ('L', 'D')),
  section         varchar(8),
  location        text,
  serial          text,
  supplier_id     uuid REFERENCES third_party(id),
  invoice_ref     text,
  prior_dep       bigint NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disposed')),
  disposal_date   date,
  disposal_price  bigint,
  disposal_entry  uuid REFERENCES entry(id),
  UNIQUE (company_id, code)
);
CREATE TABLE depreciation_posting (
  asset_id   uuid NOT NULL REFERENCES fixed_asset(id),
  year       smallint NOT NULL,
  month      smallint NOT NULL CHECK (month BETWEEN 1 AND 12),
  amount     bigint NOT NULL CHECK (amount >= 0),
  entry_id   uuid NOT NULL REFERENCES entry(id),
  PRIMARY KEY (asset_id, year, month)                    -- RG-I03 : une seule dotation par mois
);

-- -------------------------------------------------- fiscalité & clôture
CREATE TABLE vat_return (
  company_id          uuid NOT NULL REFERENCES company(id),
  year                smallint NOT NULL,
  month               smallint NOT NULL CHECK (month BETWEEN 1 AND 12),
  collected           bigint NOT NULL,
  deductible_goods    bigint NOT NULL,
  deductible_assets   bigint NOT NULL,
  prior_credit        bigint NOT NULL,
  due                 bigint NOT NULL,
  credit              bigint NOT NULL,
  status              text NOT NULL CHECK (status IN ('liquidated', 'paid')),
  liquidation_entry   uuid NOT NULL REFERENCES entry(id),
  payment_entry       uuid REFERENCES entry(id),
  receipt_ref         text,
  PRIMARY KEY (company_id, year, month)                  -- RG-F03
);
CREATE TABLE closing (
  company_id     uuid NOT NULL,
  year           smallint NOT NULL,
  income_tax_entry uuid REFERENCES entry(id),
  locked         boolean NOT NULL DEFAULT false,
  opening_entry  uuid REFERENCES entry(id),              -- écriture AN de N+1
  allocation_entry uuid REFERENCES entry(id),
  dsf_receipt    text,
  dsf_date       date,
  PRIMARY KEY (company_id, year),
  FOREIGN KEY (company_id, year) REFERENCES fiscal_year(company_id, year)
);
CREATE TABLE tax_adjustment (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL,
  year        smallint NOT NULL,
  kind        text NOT NULL CHECK (kind IN ('reint', 'deduct')),
  label       text NOT NULL,
  amount      bigint NOT NULL CHECK (amount > 0),
  note        text,
  FOREIGN KEY (company_id, year) REFERENCES fiscal_year(company_id, year)
);

-- --------------------------------------------------------- imports
CREATE TABLE import_job (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES company(id),
  type        text NOT NULL CHECK (type IN ('accounts', 'tiers', 'items', 'entries', 'bank', 'assets', 'opening')),
  file_name   text NOT NULL,
  file_sha256 char(64) NOT NULL,
  mapping     jsonb NOT NULL,
  options     jsonb NOT NULL DEFAULT '{}',
  dry_run     jsonb,                                     -- résultat du contrôle à blanc
  result      jsonb,
  status      text NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'checked', 'running', 'done', 'failed')),
  created_by  uuid REFERENCES app_user(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------- piste d'audit
CREATE TABLE audit_event (
  id          bigserial PRIMARY KEY,
  company_id  uuid NOT NULL REFERENCES company(id),
  ts          timestamptz NOT NULL DEFAULT clock_timestamp(),
  user_id     uuid,
  user_name   text NOT NULL,
  role        text,
  action      text NOT NULL,
  object      text NOT NULL,
  detail      text NOT NULL DEFAULT '',
  ip          inet,
  prev_hash   char(64) NOT NULL,
  hash        char(64) NOT NULL
);
CREATE INDEX audit_company_ix ON audit_event (company_id, id);

-- RG-AU02 : chaînage calculé en base, puis table en ajout seul
CREATE FUNCTION trg_audit_chain() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p char(64);
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(NEW.company_id::text));
  SELECT hash INTO p FROM audit_event WHERE company_id = NEW.company_id ORDER BY id DESC LIMIT 1;
  NEW.prev_hash := COALESCE(p, repeat('0', 64));
  NEW.hash := encode(digest(NEW.prev_hash || '|' || NEW.ts::text || '|' || NEW.user_name || '|' || NEW.action || '|' || NEW.object || '|' || NEW.detail, 'sha256'), 'hex');
  RETURN NEW;
END $$;
CREATE TRIGGER audit_chain BEFORE INSERT ON audit_event FOR EACH ROW EXECUTE FUNCTION trg_audit_chain();
CREATE FUNCTION trg_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'RG-AU02 : la piste d''audit est en ajout seul'; END $$;
CREATE TRIGGER audit_append_only BEFORE UPDATE OR DELETE ON audit_event FOR EACH ROW EXECUTE FUNCTION trg_append_only();

CREATE FUNCTION verify_audit(p_company uuid) RETURNS TABLE (ok boolean, broken_at bigint) LANGUAGE plpgsql AS $$
DECLARE r record; prev char(64) := repeat('0', 64);
BEGIN
  FOR r IN SELECT * FROM audit_event WHERE company_id = p_company ORDER BY id LOOP
    IF r.prev_hash <> prev OR r.hash <> encode(digest(r.prev_hash || '|' || r.ts::text || '|' || r.user_name || '|' || r.action || '|' || r.object || '|' || r.detail, 'sha256'), 'hex') THEN
      ok := false; broken_at := r.id; RETURN NEXT; RETURN;
    END IF;
    prev := r.hash;
  END LOOP;
  ok := true; broken_at := NULL; RETURN NEXT;
END $$;

-- --------------------------------------------------- vues de synthèse
CREATE VIEW v_trial_balance AS
SELECT e.company_id, extract(year FROM e.date)::smallint AS year, l.account_num,
       sum(CASE WHEN e.journal_code = 'AN' THEN l.debit - l.credit ELSE 0 END) AS opening_net,
       sum(CASE WHEN e.journal_code <> 'AN' THEN l.debit ELSE 0 END) AS move_debit,
       sum(CASE WHEN e.journal_code <> 'AN' THEN l.credit ELSE 0 END) AS move_credit,
       sum(l.debit - l.credit) AS closing_net
FROM entry e JOIN entry_line l ON l.entry_id = e.id
WHERE e.status = 'validated'
GROUP BY 1, 2, 3;

-- ------------------------------------------------ Row Level Security
-- L'API positionne : SET LOCAL app.company_id = '<uuid>' après contrôle de membership.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['account','journal','tax_code','analytic_section','allocation_key','analytic_budget','fiscal_year','third_party','entry','entry_line',
                           'attachment','item','sales_document','payment','cash_account','bank_transaction','bank_rule','fixed_asset','vat_return','import_job','audit_event','company_setting'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON %I USING (company_id = current_setting(''app.company_id'', true)::uuid) WITH CHECK (company_id = current_setting(''app.company_id'', true)::uuid)', t || '_tenant', t);
  END LOOP;
END $$;

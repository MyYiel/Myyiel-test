/*
 * myyiel Comptabilité · moteur du grand livre (partie double).
 * Pur JavaScript, sans dépendance au DOM : exécutable dans le navigateur et sous Node (tests).
 * Règles implémentées : docs/02-regles-de-gestion.md
 */
import { Y } from './registry.js';


/* ---------------------------------------------------------------- utilitaires */
var U = Y.util = {};
var _seq = 0;
U.uid = function (p) { _seq += 1; return (p || 'id') + '_' + Date.now().toString(36) + '_' + _seq.toString(36); };
U.round = function (n) { return Math.round(Number(n) || 0); };
U.fmt = function (n, opts) {
  n = U.round(n);
  if (opts && opts.zero === false && n === 0) return '';
  var s = Math.abs(n).toLocaleString('fr-FR').replace(/ | /g, ' ');
  if (opts && opts.paren && n < 0) return '(' + s + ')';
  return (n < 0 ? '−' : '') + s;
};
U.fmtDC = function (n) { n = U.round(n); if (!n) return '0'; return U.fmt(Math.abs(n)) + (n > 0 ? ' D' : ' C'); };
U.parseAmount = function (v) {
  if (typeof v === 'number') return U.round(v);
  var s = String(v == null ? '' : v).replace(/\s| | /g, '').replace(/[^\d,.\-−]/g, '').replace('−', '-');
  if (s.indexOf(',') > -1 && s.indexOf('.') > -1) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(',', '.');
  var n = parseFloat(s);
  return isNaN(n) ? 0 : Math.round(n);
};
U.pad = function (n, w) { n = String(n); while (n.length < w) n = '0' + n; return n; };
U.ymd = function (d) { return d.getFullYear() + '-' + U.pad(d.getMonth() + 1, 2) + '-' + U.pad(d.getDate(), 2); };
U.year = function (s) { return +String(s).slice(0, 4); };
U.month = function (s) { return +String(s).slice(5, 7); };
U.monthEnd = function (y, m) { return U.ymd(new Date(y, m, 0)); };
U.addDays = function (s, n) { var d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return U.ymd(d); };
U.addMonths = function (s, n) { var d = new Date(s + 'T12:00:00'); var day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n); var last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); d.setDate(Math.min(day, last)); return U.ymd(d); };
U.daysBetween = function (a, b) { return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000); };
U.frDate = function (s) { if (!s) return ''; return s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4); };
U.MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
U.fnv = function (str) {
  var h = 0x811c9dc5;
  for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0; }
  return ('0000000' + h.toString(16)).slice(-8);
};
U.clone = function (o) { return JSON.parse(JSON.stringify(o)); };
U.sum = function (arr, f) { var t = 0; for (var i = 0; i < arr.length; i++) t += f ? f(arr[i]) : arr[i]; return t; };

/* ----------------------------------------------------------- erreurs métier */
function BizError(messages) { this.name = 'BizError'; this.messages = [].concat(messages); this.message = this.messages.join(' · '); }
BizError.prototype = Object.create(Error.prototype);
Y.BizError = BizError;
function fail(m) { throw new BizError(m); }

/* ----------------------------------------------------------- rôles & droits */
Y.ROLES = {
  owner: { label: 'Propriétaire', rights: ['read', 'draft', 'post', 'reverse', 'letter', 'invoice', 'bank', 'lock', 'reopen', 'close', 'settings', 'users', 'export', 'import'] },
  accountant: { label: 'Comptable', rights: ['read', 'draft', 'post', 'reverse', 'letter', 'invoice', 'bank', 'lock', 'export', 'import'] },
  reader: { label: 'Lecteur', rights: ['read', 'export'] },
  payroll: { label: 'Gestionnaire de paie', rights: ['read', 'export', 'pay.read', 'pay.prepare', 'pay.validate', 'pay.bank', 'pay.sensitive', 'pay.settings'] },
  hr: { label: 'DRH', rights: ['read', 'export', 'pay.read', 'pay.approve', 'pay.sign', 'pay.sensitive'] },
  cfo: { label: 'DAF', rights: ['read', 'draft', 'post', 'reverse', 'letter', 'invoice', 'bank', 'lock', 'reopen', 'close', 'settings', 'export', 'import', 'pay.read', 'pay.post', 'pay.declare', 'pay.sensitive'] }
};
Y.ROLES.owner.rights = Y.ROLES.owner.rights.concat(['pay.read', 'pay.prepare', 'pay.validate', 'pay.bank', 'pay.sensitive', 'pay.settings']);
Y.ROLES.accountant.rights = Y.ROLES.accountant.rights.concat(['pay.read']);
/* Temps & présence (GTA), congés & absences, stocks, espace salarié */
Y.ROLES.manager = { label: 'Manager (N+1)', rights: ['self', 'abs.request', 'abs.read', 'abs.approve', 'gta.read', 'gta.validate', 'gta.track', 'gta.mission'] };
Y.ROLES.employee = { label: 'Salarié', rights: ['self', 'abs.request'] };
Y.ROLES.owner.rights = Y.ROLES.owner.rights.concat(['self', 'abs.read', 'abs.manage', 'abs.settings', 'gta.read', 'gta.manage', 'gta.track', 'gta.mission', 'gta.export', 'stock', 'stock.count']);
Y.ROLES.payroll.rights = Y.ROLES.payroll.rights.concat(['self', 'abs.request', 'abs.read', 'abs.manage', 'abs.settings', 'gta.read', 'gta.manage', 'gta.track', 'gta.mission', 'gta.export']);
Y.ROLES.hr.rights = Y.ROLES.hr.rights.concat(['self', 'abs.request', 'abs.read', 'abs.hr', 'abs.approve', 'abs.settings', 'gta.read', 'gta.validate', 'gta.track', 'gta.mission', 'gta.manage']);
Y.ROLES.cfo.rights = Y.ROLES.cfo.rights.concat(['self', 'abs.request', 'abs.read', 'abs.approve', 'gta.read', 'gta.validate', 'gta.track', 'gta.mission', 'stock', 'stock.count']);
Y.ROLES.accountant.rights = Y.ROLES.accountant.rights.concat(['stock', 'stock.count']);
/* Module 4 · trésorerie, facturation et paiements */
Y.ROLES.owner.rights = Y.ROLES.owner.rights.concat(['fin.read', 'fin.vendor', 'fin.collect', 'fin.payables', 'fin.approve', 'fin.pay', 'fin.verify', 'fin.settings']);
Y.ROLES.accountant.rights = Y.ROLES.accountant.rights.concat(['fin.read', 'fin.vendor', 'fin.collect', 'fin.payables']);
Y.ROLES.cfo.rights = Y.ROLES.cfo.rights.concat(['fin.read', 'fin.vendor', 'fin.collect', 'fin.payables', 'fin.approve', 'fin.pay', 'fin.verify', 'fin.settings']);
Y.ROLES.reader.rights = Y.ROLES.reader.rights.concat(['fin.read']);
/* Yiel CRM · prospection et développement commercial */
Y.ROLES.sales_manager = { label: 'Responsable commercial', rights: ['crm.read', 'crm.write', 'crm.team', 'crm.campaign', 'crm.export'] };
Y.ROLES.sales = { label: 'Commercial', rights: ['crm.read', 'crm.write'] };
Y.ROLES.marketing = { label: 'Marketing', rights: ['crm.read', 'crm.write', 'crm.campaign'] };
Y.ROLES.crm_admin = { label: 'Administrateur CRM', rights: ['crm.admin'] };
Y.ROLES.owner.rights = Y.ROLES.owner.rights.concat(['crm.read', 'crm.write', 'crm.all', 'crm.campaign', 'crm.approve', 'crm.export', 'crm.governance', 'crm.personal', 'crm.admin']);
Y.ROLES.cfo.rights = Y.ROLES.cfo.rights.concat(['crm.read', 'crm.all']);
Y.RIGHTS = {
  read: 'Consulter journaux, livres et états', draft: 'Saisir des brouillons', post: 'Valider des écritures', reverse: 'Contre-passer une écriture',
  letter: 'Lettrer et rapprocher', invoice: 'Émettre devis, factures et avoirs', bank: 'Synchroniser et rapprocher la trésorerie', lock: 'Verrouiller une période',
  reopen: 'Rouvrir une période ou un exercice', close: 'Clôturer et générer les à-nouveaux', settings: 'Modifier plan, journaux, taxes et paramètres',
  users: 'Gérer les utilisateurs et les rôles', export: 'Exporter (Excel, CSV, PDF, FEC)', import: 'Importer des données',
  'pay.read': 'Paie : consulter', 'pay.prepare': 'Paie : préparer (salariés, variables, calcul)', 'pay.validate': 'Paie : valider et soumettre à la DRH', 'pay.bank': 'Paie : préparer et envoyer les ordres de virement',
  'pay.approve': 'Paie : valider (DRH) la paie, les virements et les avances', 'pay.sign': 'Paie : signer électroniquement les bulletins', 'pay.post': 'Paie : vérifier les écritures et clôturer (DAF)', 'pay.declare': 'Paie : télédéclarer et payer CNPS / DGI (DAF)',
  'pay.sensitive': 'Paie : voir les données sensibles (salaires, RIB, CNI)', 'pay.settings': 'Paie : paramétrer rubriques, réglementation, conventions',
  self: 'Accéder à son espace salarié (pointage, demandes, bulletins)', 'abs.request': 'Absences : demander pour soi', 'abs.read': 'Absences : consulter le planning de son périmètre',
  'abs.approve': 'Absences : valider en tant que N+1', 'abs.manage': 'Absences : saisir pour un salarié, notifier, corriger (gestionnaire)', 'abs.hr': 'Absences : valider en tant que DRH',
  'abs.settings': 'Absences : paramétrer motifs, circuits, jours fériés', 'gta.read': 'Temps : consulter présences et pointages de son périmètre', 'gta.validate': 'Temps : valider pointages et feuilles de temps (N+1)',
  'gta.manage': 'Temps : paramétrer sites, géozones, horaires, appareils', 'gta.track': 'Temps : voir le suivi des missions en cours', 'gta.mission': 'Temps : créer et piloter des ordres de mission',
  'gta.export': 'Temps : transmettre temps et absences à la paie', stock: 'Stocks : articles, mouvements, valorisation', 'stock.count': 'Stocks : inventaires physiques et écritures de stock',
  'fin.read': 'Trésorerie : consulter soldes, prévisions, encaissements et paiements', 'fin.vendor': 'Tiers : créer et modifier les fiches clients et fournisseurs', 'fin.collect': 'Encaissements : liens de paiement, justificatifs, relances, rapprochement',
  'fin.payables': 'Fournisseurs : traiter les factures reçues et préparer les paiements', 'fin.approve': 'Paiements : approuver (seuils et double validation)', 'fin.pay': 'Paiements : exécuter les paiements approuvés',
  'fin.verify': 'Anti-fraude : confirmer les changements de coordonnées, liste de vigilance', 'fin.settings': 'Trésorerie : paramétrer seuils, modèles de facture, prestataires',
  'crm.read': 'CRM : consulter son périmètre (cockpit, contacts, pipeline)', 'crm.write': 'CRM : créer et modifier contacts, entreprises, opportunités, activités', 'crm.all': 'CRM : voir toutes les données de l’organisation',
  'crm.team': 'CRM : voir les données de son équipe', 'crm.campaign': 'CRM : préparer modèles et campagnes, soumettre à validation', 'crm.approve': 'CRM : valider les campagnes (direction)',
  'crm.export': 'CRM : exporter les données de son périmètre', 'crm.governance': 'CRM : fixer plafonds, objectifs, suspension globale', 'crm.personal': 'CRM : traiter les demandes sur les données personnelles',
  'crm.admin': 'CRM : administration technique (utilisateurs, intégrations), sans droit commercial'
};
Y.can = function (role, right) { var r = Y.ROLES[role]; return !!(r && r.rights.indexOf(right) > -1); };

/* -------------------------------------------------- référentiels par défaut */
function accountMeta(num) {
  var c = +num[0];
  var sens = 'C';
  if (c === 2 || c === 3 || c === 5 || c === 6) sens = 'D';
  if (c === 4 && /^(41|409|445|4449|476|478|421|441|485|462)/.test(num)) sens = 'D';
  if (c === 8) sens = /^(81|83|85|87|89)/.test(num) ? 'D' : 'C';
  if (/^(28|29|39|49|59)/.test(num)) sens = 'C';
  if (/^(109|129|139)/.test(num)) sens = 'D';
  if (c === 9) sens = '';
  var type = c <= 5 ? 'bilan' : (c <= 8 ? 'gestion' : 'analytique');
  var nature = 'general';
  if (/^(401|4011|411|4111|409|419|416|402|412)$/.test(num)) nature = 'tiers';
  if (/^(422|421|462|465|481|485)$/.test(num)) nature = 'tiers';
  if (c === 5) nature = 'tresorerie';
  if (c === 9) nature = 'analytique';
  return {
    cls: c, sens: sens, type: type, nature: nature,
    lettrable: /^(40|41|42|46|47|48)/.test(num) && num.length >= 3 && !/^(476|477|478|479)/.test(num),
    bankReconcile: /^(52|55)/.test(num) && num.length >= 4,
    analyticRequired: false,
    taxCode: /^70/.test(num) ? 'TVA19' : ''
  };
}
Y.accountMeta = accountMeta;

Y.defaultTaxCodes = function () {
  return [
    { code: 'TVA19', label: 'TVA taux normal (17,5 % + CAC 10 %)', rate: 19.25, principal: 17.5, cac: 1.75, collect: '4431', deductGoods: '4452', deductAssets: '4451', deductible: true, active: true, validFrom: '2000-01-01' },
    { code: 'EXO', label: 'Opérations exonérées', rate: 0, principal: 0, cac: 0, collect: '', deductGoods: '', deductAssets: '', deductible: false, active: true, validFrom: '2000-01-01' },
    { code: 'EXP', label: 'Exportations (taux zéro, droit à déduction)', rate: 0, principal: 0, cac: 0, collect: '4431', deductGoods: '4452', deductAssets: '4451', deductible: true, active: true, validFrom: '2000-01-01' },
    { code: 'HC', label: 'Hors champ (salaires, débours, mouvements internes)', rate: 0, principal: 0, cac: 0, collect: '', deductGoods: '', deductAssets: '', deductible: false, active: true, validFrom: '2000-01-01' }
  ];
};

Y.defaultJournals = function () {
  return [
    { code: 'AN', label: 'À-nouveaux', type: 'opening', counterpart: '', seqFormat: 'AN-{YYYY}-{0000}', source: 'Clôture (automatique)', active: true, system: true, seq: {} },
    { code: 'ACH', label: 'Achats', type: 'purchase', counterpart: '4011', seqFormat: 'ACH-{YYYY}-{0000}', source: 'Saisie, lecture de factures', active: true, seq: {} },
    { code: 'VTE', label: 'Ventes', type: 'sale', counterpart: '4111', seqFormat: 'VTE-{YYYY}-{0000}', source: 'Module Facturation', active: true, seq: {} },
    { code: 'BQ1', label: 'Banque principale', type: 'bank', counterpart: '5211', seqFormat: 'BQ1-{YYYY}-{0000}', source: 'Synchronisation bancaire', active: true, seq: {} },
    { code: 'BQ2', label: 'Banque secondaire', type: 'bank', counterpart: '5212', seqFormat: 'BQ2-{YYYY}-{0000}', source: 'Import de relevés', active: true, seq: {} },
    { code: 'MTN', label: 'MTN Mobile Money', type: 'bank', counterpart: '5521', seqFormat: 'MTN-{YYYY}-{0000}', source: 'Compte marchand MTN MoMo', active: true, seq: {} },
    { code: 'OM', label: 'Orange Money', type: 'bank', counterpart: '5522', seqFormat: 'OM-{YYYY}-{0000}', source: 'Compte marchand Orange Money', active: true, seq: {} },
    { code: 'CAI', label: 'Caisse', type: 'cash', counterpart: '5711', seqFormat: 'CAI-{YYYY}-{0000}', source: 'Saisie, arrêté de caisse', active: true, seq: {} },
    { code: 'OD', label: 'Opérations diverses', type: 'misc', counterpart: '', seqFormat: 'OD-{YYYY}-{0000}', source: 'Saisie, TVA, clôture', active: true, seq: {} },
    { code: 'PAIE', label: 'Paie', type: 'payroll', counterpart: '422', seqFormat: 'PAIE-{YYYY}-{0000}', source: 'Module RH & Paie', active: true, seq: {} },
    { code: 'IMMO', label: 'Immobilisations', type: 'misc', counterpart: '481', seqFormat: 'IMMO-{YYYY}-{0000}', source: 'Registre des immobilisations', active: true, seq: {} }
  ];
};

Y.defaultSections = function () {
  return [
    { code: 'CNS', axis: 'ACT', label: 'Conseil', type: 'principale', owner: 'Associé conseil', active: true },
    { code: 'LOG', axis: 'ACT', label: 'Logiciels myyiel', type: 'principale', owner: 'Directeur produit', active: true },
    { code: 'DGO', axis: 'ACT', label: 'DeyGo', type: 'principale', owner: 'Gestionnaire DeyGo', active: true },
    { code: 'STR', axis: 'ACT', label: 'Structure', type: 'auxiliaire', owner: 'Direction financière', active: true },
    { code: 'DLA', axis: 'SIT', label: 'Site de Douala', type: 'principale', owner: '', active: true },
    { code: 'YDE', axis: 'SIT', label: 'Site de Yaoundé', type: 'principale', owner: '', active: true }
  ];
};

/* -------------------------------------------------------------- état global */
Y.createState = function (today) {
  return { meta: { version: 1, schema: 'myyiel-compta/2', today: today || U.ymd(new Date()), currentCompany: null, currentUser: null, lang: 'fr' }, companies: [], data: {} };
};

Y.addCompany = function (S, c) {
  var id = c.id || U.uid('co');
  var company = Object.assign({
    id: id, name: '', legalForm: 'SA', niu: '', rccm: '', capital: 0, address: '', city: 'Douala', country: 'Cameroun', currency: 'XAF',
    framework: 'SYSCOHADA révisé', system: 'normal', taxRegime: 'Réel', taxCenter: '', cnps: '', yearEnd: '12-31', statementsLang: 'fr', color: '#CF4417',
    invoiceFooter: '', iban: '', momoMerchant: '', omMerchant: ''
  }, c, { id: id });
  S.companies.push(company);
  var accounts = Y.PLAN_SYSCOHADA.map(function (p) { return Object.assign({ num: p[0], label: p[1], labelEn: p[2], active: true, custom: false }, accountMeta(p[0])); });
  S.data[id] = {
    accounts: accounts, journals: Y.defaultJournals(), taxCodes: Y.defaultTaxCodes(), sections: Y.defaultSections(),
    keys: [{ id: 'K1', label: 'Frais de structure', from: 'STR', base: 'Effectifs et temps passé', alloc: [{ section: 'CNS', pct: 40 }, { section: 'LOG', pct: 50 }, { section: 'DGO', pct: 10 }] }],
    fiscalYears: [], tiers: [], entries: [], items: [], docs: [], bankAccounts: [], bankTx: [], bankRules: [], assets: [], vat: {}, closing: {}, audit: [],
    settings: { isRate: 27.5, minTaxRate: 2.2, ircmRate: 16.5, legalReserveRate: 10, legalReserveCap: 20, docSeq: { DV: {}, FA: {}, AV: {} }, lockedBeforeEdit: true }
  };
  if (!S.meta.currentCompany) S.meta.currentCompany = id;
  return company;
};

Y.D = function (S, cid) { var d = S.data[cid || S.meta.currentCompany]; if (!d) fail('Société inconnue'); return d; };
Y.company = function (S, cid) { return S.companies.find(function (c) { return c.id === (cid || S.meta.currentCompany); }); };

/* ------------------------------------------------------------- piste d'audit */
Y.audit = function (S, cid, action, object, detail) {
  var d = Y.D(S, cid);
  var prev = d.audit.length ? d.audit[d.audit.length - 1].hash : '00000000';
  var u = S.meta.currentUser || { name: 'Système' };
  var rec = { ts: new Date().toISOString(), user: u.name, role: u.role || '', action: action, object: object, detail: detail || '' };
  rec.hash = U.fnv(prev + '|' + rec.ts + '|' + rec.user + '|' + action + '|' + object + '|' + rec.detail);
  rec.prev = prev;
  d.audit.push(rec);
  return rec;
};
Y.verifyAudit = function (S, cid) {
  var d = Y.D(S, cid), prev = '00000000';
  for (var i = 0; i < d.audit.length; i++) {
    var r = d.audit[i];
    var h = U.fnv(prev + '|' + r.ts + '|' + r.user + '|' + r.action + '|' + r.object + '|' + r.detail);
    if (h !== r.hash || r.prev !== prev) return { ok: false, at: i };
    prev = r.hash;
  }
  return { ok: true, count: d.audit.length };
};

/* ----------------------------------------------------------------- comptes */
Y.account = function (S, cid, num) { return Y.D(S, cid).accounts.find(function (a) { return a.num === num; }); };
Y.accountLabel = function (S, cid, num) { var a = Y.account(S, cid, num); return a ? (S.meta.lang === 'en' ? a.labelEn || a.label : a.label) : ''; };
Y.createAccount = function (S, cid, a) {
  var d = Y.D(S, cid);
  var errs = [];
  if (!/^[1-9]\d{1,9}$/.test(a.num || '')) errs.push('Le numéro doit contenir 2 à 10 chiffres et commencer par la classe (1 à 9).');
  if (d.accounts.some(function (x) { return x.num === a.num; })) errs.push('Le compte ' + a.num + ' existe déjà.');
  if (!a.label) errs.push('L’intitulé est obligatoire.');
  var parent = a.num ? d.accounts.filter(function (x) { return a.num.indexOf(x.num) === 0 && x.num !== a.num; }).sort(function (x, y) { return y.num.length - x.num.length; })[0] : null;
  if (a.num && a.num.length > 2 && !parent) errs.push('Aucun compte parent SYSCOHADA ne correspond à ' + a.num.slice(0, 2) + '.');
  if (errs.length) fail(errs);
  var meta = accountMeta(a.num);
  var acc = Object.assign({}, meta, { num: a.num, label: a.label, labelEn: a.labelEn || '', active: true, custom: true },
    ['sens', 'nature', 'lettrable', 'bankReconcile', 'analyticRequired', 'taxCode'].reduce(function (o, k) { if (a[k] !== undefined && a[k] !== '') o[k] = a[k]; return o; }, {}));
  d.accounts.push(acc);
  d.accounts.sort(function (x, y) { return x.num < y.num ? -1 : 1; });
  Y.audit(S, cid, 'Création', 'Compte ' + acc.num, acc.label);
  return acc;
};
Y.accountHasMovements = function (S, cid, num) {
  return Y.D(S, cid).entries.some(function (e) { return e.status === 'validated' && e.lines.some(function (l) { return l.account === num; }); });
};
Y.updateAccount = function (S, cid, num, patch) {
  var a = Y.account(S, cid, num); if (!a) fail('Compte introuvable');
  if (patch.num && patch.num !== num && Y.accountHasMovements(S, cid, num)) fail('Le compte ' + num + ' est mouvementé : il ne peut pas être renuméroté.');
  ['label', 'labelEn', 'sens', 'nature', 'lettrable', 'bankReconcile', 'analyticRequired', 'taxCode', 'active'].forEach(function (k) { if (patch[k] !== undefined) a[k] = patch[k]; });
  Y.audit(S, cid, 'Modification', 'Compte ' + num, JSON.stringify(patch));
  return a;
};
Y.isLeaf = function (S, cid, num) { return !Y.D(S, cid).accounts.some(function (x) { return x.num !== num && x.num.indexOf(num) === 0; }); };
Y.postableAccounts = function (S, cid) { var d = Y.D(S, cid); return d.accounts.filter(function (a) { return a.active && a.cls <= 8 && (a.num.length >= 3) && Y.isLeaf(S, cid, a.num); }); };

/* ------------------------------------------------------------------- tiers */
Y.createTiers = function (S, cid, t) {
  var d = Y.D(S, cid), errs = [];
  if (!t.name) errs.push('La raison sociale est obligatoire.');
  if (!t.type) errs.push('Le type de tiers est obligatoire.');
  var prefix = t.type === 'client' ? 'C' : (t.type === 'fournisseur' ? 'F' : 'P');
  var code = t.code || (prefix + U.pad(d.tiers.filter(function (x) { return x.code[0] === prefix; }).length + 1, 4));
  if (d.tiers.some(function (x) { return x.code === code; })) errs.push('Le code ' + code + ' existe déjà.');
  if (t.niu && !/^[A-Z0-9]{8,20}$/i.test(t.niu)) errs.push('NIU invalide : 8 à 20 caractères alphanumériques.');
  if (t.momo && !/^\+?\d[\d ]{7,20}$/.test(t.momo)) errs.push('Numéro Mobile Money invalide.');
  if (errs.length) fail(errs);
  var col = t.collective || (t.type === 'client' ? '4111' : (t.type === 'fournisseur' ? '4011' : '422'));
  var rec = Object.assign({ id: U.uid('t'), code: code, type: t.type, name: t.name, collective: col, niu: '', rccm: '', regime: 'Réel', email: '', phone: '', momo: '', momoOp: '', address: '', city: '', country: 'Cameroun', terms: 30, creditLimit: 0, active: true, notes: '' }, t, { code: code, collective: col });
  d.tiers.push(rec);
  Y.audit(S, cid, 'Création', 'Tiers ' + code, rec.name);
  return rec;
};
Y.tiers = function (S, cid, id) { return Y.D(S, cid).tiers.find(function (t) { return t.id === id || t.code === id; }); };

/* --------------------------------------------------------- exercices/périodes */
Y.createFiscalYear = function (S, cid, year) {
  var d = Y.D(S, cid);
  if (d.fiscalYears.some(function (f) { return f.year === year; })) fail('L’exercice ' + year + ' existe déjà.');
  var fy = { year: year, start: year + '-01-01', end: year + '-12-31', status: 'open', locked: [], closedAt: null };
  d.fiscalYears.push(fy);
  d.fiscalYears.sort(function (a, b) { return a.year - b.year; });
  Y.audit(S, cid, 'Création', 'Exercice ' + year, 'Ouverture');
  return fy;
};
Y.fiscalYear = function (S, cid, year) { return Y.D(S, cid).fiscalYears.find(function (f) { return f.year === year; }); };
Y.isPeriodOpen = function (S, cid, date, opts) {
  var fy = Y.fiscalYear(S, cid, U.year(date));
  if (!fy) return { ok: false, why: 'Aucun exercice ouvert pour ' + U.year(date) + '.' };
  if (fy.status === 'closed' && !(opts && opts.closing)) return { ok: false, why: 'L’exercice ' + fy.year + ' est clôturé.' };
  if (fy.locked.indexOf(U.month(date)) > -1 && !(opts && opts.closing)) return { ok: false, why: 'La période ' + U.MONTHS[U.month(date) - 1] + ' ' + fy.year + ' est verrouillée.' };
  return { ok: true };
};
Y.togglePeriod = function (S, cid, year, month, reason) {
  var fy = Y.fiscalYear(S, cid, year); if (!fy) fail('Exercice introuvable');
  if (fy.status === 'closed') fail('Exercice clôturé : rouvrez d’abord l’exercice.');
  var i = fy.locked.indexOf(month);
  if (i > -1) { fy.locked.splice(i, 1); Y.audit(S, cid, 'Réouverture', 'Période ' + U.pad(month, 2) + '/' + year, reason || 'Sans motif'); }
  else { fy.locked.push(month); fy.locked.sort(function (a, b) { return a - b; }); Y.audit(S, cid, 'Verrouillage', 'Période ' + U.pad(month, 2) + '/' + year, ''); }
  return fy;
};

/* --------------------------------------------------------------- écritures */
Y.journal = function (S, cid, code) { return Y.D(S, cid).journals.find(function (j) { return j.code === code; }); };
Y.entryTotals = function (e) {
  var d = 0, c = 0; e.lines.forEach(function (l) { d += U.round(l.debit); c += U.round(l.credit); });
  return { debit: d, credit: c, diff: d - c };
};
Y.checkEntry = function (S, cid, e, opts) {
  opts = opts || {};
  var d = Y.D(S, cid), errs = [];
  var j = Y.journal(S, cid, e.journal);
  if (!j) errs.push('Journal inconnu.');
  else if (!j.active) errs.push('Le journal ' + j.code + ' est désactivé.');
  else if (j.type === 'opening' && !opts.system) errs.push('Le journal des à-nouveaux est généré par la clôture : saisie manuelle impossible.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date || '')) errs.push('Date comptable invalide.');
  else { var p = Y.isPeriodOpen(S, cid, e.date, opts); if (!p.ok) errs.push(p.why); }
  if (!e.label || !String(e.label).trim()) errs.push('Le libellé de l’écriture est obligatoire.');
  if (!e.lines || e.lines.length < 2) errs.push('Une écriture comporte au moins deux lignes.');
  (e.lines || []).forEach(function (l, i) {
    var n = 'Ligne ' + (i + 1) + ' : ';
    var a = d.accounts.find(function (x) { return x.num === l.account; });
    var dr = U.round(l.debit), cr = U.round(l.credit);
    if (!a) errs.push(n + 'compte ' + (l.account || '(vide)') + ' absent du plan comptable.');
    else {
      if (!a.active) errs.push(n + 'compte ' + a.num + ' désactivé.');
      if (a.cls === 9) errs.push(n + 'la classe 9 se tient en analytique, pas dans la comptabilité générale.');
      if (!opts.system && !Y.isLeaf(S, cid, a.num)) errs.push(n + 'le compte ' + a.num + ' est un compte de regroupement ; utilisez un sous-compte.');
      if (a.nature === 'tiers' && !l.tiersId && !opts.system) errs.push(n + 'le compte collectif ' + a.num + ' exige un tiers.');
      if (a.analyticRequired && !l.section) errs.push(n + 'section analytique obligatoire sur ' + a.num + '.');
    }
    if (dr < 0 || cr < 0) errs.push(n + 'montants négatifs interdits ; inversez le sens.');
    if (dr && cr) errs.push(n + 'débit et crédit sur la même ligne.');
    if (!dr && !cr) errs.push(n + 'montant nul.');
    if (Number(l.debit) % 1 || Number(l.credit) % 1) errs.push(n + 'le franc CFA ne comporte pas de décimales.');
  });
  var t = Y.entryTotals(e);
  if (t.diff !== 0) errs.push('Écriture déséquilibrée : débit ' + U.fmt(t.debit) + ' ≠ crédit ' + U.fmt(t.credit) + ' (écart ' + U.fmt(Math.abs(t.diff)) + ').');
  if (j && j.type === 'bank' && j.counterpart && !(e.lines || []).some(function (l) { return l.account === j.counterpart; })) errs.push('Le journal ' + j.code + ' exige une ligne sur son compte de trésorerie ' + j.counterpart + '.');
  return errs;
};
function normLines(lines) {
  return lines.map(function (l) {
    return { account: String(l.account || '').trim(), label: l.label || '', debit: U.round(l.debit), credit: U.round(l.credit), tiersId: l.tiersId || '', section: l.section || '', taxCode: l.taxCode || '', letter: l.letter || '', rec: l.rec || '', due: l.due || '' };
  });
}
Y.saveDraft = function (S, cid, e) {
  var d = Y.D(S, cid);
  var rec = Object.assign({ id: e.id || U.uid('e'), status: 'draft', num: '', createdAt: new Date().toISOString(), createdBy: (S.meta.currentUser || {}).name || 'Système', attachments: [], source: 'manual' }, e);
  rec.lines = normLines(e.lines || []);
  var i = d.entries.findIndex(function (x) { return x.id === rec.id; });
  if (i > -1) { if (d.entries[i].status !== 'draft') fail('Une écriture validée ne peut plus être modifiée.'); d.entries[i] = rec; }
  else d.entries.push(rec);
  return rec;
};
Y.nextNumber = function (S, cid, journalCode, year, peek) {
  var j = Y.journal(S, cid, journalCode);
  var n = (j.seq[year] || 0) + 1;
  if (!peek) j.seq[year] = n;
  return j.seqFormat.replace('{YYYY}', year).replace('{0000}', U.pad(n, 4)).replace('{MM}', U.pad(n, 2));
};
Y.postEntry = function (S, cid, e, opts) {
  opts = opts || {};
  var d = Y.D(S, cid);
  var rec = Object.assign({}, e);
  var dec = (e.lines || []).some(function (l) { return (Number(l.debit) || 0) % 1 || (Number(l.credit) || 0) % 1; });
  rec.lines = normLines(e.lines || []);
  var errs = Y.checkEntry(S, cid, rec, opts);
  if (dec) errs.push('Le franc CFA ne comporte pas de décimales : arrondissez les montants.');
  if (errs.length) fail(errs);
  rec.id = rec.id || U.uid('e');
  rec.status = 'validated';
  rec.num = Y.nextNumber(S, cid, rec.journal, U.year(rec.date));
  rec.validatedAt = new Date().toISOString();
  rec.validatedBy = (S.meta.currentUser || {}).name || 'Système';
  rec.createdAt = rec.createdAt || rec.validatedAt;
  rec.createdBy = rec.createdBy || rec.validatedBy;
  rec.attachments = rec.attachments || [];
  rec.source = rec.source || 'manual';
  var i = d.entries.findIndex(function (x) { return x.id === rec.id; });
  if (i > -1) { if (d.entries[i].status !== 'draft') fail('Écriture déjà validée.'); d.entries[i] = rec; } else d.entries.push(rec);
  if (!opts.silent) Y.audit(S, cid, 'Validation', rec.num, rec.label + ' · ' + U.fmt(Y.entryTotals(rec).debit));
  return rec;
};
Y.deleteDraft = function (S, cid, id) {
  var d = Y.D(S, cid); var i = d.entries.findIndex(function (x) { return x.id === id; });
  if (i < 0) fail('Brouillon introuvable');
  if (d.entries[i].status !== 'draft') fail('Une écriture validée ne peut pas être supprimée : contre-passez-la.');
  d.entries.splice(i, 1);
};
Y.entry = function (S, cid, id) { return Y.D(S, cid).entries.find(function (e) { return e.id === id || e.num === id; }); };
Y.reverseEntry = function (S, cid, id, date, reason) {
  var e = Y.entry(S, cid, id);
  if (!e || e.status !== 'validated') fail('Seule une écriture validée peut être contre-passée.');
  if (e.reversedBy) fail('Cette écriture est déjà contre-passée par ' + e.reversedBy + '.');
  if (e.reversalOf) fail('Une contre-passation ne se contre-passe pas : saisissez une nouvelle écriture.');
  var r = {
    journal: e.journal === 'AN' ? 'OD' : e.journal, date: date, pieceDate: date, ref: e.num, label: 'Contre-passation de ' + e.num + (reason ? ' · ' + reason : ''),
    lines: e.lines.map(function (l) { return { account: l.account, label: l.label, debit: l.credit, credit: l.debit, tiersId: l.tiersId, section: l.section, taxCode: l.taxCode }; }),
    reversalOf: e.num, source: 'reversal'
  };
  var rec = Y.postEntry(S, cid, r, { silent: true });
  e.reversedBy = rec.num;
  Y.audit(S, cid, 'Contre-passation', e.num, 'par ' + rec.num + (reason ? ' · ' + reason : ''));
  return rec;
};

/* ---------------------------------------------------- interrogation du grand livre */
Y.validated = function (S, cid) { return Y.D(S, cid).entries.filter(function (e) { return e.status === 'validated'; }); };
Y.eachLine = function (S, cid, f, filt) {
  filt = filt || {};
  Y.validated(S, cid).forEach(function (e) {
    if (filt.from && e.date < filt.from) return;
    if (filt.to && e.date > filt.to) return;
    if (filt.journal && e.journal !== filt.journal) return;
    if (filt.excludeJournal && e.journal === filt.excludeJournal) return;
    e.lines.forEach(function (l, idx) {
      if (filt.account && l.account.indexOf(filt.account) !== 0) return;
      if (filt.tiersId && l.tiersId !== filt.tiersId) return;
      f(l, e, idx);
    });
  });
};
Y.balances = function (S, cid, filt) {
  var m = {};
  Y.eachLine(S, cid, function (l) { var b = m[l.account] || (m[l.account] = { d: 0, c: 0 }); b.d += l.debit; b.c += l.credit; }, filt);
  return m;
};
Y.net = function (S, cid, prefix, filt) {
  var t = 0; Y.eachLine(S, cid, function (l) { t += l.debit - l.credit; }, Object.assign({}, filt || {}, { account: prefix }));
  return t;
};
Y.trialBalance = function (S, cid, year, to) {
  var start = year + '-01-01', end = to || year + '-12-31';
  var an = Y.balances(S, cid, { from: start, to: end, journal: 'AN' });
  var mv = Y.balances(S, cid, { from: start, to: end, excludeJournal: 'AN' });
  var keys = Object.keys(an).concat(Object.keys(mv)).filter(function (v, i, a) { return a.indexOf(v) === i; }).sort();
  return keys.map(function (k) {
    var a = an[k] || { d: 0, c: 0 }, m = mv[k] || { d: 0, c: 0 };
    var aN = a.d - a.c, f = aN + m.d - m.c;
    return { account: k, label: Y.accountLabel(S, cid, k), anD: aN > 0 ? aN : 0, anC: aN < 0 ? -aN : 0, mvD: m.d, mvC: m.c, fD: f > 0 ? f : 0, fC: f < 0 ? -f : 0 };
  });
};
Y.ledger = function (S, cid, account, from, to, tiersId) {
  var rows = [], run = 0;
  var before = from ? Y.net(S, cid, account, { to: U.addDays(from, -1), tiersId: tiersId }) : 0;
  if (from) { run = before; rows.push({ date: from, journal: '', num: '', label: 'Solde au ' + U.frDate(U.addDays(from, -1)), debit: before > 0 ? before : 0, credit: before < 0 ? -before : 0, balance: run, opening: true }); }
  var ls = [];
  Y.eachLine(S, cid, function (l, e, idx) { ls.push({ l: l, e: e, idx: idx }); }, { account: account, from: from, to: to, tiersId: tiersId });
  ls.sort(function (a, b) { return a.e.date < b.e.date ? -1 : a.e.date > b.e.date ? 1 : (a.e.num < b.e.num ? -1 : 1); });
  ls.forEach(function (x) {
    run += x.l.debit - x.l.credit;
    rows.push({ date: x.e.date, journal: x.e.journal, num: x.e.num, entryId: x.e.id, idx: x.idx, label: x.l.label || x.e.label, account: x.l.account, tiersId: x.l.tiersId, letter: x.l.letter, debit: x.l.debit, credit: x.l.credit, balance: run });
  });
  return rows;
};

/* ------------------------------------------------------------------ lettrage */
function nextLetter(S, cid, account) {
  var used = {};
  Y.eachLine(S, cid, function (l) { if (l.letter) used[l.letter.toUpperCase()] = 1; }, { account: account });
  var A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (var i = 0; i < 26; i++) for (var j = 0; j < 26; j++) { var c = A[i] + A[j]; if (!used[c]) return c; }
  return 'ZZ' + Date.now();
}
Y.letterLines = function (S, cid, refs, opts) {
  opts = opts || {};
  if (!refs || refs.length < 2) fail('Sélectionnez au moins deux lignes.');
  var lines = refs.map(function (r) { var e = Y.entry(S, cid, r.entryId); return { e: e, l: e && e.lines[r.idx] }; });
  if (lines.some(function (x) { return !x.l; })) fail('Ligne introuvable.');
  var acc = lines[0].l.account;
  if (lines.some(function (x) { return x.l.account !== acc; })) fail('Le lettrage se fait sur un seul compte.');
  var tid = lines[0].l.tiersId;
  if (lines.some(function (x) { return x.l.tiersId !== tid; })) fail('Le lettrage se fait sur un seul tiers.');
  if (lines.some(function (x) { return x.l.letter; })) fail('Une des lignes est déjà lettrée.');
  var a = Y.account(S, cid, acc); if (!a || !a.lettrable) fail('Le compte ' + acc + ' n’est pas lettrable.');
  var diff = U.sum(lines, function (x) { return x.l.debit - x.l.credit; });
  if (diff !== 0 && !opts.partial) fail('Sélection non soldée : écart de ' + U.fmt(Math.abs(diff)) + '.');
  var code = nextLetter(S, cid, acc); if (diff !== 0) code = code.toLowerCase();
  lines.forEach(function (x) { x.l.letter = code; });
  Y.audit(S, cid, 'Lettrage', acc + (tid ? ' · ' + ((Y.tiers(S, cid, tid) || {}).code || '') : ''), code + ' · ' + refs.length + ' lignes');
  return code;
};
Y.unletter = function (S, cid, account, code) {
  var n = 0;
  Y.eachLine(S, cid, function (l) { if (l.letter === code) { l.letter = ''; n++; } }, { account: account });
  if (!n) fail('Lettre ' + code + ' introuvable sur ' + account + '.');
  Y.audit(S, cid, 'Délettrage', account, code);
  return n;
};
Y.autoLetter = function (S, cid, account) {
  // apparie, par tiers, une ligne au débit et une ligne au crédit de même montant (référence prioritaire)
  var open = [];
  Y.eachLine(S, cid, function (l, e, idx) { if (!l.letter && l.tiersId) open.push({ l: l, e: e, idx: idx }); }, { account: account });
  var done = 0;
  open.forEach(function (x) {
    if (x.l.letter || !x.l.debit) return;
    var m = open.find(function (y) { return !y.l.letter && y.l.credit === x.l.debit && y.l.tiersId === x.l.tiersId && y !== x && (y.e.ref === x.e.ref || y.e.ref === x.e.num || y.e.label.indexOf(x.e.ref || '#') > -1); })
      || open.find(function (y) { return !y.l.letter && y.l.credit === x.l.debit && y.l.tiersId === x.l.tiersId && y !== x; });
    if (m) { Y.letterLines(S, cid, [{ entryId: x.e.id, idx: x.idx }, { entryId: m.e.id, idx: m.idx }]); done++; }
  });
  return done;
};

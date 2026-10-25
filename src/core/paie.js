/*
 * myyiel Paie · moteur de paie paramétrable (pur JavaScript, sans DOM, exécutable sous Node).
 * - Règles par pays dans des « packs » de données datées (paie-cm.js), jamais dans ce code.
 * - Rubriques à formules (langage d'expression ci-dessous), modifiables par société.
 * - Séparation préparation / contrôle / validation gestionnaire / validation DRH / clôture DAF.
 * - Périodes validées figées (empreinte) ; recalcul de contrôle et régularisation sur la période ouverte.
 * - Écritures transmises à la comptabilité au format myyiel.journal-batch/1 (interfaces.js).
 * Spécifications : docs/paie/*.md
 */
import { Y } from './registry.js';

var U = Y.util;
var P = Y.Paie = {};
function fail(m) { throw new Y.BizError(m); }
function round(n) { return Math.round(Number(n) || 0); }

/* ====================================================================== langage d'expression
   Nombres, chaînes 'x' ou "x", identifiants (variables), + - * / %, comparaisons, && || !, a ? b : c, appels f(a, b).
   Fonctions : param(code) bareme(code, x) var(code) mt(code) fixe(code) rub(code) pat(code) min max abs arrondi plancher si(c, a, b). */
var AST = {};
function tokenize(src) {
  var t = [], i = 0, s = String(src);
  while (i < s.length) {
    var c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9.]/.test(c)) { var j = i; while (j < s.length && /[0-9._]/.test(s[j])) j++; t.push({ t: 'num', v: parseFloat(s.slice(i, j).replace(/_/g, '')) }); i = j; continue; }
    if (/[A-Za-z_]/.test(c)) { var k = i; while (k < s.length && /[A-Za-z0-9_]/.test(s[k])) k++; t.push({ t: 'id', v: s.slice(i, k) }); i = k; continue; }
    if (c === '"' || c === "'") { var e = s.indexOf(c, i + 1); if (e < 0) throw new Error('Chaîne non terminée'); t.push({ t: 'str', v: s.slice(i + 1, e) }); i = e + 1; continue; }
    var two = s.slice(i, i + 2);
    if (['<=', '>=', '==', '!=', '&&', '||'].indexOf(two) > -1) { t.push({ t: 'op', v: two }); i += 2; continue; }
    if ('+-*/%()<>,?:!'.indexOf(c) > -1) { t.push({ t: 'op', v: c }); i++; continue; }
    throw new Error('Caractère inattendu « ' + c + ' »');
  }
  return t;
}
function parse(src) {
  var tk = tokenize(src), p = 0;
  function peek(v) { return tk[p] && tk[p].t === 'op' && tk[p].v === v; }
  function eat(v) { if (!peek(v)) throw new Error('« ' + v + ' » attendu'); p++; }
  var BIN = [['||'], ['&&'], ['==', '!='], ['<', '>', '<=', '>='], ['+', '-'], ['*', '/', '%']];
  function ternary() { var c = bin(0); if (peek('?')) { p++; var a = ternary(); eat(':'); var b = ternary(); return { k: 'if', c: c, a: a, b: b }; } return c; }
  function bin(l) {
    if (l === BIN.length) return unary();
    var x = bin(l + 1);
    while (tk[p] && tk[p].t === 'op' && BIN[l].indexOf(tk[p].v) > -1) { var op = tk[p++].v; x = { k: 'bin', op: op, a: x, b: bin(l + 1) }; }
    return x;
  }
  function unary() { if (peek('-')) { p++; return { k: 'neg', a: unary() }; } if (peek('!')) { p++; return { k: 'not', a: unary() }; } if (peek('+')) { p++; return unary(); } return prim(); }
  function prim() {
    var x = tk[p++]; if (!x) throw new Error('Expression incomplète');
    if (x.t === 'num') return { k: 'num', v: x.v };
    if (x.t === 'str') return { k: 'str', v: x.v };
    if (x.t === 'op' && x.v === '(') { var e = ternary(); eat(')'); return e; }
    if (x.t === 'id') {
      if (peek('(')) { p++; var args = []; if (!peek(')')) { args.push(ternary()); while (peek(',')) { p++; args.push(ternary()); } } eat(')'); return { k: 'call', f: x.v, args: args }; }
      return { k: 'id', v: x.v };
    }
    throw new Error('Jeton inattendu « ' + x.v + ' »');
  }
  var r = ternary(); if (p < tk.length) throw new Error('Fin d’expression attendue près de « ' + tk[p].v + ' »'); return r;
}
P.compile = function (src) { if (!AST[src]) AST[src] = parse(src); return AST[src]; };
P.checkFormula = function (src) { try { P.compile(src); return null; } catch (e) { return e.message; } };
function ev(n, env) {
  switch (n.k) {
    case 'num': return n.v; case 'str': return n.v;
    case 'id': if (!(n.v in env.vars)) throw new Error('Variable inconnue ' + n.v); return env.vars[n.v];
    case 'neg': return -ev(n.a, env); case 'not': return ev(n.a, env) ? 0 : 1;
    case 'if': return ev(n.c, env) ? ev(n.a, env) : ev(n.b, env);
    case 'bin': {
      var a = ev(n.a, env), b;
      if (n.op === '&&') return a ? ev(n.b, env) : a; if (n.op === '||') return a ? a : ev(n.b, env);
      b = ev(n.b, env);
      switch (n.op) { case '+': return a + b; case '-': return a - b; case '*': return a * b; case '/': return b ? a / b : 0; case '%': return a % b; case '<': return +(a < b); case '>': return +(a > b); case '<=': return +(a <= b); case '>=': return +(a >= b); case '==': return +(a === b); case '!=': return +(a !== b); }
      break;
    }
    case 'call': {
      if (n.f === 'si') { if (n.args.length !== 3) throw new Error('si() attend 3 arguments'); return ev(n.args[0], env) ? ev(n.args[1], env) : ev(n.args[2], env); }
      var f = env.fns[n.f]; if (!f) throw new Error('Fonction inconnue ' + n.f + '()');
      return f.apply(null, n.args.map(function (x) { return ev(x, env); }));
    }
  }
  throw new Error('Nœud inconnu');
}
P.evaluate = function (src, vars, fns) { return ev(P.compile(src), { vars: vars, fns: fns }); };
P.FUNCTIONS = ['param(code)', 'bareme(code, x)', 'var(code)', 'mt(code)', 'fixe(code)', 'rub(code)', 'pat(code)', 'min(a, b)', 'max(a, b)', 'abs(x)', 'arrondi(x)', 'plancher(x)', 'si(condition, alors, sinon)'];
P.VARIABLES = { SB: 'Salaire de base du contrat', HMENS: 'Heures mensuelles du contrat', TH: 'Taux horaire (SB / HMENS)', JOURS_PAYES: 'Jours payés (30 = mois complet)', PRORATA: 'JOURS_PAYES / 30', ANC: 'Ancienneté en années révolues', TAUX_ANC: 'Taux d’ancienneté de la convention (%)', TAUX_AT: 'Taux accidents du travail de l’établissement (%)', ENFANTS: 'Nombre d’enfants à charge', SALJ_MOY: 'Salaire journalier moyen (12 derniers mois / 26)', BRUT: 'Brut cumulé', BRUT_TAXABLE: 'Brut taxable cumulé', BRUT_CASH_TAXABLE: 'Brut taxable hors avantages en nature', BASE_CNPS: 'Assiette CNPS cumulée', BASE: 'Base de la rubrique en cours', QTE: 'Nombre de la rubrique en cours', TAUX: 'Taux de la rubrique en cours' };

/* ============================================================================= réglementation */
P.rules = function (S, country) {
  S.paieRules = S.paieRules || {};
  if (!S.paieRules[country]) { var pk = Y.PAIE_PACKS[country]; if (!pk) fail('Aucun pack réglementaire pour ' + country); S.paieRules[country] = { country: country, label: pk.label, version: pk.version, params: U.clone(pk.params), baremes: U.clone(pk.baremes) }; }
  return S.paieRules[country];
};
function versionAt(list, date) { var x = null; list.forEach(function (v) { if (v.from <= date && (!x || v.from >= x.from)) x = v; }); return x; }
P.paramDef = function (S, country, code) { return P.rules(S, country).params.find(function (p) { return p.code === code; }); };
P.param = function (S, country, code, date) {
  var p = P.paramDef(S, country, code); if (!p) throw new Error('Paramètre ' + code + ' introuvable');
  var v = versionAt(p.versions, date); if (!v) throw new Error('Paramètre ' + code + ' sans valeur au ' + U.frDate(date)); return v.value;
};
P.baremeDef = function (S, country, code) { return P.rules(S, country).baremes.find(function (b) { return b.code === code; }); };
P.bareme = function (S, country, code, date, x) {
  var b = P.baremeDef(S, country, code); if (!b) throw new Error('Barème ' + code + ' introuvable');
  var v = versionAt(b.versions, date); if (!v) throw new Error('Barème ' + code + ' sans version au ' + U.frDate(date));
  if (b.kind === 'progressif') { var t = 0, prev = 0; v.rows.forEach(function (r) { var top = r[0] === null ? Infinity : r[0]; if (x > prev) t += (Math.min(x, top) - prev) * r[1] / 100; prev = top; }); return t; }
  for (var i = 0; i < v.rows.length; i++) { if (v.rows[i][0] === null || x < v.rows[i][0]) return v.rows[i][1]; }
  return 0;
};
function lastClosedEnd(S, cid) { var d = P.D(S, cid), e = ''; Object.keys(d.periods).forEach(function (k) { var p = d.periods[k]; if ((p.status === 'validee' || p.status === 'cloturee') && p.end > e) e = p.end; }); return e; }
/** Nouvelle version datée d'un paramètre ou d'un barème. Interdit de réécrire le passé d'une période validée (sauf rétroactivité explicite). */
P.addVersion = function (S, cid, kind, code, ver, opts) {
  opts = opts || {};
  var d = P.D(S, cid), r = P.rules(S, d.country), list = kind === 'bareme' ? r.baremes : r.params, def = list.find(function (x) { return x.code === code; });
  if (!def) fail('Élément réglementaire ' + code + ' introuvable.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ver.from || '')) fail('Date d’effet obligatoire.');
  if (!ver.reason) fail('Le motif (texte de référence) est obligatoire pour toute modification réglementaire.');
  var lc = lastClosedEnd(S, cid);
  if (lc && ver.from <= lc && !opts.retro) fail('La date d’effet (' + U.frDate(ver.from) + ') touche une période déjà validée (jusqu’au ' + U.frDate(lc) + '). Cochez « rétroactif » : une régularisation sera proposée sur la période ouverte.');
  if (kind === 'bareme') { if (!Array.isArray(ver.rows) || !ver.rows.length) fail('Barème vide.'); }
  else if (!(typeof ver.value === 'number' && isFinite(ver.value))) fail('Valeur numérique obligatoire.');
  var u = S.meta.currentUser || {};
  var rec = { from: ver.from, ref: ver.reason, by: u.name || 'Système', at: new Date().toISOString(), note: opts.retro ? 'Rétroactif' : '' };
  if (kind === 'bareme') rec.rows = ver.rows; else rec.value = ver.value;
  def.versions = def.versions.filter(function (x) { return x.from !== ver.from; }).concat([rec]).sort(function (a, b) { return a.from < b.from ? -1 : 1; });
  Y.audit(S, cid, 'Paie · réglementation', (kind === 'bareme' ? 'Barème ' : 'Paramètre ') + code, 'au ' + U.frDate(ver.from) + ' : ' + (kind === 'bareme' ? ver.rows.length + ' tranches' : ver.value) + ' · ' + ver.reason);
  return rec;
};

/* ============================================================================= données société */
P.D = function (S, cid) {
  var d = Y.D(S, cid);
  if (!d.paie) {
    var pk = Y.PAIE_PACKS.CM;
    d.paie = { country: 'CM', establishments: [], conventions: U.clone(pk.conventions), rubriques: U.clone(pk.rubriques), accounts: U.clone(pk.accounts), employees: [], periods: {}, advances: [], loans: [], bankOrders: [], advisors: [], timeEvents: [], signature: null, seq: { emp: 0, order: 0, adv: 0, loan: 0 },
      settings: { advance: { cutoffDay: 15, maxPerMonth: 1, approver: 'hr' }, notify: { inApp: true, email: true, whatsapp: true, remindDays: 3 }, payDay: 28, confidentiality: 'matricule', bulletinLang: 'fr', gta: { enabled: true, requireTimesheet: false } } };
  }
  return d.paie;
};
P.est = function (S, cid, code) { return P.D(S, cid).establishments.find(function (e) { return e.code === code; }); };
P.conv = function (S, cid, code) { return P.D(S, cid).conventions.find(function (c) { return c.code === code; }); };
P.emp = function (S, cid, id) { return P.D(S, cid).employees.find(function (e) { return e.id === id || e.matricule === id; }); };
P.fullName = function (e) { return (e.nom || '').toUpperCase() + ' ' + (e.prenoms || ''); };
P.periodBounds = function (key) { var y = +key.slice(0, 4), m = +key.slice(5, 7); return { year: y, month: m, start: key + '-01', end: U.monthEnd(y, m) }; };
P.nextKey = function (key) { var y = +key.slice(0, 4), m = +key.slice(5, 7) + 1; if (m > 12) { m = 1; y++; } return y + '-' + U.pad(m, 2); };
P.prevKey = function (key) { var y = +key.slice(0, 4), m = +key.slice(5, 7) - 1; if (m < 1) { m = 12; y--; } return y + '-' + U.pad(m, 2); };
P.monthLabel = function (key, en) { var b = P.periodBounds(key); return (en ? ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][b.month - 1] : U.MONTHS[b.month - 1]) + ' ' + b.year; };

/* ============================================================================= droits */
function role(S) { return (S.meta.currentUser || {}).role || 'reader'; }
P.can = function (S, right) { return Y.can(role(S), right); };
function need(S, right) { if (P._bypass) return; if (!P.can(S, right)) fail('Action réservée : ' + (Y.RIGHTS[right] || right).toLowerCase() + ' (rôle actuel : ' + ((Y.ROLES[role(S)] || {}).label || role(S)) + ').'); }
function who(S) { var u = S.meta.currentUser || {}; return { by: u.name || 'Système', role: role(S), at: new Date().toISOString() }; }

/* ============================================================================= référentiel salariés */
P.EMP_FIELDS = [
  ['matricule', 'Matricule', 'id', true], ['civilite', 'Civilité', 'id'], ['nom', 'Nom', 'id', true], ['prenoms', 'Prénoms', 'id', true], ['sexe', 'Sexe (M/F)', 'id'], ['naissance', 'Date de naissance', 'id', false, 'date'], ['lieuNaissance', 'Lieu de naissance', 'id'],
  ['nationalite', 'Nationalité', 'id'], ['cni', 'N° CNI / passeport', 'sensible'], ['niu', 'NIU', 'id'], ['cnps', 'N° d’immatriculation CNPS', 'id'], ['situation', 'Situation familiale', 'id'], ['enfants', 'Enfants à charge', 'id', false, 'int'],
  ['adresse', 'Adresse', 'contact'], ['ville', 'Ville', 'contact'], ['telephone', 'Téléphone', 'contact'], ['whatsapp', 'WhatsApp', 'contact'], ['email', 'E-mail', 'contact'], ['urgence', 'Contact d’urgence', 'contact'],
  ['site', 'Établissement (code)', 'poste', true], ['service', 'Service', 'poste', true], ['poste', 'Poste', 'poste', true], ['convention', 'Convention collective (code)', 'poste', true], ['categorie', 'Catégorie', 'poste'], ['echelon', 'Échelon', 'poste'], ['section', 'Section analytique', 'poste'],
  ['contrat', 'Type de contrat (CDI, CDD, Stage, Temporaire)', 'contrat', true], ['embauche', 'Date d’embauche', 'contrat', true, 'date'], ['anciennete', 'Date d’ancienneté', 'contrat', false, 'date'], ['finContrat', 'Fin de contrat (CDD)', 'contrat', false, 'date'], ['essaiFin', 'Fin de période d’essai', 'contrat', false, 'date'], ['horaire', 'Heures mensuelles', 'contrat', false, 'num'],
  ['sb', 'Salaire de base mensuel (XAF)', 'sensible', true, 'money'], ['modePaiement', 'Mode de paiement (virement, momo, especes)', 'sensible', true], ['banque', 'Banque', 'sensible'], ['codeBanque', 'Code banque', 'sensible'], ['guichet', 'Code guichet', 'sensible'], ['compte', 'N° de compte', 'sensible'], ['cle', 'Clé RIB', 'sensible'], ['agence', 'Agence', 'sensible'], ['momo', 'N° Mobile Money', 'sensible'], ['operateur', 'Opérateur (MTN, Orange)', 'sensible']
];
P.SENSITIVE = P.EMP_FIELDS.filter(function (f) { return f[2] === 'sensible'; }).map(function (f) { return f[0]; });
P.nextMatricule = function (S, cid) { var d = P.D(S, cid), n = d.seq.emp; do { n++; } while (d.employees.some(function (e) { return e.matricule === 'YG' + U.pad(n, 4); })); d.seq.emp = n; return 'YG' + U.pad(n, 4); };
P.validateEmployee = function (S, cid, e, opts) {
  opts = opts || {}; var d = P.D(S, cid), errs = [], warns = [];
  P.EMP_FIELDS.forEach(function (f) { if (f[3] && (e[f[0]] === undefined || e[f[0]] === null || e[f[0]] === '')) errs.push(f[1] + ' obligatoire.'); });
  if (e.matricule && d.employees.some(function (x) { return x.matricule === e.matricule && x.id !== e.id; })) errs.push('Matricule ' + e.matricule + ' déjà attribué.');
  ['naissance', 'embauche', 'anciennete', 'finContrat', 'essaiFin'].forEach(function (k) { if (e[k] && !/^\d{4}-\d{2}-\d{2}$/.test(e[k])) errs.push('Date invalide : ' + k + '.'); });
  if (e.sb !== undefined && e.sb !== '' && !(Number(e.sb) >= 0)) errs.push('Salaire de base invalide.');
  if (e.site && !P.est(S, cid, e.site)) errs.push('Établissement « ' + e.site + ' » inconnu.');
  if (e.convention && !P.conv(S, cid, e.convention)) errs.push('Convention « ' + e.convention + ' » inconnue.');
  if (e.contrat && ['CDI', 'CDD', 'Stage', 'Temporaire'].indexOf(e.contrat) < 0) errs.push('Type de contrat inconnu : ' + e.contrat + '.');
  if (e.contrat === 'CDD' && !e.finContrat) errs.push('Un CDD exige une date de fin.');
  if (e.modePaiement === 'virement' && !e.compte) warns.push('Virement sans n° de compte.');
  if (e.modePaiement === 'momo' && !/^\+?\d[\d ]{7,20}$/.test(e.momo || '')) errs.push('N° Mobile Money invalide pour un paiement Mobile Money.');
  if (e.modePaiement && ['virement', 'momo', 'especes'].indexOf(e.modePaiement) < 0) errs.push('Mode de paiement inconnu : ' + e.modePaiement + '.');
  if (e.niu && !/^[A-Z0-9]{8,20}$/i.test(e.niu)) errs.push('NIU invalide.');
  if (e.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e.email)) errs.push('E-mail invalide.');
  if (!e.cnps) warns.push('N° CNPS manquant.');
  return { errors: errs, warnings: warns };
};
function normEmp(e) {
  var o = Object.assign({}, e);
  o.sb = round(U.parseAmount(o.sb)); o.enfants = +o.enfants || 0; o.horaire = +o.horaire || 0;
  o.contrat = o.contrat ? String(o.contrat).toUpperCase().replace('STAGE', 'Stage').replace('TEMPORAIRE', 'Temporaire') : o.contrat;
  if (o.modePaiement) { var m = String(o.modePaiement).toLowerCase(); o.modePaiement = /momo|mobile|mtn|orange/.test(m) ? 'momo' : (/esp|cash/.test(m) ? 'especes' : 'virement'); }
  if (o.sexe) o.sexe = /^f/i.test(o.sexe) ? 'F' : 'M';
  return o;
}
P.saveEmployee = function (S, cid, input, opts) {
  opts = opts || {}; need(S, 'pay.prepare');
  var d = P.D(S, cid), e = normEmp(input), ex = e.id ? P.emp(S, cid, e.id) : null;
  if (!e.matricule && opts.autoMatricule !== false) e.matricule = P.nextMatricule(S, cid);
  var chk = P.validateEmployee(S, cid, e); if (chk.errors.length) fail(chk.errors);
  var w = who(S);
  if (ex) {
    var ch = [];
    Object.keys(e).forEach(function (k) { if (['id', 'history', 'fixes', 'conges'].indexOf(k) > -1) return; if (String(ex[k] == null ? '' : ex[k]) !== String(e[k] == null ? '' : e[k])) { ch.push({ field: k, old: P.SENSITIVE.indexOf(k) > -1 ? '•••' : ex[k], val: P.SENSITIVE.indexOf(k) > -1 ? '•••' : e[k] }); ex[k] = e[k]; } });
    if (e.fixes) ex.fixes = e.fixes;
    if (ch.length) { ex.history.push(Object.assign({ changes: ch }, w)); Y.audit(S, cid, 'Paie · modification salarié', ex.matricule, ch.map(function (c) { return c.field; }).join(', ')); }
    return ex;
  }
  var rec = Object.assign({ id: U.uid('emp'), statut: 'actif', fixes: {}, conges: { solde: 0, acquisAnnee: 0, prisAnnee: 0 }, history: [], nationalite: 'Camerounaise', horaire: 0, enfants: 0, section: '' }, e);
  rec.anciennete = rec.anciennete || rec.embauche;
  rec.history = [Object.assign({ changes: [{ field: 'création', old: '', val: opts.source || 'saisie' }] }, w)];
  d.employees.push(rec);
  Y.audit(S, cid, 'Paie · création salarié', rec.matricule, P.fullName(rec) + ' · ' + (opts.source || 'saisie'));
  return rec;
};

/* Import du fichier salariés : correspondance, doublons, matricules manquants, champs obligatoires, rapport avant validation. */
P.IMPORT_SYNONYMS = { matricule: ['mat', 'id', 'employeeid', 'numero'], nom: ['lastname', 'name', 'surname'], prenoms: ['prenom', 'firstname', 'prenomsalarie'], sb: ['salairebase', 'salaire', 'basesalary', 'salairemensuel'], embauche: ['dateembauche', 'dateentree', 'hiredate', 'entree'], site: ['etablissement', 'siege', 'agencesite', 'lieu'], convention: ['conventioncollective', 'cc'], cnps: ['numerocnps', 'matriculecnps', 'nocnps'], modePaiement: ['modepaiement', 'paiement', 'mode'], compte: ['numerocompte', 'rib', 'account'], momo: ['mobilemoney', 'nummomo', 'om', 'numeromomo'], telephone: ['tel', 'phone', 'portable'], poste: ['fonction', 'emploi', 'jobtitle'], service: ['departement', 'direction'] };
P.mapEmployeeColumns = function (header) {
  var keys = header.map(Y.normKey), map = {}, used = {};
  P.EMP_FIELDS.forEach(function (f) {
    var c = [Y.normKey(f[0]), Y.normKey(f[1]), Y.normKey(String(f[1]).replace(/\(.*?\)/g, ''))].concat(P.IMPORT_SYNONYMS[f[0]] || []);
    var i = keys.findIndex(function (k, j) { return !used[j] && c.indexOf(k) > -1; });
    if (i > -1) { map[f[0]] = i; used[i] = 1; } else map[f[0]] = -1;
  });
  return map;
};
P.employeeTemplate = function () {
  return [P.EMP_FIELDS.map(function (f) { return f[1]; }),
    ['YG0101', 'M.', 'ETOA', 'Jean-Marc', 'M', '16/05/1990', 'Yaoundé', 'Camerounaise', 'CE123456', 'P123456789012A', '123-4567890-A', 'Marié(e)', '2', 'Bonapriso', 'Douala', '+237 677 00 00 01', '+237 677 00 00 01', 'jm.etoa@exemple.cm', 'Mme Etoa +237 699 00 00 00', 'DLA', 'Conseil', 'Consultant senior', 'CC-COM', '8', 'A', 'CNS', 'CDI', '01/03/2021', '', '', '01/06/2021', '173.33', '650000', 'virement', '[BANQUE]', '10005', '00001', '01234567890', '12', 'Akwa', '', ''],
    ['', 'Mme', 'MBIDA', 'Carine', 'F', '1997-09-12', 'Sangmélima', 'Camerounaise', '', '', '', 'Célibataire', '0', 'Bastos', 'Yaoundé', '+237 690 00 00 02', '', '', '', 'YDE', 'Produit', 'Développeuse', 'CC-NUM', '2', 'A', 'LOG', 'CDD', '2026-02-01', '', '2027-01-31', '2026-03-31', '', '300000', 'momo', '', '', '', '', '', '', '+237 690 00 00 02', 'Orange']];
};
function rowToEmp(row, map) {
  var o = {};
  P.EMP_FIELDS.forEach(function (f) { var i = map[f[0]]; var v = i >= 0 && i !== undefined ? row[i] : ''; v = v == null ? '' : String(v).trim(); if (f[4] === 'date' && v) v = Y.parseDate(row[i]) || ('?' + v); if (f[4] === 'money' && v !== '') v = U.parseAmount(v); o[f[0]] = v; });
  return o;
}
P.analyzeEmployeeImport = function (S, cid, rows, map, opts) {
  opts = opts || {}; var d = P.D(S, cid), out = { rows: [], ok: 0, errors: 0, warnings: 0, duplicates: 0, missingMatricule: 0, updates: 0 };
  var seen = {};
  rows.forEach(function (r, i) {
    if (!r.some(function (c) { return String(c == null ? '' : c).trim() !== ''; })) return;
    var e = rowToEmp(r, map), line = i + 2, issues = [], warns = [], action = 'création';
    Object.keys(e).forEach(function (k) { if (typeof e[k] === 'string' && e[k][0] === '?') { issues.push('Date illisible (' + k + ') : ' + e[k].slice(1)); e[k] = ''; } });
    if (!e.matricule) { out.missingMatricule++; if (opts.autoMatricule) warns.push('Matricule manquant : il sera attribué automatiquement.'); else issues.push('Matricule manquant.'); }
    if (e.matricule && seen[e.matricule]) { out.duplicates++; issues.push('Doublon dans le fichier : matricule ' + e.matricule + ' déjà présent ligne ' + seen[e.matricule] + '.'); }
    if (e.matricule) seen[e.matricule] = line;
    var ex = e.matricule ? d.employees.find(function (x) { return x.matricule === e.matricule; }) : null;
    if (!ex && e.nom && e.naissance) { var twin = d.employees.find(function (x) { return x.nom.toLowerCase() === String(e.nom).toLowerCase() && x.prenoms.toLowerCase() === String(e.prenoms).toLowerCase() && x.naissance === e.naissance; }); if (twin) { out.duplicates++; issues.push('Doublon probable : ' + P.fullName(twin) + ' existe déjà (matricule ' + twin.matricule + ', même date de naissance).'); } }
    if (ex) { if (opts.updateExisting) { action = 'mise à jour'; e.id = ex.id; out.updates++; } else { out.duplicates++; issues.push('Matricule ' + e.matricule + ' déjà présent dans myyiel (' + P.fullName(ex) + ').'); } }
    var n = normEmp(e); if (!n.matricule && opts.autoMatricule) n.matricule = 'AUTO';
    var chk = P.validateEmployee(S, cid, Object.assign({}, n, n.matricule === 'AUTO' ? { matricule: 'TMP' + i } : {}));
    issues = issues.concat(chk.errors.filter(function (m) { return !/Matricule .* déjà attribué/.test(m) || !ex; }).filter(function (m) { return m !== 'Matricule obligatoire.'; }));
    warns = warns.concat(chk.warnings);
    out.rows.push({ line: line, emp: e, action: action, errors: issues, warnings: warns });
    if (issues.length) out.errors++; else out.ok++;
    if (warns.length) out.warnings++;
  });
  return out;
};
P.importEmployees = function (S, cid, analysis, opts) {
  need(S, 'pay.prepare'); opts = opts || {};
  var n = 0;
  analysis.rows.forEach(function (r) { if (r.errors.length) return; var e = Object.assign({}, r.emp); if (!e.matricule) delete e.matricule; P.saveEmployee(S, cid, e, { source: 'import ' + (opts.file || ''), autoMatricule: true }); n++; });
  Y.audit(S, cid, 'Paie · import salariés', opts.file || 'fichier', n + ' salarié(s) · ' + (analysis.rows.length - n) + ' rejet(s)');
  return n;
};

/* ============================================================================= périodes et variables */
P.period = function (S, cid, key, create) {
  var d = P.D(S, cid);
  if (!d.periods[key] && create) {
    var b = P.periodBounds(key);
    d.periods[key] = { key: key, year: b.year, month: b.month, start: b.start, end: b.end, status: 'preparation', vars: {}, slips: {}, anomalies: [], history: [Object.assign({ action: 'Ouverture de la période' }, who(S))], journal: null, payments: [], decl: {} };
  }
  return d.periods[key];
};
P.openKey = function (S, cid) { var d = P.D(S, cid), ks = Object.keys(d.periods).sort(); var o = ks.filter(function (k) { return ['validee', 'cloturee'].indexOf(d.periods[k].status) < 0; }); return o[0] || (ks.length ? P.nextKey(ks[ks.length - 1]) : S.meta.today.slice(0, 7)); };
/** Période « en cours de traitement » : la plus ancienne non clôturée (une paie validée reste affichée jusqu'à sa clôture par la DAF). */
P.currentKey = function (S, cid) { var d = P.D(S, cid), ks = Object.keys(d.periods).sort(), o = ks.filter(function (k) { return d.periods[k].status !== 'cloturee'; }); return o[0] || P.openKey(S, cid); };
P.isFrozen = function (p) { return p.status === 'validee' || p.status === 'cloturee'; };
P.VAR_CODES = function (S, cid) { return P.D(S, cid).rubriques.filter(function (r) { return r.active !== false && ['variable', 'sortie'].indexOf(r.source) > -1; }); };
P.addVar = function (S, cid, key, empId, v) {
  need(S, 'pay.prepare');
  var p = P.period(S, cid, key, true); if (P.isFrozen(p)) fail('Période ' + P.monthLabel(key) + ' validée : saisissez la variable sur la période ouverte (régularisation).');
  var r = P.D(S, cid).rubriques.find(function (x) { return x.code === v.code; }); if (!r) fail('Rubrique ' + v.code + ' inconnue.');
  var q = r.unit ? Number(v.qty) : 0, a = r.unit ? 0 : round(U.parseAmount(v.amount));
  if (r.unit && !(q > 0)) fail('Nombre invalide pour ' + r.label + '.');
  if (!r.unit && !a) fail('Montant invalide pour ' + r.label + '.');
  var rec = Object.assign({ id: U.uid('var'), code: v.code, qty: q, amount: a, source: v.source || 'saisie', note: v.note || '' }, who(S));
  (p.vars[empId] = p.vars[empId] || []).push(rec);
  if (p.status !== 'preparation') { p.status = 'preparation'; p.history.push(Object.assign({ action: 'Retour en préparation (variable modifiée)' }, who(S))); }
  Y.audit(S, cid, 'Paie · variable', key + ' · ' + (P.emp(S, cid, empId) || {}).matricule, r.code + ' ' + (q || U.fmt(a)) + ' · ' + rec.source);
  return rec;
};
P.delVar = function (S, cid, key, empId, varId) {
  need(S, 'pay.prepare'); var p = P.period(S, cid, key); if (!p || P.isFrozen(p)) fail('Période figée.');
  var l = p.vars[empId] || [], v = l.find(function (x) { return x.id === varId; }); if (!v) fail('Variable introuvable.');
  if (v.source === 'avance' || v.source === 'prêt') fail('Cette retenue provient d’une avance ou d’un prêt : gérez-la depuis Avances & prêts.');
  p.vars[empId] = l.filter(function (x) { return x.id !== varId; }); p.status = 'preparation';
  Y.audit(S, cid, 'Paie · suppression variable', key, v.code);
};

/* Import des temps (GTA) : format myyiel.time-events/1 (matricule, date, type, quantité). */
P.TIME_TYPES = { HS1: 'Heures sup. 20 %', HS2: 'Heures sup. 30 %', HS3: 'Heures sup. 40 %', HSN: 'Heures nuit / dimanche / férié', ABS_NP: 'Absence non rémunérée (jours)', CONGE: 'Congé payé (jours)', ABS_MAL: 'Absence maladie rémunérée (jours, information)', ABS_AUT: 'Absence autorisée payée (jours, information)', RETARD: 'Retards (minutes, information)' };
P.importTimeEvents = function (S, cid, key, events, opts) {
  need(S, 'pay.prepare'); opts = opts || {};
  var p = P.period(S, cid, key, true); if (P.isFrozen(p)) fail('Période figée.');
  var res = { ok: 0, errors: [], info: 0 }, agg = {};
  events.forEach(function (ev, i) {
    var n = 'Ligne ' + (i + 2) + ' : ', e = P.emp(S, cid, String(ev.matricule || '').trim());
    if (!e) { res.errors.push(n + 'matricule ' + ev.matricule + ' inconnu.'); return; }
    var date = Y.parseDate(ev.date); if (!date || date < p.start || date > p.end) { res.errors.push(n + 'date hors période ' + P.monthLabel(key) + '.'); return; }
    var t = String(ev.type || '').toUpperCase(); if (!P.TIME_TYPES[t]) { res.errors.push(n + 'type ' + ev.type + ' inconnu.'); return; }
    var q = Number(String(ev.quantite).replace(',', '.')); if (!(q > 0)) { res.errors.push(n + 'quantité invalide.'); return; }
    P.D(S, cid).timeEvents.push({ id: U.uid('te'), key: key, empId: e.id, date: date, type: t, qty: q, comment: ev.commentaire || '', source: opts.source || 'GTA' });
    if (['ABS_MAL', 'ABS_AUT', 'RETARD'].indexOf(t) > -1) { res.info++; return; }
    var k = e.id + '|' + t; agg[k] = (agg[k] || 0) + q; res.ok++;
  });
  Object.keys(agg).forEach(function (k) {
    var pp = k.split('|'); p.vars[pp[0]] = (p.vars[pp[0]] || []).filter(function (v) { return !(v.code === pp[1] && v.source === (opts.source || 'GTA')); });
    p.vars[pp[0]].push(Object.assign({ id: U.uid('var'), code: pp[1], qty: Math.round(agg[k] * 100) / 100, amount: 0, source: opts.source || 'GTA', note: 'Agrégé depuis les pointages' }, who(S)));
  });
  p.status = 'preparation';
  Y.audit(S, cid, 'Paie · import des temps', key, res.ok + ' événements · ' + res.errors.length + ' rejets');
  return res;
};

/* ============================================================================= calcul */
function seniority(e, date) { var a = e.anciennete || e.embauche; if (!a) return 0; return Math.max(0, Math.floor(U.daysBetween(a, date) / 365.25)); }
function prorata(e, p) {
  var s = e.embauche > p.start ? e.embauche : p.start, en = (e.sortie && e.sortie.date && e.sortie.date < p.end) ? e.sortie.date : p.end;
  if (s > p.end || en < p.start || en < s) return 0;
  if (s === p.start && en === p.end) return 30;
  return Math.min(30, U.daysBetween(s, en) + 1);
}
function autoRetenues(S, cid, key, e) {
  var d = P.D(S, cid), out = [];
  d.advances.forEach(function (a) { if (a.empId === e.id && a.retainPeriod === key && (a.status === 'versee' || a.status === 'retenue')) out.push({ id: 'adv-' + a.id, code: 'AVANCE', qty: 0, amount: a.amount, source: 'avance', note: a.ref }); });
  d.loans.forEach(function (l) { if (l.empId !== e.id || l.status !== 'actif' || l.start > key) return; var paid = U.sum(l.schedule || [], function (x) { return x.key < key ? x.amount : 0; }); var rest = l.amount - paid; if (rest > 0) out.push({ id: 'loan-' + l.id, code: 'PRET', qty: 0, amount: Math.min(l.monthly, rest), source: 'prêt', note: l.ref }); });
  return out;
}
P.varsFor = function (S, cid, key, e) { var p = P.period(S, cid, key, true); return (p.vars[e.id] || []).concat(autoRetenues(S, cid, key, e)); };
function history12(S, cid, e, key) {
  var d = P.D(S, cid), ks = Object.keys(d.periods).filter(function (k) { return k < key && P.isFrozen(d.periods[k]) && d.periods[k].slips[e.id]; }).sort().slice(-12);
  return ks.map(function (k) { return d.periods[k].slips[e.id]; });
}
/** Calcule le bulletin d'un salarié pour une période (ne modifie rien). */
P.computeSlip = function (S, cid, key, e, opts) {
  opts = opts || {};
  var d = P.D(S, cid), country = d.country, p = opts.period || P.period(S, cid, key, true), date = p.end;
  var est = P.est(S, cid, e.site) || {}, conv = P.conv(S, cid, e.convention) || {};
  var vars = opts.vars || P.varsFor(S, cid, key, e), fixes = e.fixes || {};
  var hist = opts.history || history12(S, cid, e, key);
  var jp = prorata(e, p), anc = seniority(e, date);
  var hm = e.horaire || P.param(S, country, 'HEURES_MOIS', date);
  var avg = hist.length ? U.sum(hist, function (s) { return s.totals.brut - s.totals.nature; }) / hist.length : e.sb;
  var V = { SB: e.sb, HMENS: hm, TH: e.sb / hm, JOURS_PAYES: jp, PRORATA: jp / 30, ANC: anc, ENFANTS: e.enfants || 0, SALJ_MOY: Math.round(avg / 26),
    TAUX_ANC: conv.anc ? P.bareme(S, country, conv.anc, date, anc) : 0, TAUX_AT: P.param(S, country, 'AT_PAT_' + (est.atGroup || 'A'), date),
    BRUT: 0, BRUT_TAXABLE: 0, BRUT_CASH_TAXABLE: 0, BASE_CNPS: 0, NATURE: 0, BASE: 0, QTE: 0, TAUX: 0 };
  var done = {}, pats = {};
  var F = {
    param: function (c) { return P.param(S, country, c, date); }, bareme: function (c, x) { return P.bareme(S, country, c, date, x); },
    var: function (c) { return U.sum(vars.filter(function (v) { return v.code === c; }), function (v) { return v.qty; }); },
    mt: function (c) { return U.sum(vars.filter(function (v) { return v.code === c; }), function (v) { return v.amount; }); },
    fixe: function (c) { var x = fixes[c]; return x === true ? 1 : (+x || 0); }, rub: function (c) { return done[c] || 0; }, pat: function (c) { return pats[c] || 0; },
    min: Math.min, max: Math.max, abs: Math.abs, arrondi: function (x) { return Math.round(x); }, plancher: Math.floor, si: null
  };
  var lines = [], errors = [], T = { brut: 0, nature: 0, cotSal: 0, impots: 0, retenues: 0, pat: 0 };
  var rubs = d.rubriques.filter(function (r) { return r.active !== false; }).sort(function (a, b) { return a.order - b.order; });
  if (jp === 0) return { empty: true, empId: e.id, matricule: e.matricule, key: key, lines: [], totals: { brut: 0, nature: 0, brutTaxable: 0, baseCnps: 0, cotSal: 0, impots: 0, retenues: 0, net: 0, pat: 0, cost: 0 }, errors: [] };
  rubs.forEach(function (r) {
    try {
      if (r.cond && !P.evaluate(r.cond, V, F)) return;
      var base = r.base ? P.evaluate(r.base, V, F) : null, qty = r.qty ? P.evaluate(r.qty, V, F) : null, rate = r.rate ? P.evaluate(r.rate, V, F) : null;
      V.BASE = base || 0; V.QTE = qty || 0; V.TAUX = rate || 0;
      var amt;
      if (r.amount) amt = P.evaluate(r.amount, V, F);
      else if (r.kind === 'cotisation') amt = rate !== null ? (base || 0) * rate / 100 : 0;
      else { amt = 1; var any = false; if (base !== null) { amt *= base; any = true; } if (qty !== null) { amt *= qty; any = true; } if (rate !== null) { amt *= rate / 100; any = true; } if (!any) amt = 0; }
      amt = round(amt);
      var patRate = r.patRate ? P.evaluate(r.patRate, V, F) : null, pat = patRate !== null ? round((base || 0) * patRate / 100) : 0;
      done[r.code] = amt; pats[r.code] = pat;
      if (!amt && !pat && r.kind !== 'gain') return;
      if (!amt && r.kind === 'gain' && r.code !== 'SB') return;
      var L = { code: r.code, label: r.label, labelEn: r.labelEn || r.label, kind: r.kind, base: base === null ? null : round(base), qty: qty, rate: rate, unit: r.unit || '', org: r.org || '', acc: r.acc || '', taxable: !!r.taxable, cnps: !!r.cnps };
      if (r.kind === 'gain' || r.kind === 'nature') {
        L.gain = amt; T.brut += amt; V.BRUT += amt;
        if (r.taxable) { V.BRUT_TAXABLE += amt; if (r.kind === 'gain') V.BRUT_CASH_TAXABLE += amt; }
        if (r.cnps) V.BASE_CNPS += amt;
        if (r.kind === 'nature') { T.nature += amt; V.NATURE += amt; }
      } else {
        L.sal = amt; L.patRate = patRate; L.pat = pat; T.pat += pat;
        if (r.kind === 'cotisation') T.cotSal += amt; else if (r.kind === 'impot') T.impots += amt; else T.retenues += amt;
      }
      lines.push(L);
    } catch (x) { errors.push(r.code + ' : ' + x.message); }
  });
  var net = T.brut - T.nature - T.cotSal - T.impots - T.retenues;
  var cum = { brut: 0, taxable: 0, irpp: 0, net: 0, cnps: 0 };
  var d2 = P.D(S, cid);
  Object.keys(d2.periods).forEach(function (k) { var pp = d2.periods[k]; if (pp.year !== p.year || k >= key || !P.isFrozen(pp) || !pp.slips[e.id]) return; var t = pp.slips[e.id].totals; cum.brut += t.brut; cum.taxable += t.brutTaxable; cum.irpp += t.irpp || 0; cum.net += t.net; cum.cnps += t.cnpsSal || 0; });
  var irpp = (done.IRPP || 0) + (done.CAC || 0);
  var accrued = jp / 30 * P.param(S, country, 'CONGES_JOURS_MOIS', date) + Math.floor(anc / 5) * P.param(S, country, 'CONGES_MAJ_5ANS', date) / 12;
  var taken = F.var('CONGE');
  var totals = { brut: T.brut, nature: T.nature, brutTaxable: round(V.BRUT_TAXABLE), baseCnps: round(V.BASE_CNPS), cotSal: T.cotSal, impots: T.impots, retenues: T.retenues, net: net, pat: T.pat, cost: T.brut - T.nature + T.pat, irpp: irpp, cnpsSal: done.PVID || 0 };
  cum.brut += totals.brut; cum.taxable += totals.brutTaxable; cum.irpp += irpp; cum.net += net; cum.cnps += totals.cnpsSal;
  return { id: U.uid('bp'), empId: e.id, matricule: e.matricule, key: key, lines: lines, totals: totals, errors: errors,
    ctx: { jp: jp, anc: anc, tauxAnc: V.TAUX_ANC, th: Math.round(V.TH), site: e.site, convention: e.convention, categorie: e.categorie, echelon: e.echelon, poste: e.poste, service: e.service, contrat: e.contrat, mode: e.modePaiement },
    leave: { before: Math.round((e.conges.solde || 0) * 100) / 100, acquired: Math.round(accrued * 100) / 100, taken: taken, after: Math.round(((e.conges.solde || 0) + accrued - taken) * 100) / 100 }, cumuls: cum, computedAt: new Date().toISOString() };
};
P.activeEmployees = function (S, cid, key) {
  var b = P.periodBounds(key);
  return P.D(S, cid).employees.filter(function (e) { return e.embauche <= b.end && !(e.sortie && e.sortie.date && e.sortie.date < b.start) && e.statut !== 'archive'; });
};
P.calculate = function (S, cid, key, opts) {
  opts = opts || {}; if (!opts.system) need(S, 'pay.prepare');
  var p = P.period(S, cid, key, true); if (P.isFrozen(p)) fail('Période ' + P.monthLabel(key) + ' validée : elle ne peut plus être recalculée (utilisez le recalcul de contrôle et la régularisation).');
  var list = P.activeEmployees(S, cid, key), t0 = Date.now();
  p.slips = {};
  list.forEach(function (e) { var s = P.computeSlip(S, cid, key, e, { period: p }); if (!s.empty) p.slips[e.id] = s; });
  p.status = 'calculee'; p.calculatedAt = new Date().toISOString();
  p.anomalies = P.check(S, cid, key);
  var blocking = p.anomalies.filter(function (a) { return a.level === 'bloquante'; }).length;
  if (!blocking) p.status = 'controlee';
  p.history.push(Object.assign({ action: 'Calcul et contrôle', comment: Object.keys(p.slips).length + ' bulletins · ' + blocking + ' anomalie(s) bloquante(s) · ' + (Date.now() - t0) + ' ms' }, who(S)));
  if (!opts.system) Y.audit(S, cid, 'Paie · calcul', key, Object.keys(p.slips).length + ' bulletins · net ' + U.fmt(P.totals(S, cid, key).net));
  return p;
};
P.totals = function (S, cid, key) {
  var p = P.period(S, cid, key); var t = { count: 0, brut: 0, nature: 0, cotSal: 0, impots: 0, retenues: 0, net: 0, pat: 0, cost: 0 };
  if (!p) return t;
  Object.keys(p.slips).forEach(function (k) { var s = p.slips[k].totals; t.count++; ['brut', 'nature', 'cotSal', 'impots', 'retenues', 'net', 'pat', 'cost'].forEach(function (x) { t[x] += s[x]; }); });
  return t;
};

/* ============================================================================= anomalies */
P.ANOMALIES = {
  B01: ['bloquante', 'Salaire de base inférieur au SMIG'], B02: ['bloquante', 'Salaire inférieur au minimum de la grille conventionnelle'], B03: ['bloquante', 'Net à payer négatif'], B04: ['bloquante', 'Coordonnées de paiement manquantes'],
  B05: ['bloquante', 'N° d’immatriculation CNPS manquant'], B06: ['bloquante', 'Matricule en double'], B07: ['bloquante', 'Contrat échu sans sortie enregistrée'], B08: ['bloquante', 'Absences supérieures aux jours payés'], B09: ['bloquante', 'Erreur de calcul (paramètre, barème ou formule)'],
  W01: ['non bloquante', 'Variation du net supérieure à 20 % par rapport au mois précédent'], W02: ['non bloquante', 'Heures supplémentaires au-delà du plafond d’alerte'], W03: ['non bloquante', 'Même compte bancaire pour plusieurs salariés (risque de fraude)'], W04: ['non bloquante', 'Même numéro Mobile Money pour plusieurs salariés'],
  W05: ['non bloquante', 'CDD arrivant à échéance dans moins de 30 jours'], W06: ['non bloquante', 'Fin de période d’essai ce mois-ci'], W07: ['non bloquante', 'Solde de congés négatif ou supérieur à 45 jours'], W08: ['non bloquante', 'NIU manquant'], W09: ['non bloquante', 'Section analytique manquante'],
  W10: ['non bloquante', 'Changement de palier d’ancienneté ce mois-ci'], W11: ['non bloquante', 'Retenues (avances, prêts) supérieures à la quotité d’alerte du net'], W12: ['non bloquante', 'Aucun pointage reçu de la GTA ce mois-ci'], W13: ['non bloquante', 'Salaire très éloigné de la médiane du poste (Yiélina)']
};
P.check = function (S, cid, key) {
  var d = P.D(S, cid), p = P.period(S, cid, key, true), out = [], country = d.country, date = p.end;
  function add(code, e, detail, go) { out.push({ code: code, level: P.ANOMALIES[code][0], label: P.ANOMALIES[code][1], empId: e ? e.id : '', matricule: e ? e.matricule : '', name: e ? P.fullName(e) : '', detail: detail, go: go || '' }); }
  var smig = P.param(S, country, 'SMIG', date), prevKey = P.prevKey(key), prev = d.periods[prevKey];
  var mats = {}, ribs = {}, momos = {};
  d.employees.forEach(function (e) { (mats[e.matricule] = mats[e.matricule] || []).push(e); });
  P.activeEmployees(S, cid, key).forEach(function (e) {
    var s = p.slips[e.id];
    if (mats[e.matricule].length > 1) add('B06', e, mats[e.matricule].length + ' fiches portent ce matricule.');
    var full = (e.horaire || 173.33) >= 173;
    if (full && e.sb < smig) add('B01', e, 'Salaire de base ' + U.fmt(e.sb) + ' < SMIG ' + U.fmt(smig) + '.', 'emp');
    var conv = P.conv(S, cid, e.convention), g = conv && conv.grid.find(function (r) { return r[0] === String(e.categorie) && (!e.echelon || r[1] === String(e.echelon)); });
    if (g && e.sb < g[3]) add('B02', e, 'Catégorie ' + e.categorie + (e.echelon || '') + ' · minimum ' + U.fmt(g[3]) + ' (' + conv.label + ').', 'emp');
    if (e.modePaiement === 'virement' && !e.compte) add('B04', e, 'Paiement par virement sans n° de compte.', 'emp');
    if (e.modePaiement === 'momo' && !e.momo) add('B04', e, 'Paiement Mobile Money sans numéro.', 'emp');
    if (!e.cnps) add('B05', e, 'Renseignez le n° CNPS (obligatoire pour la DIPE).', 'emp');
    if (e.contrat === 'CDD' && e.finContrat && e.finContrat < p.start && !(e.sortie && e.sortie.date)) add('B07', e, 'Fin de CDD le ' + U.frDate(e.finContrat) + '.', 'emp');
    if (e.contrat === 'CDD' && e.finContrat && e.finContrat >= p.start && U.daysBetween(p.end, e.finContrat) <= 30) add('W05', e, 'Fin le ' + U.frDate(e.finContrat) + ' : renouvellement ou sortie à préparer.', 'emp');
    if (e.essaiFin && e.essaiFin >= p.start && e.essaiFin <= p.end) add('W06', e, 'Fin d’essai le ' + U.frDate(e.essaiFin) + ' : confirmer l’embauche.', 'emp');
    if (!e.niu) add('W08', e, 'Le NIU figure sur le bulletin et les déclarations.', 'emp');
    if (!e.section) add('W09', e, 'Les charges de ce salarié ne seront pas ventilées en analytique.', 'emp');
    if (e.compte) (ribs[e.codeBanque + e.guichet + e.compte] = ribs[e.codeBanque + e.guichet + e.compte] || []).push(e);
    if (e.momo) (momos[String(e.momo).replace(/\D/g, '')] = momos[String(e.momo).replace(/\D/g, '')] || []).push(e);
    var anc = seniority(e, p.end), ancPrev = seniority(e, U.addDays(p.start, -1)), conv2 = P.conv(S, cid, e.convention);
    if (conv2 && conv2.anc && P.bareme(S, country, conv2.anc, date, anc) !== P.bareme(S, country, conv2.anc, date, ancPrev)) add('W10', e, anc + ' ans d’ancienneté : taux porté à ' + P.bareme(S, country, conv2.anc, date, anc) + ' %.');
    if (d.settings.gta && d.settings.gta.requireTimesheet && !d.timeEvents.some(function (t) { return t.key === key && t.empId === e.id; })) add('W12', e, 'Vérifiez la remontée des temps.');
    if (!s) return;
    if (s.errors.length) add('B09', e, s.errors.join(' · '));
    if (s.totals.net < 0) add('B03', e, 'Net ' + U.fmt(s.totals.net) + ' : réduisez les retenues ou reportez une avance.');
    var abs = U.sum(P.varsFor(S, cid, key, e).filter(function (v) { return v.code === 'ABS_NP'; }), function (v) { return v.qty; });
    if (abs > s.ctx.jp) add('B08', e, abs + ' jours d’absence pour ' + s.ctx.jp + ' jours payés.');
    var hs = U.sum(P.varsFor(S, cid, key, e).filter(function (v) { return /^HS/.test(v.code); }), function (v) { return v.qty; });
    if (hs > P.param(S, country, 'HS_MAX_MOIS', date)) add('W02', e, hs + ' h ce mois.');
    if (prev && P.isFrozen(prev) && prev.slips[e.id] && prev.slips[e.id].totals.net > 0) { var nb = function (x) { return x.totals.net + U.sum(x.lines.filter(function (l) { return l.code === 'AVANCE' || l.code === 'PRET'; }), function (l) { return l.sal; }); }; var n0 = nb(prev.slips[e.id]), n1 = nb(s), dv = (n1 - n0) / n0; if (Math.abs(dv) > 0.2) add('W01', e, (dv > 0 ? '+' : '') + Math.round(dv * 100) + ' % avant avances et prêts (' + U.fmt(n0) + ' → ' + U.fmt(n1) + ').'); }
    if (s.leave.after < 0 || s.leave.after > 45) add('W07', e, 'Solde après paie : ' + String(s.leave.after).replace('.', ',') + ' jours.');
    var ret = U.sum(s.lines.filter(function (l) { return l.code === 'AVANCE' || l.code === 'PRET'; }), function (l) { return l.sal; });
    if (ret && ret > (s.totals.net + ret) * P.param(S, country, 'QUOTITE_RETENUES', date) / 100) add('W11', e, 'Retenues ' + U.fmt(ret) + ' pour un net avant retenues de ' + U.fmt(s.totals.net + ret) + '.');
  });
  Object.keys(ribs).forEach(function (k) { if (ribs[k].length > 1) ribs[k].forEach(function (e) { add('W03', e, 'Compte partagé avec ' + ribs[k].filter(function (x) { return x !== e; }).map(function (x) { return x.matricule; }).join(', ') + '.', 'emp'); }); });
  Object.keys(momos).forEach(function (k) { if (momos[k].length > 1) momos[k].forEach(function (e) { add('W04', e, 'Numéro partagé avec ' + momos[k].filter(function (x) { return x !== e; }).map(function (x) { return x.matricule; }).join(', ') + '.', 'emp'); }); });
  var byPoste = {}; P.activeEmployees(S, cid, key).forEach(function (e) { (byPoste[e.poste] = byPoste[e.poste] || []).push(e); });
  Object.keys(byPoste).forEach(function (k) { var l = byPoste[k]; if (l.length < 3) return; var m = l.map(function (e) { return e.sb; }).sort(function (a, b) { return a - b; })[Math.floor(l.length / 2)]; l.forEach(function (e) { if (Math.abs(e.sb - m) / m > 0.4) add('W13', e, 'Salaire ' + U.fmt(e.sb) + ' pour une médiane de ' + U.fmt(m) + ' sur le poste « ' + k + ' ».', 'emp'); }); });
  return out;
};

/* ============================================================================= workflow */
P.STATUS = { preparation: ['Préparation', 'warn'], calculee: ['Calculée · anomalies bloquantes', 'bad'], controlee: ['Contrôlée · prête à soumettre', 'info'], soumise: ['Soumise à la DRH', 'info'], validee: ['Validée DRH · transmise en comptabilité', 'ok'], cloturee: ['Clôturée', 'ok'] };
P.submit = function (S, cid, key, comment) {
  need(S, 'pay.validate');
  var p = P.period(S, cid, key); if (!p) fail('Période introuvable.');
  if (p.status !== 'controlee') fail(p.status === 'calculee' ? 'Des anomalies bloquantes subsistent : corrigez-les puis recalculez.' : 'Calculez et contrôlez la paie avant de la soumettre.');
  p.status = 'soumise'; p.history.push(Object.assign({ action: 'Validation gestionnaire · soumise à la DRH', comment: comment || '' }, who(S)));
  Y.audit(S, cid, 'Paie · soumission DRH', key, P.totals(S, cid, key).count + ' bulletins · net ' + U.fmt(P.totals(S, cid, key).net));
  return p;
};
P.reject = function (S, cid, key, comment) {
  need(S, 'pay.approve'); if (!comment) fail('Motif du rejet obligatoire.');
  var p = P.period(S, cid, key); if (!p || p.status !== 'soumise') fail('Seule une paie soumise peut être rejetée.');
  p.status = 'preparation'; p.history.push(Object.assign({ action: 'Rejet DRH · retour en préparation', comment: comment }, who(S)));
  Y.audit(S, cid, 'Paie · rejet DRH', key, comment); return p;
};
function slipHash(s) { return U.fnv(JSON.stringify({ e: s.empId, k: s.key, l: s.lines.map(function (l) { return [l.code, l.gain || 0, l.sal || 0, l.pat || 0]; }), t: s.totals })); }
/** Validation DRH : bulletins figés, congés, avances et prêts mis à jour, écritures transmises automatiquement à la comptabilité. */
P.approve = function (S, cid, key, comment, opts) {
  opts = opts || {}; if (!opts.system) need(S, 'pay.approve');
  var d = P.D(S, cid), p = P.period(S, cid, key); if (!p || p.status !== 'soumise') fail('La paie doit être soumise par le gestionnaire avant la validation DRH.');
  var fresh = P.check(S, cid, key).filter(function (a) { return a.level === 'bloquante'; });
  if (fresh.length) fail('Anomalie bloquante apparue depuis la soumission : ' + fresh[0].label + ' (' + fresh[0].matricule + ').');
  Object.keys(p.slips).forEach(function (id) {
    var s = p.slips[id], e = P.emp(S, cid, id);
    s.hash = slipHash(s); s.frozenAt = new Date().toISOString(); s.signed = null;
    e.conges.solde = s.leave.after; e.conges.acquisAnnee = (p.month === 1 ? 0 : e.conges.acquisAnnee || 0) + s.leave.acquired; e.conges.prisAnnee = (p.month === 1 ? 0 : e.conges.prisAnnee || 0) + s.leave.taken;
    if (e.sortie && e.sortie.date && e.sortie.date <= p.end) e.statut = 'sorti';
  });
  d.advances.forEach(function (a) { if (a.retainPeriod === key && a.status === 'versee' && p.slips[a.empId]) { a.status = 'retenue'; a.history.push(Object.assign({ action: 'Retenue sur la paie ' + key }, who(S))); } });
  d.loans.forEach(function (l) { var s = p.slips[l.empId]; if (!s || l.status !== 'actif') return; var line = s.lines.find(function (x) { return x.code === 'PRET'; }); if (line) { l.schedule = (l.schedule || []).concat([{ key: key, amount: line.sal }]); if (U.sum(l.schedule, function (x) { return x.amount; }) >= l.amount) l.status = 'solde'; } });
  p.status = 'validee'; p.approvedAt = new Date().toISOString();
  p.history.push(Object.assign({ action: 'Validation DRH · bulletins disponibles, à signer', comment: comment || '' }, who(S)));
  Y.audit(S, cid, 'Paie · validation DRH', key, Object.keys(p.slips).length + ' bulletins figés');
  P.transmit(S, cid, key, { system: true, silent: opts.silent });
  return p;
};

/* ============================================================================= interface comptable */
function tiersOf(e) { return { type: 'personnel', code: e.matricule, name: P.fullName(e), collective: '422' }; }
P.buildPayrollBatch = function (S, cid, key) {
  var d = P.D(S, cid), p = P.period(S, cid, key), A = d.accounts, agg = {}, lines = [];
  function put(account, amt, label, section, tiers) {
    if (!amt) return; var k = account + '|' + (section || '') + '|' + (tiers ? tiers.code : '') + '|' + label;
    if (!agg[k]) agg[k] = { account: account, label: label, section: section || '', tiers: tiers || null, net: 0 };
    agg[k].net += amt;
  }
  Object.keys(p.slips).forEach(function (id) {
    var s = p.slips[id], e = P.emp(S, cid, id), sec = e.section || '', t = tiersOf(e);
    s.lines.forEach(function (l) {
      var map = A[l.acc] || {};
      if (l.kind === 'gain') { put(e.nationalite && !/camer/i.test(e.nationalite) && map.debitExpat ? map.debitExpat : map.debit || '661', l.gain, l.acc === 'indemnite' ? 'Indemnités et primes forfaitaires' : (l.acc === 'sortie' ? 'Indemnités de fin de contrat' : 'Rémunérations du personnel'), sec, null); return; }
      if (l.kind === 'nature') return;
      if (l.sal) {
        if (l.acc === 'avance') put('-' + (map.salCredit || '421'), l.sal, 'Avances et prêts retenus', '', t);
        else put('-' + (map.salCredit || '447'), l.sal, l.org === 'CNPS' ? 'CNPS · part salariale' : (l.acc === 'divers' ? 'Retenues pour compte de tiers' : 'Impôts et taxes retenus sur salaires'), '', null);
      }
      if (l.pat) { put(map.patDebit || '664', l.pat, l.org === 'CNPS' ? 'Charges sociales patronales CNPS' : 'Taxes patronales sur salaires (CFC, FNE)', sec, null); put('-' + (map.patCredit || '431'), l.pat, l.org === 'CNPS' ? 'CNPS · part patronale' : 'CFC et FNE patronaux', '', null); }
    });
    put('-' + (A.net || '422'), s.totals.net, 'Salaire net · ' + e.matricule, '', t);
  });
  Object.keys(agg).sort().forEach(function (k) {
    var a = agg[k], credit = a.account[0] === '-', acc = credit ? a.account.slice(1) : a.account, v = credit ? -a.net : a.net;
    if (!v) return;
    lines.push({ account: acc, label: a.label, debit: v > 0 ? v : 0, credit: v < 0 ? -v : 0, section: a.section, tiers: a.tiers });
  });
  lines.sort(function (a, b) { return (b.debit ? 1 : 0) - (a.debit ? 1 : 0) || (a.account < b.account ? -1 : 1); });
  var n = Object.keys(p.slips).length;
  return Y.makeBatch(cid, 'paie', 'PAIE-' + key, 'Paie de ' + P.monthLabel(key), [{ journal: 'PAIE', kind: 'payroll', date: p.end, ref: 'PAIE-' + key, label: 'Paie ' + P.monthLabel(key) + ' · ' + n + ' salarié(s)', lines: lines }], { period: key, employees: n });
};
P.transmit = function (S, cid, key, opts) {
  opts = opts || {}; if (!opts.system) need(S, 'pay.post');
  var p = P.period(S, cid, key); if (!p || !P.isFrozen(p)) fail('Seule une paie validée par la DRH est transmise en comptabilité.');
  if (p.journal && p.journal.status === 'integre') fail('Écritures déjà intégrées (' + p.journal.entries.join(', ') + ').');
  var b = P.buildPayrollBatch(S, cid, key);
  try {
    var r = Y.acceptBatch(S, cid, b);
    p.journal = { status: 'integre', ref: b.source.ref, entries: r.entries, total: r.total, checksum: b.checksum, at: new Date().toISOString(), lines: b.totals.lines };
    p.history.push(Object.assign({ action: 'Écritures transmises et intégrées en comptabilité', comment: r.entries.join(', ') + ' · ' + U.fmt(r.total) + ' XAF' }, who(S)));
  } catch (x) {
    p.journal = { status: 'rejete', ref: b.source.ref, errors: x.messages || [x.message], at: new Date().toISOString() };
    p.history.push(Object.assign({ action: 'Transmission comptable rejetée', comment: (x.messages || [x.message]).slice(0, 2).join(' · ') }, who(S)));
    if (!opts.system) throw x;
  }
  return p.journal;
};
P.close = function (S, cid, key, comment) {
  need(S, 'pay.post');
  var p = P.period(S, cid, key); if (!p || p.status !== 'validee') fail('Seule une paie validée peut être clôturée.');
  if (!p.journal || p.journal.status !== 'integre') fail('Les écritures de paie doivent être intégrées en comptabilité avant la clôture.');
  p.status = 'cloturee'; p.closedAt = new Date().toISOString();
  p.history.push(Object.assign({ action: 'Vérification DAF · période clôturée', comment: comment || '' }, who(S)));
  P.period(S, cid, P.nextKey(key), true);
  Y.audit(S, cid, 'Paie · clôture', key, 'Période clôturée par la DAF');
  return p;
};

/* Recalcul de contrôle d'une période figée (rien n'est écrasé) et régularisation sur la période ouverte. */
P.recalcCheck = function (S, cid, key) {
  var p = P.period(S, cid, key); if (!p || !P.isFrozen(p)) fail('Le recalcul de contrôle concerne une période validée.');
  var tmp = U.clone(p); tmp.status = 'preparation';
  return Object.keys(p.slips).map(function (id) {
    var e = P.emp(S, cid, id), old = p.slips[id], n = P.computeSlip(S, cid, key, e, { period: tmp, vars: (p.vars[id] || []).concat(old.lines.filter(function (l) { return l.code === 'AVANCE' || l.code === 'PRET'; }).map(function (l) { return { code: l.code, qty: 0, amount: l.sal }; })) });
    return { empId: id, matricule: e.matricule, name: P.fullName(e), oldBrut: old.totals.brut, newBrut: n.totals.brut, diffBrut: n.totals.brut - old.totals.brut, oldNet: old.totals.net, newNet: n.totals.net, diffNet: n.totals.net - old.totals.net };
  }).filter(function (r) { return r.diffBrut || r.diffNet; });
};
P.applyRegul = function (S, cid, key, target) {
  need(S, 'pay.prepare');
  var diffs = P.recalcCheck(S, cid, key), tp = P.period(S, cid, target, true); if (P.isFrozen(tp)) fail('La période cible doit être ouverte.');
  diffs.forEach(function (r) { if (r.diffBrut) P.addVar(S, cid, target, r.empId, { code: 'RAPPEL', amount: r.diffBrut, source: 'régularisation ' + key, note: 'Écart de brut après recalcul de ' + P.monthLabel(key) }); });
  Y.audit(S, cid, 'Paie · régularisation', key + ' → ' + target, diffs.length + ' salarié(s)');
  return diffs;
};

/* ============================================================================= signature DRH */
P.setSignature = function (S, cid, sig) {
  need(S, 'pay.sign');
  if (!sig || !sig.signature) fail('Dessinez ou importez la signature.');
  var d = P.D(S, cid); d.signature = { signature: sig.signature, cachet: sig.cachet || null, signer: (S.meta.currentUser || {}).name, title: sig.title || 'Directrice des ressources humaines', at: new Date().toISOString(), id: U.fnv(sig.signature.slice(-400) + (sig.cachet || '').slice(-400)) };
  Y.audit(S, cid, 'Paie · signature DRH', 'Spécimen de signature' + (sig.cachet ? ' et cachet' : ''), d.signature.id);
  return d.signature;
};
/** Signe tous les bulletins non signés d'une période validée. Les bulletins déjà signés sont ignorés (pas de double signature). */
P.signSlips = function (S, cid, key, ids) {
  need(S, 'pay.sign');
  var d = P.D(S, cid), p = P.period(S, cid, key); if (!p || !P.isFrozen(p)) fail('Seuls les bulletins d’une paie validée par la DRH peuvent être signés.');
  if (!d.signature) fail('Enregistrez d’abord votre signature (et votre cachet) dans l’espace DRH.');
  var res = { signed: 0, skipped: 0, altered: [] }, seen = {};
  Object.keys(p.slips).forEach(function (id) {
    if (ids && ids.indexOf(id) < 0) return;
    var s = p.slips[id];
    if (seen[s.matricule]) { res.skipped++; return; } seen[s.matricule] = 1;
    if (s.signed) { res.skipped++; return; }
    if (s.hash !== slipHash(s)) { res.altered.push(s.matricule); return; }
    s.signed = { by: (S.meta.currentUser || {}).name, at: new Date().toISOString(), sigId: d.signature.id, hash: U.fnv(s.hash + '|' + d.signature.id + '|' + key) };
    res.signed++;
  });
  if (res.altered.length) fail('Bulletin(s) modifié(s) après validation : ' + res.altered.join(', ') + '. Signature refusée.');
  p.history.push(Object.assign({ action: 'Signature électronique DRH', comment: res.signed + ' bulletin(s) signé(s), ' + res.skipped + ' déjà signé(s)' }, who(S)));
  Y.audit(S, cid, 'Paie · signature des bulletins', key, res.signed + ' signés · ' + res.skipped + ' ignorés');
  return res;
};
P.markSent = function (S, cid, key, ids, channel) {
  need(S, 'pay.prepare');
  var p = P.period(S, cid, key), n = 0;
  ids.forEach(function (id) { var s = p.slips[id]; if (!s || !s.signed) return; s.sent = s.sent || {}; s.sent[channel] = new Date().toISOString(); n++; });
  if (!n) fail('Seuls les bulletins signés par la DRH peuvent être envoyés.');
  Y.audit(S, cid, 'Paie · envoi des bulletins', key, n + ' par ' + channel); return n;
};

/* ============================================================================= paiements : ordres de virement */
P.ORDER_STATUS = { brouillon: ['Brouillon', ''], soumis: ['À valider par la DRH', 'warn'], valide: ['Validé DRH · à envoyer', 'info'], envoye: ['Envoyé à la banque', 'info'], execute: ['Exécuté · comptabilisé', 'ok'], rejete: ['Rejeté', 'bad'] };
P.paymentItems = function (S, cid, key) {
  var p = P.period(S, cid, key);
  return Object.keys(p.slips).map(function (id) { var s = p.slips[id], e = P.emp(S, cid, id); return { empId: id, matricule: e.matricule, name: P.fullName(e), amount: s.totals.net, mode: e.modePaiement, banque: e.banque || '', codeBanque: e.codeBanque || '', guichet: e.guichet || '', compte: e.compte || '', cle: e.cle || '', agence: e.agence || '', momo: e.momo || '', operateur: e.operateur || '' }; }).filter(function (x) { return x.amount > 0; });
};
P.createOrder = function (S, cid, o) {
  need(S, 'pay.bank');
  var d = P.D(S, cid), p = P.period(S, cid, o.key); if (!p || !P.isFrozen(p)) fail('L’ordre de virement se prépare sur une paie validée par la DRH.');
  if (d.bankOrders.some(function (x) { return x.key === o.key && x.status !== 'rejete'; })) fail('Un ordre de virement existe déjà pour ' + P.monthLabel(o.key) + '.');
  var adv = d.advisors.find(function (a) { return a.id === o.advisorId; }); if (!adv) fail('Choisissez le conseiller bancaire destinataire.');
  var items = P.paymentItems(S, cid, o.key);
  d.seq.order++;
  var rec = { id: U.uid('ov'), ref: 'OV-' + o.key + '-' + U.pad(d.seq.order, 3), key: o.key, advisorId: adv.id, bankAccount: o.bankAccount || adv.compteDebite || '5211', executionDate: o.executionDate, motif: o.motif || ('Salaires du mois de ' + P.monthLabel(o.key)), comment: o.comment || '', confidentiality: o.confidentiality || d.settings.confidentiality, items: items,
    totals: { virement: U.sum(items.filter(function (i) { return i.mode === 'virement'; }), function (i) { return i.amount; }), momo: U.sum(items.filter(function (i) { return i.mode === 'momo'; }), function (i) { return i.amount; }), especes: U.sum(items.filter(function (i) { return i.mode === 'especes'; }), function (i) { return i.amount; }), count: items.length },
    status: 'brouillon', history: [Object.assign({ action: 'Création de l’ordre' }, who(S))], createdAt: new Date().toISOString() };
  rec.totals.all = rec.totals.virement + rec.totals.momo + rec.totals.especes;
  d.bankOrders.unshift(rec);
  Y.audit(S, cid, 'Paie · ordre de virement', rec.ref, U.fmt(rec.totals.all) + ' · ' + items.length + ' bénéficiaires');
  return rec;
};
P.orderAction = function (S, cid, id, action, data) {
  data = data || {};
  var d = P.D(S, cid), o = d.bankOrders.find(function (x) { return x.id === id; }); if (!o) fail('Ordre introuvable.');
  var T = { soumettre: ['brouillon', 'soumis', 'pay.bank'], valider: ['soumis', 'valide', 'pay.approve'], rejeter: ['soumis', 'rejete', 'pay.approve'], envoyer: ['valide', 'envoye', 'pay.bank'], executer: ['envoye', 'execute', 'pay.bank'] }[action];
  if (!T) fail('Action inconnue.'); need(S, T[2]);
  if (o.status !== T[0]) fail('Action impossible : ordre au statut « ' + P.ORDER_STATUS[o.status][0] + ' ».');
  if (action === 'rejeter' && !data.comment) fail('Motif du rejet obligatoire.');
  if (action === 'executer') {
    var date = data.date || o.executionDate, A = P.D(S, cid).accounts, entries = [];
    var groups = { virement: { journal: (Y.bankAccount(S, cid, o.bankAccount) || {}).journal || 'BQ1', account: o.bankAccount || A.bank }, momo: { journal: 'MTN', account: A.momo }, especes: { journal: 'CAI', account: A.cash } };
    Object.keys(groups).forEach(function (m) {
      var its = o.items.filter(function (i) { return i.mode === m; }); if (!its.length) return;
      var tot = U.sum(its, function (i) { return i.amount; });
      entries.push({ journal: groups[m].journal, kind: 'payroll-payment', date: date, ref: o.ref + (m === 'virement' ? '' : '-' + m.toUpperCase()), label: o.motif + (m === 'momo' ? ' · Mobile Money' : (m === 'especes' ? ' · espèces' : '')),
        lines: its.map(function (i) { var e = P.emp(S, cid, i.empId); return { account: A.net || '422', label: 'Net payé · ' + i.matricule, debit: i.amount, credit: 0, tiers: tiersOf(e) }; }).concat([{ account: groups[m].account, label: o.motif, debit: 0, credit: tot }]) });
    });
    var r = Y.acceptBatch(S, cid, Y.makeBatch(cid, 'paie', o.ref, o.motif, entries, { period: o.key }));
    o.entries = r.entries; o.executedAt = date; o.bankRef = data.bankRef || '';
    try { Y.autoLetter(S, cid, A.net || '422'); } catch (x) { /* lettrage au mieux */ }
  }
  if (action === 'envoyer') o.sentAt = new Date().toISOString();
  o.status = T[1];
  o.history.push(Object.assign({ action: { soumettre: 'Soumis à la DRH', valider: 'Validé par la DRH', rejeter: 'Rejeté par la DRH', envoyer: 'Envoyé au conseiller bancaire', executer: 'Exécution confirmée · écritures de paiement intégrées' }[action], comment: data.comment || '' }, who(S)));
  Y.audit(S, cid, 'Paie · ordre ' + action, o.ref, data.comment || '');
  return o;
};
/** Fichiers remis à la banque : CSV de virements (matricule ou nom selon la confidentialité) et lot Mobile Money. */
P.orderFiles = function (S, cid, o) {
  var named = o.confidentiality === 'nom';
  var vir = [['Référence', 'Bénéficiaire', 'Code banque', 'Code guichet', 'N° de compte', 'Clé RIB', 'Montant (XAF)', 'Motif']].concat(o.items.filter(function (i) { return i.mode === 'virement'; }).map(function (i) { return [o.ref, named ? i.name : i.matricule, i.codeBanque, i.guichet, i.compte, i.cle, i.amount, o.motif]; }));
  var momo = [['Référence', 'Bénéficiaire', 'Opérateur', 'Numéro', 'Montant (XAF)', 'Motif']].concat(o.items.filter(function (i) { return i.mode === 'momo'; }).map(function (i) { return [o.ref, named ? i.name : i.matricule, i.operateur, String(i.momo).replace(/\s/g, ''), i.amount, o.motif]; }));
  return { virement: vir, momo: momo };
};

/* ============================================================================= déclarations */
P.declarations = function (S, cid, key) {
  var d = P.D(S, cid), p = P.period(S, cid, key), pk = Y.PAIE_PACKS[d.country];
  return pk.declarations.map(function (dc) {
    var rows = {}, byEst = {};
    Object.keys(p.slips).forEach(function (id) {
      var s = p.slips[id], e = P.emp(S, cid, id);
      s.lines.forEach(function (l) {
        if (dc.rubriques.indexOf(l.code) < 0) return;
        var r = rows[l.code] || (rows[l.code] = { code: l.code, label: l.label, base: 0, sal: 0, pat: 0 });
        r.base += l.base || 0; r.sal += l.sal || 0; r.pat += l.pat || 0;
        var b = byEst[e.site] || (byEst[e.site] = { site: e.site, sal: 0, pat: 0, count: {} }); b.sal += l.sal || 0; b.pat += l.pat || 0; b.count[id] = 1;
      });
    });
    var list = Object.keys(rows).map(function (k) { var r = rows[k]; r.total = r.sal + r.pat; return r; });
    var st = (p.decl || {})[dc.code] || { status: 'a_declarer' };
    return { code: dc.code, label: dc.label, channel: dc.channel, account: dc.account, due: U.addMonths(key + '-' + U.pad(dc.due, 2), 1), rows: list, total: U.sum(list, function (r) { return r.total; }), byEst: Object.keys(byEst).map(function (k) { var b = byEst[k]; return { site: k, label: (P.est(S, cid, k) || {}).label || k, cnpsEmployer: (P.est(S, cid, k) || {}).cnpsEmployer || '', sal: b.sal, pat: b.pat, total: b.sal + b.pat, employees: Object.keys(b.count).length }; }), status: st };
  });
};
P.declAction = function (S, cid, key, code, action, data) {
  data = data || {};
  var p = P.period(S, cid, key); if (!p || !P.isFrozen(p)) fail('Déclarations disponibles après validation de la paie.');
  if (!p.journal || p.journal.status !== 'integre') fail('Les écritures de paie doivent d’abord être intégrées en comptabilité.');
  need(S, 'pay.declare');
  p.decl = p.decl || {}; var st = p.decl[code] || (p.decl[code] = { status: 'a_declarer', history: [] });
  var dc = P.declarations(S, cid, key).find(function (x) { return x.code === code; });
  if (action === 'teletransmettre') {
    if (st.status !== 'a_declarer') fail('Déclaration déjà transmise.');
    st.status = 'transmise'; st.receipt = 'ACK-' + code + '-' + key.replace('-', '') + '-' + U.fnv(key + code + Date.now()).slice(0, 6).toUpperCase(); st.at = new Date().toISOString(); st.by = (S.meta.currentUser || {}).name;
  } else if (action === 'payer') {
    if (st.status !== 'transmise') fail('Transmettez la déclaration avant de la payer.');
    var date = data.date || dc.due, A = P.D(S, cid).accounts;
    var r = Y.acceptBatch(S, cid, Y.makeBatch(cid, 'paie', 'DECL-' + code + '-' + key, dc.label, [{ journal: 'BQ1', kind: 'social', date: date, ref: 'DECL-' + code + '-' + key, label: dc.label + ' · ' + P.monthLabel(key), lines: [{ account: dc.account, label: dc.label, debit: dc.total, credit: 0 }, { account: A.bank, label: 'Paiement ' + code, debit: 0, credit: dc.total }] }], { period: key }));
    st.status = 'payee'; st.paidAt = date; st.entries = r.entries;
  } else fail('Action inconnue.');
  st.history = (st.history || []).concat([Object.assign({ action: action }, who(S))]);
  Y.audit(S, cid, 'Paie · déclaration ' + code, key, action + (st.receipt ? ' · ' + st.receipt : ''));
  return st;
};
P.dipeRows = function (S, cid, key) {
  var p = P.period(S, cid, key);
  return [['N° employeur CNPS', 'Matricule', 'N° CNPS salarié', 'Nom et prénoms', 'Jours', 'Salaire brut', 'Base plafonnée', 'PVID salarié', 'PVID employeur', 'Prestations familiales', 'Accidents du travail', 'Total']].concat(Object.keys(p.slips).map(function (id) {
    var s = p.slips[id], e = P.emp(S, cid, id), g = function (c, k) { var l = s.lines.find(function (x) { return x.code === c; }); return l ? l[k] || 0 : 0; };
    return [(P.est(S, cid, e.site) || {}).cnpsEmployer || '', e.matricule, e.cnps || '', P.fullName(e), s.ctx.jp, s.totals.brut, g('PVID', 'base'), g('PVID', 'sal'), g('PVID', 'pat'), g('PF', 'pat'), g('AT', 'pat'), g('PVID', 'sal') + g('PVID', 'pat') + g('PF', 'pat') + g('AT', 'pat')];
  }));
};

/* ============================================================================= avances et prêts */
P.ADV_STATUS = { demandee: ['Demandée', 'warn'], approuvee: ['Approuvée · à verser', 'info'], refusee: ['Refusée', 'bad'], versee: ['Versée · à retenir', 'info'], retenue: ['Retenue sur paie', 'ok'] };
P.requestAdvance = function (S, cid, a) {
  need(S, 'pay.prepare');
  var d = P.D(S, cid), e = P.emp(S, cid, a.empId); if (!e) fail('Salarié introuvable.');
  var amt = round(U.parseAmount(a.amount)), date = a.date || S.meta.today, key = date.slice(0, 7), cut = d.settings.advance.cutoffDay;
  if (!(amt > 0)) fail('Montant invalide.');
  var max = round(e.sb * P.param(S, d.country, 'AVANCE_PLAFOND', date) / 100);
  if (amt > max) fail('Plafond dépassé : ' + U.fmt(max) + ' XAF maximum (' + P.param(S, d.country, 'AVANCE_PLAFOND', date) + ' % du salaire de base).');
  var late = +date.slice(8, 10) > cut, retain = late ? P.nextKey(key) : key;
  var rp = d.periods[retain]; if (rp && P.isFrozen(rp)) retain = P.nextKey(retain);
  var same = d.advances.filter(function (x) { return x.empId === e.id && x.retainPeriod === retain && x.status !== 'refusee'; }).length;
  if (same >= d.settings.advance.maxPerMonth) fail('Nombre maximal d’avances atteint pour ' + P.monthLabel(retain) + '.');
  d.seq.adv++;
  var rec = { id: U.uid('adv'), ref: 'AV-' + key + '-' + U.pad(d.seq.adv, 3), empId: e.id, amount: amt, date: date, reason: a.reason || '', mode: a.mode || e.modePaiement, late: late, retainPeriod: retain, status: 'demandee', history: [Object.assign({ action: 'Demande enregistrée' + (late ? ' après la date butoir (le ' + cut + ') : retenue reportée' : '') }, who(S))] };
  d.advances.unshift(rec);
  Y.audit(S, cid, 'Paie · demande d’avance', rec.ref, e.matricule + ' · ' + U.fmt(amt));
  return rec;
};
P.advanceAction = function (S, cid, id, action, data) {
  data = data || {};
  var d = P.D(S, cid), a = d.advances.find(function (x) { return x.id === id; }); if (!a) fail('Avance introuvable.');
  var T = { approuver: ['demandee', 'approuvee', 'pay.approve'], refuser: ['demandee', 'refusee', 'pay.approve'], verser: ['approuvee', 'versee', 'pay.bank'] }[action];
  if (!T) fail('Action inconnue.'); need(S, T[2]); if (a.status !== T[0]) fail('Action impossible au statut « ' + P.ADV_STATUS[a.status][0] + ' ».');
  if (action === 'verser') {
    var e = P.emp(S, cid, a.empId), A = d.accounts, m = a.mode === 'momo' ? { j: 'MTN', acc: A.momo } : (a.mode === 'especes' ? { j: 'CAI', acc: A.cash } : { j: 'BQ1', acc: A.bank });
    var r = Y.acceptBatch(S, cid, Y.makeBatch(cid, 'paie', a.ref, 'Avance sur salaire ' + a.ref, [{ journal: m.j, kind: 'advance', date: data.date || S.meta.today, ref: a.ref, label: 'Avance sur salaire · ' + e.matricule, lines: [{ account: '421', label: 'Avance ' + a.ref, debit: a.amount, credit: 0, tiers: tiersOf(e) }, { account: m.acc, label: 'Avance ' + a.ref, debit: 0, credit: a.amount }] }], { period: a.retainPeriod }));
    a.entries = r.entries; a.paidAt = data.date || S.meta.today;
  }
  a.status = T[1]; a.history.push(Object.assign({ action: { approuver: 'Approuvée', refuser: 'Refusée', verser: 'Versée et comptabilisée' }[action], comment: data.comment || '' }, who(S)));
  Y.audit(S, cid, 'Paie · avance ' + action, a.ref, data.comment || '');
  return a;
};
P.createLoan = function (S, cid, l) {
  need(S, 'pay.approve');
  var d = P.D(S, cid), e = P.emp(S, cid, l.empId); if (!e) fail('Salarié introuvable.');
  var amt = round(U.parseAmount(l.amount)), mon = round(U.parseAmount(l.monthly)); if (!(amt > 0) || !(mon > 0)) fail('Montant et mensualité obligatoires.');
  if (mon > amt) fail('La mensualité dépasse le montant du prêt.');
  d.seq.loan++;
  var rec = { id: U.uid('loan'), ref: 'PR-' + U.pad(d.seq.loan, 3), empId: e.id, amount: amt, monthly: mon, start: l.start, reason: l.reason || '', status: 'actif', schedule: [], history: [Object.assign({ action: 'Prêt accordé' }, who(S))] };
  var A = d.accounts, date = l.date || (l.start + '-05');
  var r = Y.acceptBatch(S, cid, Y.makeBatch(cid, 'paie', rec.ref, 'Prêt au personnel ' + rec.ref, [{ journal: 'BQ1', kind: 'loan', date: date, ref: rec.ref, label: 'Prêt au personnel · ' + e.matricule, lines: [{ account: '421', label: 'Prêt ' + rec.ref, debit: amt, credit: 0, tiers: tiersOf(e) }, { account: A.bank, label: 'Prêt ' + rec.ref, debit: 0, credit: amt }] }], { period: l.start }));
  rec.entries = r.entries;
  d.loans.unshift(rec); Y.audit(S, cid, 'Paie · prêt', rec.ref, e.matricule + ' · ' + U.fmt(amt) + ' / ' + U.fmt(mon) + ' par mois');
  return rec;
};

/* ============================================================================= sorties et solde de tout compte */
P.MOTIFS_SORTIE = ['Démission', 'Licenciement', 'Licenciement pour faute lourde', 'Fin de CDD', 'Rupture d’un commun accord', 'Départ à la retraite', 'Décès', 'Fin de stage'];
P.exitPreview = function (S, cid, empId, o) {
  var d = P.D(S, cid), e = P.emp(S, cid, empId), date = o.date, conv = P.conv(S, cid, e.convention) || {};
  var hist = history12(S, cid, e, date.slice(0, 7)), avg = hist.length ? Math.round(U.sum(hist, function (s) { return s.totals.brut - s.totals.nature; }) / hist.length) : e.sb;
  var anc = seniority(e, date), iccp = Math.round(Math.max(0, e.conges.solde || 0) * avg / 26);
  var lic = o.motif === 'Licenciement' && conv.lic ? Math.round(avg * P.bareme(S, d.country, conv.lic, date, anc)) : 0;
  var cat = /cadre/i.test(e.poste) || +e.categorie >= 8 ? 'cadre' : (+e.categorie >= 6 ? 'maitrise' : 'employe');
  var pre = o.preavis === 'paye' ? Math.round(avg * ((conv.noticeMonths || {})[cat] || 1)) : 0;
  return { avg: avg, anc: anc, leave: e.conges.solde || 0, ICCP: iccp, IND_LIC: lic, PREAVIS: pre, cat: cat };
};
P.registerExit = function (S, cid, empId, o) {
  need(S, 'pay.prepare');
  var e = P.emp(S, cid, empId); if (!e) fail('Salarié introuvable.');
  if (!o.date || !o.motif) fail('Date et motif de sortie obligatoires.');
  var key = o.date.slice(0, 7), p = P.period(S, cid, key, true); if (P.isFrozen(p)) fail('La période de sortie (' + P.monthLabel(key) + ') est déjà validée.');
  var pv = P.exitPreview(S, cid, empId, o);
  e.sortie = { date: o.date, motif: o.motif, preavis: o.preavis || 'effectue', comment: o.comment || '', stc: pv };
  ['ICCP', 'IND_LIC', 'PREAVIS'].forEach(function (c) { p.vars[e.id] = (p.vars[e.id] || []).filter(function (v) { return !(v.code === c && v.source === 'sortie'); }); if (pv[c]) P.addVar(S, cid, key, e.id, { code: c, amount: pv[c], source: 'sortie', note: o.motif }); });
  e.history.push(Object.assign({ changes: [{ field: 'sortie', old: '', val: U.frDate(o.date) + ' · ' + o.motif }] }, who(S)));
  Y.audit(S, cid, 'Paie · sortie', e.matricule, o.motif + ' au ' + U.frDate(o.date));
  return pv;
};

/* ============================================================================= simulateur brut ⇄ net */
P.simulate = function (S, cid, o) {
  var key = o.key || S.meta.today.slice(0, 7);
  var e = { id: 'sim', matricule: 'SIM', nom: 'Simulation', prenoms: '', sb: round(o.sb), site: o.site, convention: o.convention, categorie: o.categorie, embauche: o.embauche || '2000-01-01', anciennete: o.anciennete || o.embauche || key + '-01', horaire: 0, enfants: o.enfants || 0, fixes: o.fixes || {}, conges: { solde: 0 }, nationalite: 'Camerounaise' };
  var b = P.periodBounds(key);
  var per = { key: key, year: b.year, month: b.month, start: b.start, end: b.end, vars: {}, slips: {} };
  return P.computeSlip(S, cid, key, e, { period: per, vars: o.vars || [], history: [] });
};
P.netToGross = function (S, cid, o, targetNet) {
  var lo = 0, hi = Math.max(100000, targetNet * 3), best = null;
  for (var i = 0; i < 50; i++) { var mid = Math.round((lo + hi) / 2), s = P.simulate(S, cid, Object.assign({}, o, { sb: mid })); if (s.totals.net < targetNet) lo = mid + 1; else { hi = mid; best = s; } if (lo >= hi) break; }
  return best || P.simulate(S, cid, Object.assign({}, o, { sb: hi }));
};

/* ============================================================================= notifications et échéances */
P.notifications = function (S, cid) {
  var d = P.D(S, cid), r = role(S), today = S.meta.today, out = [], cut = d.settings.advance.cutoffDay;
  function add(level, title, text, page, tab, roles) { if (roles.indexOf(r) > -1 || r === 'owner') out.push({ level: level, title: title, text: text, page: page, tab: tab || '' }); }
  var key = P.openKey(S, cid), p = d.periods[key];
  var dCut = key + '-' + U.pad(cut, 2), left = U.daysBetween(today, dCut);
  var pend = d.advances.filter(function (a) { return a.status === 'demandee'; });
  if (left >= 0 && left <= d.settings.notify.remindDays + 7) add(left <= 2 ? 'warn' : 'info', 'Date butoir des avances : ' + U.frDate(dCut), (left ? 'Dans ' + left + ' jour(s). ' : 'Aujourd’hui. ') + 'Les demandes reçues après sont retenues sur le mois suivant.', 'paie-avances', '', ['payroll', 'hr']);
  if (pend.length) add('warn', pend.length + ' demande(s) d’avance à traiter', U.fmt(U.sum(pend, function (a) { return a.amount; })) + ' XAF en attente d’approbation.', 'paie-avances', '', ['hr', 'payroll']);
  if (p) {
    var blk = (p.anomalies || []).filter(function (a) { return a.level === 'bloquante'; }).length;
    if (p.status === 'preparation' || p.status === 'calculee') add(blk ? 'bad' : 'info', 'Paie de ' + P.monthLabel(key) + ' en préparation', blk ? blk + ' anomalie(s) bloquante(s) à corriger.' : 'Saisissez les variables puis lancez le calcul.', 'paie-periode', 'controle', ['payroll']);
    if (p.status === 'controlee') add('info', 'Paie de ' + P.monthLabel(key) + ' prête', 'Contrôles passés : soumettez-la à la DRH.', 'paie-periode', 'workflow', ['payroll']);
    if (p.status === 'soumise') add('warn', 'Paie de ' + P.monthLabel(key) + ' à valider', 'Soumise par le gestionnaire de paie : validez ou rejetez.', 'paie-drh', '', ['hr']);
  }
  Object.keys(d.periods).forEach(function (k) {
    var pp = d.periods[k]; if (!P.isFrozen(pp)) return;
    var uns = Object.keys(pp.slips).filter(function (id) { return !pp.slips[id].signed; }).length;
    if (uns) add('warn', uns + ' bulletin(s) de ' + P.monthLabel(k) + ' à signer', 'Signature électronique et cachet de la DRH requis avant diffusion.', 'paie-drh', '', ['hr', 'payroll']);
    if (pp.status === 'validee') add('info', 'Écritures de paie de ' + P.monthLabel(k) + ' à vérifier', pp.journal && pp.journal.status === 'integre' ? 'Intégrées (' + pp.journal.entries.join(', ') + ') : vérifiez puis clôturez la période.' : 'Transmission comptable rejetée : à corriger.', 'paie-drh', '', ['cfo']);
    if (pp.status === 'validee' || pp.status === 'cloturee') P.declarations(S, cid, k).forEach(function (dc) { if (dc.status.status !== 'payee' && dc.total) { var dl = U.daysBetween(today, dc.due); if (dl <= 10) add(dl < 0 ? 'bad' : 'warn', dc.code + ' · ' + P.monthLabel(k) + ' : échéance ' + U.frDate(dc.due), U.fmt(dc.total) + ' XAF · ' + (dc.status.status === 'a_declarer' ? 'à télédéclarer' : 'à payer') + (dl < 0 ? ' · en retard' : ''), 'paie-declarations', '', ['cfo']); } });
  });
  d.bankOrders.forEach(function (o) { if (o.status === 'soumis') add('warn', 'Ordre de virement ' + o.ref + ' à valider', U.fmt(o.totals.all) + ' XAF · ' + o.totals.count + ' bénéficiaires.', 'paie-drh', '', ['hr']); if (o.status === 'valide') add('info', 'Ordre ' + o.ref + ' validé', 'Envoyez-le au conseiller bancaire.', 'paie-paiements', '', ['payroll']); });
  d.employees.forEach(function (e) { if (e.contrat === 'CDD' && e.finContrat && e.statut === 'actif') { var dl = U.daysBetween(today, e.finContrat); if (dl >= 0 && dl <= 30) add('warn', 'CDD de ' + P.fullName(e) + ' : fin le ' + U.frDate(e.finContrat), 'Renouvellement ou sortie à décider.', 'paie-salaries', '', ['payroll', 'hr']); } });
  return out;
};

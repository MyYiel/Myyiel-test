/*
 * myyiel Congés & Absences · moteur (pur JavaScript, sans DOM, exécutable sous Node).
 * - Motifs paramétrables avec visuels (icône, couleur), impact paie, compteur, unité de décompte, justificatif, délai de prévenance.
 * - Circuits de validation configurables :
 *     « salarie »      : le salarié demande → le N+1 du service valide → le gestionnaire enregistre et notifie ;
 *     « gestionnaire » : le gestionnaire saisit → la DRH valide → notification automatique du salarié.
 *   Le N+1 ne valide jamais sa propre demande (escalade DRH) ; délégation quand le N+1 est lui-même absent.
 * - Jours fériés du Cameroun (fixes, Pâques, fêtes musulmanes datées à confirmer, report du dimanche au lundi).
 * - Solde de congés payés lu dans la paie (dernier bulletin validé) : une seule source de vérité.
 * - Export vers la paie au format myyiel.time-events/1 (CONGE, ABS_NP, ABS_MAL, ABS_AUT).
 * Spécifications : docs/rh/02-conges-absences.md
 */
import { Y } from './registry.js';

var U = Y.util;
var A = Y.Abs = {};
function fail(m) { throw new Y.BizError(m); }
function role(S) { return (S.meta.currentUser || {}).role || 'reader'; }
A.can = function (S, right) { return Y.can(role(S), right); };
function need(S, right) { if (A._bypass) return; if (!A.can(S, right)) fail('Action réservée : ' + (Y.RIGHTS[right] || right).toLowerCase() + ' (rôle actuel : ' + ((Y.ROLES[role(S)] || {}).label || role(S)) + ').'); }
function who(S) { var u = S.meta.currentUser || {}; return { by: u.name || 'Système', role: role(S), at: new Date().toISOString() }; }
A.dow = function (date) { return new Date(date + 'T12:00:00').getDay(); };
A.DOW = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];

/* ======================================================================= motifs (assets) */
// unit : ouvrable (lun.→sam., hors fériés, règle camerounaise des congés) · ouvre (lun.→ven., hors fériés) · calendaire
// approval : workflow (circuit complet) · declaration (déclaration avec justificatif, contrôlée et enregistrée par le gestionnaire)
A.DEFAULT_TYPES = [
  { code: 'CP', label: 'Congés payés', icon: 'sun', color: '#F28C28', category: 'Congés', paid: true, payCode: 'CONGE', counter: 'CP', unit: 'ouvrable', proof: false, notice: 15, halfDay: true, approval: 'workflow', self: true, ref: 'Code du travail, art. 89 : 1,5 jour ouvrable par mois de service' },
  { code: 'MAR', label: 'Mariage du salarié', icon: 'heart', color: '#D946EF', category: 'Événements familiaux', paid: true, payCode: 'ABS_AUT', counter: 'PERM', unit: 'ouvrable', proof: true, notice: 7, maxDays: 4, halfDay: false, approval: 'workflow', self: true, ref: 'Permission exceptionnelle non déductible du congé (à valider selon la convention)' },
  { code: 'NAIS', label: 'Naissance ou adoption', icon: 'baby', color: '#38BDF8', category: 'Événements familiaux', paid: true, payCode: 'ABS_AUT', counter: 'PERM', unit: 'ouvrable', proof: true, notice: 0, maxDays: 3, halfDay: false, approval: 'workflow', self: true, ref: 'Permission exceptionnelle (à valider selon la convention)' },
  { code: 'DECES', label: 'Décès d’un proche', icon: 'leaf', color: '#64748B', category: 'Événements familiaux', paid: true, payCode: 'ABS_AUT', counter: 'PERM', unit: 'ouvrable', proof: true, notice: 0, maxDays: 5, halfDay: false, approval: 'workflow', self: true, ref: 'Permission exceptionnelle (à valider selon la convention)' },
  { code: 'MAL', label: 'Maladie', icon: 'thermo', color: '#E5484D', category: 'Santé', paid: true, payCode: 'ABS_MAL', counter: null, unit: 'calendaire', proof: true, notice: 0, halfDay: false, approval: 'declaration', self: true, ref: 'Certificat médical sous 48 h ; maintien du salaire selon l’ancienneté (à valider)' },
  { code: 'MAT', label: 'Congé de maternité', icon: 'stroller', color: '#EC6FA9', category: 'Santé', paid: true, payCode: 'ABS_AUT', counter: null, unit: 'calendaire', proof: true, notice: 30, maxDays: 98, halfDay: false, approval: 'workflow', self: true, ref: '14 semaines, indemnités journalières CNPS (maintien du salaire avec subrogation, à valider)' },
  { code: 'AT', label: 'Accident du travail', icon: 'shield', color: '#B0271E', category: 'Santé', paid: true, payCode: 'ABS_AUT', counter: null, unit: 'calendaire', proof: true, notice: 0, halfDay: false, approval: 'declaration', self: false, ref: 'Déclaration CNPS sous 3 jours ouvrables' },
  { code: 'FORM', label: 'Formation', icon: 'book', color: '#4F46E5', category: 'Présence hors poste', paid: true, payCode: null, counter: null, unit: 'ouvre', proof: false, notice: 7, halfDay: true, approval: 'workflow', self: true, ref: 'Temps de travail effectif' },
  { code: 'TT', label: 'Télétravail', icon: 'home', color: '#17A374', category: 'Présence hors poste', paid: true, payCode: null, counter: null, unit: 'ouvre', proof: false, notice: 1, halfDay: true, approval: 'workflow', self: true, ref: 'Présence à distance : le pointage se fait depuis le domicile déclaré' },
  { code: 'REC', label: 'Récupération', icon: 'refresh', color: '#0EA5B7', category: 'Congés', paid: true, payCode: null, counter: 'REC', unit: 'ouvre', proof: false, notice: 2, halfDay: true, approval: 'workflow', self: true, ref: 'Heures supplémentaires converties en repos' },
  { code: 'CSS', label: 'Congé sans solde', icon: 'pause', color: '#6B7280', category: 'Sans solde', paid: false, payCode: 'ABS_NP', counter: null, unit: 'ouvrable', proof: false, notice: 30, halfDay: false, approval: 'workflow', self: true, ref: 'Retenue au 1/30 par jour' },
  { code: 'INJ', label: 'Absence injustifiée', icon: 'alert', color: '#1F2937', category: 'Sans solde', paid: false, payCode: 'ABS_NP', counter: null, unit: 'ouvrable', proof: false, notice: 0, halfDay: true, approval: 'declaration', self: false, ref: 'Constatée par la GTA ou le manager ; retenue au 1/30' }
];
A.ICONS = ['sun', 'heart', 'baby', 'leaf', 'thermo', 'stroller', 'shield', 'book', 'home', 'refresh', 'pause', 'alert', 'star', 'plane', 'briefcase', 'cross'];
A.UNITS = { ouvrable: 'Jours ouvrables (lun. → sam.)', ouvre: 'Jours ouvrés (lun. → ven.)', calendaire: 'Jours calendaires' };
A.PAYCODES = { CONGE: 'Congé payé (décompte du solde, allocation de congés)', ABS_NP: 'Absence non rémunérée (retenue 1/30)', ABS_MAL: 'Maladie (information, salaire maintenu)', ABS_AUT: 'Absence autorisée payée (information)', '': 'Aucun impact paie' };

A.D = function (S, cid) {
  var d = Y.D(S, cid);
  if (!d.abs) d.abs = { types: U.clone(A.DEFAULT_TYPES), requests: [], managers: {}, delegations: [], counters: {}, customHolidays: [], seq: 0,
    settings: { workflow: 'salarie', coverage: 50, reportSunday: true, allowNegative: false, permDays: 10, proofDelayH: 48, notify: { whatsapp: true, email: true, inApp: true } } };
  return d.abs;
};
A.type = function (S, cid, code) { return A.D(S, cid).types.find(function (t) { return t.code === code; }); };

/* ======================================================================= jours fériés */
A.easter = function (y) { // algorithme de Meeus / Jones / Butcher (calendrier grégorien)
  var a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30,
    i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1;
  return y + '-' + U.pad(mo, 2) + '-' + U.pad(da, 2);
};
// Dates fixées chaque année par arrêté selon l'observation lunaire : valeurs prévisionnelles à confirmer.
A.ISLAMIC = {
  2025: [['2025-03-31', 'Fête de fin du Ramadan (Djouldé Soumaé)'], ['2025-06-07', 'Fête du Mouton (Djouldé Laya)']],
  2026: [['2026-03-20', 'Fête de fin du Ramadan (Djouldé Soumaé)'], ['2026-05-27', 'Fête du Mouton (Djouldé Laya)']],
  2027: [['2027-03-10', 'Fête de fin du Ramadan (Djouldé Soumaé)'], ['2027-05-17', 'Fête du Mouton (Djouldé Laya)']]
};
A.holidays = function (S, cid, year) {
  var d = A.D(S, cid), out = [];
  [['01-01', 'Jour de l’An'], ['02-11', 'Fête de la Jeunesse'], ['05-01', 'Fête du Travail'], ['05-20', 'Fête nationale'], ['08-15', 'Assomption'], ['12-25', 'Noël']].forEach(function (h) { out.push({ date: year + '-' + h[0], label: h[1], kind: 'Légal' }); });
  var ea = A.easter(year);
  out.push({ date: U.addDays(ea, -2), label: 'Vendredi saint', kind: 'Religieux' });
  out.push({ date: U.addDays(ea, 39), label: 'Ascension', kind: 'Religieux' });
  (A.ISLAMIC[year] || []).forEach(function (h) { out.push({ date: h[0], label: h[1], kind: 'Religieux', toConfirm: true }); });
  d.customHolidays.filter(function (h) { return U.year(h.date) === year; }).forEach(function (h) { out.push({ date: h.date, label: h.label, kind: h.kind || 'Entreprise', custom: true, id: h.id }); });
  if (d.settings.reportSunday) out.slice().forEach(function (h) { if (A.dow(h.date) === 0 && !h.custom) { var mon = U.addDays(h.date, 1); if (!out.some(function (x) { return x.date === mon; })) out.push({ date: mon, label: h.label + ' (report du dimanche)', kind: 'Report' }); } });
  return out.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
};
var hCache = {};
A.holidayMap = function (S, cid, year) {
  var d = A.D(S, cid), k = cid + '|' + year + '|' + d.customHolidays.length + '|' + d.settings.reportSunday;
  if (!hCache[k]) { var m = {}; A.holidays(S, cid, year).forEach(function (h) { m[h.date] = h.label; }); hCache[k] = m; }
  return hCache[k];
};
A.isHoliday = function (S, cid, date) { return A.holidayMap(S, cid, U.year(date))[date] || ''; };
A.addHoliday = function (S, cid, h) {
  need(S, 'abs.settings'); var d = A.D(S, cid);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(h.date || '')) fail('Date invalide.'); if (!h.label) fail('Libellé obligatoire.');
  var rec = { id: U.uid('hol'), date: h.date, label: h.label, kind: h.kind || 'Entreprise' }; d.customHolidays.push(rec); hCache = {};
  Y.audit(S, cid, 'Absences · jour férié', rec.date, rec.label); return rec;
};
A.removeHoliday = function (S, cid, id) { need(S, 'abs.settings'); var d = A.D(S, cid); d.customHolidays = d.customHolidays.filter(function (h) { return h.id !== id; }); hCache = {}; };

/* ======================================================================= décompte */
A.isCounted = function (S, cid, unit, date) {
  var w = A.dow(date);
  if (unit === 'calendaire') return true;
  if (A.isHoliday(S, cid, date)) return false;
  if (unit === 'ouvre') return w >= 1 && w <= 5;
  return w >= 1 && w <= 6; // ouvrable
};
/** Liste des jours décomptés avec leur poids (1 ou 0,5). */
A.dayList = function (S, cid, unit, start, end, startHalf, endHalf) {
  var out = [], n = U.daysBetween(start, end);
  if (n < 0) return out;
  for (var i = 0; i <= n; i++) {
    var dt = U.addDays(start, i); if (!A.isCounted(S, cid, unit, dt)) continue;
    var w = 1;
    if (dt === start && startHalf === 'pm') w -= 0.5;
    if (dt === end && endHalf === 'am') w -= 0.5;
    if (start === end && startHalf === 'pm' && endHalf === 'am') w = 0;
    if (w > 0) out.push({ date: dt, w: w });
  }
  return out;
};
A.countDays = function (S, cid, typeCode, start, end, startHalf, endHalf) {
  var t = A.type(S, cid, typeCode); if (!t) return 0;
  return U.sum(A.dayList(S, cid, t.unit, start, end, startHalf, endHalf), function (x) { return x.w; });
};

/* ======================================================================= personnes & périmètres */
A.me = function (S, cid) {
  var cu = S.meta.currentUser || {}, u = (S.users || []).find(function (x) { return x.id === cu.id; });
  var m = u && u.employee && (typeof u.employee === 'string' ? u.employee : u.employee[cid]);
  return m ? Y.Paie.emp(S, cid, m) : null;
};
A.managerOf = function (S, cid, emp) {
  var d = A.D(S, cid), m = d.managers[emp.service]; if (!m) return null;
  var mgr = Y.Paie.emp(S, cid, m); if (!mgr || mgr.id === emp.id || mgr.statut === 'sorti') return null;
  return mgr;
};
A.managedServices = function (S, cid, emp) { var d = A.D(S, cid); return emp ? Object.keys(d.managers).filter(function (s) { return d.managers[s] === emp.matricule; }) : []; };
/** Salariés visibles par l'utilisateur courant : tout le monde (RH, paie, direction), son service (N+1), lui-même (salarié). */
A.scope = function (S, cid) {
  var all = Y.Paie.D(S, cid).employees.filter(function (e) { return e.statut !== 'sorti'; });
  if (A.can(S, 'abs.manage') || A.can(S, 'abs.hr') || (A.can(S, 'abs.read') && !A.can(S, 'abs.approve')) || role(S) === 'owner') return all;
  var me = A.me(S, cid); if (!me) return [];
  var svc = A.managedServices(S, cid, me);
  return all.filter(function (e) { return e.id === me.id || svc.indexOf(e.service) > -1; });
};
function isAbsentOn(S, cid, empId, date) {
  return A.D(S, cid).requests.some(function (r) { return r.empId === empId && r.status === 'approuvee' && r.start <= date && r.end >= date && ['TT', 'FORM'].indexOf(r.type) < 0; });
}
/** Approbateur effectif à l'étape N+1 : le manager du service, son délégué s'il est absent, sinon la DRH. */
A.approverFor = function (S, cid, emp, date) {
  var d = A.D(S, cid), mgr = A.managerOf(S, cid, emp);
  if (!mgr) return { step: 'rh', reason: emp && A.managedServices(S, cid, emp).indexOf(emp.service) > -1 ? 'Le salarié est le N+1 de son service : validation par la DRH.' : 'Aucun N+1 défini pour le service : validation par la DRH.' };
  var today = date || S.meta.today, dl = d.delegations.find(function (x) { return x.from === mgr.matricule && x.start <= today && x.end >= today; });
  if (dl) { var del = Y.Paie.emp(S, cid, dl.to); if (del && del.id !== emp.id) return { step: 'n1', approver: del.matricule, reason: 'Délégation de ' + Y.Paie.fullName(mgr) + ' jusqu’au ' + U.frDate(dl.end) + '.' }; }
  if (isAbsentOn(S, cid, mgr.id, today)) return { step: 'rh', reason: 'N+1 absent sans délégation : validation par la DRH.' };
  return { step: 'n1', approver: mgr.matricule };
};

/* ======================================================================= soldes */
function lastFrozenEnd(S, cid) {
  var pd = Y.Paie.D(S, cid), keys = Object.keys(pd.periods).filter(function (k) { return Y.Paie.isFrozen(pd.periods[k]); }).sort();
  return keys.length ? Y.Paie.periodBounds(keys[keys.length - 1]).end : '0000-00-00';
}
A.lastPaidDate = lastFrozenEnd;
function daysOf(S, cid, r, filter) { var t = A.type(S, cid, r.type); return U.sum(A.dayList(S, cid, t ? t.unit : 'ouvrable', r.start, r.end, r.startHalf, r.endHalf).filter(filter || function () { return true; }), function (x) { return x.w; }); }
A.balances = function (S, cid, emp, year) {
  var d = A.D(S, cid), y = year || U.year(S.meta.today), lf = lastFrozenEnd(S, cid);
  var mine = d.requests.filter(function (r) { return r.empId === emp.id; });
  function sumBy(counter, statuses, filter) { return U.sum(mine.filter(function (r) { var t = A.type(S, cid, r.type); return t && t.counter === counter && statuses.indexOf(r.status) > -1; }), function (r) { return daysOf(S, cid, r, filter); }); }
  var pending = ['en_attente_n1', 'en_attente_rh', 'a_notifier'];
  var cpAcq = Math.round(((emp.conges && emp.conges.solde) || 0) * 100) / 100;
  var cpTaken = sumBy('CP', ['approuvee'], function (x) { return x.date > lf; }), cpPend = sumBy('CP', pending);
  var permDroit = d.settings.permDays, inYear = function (x) { return U.year(x.date) === y; };
  var permTaken = sumBy('PERM', ['approuvee'], inYear), permPend = sumBy('PERM', pending, inYear);
  var c = ((d.counters[y] || {})[emp.id]) || {}, recAcq = c.REC || 0;
  var recTaken = sumBy('REC', ['approuvee'], inYear), recPend = sumBy('REC', pending, inYear);
  function r2(n) { return Math.round(n * 100) / 100; }
  return {
    CP: { label: 'Congés payés', acquis: cpAcq, pris: r2(cpTaken), attente: r2(cpPend), disponible: r2(cpAcq - cpTaken - cpPend), note: 'Solde au dernier bulletin validé (' + (lf === '0000-00-00' ? 'aucun' : U.frDate(lf)) + '), moins les congés approuvés depuis' },
    PERM: { label: 'Permissions exceptionnelles', acquis: permDroit, pris: r2(permTaken), attente: r2(permPend), disponible: r2(permDroit - permTaken - permPend), note: 'Droit annuel ' + y },
    REC: { label: 'Récupération', acquis: r2(recAcq), pris: r2(recTaken), attente: r2(recPend), disponible: r2(recAcq - recTaken - recPend), note: 'Heures supplémentaires converties en repos' }
  };
};
A.creditRecup = function (S, cid, empId, days, note) {
  need(S, 'abs.manage'); var d = A.D(S, cid), y = U.year(S.meta.today);
  d.counters[y] = d.counters[y] || {}; var c = d.counters[y][empId] = d.counters[y][empId] || {}; c.REC = Math.round(((c.REC || 0) + Number(days)) * 100) / 100;
  Y.audit(S, cid, 'Absences · crédit de récupération', Y.Paie.emp(S, cid, empId).matricule, days + ' j · ' + (note || '')); return c.REC;
};

/* ======================================================================= demandes */
A.STATUS = {
  en_attente_n1: ['En attente du N+1', 'warn'], en_attente_rh: ['En attente de la DRH', 'warn'], a_notifier: ['Validée · à enregistrer et notifier', 'info'],
  approuvee: ['Approuvée', 'ok'], refusee: ['Refusée', 'bad'], annulee: ['Annulée', '']
};
var STEP_STATUS = { n1: 'en_attente_n1', rh: 'en_attente_rh', notify: 'a_notifier' };
A.STEP_LABEL = { n1: 'Validation N+1', rh: 'Validation DRH', notify: 'Enregistrement et notification (gestionnaire)' };
function statusOf(r) { return r.step < r.steps.length ? STEP_STATUS[r.steps[r.step]] : 'approuvee'; }

A.coverage = function (S, cid, service, date, excludeId) {
  var team = Y.Paie.D(S, cid).employees.filter(function (e) { return e.statut !== 'sorti' && e.service === service; });
  var abs = team.filter(function (e) { return A.D(S, cid).requests.some(function (r) { return r.id !== excludeId && r.empId === e.id && ['approuvee', 'en_attente_n1', 'en_attente_rh', 'a_notifier'].indexOf(r.status) > -1 && r.start <= date && r.end >= date && ['TT', 'FORM'].indexOf(r.type) < 0; }); });
  return { total: team.length, absent: abs.length, pct: team.length ? Math.round(abs.length * 100 / team.length) : 0, names: abs.map(function (e) { return Y.Paie.fullName(e); }) };
};
/** Contrôles d'une demande (sans enregistrer) : erreurs bloquantes et avertissements. */
A.check = function (S, cid, data) {
  var d = A.D(S, cid), errs = [], warns = [], t = A.type(S, cid, data.type), emp = data.empId && Y.Paie.emp(S, cid, data.empId);
  if (!emp) errs.push('Salarié introuvable.');
  if (!t) errs.push('Motif inconnu.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.start || '') || !/^\d{4}-\d{2}-\d{2}$/.test(data.end || '')) errs.push('Dates de début et de fin obligatoires.');
  if (errs.length) return { errors: errs, warnings: warns, days: 0 };
  if (data.end < data.start) errs.push('La date de fin précède la date de début.');
  if (t.active === false) errs.push('Motif désactivé.');
  if (!t.halfDay && (data.startHalf === 'pm' || data.endHalf === 'am')) errs.push('Ce motif ne se prend pas par demi-journée.');
  var days = A.countDays(S, cid, t.code, data.start, data.end, data.startHalf, data.endHalf);
  if (!errs.length && !(days > 0)) errs.push('Aucun jour décompté sur cette période (week-end ou jours fériés).');
  if (t.maxDays && days > t.maxDays) errs.push(t.label + ' : ' + t.maxDays + ' jour(s) maximum par événement.');
  var over = d.requests.find(function (r) { return r.id !== data.id && r.empId === emp.id && ['refusee', 'annulee'].indexOf(r.status) < 0 && r.start <= data.end && r.end >= data.start; });
  if (over) errs.push('Chevauchement avec la demande ' + over.ref + ' (' + A.type(S, cid, over.type).label + ' du ' + U.frDate(over.start) + ' au ' + U.frDate(over.end) + ').');
  if (t.counter) {
    var b = A.balances(S, cid, emp)[t.counter];
    if (b && days > b.disponible + 1e-9) { var m = b.label + ' : solde disponible ' + String(b.disponible).replace('.', ',') + ' j pour ' + String(days).replace('.', ',') + ' j demandés.'; if (t.counter === 'CP' && d.settings.allowNegative) warns.push(m + ' Solde négatif autorisé par le paramétrage.'); else errs.push(m); }
  }
  var lead = U.daysBetween(S.meta.today, data.start);
  if (t.notice && lead < t.notice && t.approval === 'workflow') warns.push('Délai de prévenance de ' + t.notice + ' jour(s) non respecté (' + Math.max(lead, 0) + ' j).');
  if (t.proof && !data.proof) warns.push('Justificatif à fournir sous ' + d.settings.proofDelayH + ' h.');
  if (data.start < lastFrozenEnd(S, cid) && t.payCode) warns.push('Période de paie déjà validée : l’impact sera régularisé sur la paie en cours.');
  if (['TT', 'FORM'].indexOf(t.code) < 0) {
    var worst = null; A.dayList(S, cid, t.unit, data.start, data.end).forEach(function (x) { var c = A.coverage(S, cid, emp.service, x.date, data.id); if (!worst || c.pct > worst.pct) worst = Object.assign({ date: x.date }, c); });
    if (worst && worst.total > 1 && Math.round((worst.absent + 1) * 100 / worst.total) > d.settings.coverage) warns.push('Couverture du service ' + emp.service + ' : ' + (worst.absent + 1) + ' absent(s) sur ' + worst.total + ' le ' + U.frDate(worst.date) + ' (seuil ' + d.settings.coverage + ' %).');
  }
  return { errors: errs, warnings: warns, days: days, type: t, emp: emp };
};

A.request = function (S, cid, data) {
  var d = A.D(S, cid), me = A.me(S, cid), emp = Y.Paie.emp(S, cid, data.empId), t = A.type(S, cid, data.type);
  var forSelf = !!(me && emp && me.id === emp.id);
  if (forSelf && t && t.self) need(S, 'abs.request');
  else if (A.can(S, 'abs.manage') || A.can(S, 'abs.hr')) { /* saisie pour un salarié */ }
  else need(S, forSelf ? 'abs.request' : 'abs.manage');
  if (forSelf && t && !t.self && !A.can(S, 'abs.manage')) fail('Ce motif est saisi par le gestionnaire.');
  var c = A.check(S, cid, data); if (c.errors.length) fail(c.errors);
  var wf = d.settings.workflow, steps = [], note = '';
  var recorder = !forSelf && (A.can(S, 'abs.manage') || A.can(S, 'abs.hr'));
  if (t.approval === 'declaration') steps = recorder ? [] : ['notify'];
  else if (wf === 'gestionnaire') steps = ['rh'];
  else { var ap = A.approverFor(S, cid, emp); steps = [ap.step]; if (ap.step === 'n1') data.approver = ap.approver; note = ap.reason || ''; steps.push('notify'); if (recorder && A.can(S, 'abs.manage')) { /* le gestionnaire notifiera après le N+1 */ } }
  d.seq++;
  var r = { id: U.uid('abs'), ref: 'ABS-' + U.year(S.meta.today) + '-' + U.pad(d.seq, 4), empId: emp.id, matricule: emp.matricule, type: t.code, start: data.start, end: data.end, startHalf: data.startHalf || '', endHalf: data.endHalf || '',
    days: c.days, reason: data.reason || '', proof: data.proof || '', steps: steps, step: 0, approver: data.approver || '', status: '', createdAt: new Date().toISOString(), createdBy: who(S).by, createdById: (S.meta.currentUser || {}).id || '', onBehalf: !forSelf,
    history: [Object.assign({ action: forSelf ? 'Demande déposée' : 'Saisie par ' + (Y.ROLES[role(S)] || {}).label, comment: data.reason || '' }, who(S))], warnings: c.warnings, notified: null, payKeys: [] };
  if (note) r.history.push({ action: 'Circuit', comment: note, by: 'Système', at: new Date().toISOString() });
  r.status = statusOf(r);
  if (r.status === 'approuvee') autoNotify(S, cid, r);
  d.requests.unshift(r);
  Y.audit(S, cid, 'Absences · demande', r.ref, emp.matricule + ' · ' + t.label + ' · ' + r.days + ' j');
  return r;
};
function autoNotify(S, cid, r) {
  r.notified = { at: new Date().toISOString(), by: 'Système', channels: channels(S, cid), auto: true };
  r.history.push({ action: 'Salarié notifié automatiquement', comment: r.notified.channels.join(', '), by: 'Système', at: r.notified.at });
}
function channels(S, cid) { var n = A.D(S, cid).settings.notify, c = []; if (n.inApp) c.push('myyiel'); if (n.whatsapp) c.push('WhatsApp'); if (n.email) c.push('e-mail'); return c; }

/** Peut-on agir sur l'étape courante ? Renvoie un message d'erreur ou ''. */
A.canAct = function (S, cid, r) {
  if (['approuvee', 'refusee', 'annulee'].indexOf(r.status) > -1) return 'Demande déjà traitée.';
  var step = r.steps[r.step], me = A.me(S, cid);
  if (step === 'n1') {
    if (me && me.id === r.empId) return 'Vous ne pouvez pas valider votre propre demande.';
    if (A.can(S, 'abs.hr')) return '';
    if (!A.can(S, 'abs.approve')) return 'Validation réservée au N+1 du service.';
    if (!me || me.matricule !== r.approver) return 'Seul le N+1 désigné (' + r.approver + ') peut valider.';
    return '';
  }
  if (step === 'rh') { if (me && me.id === r.empId) return 'Vous ne pouvez pas valider votre propre demande.'; if (r.onBehalf && r.createdById && r.createdById === (S.meta.currentUser || {}).id) return 'Vous avez saisi cette demande : une autre personne doit la valider.'; return A.can(S, 'abs.hr') ? '' : 'Validation réservée à la DRH.'; }
  if (step === 'notify') return A.can(S, 'abs.manage') ? '' : 'Enregistrement réservé au gestionnaire.';
  return 'Étape inconnue.';
};
A.decide = function (S, cid, id, decision, comment, opts) {
  opts = opts || {};
  var r = A.D(S, cid).requests.find(function (x) { return x.id === id; }); if (!r) fail('Demande introuvable.');
  var why = A._bypass ? '' : A.canAct(S, cid, r); if (why) fail(why);
  var step = r.steps[r.step];
  if (decision === 'refuse') {
    if (!comment) fail('Motif du refus obligatoire.');
    r.status = 'refusee'; r.history.push(Object.assign({ action: 'Refusée · ' + A.STEP_LABEL[step], comment: comment }, who(S)));
    r.notified = { at: new Date().toISOString(), by: who(S).by, channels: channels(S, cid) };
    Y.audit(S, cid, 'Absences · refus', r.ref, comment); return r;
  }
  if (step === 'notify') {
    r.notified = { at: new Date().toISOString(), by: who(S).by, channels: opts.channels || channels(S, cid), message: opts.message || A.message(S, cid, r) };
    r.history.push(Object.assign({ action: 'Enregistrée et notifiée au salarié', comment: (comment || '') + (comment ? ' · ' : '') + r.notified.channels.join(', ') }, who(S)));
    if (opts.proof) r.proof = opts.proof;
  } else {
    var del = step === 'n1' && A.can(S, 'abs.hr') && !(A.me(S, cid) && A.me(S, cid).matricule === r.approver);
    r.history.push(Object.assign({ action: 'Approuvée · ' + A.STEP_LABEL[step] + (del ? ' (par la DRH)' : ''), comment: comment || '' }, who(S)));
  }
  r.step++; r.status = statusOf(r);
  if (r.status === 'approuvee' && !r.notified) autoNotify(S, cid, r);
  Y.audit(S, cid, 'Absences · validation', r.ref, A.STEP_LABEL[step]);
  return r;
};
A.cancel = function (S, cid, id, comment) {
  var r = A.D(S, cid).requests.find(function (x) { return x.id === id; }); if (!r) fail('Demande introuvable.');
  var me = A.me(S, cid), own = me && me.id === r.empId;
  if (!own && !A.can(S, 'abs.manage') && !A.can(S, 'abs.hr')) fail('Annulation réservée au salarié ou au gestionnaire.');
  if (['refusee', 'annulee'].indexOf(r.status) > -1) fail('Demande déjà close.');
  if (own && r.status === 'approuvee' && r.start <= S.meta.today && !A.can(S, 'abs.manage')) fail('Absence commencée : demandez l’annulation au gestionnaire.');
  if (r.payKeys.some(function (k) { var p = Y.Paie.D(S, cid).periods[k]; return p && Y.Paie.isFrozen(p); })) fail('Absence déjà payée sur une période validée : régularisez par la paie.');
  r.status = 'annulee'; r.history.push(Object.assign({ action: 'Annulée', comment: comment || '' }, who(S)));
  Y.audit(S, cid, 'Absences · annulation', r.ref, comment || ''); return r;
};
A.message = function (S, cid, r) {
  var e = Y.Paie.emp(S, cid, r.empId), t = A.type(S, cid, r.type), co = Y.company(S, cid) || {};
  var ok = r.status !== 'refusee';
  return 'Bonjour ' + (e.prenoms || '') + ',\nVotre demande ' + r.ref + ' (' + t.label + ', du ' + U.frDate(r.start) + (r.startHalf === 'pm' ? ' après-midi' : '') + ' au ' + U.frDate(r.end) + (r.endHalf === 'am' ? ' matin' : '') + ', ' + String(r.days).replace('.', ',') + ' j) est ' + (ok ? 'approuvée' : 'refusée') + '.' +
    (t.proof && !r.proof ? '\nMerci de déposer votre justificatif dans votre espace myyiel.' : '') + '\n' + (co.name || '') + ' · Ressources humaines';
};

/* ======================================================================= planning */
/** Carte salarié → date → cellule (motif, statut, poids) sur un intervalle. */
A.cells = function (S, cid, from, to) {
  var map = {};
  A.D(S, cid).requests.forEach(function (r) {
    if (['refusee', 'annulee'].indexOf(r.status) > -1 || r.end < from || r.start > to) return;
    var t = A.type(S, cid, r.type); if (!t) return;
    A.dayList(S, cid, t.unit === 'calendaire' ? 'calendaire' : t.unit, r.start, r.end, r.startHalf, r.endHalf).forEach(function (x) {
      if (x.date < from || x.date > to) return;
      (map[r.empId] = map[r.empId] || {})[x.date] = { code: t.code, status: r.status, w: x.w, id: r.id, half: x.w < 1 ? (x.date === r.start && r.startHalf === 'pm' ? 'pm' : 'am') : '' };
    });
  });
  return map;
};

/* ======================================================================= paie */
/** Événements de temps pour la paie d'une période (absences approuvées ayant un impact paie). */
A.payEvents = function (S, cid, key) {
  var b = Y.Paie.periodBounds(key), out = [];
  A.D(S, cid).requests.forEach(function (r) {
    if (r.status !== 'approuvee') return;
    var t = A.type(S, cid, r.type); if (!t || !t.payCode) return;
    var e = Y.Paie.emp(S, cid, r.empId); if (!e) return;
    A.dayList(S, cid, t.unit, r.start, r.end, r.startHalf, r.endHalf).forEach(function (x) {
      if (x.date < b.start || x.date > b.end) return;
      out.push({ id: r.ref + '-' + x.date, matricule: e.matricule, date: x.date, type: t.payCode, quantite: x.w, commentaire: t.label + ' · ' + r.ref, _req: r.id });
    });
  });
  return out;
};
A.markExported = function (S, cid, key, events) { var d = A.D(S, cid); events.forEach(function (ev) { var r = d.requests.find(function (x) { return x.id === ev._req; }); if (r && r.payKeys.indexOf(key) < 0) r.payKeys.push(key); }); };

/* ======================================================================= notifications */
A.notifications = function (S, cid) {
  var d = A.D(S, cid), out = [], me = A.me(S, cid);
  function push(level, title, text, page, tab) { out.push({ level: level, title: title, text: text, page: page, tab: tab, module: 'absences' }); }
  var mineN1 = d.requests.filter(function (r) { return r.status === 'en_attente_n1' && me && r.approver === me.matricule; });
  if (mineN1.length && A.can(S, 'abs.approve')) push('warn', mineN1.length + ' demande(s) d’absence à valider', 'Vous êtes le N+1 désigné.', 'abs', 'validations');
  var rh = d.requests.filter(function (r) { return r.status === 'en_attente_rh'; });
  if (rh.length && A.can(S, 'abs.hr')) push('warn', rh.length + ' demande(s) d’absence en attente DRH', 'Escalades et circuit gestionnaire → DRH.', 'abs', 'validations');
  var nt = d.requests.filter(function (r) { return r.status === 'a_notifier'; });
  if (nt.length && A.can(S, 'abs.manage')) push('info', nt.length + ' absence(s) à enregistrer et notifier', 'Validées par le N+1 ou déclarées par les salariés.', 'abs', 'validations');
  var proof = d.requests.filter(function (r) { var t = A.type(S, cid, r.type); return t && t.proof && !r.proof && ['refusee', 'annulee'].indexOf(r.status) < 0; });
  if (proof.length && A.can(S, 'abs.manage')) push('warn', proof.length + ' justificatif(s) manquant(s)', 'Certificats médicaux, actes d’état civil…', 'abs', 'demandes');
  if (me && A.can(S, 'self')) {
    var dec = d.requests.filter(function (r) { return r.empId === me.id && r.notified && ['approuvee', 'refusee'].indexOf(r.status) > -1 && U.daysBetween(r.notified.at.slice(0, 10), S.meta.today) <= 3; });
    dec.forEach(function (r) { push(r.status === 'approuvee' ? 'ok' : 'bad', 'Votre demande ' + r.ref + ' est ' + (r.status === 'approuvee' ? 'approuvée' : 'refusée'), A.type(S, cid, r.type).label + ' du ' + U.frDate(r.start) + ' au ' + U.frDate(r.end), 'moi', 'absences'); });
  }
  return out;
};

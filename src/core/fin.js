/*
 * myyiel Module 4 · Trésorerie, facturation et paiements (pur JavaScript, sans DOM, exécutable sous Node).
 * S'appuie sur les objets comptables existants (factures Y.docs, tiers Y.tiers, écritures, relevés Y.bankTx) : une opération n'est saisie qu'une fois.
 * - Facturation électronique : modèles personnalisables à mentions verrouillées, contrôle des mentions, cycle de vie, empreinte d'archivage.
 * - Encaissements : lien de paiement sur la facture, transaction chez le prestataire, confirmation SIGNÉE et idempotente avant tout « payé ».
 * - Justificatifs déclarés (captures, SMS) : jamais pris pour un paiement ; analyse anti-falsification ; confirmation par le relevé.
 * - Factures fournisseurs : boîte de réception, extraction, doublons, sosies, coordonnées divergentes, validation puis comptabilisation.
 * - Paiements fournisseurs : propositions, score de risque, circuits d'approbation par seuil, séparation des tâches, exécution.
 * - Anti-usurpation : quarantaine des changements de coordonnées, rappel au numéro du référentiel, délai de carence, liste de vigilance,
 *   vérification du nom du titulaire chez l'opérateur, comptes partagés avec un salarié ou un autre fournisseur.
 * - Rapprochement intelligent (frais d'opérateur, paiements fractionnés ou groupés, références imparfaites), prévision de trésorerie prudente,
 *   relances multicanales et promesses de paiement, répertoire clients/fournisseurs enrichi et import.
 * Spécifications : docs/fin/
 */
import { Y } from './registry.js';

var U = Y.util;
var F = Y.Fin = {};
function fail(m) { throw new Y.BizError(m); }
function role(S) { return (S.meta.currentUser || {}).role || 'reader'; }
F.can = function (S, right) { return Y.can(role(S), right); };
function need(S, right) { if (F._bypass) return; if (!F.can(S, right)) fail('Action réservée : ' + (Y.RIGHTS[right] || right).toLowerCase() + ' (rôle actuel : ' + ((Y.ROLES[role(S)] || {}).label || role(S)) + ').'); }
function who(S) { var u = S.meta.currentUser || {}; return { by: u.name || 'Système', byId: u.id || '', at: new Date().toISOString() }; }
function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); }
function digits(s) { return String(s || '').replace(/\D/g, ''); }
function phoneKey(s) { var d = digits(s); return d.length > 9 ? d.slice(-9) : d; }
F.norm = norm; F.phoneKey = phoneKey;
/** Distance de Levenshtein (sosies de raisons sociales, références imparfaites). */
F.lev = function (a, b) {
  a = norm(a); b = norm(b); if (a === b) return 0; if (!a.length) return b.length; if (!b.length) return a.length;
  var p = [], i, j; for (j = 0; j <= b.length; j++) p[j] = j;
  for (i = 1; i <= a.length; i++) { var c = [i]; for (j = 1; j <= b.length; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = c; }
  return p[b.length];
};
F.similar = function (a, b) { var x = norm(a), y = norm(b); if (!x || !y) return 0; return 1 - F.lev(x, y) / Math.max(x.length, y.length); };

F.D = function (S, cid) {
  var d = Y.D(S, cid);
  if (!d.fin) d.fin = {
    templates: [], meta: {}, links: [], txs: [], proofs: [], inbox: [], proposals: [], changes: [], watch: [], operatorDir: {}, promises: [], processed: {}, security: [], seq: { tx: 0, link: 0, prop: 0, inbox: 0, change: 0 },
    settings: {
      approval: { single: 1000000, double: 5000000 }, coolingHours: 48, firstPaymentCap: 500000, minCash: 35000000, riskBlock: 70, riskReview: 40,
      compliance: { mode: 'commerciale', homologation: '', provider: '' }, linkDays: 30, allowPartial: true,
      providers: { mtn: { label: 'MTN Mobile Money', status: 'sandbox', secret: 'mtn-demo-secret' }, orange: { label: 'Orange Money', status: 'sandbox', secret: 'om-demo-secret' }, bank: { label: 'Virement bancaire', status: 'import' }, card: { label: 'Carte bancaire', status: 'indisponible' } },
      dunning: [{ day: -3, channel: 'whatsapp', label: 'Rappel courtois avant échéance' }, { day: 1, channel: 'email', label: 'Échéance dépassée' }, { day: 7, channel: 'whatsapp', label: 'Relance avec lien de paiement' }, { day: 15, channel: 'appel', label: 'Appel du responsable de compte' }, { day: 30, channel: 'courrier', label: 'Mise en demeure' }]
    }
  };
  return d.fin;
};

/* ======================================================================= répertoire clients / fournisseurs */
F.CATEGORIES = { fournisseur: ['Informatique & numérique', 'Télécommunications', 'Immobilier & locaux', 'Énergie & eau', 'Conseil & expertise', 'Transport & mobilité', 'Fournitures de bureau', 'Hôtellerie & restauration', 'Communication & événementiel', 'Autres'], client: ['PME', 'Grande entreprise', 'Établissement scolaire', 'Santé', 'Transport & logistique', 'Agriculture', 'Administration', 'Association / ONG', 'Autres'] };
F.PAY_MODES = { bank: 'Virement bancaire', momo: 'MTN Mobile Money', om: 'Orange Money', cash: 'Espèces', cheque: 'Chèque', card: 'Carte bancaire' };
/** Profil financier étendu d'un tiers (créé à la volée, sans casser la fiche comptable). */
F.profile = function (t) {
  if (!t.fin) t.fin = { legalForm: '', tradeName: t.name, category: '', status: 'actif', contacts: [], addresses: [], banks: [], payModes: [], docs: [], evaluations: [], notes: [], currency: 'XAF', template: '', discountMax: 0, website: '', emailDomain: '' };
  if (!t.fin.contacts.length && (t.phone || t.email)) t.fin.contacts.push({ id: U.uid('ct'), name: 'Contact principal', role: '', phone: t.phone || '', whatsapp: t.momo || t.phone || '', email: t.email || '', main: true });
  return t.fin;
};
F.saveTiers = function (S, cid, t, opts) {
  opts = opts || {}; need(S, 'fin.vendor');
  var d = Y.D(S, cid), ex = t.id ? Y.tiers(S, cid, t.id) : null, errs = [];
  if (!t.name) errs.push('Raison sociale obligatoire.');
  if (t.niu && !/^[A-Z0-9]{8,20}$/i.test(t.niu)) errs.push('NIU invalide : 8 à 20 caractères alphanumériques.');
  if (t.email && !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(t.email)) errs.push('E-mail invalide.');
  var dup = F.findDuplicates(S, cid, t, ex && ex.id);
  if (dup.length && !opts.force) errs.push('Doublon probable : ' + dup.map(function (x) { return x.t.code + ' ' + x.t.name + ' (' + x.why + ')'; }).join(' ; ') + '.');
  if (errs.length) fail(errs);
  var base = { name: t.name, niu: (t.niu || '').toUpperCase(), rccm: t.rccm || '', email: t.email || '', phone: t.phone || '', city: t.city || '', address: t.address || '', terms: +t.terms || (ex ? ex.terms : 30), creditLimit: U.round(t.creditLimit || 0), regime: t.regime || (ex ? ex.regime : 'Réel'), country: t.country || 'Cameroun' };
  var rec;
  if (ex) { Object.assign(ex, base); rec = ex; } else rec = Y.createTiers(S, cid, Object.assign({ type: t.type || 'client' }, base));
  var p = F.profile(rec);
  ['legalForm', 'tradeName', 'category', 'website', 'district', 'bp', 'currency', 'template'].forEach(function (k) { if (t[k] !== undefined) p[k] = t[k]; });
  if (t.discountMax !== undefined) p.discountMax = +t.discountMax || 0;
  if (t.payModes) p.payModes = t.payModes;
  if (rec.email) p.emailDomain = rec.email.split('@')[1].toLowerCase();
  Y.audit(S, cid, ex ? 'Tiers · modification' : 'Tiers · création', rec.code, rec.name);
  return rec;
};
F.findDuplicates = function (S, cid, t, exceptId) {
  var out = [];
  Y.D(S, cid).tiers.forEach(function (x) {
    if (x.id === exceptId || (t.type && x.type !== t.type)) return;
    if (t.niu && x.niu && t.niu.toUpperCase() === x.niu.toUpperCase()) out.push({ t: x, why: 'même NIU' });
    else if (t.name && F.similar(t.name, x.name) >= 0.9) out.push({ t: x, why: 'raison sociale quasi identique' });
    else if (t.phone && x.phone && phoneKey(t.phone) === phoneKey(x.phone)) out.push({ t: x, why: 'même téléphone' });
    else if (t.email && x.email && t.email.toLowerCase() === x.email.toLowerCase()) out.push({ t: x, why: 'même e-mail' });
  });
  return out;
};
F.addContact = function (S, cid, tiersId, c) {
  need(S, 'fin.vendor'); var t = Y.tiers(S, cid, tiersId), p = F.profile(t);
  if (!c.name) fail('Nom du contact obligatoire.');
  if (c.main) p.contacts.forEach(function (x) { x.main = false; });
  var rec = { id: U.uid('ct'), name: c.name, role: c.role || '', phone: c.phone || '', whatsapp: c.whatsapp || c.phone || '', email: c.email || '', main: !!c.main || !p.contacts.length, addedAt: new Date().toISOString(), addedBy: who(S).by };
  p.contacts.push(rec); Y.audit(S, cid, 'Tiers · contact', t.code, rec.name); return rec;
};
F.addDocument = function (S, cid, tiersId, doc) { need(S, 'fin.vendor'); var t = Y.tiers(S, cid, tiersId), p = F.profile(t); if (!doc.name) fail('Fichier obligatoire.'); var r = { id: U.uid('fd'), name: doc.name, type: doc.type || 'Autre', date: doc.date || S.meta.today, expires: doc.expires || '', by: who(S).by }; p.docs.unshift(r); Y.audit(S, cid, 'Tiers · document', t.code, r.name); return r; };
F.evaluate = function (S, cid, tiersId, ev) { need(S, 'fin.vendor'); var t = Y.tiers(S, cid, tiersId), p = F.profile(t); var r = { id: U.uid('ev'), date: S.meta.today, quality: +ev.quality, delay: +ev.delay, price: +ev.price, comment: ev.comment || '', by: who(S).by }; if ([r.quality, r.delay, r.price].some(function (x) { return !(x >= 1 && x <= 5); })) fail('Notes de 1 à 5.'); p.evaluations.unshift(r); return r; };
F.rating = function (t) { var e = F.profile(t).evaluations; if (!e.length) return null; return Math.round(U.sum(e, function (x) { return (x.quality + x.delay + x.price) / 3; }) / e.length * 10) / 10; };
F.setStatus = function (S, cid, tiersId, status, comment) { need(S, 'fin.verify'); var t = Y.tiers(S, cid, tiersId), p = F.profile(t); if (['actif', 'a_valider', 'suspendu'].indexOf(status) < 0) fail('Statut inconnu.'); if (status === 'suspendu' && !comment) fail('Motif de suspension obligatoire.'); p.status = status; p.statusLog = (p.statusLog || []).concat([Object.assign({ status: status, comment: comment || '' }, who(S))]); Y.audit(S, cid, 'Tiers · statut', t.code, status + (comment ? ' · ' + comment : '')); return t; };
/** Synthèse financière d'un tiers (facturé, encaissé, solde, échu) depuis la comptabilité : rien n'est ressaisi. */
F.summary = function (S, cid, t) {
  var d = Y.D(S, cid), today = S.meta.today, col = t.collective || (t.type === 'client' ? '4111' : '4011'), r = { invoiced: 0, paid: 0, balance: 0, overdue: 0, docs: 0, lastPayment: '', avgDelay: null, purchases: 0, purchasePaid: 0 };
  if (t.type === 'client') {
    var delays = [];
    d.docs.filter(function (x) { return x.tiersId === t.id && x.type === 'FA' && x.status !== 'draft'; }).forEach(function (x) {
      var ttc = Y.docTotals(S, cid, x).ttc, paid = Y.docPaid(x); r.invoiced += ttc; r.paid += paid; r.docs++;
      if (paid < ttc && x.due && x.due < today) r.overdue += ttc - paid;
      (x.payments || []).forEach(function (p) { if (p.date > r.lastPayment) r.lastPayment = p.date; });
      if (paid >= ttc && x.payments.length && x.due) delays.push(U.daysBetween(x.due, x.payments[x.payments.length - 1].date));
    });
    if (delays.length) r.avgDelay = Math.round(U.sum(delays) / delays.length);
  }
  Y.eachLine(S, cid, function (l) { if (l.tiersId !== t.id) return; if (t.type === 'fournisseur') { r.purchases += l.credit; r.purchasePaid += l.debit; if (l.credit && !l.letter && l.due && l.due < today) r.overdue += l.credit; } r.balance += l.debit - l.credit; }, { account: col.slice(0, 2) });
  if (t.type === 'fournisseur') { r.invoiced = r.purchases; r.paid = r.purchasePaid; r.balance = -r.balance; }
  return r;
};
/* --- import en masse --- */
F.TIERS_FIELDS = [['code', 'Code'], ['type', 'Type (client / fournisseur)', true], ['name', 'Raison sociale', true], ['tradeName', 'Nom commercial'], ['legalForm', 'Forme juridique'], ['niu', 'NIU'], ['rccm', 'RCCM'], ['category', 'Catégorie'], ['phone', 'Téléphone'], ['email', 'E-mail'], ['city', 'Ville'], ['district', 'Quartier'], ['address', 'Adresse'], ['bp', 'Boîte postale'], ['terms', 'Délai de paiement (jours)'], ['creditLimit', 'Plafond de crédit'], ['contact', 'Contact principal'], ['contactRole', 'Fonction du contact'], ['whatsapp', 'WhatsApp'], ['bank', 'Banque'], ['account', 'N° de compte / RIB'], ['momo', 'N° Mobile Money'], ['payModes', 'Modes de paiement (virement, momo, om)']];
var SYN = { name: ['raison sociale', 'nom', 'societe', 'entreprise', 'company', 'denomination'], niu: ['niu', 'numero contribuable', 'n contribuable', 'nif'], phone: ['telephone', 'tel', 'mobile', 'phone'], email: ['email', 'e mail', 'mail', 'courriel'], city: ['ville', 'localite'], type: ['type', 'nature'], terms: ['delai', 'delai de paiement', 'echeance'], account: ['rib', 'iban', 'compte', 'numero de compte'], contact: ['contact', 'interlocuteur'] };
F.mapColumns = function (header) {
  var keys = header.map(norm), map = {}, used = {};
  F.TIERS_FIELDS.forEach(function (f) { var c = [norm(f[0]), norm(f[1]), norm(String(f[1]).replace(/\(.*?\)/g, ''))].concat(SYN[f[0]] || []); var i = keys.findIndex(function (k, j) { return !used[j] && c.indexOf(k) > -1; }); map[f[0]] = i; if (i > -1) used[i] = 1; });
  return map;
};
F.template = function () { return [F.TIERS_FIELDS.map(function (f) { return f[1]; }), ['', 'client', 'Hôtel Les Cocotiers SARL', 'Les Cocotiers', 'SARL', 'M092300000001A', 'RC/KRI/2019/B/0042', 'Hôtellerie & restauration', '+237 6 00 00 10 01', 'reservation@cocotiers-exemple.cm', 'Kribi', 'Centre', 'Route de la plage', 'BP 112', 30, 5000000, 'Mme ESSAMA', 'Directrice', '+237 6 00 00 10 01', '', '', '', 'virement, om'], ['', 'fournisseur', 'Imprimerie du Wouri SA', '', 'SA', 'M012100000002B', 'RC/DLA/2012/B/1200', 'Communication & événementiel', '+237 6 00 00 20 02', 'devis@imprimerie-wouri-exemple.cm', 'Douala', 'Akwa', 'Rue Joss', 'BP 3300', 30, '', 'M. ETOUNDI', 'Commercial', '', 'Banque exemple', 'CM21 00000 00000 00000000000 00', '', 'virement']]; };
F.analyzeImport = function (S, cid, rows, map, opts) {
  opts = opts || {}; var out = { rows: [], ok: 0, errors: 0, duplicates: 0, updates: 0 }, seen = {};
  rows.slice(1).forEach(function (r, i) {
    if (!r.some(function (c) { return String(c).trim(); })) return;
    var v = {}; Object.keys(map).forEach(function (k) { if (map[k] > -1) v[k] = String(r[map[k]] == null ? '' : r[map[k]]).trim(); });
    v.type = /fourn|suppl/i.test(v.type || '') ? 'fournisseur' : (/client|cust/i.test(v.type || '') ? 'client' : (opts.type || ''));
    var errs = [], warns = [];
    if (!v.name) errs.push('Raison sociale manquante.'); if (!v.type) errs.push('Type (client ou fournisseur) manquant.');
    if (v.niu && !/^[A-Z0-9]{8,20}$/i.test(v.niu)) errs.push('NIU invalide.');
    if (v.email && !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(v.email)) errs.push('E-mail invalide.');
    if (v.terms && isNaN(+v.terms)) errs.push('Délai de paiement non numérique.');
    var key = norm(v.name) + '|' + (v.niu || '').toUpperCase();
    if (seen[norm(v.name)] || (v.niu && seen[v.niu.toUpperCase()])) { errs.push('Doublon dans le fichier (ligne ' + (seen[norm(v.name)] || seen[v.niu.toUpperCase()]) + ').'); }
    seen[norm(v.name)] = i + 2; if (v.niu) seen[v.niu.toUpperCase()] = i + 2;
    var dup = v.name ? F.findDuplicates(S, cid, v) : [], action = 'création';
    if (dup.length) { if (opts.updateExisting && dup[0].why === 'même NIU') { action = 'mise à jour'; v.id = dup[0].t.id; out.updates++; } else { warns.push('Déjà présent : ' + dup[0].t.code + ' ' + dup[0].t.name + ' (' + dup[0].why + ').'); out.duplicates++; if (!opts.importDuplicates) errs.push('Doublon avec le référentiel : ignoré.'); } }
    if (v.type === 'fournisseur' && (v.account || v.momo)) warns.push('Coordonnées bancaires importées « à vérifier » : aucun paiement avant confirmation par rappel.');
    if (!v.niu) warns.push('NIU manquant.');
    if (errs.length) out.errors++; else out.ok++;
    out.rows.push({ line: i + 2, v: v, errors: errs, warnings: warns, action: action, key: key });
  });
  return out;
};
F.importTiers = function (S, cid, analysis, opts) {
  need(S, 'fin.vendor'); opts = opts || {}; var n = 0;
  analysis.rows.forEach(function (r) {
    if (r.errors.length) return; var v = r.v;
    var t = F.saveTiers(S, cid, Object.assign({}, v, { payModes: (v.payModes || '').split(/[,;]\s*/).map(function (x) { x = norm(x); return /vir|bank|banc/.test(x) ? 'bank' : (/orange|om/.test(x) ? 'om' : (/mtn|momo|mobile/.test(x) ? 'momo' : (/esp|cash/.test(x) ? 'cash' : ''))); }).filter(Boolean) }), { force: true });
    var p = F.profile(t); if (t.type === 'fournisseur' && r.action === 'création') p.status = 'a_valider';
    if (v.contact) F.addContact(S, cid, t.id, { name: v.contact, role: v.contactRole, phone: v.phone, whatsapp: v.whatsapp, email: v.email, main: true });
    if (v.account || v.momo) p.banks.push({ id: U.uid('bk'), bank: v.bank || (v.momo ? 'Mobile Money' : ''), holder: v.name, account: v.account || '', momo: v.momo || '', op: '', status: 'a_confirmer', main: !p.banks.length, source: 'import ' + (opts.file || ''), at: new Date().toISOString() });
    n++;
  });
  Y.audit(S, cid, 'Tiers · import', opts.file || 'fichier', n + ' fiche(s)'); return n;
};

/* ======================================================================= vigilance et usurpation d'identité */
F.WATCH_KINDS = { momo: 'Numéro Mobile Money', iban: 'Compte bancaire / RIB', phone: 'Téléphone', email: 'Adresse e-mail', domain: 'Nom de domaine', name: 'Nom' };
F.addWatch = function (S, cid, w) {
  need(S, 'fin.verify'); if (!F.WATCH_KINDS[w.kind]) fail('Type inconnu.'); if (!w.value) fail('Valeur obligatoire.'); if (!w.reason) fail('Motif obligatoire.');
  var d = F.D(S, cid), key = watchKey(w.kind, w.value);
  if (d.watch.some(function (x) { return x.key === key; })) fail('Déjà dans la liste de vigilance.');
  var r = Object.assign({ id: U.uid('wl'), kind: w.kind, value: w.value, key: key, reason: w.reason, source: w.source || 'Signalement interne' }, who(S)); d.watch.unshift(r);
  Y.audit(S, cid, 'Vigilance · ajout', F.WATCH_KINDS[w.kind], w.value + ' · ' + w.reason); return r;
};
function watchKey(kind, v) { return kind + ':' + (kind === 'momo' || kind === 'phone' ? phoneKey(v) : (kind === 'iban' ? digits(v) : norm(v))); }
F.checkWatch = function (S, cid, kind, value) { if (!value) return null; var k = watchKey(kind, value), alt = kind === 'momo' ? watchKey('phone', value) : (kind === 'phone' ? watchKey('momo', value) : ''); return F.D(S, cid).watch.find(function (x) { return x.key === k || x.key === alt; }) || null; };
/** Interrogation du nom du titulaire chez l'opérateur (« name enquiry ») : simulée par l'annuaire de démonstration ; API opérateur en production. */
F.nameEnquiry = function (S, cid, op, number) { var e = F.D(S, cid).operatorDir[phoneKey(number)]; return e ? { found: true, name: e.name, op: e.op, since: e.since } : { found: false, name: '', op: op || '' }; };
F.holderMatch = function (S, cid, t, holderName) {
  if (!holderName) return { score: null, text: 'Titulaire inconnu' };
  var names = [t.name, F.profile(t).tradeName].concat(F.profile(t).contacts.map(function (c) { return c.name; })).filter(Boolean);
  var best = Math.max.apply(null, names.map(function (n) { var a = norm(n).split(' '), b = norm(holderName).split(' '); var common = a.filter(function (w) { return w.length > 2 && b.indexOf(w) > -1; }).length; return Math.max(F.similar(n, holderName), common ? Math.min(1, common / Math.min(a.length, b.length) + 0.2) : 0); }));
  return { score: Math.round(best * 100), text: best >= 0.75 ? 'Le titulaire correspond au fournisseur' : (best >= 0.45 ? 'Correspondance partielle du titulaire' : 'Le titulaire NE correspond PAS au fournisseur') };
};
/** Comptes partagés : même numéro chez un salarié (fournisseur fictif) ou chez un autre tiers. */
F.sharedAccount = function (S, cid, tiersId, account, momo) {
  var out = [], d = Y.D(S, cid);
  if (momo) { (d.paie ? d.paie.employees : []).forEach(function (e) { if (e.momo && phoneKey(e.momo) === phoneKey(momo)) out.push('Numéro identique à celui du salarié ' + e.matricule + ' ' + (e.nom || '').toUpperCase() + ' ' + (e.prenoms || '')); }); }
  d.tiers.forEach(function (t) { if (t.id === tiersId || !t.fin) return; t.fin.banks.forEach(function (b) { if ((momo && b.momo && phoneKey(b.momo) === phoneKey(momo)) || (account && b.account && digits(b.account) === digits(account))) out.push('Mêmes coordonnées que le tiers ' + t.code + ' ' + t.name); }); });
  return out;
};
/** Demande de changement de coordonnées : jamais appliquée directement, quarantaine + rappel au numéro du référentiel. */
F.CHANGE_STATUS = { quarantaine: ['En quarantaine · rappel à faire', 'warn'], confirme: ['Confirmé par rappel', 'ok'], refuse: ['Refusé · tentative de fraude', 'bad'] };
F.requestBankChange = function (S, cid, tiersId, c) {
  need(S, 'fin.vendor'); var d = F.D(S, cid), t = Y.tiers(S, cid, tiersId); if (!t) fail('Tiers introuvable.');
  if (!c.account && !c.momo) fail('Nouveau compte ou numéro Mobile Money obligatoire.');
  if (!c.source) fail('Précisez comment la demande est arrivée (e-mail, WhatsApp, courrier…).');
  var p = F.profile(t), checks = [];
  var w1 = F.checkWatch(S, cid, 'momo', c.momo), w2 = F.checkWatch(S, cid, 'iban', c.account), w3 = c.senderEmail ? F.checkWatch(S, cid, 'domain', c.senderEmail.split('@')[1] || '') : null;
  if (w1 || w2 || w3) checks.push({ level: 'bad', text: 'Coordonnées ou expéditeur dans la liste de vigilance : ' + (w1 || w2 || w3).reason });
  if (c.senderEmail && p.emailDomain && (c.senderEmail.split('@')[1] || '').toLowerCase() !== p.emailDomain) checks.push({ level: 'bad', text: 'E-mail envoyé depuis « ' + c.senderEmail.split('@')[1] + ' » au lieu du domaine connu « ' + p.emailDomain + ' »' + (F.similar(c.senderEmail.split('@')[1], p.emailDomain) > 0.7 ? ' (domaine sosie)' : '') });
  if (c.senderPhone && !p.contacts.some(function (x) { return phoneKey(x.phone) === phoneKey(c.senderPhone) || phoneKey(x.whatsapp) === phoneKey(c.senderPhone); })) checks.push({ level: 'warn', text: 'Message reçu d’un numéro inconnu du référentiel (' + c.senderPhone + ')' });
  var ne = c.momo ? F.nameEnquiry(S, cid, c.op, c.momo) : null, hm = ne && ne.found ? F.holderMatch(S, cid, t, ne.name) : null;
  if (ne) checks.push(ne.found ? { level: hm.score >= 75 ? 'ok' : 'bad', text: 'Titulaire chez l’opérateur : « ' + ne.name + ' » · ' + hm.text } : { level: 'warn', text: 'Titulaire non vérifiable chez l’opérateur' });
  F.sharedAccount(S, cid, t.id, c.account, c.momo).forEach(function (x) { checks.push({ level: 'bad', text: x }); });
  if (/urgent|immédiat|aujourd|bloqu|nouveau compte|audit|changement de banque/i.test(c.message || '')) checks.push({ level: 'warn', text: 'Message pressant ou justification inhabituelle : schéma classique de fraude au faux fournisseur' });
  d.seq.change++;
  var r = Object.assign({ id: U.uid('chg'), ref: 'CHG-' + U.pad(d.seq.change, 4), tiersId: t.id, bank: c.bank || '', holder: c.holder || (ne && ne.name) || '', account: c.account || '', momo: c.momo || '', op: c.op || '', source: c.source, senderEmail: c.senderEmail || '', senderPhone: c.senderPhone || '', message: c.message || '', checks: checks, status: 'quarantaine', requestedBy: who(S).by, requestedById: who(S).byId, at: new Date().toISOString() });
  d.changes.unshift(r); Y.audit(S, cid, 'Tiers · changement de coordonnées demandé', t.code, r.ref + ' · ' + (r.account || r.momo)); return r;
};
F.confirmBankChange = function (S, cid, id, v) {
  need(S, 'fin.verify'); var d = F.D(S, cid), r = d.changes.find(function (x) { return x.id === id; }); if (!r) fail('Demande introuvable.'); if (r.status !== 'quarantaine') fail('Demande déjà traitée.');
  var t = Y.tiers(S, cid, r.tiersId), p = F.profile(t);
  if (!F._bypass && r.requestedById && r.requestedById === (S.meta.currentUser || {}).id) fail('Séparation des tâches : la personne qui a saisi la demande ne peut pas la confirmer.');
  if (!v.comment) fail('Compte rendu du rappel obligatoire.');
  if (v.result === 'confirme') {
    var c = p.contacts.find(function (x) { return x.id === v.contactId; });
    if (!c) fail('Le rappel doit être fait à un contact déjà enregistré dans le référentiel, jamais au numéro indiqué dans la demande.');
    if (r.senderPhone && phoneKey(c.phone) === phoneKey(r.senderPhone) && !p.contacts.some(function (x) { return x.id !== c.id && phoneKey(x.phone) === phoneKey(r.senderPhone); })) { /* contact connu de longue date : accepté */ }
    if (r.checks.some(function (x) { return x.level === 'bad'; }) && !v.override) fail('Des contrôles sont au rouge : cochez « J’ai levé chaque alerte avec le fournisseur » après vérification.');
    p.banks.forEach(function (b) { b.main = false; });
    var avail = new Date(Date.now() + d.settings.coolingHours * 3600000).toISOString();
    p.banks.unshift({ id: U.uid('bk'), bank: r.bank, holder: r.holder, account: r.account, momo: r.momo, op: r.op, status: 'verifie', main: true, verifiedBy: who(S).by, verifiedAt: new Date().toISOString(), callback: { contact: c.name, phone: c.phone, comment: v.comment }, availableFrom: avail, firstPaymentCap: d.settings.firstPaymentCap, changeRef: r.ref });
    r.status = 'confirme';
  } else {
    r.status = 'refuse';
    if (r.momo && !F.checkWatch(S, cid, 'momo', r.momo)) d.watch.unshift(Object.assign({ id: U.uid('wl'), kind: 'momo', value: r.momo, key: watchKey('momo', r.momo), reason: 'Usurpation de l’identité de ' + t.name + ' (' + r.ref + ')', source: 'Changement de coordonnées refusé' }, who(S)));
    if (r.account && !F.checkWatch(S, cid, 'iban', r.account)) d.watch.unshift(Object.assign({ id: U.uid('wl'), kind: 'iban', value: r.account, key: watchKey('iban', r.account), reason: 'Usurpation de l’identité de ' + t.name + ' (' + r.ref + ')', source: 'Changement de coordonnées refusé' }, who(S)));
    if (r.senderEmail) { var dom = r.senderEmail.split('@')[1]; if (dom && !F.checkWatch(S, cid, 'domain', dom)) d.watch.unshift(Object.assign({ id: U.uid('wl'), kind: 'domain', value: dom, key: watchKey('domain', dom), reason: 'Domaine sosie utilisé pour usurper ' + t.name, source: r.ref }, who(S))); }
    d.security.unshift(Object.assign({ type: 'usurpation', text: 'Tentative d’usurpation de ' + t.name + ' bloquée (' + r.ref + ')' }, who(S)));
  }
  r.decision = Object.assign({ result: v.result, comment: v.comment, contactId: v.contactId || '' }, who(S));
  Y.audit(S, cid, 'Tiers · changement de coordonnées ' + (r.status === 'confirme' ? 'confirmé' : 'refusé'), t.code, r.ref + ' · ' + v.comment);
  return r;
};
F.mainBank = function (t) { var p = F.profile(t); return p.banks.find(function (b) { return b.main; }) || p.banks[0] || null; };

/* ======================================================================= facturation électronique */
F.ZONES = [
  { k: 'ref', n: 1, label: 'Référence, dates et version', locked: true, help: 'Numéro unique séquentiel, date d’émission, échéance, référence client' },
  { k: 'client', n: 2, label: 'Client', locked: true, help: 'Raison sociale, adresse, NIU (B2B)' },
  { k: 'issuer', n: 3, label: 'Émetteur', locked: true, help: 'Logo, raison sociale, forme juridique, capital, NIU, RCCM, adresse, contacts' },
  { k: 'lines', n: 4, label: 'Lignes de facturation', locked: true, help: 'Désignation, quantité, prix unitaire HT, remise, taux et montant de taxe' },
  { k: 'groups', n: 5, label: 'Groupes d’articles', locked: false, help: 'Regroupement facultatif par lot ou par projet' },
  { k: 'totals', n: 6, label: 'Totaux, acomptes et net à payer', locked: true, help: 'Total HT, détail des taxes, TTC, acomptes déduits, net à payer' },
  { k: 'pay', n: 7, label: 'Paiement', locked: false, help: 'Coordonnées bancaires, Mobile Money, lien de paiement et QR code' },
  { k: 'legal', n: 8, label: 'Pied de page légal', locked: true, help: 'Pénalités de retard, mentions de certification fiscale, conditions' }
];
F.TEMPLATE_STYLES = { classique: 'Classique (bandeau de couleur)', epure: 'Épuré (filets fins)', compact: 'Compact (une page dense)' };
F.defaultTemplate = function (co) { return { id: 'tpl_myyiel', name: 'Modèle myyiel', base: 'myyiel', style: 'classique', color: co && co.color || '#141A3A', accent: '#F25C2A', font: 'Plus Jakarta Sans', logo: 'gauche', zones: { groups: true, pay: true }, showQr: true, footer: 'Tout retard de paiement entraîne des pénalités au taux légal.', default: true, createdAt: '2026-01-02T08:00:00.000Z', by: 'myyiel' }; };
F.templates = function (S, cid) { var d = F.D(S, cid); if (!d.templates.length) d.templates.push(F.defaultTemplate(Y.company(S, cid))); return d.templates; };
/** Reconnaissance des zones d'un modèle importé : proposition à confirmer (pas de prétention d'exactitude). */
F.recognize = function (fileName) {
  var ext = (String(fileName).split('.').pop() || '').toLowerCase(), ok = ['pdf', 'docx', 'doc', 'png', 'jpg', 'jpeg', 'odt'].indexOf(ext) > -1;
  if (!ok) fail('Format non pris en charge : PDF, Word, ODT ou image.');
  var seed = U.fnv(fileName); return F.ZONES.map(function (z, i) { var conf = 62 + (parseInt(seed.slice(i % 6, i % 6 + 2), 16) % 36); return { k: z.k, n: z.n, label: z.label, detected: !(z.k === 'groups' && conf < 70), confidence: conf }; });
};
F.saveTemplate = function (S, cid, t) {
  need(S, 'fin.settings'); var d = F.D(S, cid), list = F.templates(S, cid);
  if (!t.name) fail('Nom du modèle obligatoire.');
  var rec = list.find(function (x) { return x.id === t.id; }) || { id: U.uid('tpl'), createdAt: new Date().toISOString(), by: who(S).by };
  Object.assign(rec, { name: t.name, base: t.base || rec.base || 'import', fileName: t.fileName || rec.fileName || '', style: t.style || 'classique', color: t.color || '#141A3A', accent: t.accent || '#F25C2A', logo: t.logo || 'gauche', footer: t.footer || '', showQr: t.showQr !== false, zones: { groups: !!(t.zones && t.zones.groups), pay: !(t.zones && t.zones.pay === false) } });
  if (t.default) list.forEach(function (x) { x.default = false; }), rec.default = true;
  if (list.indexOf(rec) < 0) list.push(rec);
  Y.audit(S, cid, 'Facturation · modèle', rec.name, rec.style); void d; return rec;
};
F.MENTIONS = [
  ['issuer_name', 'Raison sociale et forme juridique de l’émetteur', 'issuer'], ['issuer_niu', 'NIU de l’émetteur', 'issuer'], ['issuer_rccm', 'RCCM de l’émetteur', 'issuer'], ['issuer_addr', 'Adresse et coordonnées de l’émetteur', 'issuer'],
  ['client_name', 'Identité du client', 'client'], ['client_niu', 'NIU du client (client assujetti)', 'client'], ['num', 'Numéro de facture unique et séquentiel', 'ref'], ['date', 'Date d’émission', 'ref'], ['due', 'Date d’échéance', 'ref'],
  ['lines', 'Désignation, quantité, prix unitaire', 'lines'], ['tax', 'Détail des taxes (taux et montant)', 'totals'], ['totals', 'Totaux HT, taxes et TTC', 'totals'], ['pay', 'Modalités de paiement', 'pay'], ['penalties', 'Pénalités de retard', 'legal'], ['certif', 'Mention et données de certification fiscale', 'legal']
];
F.checkMentions = function (S, cid, doc) {
  var co = Y.company(S, cid) || {}, t = Y.tiers(S, cid, doc.tiersId) || {}, tot = Y.docTotals(S, cid, doc), set = F.D(S, cid).settings.compliance, tpl = F.templates(S, cid).find(function (x) { return x.id === (F.meta(S, cid, doc.id).template || ''); }) || F.templates(S, cid).find(function (x) { return x.default; });
  var real = function (v) { return v && !/\[.*\]/.test(v); };
  var ok = {
    issuer_name: real(co.name) && !!co.legalForm, issuer_niu: real(co.niu), issuer_rccm: real(co.rccm), issuer_addr: real(co.address) || real(co.city), client_name: !!t.name, client_niu: !!t.niu || t.regime === 'Non assujetti',
    num: !!doc.num, date: !!doc.date, due: !!doc.due, lines: (doc.lines || []).length > 0 && doc.lines.every(function (l) { return l.label && +l.qty > 0; }), tax: Object.keys(tot.byTax).length > 0, totals: tot.ttc > 0,
    pay: !!(doc.pay && (doc.pay.momo || doc.pay.om || doc.pay.bank)), penalties: !!(tpl && tpl.footer), certif: set.mode === 'fiscale' && !!set.homologation
  };
  var detail = { issuer_niu: 'Renseignez le NIU dans Paramètres › Société', issuer_rccm: 'Renseignez le RCCM dans Paramètres › Société', client_niu: 'NIU du client absent de sa fiche', certif: set.mode === 'fiscale' ? 'Solution homologuée non renseignée' : 'Facture commerciale : certification fiscale non activée' };
  var list = F.MENTIONS.map(function (m) { return { k: m[0], label: m[1], zone: m[2], ok: !!ok[m[0]], detail: ok[m[0]] ? '' : (detail[m[0]] || 'À compléter'), blocking: m[0] !== 'certif' && m[0] !== 'client_niu' }; });
  return { list: list, missing: list.filter(function (x) { return !x.ok; }), level: list.every(function (x) { return x.ok; }) ? 'fiscale' : (list.filter(function (x) { return x.blocking && !x.ok; }).length ? 'incomplete' : 'commerciale') };
};
F.LEVELS = { fiscale: ['Fiscalement conforme', 'ok'], commerciale: ['Facture commerciale', 'info'], incomplete: ['Mentions à compléter', 'warn'] };
F.meta = function (S, cid, docId) { var d = F.D(S, cid); return d.meta[docId] || (d.meta[docId] = { events: [], hash: '', template: '', sent: [], viewedAt: '', link: '' }); };
F.event = function (S, cid, docId, type, text, extra) { var m = F.meta(S, cid, docId); m.events.push(Object.assign({ type: type, text: text || '', at: (extra && extra.at) || new Date().toISOString(), by: (S.meta.currentUser || {}).name || 'Système' }, extra || {})); return m; };
function canonical(S, cid, doc) { var t = Y.docTotals(S, cid, doc); return [doc.num, doc.date, doc.due, doc.tiersId, (doc.lines || []).map(function (l) { return [l.label, l.qty, l.price, l.discount || 0, l.taxCode].join('~'); }).join('|'), t.ht, t.tva, t.ttc].join('#'); }
/** Empreinte d'archivage calculée à l'émission ; toute modification ultérieure est détectée. */
F.seal = function (S, cid, doc) { var m = F.meta(S, cid, doc.id); if (!m.hash) { m.hash = U.fnv(canonical(S, cid, doc)) + U.fnv(doc.id + canonical(S, cid, doc)); m.sealedAt = new Date().toISOString(); } return m.hash; };
F.verifySeal = function (S, cid, doc) { var m = F.meta(S, cid, doc.id); if (!m.hash) return null; return m.hash === U.fnv(canonical(S, cid, doc)) + U.fnv(doc.id + canonical(S, cid, doc)); };
F.STAGES = [['emise', 'Émise'], ['envoyee', 'Envoyée'], ['vue', 'Consultée'], ['paiement', 'Paiement initié'], ['payee', 'Payée']];
F.stage = function (S, cid, doc) {
  if (doc.status === 'draft') return 'brouillon';
  var m = F.meta(S, cid, doc.id), st = Y.docStatus(S, cid, doc);
  if (st.key === 'paid') return 'payee';
  if (F.D(S, cid).txs.some(function (x) { return x.docId === doc.id && x.status === 'en_attente'; }) || st.key === 'partial' || (st.key === 'late' && Y.docPaid(doc))) return 'paiement';
  if (m.viewedAt) return 'vue'; if (m.sent.length) return 'envoyee'; return 'emise';
};
F.send = function (S, cid, docId, channels) {
  need(S, 'invoice'); var doc = Y.doc(S, cid, docId); if (!doc || doc.status === 'draft') fail('Facture émise introuvable.');
  var c = F.checkMentions(S, cid, doc); if (c.level === 'incomplete' && !F._bypass) fail('Mentions obligatoires manquantes : ' + c.missing.filter(function (x) { return x.blocking; }).map(function (x) { return x.label; }).join(', ') + '.');
  F.seal(S, cid, doc); var l = F.linkFor(S, cid, docId, { create: true }), m = F.meta(S, cid, docId);
  (channels || ['whatsapp']).forEach(function (ch) { m.sent.push({ channel: ch, at: new Date().toISOString(), by: who(S).by }); });
  F.event(S, cid, docId, 'envoyee', 'Envoyée par ' + (channels || ['whatsapp']).join(', ') + ' avec le lien de paiement');
  return { link: l, message: F.message(S, cid, doc, l) };
};
F.message = function (S, cid, doc, l) {
  var t = Y.tiers(S, cid, doc.tiersId), co = Y.company(S, cid), rest = Y.docTotals(S, cid, doc).ttc - Y.docPaid(doc);
  return 'Bonjour ' + (F.profile(t).contacts[0] ? F.profile(t).contacts[0].name : t.name) + ',\n' + co.name + ' vous adresse la facture ' + doc.num + ' : ' + U.fmt(rest) + ' XAF, échéance ' + U.frDate(doc.due) + '.\nConsulter et payer (MTN MoMo, Orange Money, virement) : ' + l.url + '\nCode de vérification : ' + l.code + '. ' + co.name + ' ne vous demandera jamais de payer sur un numéro personnel.';
};

/* ======================================================================= encaissements : liens, transactions, confirmations */
F.linkFor = function (S, cid, docId, opts) {
  opts = opts || {}; var d = F.D(S, cid), l = d.links.find(function (x) { return x.docId === docId && x.status === 'actif'; });
  if (l || !opts.create) return l || null;
  var doc = Y.doc(S, cid, docId); d.seq.link++;
  var tok = 'P' + U.fnv(docId + d.seq.link + cid).toUpperCase();
  l = { id: U.uid('lk'), token: tok, docId: docId, url: 'https://pay.myyiel.com/f/' + tok, code: U.fnv(tok + 'code').slice(0, 6).toUpperCase(), createdAt: opts.at || new Date().toISOString(), expires: U.addDays((opts.at || new Date().toISOString()).slice(0, 10), d.settings.linkDays), status: 'actif', methods: F.methodsFor(S, cid, doc), views: 0 };
  d.links.unshift(l); F.meta(S, cid, docId).link = l.id; F.event(S, cid, docId, 'lien', 'Lien de paiement créé', { at: l.createdAt }); return l;
};
F.METHODS = { momo: { label: 'MTN Mobile Money', provider: 'mtn', account: 'momo', fee: 1 }, om: { label: 'Orange Money', provider: 'orange', account: 'om', fee: 1 }, bank: { label: 'Virement bancaire', provider: 'bank', account: 'bank', fee: 0 }, card: { label: 'Carte bancaire', provider: 'card', account: 'bank', fee: 2.5 } };
F.methodsFor = function (S, cid, doc) { var pr = F.D(S, cid).settings.providers; return Object.keys(F.METHODS).filter(function (k) { var m = F.METHODS[k]; return (k === 'card' || (doc.pay || {})[k]) && pr[m.provider] && pr[m.provider].status !== 'indisponible'; }); };
F.view = function (S, cid, token, at) { var l = F.D(S, cid).links.find(function (x) { return x.token === token; }); if (!l) fail('Lien inconnu.'); l.views++; var m = F.meta(S, cid, l.docId); if (!m.viewedAt) { m.viewedAt = at || new Date().toISOString(); F.event(S, cid, l.docId, 'vue', 'Facture consultée par le client', { at: m.viewedAt }); } return l; };
F.TX_STATUS = { en_attente: ['En attente du prestataire', 'warn'], confirmee: ['Confirmée par le prestataire', 'ok'], echouee: ['Échouée', 'bad'], ecart: ['Écart de montant · à examiner', 'warn'], rejetee: ['Notification rejetée (signature invalide)', 'bad'] };
/** Le client initie le paiement depuis la page de la facture. */
F.initiate = function (S, cid, token, p) {
  var d = F.D(S, cid), l = d.links.find(function (x) { return x.token === token; }); if (!l || l.status !== 'actif') fail('Lien de paiement inactif.');
  var doc = Y.doc(S, cid, l.docId), rest = Y.docTotals(S, cid, doc).ttc - Y.docPaid(doc), m = F.METHODS[p.method];
  if (!m || l.methods.indexOf(p.method) < 0) fail('Moyen de paiement non proposé pour cette facture.');
  if (rest <= 0) fail('Facture déjà réglée.');
  var amt = U.round(p.amount || rest); if (amt <= 0 || amt > rest) fail('Montant invalide (reste dû : ' + U.fmt(rest) + ').'); if (amt < rest && !d.settings.allowPartial) fail('Paiement partiel non autorisé.');
  if ((p.method === 'momo' || p.method === 'om') && !/^\+?\d[\d ]{7,20}$/.test(p.phone || '')) fail('Numéro de téléphone du payeur invalide.');
  d.seq.tx++;
  var tx = { id: U.uid('ptx'), ref: 'TX-' + U.pad(d.seq.tx, 6), docId: doc.id, linkId: l.id, method: p.method, provider: m.provider, providerRef: (p.method === 'om' ? 'MP' : (p.method === 'momo' ? '' : 'BQ')) + U.fnv(doc.id + d.seq.tx + (p.at || Date.now())).toUpperCase().slice(0, 10), amount: amt, fee: U.round(amt * m.fee / 100), phone: p.phone || '', status: 'en_attente', at: p.at || new Date().toISOString(), events: [] };
  if (p.method === 'momo') tx.providerRef = String(parseInt(U.fnv(tx.ref + doc.id), 16)).slice(0, 10).padStart(10, '7');
  d.txs.unshift(tx); F.event(S, cid, doc.id, 'paiement', m.label + ' initié · ' + U.fmt(amt) + ' XAF', { at: tx.at });
  return tx;
};
F.sign = function (S, cid, provider, payload) { var pr = F.D(S, cid).settings.providers[provider]; return U.fnv((pr && pr.secret || '') + '|' + payload.providerRef + '|' + payload.amount + '|' + payload.status); };
/** Notification du prestataire (webhook) : signature vérifiée, idempotence par référence, montant contrôlé, puis seulement encaissement + écriture. */
F.callback = function (S, cid, provider, payload) {
  var d = F.D(S, cid), tx = d.txs.find(function (x) { return x.providerRef === payload.providerRef && x.provider === provider; });
  var log = function (type, text) { d.security.unshift({ type: type, text: text, at: new Date().toISOString(), by: 'Passerelle ' + provider }); };
  if (!tx) { log('webhook_inconnu', 'Notification pour une transaction inconnue ' + payload.providerRef); fail('Transaction inconnue.'); }
  if (payload.signature !== F.sign(S, cid, provider, payload)) { tx.events.push({ at: new Date().toISOString(), text: 'Notification rejetée : signature invalide' }); log('signature', 'Notification falsifiée rejetée pour ' + tx.ref + ' (' + payload.providerRef + ')'); fail('Signature de la notification invalide : rejetée.'); }
  if (d.processed[provider + ':' + payload.providerRef]) { tx.events.push({ at: new Date().toISOString(), text: 'Notification en double ignorée (déjà comptabilisée)' }); return { tx: tx, duplicate: true }; }
  if (payload.status !== 'SUCCESSFUL') { tx.status = 'echouee'; tx.events.push({ at: new Date().toISOString(), text: 'Échec signalé : ' + (payload.reason || payload.status) }); F.event(S, cid, tx.docId, 'echec', 'Paiement échoué : ' + (payload.reason || payload.status)); return { tx: tx }; }
  if (U.round(payload.amount) !== tx.amount) { tx.status = 'ecart'; tx.events.push({ at: new Date().toISOString(), text: 'Montant notifié ' + U.fmt(payload.amount) + ' ≠ montant demandé ' + U.fmt(tx.amount) }); return { tx: tx }; }
  var save = S.meta.currentUser; S.meta.currentUser = { id: 'sys-pay', name: 'Passerelle ' + (F.METHODS[tx.method] || {}).label, role: 'owner' };
  try { var e = Y.registerPayment(S, cid, tx.docId, { amount: tx.amount, method: F.METHODS[tx.method].account, fees: tx.fee, date: (payload.at || new Date().toISOString()).slice(0, 10), extRef: payload.providerRef }); tx.entry = e.num; }
  finally { S.meta.currentUser = save; }
  d.processed[provider + ':' + payload.providerRef] = tx.entry; tx.status = 'confirmee'; tx.confirmedAt = payload.at || new Date().toISOString();
  tx.events.push({ at: tx.confirmedAt, text: 'Confirmée par ' + provider + ' · écriture ' + tx.entry });
  var doc = Y.doc(S, cid, tx.docId); F.event(S, cid, doc.id, Y.docStatus(S, cid, doc).key === 'paid' ? 'payee' : 'partielle', 'Paiement confirmé par le prestataire · ' + U.fmt(tx.amount) + ' XAF · ' + tx.entry, { at: tx.confirmedAt });
  if (Y.docStatus(S, cid, doc).key === 'paid') { var l = d.links.find(function (x) { return x.id === tx.linkId; }); if (l) l.status = 'solde'; }
  return { tx: tx, entry: tx.entry };
};
/** Démonstration : le prestataire envoie sa notification signée (en production : appel entrant du prestataire). */
F.simulateProvider = function (S, cid, txId, outcome) {
  var tx = F.D(S, cid).txs.find(function (x) { return x.id === txId; }); if (!tx) fail('Transaction introuvable.');
  var p = { providerRef: tx.providerRef, amount: tx.amount, status: outcome === 'fail' ? 'FAILED' : 'SUCCESSFUL', reason: outcome === 'fail' ? 'Solde insuffisant ou opération annulée par le payeur' : '', at: new Date().toISOString() };
  p.signature = outcome === 'forged' ? 'deadbeef' : F.sign(S, cid, tx.provider, p);
  return F.callback(S, cid, tx.provider, p);
};

/* ======================================================================= justificatifs déclarés (captures, SMS) */
F.PROOF_STATUS = { a_verifier: ['À vérifier sur le relevé', 'warn'], confirme: ['Confirmé par le relevé', 'ok'], suspect: ['Suspect', 'bad'], falsifie: ['Faux justificatif', 'bad'], rejete: ['Rejeté', 'bad'] };
F.REF_FORMATS = { momo: { re: /^\d{10,11}$/, text: '10 à 11 chiffres' }, om: { re: /^(MP|PP|CI|CO)\d{6}\.\d{4}\.[A-Z]\d{5}$|^MP[0-9A-F]{8,10}$/i, text: 'MP/PP/CI + date.heure + code (ex. PP261020.1430.A12345)' }, bank: { re: /^[A-Z0-9\-\/ ]{6,30}$/i, text: 'référence de virement de 6 à 30 caractères' } };
F.FAKE_SMS = [
  [/^(?!.*(mobilemoney|momo|orangemoney|orange money|mtn)).*$/i, 'Expéditeur ou marque de l’opérateur absente'],
  [/moble|mobil money|orang money|m\.t\.n|orange-money\b/i, 'Faute dans le nom de l’opérateur'],
  [/frais de d[ée]blocage|code de retrait|renvoyer|rembours|erreur de transfert|transfert par erreur/i, 'Demande de renvoi ou de « déblocage » : arnaque classique'],
  [/urgent|imm[ée]diatement|dans les \d+ ?min/i, 'Pression temporelle'],
  [/\+?237 ?6\d{2}[ \d]{6,}/, 'Le message contient un numéro personnel à rappeler']
];
F.analyzeProof = function (S, cid, p) {
  var d = F.D(S, cid), checks = [], add = function (level, text) { checks.push({ level: level, text: text }); };
  var doc = p.docId ? Y.doc(S, cid, p.docId) : null, rest = doc ? Y.docTotals(S, cid, doc).ttc - Y.docPaid(doc) : null, fmt = F.REF_FORMATS[p.method];
  if (!p.ref) add('bad', 'Aucune référence de transaction');
  else if (fmt && !fmt.re.test(String(p.ref).trim())) add('bad', 'Format de référence incompatible avec ' + (F.METHODS[p.method] || {}).label + ' (attendu : ' + fmt.text + ')');
  else add('ok', 'Format de référence plausible');
  var used = p.ref && (d.txs.some(function (x) { return x.providerRef === p.ref && x.status === 'confirmee' && x.docId !== p.docId; }) || Y.D(S, cid).docs.some(function (x) { return x.id !== p.docId && (x.payments || []).some(function (y) { return y.extRef && y.extRef === p.ref; }); }) || d.proofs.some(function (x) { return x.id !== p.id && x.ref === p.ref && x.status !== 'rejete'; }));
  if (used) add('bad', 'Référence déjà utilisée pour un autre paiement');
  var acc = (Y.PAY_METHODS[F.METHODS[p.method] ? F.METHODS[p.method].account : 'bank'] || {}).account;
  var line = Y.D(S, cid).bankTx.find(function (t) { var b = Y.bankAccount(S, cid, t.bankId); return t.amount > 0 && b && b.account === acc && ((p.ref && (t.ref === p.ref || (t.label + ' ' + t.ref).indexOf(p.ref) > -1)) || (t.amount === U.round(p.amount) && Math.abs(U.daysBetween(t.date, p.date || S.meta.today)) <= 3)); });
  var tx = p.ref && d.txs.find(function (x) { return x.providerRef === p.ref; });
  if (line) add('ok', 'Encaissement retrouvé sur le relevé ' + (Y.bankAccount(S, cid, line.bankId) || {}).label + ' le ' + U.frDate(line.date) + ' (' + U.fmt(line.amount) + ')');
  else if (tx && tx.status === 'confirmee') add('ok', 'Transaction confirmée par le prestataire');
  else add(p.method === 'bank' ? 'warn' : 'bad', 'Aucun encaissement correspondant chez l’opérateur ni sur le relevé à ce jour');
  if (p.date && p.date > S.meta.today) add('bad', 'Date postérieure à aujourd’hui');
  if (rest !== null && U.round(p.amount) > rest) add('warn', 'Montant supérieur au reste dû (' + U.fmt(rest) + ')');
  if (p.payee && F.similar(p.payee, Y.company(S, cid).name) < 0.6 && !/yiel/i.test(p.payee)) add('bad', 'Bénéficiaire indiqué sur la capture : « ' + p.payee + ' », pas votre société');
  if (p.text) F.FAKE_SMS.forEach(function (r) { if (r[0].test(p.text)) add('bad', r[1]); });
  if (p.text && /solde|balance/i.test(p.text) && !/\d/.test(p.text)) add('warn', 'Solde non chiffré');
  var bad = checks.filter(function (c) { return c.level === 'bad'; }).length;
  var verdict = line || (tx && tx.status === 'confirmee') ? 'confirmable' : (bad >= 2 || used ? 'falsifie' : (bad ? 'suspect' : 'a_verifier'));
  return { checks: checks, verdict: verdict, line: line || null };
};
F.declareProof = function (S, cid, p) {
  need(S, 'fin.collect'); var d = F.D(S, cid); if (!p.docId) fail('Facture obligatoire.'); if (!(U.round(p.amount) > 0)) fail('Montant obligatoire.');
  var rec = { id: U.uid('prf'), docId: p.docId, method: p.method || 'momo', ref: String(p.ref || '').trim(), amount: U.round(p.amount), date: p.date || S.meta.today, payer: p.payer || '', payee: p.payee || '', text: p.text || '', file: p.file || '', source: p.source || 'WhatsApp', at: p.at || new Date().toISOString(), by: who(S).by };
  var a = F.analyzeProof(S, cid, rec); rec.checks = a.checks; rec.status = a.verdict === 'falsifie' ? 'falsifie' : (a.verdict === 'suspect' ? 'suspect' : 'a_verifier'); rec.lineId = a.line ? a.line.id : '';
  d.proofs.unshift(rec); F.event(S, cid, p.docId, 'justificatif', 'Justificatif déclaré par le client (' + rec.source + ') · ' + F.PROOF_STATUS[rec.status][0], { at: rec.at });
  if (rec.status === 'falsifie') d.security.unshift({ type: 'faux_justificatif', text: 'Faux justificatif de paiement détecté sur ' + (Y.doc(S, cid, p.docId) || {}).num + ' (réf. ' + (rec.ref || '—') + ')', at: rec.at, by: rec.by });
  return rec;
};
/** Un justificatif ne devient un paiement que rapproché d'une ligne de relevé réelle. */
F.confirmProof = function (S, cid, id, txLineId) {
  need(S, 'fin.collect'); var d = F.D(S, cid), p = d.proofs.find(function (x) { return x.id === id; }); if (!p) fail('Justificatif introuvable.');
  if (['confirme', 'rejete'].indexOf(p.status) > -1) fail('Justificatif déjà traité.');
  var line = Y.D(S, cid).bankTx.find(function (t) { return t.id === (txLineId || p.lineId); }); if (!line) fail('Sélectionnez la ligne du relevé qui prouve l’encaissement : une capture d’écran ne suffit jamais.');
  if (line.status === 'matched') fail('Cette ligne de relevé est déjà rapprochée.');
  var b = Y.bankAccount(S, cid, line.bankId), method = Object.keys(Y.PAY_METHODS).find(function (k) { return Y.PAY_METHODS[k].account === b.account; }) || 'bank';
  var doc = Y.doc(S, cid, p.docId), rest = Y.docTotals(S, cid, doc).ttc - Y.docPaid(doc), gross = Math.min(rest, Math.max(line.amount, p.amount)), fees = gross - line.amount;
  if (fees < 0 || fees > gross * 0.03) { gross = Math.min(rest, line.amount); fees = 0; }
  var e = Y.registerPayment(S, cid, p.docId, { amount: gross, method: method, fees: fees, date: line.date, extRef: p.ref || line.ref });
  Y.reconcile(S, cid, line.id, e.id, 0);
  p.status = 'confirme'; p.entry = e.num; p.confirmedBy = who(S); F.event(S, cid, p.docId, 'payee', 'Justificatif confirmé par le relevé · ' + e.num);
  return e;
};
F.rejectProof = function (S, cid, id, reason, watch) {
  need(S, 'fin.collect'); var d = F.D(S, cid), p = d.proofs.find(function (x) { return x.id === id; }); if (!p) fail('Justificatif introuvable.'); if (!reason) fail('Motif obligatoire.');
  p.status = 'rejete'; p.rejected = Object.assign({ reason: reason }, who(S));
  if (watch && p.payer) { try { F.addWatch(S, cid, { kind: 'momo', value: p.payer, reason: 'Faux justificatif de paiement (' + (Y.doc(S, cid, p.docId) || {}).num + ')', source: 'Justificatifs' }); } catch (x) { /* déjà présent */ } }
  F.event(S, cid, p.docId, 'justificatif', 'Justificatif rejeté : ' + reason); return p;
};

/* ======================================================================= boîte de réception des factures fournisseurs */
F.INBOX_STATUS = { a_traiter: ['À traiter', 'warn'], comptabilisee: ['Validée · comptabilisée', 'ok'], rejetee: ['Rejetée', ''], doublon: ['Doublon', 'bad'], fraude: ['Fraude signalée', 'bad'] };
F.receive = function (S, cid, it) {
  need(S, 'fin.payables'); var d = F.D(S, cid); d.seq.inbox++;
  var rec = Object.assign({ id: U.uid('ibx'), ref: 'IN-' + U.pad(d.seq.inbox, 4), source: 'depot', from: '', fileName: '', receivedAt: new Date().toISOString(), extracted: {}, confidence: 0, status: 'a_traiter', by: who(S).by }, it);
  rec.extracted = Object.assign({ supplier: '', niu: '', invoiceNo: '', date: '', due: '', ht: 0, tva: 0, ttc: 0, account: '', momo: '', label: '' }, it.extracted || {});
  F.analyzeInbox(S, cid, rec); d.inbox.unshift(rec); return rec;
};
F.analyzeInbox = function (S, cid, it) {
  var d = F.D(S, cid), x = it.extracted, checks = [], add = function (level, text, k) { checks.push({ level: level, text: text, k: k || '' }); }, sup = Y.D(S, cid).tiers.filter(function (t) { return t.type === 'fournisseur'; });
  var match = (x.niu && sup.find(function (t) { return t.niu && t.niu.toUpperCase() === String(x.niu).toUpperCase(); })) || sup.find(function (t) { return norm(t.name) === norm(x.supplier); }) || null;
  var look = !match && x.supplier ? sup.map(function (t) { return { t: t, s: F.similar(t.name, x.supplier) }; }).filter(function (o) { return o.s >= 0.8; }).sort(function (a, b) { return b.s - a.s; })[0] : null;
  if (match) add('ok', 'Fournisseur reconnu : ' + match.code + ' ' + match.name + (x.niu && match.niu ? ' (NIU identique)' : ''), 'supplier');
  else if (look) add('bad', 'Raison sociale sosie de « ' + look.t.name + ' » (' + Math.round(look.s * 100) + ' % de ressemblance) mais pas identique : risque d’usurpation', 'lookalike');
  else add('warn', 'Fournisseur inconnu du référentiel : créez et faites valider la fiche avant tout paiement', 'unknown');
  var target = match || (look && look.t);
  if (match && F.profile(match).status === 'suspendu') add('bad', 'Fournisseur suspendu', 'suspended');
  if (target) {
    var p = F.profile(target), mb = F.mainBank(target);
    if (x.account && !p.banks.some(function (b) { return b.account && digits(b.account) === digits(x.account) && b.status === 'verifie'; })) add('bad', 'RIB de la facture différent des coordonnées vérifiées' + (mb ? ' (' + (mb.bank || 'compte') + ' ••' + digits(mb.account || mb.momo).slice(-4) + ')' : ''), 'bank');
    if (x.momo && !p.banks.some(function (b) { return b.momo && phoneKey(b.momo) === phoneKey(x.momo) && b.status === 'verifie'; })) add('bad', 'Numéro Mobile Money de la facture inconnu pour ce fournisseur', 'bank');
    if (it.from && /@/.test(it.from) && p.emailDomain && it.from.split('@')[1].toLowerCase() !== p.emailDomain) add('bad', 'Expéditeur « ' + it.from.split('@')[1] + ' » différent du domaine connu « ' + p.emailDomain + ' »', 'domain');
    var hist = []; Y.eachLine(S, cid, function (l) { if (l.tiersId === target.id && l.credit) hist.push(l.credit); }, { account: '40' });
    var avg = hist.length ? U.sum(hist) / hist.length : 0;
    if (avg && x.ttc > avg * 3) add('warn', 'Montant ' + Math.round(x.ttc / avg * 10) / 10 + ' fois supérieur à la moyenne de ce fournisseur (' + U.fmt(avg) + ')', 'amount');
    var dupE = Y.validated(S, cid).find(function (e) { return e.source === 'purchase' && ((x.invoiceNo && norm(e.ref) === norm(x.invoiceNo)) || (Y.entryTotals(e).credit === U.round(x.ttc) && Math.abs(U.daysBetween(e.date, x.date || S.meta.today)) <= 5)) && e.lines.some(function (l) { return l.tiersId === target.id; }); });
    if (dupE) add('bad', 'Doublon : déjà comptabilisée (' + dupE.num + ', ' + U.frDate(dupE.date) + ', ' + U.fmt(Y.entryTotals(dupE).credit) + ')', 'duplicate');
  }
  var dupI = d.inbox.find(function (o) { return o.id !== it.id && o.status !== 'rejetee' && o.extracted.invoiceNo && norm(o.extracted.invoiceNo) === norm(x.invoiceNo) && norm(o.extracted.supplier) === norm(x.supplier); });
  if (dupI) add('bad', 'Doublon dans la boîte de réception (' + dupI.ref + ')', 'duplicate');
  var w = F.checkWatch(S, cid, 'momo', x.momo) || F.checkWatch(S, cid, 'iban', x.account) || (it.from && /@/.test(it.from) ? F.checkWatch(S, cid, 'domain', it.from.split('@')[1]) : null) || (it.from && !/@/.test(it.from) ? F.checkWatch(S, cid, 'phone', it.from) : null);
  if (w) add('bad', 'Liste de vigilance : ' + w.reason, 'watch');
  if (x.ht && x.tva !== undefined && Math.abs(U.round(x.ht) + U.round(x.tva) - U.round(x.ttc)) > 2) add('warn', 'HT + TVA ≠ TTC : vérifiez l’extraction', 'math');
  if (x.ht && x.tva && Math.abs(x.tva / x.ht * 100 - 19.25) > 0.5) add('warn', 'Taux de TVA apparent ' + (Math.round(x.tva / x.ht * 1000) / 10) + ' % (19,25 % attendus)', 'vat');
  if (!x.invoiceNo) add('warn', 'Numéro de facture non lu', 'num');
  if (it.confidence && it.confidence < 70) add('warn', 'Lecture incertaine (' + it.confidence + ' %) : contrôlez chaque champ', 'ocr');
  var score = Math.min(100, U.sum(checks, function (c) { return c.level === 'bad' ? 35 : (c.level === 'warn' ? 12 : 0); }));
  it.checks = checks; it.tiersId = match ? match.id : ''; it.risk = score;
  if (checks.some(function (c) { return c.k === 'duplicate'; }) && it.status === 'a_traiter') it.status = 'doublon';
  return it;
};
F.validateInbox = function (S, cid, id, v) {
  need(S, 'fin.payables'); var d = F.D(S, cid), it = d.inbox.find(function (x) { return x.id === id; }); if (!it) fail('Document introuvable.');
  if (['comptabilisee', 'rejetee', 'fraude'].indexOf(it.status) > -1) fail('Document déjà traité.');
  Object.assign(it.extracted, v.extracted || {}); F.analyzeInbox(S, cid, it);
  var t = Y.tiers(S, cid, v.tiersId || it.tiersId); if (!t) fail('Rattachez la facture à un fournisseur existant et validé.');
  if (F.profile(t).status !== 'actif') fail('Fournisseur ' + (F.profile(t).status === 'suspendu' ? 'suspendu' : 'non encore validé') + '.');
  var blocking = it.checks.filter(function (c) { return c.level === 'bad'; });
  if (blocking.length && !v.override) fail('Contrôles au rouge : ' + blocking.map(function (c) { return c.text; }).join(' ; ') + '. Levez chaque alerte ou rejetez le document.');
  if (blocking.length && !v.comment) fail('Justifiez la levée des alertes.');
  var x = it.extracted; if (!(x.ht > 0)) fail('Montant HT obligatoire.'); if (!x.date) fail('Date de facture obligatoire.');
  var e = Y.postPurchase(S, cid, { tiersId: t.id, date: x.date, ref: x.invoiceNo || it.ref, label: (x.label || 'Facture') + ' · ' + t.name, due: x.due || '', lines: [{ account: v.account || '605', ht: U.round(x.ht), taxCode: x.tva ? 'TVA19' : 'HC', label: x.label || 'Facture ' + (x.invoiceNo || ''), section: v.section || '' }], attachments: it.fileName ? [{ name: it.fileName }] : [], source: 'purchase' });
  it.status = 'comptabilisee'; it.entry = e.num; it.decision = Object.assign({ comment: v.comment || '', override: !!v.override }, who(S));
  Y.audit(S, cid, 'Factures fournisseurs · validation', it.ref, e.num + ' · ' + t.name + ' · ' + U.fmt(x.ttc));
  return e;
};
F.rejectInbox = function (S, cid, id, reason, fraud) {
  need(S, 'fin.payables'); var d = F.D(S, cid), it = d.inbox.find(function (x) { return x.id === id; }); if (!it) fail('Document introuvable.'); if (!reason) fail('Motif obligatoire.');
  it.status = fraud ? 'fraude' : 'rejetee'; it.decision = Object.assign({ comment: reason }, who(S));
  if (fraud) {
    d.security.unshift(Object.assign({ type: 'fausse_facture', text: 'Fausse facture signalée : ' + (it.extracted.supplier || '?') + ' · ' + U.fmt(it.extracted.ttc) + ' (' + it.ref + ')' }, who(S)));
    var add = function (k, v) { if (v && !F.checkWatch(S, cid, k, v)) d.watch.unshift(Object.assign({ id: U.uid('wl'), kind: k, value: v, key: watchKey(k, v), reason: 'Fausse facture « ' + (it.extracted.supplier || '') + ' » (' + it.ref + ')', source: 'Boîte de réception' }, who(S))); };
    add('iban', it.extracted.account); add('momo', it.extracted.momo); if (it.from && /@/.test(it.from)) add('domain', it.from.split('@')[1]); else if (it.from) add('phone', it.from);
  }
  Y.audit(S, cid, 'Factures fournisseurs · ' + (fraud ? 'fraude signalée' : 'rejet'), it.ref, reason); return it;
};

/* ======================================================================= paiements fournisseurs */
F.payables = function (S, cid) {
  var out = [], today = S.meta.today;
  Y.validated(S, cid).forEach(function (e) {
    e.lines.forEach(function (l, i) {
      if (!/^40/.test(l.account) || !l.credit || l.letter || !l.tiersId) return;
      var t = Y.tiers(S, cid, l.tiersId); if (!t || t.type !== 'fournisseur') return;
      var paid = U.sum(F.D(S, cid).proposals.filter(function (p) { return p.status !== 'rejetee' && p.status !== 'annulee' && p.items.some(function (it) { return it.entryId === e.id && it.idx === i; }); }), function (p) { return U.sum(p.items.filter(function (it) { return it.entryId === e.id && it.idx === i; }), function (it) { return it.amount; }); });
      out.push({ id: e.id + ':' + i, entryId: e.id, idx: i, num: e.num, ref: e.ref, date: e.date, due: l.due || U.addDays(e.date, +t.terms || 30), tiersId: t.id, name: t.name, amount: l.credit, proposed: paid, rest: l.credit - paid, late: (l.due || '') < today });
    });
  });
  return out.filter(function (x) { return x.rest > 0; }).sort(function (a, b) { return a.due < b.due ? -1 : 1; });
};
F.PROP_STATUS = { a_approuver: ['À approuver', 'warn'], bloquee: ['Bloquée · contrôle anti-fraude', 'bad'], approuvee: ['Approuvée · à exécuter', 'info'], executee: ['Exécutée · comptabilisée', 'ok'], rejetee: ['Rejetée', ''], annulee: ['Annulée', ''] };
/** Score de risque d'un paiement sortant (0-100) avec les raisons. */
F.risk = function (S, cid, p) {
  var d = F.D(S, cid), t = Y.tiers(S, cid, p.tiersId), pr = F.profile(t), bank = pr.banks.find(function (b) { return b.id === p.bankId; }) || F.mainBank(t), r = [], add = function (pts, text, block) { r.push({ pts: pts, text: text, block: !!block }); };
  if (!bank) add(60, 'Aucune coordonnée de paiement vérifiée', true);
  else {
    if (bank.status !== 'verifie') add(60, 'Coordonnées non vérifiées (rappel au numéro du référentiel non fait)', true);
    if (bank.availableFrom && new Date(bank.availableFrom) > new Date(p.at || Date.now())) add(40, 'Coordonnées modifiées il y a moins de ' + d.settings.coolingHours + ' h (délai de carence)', true);
    if (bank.changeRef && !d.proposals.some(function (x) { return x.id !== p.id && x.status === 'executee' && x.bankId === bank.id; }) && p.amount > (bank.firstPaymentCap || d.settings.firstPaymentCap)) add(30, 'Premier paiement sur de nouvelles coordonnées supérieur au plafond de ' + U.fmt(bank.firstPaymentCap || d.settings.firstPaymentCap) + ' : faites d’abord un paiement test');
    var w = F.checkWatch(S, cid, 'momo', bank.momo) || F.checkWatch(S, cid, 'iban', bank.account); if (w) add(100, 'Coordonnées dans la liste de vigilance : ' + w.reason, true);
    F.sharedAccount(S, cid, t.id, bank.account, bank.momo).forEach(function (x) { add(50, x, /salarié/.test(x)); });
    if (bank.momo) { var ne = F.nameEnquiry(S, cid, bank.op, bank.momo); if (ne.found) { var hm = F.holderMatch(S, cid, t, ne.name); if (hm.score < 60) add(50, 'Titulaire chez l’opérateur « ' + ne.name + ' » : ' + hm.text, hm.score < 40); } }
  }
  if (pr.status !== 'actif') add(50, 'Fournisseur ' + (pr.status === 'suspendu' ? 'suspendu' : 'non validé'), pr.status === 'suspendu');
  var hist = []; Y.eachLine(S, cid, function (l) { if (l.tiersId === t.id && l.debit) hist.push(l.debit); }, { account: '40' });
  var avg = hist.length ? U.sum(hist) / hist.length : 0;
  if (avg && p.amount > avg * 3) add(20, 'Montant ' + Math.round(p.amount / avg * 10) / 10 + ' fois supérieur aux paiements habituels (' + U.fmt(avg) + ')');
  if (!hist.length && p.amount > d.settings.approval.single) add(15, 'Premier paiement à ce fournisseur');
  var dup = d.proposals.find(function (x) { return x.id !== p.id && x.tiersId === p.tiersId && x.amount === p.amount && ['rejetee', 'annulee'].indexOf(x.status) < 0 && Math.abs(U.daysBetween((x.at || '').slice(0, 10) || S.meta.today, S.meta.today)) <= 30; });
  if (dup) add(40, 'Paiement identique déjà ' + (dup.status === 'executee' ? 'exécuté' : 'proposé') + ' (' + dup.ref + ')');
  if (p.amount % 100000 === 0 && p.amount >= 1000000) add(5, 'Montant rond élevé');
  var score = Math.min(100, U.sum(r, function (x) { return x.pts; }));
  return { score: score, reasons: r, blocked: r.some(function (x) { return x.block; }) || score >= d.settings.riskBlock };
};
F.propose = function (S, cid, p) {
  need(S, 'fin.payables'); var d = F.D(S, cid), t = Y.tiers(S, cid, p.tiersId); if (!t) fail('Fournisseur introuvable.');
  var open = F.payables(S, cid).filter(function (x) { return x.tiersId === t.id && (!p.items || p.items.indexOf(x.id) > -1); });
  if (!open.length) fail('Aucune facture fournisseur à payer sélectionnée.');
  var amt = U.round(p.amount || U.sum(open, function (x) { return x.rest; })), max = U.sum(open, function (x) { return x.rest; }); if (amt <= 0 || amt > max) fail('Montant invalide (maximum ' + U.fmt(max) + ').');
  var left = amt, items = open.map(function (x) { var a = Math.min(left, x.rest); left -= a; return { entryId: x.entryId, idx: x.idx, num: x.num, ref: x.ref, amount: a }; }).filter(function (x) { return x.amount > 0; });
  var bank = F.mainBank(t); d.seq.prop++;
  var rec = { id: U.uid('pay'), ref: 'PAY-' + S.meta.today.slice(0, 4) + '-' + U.pad(d.seq.prop, 4), tiersId: t.id, amount: amt, method: p.method || (bank && bank.momo && !bank.account ? 'momo' : 'bank'), bankId: bank ? bank.id : '', items: items, date: p.date || S.meta.today, motif: p.motif || 'Règlement ' + items.map(function (x) { return x.ref || x.num; }).join(', '), at: p.at || new Date().toISOString(), preparedBy: who(S), approvals: [], status: 'a_approuver' };
  rec.risk = F.risk(S, cid, rec); rec.required = amt >= d.settings.approval.double || rec.risk.score >= d.settings.riskReview ? 2 : (amt >= d.settings.approval.single ? 1 : 1);
  if (rec.risk.blocked) rec.status = 'bloquee';
  d.proposals.unshift(rec); Y.audit(S, cid, 'Paiements · proposition', rec.ref, t.name + ' · ' + U.fmt(amt) + ' · risque ' + rec.risk.score);
  return rec;
};
F.approve = function (S, cid, id, decision, comment) {
  need(S, 'fin.approve'); var d = F.D(S, cid), p = d.proposals.find(function (x) { return x.id === id; }); if (!p) fail('Proposition introuvable.');
  var me = (S.meta.currentUser || {}).id;
  if (p.status === 'bloquee' && decision === 'approuver') { p.risk = F.risk(S, cid, p); if (p.risk.blocked) fail('Paiement bloqué : ' + p.risk.reasons.filter(function (r) { return r.block; }).map(function (r) { return r.text; }).join(' ; ') + '. Levez la cause (vérification des coordonnées, liste de vigilance) avant d’approuver.'); p.status = 'a_approuver'; }
  if (['a_approuver'].indexOf(p.status) < 0) fail('Proposition au statut « ' + F.PROP_STATUS[p.status][0] + ' ».');
  if (!F._bypass && p.preparedBy.byId === me) fail('Séparation des tâches : la personne qui prépare un paiement ne l’approuve pas.');
  if (!F._bypass && p.approvals.some(function (a) { return a.byId === me; })) fail('Vous avez déjà approuvé ce paiement : une seconde personne doit approuver.');
  if (decision === 'rejeter') { if (!comment) fail('Motif du rejet obligatoire.'); p.status = 'rejetee'; p.rejected = Object.assign({ comment: comment }, who(S)); return p; }
  if (p.risk.score >= d.settings.riskReview && !comment) fail('Risque ' + p.risk.score + '/100 : commentez votre contrôle avant d’approuver.');
  p.approvals.push(Object.assign({ comment: comment || '' }, who(S)));
  if (p.approvals.length >= p.required) p.status = 'approuvee';
  Y.audit(S, cid, 'Paiements · approbation', p.ref, p.approvals.length + '/' + p.required); return p;
};
F.execute = function (S, cid, id, opts) {
  opts = opts || {}; need(S, 'fin.pay'); var d = F.D(S, cid), p = d.proposals.find(function (x) { return x.id === id; }); if (!p) fail('Proposition introuvable.');
  if (p.status !== 'approuvee') fail('Le paiement doit être approuvé.');
  if (!F._bypass && p.preparedBy.byId === (S.meta.currentUser || {}).id) fail('Séparation des tâches : la personne qui prépare un paiement ne l’exécute pas.');
  p.risk = F.risk(S, cid, p); if (p.risk.blocked) { p.status = 'bloquee'; fail('Contrôle anti-fraude au moment de l’exécution : ' + p.risk.reasons.filter(function (r) { return r.block; }).map(function (r) { return r.text; }).join(' ; ')); }
  var acct = p.method === 'momo' ? 'momo' : (p.method === 'om' ? 'om' : 'bank'), entries = [];
  p.items.forEach(function (it) { var e = Y.paySupplier(S, cid, { tiersId: p.tiersId, amount: it.amount, method: acct, date: opts.date || S.meta.today, ref: it.ref || it.num, letterRef: it.ref }); entries.push(e.num); });
  p.status = 'executee'; p.entries = entries; p.executed = who(S); p.bankRef = opts.bankRef || '';
  Y.audit(S, cid, 'Paiements · exécution', p.ref, entries.join(', ')); return p;
};

/* ======================================================================= rapprochement intelligent */
F.FEE_RATES = { '5521': [0, 0.5, 1, 1.5, 2], '5522': [0, 0.5, 1, 1.5, 2], '5211': [0], '5212': [0] };
F.suggest = function (S, cid) {
  var d = Y.D(S, cid), out = [], open = d.docs.filter(function (x) { return x.type === 'FA' && x.status !== 'draft' && Y.docStatus(S, cid, x).key !== 'paid'; });
  var inv = open.map(function (x) { var t = Y.tiers(S, cid, x.tiersId); return { doc: x, num: x.num, tiers: t, rest: Y.docTotals(S, cid, x).ttc - Y.docPaid(x) }; });
  d.bankTx.filter(function (t) { return t.status === 'open'; }).forEach(function (tx) {
    var b = Y.bankAccount(S, cid, tx.bankId), text = norm(tx.label + ' ' + tx.ref), rates = F.FEE_RATES[b.account] || [0], cands = [];
    inv.forEach(function (iv) {
      if (tx.amount <= 0) return;
      var reasons = [], score = 0, nd = digits(iv.num).replace(/^2026/, '').replace(/^0+/, '');
      if (text.indexOf(norm(iv.num)) > -1) { score += 50; reasons.push('Numéro ' + iv.num + ' dans le libellé'); }
      else if (nd && digits(tx.label + tx.ref).indexOf(nd.padStart(4, '0')) > -1) { score += 30; reasons.push('Numéro de facture partiellement reconnu'); }
      var words = norm(iv.tiers.name).split(' ').filter(function (w) { return w.length > 3 && ['sarl', 'groupe', 'associes', 'cabinet'].indexOf(w) < 0; });
      var tw = text.split(' '), fuzzy = false, hit = words.filter(function (w) { if (text.indexOf(w) > -1) return true; var f = tw.some(function (x) { return x.length >= 5 && F.lev(x, w) <= (w.length >= 8 ? 2 : 1); }); if (f) fuzzy = true; return f; }).length;
      if (hit) { score += Math.min(30, hit * 15); reasons.push('Client reconnu dans le libellé (' + iv.tiers.name + ')' + (fuzzy ? ' malgré une orthographe approximative' : '')); }
      if (iv.tiers.momo && digits(tx.label + tx.ref).indexOf(phoneKey(iv.tiers.momo)) > -1) { score += 25; reasons.push('Numéro Mobile Money du client'); }
      var fee = null; rates.forEach(function (r) { if (fee !== null) return; var gross = Math.round(tx.amount / (1 - r / 100)); if (Math.abs(gross - iv.rest) <= Math.max(2, iv.rest * 0.001)) fee = { rate: r, gross: iv.rest, fees: iv.rest - tx.amount }; });
      if (fee) { score += fee.rate ? 30 : 40; reasons.push(fee.rate ? 'Montant = reste dû − frais opérateur ' + String(fee.rate).replace('.', ',') + ' % (' + U.fmt(fee.fees) + ')' : 'Montant exact du reste dû'); }
      else if (tx.amount < iv.rest && hit) { score += 10; reasons.push('Paiement partiel (' + Math.round(tx.amount * 100 / iv.rest) + ' % du reste dû)'); fee = { rate: 0, gross: tx.amount, fees: 0, partial: true }; }
      if (score >= 25 && fee) cands.push({ kind: fee.partial ? 'partiel' : 'simple', tx: tx, docs: [{ doc: iv.doc, amount: fee.gross, fees: fee.fees }], score: Math.min(99, score), reasons: reasons });
    });
    // encaissement groupé : 2 ou 3 factures du même client
    var byClient = {}; inv.forEach(function (iv) { (byClient[iv.tiers.id] = byClient[iv.tiers.id] || []).push(iv); });
    Object.keys(byClient).forEach(function (k) {
      var l = byClient[k]; if (l.length < 2 || tx.amount <= 0) return; var words = norm(l[0].tiers.name).split(' ').filter(function (w) { return w.length > 3; }), named = words.some(function (w) { return text.indexOf(w) > -1; });
      for (var i = 0; i < l.length; i++) for (var j = i + 1; j < l.length; j++) {
        [[l[i], l[j]]].concat(l.slice(j + 1).map(function (z) { return [l[i], l[j], z]; })).forEach(function (combo) {
          var sum = U.sum(combo, function (c) { return c.rest; });
          rates.forEach(function (r) { var gross = Math.round(tx.amount / (1 - r / 100)); if (Math.abs(gross - sum) <= Math.max(2, sum * 0.001)) { var fees = sum - tx.amount; cands.push({ kind: 'groupe', tx: tx, docs: combo.map(function (c, n) { return { doc: c.doc, amount: c.rest, fees: n === 0 ? fees : 0 }; }), score: named ? 80 : 55, reasons: ['Encaissement groupé de ' + combo.length + ' factures ' + combo.map(function (c) { return c.num; }).join(' + ') + (fees ? ' (frais ' + U.fmt(fees) + ')' : '')].concat(named ? ['Client reconnu dans le libellé'] : []) }); } });
        });
      }
    });
    // écriture déjà passée (paiement saisi, virement interne) : simple rapprochement relevé ↔ comptabilité
    Y.unreconciledBookLines(S, cid, b.id).forEach(function (bl) { if (bl.amount === tx.amount && Math.abs(U.daysBetween(bl.date, tx.date)) <= 10) cands.push({ kind: 'ecriture', tx: tx, docs: [], book: bl, score: tx.ref && (bl.ref === tx.ref || (tx.label + tx.ref).indexOf(bl.ref || '#') > -1) ? 97 : 85, reasons: ['Écriture ' + bl.num + ' déjà comptabilisée, même montant' + (Math.abs(U.daysBetween(bl.date, tx.date)) ? ' à ' + Math.abs(U.daysBetween(bl.date, tx.date)) + ' jour(s) d’écart' : ' et même date'), bl.label] }); });
    cands.sort(function (a, b) { return b.score - a.score; });
    if (cands.length) { var best = cands[0]; best.alternatives = cands.length - 1; best.id = 'sg_' + tx.id; best.level = best.score >= 75 ? 'forte' : (best.score >= 50 ? 'probable' : 'a_examiner'); out.push(best); }
    else out.push({ id: 'sg_' + tx.id, kind: 'aucune', tx: tx, docs: [], score: 0, level: 'a_examiner', reasons: [tx.amount > 0 ? 'Aucune facture ne correspond : acompte, remboursement ou encaissement non facturé ?' : 'Aucune écriture ne correspond : frais, prélèvement ou dépense à comptabiliser depuis le relevé'] });
  });
  // paiements fractionnés : plusieurs versements partiels qui soldent ensemble une facture
  var byDoc = {}; out.forEach(function (sg) { if (sg.kind === 'partiel') (byDoc[sg.docs[0].doc.id] = byDoc[sg.docs[0].doc.id] || []).push(sg); });
  Object.keys(byDoc).forEach(function (k) { var l = byDoc[k]; if (l.length < 2) return; var doc = Y.doc(S, cid, k), rest = Y.docTotals(S, cid, doc).ttc - Y.docPaid(doc), sum = U.sum(l, function (x) { return x.tx.amount; }); if (sum === rest) l.forEach(function (sg, i) { sg.kind = 'fractionne'; sg.score = 82; sg.level = 'forte'; sg.reasons = ['Paiement fractionné : ' + l.length + ' versements (' + l.map(function (x) { return U.fmt(x.tx.amount); }).join(' + ') + ') soldent ' + doc.num + ' · versement ' + (i + 1) + '/' + l.length].concat(sg.reasons.filter(function (r) { return /Client/.test(r); })); }); });
  return out;
};
F.applySuggestion = function (S, cid, txId, docs) {
  need(S, 'fin.collect'); var d = Y.D(S, cid), tx = d.bankTx.find(function (t) { return t.id === txId; }); if (!tx || tx.status !== 'open') fail('Ligne de relevé non disponible.');
  if (docs && docs.book) { Y.reconcile(S, cid, tx.id, docs.book.entryId, docs.book.idx); return Y.entry(S, cid, docs.book.entryId); }
  var b = Y.bankAccount(S, cid, tx.bankId), method = Object.keys(Y.PAY_METHODS).find(function (k) { return Y.PAY_METHODS[k].account === b.account; }) || 'bank';
  var net = U.sum(docs, function (x) { return x.amount - (x.fees || 0); }); if (net !== tx.amount) fail('Le total net (' + U.fmt(net) + ') diffère du relevé (' + U.fmt(tx.amount) + ').');
  if (docs.length > 1) {
    var lines = [{ account: b.account, label: tx.label, debit: tx.amount, credit: 0 }], fees = U.sum(docs, function (x) { return x.fees || 0; });
    if (fees) lines.push({ account: '631', label: 'Frais ' + Y.PAY_METHODS[method].label, debit: fees, credit: 0, section: 'STR' });
    docs.forEach(function (x) { var doc = Y.doc(S, cid, x.docId), t = Y.tiers(S, cid, doc.tiersId); lines.push({ account: t.collective || '4111', tiersId: t.id, label: 'Règlement ' + doc.num, debit: 0, credit: x.amount }); });
    var e = Y.postEntry(S, cid, { journal: Y.PAY_METHODS[method].journal, date: tx.date, ref: tx.ref, label: 'Encaissement groupé ' + docs.map(function (x) { return Y.doc(S, cid, x.docId).num; }).join(', '), lines: lines, source: 'payment', extRef: tx.ref }, { silent: true });
    docs.forEach(function (x) { var doc = Y.doc(S, cid, x.docId); doc.payments.push({ date: tx.date, amount: x.amount, fees: x.fees || 0, method: method, entryId: e.id, ref: e.num, extRef: tx.ref }); F.event(S, cid, doc.id, Y.docStatus(S, cid, doc).key === 'paid' ? 'payee' : 'partielle', 'Rapprochement intelligent · ' + e.num); });
    Y.reconcile(S, cid, tx.id, e.id, 0); return e;
  }
  var x = docs[0], e1 = Y.registerPayment(S, cid, x.docId, { amount: x.amount, method: method, fees: x.fees || 0, date: tx.date, extRef: tx.ref });
  Y.reconcile(S, cid, tx.id, e1.id, 0); F.event(S, cid, x.docId, 'payee', 'Rapprochement intelligent · ' + e1.num); return e1;
};

/* ======================================================================= prévision de trésorerie */
F.cash = function (S, cid) { var d = Y.D(S, cid); return d.bankAccounts.map(function (b) { return { b: b, balance: Y.net(S, cid, b.account) }; }); };
F.forecast = function (S, cid, opts) {
  opts = opts || {}; var weeks = opts.weeks || 13, d = Y.D(S, cid), today = S.meta.today, start = U.addDays(today, -((new Date(today + 'T12:00:00').getDay() + 6) % 7));
  var bal0 = U.sum(F.cash(S, cid), function (x) { return x.balance; }), items = [];
  var delayOf = {}; d.tiers.filter(function (t) { return t.type === 'client'; }).forEach(function (t) { delayOf[t.id] = F.summary(S, cid, t).avgDelay; });
  d.docs.filter(function (x) { return x.type === 'FA' && x.status !== 'draft'; }).forEach(function (x) {
    var rest = Y.docTotals(S, cid, x).ttc - Y.docPaid(x); if (rest <= 0) return;
    var late = x.due < today ? U.daysBetween(x.due, today) : 0, dl = delayOf[x.tiersId] || 0;
    var prom = F.D(S, cid).promises.find(function (p) { return p.docId === x.id && p.status === 'en_cours'; });
    var central = prom ? prom.date : U.addDays(x.due < today ? today : x.due, Math.max(0, dl) + (x.due < today ? 7 : 0));
    var prob = late > 180 ? 0.1 : (late > 90 ? 0.35 : (late > 30 ? 0.7 : 0.9));
    items.push({ kind: 'in', date: central, prudentDate: U.addDays(central, 15), amount: rest, prudent: late > 90 ? 0 : U.round(rest * prob), label: 'Facture ' + x.num + ' · ' + Y.tiers(S, cid, x.tiersId).name, src: 'facture', late: late });
  });
  F.payables(S, cid).forEach(function (p) { items.push({ kind: 'out', date: p.due < today ? today : p.due, prudentDate: p.due < today ? today : p.due, amount: p.rest, prudent: p.rest, label: 'Fournisseur ' + p.name + ' · ' + (p.ref || p.num), src: 'fournisseur' }); });
  // charges récurrentes observées : paie, CNPS/DGI, loyer, emprunt
  var P = Y.Paie, payNet = 0, decl = 0;
  try { var pd = P.D(S, cid), ks = Object.keys(pd.periods).filter(function (k) { return P.isFrozen(pd.periods[k]); }).sort(), lk = ks[ks.length - 1]; if (lk) { var tt = P.totals(S, cid, lk); payNet = tt.net; decl = U.sum(P.declarations(S, cid, lk), function (x) { return x.total || 0; }); } } catch (x) { /* paie absente */ }
  var rec = {}; Y.validated(S, cid).forEach(function (e) { if (/^ECH-/.test(e.ref || '')) rec.loan = Y.entryTotals(e).debit; if (/loyer/i.test(e.label) && e.journal !== 'AN') rec.rent = Math.max(rec.rent || 0, Y.entryTotals(e).debit); });
  for (var m = 0; m < 4; m++) {
    var ym = U.addMonths(today.slice(0, 7) + '-01', m).slice(0, 7);
    if (payNet) items.push({ kind: 'out', date: ym + '-28', prudentDate: ym + '-28', amount: payNet, prudent: payNet, label: 'Salaires nets ' + U.MONTHS[+ym.slice(5) - 1], src: 'paie' });
    if (decl) items.push({ kind: 'out', date: ym + '-15', prudentDate: ym + '-15', amount: decl, prudent: decl, label: 'CNPS, DGI, commune · ' + U.MONTHS[+ym.slice(5) - 1], src: 'paie' });
    if (rec.loan) items.push({ kind: 'out', date: ym + '-25', prudentDate: ym + '-25', amount: rec.loan, prudent: rec.loan, label: 'Échéance d’emprunt', src: 'recurrent' });
  }
  var wk = []; var cb = bal0, pb = bal0;
  for (var w = 0; w < weeks; w++) {
    var s = U.addDays(start, w * 7), e = U.addDays(s, 6);
    var inC = 0, outC = 0, inP = 0, outP = 0, list = [];
    items.forEach(function (it) { var dC = it.date < today ? today : it.date, dP = it.prudentDate < today ? today : it.prudentDate; if (dC >= s && dC <= e) { if (it.kind === 'in') inC += it.amount; else outC += it.amount; list.push(it); } if (dP >= s && dP <= e) { if (it.kind === 'in') inP += it.prudent; else outP += it.prudent; } });
    cb += inC - outC; pb += inP - outP;
    wk.push({ start: s, end: e, inC: inC, outC: outC, inP: inP, outP: outP, central: cb, prudent: pb, items: list });
  }
  var min = F.D(S, cid).settings.minCash, tension = wk.find(function (x) { return x.prudent < min; });
  return { start: bal0, weeks: wk, items: items, min: min, tension: tension || null, minPrudent: Math.min.apply(null, wk.map(function (x) { return x.prudent; })) };
};

/* ======================================================================= relances et promesses */
F.dunningPlan = function (S, cid) {
  var d = Y.D(S, cid), steps = F.D(S, cid).settings.dunning, today = S.meta.today, out = [];
  d.docs.filter(function (x) { return x.type === 'FA' && x.status !== 'draft' && Y.docStatus(S, cid, x).key !== 'paid'; }).forEach(function (x) {
    var days = U.daysBetween(x.due, today), done = (x.reminders || []).length, step = steps.filter(function (s) { return days >= s.day; }).pop(), stepIdx = steps.indexOf(step);
    var prom = F.D(S, cid).promises.find(function (p) { return p.docId === x.id && p.status === 'en_cours'; });
    if (!step || prom) { out.push({ doc: x, days: days, step: null, next: steps.find(function (s) { return s.day > days; }), promise: prom, done: done, due: false }); return; }
    var dueNow = done <= stepIdx;
    out.push({ doc: x, days: days, step: step, stepIdx: stepIdx, promise: prom, done: done, due: dueNow, rest: Y.docTotals(S, cid, x).ttc - Y.docPaid(x) });
  });
  return out.sort(function (a, b) { return (b.due - a.due) || (b.days - a.days); });
};
F.remindMessage = function (S, cid, doc, step) {
  var t = Y.tiers(S, cid, doc.tiersId), rest = Y.docTotals(S, cid, doc).ttc - Y.docPaid(doc), l = F.linkFor(S, cid, doc.id), co = Y.company(S, cid), days = U.daysBetween(doc.due, S.meta.today);
  var tone = { whatsapp: days < 0 ? 'Petit rappel : la facture ' + doc.num + ' (' + U.fmt(rest) + ' XAF) arrive à échéance le ' + U.frDate(doc.due) + '.' : 'Sauf erreur de notre part, la facture ' + doc.num + ' (' + U.fmt(rest) + ' XAF) est échue depuis ' + days + ' jour(s).', email: 'Objet : Facture ' + doc.num + ' échue\n\nMadame, Monsieur,\nSauf erreur de notre part, la facture ' + doc.num + ' d’un montant restant de ' + U.fmt(rest) + ' XAF est échue depuis le ' + U.frDate(doc.due) + '.', appel: 'Script d’appel : rappeler l’échéance, proposer un échéancier, obtenir une date de paiement ferme (promesse).', courrier: 'Mise en demeure de payer sous 8 jours la somme de ' + U.fmt(rest) + ' XAF au titre de la facture ' + doc.num + ', faute de quoi nous engagerons une procédure de recouvrement.' }[step.channel];
  return 'Bonjour ' + t.name + ',\n' + tone + (step.channel !== 'appel' ? '\nPayer en ligne (MoMo, Orange Money, virement) : ' + (l ? l.url : 'lien envoyé avec la facture') + '\n' + co.name : '');
};
F.remind = function (S, cid, docId, opts) {
  need(S, 'fin.collect'); opts = opts || {}; var doc = Y.doc(S, cid, docId), plan = F.dunningPlan(S, cid).find(function (x) { return x.doc.id === docId; }); if (!doc) fail('Facture introuvable.');
  var step = opts.step || (plan && plan.step) || F.D(S, cid).settings.dunning[1];
  F.linkFor(S, cid, docId, { create: true });
  doc.reminders = doc.reminders || []; doc.reminders.push({ date: S.meta.today, channel: step.channel, label: step.label, by: who(S).by, text: opts.text || F.remindMessage(S, cid, doc, step) });
  F.event(S, cid, docId, 'relance', step.label + ' (' + step.channel + ')'); Y.audit(S, cid, 'Relance', doc.num, step.label); return doc.reminders[doc.reminders.length - 1];
};
F.PROMISE_STATUS = { en_cours: ['En cours', 'info'], tenue: ['Tenue', 'ok'], non_tenue: ['Non tenue', 'bad'] };
F.promise = function (S, cid, docId, p) {
  need(S, 'fin.collect'); var doc = Y.doc(S, cid, docId); if (!doc) fail('Facture introuvable.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date || '') || p.date < S.meta.today) fail('Date de promesse future obligatoire.');
  var rest = Y.docTotals(S, cid, doc).ttc - Y.docPaid(doc), amt = U.round(p.amount || rest); if (amt <= 0 || amt > rest) fail('Montant invalide.');
  var d = F.D(S, cid); d.promises.forEach(function (x) { if (x.docId === docId && x.status === 'en_cours') x.status = 'remplacee'; });
  var r = Object.assign({ id: U.uid('pro'), docId: docId, tiersId: doc.tiersId, date: p.date, amount: amt, contact: p.contact || '', channel: p.channel || 'appel', paidBefore: Y.docPaid(doc), status: 'en_cours' }, who(S));
  d.promises.unshift(r); F.event(S, cid, docId, 'promesse', 'Promesse de paiement de ' + U.fmt(amt) + ' pour le ' + U.frDate(p.date) + (p.contact ? ' (' + p.contact + ')' : '')); return r;
};
F.refreshPromises = function (S, cid) {
  F.D(S, cid).promises.forEach(function (p) { if (p.status !== 'en_cours') return; var doc = Y.doc(S, cid, p.docId); if (Y.docPaid(doc) - p.paidBefore >= p.amount) p.status = 'tenue'; else if (p.date < S.meta.today) p.status = 'non_tenue'; });
};
F.reliability = function (S, cid, tiersId) {
  var pr = F.D(S, cid).promises.filter(function (p) { return p.tiersId === tiersId && ['tenue', 'non_tenue'].indexOf(p.status) > -1; }), t = Y.tiers(S, cid, tiersId), s = F.summary(S, cid, t);
  var kept = pr.filter(function (p) { return p.status === 'tenue'; }).length, score = 100;
  if (s.avgDelay > 0) score -= Math.min(40, s.avgDelay); if (pr.length) score -= Math.round((1 - kept / pr.length) * 40); if (s.overdue > 0) score -= Math.min(20, Math.round(s.overdue / Math.max(1, s.invoiced) * 100));
  return { score: Math.max(0, score), promises: pr.length, kept: kept, avgDelay: s.avgDelay };
};

/* ======================================================================= alertes */
F.notifications = function (S, cid) {
  var d = F.D(S, cid), out = [];
  function push(level, title, text, page, tab) { out.push({ level: level, title: title, text: text, page: page, tab: tab, module: 'fin' }); }
  var ch = d.changes.filter(function (c) { return c.status === 'quarantaine'; }); if (ch.length && F.can(S, 'fin.verify')) push('bad', ch.length + ' changement(s) de coordonnées en quarantaine', 'Rappeler le fournisseur au numéro du référentiel avant tout paiement.', 'fin-fraude', 'coordonnees');
  var bl = d.proposals.filter(function (p) { return p.status === 'bloquee'; }); if (bl.length && F.can(S, 'fin.approve')) push('bad', bl.length + ' paiement(s) bloqué(s) par l’anti-fraude', bl.map(function (p) { return p.ref; }).join(', '), 'fin-pay', 'propositions');
  var ap = d.proposals.filter(function (p) { return p.status === 'a_approuver' && p.preparedBy.byId !== (S.meta.currentUser || {}).id && !p.approvals.some(function (a) { return a.byId === (S.meta.currentUser || {}).id; }); }); if (ap.length && F.can(S, 'fin.approve')) push('warn', ap.length + ' paiement(s) fournisseur à approuver', U.fmt(U.sum(ap, function (p) { return p.amount; })) + ' XAF', 'fin-pay', 'propositions');
  var ib = d.inbox.filter(function (i) { return i.status === 'a_traiter'; }); if (ib.length && F.can(S, 'fin.payables')) push('info', ib.length + ' facture(s) fournisseur reçue(s) à traiter', ib.filter(function (i) { return i.risk >= 35; }).length + ' avec une alerte', 'fin-inbox', 'a_traiter');
  var pf = d.proofs.filter(function (p) { return ['suspect', 'falsifie'].indexOf(p.status) > -1; }); if (pf.length && F.can(S, 'fin.collect')) push('bad', pf.length + ' justificatif(s) de paiement suspect(s)', 'Ne livrez pas avant confirmation par le relevé.', 'fin-encaiss', 'justificatifs');
  try { var fc = F.forecast(S, cid, { weeks: 8 }); if (fc.tension && F.can(S, 'fin.read')) push('warn', 'Tension de trésorerie prévue semaine du ' + U.frDate(fc.tension.start), 'Scénario prudent : ' + U.fmt(fc.tension.prudent) + ' XAF sous le seuil de ' + U.fmt(fc.min) + '.', 'tresor', 'prevision'); } catch (x) { /* rien */ }
  F.refreshPromises(S, cid); var br = d.promises.filter(function (p) { return p.status === 'non_tenue' && U.daysBetween(p.date, S.meta.today) <= 10; }); if (br.length && F.can(S, 'fin.collect')) push('warn', br.length + ' promesse(s) de paiement non tenue(s)', 'Passez à l’étape de relance suivante.', 'fin-relances', 'promesses');
  return out;
};

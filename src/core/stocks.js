/*
 * myyiel Stocks & inventaires · moteur (pur JavaScript, sans DOM, exécutable sous Node).
 * - Articles stockés par famille SYSCOHADA (marchandises 31, matières 32, autres approvisionnements 33, produits finis 36), dépôts multiples.
 * - Mouvements : entrée, sortie, transfert entre dépôts, ajustement, écart d'inventaire. Valorisation au coût moyen unitaire pondéré (CMUP).
 * - Inventaire physique : snapshot du stock théorique, comptage (à l'aveugle possible), écarts valorisés, validation par une autre personne.
 * - Comptabilisation :
 *     inventaire intermittent (défaut PME) : écriture de variation à la clôture ou en situation (stock initial annulé, stock final constaté, en net) ;
 *     inventaire permanent : écriture à chaque mouvement (31x / 603x ; 361 / 736).
 *   Dépréciations : dotation 6593 / 39x, reprise 39x / 7593.
 * Spécifications : docs/rh/03-stocks-inventaires.md
 */
import { Y } from './registry.js';

var U = Y.util;
var K = Y.Stock = {};
function fail(m) { throw new Y.BizError(m); }
function role(S) { return (S.meta.currentUser || {}).role || 'reader'; }
K.can = function (S, right) { return Y.can(role(S), right); };
function need(S, right) { if (K._bypass) return; if (!K.can(S, right)) fail('Action réservée : ' + (Y.RIGHTS[right] || right).toLowerCase() + ' (rôle actuel : ' + ((Y.ROLES[role(S)] || {}).label || role(S)) + ').'); }
function who(S) { var u = S.meta.currentUser || {}; return { by: u.name || 'Système', byId: u.id || '', at: new Date().toISOString() }; }

K.FAMILIES = {
  marchandise: { label: 'Marchandises', stock: '311', variation: '6031', purchase: '601', deprec: '3911', sale: '701' },
  matiere: { label: 'Matières premières et fournitures liées', stock: '321', variation: '6032', purchase: '602', deprec: '3921' },
  fourniture: { label: 'Autres approvisionnements', stock: '331', variation: '6033', purchase: '604', deprec: '3931' },
  produit_fini: { label: 'Produits finis', stock: '361', variation: '736', purchase: '', deprec: '3961', sale: '702' }
};
K.MOVE_TYPES = { entree: ['Entrée', 'ok'], sortie: ['Sortie', 'warn'], transfert: ['Transfert', 'info'], ajustement: ['Ajustement', ''], inventaire: ['Écart d’inventaire', 'bad'] };
K.MOTIFS = { entree: ['Réception fournisseur', 'Stock initial', 'Retour client', 'Production terminée'], sortie: ['Vente', 'Consommation interne', 'Projet client', 'Casse / avarie', 'Don / échantillon'], ajustement: ['Correction de saisie', 'Démarque constatée'] };
K.DEP_ACCOUNT = '6593'; K.REV_ACCOUNT = '7593';

K.D = function (S, cid) {
  var d = Y.D(S, cid);
  if (!d.stock) d.stock = { warehouses: [], articles: [], moves: [], counts: [], seq: { move: 0, count: 0 }, settings: { mode: 'intermittent', blindCount: true, dormantDays: 180 } };
  return d.stock;
};
K.article = function (S, cid, code) { return K.D(S, cid).articles.find(function (a) { return a.code === code; }); };
K.wh = function (S, cid, code) { return K.D(S, cid).warehouses.find(function (w) { return w.code === code; }); };
K.fam = function (a) { return K.FAMILIES[a.family] || K.FAMILIES.marchandise; };

/* ======================================================================= référentiels */
K.saveWarehouse = function (S, cid, w) {
  need(S, 'stock'); var d = K.D(S, cid);
  if (!w.code || !w.label) fail('Code et libellé obligatoires.');
  var ex = d.warehouses.find(function (x) { return x.code === w.code; });
  var rec = Object.assign(ex || {}, { code: w.code, label: w.label, site: w.site || '', keeper: w.keeper || '', active: w.active !== false });
  if (!ex) d.warehouses.push(rec); Y.audit(S, cid, 'Stocks · dépôt', rec.code, rec.label); return rec;
};
K.saveArticle = function (S, cid, a, opts) {
  need(S, 'stock'); opts = opts || {}; var d = K.D(S, cid), errs = [];
  if (!a.code) errs.push('Code article obligatoire.'); if (!a.label) errs.push('Désignation obligatoire.');
  if (!K.FAMILIES[a.family]) errs.push('Famille inconnue.');
  var ex = d.articles.find(function (x) { return x.code === a.code; });
  if (ex && opts.create) errs.push('Le code ' + a.code + ' existe déjà.');
  if (a.itemCode && !Y.D(S, cid).items.some(function (i) { return i.code === a.itemCode; })) errs.push('Article de vente ' + a.itemCode + ' introuvable.');
  if (errs.length) fail(errs);
  var rec = Object.assign(ex || { createdAt: S.meta.today }, { code: a.code, label: a.label, family: a.family, unit: a.unit || 'unité', minQty: +a.minQty || 0, cost: U.round(a.cost || (ex && ex.cost) || 0), price: U.round(a.price || 0), itemCode: a.itemCode || '', barcode: a.barcode || '', wh: a.wh || (ex && ex.wh) || ((d.warehouses[0] || {}).code || ''), active: a.active !== false });
  if (!ex) d.articles.push(rec); Y.audit(S, cid, 'Stocks · article', rec.code, rec.label); return rec;
};

/* ======================================================================= valorisation CMUP */
function sortedMoves(S, cid) { return K.D(S, cid).moves.slice().sort(function (a, b) { return a.date < b.date ? -1 : (a.date > b.date ? 1 : a.seq - b.seq); }); }
/** Rejoue les mouvements : état par article × dépôt à une date (incluse), et coût de chaque mouvement. */
K.replay = function (S, cid, upTo, costs) {
  var st = {};
  function key(a, w) { return a + '|' + w; }
  function get(a, w) { return st[key(a, w)] || (st[key(a, w)] = { article: a, wh: w, qty: 0, value: 0, last: '' }); }
  sortedMoves(S, cid).forEach(function (m) {
    if (upTo && m.date > upTo) return;
    var s = get(m.article, m.wh), cmup = s.qty > 0 ? s.value / s.qty : (K.article(S, cid, m.article) || {}).cost || 0;
    if (m.type === 'entree' || ((m.type === 'ajustement' || m.type === 'inventaire') && m.qty > 0)) { var c = m.unitCost || cmup; s.qty += Math.abs(m.qty); s.value += Math.abs(m.qty) * c; if (costs) costs[m.id] = c; }
    else if (m.type === 'sortie' || ((m.type === 'ajustement' || m.type === 'inventaire') && m.qty < 0)) { var q = Math.abs(m.qty); s.value -= q * cmup; s.qty -= q; if (costs) costs[m.id] = cmup; if (s.qty <= 1e-9) { s.qty = Math.max(0, s.qty); if (s.qty === 0) s.value = 0; } }
    else if (m.type === 'transfert') { var t = get(m.article, m.whTo); s.qty -= m.qty; s.value -= m.qty * cmup; t.qty += m.qty; t.value += m.qty * cmup; t.last = m.date; if (costs) costs[m.id] = cmup; }
    s.last = m.date;
  });
  return st;
};
K.position = function (S, cid, article, wh, date) { var s = K.replay(S, cid, date)[article + '|' + wh]; return s ? { qty: Math.round(s.qty * 1000) / 1000, value: U.round(s.value), cmup: s.qty > 0 ? U.round(s.value / s.qty) : ((K.article(S, cid, article) || {}).cost || 0), last: s.last } : { qty: 0, value: 0, cmup: (K.article(S, cid, article) || {}).cost || 0, last: '' }; };
K.valuation = function (S, cid, date) {
  var st = K.replay(S, cid, date), d = K.D(S, cid), rows = [];
  Object.keys(st).forEach(function (k) {
    var s = st[k], a = K.article(S, cid, s.article); if (!a) return;
    var dormant = s.last ? U.daysBetween(s.last, date || S.meta.today) : 0;
    rows.push({ article: a.code, label: a.label, family: a.family, wh: s.wh, unit: a.unit, qty: Math.round(s.qty * 1000) / 1000, cmup: s.qty > 0 ? U.round(s.value / s.qty) : a.cost, value: U.round(s.value), minQty: a.minQty, below: s.qty < a.minQty, dormant: dormant, isDormant: s.qty > 0 && dormant > d.settings.dormantDays, last: s.last });
  });
  d.articles.forEach(function (a) { if (!rows.some(function (r) { return r.article === a.code; })) rows.push({ article: a.code, label: a.label, family: a.family, wh: a.wh, unit: a.unit, qty: 0, cmup: a.cost, value: 0, minQty: a.minQty, below: a.minQty > 0, dormant: 0, isDormant: false, last: '' }); });
  return rows.sort(function (a, b) { return a.article < b.article ? -1 : (a.article > b.article ? 1 : (a.wh < b.wh ? -1 : 1)); });
};
K.byFamily = function (S, cid, date) {
  var out = {}; K.valuation(S, cid, date).forEach(function (r) { var f = out[r.family] = out[r.family] || { family: r.family, value: 0, qty: 0 }; f.value += r.value; f.qty += r.qty; }); return out;
};

/* ======================================================================= mouvements */
function acct(S, cid, num) { var d = Y.D(S, cid); return d.accounts.some(function (a) { return a.num === num; }); }
function postStock(S, cid, m, a, value, label) {
  var f = K.fam(a); if (!value) return null;
  var inc = value > 0, v = Math.abs(value);
  [f.stock, f.variation].forEach(function (n) { if (!acct(S, cid, n)) fail('Compte ' + n + ' absent du plan comptable.'); });
  return Y.postEntry(S, cid, { journal: K.D(S, cid).settings.journal || 'OD', date: m.date, ref: m.num, label: label, source: 'stock', lines: [
    { account: inc ? f.stock : f.variation, label: label, debit: v, credit: 0 },
    { account: inc ? f.variation : f.stock, label: label, debit: 0, credit: v }
  ] }, { silent: true });
}
K.addMove = function (S, cid, m, opts) {
  opts = opts || {}; if (!opts.system) need(S, m.type === 'inventaire' ? 'stock.count' : 'stock');
  var d = K.D(S, cid), a = K.article(S, cid, m.article), errs = [];
  if (!a) errs.push('Article introuvable.');
  if (!K.MOVE_TYPES[m.type]) errs.push('Type de mouvement inconnu.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(m.date || '')) errs.push('Date invalide.');
  if (!K.wh(S, cid, m.wh)) errs.push('Dépôt introuvable.');
  var q = Number(String(m.qty).replace(',', '.'));
  if (!q || (m.type !== 'ajustement' && m.type !== 'inventaire' && q < 0)) errs.push('Quantité invalide.');
  if (m.type === 'transfert' && (!K.wh(S, cid, m.whTo) || m.whTo === m.wh)) errs.push('Dépôt de destination invalide.');
  if (m.type === 'entree' && !(Number(m.unitCost) > 0) && !(a && a.cost > 0)) errs.push('Coût unitaire d’achat obligatoire.');
  if (errs.length) fail(errs);
  var out = m.type === 'sortie' || m.type === 'transfert' || ((m.type === 'ajustement' || m.type === 'inventaire') && q < 0);
  if (out) { var pos = K.position(S, cid, a.code, m.wh, '9999-12-31'), posAt = K.position(S, cid, a.code, m.wh, m.date); var avail = Math.min(pos.qty, posAt.qty); if (Math.abs(q) > avail + 1e-9) fail('Stock insuffisant au dépôt ' + m.wh + ' : ' + avail + ' ' + a.unit + ' disponible(s) pour ' + Math.abs(q) + ' demandé(s).'); }
  d.seq.move++;
  var rec = { id: U.uid('mv'), num: 'MV-' + m.date.slice(0, 4) + '-' + U.pad(d.seq.move, 5), seq: d.seq.move, date: m.date, type: m.type, article: a.code, wh: m.wh, whTo: m.whTo || '', qty: q, unitCost: m.type === 'entree' || (m.type !== 'transfert' && q > 0 && m.unitCost) ? U.round(m.unitCost || a.cost) : 0, ref: m.ref || '', motif: m.motif || '', source: m.source || 'manuel', countId: m.countId || '', by: who(S).by, at: new Date().toISOString(), entry: '' };
  d.moves.push(rec);
  var costs = {}; K.replay(S, cid, null, costs); rec.value = U.round(Math.abs(rec.qty) * (costs[rec.id] || rec.unitCost || a.cost));
  if (d.settings.mode === 'permanent' && rec.type !== 'transfert') {
    try { var e = postStock(S, cid, rec, a, out ? -rec.value : rec.value, K.MOVE_TYPES[rec.type][0] + ' · ' + a.label + ' · ' + Math.abs(rec.qty) + ' ' + a.unit); if (e) rec.entry = e.num || ''; }
    catch (x) { d.moves = d.moves.filter(function (z) { return z.id !== rec.id; }); throw x; }
  }
  if (!opts.silent) Y.audit(S, cid, 'Stocks · mouvement', rec.num, K.MOVE_TYPES[rec.type][0] + ' · ' + a.code + ' · ' + rec.qty + ' ' + a.unit);
  return rec;
};
/** Sorties automatiques depuis les factures émises dont les lignes portent un article de vente lié à un article stocké. */
K.syncSales = function (S, cid, opts) {
  need(S, 'stock'); opts = opts || {}; var d = K.D(S, cid), data = Y.D(S, cid), res = { created: 0, skipped: [] };
  data.docs.filter(function (x) { return x.type === 'FA' && x.status !== 'draft' && (!opts.from || x.date >= opts.from); }).forEach(function (doc) {
    (doc.lines || []).forEach(function (l) {
      var a = d.articles.find(function (z) { return z.itemCode && z.itemCode === l.itemCode; }); if (!a) return;
      if (d.moves.some(function (mv) { return mv.source === 'vente' && mv.ref === doc.num && mv.article === a.code; })) return;
      try { K.addMove(S, cid, { type: 'sortie', article: a.code, wh: a.wh, qty: +l.qty || 1, date: doc.date, ref: doc.num, motif: 'Vente', source: 'vente' }, { system: true, silent: true }); res.created++; }
      catch (x) { res.skipped.push(doc.num + ' · ' + a.code + ' : ' + x.message); }
    });
  });
  if (res.created) Y.audit(S, cid, 'Stocks · sorties depuis les factures', res.created + ' mouvement(s)', res.skipped.length + ' rejet(s)');
  return res;
};

/* ======================================================================= inventaire physique */
K.COUNT_STATUS = { en_cours: ['Comptage en cours', 'warn'], a_valider: ['Écarts à valider', 'info'], valide: ['Validé', 'ok'], annule: ['Annulé', ''] };
K.openCount = function (S, cid, c) {
  need(S, 'stock.count'); var d = K.D(S, cid);
  if (!K.wh(S, cid, c.wh)) fail('Dépôt introuvable.'); if (!/^\d{4}-\d{2}-\d{2}$/.test(c.date || '')) fail('Date d’inventaire invalide.');
  if (d.counts.some(function (x) { return x.wh === c.wh && ['en_cours', 'a_valider'].indexOf(x.status) > -1; })) fail('Un inventaire est déjà ouvert sur ce dépôt.');
  d.seq.count++;
  var fams = c.families && c.families.length ? c.families : Object.keys(K.FAMILIES);
  var lines = d.articles.filter(function (a) { return a.active !== false && fams.indexOf(a.family) > -1; }).map(function (a) { var p = K.position(S, cid, a.code, c.wh, c.date); return { article: a.code, label: a.label, unit: a.unit, theo: p.qty, cmup: p.cmup, counted: null, diff: 0, value: 0, comment: '' }; });
  var rec = { id: U.uid('inv'), ref: 'INV-' + c.date.slice(0, 4) + '-' + U.pad(d.seq.count, 3), label: c.label || 'Inventaire ' + c.wh, date: c.date, wh: c.wh, families: fams, blind: c.blind !== false && d.settings.blindCount, status: 'en_cours', lines: lines, openedBy: who(S), closedBy: null, validatedBy: null, total: 0 };
  d.counts.unshift(rec); Y.audit(S, cid, 'Stocks · inventaire ouvert', rec.ref, rec.wh + ' · ' + lines.length + ' article(s)'); return rec;
};
function count(S, cid, id) { var c = K.D(S, cid).counts.find(function (x) { return x.id === id; }); if (!c) fail('Inventaire introuvable.'); return c; }
K.setCounted = function (S, cid, id, article, qty, comment) {
  need(S, 'stock'); var c = count(S, cid, id); if (c.status !== 'en_cours') fail('Comptage clos.');
  var l = c.lines.find(function (x) { return x.article === article; }); if (!l) fail('Article hors inventaire.');
  var q = qty === '' || qty === null ? null : Number(String(qty).replace(',', '.')); if (q !== null && (isNaN(q) || q < 0)) fail('Quantité comptée invalide.');
  l.counted = q; if (comment !== undefined) l.comment = comment; l.diff = q === null ? 0 : Math.round((q - l.theo) * 1000) / 1000; l.value = U.round(l.diff * l.cmup); return l;
};
K.closeCount = function (S, cid, id) {
  need(S, 'stock'); var c = count(S, cid, id); if (c.status !== 'en_cours') fail('Comptage déjà clos.');
  var miss = c.lines.filter(function (l) { return l.counted === null; }); if (miss.length) fail(miss.length + ' article(s) non compté(s) : ' + miss.slice(0, 4).map(function (l) { return l.article; }).join(', ') + (miss.length > 4 ? '…' : '') + '.');
  c.status = 'a_valider'; c.closedBy = who(S); c.total = U.sum(c.lines, function (l) { return l.value; }); return c;
};
K.validateCount = function (S, cid, id, comment) {
  need(S, 'stock.count'); var c = count(S, cid, id); if (c.status !== 'a_valider') fail('Clôturez d’abord le comptage.');
  var me = (S.meta.currentUser || {}).id; if (!K._bypass && me && c.openedBy && c.openedBy.byId === me && c.closedBy && c.closedBy.byId === me) fail('Séparation des tâches : l’inventaire doit être validé par une autre personne que celle qui l’a ouvert et compté.');
  var big = c.lines.filter(function (l) { return l.diff && !l.comment; }); if (big.length && !comment) fail('Commentez les écarts (ligne ou commentaire général).');
  c.lines.forEach(function (l) { if (l.diff) K.addMove(S, cid, { type: 'inventaire', article: l.article, wh: c.wh, qty: l.diff, date: c.date, ref: c.ref, motif: l.comment || comment || 'Écart d’inventaire', source: 'inventaire', countId: c.id, unitCost: l.diff > 0 ? l.cmup : 0 }, { system: true, silent: true }); });
  c.status = 'valide'; c.validatedBy = Object.assign({ comment: comment || '' }, who(S)); c.total = U.sum(c.lines, function (l) { return l.value; });
  Y.audit(S, cid, 'Stocks · inventaire validé', c.ref, 'Écart net ' + U.fmt(c.total)); return c;
};
K.cancelCount = function (S, cid, id) { need(S, 'stock.count'); var c = count(S, cid, id); if (c.status === 'valide') fail('Inventaire validé : non annulable.'); c.status = 'annule'; return c; };

/* ======================================================================= comptabilité */
function bookBalance(S, cid, prefix, date) { var t = 0; Y.eachLine(S, cid, function (l) { if (l.account.indexOf(prefix) === 0) t += l.debit - l.credit; }, { to: date }); return t; }
/** Variation de stocks (inventaire intermittent) : solde comptable 31x/32x/33x/36x ↔ stock physique valorisé. */
K.variationPreview = function (S, cid, date) {
  var fam = K.byFamily(S, cid, date);
  return Object.keys(K.FAMILIES).map(function (k) {
    var f = K.FAMILIES[k], book = bookBalance(S, cid, f.stock.slice(0, 2), date), phys = U.round((fam[k] || {}).value || 0);
    return { family: k, label: f.label, stock: f.stock, variation: f.variation, book: book, physical: phys, diff: phys - book };
  }).filter(function (r) { return r.book || r.physical; });
};
K.postVariation = function (S, cid, date) {
  need(S, 'stock.count');
  var ref = 'STK-VAR-' + date, rows = K.variationPreview(S, cid, date).filter(function (r) { return r.diff; });
  if (Y.D(S, cid).entries.some(function (e) { return e.ref === ref && e.status === 'validated'; })) fail('Variation de stocks déjà comptabilisée au ' + U.frDate(date) + '.');
  if (!rows.length) fail('Aucune variation à comptabiliser : le stock comptable correspond au stock physique.');
  var lines = [];
  rows.forEach(function (r) {
    [r.stock, r.variation].forEach(function (n) { if (!acct(S, cid, n)) fail('Compte ' + n + ' absent du plan comptable.'); });
    var lab = 'Variation ' + r.label.toLowerCase() + ' · SI ' + U.fmt(r.book) + ' → SF ' + U.fmt(r.physical);
    if (r.diff > 0) { lines.push({ account: r.stock, label: lab, debit: r.diff, credit: 0 }); lines.push({ account: r.variation, label: lab, debit: 0, credit: r.diff }); }
    else { lines.push({ account: r.variation, label: lab, debit: -r.diff, credit: 0 }); lines.push({ account: r.stock, label: lab, debit: 0, credit: -r.diff }); }
  });
  var e = Y.postEntry(S, cid, { journal: 'OD', date: date, ref: ref, label: 'Variation des stocks au ' + U.frDate(date), source: 'inventory', lines: lines }, { closing: true });
  Y.audit(S, cid, 'Stocks · variation comptabilisée', ref, rows.length + ' famille(s)'); return e;
};
K.deprecSuggestions = function (S, cid, date) {
  var d = K.D(S, cid);
  return K.valuation(S, cid, date).filter(function (r) { return r.qty > 0 && r.dormant > d.settings.dormantDays; }).map(function (r) { var rate = r.dormant > 365 ? 50 : 25; return Object.assign({ rate: rate, amount: U.round(r.value * rate / 100), reason: 'Sans mouvement depuis ' + r.dormant + ' jours' }, r); });
};
K.postDeprec = function (S, cid, p) {
  need(S, 'stock.count'); var f = K.FAMILIES[p.family]; if (!f) fail('Famille inconnue.');
  var amt = U.round(p.amount); if (!amt) fail('Montant obligatoire (négatif pour une reprise).');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date || '')) fail('Date invalide.');
  [f.deprec, K.DEP_ACCOUNT, K.REV_ACCOUNT].forEach(function (n) { if (!acct(S, cid, n)) fail('Compte ' + n + ' absent du plan comptable.'); });
  var lab = (amt > 0 ? 'Dépréciation ' : 'Reprise de dépréciation ') + f.label.toLowerCase() + (p.label ? ' · ' + p.label : '');
  var e = Y.postEntry(S, cid, { journal: 'OD', date: p.date, ref: 'STK-DEP', label: lab, source: 'inventory', lines: amt > 0
    ? [{ account: K.DEP_ACCOUNT, label: lab, debit: amt, credit: 0, section: p.section || '' }, { account: f.deprec, label: lab, debit: 0, credit: amt }]
    : [{ account: f.deprec, label: lab, debit: -amt, credit: 0 }, { account: K.REV_ACCOUNT, label: lab, debit: 0, credit: -amt, section: p.section || '' }] }, { closing: true });
  Y.audit(S, cid, 'Stocks · dépréciation', f.label, U.fmt(amt)); return e;
};
K.alerts = function (S, cid) {
  var v = K.valuation(S, cid, S.meta.today), d = K.D(S, cid), out = [];
  var low = v.filter(function (r) { return r.below && r.minQty > 0; }); if (low.length) out.push({ level: 'warn', title: low.length + ' article(s) sous le seuil de réapprovisionnement', text: low.slice(0, 3).map(function (r) { return r.article + ' (' + r.qty + '/' + r.minQty + ')'; }).join(', '), page: 'stocks', tab: 'articles', module: 'stocks' });
  var dorm = v.filter(function (r) { return r.isDormant; }); if (dorm.length) out.push({ level: 'info', title: dorm.length + ' article(s) dormant(s)', text: 'Sans mouvement depuis plus de ' + d.settings.dormantDays + ' jours : dépréciation à étudier.', page: 'stocks', tab: 'valorisation', module: 'stocks' });
  var open = d.counts.filter(function (c) { return c.status === 'a_valider'; }); if (open.length) out.push({ level: 'warn', title: open.length + ' inventaire(s) à valider', text: open.map(function (c) { return c.ref; }).join(', '), page: 'stocks', tab: 'inventaires', module: 'stocks' });
  return out;
};

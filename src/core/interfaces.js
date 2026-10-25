/*
 * myyiel · contrats d'échange entre modules (comptabilité ⇄ paie ⇄ GTA).
 * Un module producteur (paie) construit un LOT D'ÉCRITURES au format « myyiel.journal-batch/1 » ;
 * la comptabilité le contrôle intégralement puis l'intègre en une seule fois (tout ou rien).
 * Spécification : docs/paie/03-interface-comptable.md · Schéma JSON : docs/paie/journal-batch.schema.json
 */
import { Y } from './registry.js';

var U = Y.util;
function fail(m) { throw new Y.BizError(m); }

Y.BATCH_FORMAT = 'myyiel.journal-batch/1';
Y.TIME_FORMAT = 'myyiel.time-events/1';

/** Empreinte canonique d'un lot (contrôle d'intégrité de bout en bout). */
Y.batchChecksum = function (b) {
  var s = b.source.module + '|' + b.source.ref + '|' + b.entries.map(function (e) {
    return e.journal + '|' + e.date + '|' + e.ref + '|' + e.lines.map(function (l) { return l.account + ':' + (l.debit || 0) + ':' + (l.credit || 0) + ':' + ((l.tiers && l.tiers.code) || ''); }).join(',');
  }).join(';');
  return U.fnv(s);
};

/** Contrôle de forme et d'équilibre, sans accès aux données comptables. */
Y.validateBatchShape = function (b) {
  var errs = [];
  if (!b || b.format !== Y.BATCH_FORMAT) errs.push('Format inconnu : « ' + Y.BATCH_FORMAT + ' » attendu.');
  if (!b || !b.source || !b.source.module || !b.source.ref) errs.push('Source (module, référence) obligatoire.');
  if (!b || !Array.isArray(b.entries) || !b.entries.length) errs.push('Le lot ne contient aucune écriture.');
  if (errs.length) return errs;
  var td = 0, tc = 0;
  b.entries.forEach(function (e, i) {
    var n = 'Écriture ' + (i + 1) + ' (' + (e.ref || '?') + ') : ';
    if (!e.journal) errs.push(n + 'journal manquant.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date || '')) errs.push(n + 'date invalide.');
    if (!e.lines || e.lines.length < 2) errs.push(n + 'au moins deux lignes.');
    var d = 0, c = 0;
    (e.lines || []).forEach(function (l) {
      if (!Number.isInteger(l.debit || 0) || !Number.isInteger(l.credit || 0)) errs.push(n + 'montants entiers obligatoires (XAF).');
      d += l.debit || 0; c += l.credit || 0;
    });
    if (d !== c) errs.push(n + 'déséquilibrée (' + U.fmt(d) + ' ≠ ' + U.fmt(c) + ').');
    td += d; tc += c;
  });
  if (b.totals && (b.totals.debit !== td || b.totals.credit !== tc)) errs.push('Totaux du lot incohérents avec les lignes.');
  if (b.checksum && b.checksum !== Y.batchChecksum(b)) errs.push('Empreinte du lot invalide : contenu altéré pendant la transmission.');
  return errs;
};

/**
 * Intègre un lot en comptabilité. Tout ou rien :
 *  1. forme, équilibre, empreinte ; 2. idempotence (source.ref déjà intégrée → refus) ;
 *  3. comptes existants et imputables, périodes ouvertes (checkEntry) ; 4. création des tiers manquants ; 5. validation.
 */
Y.acceptBatch = function (S, cid, b, opts) {
  opts = opts || {};
  var d = Y.D(S, cid), errs = Y.validateBatchShape(b);
  if (errs.length) fail(errs);
  if (b.company && b.company !== cid) fail('Lot destiné à une autre société.');
  d.interfaceLog = d.interfaceLog || [];
  var prev = d.interfaceLog.find(function (x) { return x.ref === b.source.ref && x.status === 'integre'; });
  if (prev && !opts.allowReplay) fail('Lot ' + b.source.ref + ' déjà intégré le ' + U.frDate(prev.at.slice(0, 10)) + ' (' + prev.entries.join(', ') + ').');
  var created = [];
  function tiersId(t) {
    if (!t) return '';
    var x = d.tiers.find(function (z) { return z.code === t.code; });
    if (!x) { x = Y.createTiers(S, cid, { type: t.type || 'personnel', code: t.code, name: t.name || t.code, collective: t.collective || '422' }); created.push(x.id); }
    return x.id;
  }
  var prepared = b.entries.map(function (e) {
    return { journal: e.journal, date: e.date, pieceDate: e.pieceDate || e.date, ref: e.ref, label: e.label, source: b.source.module === 'paie' ? (e.kind || 'payroll') : b.source.module,
      lines: e.lines.map(function (l) { return { account: String(l.account), label: l.label || e.label, debit: l.debit || 0, credit: l.credit || 0, tiersId: tiersId(l.tiers), section: l.section || '' }; }), extRef: b.source.ref };
  });
  var all = [];
  prepared.forEach(function (e, i) { Y.checkEntry(S, cid, e, {}).forEach(function (m) { all.push('Écriture ' + (i + 1) + ' (' + e.ref + ') : ' + m); }); });
  if (all.length) {
    d.tiers = d.tiers.filter(function (t) { return created.indexOf(t.id) < 0; });
    d.interfaceLog.unshift({ ref: b.source.ref, module: b.source.module, at: new Date().toISOString(), status: 'rejete', errors: all.slice(0, 20), entries: [], total: b.totals ? b.totals.debit : 0 });
    fail(all);
  }
  var nums = prepared.map(function (e) { return Y.postEntry(S, cid, e, { silent: true }).num; });
  var tot = U.sum(b.entries, function (e) { return U.sum(e.lines, function (l) { return l.debit || 0; }); });
  d.interfaceLog.unshift({ ref: b.source.ref, module: b.source.module, label: b.label || '', at: new Date().toISOString(), status: 'integre', entries: nums, total: tot, checksum: b.checksum || '' });
  Y.audit(S, cid, 'Intégration d’un lot', b.source.module + ' · ' + b.source.ref, nums.join(', ') + ' · ' + U.fmt(tot));
  return { entries: nums, total: tot };
};

/** Fabrique un lot conforme (utilisé par la paie, la GTA et tout futur module). */
Y.makeBatch = function (cid, module, ref, label, entries, meta) {
  var b = { format: Y.BATCH_FORMAT, company: cid, source: Object.assign({ module: module, ref: ref, generatedAt: new Date().toISOString() }, meta || {}), label: label, entries: entries };
  var td = 0, tc = 0; entries.forEach(function (e) { e.lines.forEach(function (l) { td += l.debit || 0; tc += l.credit || 0; }); });
  b.totals = { debit: td, credit: tc, lines: U.sum(entries, function (e) { return e.lines.length; }) };
  b.checksum = Y.batchChecksum(b);
  return b;
};

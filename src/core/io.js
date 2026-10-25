/*
 * myyiel Comptabilité · imports et exports (format neutre : tableaux de lignes).
 * Les fichiers .xlsx sont lus/écrits par la couche UI (SheetJS) puis passés ici sous forme de lignes.
 * Spécification des formats : docs/06-imports-exports.md
 */
import { Y } from './registry.js';

var U = Y.util;

/* -------------------------------------------------------------------- CSV */
Y.csvParse = function (text) {
  text = String(text || '').replace(/^﻿/, '');
  var first = text.split(/\r?\n/)[0] || '';
  var sep = (first.match(/;/g) || []).length >= (first.match(/,/g) || []).length ? ';' : ',';
  if ((first.match(/\t/g) || []).length > (first.match(new RegExp(sep, 'g')) || []).length) sep = '\t';
  var rows = [], row = [], cell = '', q = false;
  for (var i = 0; i < text.length; i++) {
    var ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; continue; }
    if (ch === '"') q = true;
    else if (ch === sep) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(function (r) { return r.some(function (c) { return String(c).trim() !== ''; }); });
};
Y.csvStringify = function (rows, sep) {
  sep = sep || ';';
  return '﻿' + rows.map(function (r) {
    return r.map(function (c) { c = c == null ? '' : String(c); return /[";\n,\t]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(sep);
  }).join('\r\n');
};
Y.rowsToObjects = function (rows) {
  var h = rows[0].map(normKey);
  return rows.slice(1).map(function (r) { var o = {}; h.forEach(function (k, i) { o[k] = r[i] == null ? '' : r[i]; }); return o; });
};
function normKey(k) { return String(k || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, ''); }
Y.normKey = normKey;
Y.parseDate = function (v) {
  if (v == null || v === '') return '';
  if (typeof v === 'number' && v > 20000 && v < 80000) { var d = new Date(Math.round((v - 25569) * 86400000)); return U.ymd(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); }
  var s = String(v).trim();
  var m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return m[1] + '-' + U.pad(m[2], 2) + '-' + U.pad(m[3], 2);
  if ((m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/))) return m[3] + '-' + U.pad(m[2], 2) + '-' + U.pad(m[1], 2);
  if ((m = s.match(/^(\d{4})(\d{2})(\d{2})$/))) return m[1] + '-' + m[2] + '-' + m[3];
  return '';
};
function bool(v) { return /^(1|oui|yes|true|vrai|x)$/i.test(String(v || '').trim()); }

/* ----------------------------------------------------- définitions d'import */
Y.IMPORTS = {
  accounts: {
    label: 'Plan comptable (comptes personnalisés)', file: 'modele-plan-comptable',
    columns: [['numero', 'Numéro', true, '6055'], ['intitule', 'Intitulé', true, 'Fournitures de bureau non stockables'], ['intituleen', 'Intitulé anglais', false, 'Office supplies'], ['sens', 'Sens (D ou C)', false, 'D'], ['nature', 'Nature (general, tiers, tresorerie)', false, 'general'], ['lettrable', 'Lettrable (oui/non)', false, 'non'], ['analytique', 'Analytique obligatoire (oui/non)', false, 'oui'], ['codetva', 'Code TVA par défaut', false, 'TVA19']],
    synonyms: { numero: ['num', 'compte', 'comptenum', 'numerocompte', 'account'], intitule: ['libelle', 'label', 'comptelib', 'intitulefr'], intituleen: ['labelen', 'english'] },
    run: function (S, cid, o) { var ex = Y.account(S, cid, String(o.numero)); if (ex) { Y.updateAccount(S, cid, ex.num, { label: o.intitule || ex.label, labelEn: o.intituleen || ex.labelEn }); return 'updated'; } Y.createAccount(S, cid, { num: String(o.numero).trim(), label: o.intitule, labelEn: o.intituleen, sens: o.sens ? String(o.sens).toUpperCase() : undefined, nature: o.nature || undefined, lettrable: o.lettrable !== '' ? bool(o.lettrable) : undefined, analyticRequired: o.analytique !== '' ? bool(o.analytique) : undefined, taxCode: o.codetva || undefined }); return 'created'; }
  },
  tiers: {
    label: 'Clients, fournisseurs et personnel', file: 'modele-tiers',
    columns: [['type', 'Type (client, fournisseur, personnel)', true, 'client'], ['code', 'Code (vide = automatique)', false, ''], ['raisonsociale', 'Raison sociale / nom', true, 'Boulangerie du Littoral SARL'], ['niu', 'NIU', false, 'M012345678901A'], ['rccm', 'RCCM', false, 'RC/DLA/2020/B/1234'], ['regime', 'Régime fiscal', false, 'Réel'], ['collectif', 'Compte collectif', false, '4111'], ['email', 'E-mail', false, 'compta@client.cm'], ['telephone', 'Téléphone', false, '+237 6 77 00 00 00'], ['mobilemoney', 'N° Mobile Money', false, '+237 6 77 00 00 00'], ['operateur', 'Opérateur (MTN, Orange)', false, 'MTN'], ['adresse', 'Adresse', false, 'Akwa'], ['ville', 'Ville', false, 'Douala'], ['delai', 'Délai de paiement (jours)', false, '30'], ['plafond', 'Plafond de crédit (XAF)', false, '5000000']],
    synonyms: { raisonsociale: ['nom', 'name', 'denomination', 'client', 'fournisseur'], telephone: ['tel', 'phone'], mobilemoney: ['momo', 'om'], delai: ['termes', 'conditions', 'echeance'] },
    run: function (S, cid, o) { var t = String(o.type || '').toLowerCase(); t = /^c/.test(t) ? 'client' : (/^f/.test(t) ? 'fournisseur' : 'personnel'); Y.createTiers(S, cid, { type: t, code: o.code || undefined, name: o.raisonsociale, niu: o.niu, rccm: o.rccm, regime: o.regime || 'Réel', collective: o.collectif || undefined, email: o.email, phone: o.telephone, momo: o.mobilemoney, momoOp: o.operateur, address: o.adresse, city: o.ville, terms: +o.delai || 30, creditLimit: U.parseAmount(o.plafond) }); return 'created'; }
  },
  items: {
    label: 'Articles et tarifs', file: 'modele-articles',
    columns: [['code', 'Code', true, 'FORM-J'], ['designation', 'Désignation', true, 'Journée de formation inter-entreprises'], ['unite', 'Unité', false, 'jour'], ['prixht', 'Prix HT (XAF)', true, '450000'], ['codetva', 'Code TVA', false, 'TVA19'], ['compte', 'Compte de produit (70x)', true, '7062'], ['section', 'Section analytique', false, 'CNS']],
    synonyms: { designation: ['libelle', 'label'], prixht: ['prix', 'price', 'pu'] },
    run: function (S, cid, o) { Y.createItem(S, cid, { code: o.code, label: o.designation, unit: o.unite || 'unité', price: U.parseAmount(o.prixht), taxCode: o.codetva || 'TVA19', account: String(o.compte), section: o.section }); return 'created'; }
  },
  entries: {
    label: 'Écritures comptables', file: 'modele-ecritures', grouped: true,
    columns: [['journal', 'Code journal', true, 'ACH'], ['date', 'Date (JJ/MM/AAAA)', true, '05/10/2026'], ['piece', 'N° de pièce (regroupement)', true, 'P1'], ['reference', 'Référence externe', false, 'F-2026-0331'], ['libelle', 'Libellé de l’écriture', true, 'Fournitures de bureau'], ['compte', 'Compte', true, '6055'], ['tiers', 'Code tiers', false, ''], ['libelleligne', 'Libellé de ligne', false, ''], ['debit', 'Débit', false, '100000'], ['credit', 'Crédit', false, '0'], ['section', 'Section analytique', false, 'STR'], ['codetva', 'Code TVA', false, 'TVA19']],
    examples: [['ACH', '05/10/2026', 'P1', 'F-2026-0331', 'Fournitures de bureau', '6055', '', 'Fournitures', '100000', '0', 'STR', 'TVA19'], ['ACH', '05/10/2026', 'P1', 'F-2026-0331', 'Fournitures de bureau', '4452', '', 'TVA récupérable 19,25 %', '19250', '0', '', 'TVA19'], ['ACH', '05/10/2026', 'P1', 'F-2026-0331', 'Fournitures de bureau', '4011', 'F0001', 'Fournisseur', '0', '119250', '', '']],
    synonyms: { journal: ['journalcode', 'code'], date: ['ecrituredate', 'datecomptable'], piece: ['ecriturenum', 'numpiece', 'numero'], compte: ['comptenum', 'account'], tiers: ['compauxnum', 'codetiers'], libelle: ['ecriturelib'], reference: ['pieceref', 'ref'] },
    run: function (S, cid, group, opts) {
      var o0 = group[0], tiersByCode = function (c) { var t = c ? Y.tiers(S, cid, String(c).trim()) : null; return t ? t.id : ''; };
      var e = { journal: String(o0.journal).trim().toUpperCase(), date: Y.parseDate(o0.date), ref: o0.reference || '', label: o0.libelle, source: 'import',
        lines: group.map(function (o) { return { account: String(o.compte).trim(), tiersId: tiersByCode(o.tiers), label: o.libelleligne || o.libelle, debit: U.parseAmount(o.debit), credit: U.parseAmount(o.credit), section: o.section || '', taxCode: o.codetva || '' }; }) };
      if (opts && opts.asDraft) { Y.saveDraft(S, cid, e); return 'draft'; }
      Y.postEntry(S, cid, e, { silent: true }); return 'posted';
    },
    key: function (o) { return [o.journal, o.date, o.piece].join('|'); }
  },
  bank: {
    label: 'Relevé bancaire ou Mobile Money', file: 'modele-releve', bank: true,
    columns: [['date', 'Date', true, '21/10/2026'], ['libelle', 'Libellé', true, 'VIR RECU CLIENT'], ['reference', 'Référence', false, 'VIR 4471'], ['montant', 'Montant (+ encaissement, − décaissement)', false, '62000'], ['debit', 'Débit (sortie)', false, ''], ['credit', 'Crédit (entrée)', false, '']],
    synonyms: { date: ['dateoperation', 'datevaleur'], libelle: ['label', 'description', 'operation'], reference: ['ref', 'transaction', 'id'], montant: ['amount', 'valeur'] },
    toRow: function (o) { var amt = o.montant !== '' && o.montant != null ? U.parseAmount(o.montant) : U.parseAmount(o.credit) - U.parseAmount(o.debit); return { date: Y.parseDate(o.date), label: o.libelle, ref: o.reference, amount: amt }; }
  },
  assets: {
    label: 'Registre des immobilisations', file: 'modele-immobilisations',
    columns: [['designation', 'Désignation', true, 'Véhicule utilitaire'], ['compte', 'Compte (21 à 25)', true, '245'], ['miseenservice', 'Date de mise en service', true, '01/05/2023'], ['valeur', 'Valeur d’origine HT', true, '18900000'], ['duree', 'Durée (années)', true, '4'], ['mode', 'Mode (L ou D)', false, 'L'], ['section', 'Section analytique', false, 'STR'], ['localisation', 'Localisation', false, 'Siège'], ['piece', 'Pièce d’origine', false, 'F-2023-0067']],
    synonyms: { designation: ['libelle', 'label'], miseenservice: ['date', 'dateservice'], valeur: ['vo', 'valeurorigine', 'montant'] },
    run: function (S, cid, o, opts) {
      var a = Y.createAsset(S, cid, { label: o.designation, account: String(o.compte), serviceDate: Y.parseDate(o.miseenservice), acqDate: Y.parseDate(o.miseenservice), value: U.parseAmount(o.valeur), years: +o.duree, method: String(o.mode || 'L').toUpperCase() === 'D' ? 'D' : 'L', section: o.section || 'STR', location: o.localisation, piece: o.piece });
      var fy = (opts && opts.fromYear) || U.year(S.meta.today);
      for (var y = U.year(a.serviceDate); y < fy; y++) for (var m = 1; m <= 12; m++) if (Y.assetMonthDot(a, y, m)) a.posted[y + '-' + U.pad(m, 2)] = true;
      return 'created';
    }
  },
  opening: {
    label: 'Soldes d’ouverture (balance de reprise)', file: 'modele-soldes-ouverture', single: true,
    columns: [['compte', 'Compte', true, '5211'], ['tiers', 'Code tiers (comptes collectifs)', false, ''], ['libelle', 'Libellé', false, 'Reprise de solde'], ['debit', 'Débit', false, '1000000'], ['credit', 'Crédit', false, '0']],
    examples: [['5211', '', 'Banque principale', '12500000', '0'], ['4111', 'C0001', 'Créance client reprise', '3000000', '0'], ['101', '', 'Capital social', '0', '15500000']],
    synonyms: { compte: ['comptenum', 'account'], tiers: ['codetiers', 'compauxnum'] },
    runAll: function (S, cid, objs, opts) {
      var year = (opts && opts.year) || U.year(S.meta.today);
      if (Y.validated(S, cid).some(function (e) { return e.journal === 'AN' && U.year(e.date) === year; })) throw new Y.BizError('Des à-nouveaux existent déjà pour ' + year + ' : contre-passez-les avant une nouvelle reprise.');
      if (!Y.fiscalYear(S, cid, year)) Y.createFiscalYear(S, cid, year);
      var lines = objs.map(function (o) { var t = o.tiers ? Y.tiers(S, cid, String(o.tiers).trim()) : null; return { account: String(o.compte).trim(), tiersId: t ? t.id : '', label: o.libelle || 'Reprise de solde', debit: U.parseAmount(o.debit), credit: U.parseAmount(o.credit) }; });
      Y.postEntry(S, cid, { journal: 'AN', date: year + '-01-01', ref: 'REPRISE-' + year, label: 'Reprise des soldes d’ouverture ' + year, lines: lines, source: 'opening-import' }, { system: true });
      return lines.length;
    }
  }
};
/** Associe les colonnes du fichier aux champs attendus (en-têtes normalisés + synonymes). */
Y.mapColumns = function (type, header) {
  var def = Y.IMPORTS[type], map = {}, keys = header.map(normKey), used = {};
  function strip(l) { return normKey(String(l).replace(/\(.*?\)/g, '')); }
  def.columns.forEach(function (c) {
    var cands = [c[0], normKey(c[1]), strip(c[1])].concat((def.synonyms && def.synonyms[c[0]]) || []);
    var i = keys.findIndex(function (k, j) { return !used[j] && cands.indexOf(k) > -1; });
    if (i > -1) { map[c[0]] = i; used[i] = 1; }
  });
  def.columns.forEach(function (c) {
    if (map[c[0]] !== undefined) return;
    var i = keys.findIndex(function (k, j) { return !used[j] && (k.indexOf(c[0]) === 0 || (k.length > 3 && k.indexOf(c[0]) > -1)); });
    map[c[0]] = i; if (i > -1) used[i] = 1;
  });
  return map;
};
/** Contrôle sans rien écrire : rejoue l'import sur une copie de l'état. */
Y.dryRunImport = function (S, cid, type, rows, map, opts) {
  var copy = U.clone(S);
  return Y.runImport(copy, cid, type, rows, map, opts);
};
Y.runImport = function (S, cid, type, rows, map, opts) {
  var def = Y.IMPORTS[type], res = { ok: 0, errors: [], created: 0, updated: 0, total: 0 };
  var objs = rows.map(function (r, i) { var o = { _line: i + 2 }; def.columns.forEach(function (c) { var idx = map[c[0]]; o[c[0]] = idx >= 0 && idx !== undefined ? r[idx] : ''; }); return o; });
  objs.forEach(function (o) { def.columns.forEach(function (c) { if (c[2] && (o[c[0]] === '' || o[c[0]] == null) && !(type === 'bank' && (c[0] === 'montant'))) o._missing = (o._missing || []).concat(c[1]); }); });
  if (type === 'bank') {
    var bad = [], good = [];
    objs.forEach(function (o) { var r = def.toRow(o); if (!r.date) bad.push('Ligne ' + o._line + ' : date illisible.'); else if (!r.amount) bad.push('Ligne ' + o._line + ' : montant nul.'); else good.push(r); });
    if (!opts || !opts.bankId) { res.errors.push('Choisissez le compte de trésorerie.'); return res; }
    var r2 = Y.importStatement(S, cid, opts.bankId, good);
    res.ok = r2.added; res.skipped = r2.skipped; res.errors = bad.concat(r2.errors); res.total = objs.length; return res;
  }
  if (def.runAll) {
    try { res.ok = def.runAll(S, cid, objs, opts); } catch (e) { res.errors = res.errors.concat(e.messages || [e.message]); }
    res.total = objs.length; return res;
  }
  if (def.grouped) {
    var groups = {}, order = [];
    objs.forEach(function (o) { var k = def.key(o); if (!groups[k]) { groups[k] = []; order.push(k); } groups[k].push(o); });
    order.forEach(function (k) {
      res.total++;
      var g = groups[k];
      if (g.some(function (o) { return o._missing; })) { res.errors.push('Pièce ' + g[0].piece + ' (ligne ' + g[0]._line + ') : colonnes manquantes ' + g.find(function (o) { return o._missing; })._missing.join(', ') + '.'); return; }
      try { var r = def.run(S, cid, g, opts); res.ok++; res[r] = (res[r] || 0) + 1; }
      catch (e) { res.errors.push('Pièce ' + g[0].piece + ' (ligne ' + g[0]._line + ') : ' + (e.messages || [e.message]).join(' · ')); }
    });
    return res;
  }
  objs.forEach(function (o) {
    res.total++;
    if (o._missing) { res.errors.push('Ligne ' + o._line + ' : ' + o._missing.join(', ') + ' manquant(s).'); return; }
    try { var r = def.run(S, cid, o, opts); res.ok++; if (r === 'created') res.created++; if (r === 'updated') res.updated++; }
    catch (e) { res.errors.push('Ligne ' + o._line + ' : ' + (e.messages || [e.message]).join(' · ')); }
  });
  return res;
};
Y.importTemplate = function (type) {
  var def = Y.IMPORTS[type];
  return [def.columns.map(function (c) { return c[1]; })].concat(def.examples ? def.examples.map(function (r) { return r.slice(); }) : [def.columns.map(function (c) { return c[3]; })]);
};

/* ---------------------------------------------------------- sauvegarde */
Y.exportBackup = function (S) { return JSON.stringify({ format: 'myyiel-compta-backup', version: 1, exportedAt: new Date().toISOString(), state: S }, null, 1); };
Y.importBackup = function (text) {
  var o = JSON.parse(text);
  if (!o || o.format !== 'myyiel-compta-backup' || !o.state || !o.state.companies) throw new Y.BizError('Fichier de sauvegarde myyiel invalide.');
  return o.state;
};

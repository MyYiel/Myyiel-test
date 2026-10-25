/*
 * myyiel Comptabilité · états financiers SYSCOHADA révisé, clôture, à-nouveaux, FEC, indicateurs.
 * Tables de correspondance comptes → lignes : docs/07-etats-financiers.md
 */
import { Y } from './registry.js';

var U = Y.util;
function fail(m) { throw new Y.BizError(m); }
function startsAny(num, list) { for (var i = 0; i < list.length; i++) if (num.indexOf(list[i]) === 0) return true; return false; }

/* --------------------------------------------------------------- bilan */
Y.BILAN_ACTIF = [
  ['AD', 'Immobilisations incorporelles', 'Intangible assets'], ['AI', 'Immobilisations corporelles', 'Property, plant and equipment'],
  ['AP', 'Avances et acomptes versés sur immobilisations', 'Advances on fixed assets'], ['AQ', 'Immobilisations financières', 'Financial assets'],
  ['AZ', 'TOTAL ACTIF IMMOBILISÉ', 'TOTAL NON-CURRENT ASSETS', 1],
  ['BA', 'Actif circulant HAO', 'Non-ordinary current assets'], ['BB', 'Stocks et encours', 'Inventories'], ['BH', 'Fournisseurs, avances versées', 'Advances to suppliers'],
  ['BI', 'Clients', 'Trade receivables'], ['BJ', 'Autres créances', 'Other receivables'], ['BK', 'TOTAL ACTIF CIRCULANT', 'TOTAL CURRENT ASSETS', 1],
  ['BQ', 'Titres de placement', 'Marketable securities'], ['BR', 'Valeurs à encaisser', 'Items for collection'], ['BS', 'Banques, monnaie électronique, caisse et assimilés', 'Cash, mobile money and banks'],
  ['BT', 'TOTAL TRÉSORERIE-ACTIF', 'TOTAL CASH ASSETS', 1], ['BU', 'Écart de conversion-actif', 'Translation adjustment (assets)'], ['BZ', 'TOTAL GÉNÉRAL', 'TOTAL ASSETS', 2]
];
Y.BILAN_PASSIF = [
  ['CA', 'Capital', 'Share capital'], ['CB', 'Apporteurs capital non appelé (−)', 'Uncalled capital (−)'], ['CD', 'Primes liées au capital social', 'Share premiums'], ['CE', 'Écarts de réévaluation', 'Revaluation surplus'],
  ['CF', 'Réserves indisponibles', 'Restricted reserves'], ['CG', 'Réserves libres', 'Free reserves'], ['CH', 'Report à nouveau (+ ou −)', 'Retained earnings'], ['CJ', 'Résultat net de l’exercice (bénéfice + ou perte −)', 'Net income for the year'],
  ['CL', 'Subventions d’investissement', 'Investment grants'], ['CM', 'Provisions réglementées', 'Regulated provisions'], ['CP', 'TOTAL CAPITAUX PROPRES ET RESSOURCES ASSIMILÉES', 'TOTAL EQUITY', 1],
  ['DA', 'Emprunts et dettes financières diverses', 'Borrowings'], ['DB', 'Dettes de location-acquisition', 'Lease-purchase liabilities'], ['DC', 'Provisions pour risques et charges', 'Provisions for risks and charges'],
  ['DD', 'TOTAL DETTES FINANCIÈRES ET RESSOURCES ASSIMILÉES', 'TOTAL FINANCIAL DEBT', 1], ['DF', 'TOTAL RESSOURCES STABLES', 'TOTAL LONG-TERM FUNDS', 1],
  ['DH', 'Dettes circulantes HAO', 'Non-ordinary current liabilities'], ['DI', 'Clients, avances reçues', 'Advances from customers'], ['DJ', 'Fournisseurs d’exploitation', 'Trade payables'],
  ['DK', 'Dettes fiscales et sociales', 'Tax and social liabilities'], ['DM', 'Autres dettes', 'Other payables'], ['DN', 'Provisions pour risques à court terme', 'Short-term provisions'],
  ['DP', 'TOTAL PASSIF CIRCULANT', 'TOTAL CURRENT LIABILITIES', 1], ['DQ', 'Banques, crédits d’escompte', 'Discount facilities'], ['DR', 'Banques, établissements financiers et crédits de trésorerie', 'Bank overdrafts'],
  ['DT', 'TOTAL TRÉSORERIE-PASSIF', 'TOTAL CASH LIABILITIES', 1], ['DV', 'Écart de conversion-passif', 'Translation adjustment (liabilities)'], ['DZ', 'TOTAL GÉNÉRAL', 'TOTAL EQUITY AND LIABILITIES', 2]
];
function bilanFromBalances(bal) {
  var A = {}, P = {}, res = 0;
  function a(ref, brut, amort) { var x = A[ref] || (A[ref] = { brut: 0, amort: 0 }); x.brut += brut || 0; x.amort += amort || 0; }
  function p(ref, v) { P[ref] = (P[ref] || 0) + v; }
  Object.keys(bal).forEach(function (num) {
    var n = bal[num].d - bal[num].c; if (!n) return;
    var c = num[0];
    if ('678'.indexOf(c) > -1) { res += -n; return; }
    if (c === '2') {
      if (/^28|^29/.test(num)) {
        var k = num[2];
        var ref = k === '1' ? 'AD' : (k === '5' ? 'AP' : ('67'.indexOf(k) > -1 ? 'AQ' : 'AI'));
        a(ref, 0, -n); return;
      }
      a(/^21/.test(num) ? 'AD' : (/^25/.test(num) ? 'AP' : (/^2[67]/.test(num) ? 'AQ' : 'AI')), n, 0); return;
    }
    if (c === '3') { if (/^39/.test(num)) a('BB', 0, -n); else a('BB', n, 0); return; }
    if (c === '4') {
      if (/^48/.test(num)) { if (n > 0) a('BA', n); else p('DH', -n); return; }
      if (/^409/.test(num)) { if (n > 0) a('BH', n); else p('DJ', -n); return; }
      if (/^491/.test(num)) { a('BI', 0, -n); return; }
      if (/^419/.test(num)) { if (n < 0) p('DI', -n); else a('BI', n); return; }
      if (/^41/.test(num)) { if (n > 0) a('BI', n); else p('DI', -n); return; }
      if (/^40/.test(num)) { if (n < 0) p('DJ', -n); else a('BH', n); return; }
      if (/^4[234]/.test(num)) { if (n > 0) a('BJ', n); else p('DK', -n); return; }
      if (/^478/.test(num)) { a('BU', n); return; }
      if (/^479/.test(num)) { p('DV', -n); return; }
      if (/^499/.test(num)) { p('DN', -n); return; }
      if (/^49/.test(num)) { a('BJ', 0, -n); return; }
      if (n > 0) a('BJ', n); else p('DM', -n); return;
    }
    if (c === '5') {
      if (/^59/.test(num)) { a('BS', 0, -n); return; }
      if (/^50/.test(num)) { a('BQ', n); return; }
      if (/^51/.test(num)) { a('BR', n); return; }
      if (/^565/.test(num)) { p('DQ', -n); return; }
      if (/^56/.test(num)) { p('DR', -n); return; }
      if (n > 0) a('BS', n); else p('DR', -n); return;
    }
    if (c === '1') {
      var v = -n;
      if (/^109/.test(num)) p('CB', v);
      else if (/^10[1-4]/.test(num) || num === '10') p('CA', v);
      else if (/^105/.test(num)) p('CD', v);
      else if (/^106/.test(num)) p('CE', v);
      else if (/^11[1-3]/.test(num)) p('CF', v);
      else if (/^11/.test(num)) p('CG', v);
      else if (/^12/.test(num)) p('CH', v);
      else if (/^13/.test(num)) p('CJ', v);
      else if (/^14/.test(num)) p('CL', v);
      else if (/^15/.test(num)) p('CM', v);
      else if (/^17/.test(num)) p('DB', v);
      else if (/^19/.test(num)) p('DC', v);
      else p('DA', v);
    }
  });
  p('CJ', res);
  function s(list) { return list.reduce(function (o, r) { var x = A[r] || { brut: 0, amort: 0 }; o.brut += x.brut; o.amort += x.amort; return o; }, { brut: 0, amort: 0 }); }
  A.AZ = s(['AD', 'AI', 'AP', 'AQ']); A.BK = s(['BA', 'BB', 'BH', 'BI', 'BJ']); A.BT = s(['BQ', 'BR', 'BS']);
  A.BZ = s(['AZ', 'BK', 'BT', 'BU']);
  function t(list) { return list.reduce(function (o, r) { return o + (P[r] || 0); }, 0); }
  P.CP = t(['CA', 'CB', 'CD', 'CE', 'CF', 'CG', 'CH', 'CJ', 'CL', 'CM']); P.DD = t(['DA', 'DB', 'DC']); P.DF = P.CP + P.DD;
  P.DP = t(['DH', 'DI', 'DJ', 'DK', 'DM', 'DN']); P.DT = t(['DQ', 'DR']); P.DZ = P.DF + P.DP + P.DT + (P.DV || 0);
  return { A: A, P: P, result: res };
}
Y.balancesAt = function (S, cid, year, to, onlyAN) {
  return Y.balances(S, cid, onlyAN ? { from: year + '-01-01', to: year + '-01-01', journal: 'AN' } : { from: year + '-01-01', to: to || year + '-12-31' });
};
Y.bilan = function (S, cid, year, to) {
  var cur = bilanFromBalances(Y.balancesAt(S, cid, year, to));
  var prev = bilanFromBalances(Y.balancesAt(S, cid, year, to, true));
  var actif = Y.BILAN_ACTIF.map(function (r) { var c = cur.A[r[0]] || { brut: 0, amort: 0 }, q = prev.A[r[0]] || { brut: 0, amort: 0 }; return { ref: r[0], label: r[1], labelEn: r[2], level: r[3] || 0, brut: c.brut, amort: c.amort, net: c.brut - c.amort, prev: q.brut - q.amort }; });
  var passif = Y.BILAN_PASSIF.map(function (r) { return { ref: r[0], label: r[1], labelEn: r[2], level: r[3] || 0, net: cur.P[r[0]] || 0, prev: prev.P[r[0]] || 0 }; });
  var ta = cur.A.BZ.brut - cur.A.BZ.amort, tp = cur.P.DZ;
  return { actif: actif, passif: passif, totalActif: ta, totalPassif: tp, balanced: ta === tp, result: cur.result };
};

/* --------------------------------------------------- compte de résultat */
Y.CR_LINES = [
  ['TA', 'Ventes de marchandises', 'Sales of goods', ['701'], 1], ['RA', 'Achats de marchandises', 'Purchases of goods', ['601'], -1], ['RB', 'Variation de stocks de marchandises', 'Change in goods inventory', ['6031'], -1],
  ['XA', 'MARGE COMMERCIALE', 'GROSS TRADING MARGIN', ['TA', 'RA', 'RB']],
  ['TB', 'Ventes de produits fabriqués', 'Sales of manufactured goods', ['702', '703', '704'], 1], ['TC', 'Travaux, services vendus', 'Works and services sold', ['705', '706'], 1], ['TD', 'Produits accessoires', 'Ancillary income', ['707'], 1],
  ['XB', 'CHIFFRE D’AFFAIRES', 'REVENUE', ['TA', 'TB', 'TC', 'TD']],
  ['TE', 'Production stockée (ou déstockage)', 'Change in finished goods', ['73'], 1], ['TF', 'Production immobilisée', 'Capitalised production', ['72'], 1], ['TG', 'Subventions d’exploitation', 'Operating grants', ['71'], 1],
  ['TH', 'Autres produits', 'Other income', ['75'], 1], ['TI', 'Transferts de charges d’exploitation', 'Expense transfers', ['781'], 1],
  ['RC', 'Achats de matières premières et fournitures liées', 'Raw materials', ['602'], -1], ['RD', 'Variation de stocks de matières premières', 'Change in raw materials', ['6032'], -1],
  ['RE', 'Autres achats', 'Other purchases', ['604', '605', '608'], -1], ['RF', 'Variation de stocks d’autres approvisionnements', 'Change in other supplies', ['6033'], -1],
  ['RG', 'Transports', 'Transport', ['61'], -1], ['RH', 'Services extérieurs', 'External services', ['62', '63'], -1], ['RI', 'Impôts et taxes', 'Taxes and duties', ['64'], -1], ['RJ', 'Autres charges', 'Other expenses', ['65'], -1],
  ['XC', 'VALEUR AJOUTÉE', 'VALUE ADDED', ['XB', 'RA', 'RB', 'TE', 'TF', 'TG', 'TH', 'TI', 'RC', 'RD', 'RE', 'RF', 'RG', 'RH', 'RI', 'RJ']],
  ['RK', 'Charges de personnel', 'Personnel expenses', ['66'], -1],
  ['XD', 'EXCÉDENT BRUT D’EXPLOITATION', 'EBITDA', ['XC', 'RK']],
  ['TJ', 'Reprises d’amortissements, provisions et dépréciations', 'Reversals', ['791', '798', '799'], 1], ['RL', 'Dotations aux amortissements, provisions et dépréciations', 'Depreciation and provisions', ['681', '691'], -1],
  ['XE', 'RÉSULTAT D’EXPLOITATION', 'OPERATING PROFIT', ['XD', 'TJ', 'RL']],
  ['TK', 'Revenus financiers et assimilés', 'Financial income', ['77'], 1], ['TL', 'Reprises de provisions financières', 'Financial reversals', ['797'], 1], ['TM', 'Transferts de charges financières', 'Financial expense transfers', ['787'], 1],
  ['RM', 'Frais financiers et charges assimilées', 'Financial expenses', ['67'], -1], ['RN', 'Dotations aux provisions financières', 'Financial provisions', ['697'], -1],
  ['XF', 'RÉSULTAT FINANCIER', 'NET FINANCIAL RESULT', ['TK', 'TL', 'TM', 'RM', 'RN']],
  ['XG', 'RÉSULTAT DES ACTIVITÉS ORDINAIRES', 'PROFIT FROM ORDINARY ACTIVITIES', ['XE', 'XF']],
  ['TN', 'Produits des cessions d’immobilisations', 'Disposal proceeds', ['82'], 1], ['TO', 'Autres produits HAO', 'Other non-ordinary income', ['84', '86', '88'], 1],
  ['RO', 'Valeurs comptables des cessions d’immobilisations', 'Carrying amount of disposals', ['81'], -1], ['RP', 'Autres charges HAO', 'Other non-ordinary expenses', ['83', '85'], -1],
  ['XH', 'RÉSULTAT HORS ACTIVITÉS ORDINAIRES', 'NON-ORDINARY RESULT', ['TN', 'TO', 'RO', 'RP']],
  ['RQ', 'Participation des travailleurs', 'Employee profit-sharing', ['87'], -1], ['RS', 'Impôts sur le résultat', 'Income taxes', ['89'], -1],
  ['XI', 'RÉSULTAT NET', 'NET INCOME', ['XG', 'XH', 'RQ', 'RS']]
];
Y.compteResultat = function (S, cid, from, to) {
  var bal = Y.balances(S, cid, { from: from, to: to, excludeJournal: 'AN' });
  var v = {};
  var used = {};
  Y.CR_LINES.forEach(function (r) {
    if (r[4] === undefined) { v[r[0]] = r[3].reduce(function (s, k) { return s + (v[k] || 0); }, 0); return; }
    var t = 0;
    Object.keys(bal).forEach(function (num) {
      if (!/^[678]/.test(num) || used[num]) return;
      if (startsAny(num, r[3])) { t += bal[num].c - bal[num].d; used[num] = r[0]; }
    });
    v[r[0]] = t;
  });
  var orphan = Object.keys(bal).filter(function (n) { return /^[678]/.test(n) && !used[n] && (bal[n].d - bal[n].c); });
  orphan.forEach(function (n) { var x = bal[n].c - bal[n].d; if (n[0] === '6') { v.RJ += x; } else if (n[0] === '7') { v.TH += x; } else { v.RP += x; } });
  if (orphan.length) Y.CR_LINES.forEach(function (r) { if (r[4] === undefined) v[r[0]] = r[3].reduce(function (s, k) { return s + (v[k] || 0); }, 0); });
  return Y.CR_LINES.map(function (r) { return { ref: r[0], label: r[1], labelEn: r[2], total: r[4] === undefined, value: v[r[0]] }; });
};

/* -------------------------------------------------- flux de trésorerie */
function tftBucket(num) {
  if (/^5/.test(num)) return 'T';
  if (/^[678]/.test(num) || /^(28|29|19|39|49|59)/.test(num)) return 'FA';
  if (/^48/.test(num)) return 'FB';
  if (/^3/.test(num)) return 'FC';
  if (/^(409|41|421|441|445|4449|462|476|478|271|272)/.test(num) && !/^419/.test(num)) return /^27/.test(num) ? 'FH' : 'FD';
  if (/^4/.test(num)) return /^465/.test(num) ? 'FN' : 'FE';
  if (/^21/.test(num)) return 'FF';
  if (/^2[2-5]/.test(num)) return 'FG';
  if (/^2[67]/.test(num)) return 'FH';
  if (/^10|^109/.test(num)) return 'FK';
  if (/^14/.test(num)) return 'FL';
  if (/^1[1-35]/.test(num)) return 'FN';
  if (/^1[678]/.test(num)) return 'DEBT';
  return 'FN';
}
Y.tft = function (S, cid, year, to) {
  var open = Y.balancesAt(S, cid, year, to, true), cur = Y.balancesAt(S, cid, year, to);
  var mv = Y.balances(S, cid, { from: year + '-01-01', to: to, excludeJournal: 'AN' });
  var B = { T0: 0, T1: 0 }, keys = Object.keys(open).concat(Object.keys(cur)).filter(function (v, i, a) { return a.indexOf(v) === i; });
  keys.forEach(function (k) {
    var o = open[k] ? open[k].d - open[k].c : 0, c = cur[k] ? cur[k].d - cur[k].c : 0, b = tftBucket(k);
    if (b === 'T') { B.T0 += o; B.T1 += c; return; }
    if (b === 'DEBT') { var m = mv[k] || { d: 0, c: 0 }; B.FO = (B.FO || 0) + m.c; B.FQ = (B.FQ || 0) - m.d; return; }
    B[b] = (B[b] || 0) - (c - o);
  });
  var g = function (k) { return B[k] || 0; };
  var ZB = g('FA') + g('FB') + g('FC') + g('FD') + g('FE'), ZC = g('FF') + g('FG') + g('FH'), ZD = g('FK') + g('FL') + g('FN'), ZE = g('FO') + g('FQ');
  var rows = [
    ['ZA', 'Trésorerie nette au 1er janvier', 'Net cash at 1 January', B.T0, 2],
    ['FA', 'Capacité d’autofinancement globale (CAFG)', 'Funds from operations', g('FA'), 0], ['FB', '− Variation de l’actif circulant HAO', 'Change in non-ordinary current assets', g('FB'), 0],
    ['FC', '− Variation des stocks', 'Change in inventories', g('FC'), 0], ['FD', '− Variation des créances', 'Change in receivables', g('FD'), 0], ['FE', '+ Variation du passif circulant', 'Change in current liabilities', g('FE'), 0],
    ['ZB', 'Flux de trésorerie provenant des activités opérationnelles', 'Net cash from operating activities', ZB, 1],
    ['FF', '− Acquisitions/cessions d’immobilisations incorporelles (net)', 'Intangible assets (net)', g('FF'), 0], ['FG', '− Acquisitions/cessions d’immobilisations corporelles (net)', 'Tangible assets (net)', g('FG'), 0],
    ['FH', '− Acquisitions/cessions d’immobilisations financières (net)', 'Financial assets (net)', g('FH'), 0],
    ['ZC', 'Flux de trésorerie provenant des activités d’investissement', 'Net cash from investing activities', ZC, 1],
    ['FK', '+ Augmentations de capital', 'Capital increases', g('FK'), 0], ['FL', '+ Subventions d’investissement reçues', 'Investment grants received', g('FL'), 0], ['FN', '− Dividendes versés et prélèvements', 'Dividends paid', g('FN'), 0],
    ['ZD', 'Flux des capitaux propres', 'Equity cash flows', ZD, 1],
    ['FO', '+ Emprunts', 'New borrowings', g('FO'), 0], ['FQ', '− Remboursements des emprunts', 'Repayments of borrowings', g('FQ'), 0],
    ['ZE', 'Flux des capitaux étrangers', 'Debt cash flows', ZE, 1],
    ['ZF', 'Flux de trésorerie provenant des activités de financement', 'Net cash from financing activities', ZD + ZE, 1],
    ['ZG', 'VARIATION DE LA TRÉSORERIE NETTE', 'NET CHANGE IN CASH', ZB + ZC + ZD + ZE, 2],
    ['ZH', 'Trésorerie nette à la date d’arrêté', 'Net cash at closing date', B.T1, 2]
  ];
  return { rows: rows.map(function (r) { return { ref: r[0], label: r[1], labelEn: r[2], value: r[3], level: r[4] }; }), check: (B.T0 + ZB + ZC + ZD + ZE) === B.T1 };
};

/* ----------------------------------------------------- tiers : balance âgée */
Y.agedBalance = function (S, cid, prefix, date) {
  date = date || S.meta.today;
  var rows = {};
  Y.eachLine(S, cid, function (l, e) {
    if (l.letter && l.letter === l.letter.toUpperCase()) return;
    if (!l.tiersId) return;
    var t = Y.tiers(S, cid, l.tiersId); var r = rows[l.tiersId] || (rows[l.tiersId] = { tiersId: l.tiersId, code: t ? t.code : '', name: t ? t.name : '?', b: [0, 0, 0, 0, 0], total: 0 });
    var amt = prefix === '40' || prefix === '401' ? l.credit - l.debit : l.debit - l.credit;
    var due = l.due || e.date, late = U.daysBetween(due, date);
    var k = late <= 0 ? 0 : (late <= 30 ? 1 : (late <= 60 ? 2 : (late <= 90 ? 3 : 4)));
    if (amt < 0) k = 0;
    r.b[k] += amt; r.total += amt;
  }, { account: prefix, to: date });
  return Object.keys(rows).map(function (k) { return rows[k]; }).filter(function (r) { return r.total; }).sort(function (a, b) { return b.total - a.total; });
};

/* --------------------------------------------------------------- clôture */
Y.closingChecks = function (S, cid, year) {
  var d = Y.D(S, cid), fy = Y.fiscalYear(S, cid, year), out = [];
  var tb = Y.trialBalance(S, cid, year);
  var td = U.sum(tb, function (r) { return r.fD; }), tc = U.sum(tb, function (r) { return r.fC; });
  out.push({ key: 'balance', label: 'Balance générale équilibrée', detail: 'Débit ' + U.fmt(td) + ' · crédit ' + U.fmt(tc), level: td === tc ? 'ok' : 'block', go: 'livres' });
  var drafts = d.entries.filter(function (e) { return e.status === 'draft' && U.year(e.date) === year; }).length;
  out.push({ key: 'drafts', label: 'Aucun brouillon en attente', detail: drafts ? drafts + ' brouillon(s) à valider ou supprimer' : 'Aucun brouillon', level: drafts ? 'block' : 'ok', go: 'saisie' });
  var s471 = Y.net(S, cid, '471', { to: year + '-12-31' });
  out.push({ key: 'suspense', label: 'Comptes d’attente soldés (471)', detail: s471 ? 'Solde ' + U.fmtDC(s471) + ' à affecter' : 'Solde nul', level: s471 ? 'warn' : 'ok', go: 'livres' });
  var openTx = d.bankTx.filter(function (t) { return t.status === 'open' && U.year(t.date) === year; }).length;
  out.push({ key: 'bank', label: 'Rapprochements bancaires et Mobile Money à jour', detail: openTx ? openTx + ' ligne(s) de relevé non rapprochée(s)' : 'Tous les relevés sont rapprochés', level: openTx ? 'warn' : 'ok', go: 'banque' });
  var unlocked = fy ? 12 - fy.locked.length : 12;
  out.push({ key: 'periods', label: 'Périodes mensuelles verrouillées', detail: unlocked ? unlocked + ' période(s) encore ouverte(s)' : 'Les 12 périodes sont verrouillées', level: unlocked ? 'warn' : 'ok', go: 'parametres' });
  var lastM = U.year(S.meta.today) > year ? 12 : U.month(S.meta.today) - 1;
  var missingDep = 0;
  d.assets.forEach(function (a) { if (a.status !== 'active') return; for (var m = 1; m <= lastM; m++) if (Y.assetMonthDot(a, year, m) && !a.posted[year + '-' + U.pad(m, 2)]) missingDep++; });
  out.push({ key: 'dep', label: 'Dotations aux amortissements passées', detail: missingDep ? missingDep + ' dotation(s) mensuelle(s) manquante(s)' : 'Registre à jour', level: missingDep ? 'warn' : 'ok', go: 'immos' });
  var vatMissing = [];
  for (var m2 = 1; m2 <= lastM; m2++) { var k = year + '-' + U.pad(m2, 2); if (!d.vat[k] || !d.vat[k].entryNum) vatMissing.push(U.pad(m2, 2)); }
  out.push({ key: 'vat', label: 'TVA liquidée pour chaque mois écoulé', detail: vatMissing.length ? 'Mois non liquidés : ' + vatMissing.join(', ') : 'Toutes les périodes sont liquidées', level: vatMissing.length ? 'warn' : 'ok', go: 'fiscalite' });
  var noTiers = 0; Y.eachLine(S, cid, function (l) { var a = Y.account(S, cid, l.account); if (a && a.nature === 'tiers' && !l.tiersId) noTiers++; }, { from: year + '-01-01', to: year + '-12-31', excludeJournal: 'AN' });
  out.push({ key: 'tiers', label: 'Comptes collectifs rattachés à un tiers', detail: noTiers ? noTiers + ' ligne(s) sans tiers' : 'Toutes les lignes sont rattachées', level: noTiers ? 'warn' : 'ok', go: 'livres' });
  return out;
};
Y.INVENTORY_TYPES = {
  CCA: { label: 'Charge constatée d’avance', debit: '476', credit: '', creditHint: 'Compte de charge (6)', reverse: true },
  PCA: { label: 'Produit constaté d’avance', debit: '', credit: '477', debitHint: 'Compte de produit (7)', reverse: true },
  FNP: { label: 'Facture non parvenue', debit: '', credit: '408', debitHint: 'Compte de charge (6)', reverse: true },
  FAE: { label: 'Facture à établir', debit: '418', credit: '', creditHint: 'Compte de produit (7)', reverse: true },
  DEPC: { label: 'Dépréciation de créance douteuse', debit: '6594', credit: '491', reverse: false },
  PROV: { label: 'Provision pour risques et charges', debit: '691', credit: '191', reverse: false }
};
Y.postInventory = function (S, cid, year, p) {
  var t = Y.INVENTORY_TYPES[p.type]; if (!t) fail('Type de régularisation inconnu');
  var deb = t.debit || p.account, cred = t.credit || p.account;
  if (!deb || !cred) fail('Choisissez le compte de contrepartie.');
  var amt = U.round(p.amount); if (!(amt > 0)) fail('Montant invalide.');
  var e = Y.postEntry(S, cid, { journal: 'OD', date: year + '-12-31', ref: 'INV-' + p.type, label: t.label + ' · ' + (p.label || ''), source: 'inventory', inventory: !!t.reverse, lines: [
    { account: deb, label: p.label || t.label, debit: amt, credit: 0, section: /^6/.test(deb) ? (p.section || 'STR') : '', tiersId: p.tiersId || '' },
    { account: cred, label: p.label || t.label, debit: 0, credit: amt, section: /^7/.test(cred) ? (p.section || '') : '', tiersId: p.tiersId || '' }
  ] }, { closing: true });
  return e;
};
Y.closingState = function (S, cid, year) { var d = Y.D(S, cid); return d.closing[year] || (d.closing[year] = { reint: [], deduct: [], isNum: '', locked: false, anNum: '', affNum: '', dsf: false }); };
Y.incomeTax = function (S, cid, year) {
  var d = Y.D(S, cid), cs = Y.closingState(S, cid, year);
  var from = year + '-01-01', to = year + '-12-31';
  var pnl = 0, tax89 = 0;
  Y.eachLine(S, cid, function (l) { if (/^[678]/.test(l.account)) { if (/^89/.test(l.account)) tax89 += l.debit - l.credit; else pnl += l.credit - l.debit; } }, { from: from, to: to, excludeJournal: 'AN' });
  var ca = 0; Y.eachLine(S, cid, function (l) { ca += l.credit - l.debit; }, { from: from, to: to, account: '70', excludeJournal: 'AN' });
  var rei = U.sum(cs.reint, function (r) { return U.round(r.amount); }), ded = U.sum(cs.deduct, function (r) { return U.round(r.amount); });
  var rf = pnl + rei - ded;
  var is = rf > 0 ? U.round(rf * d.settings.isRate / 100) : 0;
  var min = U.round(Math.max(ca, 0) * d.settings.minTaxRate / 100);
  var due = Math.max(is, min);
  var acomptes = 0; Y.eachLine(S, cid, function (l, e) { if (e.source !== 'income-tax') acomptes += l.debit; }, { from: from, to: to, account: '441', excludeJournal: 'AN' });
  return { year: year, before: pnl, reint: rei, deduct: ded, fiscal: rf, rate: d.settings.isRate, is: is, ca: ca, min: min, due: due, acomptes: acomptes, balance: due - acomptes, posted: tax89, net: pnl - due, isNum: cs.isNum };
};
Y.postIncomeTax = function (S, cid, year) {
  var cs = Y.closingState(S, cid, year); if (cs.isNum) fail('IS déjà comptabilisé (' + cs.isNum + ').');
  var t = Y.incomeTax(S, cid, year);
  if (!t.due) fail('Aucun impôt à comptabiliser.');
  var e = Y.postEntry(S, cid, { journal: 'OD', date: year + '-12-31', ref: 'IS-' + year, label: 'Impôt sur les bénéfices ' + year, source: 'income-tax', lines: [
    { account: '891', label: 'IS ' + year + (t.due === t.min && t.min > t.is ? ' (minimum de perception)' : ''), debit: t.due, credit: 0 },
    { account: '441', label: 'IS ' + year, debit: 0, credit: t.due }
  ] }, { closing: true });
  cs.isNum = e.num;
  return e;
};
Y.lockYear = function (S, cid, year) {
  var fy = Y.fiscalYear(S, cid, year); if (!fy) fail('Exercice introuvable');
  var blockers = Y.closingChecks(S, cid, year).filter(function (c) { return c.level === 'block'; });
  if (blockers.length) fail(blockers.map(function (b) { return b.label + ' : ' + b.detail; }));
  fy.locked = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]; fy.status = 'closed'; fy.closedAt = new Date().toISOString();
  Y.closingState(S, cid, year).locked = true;
  Y.audit(S, cid, 'Clôture', 'Exercice ' + year, 'Verrouillage définitif des 12 périodes');
  return fy;
};
Y.reopenYear = function (S, cid, year, reason) {
  if (!reason) fail('Le motif de réouverture est obligatoire.');
  var fy = Y.fiscalYear(S, cid, year); if (!fy || fy.status !== 'closed') fail('Exercice non clôturé');
  var cs = Y.closingState(S, cid, year); if (cs.anNum) fail('Les à-nouveaux ' + (year + 1) + ' sont déjà générés : contre-passez-les avant de rouvrir.');
  fy.status = 'open'; fy.locked = []; cs.locked = false;
  Y.audit(S, cid, 'Réouverture', 'Exercice ' + year, reason);
  return fy;
};
Y.previewAN = function (S, cid, year, opts) {
  opts = opts || {};
  var lines = [], res = 0, byTiers = {};
  var bal = Y.balances(S, cid, { from: year + '-01-01', to: year + '-12-31' });
  if (opts.detailTiers) Y.eachLine(S, cid, function (l) { var a = Y.account(S, cid, l.account); if (a && a.lettrable && l.tiersId) { var k = l.account + '|' + l.tiersId; byTiers[k] = (byTiers[k] || 0) + l.debit - l.credit; } }, { from: year + '-01-01', to: year + '-12-31' });
  Object.keys(bal).sort().forEach(function (num) {
    var n = bal[num].d - bal[num].c;
    if (/^[678]/.test(num)) { res += n; return; }
    if (!n && !opts.detailTiers) return;
    var a = Y.account(S, cid, num);
    if (opts.detailTiers && a && a.lettrable) {
      var withT = 0;
      Object.keys(byTiers).forEach(function (k) { var p = k.split('|'); if (p[0] !== num || !byTiers[k]) return; withT += byTiers[k]; var t = Y.tiers(S, cid, p[1]); lines.push({ account: num, tiersId: p[1], label: 'À-nouveau ' + (t ? t.code + ' ' + t.name : ''), debit: byTiers[k] > 0 ? byTiers[k] : 0, credit: byTiers[k] < 0 ? -byTiers[k] : 0 }); });
      var rest = n - withT; if (rest) lines.push({ account: num, label: 'À-nouveau', debit: rest > 0 ? rest : 0, credit: rest < 0 ? -rest : 0 });
      return;
    }
    if (n) lines.push({ account: num, label: 'À-nouveau', debit: n > 0 ? n : 0, credit: n < 0 ? -n : 0 });
  });
  if (res < 0) lines.push({ account: '131', label: 'Résultat ' + year + ' · bénéfice en instance d’affectation', debit: 0, credit: -res });
  if (res > 0) lines.push({ account: '139', label: 'Résultat ' + year + ' · perte en instance d’affectation', debit: res, credit: 0 });
  return { lines: lines, result: -res, totals: Y.entryTotals({ lines: lines }) };
};
Y.generateAN = function (S, cid, year, opts) {
  opts = opts || {};
  var fy = Y.fiscalYear(S, cid, year); if (!fy || fy.status !== 'closed') fail('Verrouillez d’abord l’exercice ' + year + '.');
  var cs = Y.closingState(S, cid, year); if (cs.anNum) fail('À-nouveaux déjà générés (' + cs.anNum + ').');
  if (!Y.fiscalYear(S, cid, year + 1)) Y.createFiscalYear(S, cid, year + 1);
  var pv = Y.previewAN(S, cid, year, opts);
  var e = Y.postEntry(S, cid, { journal: 'AN', date: (year + 1) + '-01-01', ref: 'AN-' + (year + 1), label: 'À-nouveaux ' + (year + 1) + ' · reprise des soldes au 31/12/' + year, lines: pv.lines, source: 'opening' }, { system: true });
  cs.anNum = e.num;
  var rev = 0;
  if (opts.reverseAccruals) Y.validated(S, cid).forEach(function (x) {
    if (!x.inventory || U.year(x.date) !== year) return;
    Y.postEntry(S, cid, { journal: 'OD', date: (year + 1) + '-01-01', ref: x.num, label: 'Extourne de ' + x.num + ' · ' + x.label, source: 'extourne', lines: x.lines.map(function (l) { return { account: l.account, label: l.label, debit: l.credit, credit: l.debit, section: l.section, tiersId: l.tiersId }; }) }, { system: true, silent: true });
    rev++;
  });
  Y.audit(S, cid, 'Génération des à-nouveaux', e.num, pv.lines.length + ' lignes · ' + U.fmt(pv.totals.debit) + (rev ? ' · ' + rev + ' extourne(s)' : ''));
  return { entry: e, reversals: rev };
};
Y.postAffectation = function (S, cid, year, p) {
  var cs = Y.closingState(S, cid, year); if (!cs.anNum) fail('Générez d’abord les à-nouveaux.');
  if (cs.affNum) fail('Affectation déjà passée (' + cs.affNum + ').');
  var res = -Y.net(S, cid, '13', { from: (year + 1) + '-01-01', to: (year + 1) + '-01-01', journal: 'AN' });
  var legal = U.round(p.legal), div = U.round(p.dividends), ran = U.round(p.ran), other = U.round(p.otherReserves || 0);
  if (res <= 0) fail('Pas de bénéfice à affecter : la perte est reportée (129 / 139).');
  if (legal + div + ran + other !== res) fail('La répartition (' + U.fmt(legal + div + ran + other) + ') doit égaler le résultat (' + U.fmt(res) + ').');
  var lines = [{ account: '131', label: 'Affectation du résultat ' + year, debit: res, credit: 0 }];
  if (legal) lines.push({ account: '111', label: 'Dotation à la réserve légale', debit: 0, credit: legal });
  if (other) lines.push({ account: '118', label: 'Autres réserves', debit: 0, credit: other });
  var share = Y.D(S, cid).tiers.find(function (t) { return t.code === 'A0001'; });
  if (div) {
    if (!share) share = Y.createTiers(S, cid, { type: 'associe', code: 'A0001', name: 'Associés · dividendes', collective: '465' });
    lines.push({ account: '465', tiersId: share.id, label: 'Dividendes à payer', debit: 0, credit: div });
  }
  if (ran) lines.push({ account: '121', label: 'Report à nouveau', debit: 0, credit: ran });
  var e = Y.postEntry(S, cid, { journal: 'OD', date: p.date, ref: 'AGO-' + year, label: 'Affectation du résultat ' + year + ' · AGO du ' + U.frDate(p.date), lines: lines, source: 'affectation' });
  cs.affNum = e.num;
  return e;
};

/* -------------------------------------------------------------------- FEC */
Y.FEC_COLUMNS = ['JournalCode', 'JournalLib', 'EcritureNum', 'EcritureDate', 'CompteNum', 'CompteLib', 'CompAuxNum', 'CompAuxLib', 'PieceRef', 'PieceDate', 'EcritureLib', 'Debit', 'Credit', 'EcritureLet', 'DateLet', 'ValidDate', 'Montantdevise', 'Idevise'];
Y.fecRows = function (S, cid, from, to) {
  var rows = [];
  var es = Y.validated(S, cid).filter(function (e) { return e.date >= from && e.date <= to; }).sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.num < b.num ? -1 : 1); });
  es.forEach(function (e) {
    var j = Y.journal(S, cid, e.journal);
    e.lines.forEach(function (l) {
      var t = l.tiersId ? Y.tiers(S, cid, l.tiersId) : null;
      rows.push([e.journal, j ? j.label : '', e.num, e.date.replace(/-/g, ''), l.account, Y.accountLabel(S, cid, l.account), t ? t.code : '', t ? t.name : '', e.ref || e.num, (e.pieceDate || e.date).replace(/-/g, ''), (l.label || e.label).replace(/[\t\r\n]/g, ' '), String(l.debit), String(l.credit), l.letter || '', '', (e.validatedAt || '').slice(0, 10).replace(/-/g, ''), '', 'XAF']);
    });
  });
  return rows;
};
Y.fecChecks = function (S, cid, from, to) {
  var es = Y.validated(S, cid).filter(function (e) { return e.date >= from && e.date <= to; });
  var out = [];
  var unb = es.filter(function (e) { return Y.entryTotals(e).diff !== 0; }).length;
  out.push({ label: 'Toutes les pièces sont équilibrées', ok: !unb, detail: unb ? unb + ' pièce(s) déséquilibrée(s)' : es.length + ' pièces contrôlées' });
  var gaps = [];
  Y.D(S, cid).journals.forEach(function (j) {
    var nums = es.filter(function (e) { return e.journal === j.code; }).map(function (e) { return +e.num.replace(/.*-/, ''); }).sort(function (a, b) { return a - b; });
    for (var i = 1; i < nums.length; i++) if (nums[i] !== nums[i - 1] + 1) gaps.push(j.code + ' ' + nums[i - 1] + '→' + nums[i]);
  });
  out.push({ label: 'Numérotation continue par journal', ok: !gaps.length, detail: gaps.length ? 'Ruptures : ' + gaps.slice(0, 4).join(', ') : 'Aucune rupture de séquence' });
  var badAcc = 0; es.forEach(function (e) { e.lines.forEach(function (l) { if (!Y.account(S, cid, l.account)) badAcc++; }); });
  out.push({ label: 'Comptes présents dans le plan comptable', ok: !badAcc, detail: badAcc ? badAcc + ' ligne(s) sur un compte inconnu' : 'Tous les comptes existent' });
  var outOfYear = es.filter(function (e) { return !Y.fiscalYear(S, cid, U.year(e.date)); }).length;
  out.push({ label: 'Dates comprises dans un exercice', ok: !outOfYear, detail: outOfYear ? outOfYear + ' pièce(s) hors exercice' : 'Dates cohérentes' });
  var audit = Y.verifyAudit(S, cid);
  out.push({ label: 'Piste d’audit intègre (chaîne d’empreintes)', ok: audit.ok, detail: audit.ok ? audit.count + ' événements vérifiés' : 'Rupture à l’événement ' + audit.at });
  return out;
};

/* ---------------------------------------------------- indicateurs (tableau de bord) */
Y.kpis = function (S, cid, year, month) {
  var from = year + '-' + U.pad(month, 2) + '-01', to = U.monthEnd(year, month), ytdFrom = year + '-01-01';
  var get = function (pref, f, t) { var v = 0; Y.eachLine(S, cid, function (l) { v += l.credit - l.debit; }, { account: pref, from: f, to: t, excludeJournal: 'AN' }); return v; };
  var charges = function (f, t) { var v = 0; Y.eachLine(S, cid, function (l) { if (/^6/.test(l.account)) v += l.debit - l.credit; }, { from: f, to: t, excludeJournal: 'AN' }); return v; };
  var treso = 0, byAcc = [];
  Y.D(S, cid).bankAccounts.forEach(function (b) { var v = Y.net(S, cid, b.account, { to: S.meta.today }); treso += v; byAcc.push({ b: b, v: v }); });
  var series = [];
  for (var m = 1; m <= 12; m++) { var f = year + '-' + U.pad(m, 2) + '-01', t = U.monthEnd(year, m); series.push({ m: m, ca: get('70', f, t), ch: charges(f, t), cash: Y.net(S, cid, '5', { to: t }) }); }
  var receivable = 0, late = 0; Y.agedBalance(S, cid, '411', S.meta.today).forEach(function (r) { receivable += r.total; late += r.b[1] + r.b[2] + r.b[3] + r.b[4]; });
  var payable = 0; Y.agedBalance(S, cid, '401', S.meta.today).forEach(function (r) { payable += r.total; });
  var vat = Y.vatReturn(S, cid, year, month);
  return {
    caMonth: get('70', from, to), caYtd: get('70', ytdFrom, to), chMonth: charges(from, to), chYtd: charges(ytdFrom, to),
    resMonth: get('7', from, to) - charges(from, to) + get('8', from, to), resYtd: get('7', ytdFrom, to) - charges(ytdFrom, to) + get('8', ytdFrom, to),
    treso: treso, byAcc: byAcc, series: series, receivable: receivable, late: late, payable: payable, vat: vat
  };
};
Y.health = function (S, cid, year) {
  var c = Y.closingChecks(S, cid, year);
  var score = U.round(100 * U.sum(c, function (x) { return x.level === 'ok' ? 1 : (x.level === 'warn' ? 0.5 : 0); }) / c.length);
  return { score: score, checks: c };
};

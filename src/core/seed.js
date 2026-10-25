/*
 * Jeu de données de démonstration, généré exclusivement par le moteur (aucune écriture « en dur ») :
 * il traverse les mêmes contrôles que la saisie réelle, donc tout est équilibré et cohérent.
 * Données fictives : à remplacer par les données de l'entreprise (cf. docs/06-imports-exports.md).
 */
import { Y } from './registry.js';

var U = Y.util;

function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

Y.seed = function (today) {
  today = today || '2026-10-21';
  var S = Y.createState(today);
  S.users = [];
  var co = Y.addCompany(S, { name: 'Yiel Group Holding SA', legalForm: 'SA', capital: 50000000, niu: '[NIU À RENSEIGNER]', rccm: '[RCCM À RENSEIGNER]', address: '[ADRESSE]', city: 'Douala', taxCenter: '[CENTRE DES IMPÔTS]', cnps: '[N° EMPLOYEUR CNPS]', invoiceFooter: 'Yiel Group Holding SA · capital 50 000 000 XAF · Douala', momoMerchant: '[N° MARCHAND MTN]', omMerchant: '[N° MARCHAND ORANGE]', iban: '[RIB BANQUE PRINCIPALE]' });
  var deygo = Y.addCompany(S, { name: 'DeyGo SARL', legalForm: 'SARL', capital: 1000000, niu: '[NIU À RENSEIGNER]', rccm: '[RCCM À RENSEIGNER]', city: 'Douala', color: '#141A3A' });
  S.users = [
    { id: 'u1', name: 'Direction financière', email: 'direction@yielgroup.com', role: 'owner', companies: [co.id, deygo.id], mfa: true, lastLogin: today + 'T18:02:00' },
    { id: 'u2', name: 'A. Mbarga', email: 'comptabilite@yielgroup.com', role: 'accountant', companies: [co.id, deygo.id], mfa: true, lastLogin: today + 'T17:41:00' },
    { id: 'u3', name: 'Gestionnaire DeyGo', email: 'deygo@yielgroup.com', role: 'accountant', companies: [deygo.id], mfa: true, lastLogin: U.addDays(today, -1) + 'T16:20:00' },
    { id: 'u4', name: 'Expert-comptable externe', email: 'cabinet@exemple.cm', role: 'reader', companies: [co.id], mfa: false, lastLogin: U.addDays(today, -9) + 'T09:14:00' },
    { id: 'u5', name: 'Gestionnaire paie · B. Ngono', email: 'paie@yielgroup.com', role: 'payroll', companies: [co.id, deygo.id], mfa: true, lastLogin: today + 'T12:05:00' },
    { id: 'u6', name: 'DRH · E. Fouda', email: 'drh@yielgroup.com', role: 'hr', companies: [co.id, deygo.id], mfa: true, lastLogin: today + 'T11:40:00' },
    { id: 'u7', name: 'DAF · P. Tchoumi', email: 'daf@yielgroup.com', role: 'cfo', companies: [co.id, deygo.id], mfa: true, lastLogin: today + 'T10:15:00' },
    { id: 'u8', name: 'Manager · R. Nana', email: 'r.nana@yielgroup.com', role: 'manager', companies: [co.id], mfa: true, lastLogin: today + 'T09:02:00' },
    { id: 'u10', name: 'Manager · J-P. Essomba', email: 'jp.essomba@yielgroup.com', role: 'manager', companies: [co.id], mfa: true, lastLogin: today + 'T08:12:00' },
    { id: 'u11', name: 'Manager · S. Manga', email: 's.manga@yielgroup.com', role: 'manager', companies: [co.id], mfa: false, lastLogin: U.addDays(today, -1) + 'T18:20:00' },
    { id: 'u9', name: 'Salarié · B. Fotso', email: 'b.fotso@yielgroup.com', role: 'employee', companies: [co.id], mfa: false, lastLogin: today + 'T07:58:00' },
    { id: 'u12', name: 'Manager DeyGo · T. Eyenga', email: 't.eyenga@deygo.cm', role: 'manager', companies: [deygo.id], mfa: false, lastLogin: today + 'T07:40:00' }
  ];
  var EMP = { u5: 'YG0003', u6: 'YG0002', u7: 'YG0001', u8: 'YG0009', u9: 'YG0010', u10: 'YG0005', u11: 'YG0017' };
  S.users.forEach(function (u) { if (EMP[u.id]) { u.employee = {}; u.employee[co.id] = EMP[u.id]; } });
  S.users.find(function (u) { return u.id === 'u12'; }).employee = {}; S.users.find(function (u) { return u.id === 'u12'; }).employee[deygo.id] = 'DG0001';
  S.meta.currentUser = { id: 'u0', name: 'Import initial', role: 'owner' };
  seedHolding(S, co.id, today);
  seedDeygo(S, deygo.id, today);
  if (Y.seedCRM) Y.seedCRM(S, co.id, deygo.id, today);
  S.meta.currentUser = { id: 'u1', name: 'Direction financière', role: 'owner' };
  S.meta.currentCompany = co.id;
  return S;
};

function seedHolding(S, cid, today) {
  var R = rng(20261021), d = Y.D(S, cid);
  var ty = U.year(today), tm = U.month(today);
  Y.createFiscalYear(S, cid, 2025); Y.createFiscalYear(S, cid, 2026);
  var fy25 = Y.fiscalYear(S, cid, 2025); fy25.status = 'closed'; fy25.locked = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]; fy25.closedAt = '2026-02-20T10:00:00Z';

  var C = [
    ['Boulangerie du Littoral SARL', 'momo', 30, 'Douala', '+237 6 77 00 00 01'], ['Cabinet Ngono & Associés', 'om', 15, 'Yaoundé', '+237 6 99 00 00 02'],
    ['Groupe scolaire Les Palmiers', 'bank', 45, 'Douala', '+237 6 55 00 00 03'], ['Clinique de Bonamoussadi', 'bank', 30, 'Douala', '+237 6 70 00 00 04'],
    ['Transports Mbanga Express', 'momo', 30, 'Mbanga', '+237 6 78 00 00 05'], ['Coopérative agricole du Moungo', 'om', 45, 'Nkongsamba', '+237 6 90 00 00 06']
  ].map(function (c) { return Y.createTiers(S, cid, { type: 'client', name: c[0], payPref: c[1], terms: c[2], city: c[3], phone: c[4], momo: c[1] !== 'bank' ? c[4] : '', momoOp: c[1] === 'momo' ? 'MTN' : (c[1] === 'om' ? 'Orange' : ''), regime: 'Réel', email: 'contact@client' + (Math.floor(R() * 900) + 100) + '.cm' }); });
  var F = [
    ['SCI Akwa Business Center', 30], ['Douala Informatique Services', 30], ['Hébergeur cloud international', 0], ['Opérateur de télécommunications', 15],
    ['Distributeur d’électricité', 15], ['Cabinet d’expertise comptable', 30], ['Station-service Bonapriso', 0]
  ].map(function (f) { return Y.createTiers(S, cid, { type: 'fournisseur', name: f[0], terms: f[1], city: 'Douala', regime: f[0].indexOf('international') > -1 ? 'Non domicilié' : 'Réel' }); });

  [['MYY-RH', 'Licence myyiel RH & Paie · jusqu’à 50 salariés', 'mois', 350000, '7061', 'LOG'], ['MYY-CPT', 'Licence myyiel Comptabilité', 'mois', 250000, '7061', 'LOG'],
   ['MYY-PRJ', 'Licence myyiel Gestion de projets', 'mois', 200000, '7061', 'LOG'], ['CNS-J', 'Journée de conseil en organisation', 'jour', 450000, '7062', 'CNS'],
   ['FRM-J', 'Journée de formation utilisateurs', 'jour', 300000, '7062', 'CNS'], ['AUD-ORG', 'Diagnostic organisationnel (forfait)', 'forfait', 2500000, '7062', 'CNS'],
   ['DEP-MYY', 'Paramétrage et déploiement myyiel (forfait)', 'forfait', 1800000, '7061', 'LOG']].forEach(function (i) { Y.createItem(S, cid, { code: i[0], label: i[1], unit: i[2], price: i[3], account: i[4], section: i[5], taxCode: 'TVA19' }); });

  var bk = [
    Y.createBankAccount(S, cid, { label: 'Banque principale', account: '5211', journal: 'BQ1', kind: 'bank', provider: '[BANQUE]', syncMode: 'api', iban: '[RIB]', alertBelow: 10000000 }),
    Y.createBankAccount(S, cid, { label: 'Banque secondaire', account: '5212', journal: 'BQ2', kind: 'bank', provider: '[BANQUE]', syncMode: 'import', iban: '[RIB]' }),
    Y.createBankAccount(S, cid, { label: 'MTN Mobile Money', account: '5521', journal: 'MTN', kind: 'momo', provider: 'MTN MoMo · compte marchand', syncMode: 'api' }),
    Y.createBankAccount(S, cid, { label: 'Orange Money', account: '5522', journal: 'OM', kind: 'momo', provider: 'Orange Money · compte marchand', syncMode: 'api' }),
    Y.createBankAccount(S, cid, { label: 'Caisse siège', account: '5711', journal: 'CAI', kind: 'cash', provider: 'Caisse', syncMode: 'manual' })
  ];
  if (Y.Paie && Y.Paie.seedCompany) Y.Paie.seedCompany(S, cid, 'holding', today);
  d.bankRules = [
    { id: 'r1', contains: 'FRAIS', accounts: ['5211', '5212', '5521', '5522'], account: '631', taxCode: 'HC', section: 'STR', sign: 'out', active: true, uses: 0, label: 'Frais bancaires et Mobile Money' },
    { id: 'r2', contains: 'AGIOS', accounts: ['5211', '5212'], account: '674', taxCode: 'HC', section: 'STR', sign: 'out', active: true, uses: 0, label: 'Agios' },
    { id: 'r3', contains: 'CNPS', accounts: ['5211'], account: '431', taxCode: 'HC', section: '', sign: 'out', active: true, uses: 0, label: 'Cotisations sociales' },
    { id: 'r4', contains: 'DGI', accounts: ['5211'], account: '4441', taxCode: 'HC', section: '', sign: 'out', active: true, uses: 0, label: 'Télépaiements DGI' },
    { id: 'r5', contains: 'CARBURANT', accounts: ['5711', '5521'], account: '6053', taxCode: 'TVA19', section: 'STR', sign: 'out', active: true, uses: 0, label: 'Carburant' },
    { id: 'r6', contains: 'TRANSFERT', accounts: ['5521', '5522'], account: '585', taxCode: 'HC', section: '', sign: 'out', active: true, uses: 0, label: 'Virements internes Mobile Money → banque' }
  ];

  var A = [
    { label: 'Logiciel de paie (licence perpétuelle)', account: '2131', serviceDate: '2023-03-01', value: 9000000, years: 5, section: 'STR', piece: 'F-2023-0044' },
    { label: 'Développement myyiel v1', account: '2131', serviceDate: '2024-07-01', value: 5800000, years: 5, section: 'LOG', piece: 'Production immobilisée' },
    { label: 'Site yielgroup.com', account: '2132', serviceDate: '2024-01-01', value: 3500000, years: 3, section: 'STR', piece: 'F-2024-0007' },
    { label: 'Photocopieur multifonction', account: '2441', serviceDate: '2023-02-01', value: 2150000, years: 5, section: 'STR', piece: 'F-2023-0021' },
    { label: 'Ordinateurs portables · lot de 7', account: '2442', serviceDate: '2024-09-01', value: 8440000, years: 3, section: 'LOG', piece: 'F-2024-0188' },
    { label: 'Mobilier de bureau · Douala', account: '2444', serviceDate: '2023-01-01', value: 4380000, years: 10, section: 'STR', piece: 'F-2023-0003' },
    { label: 'Véhicule utilitaire', account: '245', serviceDate: '2023-05-01', value: 18900000, years: 4, section: 'STR', piece: 'F-2023-0067', method: 'L' }
  ].map(function (a) { var x = Y.createAsset(S, cid, Object.assign({ acqDate: a.serviceDate, location: 'Siège · Douala' }, a)); for (var y = U.year(x.serviceDate); y <= 2025; y++) for (var m = 1; m <= 12; m++) if (Y.assetMonthDot(x, y, m)) x.posted[y + '-' + U.pad(m, 2)] = true; return x; });

  /* ---------- à-nouveaux 2026 (soldes de clôture 2025) */
  var an = [];
  function L(acc, dr, cr, t, label) { an.push({ account: acc, debit: dr, credit: cr, tiersId: t || '', label: label || 'À-nouveau' }); }
  var gross = {}, amort = {};
  A.forEach(function (a) { gross[a.account] = (gross[a.account] || 0) + a.value; amort[a.amortAccount] = (amort[a.amortAccount] || 0) + Y.assetCumAt(a, '2025-12-31'); });
  Object.keys(gross).forEach(function (k) { L(k, gross[k], 0); });
  Object.keys(amort).forEach(function (k) { L(k, 0, amort[k]); });
  L('275', 1800000, 0);
  L('101', 0, 50000000); L('111', 0, 4200000); L('121', 0, 18640000); L('131', 0, 12000000, '', 'Résultat 2025 en instance d’affectation'); L('162', 0, 30000000);
  var openCli = [[0, 3577500], [2, 9540000], [3, 4770000], [5, 4712500]];
  openCli.forEach(function (o) { L('4111', o[1], 0, C[o[0]].id, 'À-nouveau · factures 2025 non réglées'); });
  L('416', 2450000, 0); var dbt = Y.createTiers(S, cid, { type: 'client', name: 'Clients douteux 2024', collective: '416' }); an[an.length - 1].tiersId = dbt.id;
  var openSup = [[0, 1788750], [1, 3500000], [5, 1911250]];
  openSup.forEach(function (o) { L('4011', 0, o[1], F[o[0]].id, 'À-nouveau · factures 2025 non réglées'); });
  var staff = Y.createTiers(S, cid, { type: 'personnel', code: 'P0000', name: 'Personnel · centralisation de la paie', collective: '422' });
  L('431', 0, 2100000); L('4441', 0, 3900000); L('447', 0, 980000);
  L('5212', 9800000, 0); L('5521', 2100000, 0); L('5522', 1300000, 0); L('5711', 450000, 0);
  var t0 = Y.entryTotals({ lines: an });
  L('5211', t0.credit - t0.debit, 0);
  Y.postEntry(S, cid, { journal: 'AN', date: '2026-01-01', ref: 'AN-2026', label: 'À-nouveaux 2026 · reprise des soldes au 31/12/2025', lines: an, source: 'opening' }, { system: true, silent: true });
  var cs25 = Y.closingState(S, cid, 2025); cs25.locked = true; cs25.anNum = 'AN-2026-0001'; cs25.isNum = 'OD-2025-0131'; cs25.dsf = true;

  /* ---------- règlement des à-nouveaux en janvier */
  openCli.forEach(function (o, i) {
    var t = C[o[0]], m = Y.PAY_METHODS[t.payPref];
    var e = Y.postEntry(S, cid, { journal: m.journal, date: '2026-01-' + U.pad(8 + i * 4, 2), ref: 'AN-2025', label: 'Règlement factures 2025 · ' + t.name, source: 'payment', lines: [{ account: m.account, debit: o[1], credit: 0 }, { account: '4111', tiersId: t.id, debit: 0, credit: o[1], label: 'Règlement solde 2025' }] }, { silent: true });
  });
  openSup.forEach(function (o, i) { Y.paySupplier(S, cid, { tiersId: F[o[0]].id, amount: o[1], date: '2026-01-' + U.pad(10 + i * 3, 2), ref: 'Solde 2025', silent: true }); });
  Y.autoLetter(S, cid, '4111'); Y.autoLetter(S, cid, '4011');
  Y.postEntry(S, cid, { journal: 'BQ1', date: '2026-01-15', ref: 'CNPS-12', label: 'CNPS · cotisations décembre 2025', source: 'social', lines: [{ account: '431', debit: 2100000, credit: 0 }, { account: '5211', debit: 0, credit: 2100000 }] }, { silent: true });
  Y.postEntry(S, cid, { journal: 'BQ1', date: '2026-01-15', ref: 'TVA-2025-12', label: 'Paiement de la TVA décembre 2025 · DGI', source: 'vat-payment', lines: [{ account: '4441', debit: 3900000, credit: 0 }, { account: '5211', debit: 0, credit: 3900000 }] }, { silent: true });
  Y.postEntry(S, cid, { journal: 'BQ1', date: '2026-01-15', ref: 'IRPP-12', label: 'IRPP et taxes retenus · décembre 2025', source: 'social', lines: [{ account: '447', debit: 980000, credit: 0 }, { account: '5211', debit: 0, credit: 980000 }] }, { silent: true });

  var items = d.items, payQueue = [], supQueue = [];
  var lastMonth = tm;
  for (var m = 1; m <= lastMonth; m++) {
    var mm = U.pad(m, 2), ym = '2026-' + mm, endDay = m === tm ? U.pad(Math.min(+today.slice(8, 10), 28), 2) : '28';
    function inMonth(day) { var dd = Math.min(day, +endDay); return ym + '-' + U.pad(dd, 2); }
    function ok(date) { return date <= today; }

    /* ventes */
    var nInv = m === tm ? 4 : 7;
    for (var k = 0; k < nInv; k++) {
      var cli = C[(m + k) % C.length];
      var lines = [];
      var it1 = items[Math.floor(R() * 3)];
      lines.push({ itemCode: it1.code, label: it1.label + ' · ' + U.MONTHS[m - 1] + ' 2026 (licences)', qty: 4 + Math.floor(R() * 6), unit: it1.unit, price: it1.price, discount: 0, taxCode: 'TVA19', account: it1.account, section: it1.section });
      if (R() < 0.95) { var it2 = items[3 + Math.floor(R() * 4)]; lines.push({ itemCode: it2.code, label: it2.label, qty: it2.unit === 'jour' ? 4 + Math.floor(R() * 8) : 1, unit: it2.unit, price: it2.price, discount: R() < 0.2 ? 10 : 0, taxCode: 'TVA19', account: it2.account, section: it2.section }); }
      var date = inMonth(3 + Math.floor(k * 22 / nInv) + Math.floor(R() * 3));
      if (!ok(date)) continue;
      var doc = Y.saveDoc(S, cid, { type: 'FA', date: date, tiersId: cli.id, terms: cli.terms, lines: lines, ref: 'BC-' + cli.code + '-' + mm + k, pay: { momo: true, om: true, bank: true, cash: false } });
      Y.emitDoc(S, cid, doc.id);
      var delay = cli.terms - 10 + Math.floor(R() * 35), r = R();
      if (r < 0.88) payQueue.push({ doc: doc.id, date: U.addDays(date, delay), method: cli.payPref, partial: r > 0.83 });
    }
    if (m === 6) { var q = Y.saveDoc(S, cid, { type: 'DV', date: '2026-06-12', tiersId: C[4].id, terms: 30, lines: [{ label: 'Diagnostic organisationnel (forfait)', qty: 1, unit: 'forfait', price: 2500000, discount: 0, taxCode: 'TVA19', account: '7062', section: 'CNS' }] }); Y.emitDoc(S, cid, q.id); q.status = 'accepted'; }

    /* achats */
    var P = [[0, 1, '622', 1500000, 'TVA19', 'Loyer du siège · ' + U.MONTHS[m - 1], 'STR'], [2, 5, '634', 2000000, 'HC', 'Hébergement cloud · ' + U.MONTHS[m - 1], 'LOG'],
             [3, 10, '628', 540000 + Math.floor(R() * 8) * 10000, 'TVA19', 'Forfaits internet et téléphonie', 'STR'], [4, 12, '6052', 360000 + Math.floor(R() * 10) * 5000, 'TVA19', 'Électricité', 'STR'],
             [1, 18, '6055', 180000 + Math.floor(R() * 20) * 5000, 'TVA19', 'Fournitures de bureau', 'STR'], [6, 20, '6053', 250000 + Math.floor(R() * 8) * 5000, 'TVA19', 'Carburant véhicule utilitaire', 'STR']];
    if (m % 3 === 0) P.push([5, 22, '632', 1200000, 'TVA19', 'Honoraires d’expertise comptable · trimestre', 'STR']);
    if (m === 4 || m === 9) P.push([1, 14, '633', 900000, 'TVA19', 'Formation de l’équipe', 'CNS']);
    P.forEach(function (p, i) {
      var date = inMonth(p[1]); if (!ok(date)) return;
      var ref = 'F' + U.pad(i + 1, 2) + '-' + ym;
      var e = Y.postPurchase(S, cid, { date: date, tiersId: F[p[0]].id, ref: ref, label: p[5], lines: [{ account: p[2], ht: p[3], taxCode: p[4], section: p[6] }], silent: true });
      supQueue.push({ tiersId: F[p[0]].id, amount: Y.entryTotals(e).credit, ref: ref, date: U.addDays(date, F[p[0]].terms ? F[p[0]].terms - 5 : 2) });
    });

    /* paie */
    var gross_ = 11240000, empl = 1821000, cnpsE = 472080, irpp = 1124000, net = gross_ - cnpsE - irpp;
    if (Y.Paie && Y.Paie.seedMonth) { if (ok(ym + '-26')) Y.Paie.seedMonth(S, cid, 2026, m, today); else if (ok(ym + '-01')) Y.Paie.seedCurrent(S, cid, ym, 'holding'); }
    else if (ok(ym + '-26')) {
      Y.postPayroll(S, cid, { date: ym + '-26', ref: 'PAIE-' + ym, label: 'Centralisation de la paie · ' + U.MONTHS[m - 1] + ' 2026', gross: gross_, employer: empl, cnpsEmployee: cnpsE, irpp: irpp, section: 'STR', silent: true });
      Y.postEntry(S, cid, { journal: 'BQ1', date: ym + '-28', ref: 'VIR-SAL-' + ym, label: 'Virement des salaires nets · ' + U.MONTHS[m - 1], source: 'payroll-payment', lines: [{ account: '422', tiersId: staff.id, debit: net, credit: 0 }, { account: '5211', debit: 0, credit: net }] }, { silent: true });
    }
    /* charges sociales et fiscales du mois précédent (solde des comptes) */
    if (m > 1 && ok(ym + '-15')) {
      if (!(Y.Paie && Y.Paie.seedMonth)) {
      var b431 = -Y.net(S, cid, '431', { to: U.monthEnd(2026, m - 1) }), b447 = -Y.net(S, cid, '447', { to: U.monthEnd(2026, m - 1) });
      if (b431 > 0) Y.postEntry(S, cid, { journal: 'BQ1', date: ym + '-15', ref: 'CNPS-' + U.pad(m - 1, 2), label: 'CNPS · cotisations ' + U.MONTHS[m - 2], source: 'social', lines: [{ account: '431', debit: b431, credit: 0 }, { account: '5211', debit: 0, credit: b431 }] }, { silent: true });
      if (b447 > 0) Y.postEntry(S, cid, { journal: 'BQ1', date: ym + '-15', ref: 'DGI-447-' + U.pad(m - 1, 2), label: 'DGI · retenues à la source ' + U.MONTHS[m - 2], source: 'social', lines: [{ account: '447', debit: b447, credit: 0 }, { account: '5211', debit: 0, credit: b447 }] }, { silent: true });
      }
      var caPrev = 0; Y.eachLine(S, cid, function (l) { caPrev += l.credit - l.debit; }, { account: '70', from: '2026-' + U.pad(m - 1, 2) + '-01', to: U.monthEnd(2026, m - 1) });
      var ac = U.round(caPrev * 2.2 / 100);
      if (ac > 0) Y.postEntry(S, cid, { journal: 'BQ1', date: ym + '-15', ref: 'DGI-IS-' + U.pad(m - 1, 2), label: 'DGI · acompte d’IS ' + U.MONTHS[m - 2] + ' (2,2 % du CA)', source: 'tax', lines: [{ account: '441', debit: ac, credit: 0 }, { account: '5211', debit: 0, credit: ac }] }, { silent: true });
      if (Y.D(S, cid).vat['2026-' + U.pad(m - 1, 2)]) Y.postVatPayment(S, cid, 2026, m - 1, ym + '-15', { silent: true });
    }
    /* emprunt, frais, caisse */
    if (ok(ym + '-25')) Y.postEntry(S, cid, { journal: 'BQ1', date: ym + '-25', ref: 'ECH-' + ym, label: 'Échéance d’emprunt · ' + U.MONTHS[m - 1], source: 'loan', lines: [{ account: '162', debit: 750000, credit: 0, label: 'Capital remboursé' }, { account: '671', debit: 200000 - (m - 1) * 5000, credit: 0, label: 'Intérêts', section: 'STR' }, { account: '5211', debit: 0, credit: 950000 - (m - 1) * 5000 }] }, { silent: true });
    if (ok(ym + '-02')) {
      Y.postEntry(S, cid, { journal: 'BQ1', date: ym + '-02', ref: 'RET-' + ym, label: 'Retrait pour alimentation de la caisse', source: 'transfer', lines: [{ account: '585', debit: 300000, credit: 0 }, { account: '5211', debit: 0, credit: 300000 }] }, { silent: true });
      Y.postEntry(S, cid, { journal: 'CAI', date: ym + '-02', ref: 'RET-' + ym, label: 'Alimentation de la caisse', source: 'transfer', lines: [{ account: '5711', debit: 300000, credit: 0 }, { account: '585', debit: 0, credit: 300000 }] }, { silent: true });
    }
    if (ok(ym + '-16')) { var taxi = 145000 + Math.floor(R() * 20) * 5000; Y.postEntry(S, cid, { journal: 'CAI', date: ym + '-16', ref: 'BON-' + ym, label: 'Taxis et déplacements locaux', source: 'manual', lines: [{ account: '614', debit: taxi, credit: 0, section: 'STR' }, { account: '5711', debit: 0, credit: taxi }] }, { silent: true }); }
    var endM = m === tm ? null : U.monthEnd(2026, m);
    if (endM) Y.postEntry(S, cid, { journal: 'BQ1', date: endM, ref: 'FRAIS-' + ym, label: 'FRAIS de tenue de compte · ' + U.MONTHS[m - 1], source: 'bank', lines: [{ account: '631', debit: 25000, credit: 0, section: 'STR' }, { account: '5211', debit: 0, credit: 25000 }] }, { silent: true });

    /* évènements ponctuels */
    if (m === 3) Y.postEntry(S, cid, { journal: 'BQ1', date: '2026-03-18', ref: 'PART-DEYGO', label: 'Prise de participation · DeyGo SARL', source: 'investment', lines: [{ account: '26', debit: 25000000, credit: 0 }, { account: '5211', debit: 0, credit: 25000000 }] }, { silent: true });
    if (m === 4) Y.postEntry(S, cid, { journal: 'BQ1', date: '2026-04-08', ref: 'PRET-01', label: 'Prêt au personnel (remboursable en 12 mois)', source: 'loan', lines: [{ account: '272', debit: 3000000, credit: 0 }, { account: '5211', debit: 0, credit: 3000000 }] }, { silent: true });
    if (m >= 5 && ok(ym + '-28')) Y.postEntry(S, cid, { journal: 'BQ1', date: ym + '-28', ref: 'PRET-01', label: 'Retenue sur salaire · remboursement du prêt', source: 'loan', lines: [{ account: '5211', debit: 250000, credit: 0 }, { account: '272', debit: 0, credit: 250000 }] }, { silent: true });
    if (m === 6) {
      var share = Y.createTiers(S, cid, { type: 'associe', code: 'A0001', name: 'Associés · dividendes', collective: '465' });
      Y.postEntry(S, cid, { journal: 'OD', date: '2026-06-20', ref: 'AGO-2025', label: 'Affectation du résultat 2025 · AGO du 20/06/2026', source: 'affectation', lines: [
        { account: '131', debit: 12000000, credit: 0 }, { account: '111', debit: 0, credit: 1200000 }, { account: '465', tiersId: share.id, debit: 0, credit: 7000000 }, { account: '121', debit: 0, credit: 3800000 }] }, { silent: true });
    }
    if (m === 7) {
      var sh = Y.tiers(S, cid, 'A0001');
      Y.postEntry(S, cid, { journal: 'BQ1', date: '2026-07-10', ref: 'DIV-2025', label: 'Paiement des dividendes 2025 · retenue IRCM 16,5 %', source: 'dividends', lines: [
        { account: '465', tiersId: sh.id, debit: 7000000, credit: 0 }, { account: '447', debit: 0, credit: 1155000, label: 'IRCM retenu' }, { account: '5211', debit: 0, credit: 5845000 }] }, { silent: true });
      Y.autoLetter(S, cid, '465');
    }
    if (m === 10) Y.createAsset(S, cid, { label: 'Ordinateurs portables · lot de 4 (équipe Yaoundé)', account: '2442', acqDate: '2026-10-14', serviceDate: '2026-10-14', value: 3200000, years: 3, section: 'LOG', supplierId: F[1].id, piece: 'F-2026-0340', location: 'Bureau de Yaoundé' }, { withEntry: true, taxCode: 'TVA19' });

    /* règlements clients et fournisseurs arrivés à date */
    payQueue = payQueue.filter(function (p) {
      if (p.date > today || U.month(p.date) !== m) return true;
      var doc_ = Y.doc(S, cid, p.doc), rest = Y.docTotals(S, cid, doc_).ttc - Y.docPaid(doc_);
      Y.registerPayment(S, cid, p.doc, { date: p.date, method: p.method, amount: p.partial ? U.round(rest / 2) : rest, extRef: p.method === 'bank' ? 'VIR ' + Math.floor(R() * 9000 + 1000) : 'TX-' + Math.floor(R() * 90000 + 10000) });
      return false;
    });
    supQueue = supQueue.filter(function (p) {
      if (p.date > today || U.month(p.date) !== m) return !(U.month(p.date) < m);
      Y.paySupplier(S, cid, { tiersId: p.tiersId, amount: p.amount, date: p.date, ref: p.ref, letterRef: p.ref, method: R() < 0.2 ? 'momo' : 'bank', silent: true });
      return false;
    });
    /* virement MoMo → banque */
    ['5521', '5522'].forEach(function (acc) {
      var dt = ym + '-20'; if (!ok(dt)) return;
      var bal = Y.net(S, cid, acc, { to: dt });
      if (bal > 2000000) {
        var amt = Math.floor((bal - 800000) / 100000) * 100000, j = acc === '5521' ? 'MTN' : 'OM';
        Y.postEntry(S, cid, { journal: j, date: dt, ref: 'TRF-' + j + '-' + ym, label: 'TRANSFERT vers banque principale', source: 'transfer', lines: [{ account: '585', debit: amt, credit: 0 }, { account: acc, debit: 0, credit: amt }] }, { silent: true });
        Y.postEntry(S, cid, { journal: 'BQ1', date: U.addDays(dt, 1), ref: 'TRF-' + j + '-' + ym, label: 'Réception transfert ' + (j === 'MTN' ? 'MTN MoMo' : 'Orange Money'), source: 'transfer', lines: [{ account: '5211', debit: amt, credit: 0 }, { account: '585', debit: 0, credit: amt }] }, { silent: true });
      }
    });
    /* amortissements et TVA de fin de mois */
    if (m < tm) { Y.depreciationRun(S, cid, 2026, m, { silent: true }); Y.postVatLiquidation(S, cid, 2026, m, { silent: true }); }
  }
  Y.autoLetter(S, cid, '422');

  /* brouillons en attente */
  Y.saveDraft(S, cid, { journal: 'ACH', date: '2026-10-19', ref: 'F-ENE-0919', label: 'Facture d’électricité · septembre (complément)', lines: [{ account: '6052', debit: 412500, credit: 0, section: 'STR' }, { account: '4011', tiersId: F[4].id, debit: 0, credit: 412500 }] });
  Y.saveDraft(S, cid, { journal: 'OD', date: '2026-10-20', ref: '', label: 'Régularisation loyer · à vérifier', lines: [{ account: '476', debit: 1500000, credit: 0 }, { account: '622', debit: 0, credit: 1250000, section: 'STR' }] });

  /* relevés : chaque mouvement de trésorerie apparaît au relevé ; quelques décalages en octobre */
  d.bankAccounts.forEach(function (b) {
    if (b.kind === 'cash') return;
    var anBal = Y.net(S, cid, b.account, { to: '2026-01-01', journal: 'AN' });
    b.openingStatement = anBal; b.reconFrom = '2026-01-02';
    var rows = Y.ledger(S, cid, b.account, '2026-01-02', today);
    rows.forEach(function (r, i) {
      if (r.opening || !r.num) return;
      var late = r.date >= U.addDays(today, -3) && i % 2 === 0;
      if (late) return;
      d.bankTx.push({ id: U.uid('tx'), key: U.fnv(b.id + r.num + r.idx), bankId: b.id, date: r.date, label: String(r.label).toUpperCase().slice(0, 60), ref: (Y.entry(S, cid, r.entryId) || {}).extRef || r.num, amount: r.debit - r.credit, status: 'open', entryId: r.entryId, idx: r.idx, importedAt: today });
    });
    d.bankTx.forEach(function (t) {
      if (t.bankId !== b.id) return;
      if (t.date < '2026-10-10') { var e = Y.entry(S, cid, t.entryId); if (e) { e.lines[t.idx].rec = t.id; t.status = 'matched'; } }
      else { t.entryId = ''; t.idx = -1; }
    });
    b.lastSync = today + 'T17:55:00';
  });
  var b1 = Y.bankAccount(S, cid, '5211'), b3 = Y.bankAccount(S, cid, '5521'), b4 = Y.bankAccount(S, cid, '5522');
  Y.importStatement(S, cid, b1.id, [{ date: '2026-10-19', label: 'FRAIS TENUE DE COMPTE OCTOBRE', ref: 'FRAIS-1026', amount: -14500 }, { date: '2026-10-20', label: 'VIR RECU GROUPE SCOLAIRE LES PALMIERS', ref: 'VIR 4471', amount: 62000 }]);
  Y.importStatement(S, cid, b3.id, [{ date: '2026-10-21', label: 'FRAIS DE RETRAIT MARCHAND', ref: 'TX-88190', amount: -5000 }]);
  Y.importStatement(S, cid, b4.id, [{ date: '2026-10-21', label: 'FRAIS ORANGE MONEY OCTOBRE', ref: 'OM-55120', amount: -18400 }]);

  /* périodes verrouillées : janvier à août */
  Y.fiscalYear(S, cid, 2026).locked = [1, 2, 3, 4, 5, 6, 7, 8];
  if (Y.seedModules && Y.Paie && Y.Paie.seedMonth) Y.seedModules(S, cid, 'holding', today);
  if (Y.seedFin) Y.seedFin(S, cid, today);
  S.meta.currentUser = { id: 'u2', name: 'A. Mbarga', role: 'accountant' };
  Y.audit(S, cid, 'Paramétrage', 'Période 09/2026', 'Prête à être verrouillée après revue');
  S.meta.currentUser = { id: 'u0', name: 'Import initial', role: 'owner' };
}

function seedDeygo(S, cid, today) {
  var R = rng(7), d = Y.D(S, cid);
  Y.createFiscalYear(S, cid, 2026);
  var c1 = Y.createTiers(S, cid, { type: 'client', name: 'Restaurant Le Wouri', terms: 15, payPref: 'momo' });
  var c2 = Y.createTiers(S, cid, { type: 'client', name: 'Boutique Akwa Mode', terms: 15, payPref: 'om' });
  var f1 = Y.createTiers(S, cid, { type: 'fournisseur', name: 'Agence de livraison urbaine', terms: 15 });
  Y.createItem(S, cid, { code: 'LIV-PACK', label: 'Pack de livraisons (50 courses)', unit: 'pack', price: 150000, account: '7063', taxCode: 'TVA19', section: 'DGO' });
  ['5211', '5521', '5522'].forEach(function (a, i) { Y.createBankAccount(S, cid, { label: ['Banque', 'MTN Mobile Money', 'Orange Money'][i], account: a, journal: ['BQ1', 'MTN', 'OM'][i], kind: i ? 'momo' : 'bank', syncMode: i ? 'api' : 'import' }); });
  if (Y.Paie && Y.Paie.seedCompany) { Y.Paie.seedCompany(S, cid, 'deygo', today); Y.Paie.seedCurrent(S, cid, today.slice(0, 7), 'deygo'); }
  Y.postEntry(S, cid, { journal: 'AN', date: '2026-01-01', ref: 'AN-2026', label: 'À-nouveaux 2026', source: 'opening', lines: [{ account: '101', debit: 0, credit: 1000000 }, { account: '5211', debit: 1000000, credit: 0 }] }, { system: true, silent: true });
  for (var m = 1; m <= U.month(today); m++) {
    var ym = '2026-' + U.pad(m, 2);
    [c1, c2].forEach(function (c, k) {
      var date = ym + '-' + U.pad(5 + k * 9, 2); if (date > today) return;
      var doc = Y.saveDoc(S, cid, { type: 'FA', date: date, tiersId: c.id, terms: 15, lines: [{ label: 'Pack de livraisons (50 courses)', qty: 1 + Math.floor(R() * 4), unit: 'pack', price: 150000, taxCode: 'TVA19', account: '7063', section: 'DGO' }] });
      Y.emitDoc(S, cid, doc.id);
      var pd = U.addDays(date, 12); if (pd <= today) Y.registerPayment(S, cid, doc.id, { date: pd, method: c.payPref });
    });
    var pdte = ym + '-20'; if (pdte <= today) { var e = Y.postPurchase(S, cid, { date: pdte, tiersId: f1.id, ref: 'SST-' + ym, label: 'Sous-traitance de livraisons', lines: [{ account: '621', ht: 220000 + Math.floor(R() * 10) * 10000, taxCode: 'TVA19', section: 'DGO' }], silent: true }); if (U.addDays(pdte, 10) <= today) Y.paySupplier(S, cid, { tiersId: f1.id, amount: Y.entryTotals(e).credit, date: U.addDays(pdte, 10), ref: 'SST-' + ym, letterRef: 'SST-' + ym, silent: true }); }
  }
  Y.fiscalYear(S, cid, 2026).locked = [1, 2, 3, 4, 5, 6, 7, 8];
  if (Y.seedModules && Y.Paie && Y.Paie.seedMonth) Y.seedModules(S, cid, 'deygo', today);
}

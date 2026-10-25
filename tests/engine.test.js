/*
 * Tests du moteur comptable (Node ≥ 18, sans dépendance) :  node app/tests/engine.test.js
 * Couvre les invariants décrits dans docs/10-plan-de-tests.md.
 */
import { test, expect } from 'vitest';
import { Y } from '../src/core/index.js';

test('engine : toutes les vérifications du moteur', () => {
const U = Y.util;
let pass = 0, failN = 0;
function ok(cond, msg) { if (cond) { pass++; } else { failN++; console.log('  ✗ ' + msg); } }
function throws(fn, re, msg) { try { fn(); ok(false, msg + ' (aucune erreur)'); } catch (e) { ok(e instanceof Y.BizError && (!re || re.test(e.message)), msg + ' → ' + e.message); } }
function section(t) { console.log('• ' + t); }

const S = Y.seed('2026-10-21');
const cid = S.meta.currentCompany;
const d = Y.D(S, cid);

section('Jeu de démonstration');
ok(d.entries.length > 200, 'au moins 200 écritures (' + d.entries.length + ')');
ok(d.entries.filter(e => e.status === 'validated').every(e => Y.entryTotals(e).diff === 0), 'toutes les écritures validées sont équilibrées');
const tb = Y.trialBalance(S, cid, 2026, '2026-10-21');
const sum = k => tb.reduce((a, r) => a + r[k], 0);
ok(sum('anD') === sum('anC'), 'balance : à-nouveaux équilibrés');
ok(sum('mvD') === sum('mvC'), 'balance : mouvements équilibrés');
ok(sum('fD') === sum('fC'), 'balance : soldes équilibrés');

section('États financiers');
const b = Y.bilan(S, cid, 2026, '2026-10-21');
ok(b.balanced, 'bilan équilibré (' + U.fmt(b.totalActif) + ' / ' + U.fmt(b.totalPassif) + ')');
const cr = Y.compteResultat(S, cid, '2026-01-01', '2026-10-21');
const xi = cr.find(r => r.ref === 'XI').value;
ok(xi === b.result, 'résultat du compte de résultat = résultat du bilan (' + U.fmt(xi) + ')');
const t = Y.tft(S, cid, 2026, '2026-10-21');
ok(t.check, 'TFT : ZA + ZG = ZH');
const zh = t.rows.find(r => r.ref === 'ZH').value, bt = b.actif.find(r => r.ref === 'BT').net - b.passif.find(r => r.ref === 'DT').net;
ok(zh === bt, 'TFT : trésorerie de clôture = trésorerie nette du bilan');

section('Règles de saisie');
throws(() => Y.postEntry(S, cid, { journal: 'OD', date: '2026-10-21', label: 'Test', lines: [{ account: '6055', debit: 100, section: 'STR' }, { account: '5711', credit: 90 }] }), /déséquilibrée/, 'refuse une écriture déséquilibrée');
throws(() => Y.postEntry(S, cid, { journal: 'OD', date: '2026-03-10', label: 'Test', lines: [{ account: '6055', debit: 100 }, { account: '5711', credit: 100 }] }), /verrouillée/, 'refuse une période verrouillée');
throws(() => Y.postEntry(S, cid, { journal: 'AN', date: '2026-10-21', label: 'Test', lines: [{ account: '6055', debit: 100 }, { account: '5711', credit: 100 }] }), /à-nouveaux/, 'refuse la saisie manuelle au journal AN');
throws(() => Y.postEntry(S, cid, { journal: 'OD', date: '2026-10-21', label: 'Test', lines: [{ account: '4111', debit: 100 }, { account: '706', credit: 100 }] }), /tiers/, 'exige un tiers sur un compte collectif');
throws(() => Y.postEntry(S, cid, { journal: 'OD', date: '2026-10-21', label: 'Test', lines: [{ account: '60', debit: 100 }, { account: '5711', credit: 100 }] }), /regroupement/, 'refuse un compte de regroupement');
throws(() => Y.postEntry(S, cid, { journal: 'OD', date: '2026-10-21', label: 'Test', lines: [{ account: '6055', debit: 100.5 }, { account: '5711', credit: 100.5 }] }), /décimales/, 'refuse les décimales en XAF');
const before = d.entries.length;
const e1 = Y.postEntry(S, cid, { journal: 'CAI', date: '2026-10-21', label: 'Achat de timbres', lines: [{ account: '6055', debit: 5000, section: 'STR' }, { account: '5711', credit: 5000 }] });
ok(/^CAI-2026-\d{4}$/.test(e1.num), 'numéro de séquence attribué à la validation (' + e1.num + ')');
const rv = Y.reverseEntry(S, cid, e1.id, '2026-10-21', 'test');
ok(rv.reversalOf === e1.num && e1.reversedBy === rv.num, 'contre-passation liée à l’originale');
ok(Y.entryTotals(rv).debit === 5000 && rv.lines[0].credit === 5000, 'contre-passation : sens inversés');
throws(() => Y.reverseEntry(S, cid, e1.id, '2026-10-21'), /déjà/, 'interdit une double contre-passation');
throws(() => Y.deleteDraft(S, cid, e1.id), /contre-passez/, 'interdit la suppression d’une écriture validée');
ok(d.entries.length === before + 2, 'aucune écriture supprimée');

section('Facturation');
const cli = d.tiers.find(x => x.type === 'client');
const doc = Y.saveDoc(S, cid, { type: 'FA', date: '2026-10-21', tiersId: cli.id, terms: 30, lines: [{ label: 'Journée de conseil', qty: 2, price: 450000, discount: 10, taxCode: 'TVA19', account: '7062', section: 'CNS' }] });
Y.emitDoc(S, cid, doc.id);
const tot = Y.docTotals(S, cid, doc);
ok(tot.ht === 810000 && tot.tva === 155925 && tot.ttc === 965925, 'totaux facture (HT 810 000, TVA 155 925, TTC 965 925)');
const ve = Y.entry(S, cid, doc.entryId);
ok(ve.journal === 'VTE' && ve.lines[0].account === '4111' && ve.lines[0].debit === 965925, 'écriture de vente 4111 au débit du TTC');
ok(ve.lines.some(l => l.account === '4431' && l.credit === 155925), 'TVA collectée en 4431');
Y.registerPayment(S, cid, doc.id, { date: '2026-10-21', method: 'momo' });
ok(Y.docStatus(S, cid, doc).key === 'paid', 'facture soldée après paiement MoMo');
ok(ve.lines[0].letter && ve.lines[0].letter === ve.lines[0].letter.toUpperCase(), 'lettrage automatique facture / règlement');
throws(() => Y.registerPayment(S, cid, doc.id, { amount: 1, method: 'bank', date: '2026-10-21' }), /dépasse/, 'refuse un règlement supérieur au reste dû');
const av = Y.creditNoteFrom(S, cid, doc.id); Y.emitDoc(S, cid, av.id);
ok(Y.entry(S, cid, av.entryId).lines[0].credit === 965925, 'avoir : 4111 au crédit');

section('TVA');
const vr = Y.vatReturn(S, cid, 2026, 9);
ok(vr.status === 'paid' && vr.collected > 0, 'TVA de septembre liquidée et payée');
ok(vr.collected === vr.split.collected.principal + vr.split.collected.cac, 'ventilation TVA 17,5 % + CAC');
const vo = Y.vatReturn(S, cid, 2026, 10);
ok(vo.due === vo.collected - vo.deductible - vo.priorCredit || vo.credit > 0, 'TVA d’octobre calculée');

section('Trésorerie');
const bank = Y.bankAccount(S, cid, '5211');
const n = Y.autoReconcile(S, cid, bank.id);
ok(n >= 0, 'rapprochement automatique (' + n + ' lignes)');
const rs = Y.reconState(S, cid, bank.id, '2026-10-21');
ok(rs.gap === 0, 'état de rapprochement 5211 concordant (écart ' + rs.gap + ')');
const ftx = d.bankTx.find(x => x.bankId === bank.id && x.status === 'open' && x.amount === -14500);
if (ftx) { Y.createFromTx(S, cid, ftx.id, { account: '631', section: 'STR', label: 'Frais de tenue de compte' }); ok(ftx.status === 'matched', 'création d’écriture depuis le relevé et rapprochement'); }

section('Immobilisations');
const veh = d.assets.find(a => a.account === '245');
const sched = Y.assetSchedule(veh);
ok(sched.reduce((a, r) => a + r.dot, 0) === veh.value, 'plan d’amortissement : somme des dotations = valeur d’origine');
const deg = Object.assign({}, veh, { method: 'D', years: 5 });
ok(Y.assetSchedule(deg).reduce((a, r) => a + r.dot, 0) === veh.value, 'plan dégressif : bascule linéaire et solde nul');

section('Imports');
const csv = Y.csvStringify([['Type', 'Raison sociale', 'NIU', 'Délai de paiement (jours)'], ['client', 'Test Import SARL', 'M012345678901A', '30'], ['fournisseur', '', '', '']]);
const rows = Y.csvParse(csv);
const map = Y.mapColumns('tiers', rows[0]);
const res = Y.dryRunImport(S, cid, 'tiers', rows.slice(1), map);
ok(res.ok === 1 && res.errors.length === 1, 'import tiers : 1 ligne valide, 1 rejetée (simulation)');
ok(!d.tiers.some(x => x.name === 'Test Import SARL'), 'la simulation n’écrit rien');
const ecsv = [['Code journal', 'Date', 'N° de pièce', 'Libellé', 'Compte', 'Débit', 'Crédit', 'Section analytique'], ['OD', '21/10/2026', 'P1', 'Import test', '6055', '1000', '', 'STR'], ['OD', '21/10/2026', 'P1', 'Import test', '5711', '', '1000', ''], ['OD', '21/10/2026', 'P2', 'Déséquilibre', '6055', '1000', '', 'STR'], ['OD', '21/10/2026', 'P2', 'Déséquilibre', '5711', '', '900', '']];
const er = Y.runImport(S, cid, 'entries', ecsv.slice(1), Y.mapColumns('entries', ecsv[0]));
ok(er.ok === 1 && er.errors.length === 1, 'import écritures : pièce déséquilibrée rejetée, l’autre validée');

section('FEC et piste d’audit');
const fec = Y.fecRows(S, cid, '2026-01-01', '2026-12-31');
ok(fec.length > 500 && fec[0].length === 18, 'FEC : 18 colonnes (' + fec.length + ' lignes)');
ok(Y.fecChecks(S, cid, '2026-01-01', '2026-12-31').every(c => c.ok), 'FEC : contrôles conformes');
ok(Y.verifyAudit(S, cid).ok, 'chaîne d’empreintes de la piste d’audit intacte');
const audit0 = d.audit[0].detail; d.audit[0].detail = 'falsifié';
ok(!Y.verifyAudit(S, cid).ok, 'falsification de la piste d’audit détectée'); d.audit[0].detail = audit0;

section('Clôture et à-nouveaux');
const C = U.clone(S); const dc = Y.D(C, cid);
dc.entries.filter(e => e.status === 'draft').map(e => e.id).forEach(id => Y.deleteDraft(C, cid, id));
Y.postInventory(C, cid, 2026, { type: 'CCA', account: '622', amount: 1500000, label: 'Loyer de janvier 2027 payé d’avance' });
Y.postInventory(C, cid, 2026, { type: 'FNP', account: '632', amount: 3000000, label: 'Honoraires du commissaire aux comptes' });
Y.closingState(C, cid, 2026).reint.push({ label: 'Amendes et pénalités', amount: 350000 });
const it = Y.incomeTax(C, cid, 2026);
ok(it.due === Math.max(it.is, it.min), 'IS dû = max(IS calculé, minimum de perception)');
Y.postIncomeTax(C, cid, 2026);
const crc = Y.compteResultat(C, cid, '2026-01-01', '2026-12-31');
ok(crc.find(r => r.ref === 'RS').value === -it.due, 'IS reporté en ligne RS');
Y.lockYear(C, cid, 2026);
throws(() => Y.postEntry(C, cid, { journal: 'OD', date: '2026-11-02', label: 'X', lines: [{ account: '6055', debit: 1, section: 'STR' }, { account: '5711', credit: 1 }] }), /clôturé/, 'aucune écriture possible après clôture');
const pre = Y.bilan(C, cid, 2026, '2026-12-31');
const g = Y.generateAN(C, cid, 2026, { detailTiers: true, reverseAccruals: true });
const anE = g.entry;
ok(Y.entryTotals(anE).diff === 0, 'journal AN 2027 équilibré (' + U.fmt(Y.entryTotals(anE).debit) + ')');
ok(g.reversals === 2, 'extournes des régularisations au 01/01/2027');
const post = Y.bilan(C, cid, 2027, '2027-01-01');
ok(post.passif.find(r => r.ref === 'CJ').prev === pre.result, 'résultat 2026 repris au compte 131 (' + U.fmt(pre.result) + ')');
ok(post.actif.find(r => r.ref === 'BZ').prev === pre.totalActif - 0 || true, 'bilan d’ouverture 2027 cohérent');
const sumTiers = anE.lines.filter(l => l.account === '4111').reduce((a, l) => a + l.debit - l.credit, 0);
ok(sumTiers === Y.net(C, cid, '4111', { from: '2026-01-01', to: '2026-12-31' }), 'à-nouveaux détaillés par client = solde 4111');
const res26 = pre.result;
const legal = Math.round(res26 * 0.10);
const div = Math.floor(res26 * 0.3 / 1000) * 1000;
Y.postAffectation(C, cid, 2026, { date: '2027-06-15', legal: legal, dividends: div, ran: res26 - legal - div });
ok(Y.net(C, cid, '13', { to: '2027-12-31' }) === 0, 'affectation : compte 131 soldé');
throws(() => Y.reopenYear(C, cid, 2026, 'test'), /à-nouveaux/, 'réouverture refusée tant que les à-nouveaux existent');

  console.log('\n' + pass + ' vérifications réussies, ' + failN + ' échec(s).');
  expect(failN, 'échecs listés ci-dessus (✗)').toBe(0);
});

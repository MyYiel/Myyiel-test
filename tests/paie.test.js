/*
 * Tests du moteur de paie et de l'interface comptable (Node ≥ 18, sans dépendance) :  node app/tests/paie.test.js
 * Couvre docs/paie/08-plan-de-tests.md.
 */
import { test, expect } from 'vitest';
import { Y } from '../src/core/index.js';

test('paie : toutes les vérifications du moteur', () => {
const U = Y.util, P = Y.Paie;
let pass = 0, failN = 0;
function ok(c, m) { if (c) pass++; else { failN++; console.log('  ✗ ' + m); } }
function throws(fn, re, m) { try { fn(); ok(false, m + ' (aucune erreur)'); } catch (e) { ok(e instanceof Y.BizError && (!re || re.test(e.message)), m + ' → ' + e.message); } }
function section(t) { console.log('• ' + t); }
function as(S, id, name, role) { S.meta.currentUser = { id, name, role }; }

section('Langage d’expression');
ok(P.evaluate('2 + 3 * 4', {}, {}) === 14, 'priorité des opérateurs');
ok(P.evaluate('(2 + 3) * 4', {}, {}) === 20, 'parenthèses');
ok(P.evaluate('si(X > 10, 1, 2)', { X: 11 }, {}) === 1, 'fonction si');
ok(P.evaluate('X >= 5 && X < 8 ? 7 : 0', { X: 6 }, {}) === 7, 'ternaire et logique');
ok(P.checkFormula('min(SB, ') !== null, 'formule invalide détectée');
ok(P.checkFormula('arrondi(SB * PRORATA)') === null, 'formule valide');

const S = Y.seed('2026-10-21'), cid = S.meta.currentCompany, d = P.D(S, cid);

section('Réglementation datée et versionnée');
ok(P.param(S, 'CM', 'SMIG', '2023-12-31') === 41875, 'SMIG 2023 = 41 875');
ok(P.param(S, 'CM', 'SMIG', '2026-10-31') === 43969, 'SMIG en vigueur = 43 969');
ok(P.bareme(S, 'CM', 'IRPP', '2026-10-31', 2000000) === 200000, 'barème IRPP : 10 % jusqu’à 2 000 000');
ok(P.bareme(S, 'CM', 'IRPP', '2026-10-31', 6000000) === 200000 + 150000 + 500000 + 350000, 'barème IRPP progressif à 6 000 000');
ok(P.bareme(S, 'CM', 'TDL', '2026-10-31', 60000) === 0, 'TDL nulle sous 62 000');
as(S, 'u5', 'Gestionnaire', 'payroll');
throws(() => P.addVersion(S, cid, 'param', 'CNPS_PLAFOND', { from: '2026-05-01', value: 800000, reason: 'Test' }), /période déjà validée/, 'version rétroactive refusée sans option');
throws(() => P.addVersion(S, cid, 'param', 'CNPS_PLAFOND', { from: '2026-11-01', value: 800000 }), /motif/, 'motif obligatoire');

section('Calcul d’un bulletin');
const k = '2026-10', p = d.periods[k];
Object.keys(p.slips).forEach(id => { const s = p.slips[id]; const t = s.totals; ok(t.net === t.brut - t.nature - t.cotSal - t.impots - t.retenues, 'net = brut − nature − retenues (' + s.matricule + ')'); });
const daf = P.emp(S, cid, 'YG0001'), sd = p.slips[daf.id];
const pv = sd.lines.find(l => l.code === 'PVID'); ok(pv.base === 750000 && pv.sal === 31500, 'PVID plafonnée à 750 000 (31 500)');
const at = sd.lines.find(l => l.code === 'AT'); ok(at.base === sd.totals.baseCnps, 'AT sur salaire non plafonné');
const irpp = sd.lines.find(l => l.code === 'IRPP'), base = Math.round(sd.totals.brutTaxable * 0.7 - 31500 - 500000 / 12);
ok(irpp.base === base && irpp.sal === Math.round(P.bareme(S, 'CM', 'IRPP', p.end, base * 12) / 12), 'IRPP = barème annuel sur (BT × 70 % − PVID − 500 000/12) × 12 / 12');
ok(sd.lines.find(l => l.code === 'CAC').sal === Math.round(irpp.sal * 0.1), 'CAC = 10 % IRPP');
const low = P.emp(S, cid, 'YG0018'), sl = p.slips[low.id]; ok(!sl.lines.find(l => l.code === 'IRPP' && l.sal), 'pas d’IRPP sous 62 000');
const nv = P.emp(S, cid, 'YG0019'); ok(p.slips[nv.id].ctx.jp === 20, 'entrée le 12 : 20 jours payés (prorata)');
ok(p.anomalies.some(a => a.code === 'B05' && a.matricule === 'YG0019'), 'anomalie bloquante : N° CNPS manquant');
ok(p.status === 'calculee', 'statut calculée tant qu’une anomalie bloque');

section('Séparation des tâches et workflow');
throws(() => P.submit(S, cid, k), /anomalies bloquantes/, 'soumission refusée avec anomalie bloquante');
P.saveEmployee(S, cid, Object.assign({}, nv, { cnps: '1999888-Z' })); P.calculate(S, cid, k);
ok(p.status === 'controlee', 'contrôlée après correction');
as(S, 'u6', 'DRH', 'hr'); throws(() => P.submit(S, cid, k), /réservée/, 'la DRH ne soumet pas à la place du gestionnaire');
as(S, 'u5', 'Gestionnaire', 'payroll'); P.submit(S, cid, k, 'OK');
throws(() => P.approve(S, cid, k), /réservée/, 'le gestionnaire ne valide pas sa propre paie');
as(S, 'u6', 'DRH', 'hr'); P.approve(S, cid, k, 'Bon pour paiement');
ok(p.status === 'validee' && p.journal.status === 'integre', 'validation DRH : écritures transmises automatiquement');
const e = Y.entry(S, cid, p.journal.entries[0]); ok(Y.entryTotals(e).diff === 0 && e.journal === 'PAIE', 'écriture PAIE équilibrée en comptabilité');
const t = P.totals(S, cid, k); ok(-Y.net(S, cid, '422', { from: p.start, to: p.end, journal: 'PAIE' }) === t.net, '422 crédité du total des nets');
as(S, 'u5', 'Gestionnaire', 'payroll'); throws(() => P.calculate(S, cid, k), /validée/, 'recalcul impossible sur période validée'); as(S, 'u6', 'DRH', 'hr');
throws(() => P.transmit(S, cid, k, { system: true }), /déjà intégrées/, 'retransmission refusée');
throws(() => P.signSlips(S, cid, k), /signature/, 'signature impossible sans spécimen');
as(S, 'u5', 'Gestionnaire', 'payroll'); throws(() => P.setSignature(S, cid, { signature: 'data:x' }), /réservée/, 'le gestionnaire ne peut pas enregistrer de signature');
throws(() => P.signSlips(S, cid, k), /réservée/, 'le gestionnaire ne peut pas signer');
as(S, 'u6', 'DRH', 'hr'); P.setSignature(S, cid, { signature: 'data:image/png;base64,AAAA', cachet: 'data:image/png;base64,BBBB' });
const r1 = P.signSlips(S, cid, k), r2 = P.signSlips(S, cid, k);
ok(r1.signed === t.count && r2.signed === 0 && r2.skipped === t.count, 'signature en masse sans doublon');
const victim = p.slips[Object.keys(p.slips)[0]]; victim.signed = null; victim.totals.net += 1;
throws(() => P.signSlips(S, cid, k), /modifié/, 'bulletin altéré après validation : signature refusée');
victim.totals.net -= 1; P.signSlips(S, cid, k);

section('Interface comptable (myyiel.journal-batch/1)');
const b = P.buildPayrollBatch(S, cid, k);
ok(b.format === 'myyiel.journal-batch/1' && b.totals.debit === b.totals.credit, 'lot conforme et équilibré');
ok(Y.validateBatchShape(b).length === 0, 'contrôle de forme OK');
const bad = JSON.parse(JSON.stringify(b)); bad.entries[0].lines[0].debit += 1; bad.totals = null;
ok(Y.validateBatchShape(bad).some(m => /déséquilibrée|altéré/.test(m)), 'lot altéré détecté (équilibre / empreinte)');
throws(() => Y.acceptBatch(S, cid, b), /déjà intégré/, 'idempotence : un lot n’est intégré qu’une fois');

section('Virements, déclarations, clôture');
as(S, 'u5', 'Gestionnaire', 'payroll');
const o = P.createOrder(S, cid, { key: k, advisorId: d.advisors[0].id, executionDate: '2026-10-28', confidentiality: 'matricule' });
ok(o.totals.all === t.net, 'ordre de virement = total des nets');
const f = P.orderFiles(S, cid, o); ok(f.virement.slice(1).every(r => /^YG\d{4}$/.test(r[1])), 'confidentialité : matricules seulement');
throws(() => P.orderAction(S, cid, o.id, 'valider'), /réservée/, 'le gestionnaire ne valide pas l’ordre');
P.orderAction(S, cid, o.id, 'soumettre'); as(S, 'u6', 'DRH', 'hr'); P.orderAction(S, cid, o.id, 'valider');
as(S, 'u5', 'Gestionnaire', 'payroll'); P.orderAction(S, cid, o.id, 'envoyer'); P.orderAction(S, cid, o.id, 'executer', { date: '2026-10-28' });
ok(Y.net(S, cid, '422', { to: '2026-10-31' }) === 0, '422 soldé après paiement');
as(S, 'u7', 'DAF', 'cfo');
const dc = P.declarations(S, cid, k).find(x => x.code === 'CNPS');
ok(dc.total === -Y.net(S, cid, '431', { from: p.start, to: p.end, journal: 'PAIE' }), 'déclaration CNPS = crédit 431 de la paie');
P.declAction(S, cid, k, 'CNPS', 'teletransmettre'); ok(P.period(S, cid, k).decl.CNPS.receipt, 'télédéclaration CNPS avec accusé');
as(S, 'u5', 'Gestionnaire', 'payroll'); throws(() => P.declAction(S, cid, k, 'DGI', 'teletransmettre'), /réservée/, 'télédéclaration réservée à la DAF');
as(S, 'u7', 'DAF', 'cfo'); P.close(S, cid, k, 'OK'); ok(p.status === 'cloturee' && d.periods['2026-11'], 'clôture DAF et ouverture de novembre');

section('Recalcul de contrôle et régularisation');
as(S, 'u5', 'Gestionnaire', 'payroll');
ok(P.recalcCheck(S, cid, '2026-09').length === 0, 'recalcul de contrôle sans écart');
P.addVersion(S, cid, 'param', 'IRPP_SEUIL', { from: '2026-09-01', value: 62000, reason: 'Confirmation' }, { retro: true });
const emp4 = P.emp(S, cid, 'YG0004'), old = emp4.sb; emp4.sb = old + 20000;
const diffs = P.recalcCheck(S, cid, '2026-09'); ok(diffs.some(x => x.matricule === 'YG0004' && x.diffBrut > 0), 'écart détecté après rappel de salaire');
const sepNet = d.periods['2026-09'].slips[emp4.id].totals.net;
P.applyRegul(S, cid, '2026-09', '2026-11');
ok(d.periods['2026-09'].slips[emp4.id].totals.net === sepNet, 'période clôturée non écrasée');
ok((d.periods['2026-11'].vars[emp4.id] || []).some(v => v.code === 'RAPPEL' && v.amount > 0), 'rappel créé sur la période ouverte');
emp4.sb = old;

section('Import des salariés');
const hdr = P.employeeTemplate()[0], map = P.mapEmployeeColumns(hdr);
ok(map.matricule === 0 && map.sb > 0, 'correspondance automatique des colonnes');
const rows = [P.employeeTemplate()[1], P.employeeTemplate()[1].slice(), P.employeeTemplate()[2], hdr.map(() => '')];
rows[1][2] = 'AUTRE';
const an = P.analyzeEmployeeImport(S, cid, rows, map, { autoMatricule: true });
ok(an.duplicates >= 1 && an.rows[1].errors.some(m => /Doublon dans le fichier/.test(m)), 'doublon de matricule dans le fichier');
ok(an.missingMatricule === 1 && an.rows[2].errors.length === 0, 'matricule manquant attribué automatiquement ' + JSON.stringify(an.rows[2].errors));
const rowsBad = [P.employeeTemplate()[1].slice()]; rowsBad[0][map.nom] = ''; rowsBad[0][map.sb] = '';
ok(P.analyzeEmployeeImport(S, cid, rowsBad, map, {}).rows[0].errors.some(m => /Nom obligatoire/.test(m)), 'champ obligatoire manquant détecté');
const n0 = d.employees.length; P.importEmployees(S, cid, an, { file: 'test.csv' }); ok(d.employees.length === n0 + 2, 'import des seules lignes valides');

section('Avances, prêts, sorties, simulateur');
const tabi = P.emp(S, cid, 'YG0016');
throws(() => P.requestAdvance(S, cid, { empId: tabi.id, amount: 90000, date: '2026-11-05' }), /Plafond/, 'plafond d’avance');
const late = P.requestAdvance(S, cid, { empId: tabi.id, amount: 20000, date: '2026-11-20' }); ok(late.late && late.retainPeriod === '2026-12', 'après la date butoir : retenue le mois suivant');
const pvx = P.exitPreview(S, cid, emp4.id, { date: '2026-11-30', motif: 'Licenciement', preavis: 'paye' });
ok(pvx.ICCP > 0 && pvx.IND_LIC > 0 && pvx.PREAVIS > 0, 'solde de tout compte : congés, licenciement, préavis');
const sim = P.simulate(S, cid, { sb: 500000, convention: 'CC-COM', site: 'DLA', key: '2026-11' });
const back = P.netToGross(S, cid, { convention: 'CC-COM', site: 'DLA', key: '2026-11' }, sim.totals.net);
ok(Math.abs(back.totals.net - sim.totals.net) <= 2, 'simulateur net → brut cohérent');

section('Historique de démonstration');
const months = Object.keys(d.periods).filter(x => d.periods[x].status === 'cloturee');
ok(months.length >= 10, 'janvier à octobre clôturés (' + months.length + ')');
ok(months.every(x => d.periods[x].journal && d.periods[x].journal.status === 'integre'), 'chaque paie clôturée est intégrée en comptabilité');
ok(Y.verifyAudit(S, cid).ok, 'piste d’audit commune intègre');
ok(Y.bilan(S, cid, 2026, '2026-10-31').balanced, 'bilan équilibré après intégration de la paie');

  console.log('\n' + pass + ' vérifications réussies, ' + failN + ' échec(s).');
  expect(failN, 'échecs listés ci-dessus (✗)').toBe(0);
});

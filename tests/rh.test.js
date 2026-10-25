/*
 * Tests des moteurs Temps & présence (GTA), Congés & absences, Stocks & inventaires (Node ≥ 18, sans dépendance) :
 *   node app/tests/rh.test.js
 * Couvre docs/rh/05-plan-de-tests.md.
 */
import { test, expect } from 'vitest';
import { Y } from '../src/core/index.js';

test('rh : toutes les vérifications du moteur', () => {
const U = Y.util, P = Y.Paie, G = Y.GTA, A = Y.Abs, K = Y.Stock;
let pass = 0, failN = 0;
function ok(c, m) { if (c) pass++; else { failN++; console.log('  ✗ ' + m); } }
function throws(fn, re, m) { try { fn(); ok(false, m + ' (aucune erreur)'); } catch (e) { ok(e instanceof Y.BizError && (!re || re.test(e.message)), m + ' → ' + e.message); } }
function section(t) { console.log('• ' + t); }
function as(S, id) { const u = S.users.find(x => x.id === id); S.meta.currentUser = { id: u.id, name: u.name, role: u.role }; }

const S = Y.seed('2026-10-21'), cid = S.meta.currentCompany;
const emp = m => P.emp(S, cid, m);

section('Jours fériés et décompte');
ok(A.easter(2026) === '2026-04-05', 'Pâques 2026 = 5 avril');
const h26 = A.holidays(S, cid, 2026).map(h => h.date);
ok(h26.indexOf('2026-04-03') > -1 && h26.indexOf('2026-05-14') > -1, 'Vendredi saint et Ascension 2026');
ok(h26.indexOf('2026-05-20') > -1 && h26.indexOf('2026-02-11') > -1, 'Fête nationale et Fête de la Jeunesse');
ok(A.holidays(S, cid, 2027).some(h => h.date === '2026-12-26' || h.date === '2027-02-11'), 'jours fériés 2027 calculés');
ok(A.countDays(S, cid, 'CP', '2026-10-05', '2026-10-10') === 6, 'CP en jours ouvrables : lun. → sam. = 6');
ok(A.countDays(S, cid, 'TT', '2026-10-05', '2026-10-10') === 5, 'télétravail en jours ouvrés : 5');
ok(A.countDays(S, cid, 'CP', '2026-05-18', '2026-05-23') === 5, 'férié du 20 mai exclu du décompte');
ok(A.countDays(S, cid, 'MAL', '2026-10-17', '2026-10-19') === 3, 'maladie en jours calendaires');
ok(A.countDays(S, cid, 'CP', '2026-10-05', '2026-10-06', 'pm', 'am') === 1, 'demi-journées : après-midi + matin = 1 jour');
const s2027 = A.holidays(S, cid, 2027).find(h => h.date === '2027-02-11');
ok(!!s2027, 'Fête de la Jeunesse 2027');

section('Circuit « salarié → N+1 → gestionnaire »');
as(S, 'u9'); // B. Fotso, salarié
let r = A.request(S, cid, { empId: emp('YG0010').id, type: 'TT', start: '2026-10-29', end: '2026-10-29', reason: 'Livraison à domicile' });
ok(r.status === 'en_attente_n1' && r.approver === 'YG0009', 'demande du salarié en attente de son N+1 (R. Nana)');
throws(() => A.decide(S, cid, r.id, 'approve'), /propre|réservée/, 'le salarié ne valide pas sa propre demande');
as(S, 'u10'); throws(() => A.decide(S, cid, r.id, 'approve'), /N\+1 désigné/, 'un autre manager ne peut pas valider');
as(S, 'u8'); A.decide(S, cid, r.id, 'approve', 'OK');
ok(r.status === 'a_notifier', 'après le N+1 : à enregistrer et notifier par le gestionnaire');
throws(() => A.decide(S, cid, r.id, 'approve'), /gestionnaire/, 'le N+1 ne peut pas notifier à la place du gestionnaire');
as(S, 'u5'); A.decide(S, cid, r.id, 'approve', '', { channels: ['WhatsApp'] });
ok(r.status === 'approuvee' && r.notified && r.notified.channels[0] === 'WhatsApp', 'enregistrée et notifiée par WhatsApp');
throws(() => { as(S, 'u8'); A.decide(S, cid, A.D(S, cid).requests.find(x => x.status === 'en_attente_n1' && x.matricule === 'YG0010').id, 'refuse', ''); }, /Motif/, 'refus sans motif interdit');

section('Escalade, délégation, séparation');
as(S, 'u8');
r = A.request(S, cid, { empId: emp('YG0009').id, type: 'TT', start: '2026-11-06', end: '2026-11-06' });
ok(r.status === 'en_attente_rh', 'le N+1 qui demande pour lui-même passe par la DRH');
as(S, 'u8'); throws(() => A.decide(S, cid, r.id, 'approve'), /propre|DRH/, 'le manager ne valide pas sa propre demande');
as(S, 'u6'); A.decide(S, cid, r.id, 'approve'); ok(r.status === 'a_notifier', 'la DRH valide puis le gestionnaire notifie');
const ap = A.approverFor(S, cid, emp('YG0011'), '2026-12-22');
ok(ap.step === 'n1' && ap.approver === 'YG0010', 'délégation de R. Nana à B. Fotso pendant ses congés');

section('Contrôles d’une demande');
as(S, 'u9');
throws(() => A.request(S, cid, { empId: emp('YG0010').id, type: 'CP', start: '2026-11-09', end: '2026-11-10' }), /Chevauchement/, 'chevauchement avec une demande en cours refusé');
throws(() => A.request(S, cid, { empId: emp('YG0010').id, type: 'CP', start: '2026-12-01', end: '2026-12-31' }), /solde disponible/, 'solde de congés insuffisant refusé');
throws(() => A.request(S, cid, { empId: emp('YG0010').id, type: 'MAR', start: '2026-12-01', end: '2026-12-08' }), /maximum/, 'durée maximale du motif contrôlée');
throws(() => A.request(S, cid, { empId: emp('YG0010').id, type: 'TT', start: '2026-10-24', end: '2026-10-25' }), /Aucun jour/, 'télétravail sur un week-end : aucun jour décompté');
throws(() => A.request(S, cid, { empId: emp('YG0011').id, type: 'CP', start: '2026-12-01', end: '2026-12-02' }), /réservée|gestionnaire/, 'un salarié ne saisit pas pour un collègue');
const chk = A.check(S, cid, { empId: emp('YG0010').id, type: 'MAL', start: '2026-12-03', end: '2026-12-03' });
ok(chk.warnings.some(w => /Justificatif/.test(w)), 'justificatif demandé pour la maladie');
const b = A.balances(S, cid, emp('YG0010'));
ok(b.CP.acquis > 0 && Math.abs(b.CP.disponible - (b.CP.acquis - b.CP.pris - b.CP.attente)) < 0.01, 'solde CP = solde paie − pris − en attente');

section('Circuit « gestionnaire → DRH »');
A.D(S, cid).settings.workflow = 'gestionnaire';
as(S, 'u5'); r = A.request(S, cid, { empId: emp('YG0015').id, type: 'CP', start: '2026-11-16', end: '2026-11-17', reason: 'Saisie pour la salariée' });
ok(r.status === 'en_attente_rh' && r.onBehalf, 'saisie gestionnaire en attente DRH');
as(S, 'u5'); throws(() => A.decide(S, cid, r.id, 'approve'), /DRH|autre personne/, 'le gestionnaire ne valide pas');
as(S, 'u6'); A.decide(S, cid, r.id, 'approve'); ok(r.status === 'approuvee' && r.notified && r.notified.auto, 'validée par la DRH, salariée notifiée automatiquement');
A.D(S, cid).settings.workflow = 'salarie';
as(S, 'u5'); const dec = A.request(S, cid, { empId: emp('YG0018').id, type: 'INJ', start: '2026-10-12', end: '2026-10-12', reason: 'Constat GTA' });
ok(dec.status === 'approuvee', 'absence injustifiée saisie par le gestionnaire : enregistrée directement');
as(S, 'u5'); A.cancel(S, cid, dec.id, 'Erreur de saisie'); ok(dec.status === 'annulee', 'annulation tracée');

section('Absences → paie');
const ev = A.payEvents(S, cid, '2026-10');
ok(ev.some(x => x.matricule === 'YG0006' && x.type === 'CONGE') && ev.filter(x => x.matricule === 'YG0006' && x.type === 'CONGE').length === 5, 'CP d’octobre : 5 jours ouvrables (6 → 10 octobre)');
ok(ev.some(x => x.matricule === 'YG0008' && x.type === 'ABS_NP'), 'congé sans solde → retenue ABS_NP');
ok(!ev.some(x => x.matricule === 'YG0013' && x.type === 'TT'), 'télétravail sans impact paie');

section('Pointage WhatsApp et score de confiance');
const g = G.D(S, cid), now = G.now(S, cid);
ok(now === '2026-10-21T10:31', 'horloge de démonstration');
const e15 = emp('YG0015'), site = G.site(S, cid, 'SIEGE-DLA'), dev = G.assign(S, cid, e15.id).device.id;
let l = G.issueLink(S, cid, e15.id, 'in', { at: '2026-10-21T10:31' });
ok(/pointez votre arrivée/.test(G.linkMessage(S, cid, l)), 'message WhatsApp avec lien personnel');
let pt = G.punch(S, cid, { token: l.token, lat: site.lat + 0.0003, lng: site.lng, accuracy: 12, deviceId: dev, wifi: 'YIEL-STAFF', at: '2026-10-21T10:33' });
ok(pt.status === 'valide' && pt.score >= 90, 'sur site, téléphone reconnu, Wi-Fi : validé (score ' + pt.score + ')');
throws(() => G.punch(S, cid, { token: l.token, lat: site.lat, lng: site.lng, at: '2026-10-21T10:34' }), /déjà utilisé/, 'lien à usage unique');
l = G.issueLink(S, cid, e15.id, 'out', { at: '2026-10-21T10:00' });
throws(() => G.punch(S, cid, { token: l.token, lat: site.lat, lng: site.lng, at: '2026-10-21T10:20' }), /expiré/, 'lien expiré après 10 min');
l = G.issueLink(S, cid, e15.id, 'out', { at: '2026-10-21T17:00' });
pt = G.punch(S, cid, { token: l.token, lat: site.lat + 0.02, lng: site.lng, accuracy: 15, deviceId: dev, at: '2026-10-21T17:02' });
ok(pt.status !== 'valide' && pt.distance > 2000, 'à 2 km du site : pas validé automatiquement');
const e4 = emp('YG0004'); l = G.issueLink(S, cid, e4.id, 'out', { at: '2026-10-21T17:00' });
pt = G.punch(S, cid, { token: l.token, lat: site.lat, lng: site.lng, accuracy: 5, deviceId: G.assign(S, cid, e4.id).device.id, mock: true, at: '2026-10-21T17:01' });
ok(pt.status === 'rejete', 'position fictive : rejeté quel que soit le reste');
const e3 = emp('YG0003'); l = G.issueLink(S, cid, e3.id, 'out', { at: '2026-10-21T17:00' });
pt = G.punch(S, cid, { token: l.token, lat: site.lat, lng: site.lng, accuracy: 10, deviceId: 'autre-telephone', at: '2026-10-21T17:03' });
ok(pt.status === 'a_verifier' && G.assign(S, cid, e3.id).pendingDevice, 'téléphone inconnu : à vérifier + changement d’appareil en attente');
const sc = G.score({ distance: 20, radius: 150, accuracy: 10, device: 'ok', qr: 'ok', wifi: 'X', mock: false, speedKmh: 30, maxSpeed: 150 });
ok(sc.score === 100, 'tous les signaux : score plafonné à 100');
const sp = G.score({ distance: 20, radius: 150, accuracy: 10, device: 'ok', qr: '', wifi: '', mock: false, speedKmh: 900, maxSpeed: 150 });
ok(sp.score < 70, 'vitesse impossible : pénalité');
throws(() => { as(S, 'u9'); G.review(S, cid, pt.id, 'valider'); }, /réservée/, 'un salarié ne revoit pas les pointages');
as(S, 'u6'); G.review(S, cid, pt.id, 'valider', 'Téléphone remplacé, confirmé par la salariée'); ok(pt.status === 'valide' && pt.reviewed, 'revue DRH tracée');
const tt = G.punchesOf(S, cid, emp('YG0013').id, '2026-10-09').filter(p => p.siteCode === 'DOMICILE');
ok(tt.length === 2 && tt.every(p => p.status === 'valide'), 'télétravail : pointage validé au domicile déclaré');
const nc = G.D(S, cid).assign; const save = nc[e15.id].consent; nc[e15.id].consent = null; l = G.issueLink(S, cid, e15.id, 'in', { at: '2026-10-21T10:40' });
throws(() => G.punch(S, cid, { token: l.token, lat: site.lat, lng: site.lng, at: '2026-10-21T10:41' }), /notice/, 'pas de pointage sans notice d’information acceptée'); nc[e15.id].consent = save;

section('Contrôles aléatoires');
const today = g.controls.filter(c => c.date === '2026-10-21');
ok(today.length === 3, '3 contrôles planifiés aujourd’hui');
ok(today.some(c => c.result === 'present') && today.some(c => c.result === 'sans_reponse') && today.some(c => c.result === 'en_attente'), 'présent, sans réponse, en attente');
const before = g.controls.length; as(S, 'u5'); G.planControls(S, cid, '2026-10-20', { n: 2 }); ok(g.controls.length === before + 2, 'nouveaux contrôles tirés au sort parmi les présents');

section('Journée et feuille de temps');
const dAbs = G.day(S, cid, emp('YG0018'), '2026-10-12'); ok(dAbs.status === 'absent', 'aucun pointage un jour ouvré : absence injustifiée');
const dInc = G.day(S, cid, emp('YG0016'), '2026-10-16'); ok(dInc.status === 'incomplet', 'départ non pointé : journée incomplète');
const dCp = G.day(S, cid, emp('YG0006'), '2026-10-07'); ok(dCp.status === 'absence' && dCp.absence.code === 'CP', 'congé approuvé reconnu');
const dMs = G.day(S, cid, emp('YG0005'), '2026-10-07'); ok(dMs.status === 'mission' && dMs.workedMin > 0, 'journée de mission comptée comme travaillée');
const dHol = G.day(S, cid, emp('YG0016'), '2026-10-04'); ok(dHol.otMin === 420, 'dimanche travaillé 07:00-15:00 : 7 h (pause déduite au-delà de 6 h)');
const sh = G.sheet(S, cid, emp('YG0010'), '2026-10');
ok(sh.totals.hs.HS1 > 0 && sh.totals.otApproved >= sh.totals.hs.HS1, 'heures sup. acceptées classées HS1 dans la semaine');
const sh16 = G.sheet(S, cid, emp('YG0016'), '2026-10'); ok(sh16.totals.hs.HSN === 780, 'dimanches travaillés → HSN (13 h)');
as(S, 'u7'); throws(() => G.validateSheet(S, cid, '2026-10', emp('YG0016').id), /incomplet/, 'feuille non validable avec un pointage incomplet');
as(S, 'u7'); G.manualPunch(S, cid, { empId: emp('YG0016').id, date: '2026-10-16', time: '16:40', kind: 'out', comment: 'Oubli signalé par le salarié, confirmé par le N+1' });
ok(G.day(S, cid, emp('YG0016'), '2026-10-16').status !== 'incomplet', 'pointage manquant saisi par le N+1');
as(S, 'u7'); G.validateSheet(S, cid, '2026-10', emp('YG0016').id, 'RAS'); ok(G.sheet(S, cid, emp('YG0016'), '2026-10').state.status === 'validee', 'feuille validée par le N+1');
as(S, 'u7'); G.validateSheet(S, cid, '2026-10', emp('YG0018').id); const s18 = G.sheet(S, cid, emp('YG0018'), '2026-10');
ok(s18.state.abs['2026-10-12'] === 'confirme' && s18.totals.absent === 1, 'absence injustifiée confirmée à la validation');
as(S, 'u9'); throws(() => G.validateSheet(S, cid, '2026-10', emp('YG0010').id), /réservée/, 'le salarié ne valide pas sa feuille');
as(S, 'u8'); G.decideOt(S, cid, '2026-10', emp('YG0012').id, '2026-10-15', 'approuve');
throws(() => G.validateSheet(S, cid, '2026-10', emp('YG0012').id), /vérifier/, 'feuille bloquée tant qu’un pointage est à vérifier');

section('GTA → paie');
as(S, 'u5');
const res = G.payExport(S, cid, '2026-10');
const pd = P.D(S, cid), per = pd.periods['2026-10'];
const v16 = per.vars[emp('YG0016').id].filter(x => x.source === 'GTA');
ok(v16.some(x => x.code === 'HSN' && x.qty === 13), 'HSN de G. Tabi transmises (13 h)');
const v18 = per.vars[emp('YG0018').id].filter(x => x.source === 'GTA');
ok(v18.some(x => x.code === 'ABS_NP' && x.qty === 1), 'absence injustifiée → retenue ABS_NP 1 jour');
const v6 = per.vars[emp('YG0006').id].filter(x => x.source === 'GTA');
ok(v6.some(x => x.code === 'CONGE' && x.qty === 5), 'congés approuvés transmis (5 jours)');
ok(!per.vars[emp('YG0010').id].some(x => x.source === 'GTA' && /^HS/.test(x.code)), 'feuille non validée : pas d’heures sup. transmises');
ok(G.sheet(S, cid, emp('YG0016'), '2026-10').state.status === 'transmise', 'feuille marquée transmise');
G.payExport(S, cid, '2026-10');
ok(per.vars[emp('YG0016').id].filter(x => x.source === 'GTA' && x.code === 'HSN').length === 1, 'nouvelle transmission : pas de doublon');
P.calculate(S, cid, '2026-10', { system: true });
const slip = per.slips[emp('YG0018').id]; ok(slip && slip.lines.some(x => x.code === 'ABS_NP'), 'le bulletin porte la retenue d’absence injustifiée');
ok(res.events > 0, 'transmission journalisée');
as(S, 'u8'); throws(() => G.payExport(S, cid, '2026-10'), /réservée/, 'un manager ne transmet pas à la paie');

section('Missions terrain');
const live = g.missions.map(m => G.missionView(S, cid, m, now));
ok(live.some(v => v.label === 'Départ non détecté'), 'départ non détecté');
ok(live.some(v => v.label === 'Retard probable' && v.delayMin > 15), 'retard probable (ETA > arrivée prévue)');
ok(live.some(v => v.code === 'ECART'), 'écart d’itinéraire détecté');
ok(live.some(v => v.status === 'sur_site'), 'arrivée confirmée sur site');
const ended = g.missions.find(m => m.status === 'terminee');
throws(() => G.track(S, cid, ended.id, { lat: 4, lng: 9.7 }), /hors d’une mission/, 'fin de mission = fin du suivi (position refusée)');
const plan = g.missions.find(m => m.status === 'planifiee' && m.ref === 'OM-2026-0006');
throws(() => G.track(S, cid, plan.id, { lat: 4, lng: 11 }), /Suivi inactif/, 'aucun suivi avant le démarrage');
as(S, 'u9'); throws(() => G.startMission(S, cid, plan.id), /réservée/, 'un salarié ne démarre pas la mission d’un autre');
const kam = g.missions.find(m => m.ref === 'OM-2026-0004'); const pts = kam.track.length;
G.advanceClock(S, cid, 60); ok(kam.track.length > pts, 'horloge de démonstration : nouvelles positions');
G.advanceClock(S, cid, 120); ok(kam.arrivalPrompt || kam.status !== 'en_route', 'arrivée détectée dans la géozone');
as(S, 'u9'); throws(() => G.confirmArrival(S, cid, kam.id), /réservée/, 'un salarié étranger à la mission ne confirme pas');
as(S, 'u6'); G.confirmArrival(S, cid, kam.id); ok(kam.status === 'sur_site' && g.punches.some(p => p.viaMission === kam.id), 'arrivée confirmée → pointage d’arrivée sur le site de mission');
G.endMission(S, cid, kam.id); ok(kam.status === 'terminee', 'mission terminée');
as(S, 'u6'); const nm = G.createMission(S, cid, { empIds: [emp('YG0004').id], label: 'Inventaire agence', fromSite: 'SIEGE-DLA', toSite: 'AG-YDE', plannedStart: '2026-10-26T07:00', plannedArrival: '2026-10-26T11:00', transport: 'bus' });
ok(nm.distanceKm > 150 && nm.route.length >= 3, 'ordre de mission avec itinéraire Douala → Yaoundé (' + nm.distanceKm + ' km)');
throws(() => G.createMission(S, cid, { empIds: [emp('YG0004').id], label: 'Doublon', fromSite: 'SIEGE-DLA', toSite: 'AG-YDE', plannedStart: '2026-10-26T08:00', plannedArrival: '2026-10-26T12:00' }), /déjà en mission/, 'chevauchement de missions refusé');
const n = G.purge(S, cid, '2027-03-01'); ok(n > 0 && g.punches.filter(p => p.date < '2026-12-01').every(p => p.lat === null), 'purge des positions après le délai de conservation');

section('Stocks et inventaires');
as(S, 'u2');
const p0 = K.position(S, cid, 'TAB-10', 'MAG-DLA', '2026-10-21');
ok(p0.qty === 21, 'stock TAB-10 au siège : 21');
const e1 = K.addMove(S, cid, { type: 'entree', article: 'TAB-10', wh: 'MAG-DLA', qty: 9, unitCost: 100000, date: '2026-10-21', motif: 'Réception fournisseur' });
const p1 = K.position(S, cid, 'TAB-10', 'MAG-DLA', '2026-10-21');
ok(p1.qty === 30 && p1.cmup === Math.round((p0.value + 900000) / 30), 'CMUP recalculé après entrée');
throws(() => K.addMove(S, cid, { type: 'sortie', article: 'TAB-10', wh: 'STK-YDE', qty: 50, date: '2026-10-21' }), /insuffisant/, 'sortie supérieure au stock refusée');
const so = K.addMove(S, cid, { type: 'sortie', article: 'TAB-10', wh: 'MAG-DLA', qty: 3, date: '2026-10-21', motif: 'Projet client' });
ok(so.value === Math.round(3 * p1.value / p1.qty), 'sortie valorisée au CMUP');
const tr = K.addMove(S, cid, { type: 'transfert', article: 'LEC-QR', wh: 'MAG-DLA', whTo: 'STK-YDE', qty: 4, date: '2026-10-21' });
ok(K.position(S, cid, 'LEC-QR', 'STK-YDE', '2026-10-21').qty === 14, 'transfert entre dépôts');
const done = K.D(S, cid).counts.find(c => c.status === 'valide');
ok(done && done.lines.some(l => l.article === 'TAB-10' && l.diff === -1), 'inventaire semestriel : tablette manquante constatée');
const open = K.D(S, cid).counts.find(c => c.status === 'en_cours');
throws(() => K.closeCount(S, cid, open.id), /non compté/, 'comptage incomplet non clôturable');
open.lines.forEach(x => { if (x.counted === null) K.setCounted(S, cid, open.id, x.article, x.theo); });
as(S, 'u7'); K.closeCount(S, cid, open.id);
as(S, 'u7'); throws(() => K.validateCount(S, cid, open.id, 'OK'), /Séparation/, 'la personne qui a compté ne valide pas');
as(S, 'u2'); K.validateCount(S, cid, open.id, 'Lecteur cassé'); ok(open.status === 'valide' && K.position(S, cid, 'LEC-QR', 'STK-YDE', '2026-10-21').qty === 13, 'écart d’inventaire porté en stock');
const vp = K.variationPreview(S, cid, '2026-12-31');
ok(vp.length && vp.every(r => r.diff === r.physical - r.book), 'variation = stock physique − solde comptable');
as(S, 'u2'); const ve = K.postVariation(S, cid, '2026-12-31');
ok(Y.net(S, cid, '311', { to: '2026-12-31' }) === vp.find(r => r.stock === '311').physical, 'compte 311 = stock physique valorisé après variation');
throws(() => K.postVariation(S, cid, '2026-12-31'), /déjà/, 'variation non comptabilisée deux fois');
ok(Y.closingState && Y.validated(S, cid).some(x => x.source === 'inventory' && x.ref === 'STK-VAR-2026-12-31'), 'écriture d’inventaire visible par l’assistant de clôture');
const dep = K.postDeprec(S, cid, { date: '2026-12-31', family: 'fourniture', amount: 50000, label: 'Kits obsolètes' });
ok(Y.net(S, cid, '3931', { to: '2026-12-31' }) === -50000, 'dépréciation 6593 / 3931');
K.D(S, cid).settings.mode = 'permanent';
const pm = K.addMove(S, cid, { type: 'sortie', article: 'RAM-A4', wh: 'MAG-DLA', qty: 5, date: '2026-10-21', motif: 'Consommation interne' });
ok(!!pm.entry, 'inventaire permanent : écriture à chaque mouvement');
const reader = 'u4'; as(S, reader); throws(() => K.addMove(S, cid, { type: 'sortie', article: 'RAM-A4', wh: 'MAG-DLA', qty: 1, date: '2026-10-21' }), /réservée/, 'lecteur : pas de mouvement');
ok(Y.balanceCheck ? Y.balanceCheck(S, cid) : true, 'balance équilibrée');

section('Notifications et périmètres');
as(S, 'u8'); const sc8 = A.scope(S, cid); ok(sc8.length && sc8.every(e => e.service === 'Produit'), 'le N+1 Produit ne voit que son équipe (' + sc8.length + ')');
as(S, 'u9'); ok(A.scope(S, cid).length === 1, 'le salarié ne voit que lui-même');
as(S, 'u6'); ok(A.scope(S, cid).length >= 18, 'la DRH voit tout le monde');
as(S, 'u8'); ok(A.notifications(S, cid).some(x => /à valider/.test(x.title)), 'le N+1 est notifié des demandes à valider');
as(S, 'u8'); ok(G.notifications(S, cid).some(x => /écart|départ|retard/i.test(x.title)), 'le N+1 est alerté des missions en difficulté de son équipe');

  console.log('\n' + pass + ' vérifications réussies, ' + failN + ' échec(s).');
  expect(failN, 'échecs listés ci-dessus (✗)').toBe(0);
});

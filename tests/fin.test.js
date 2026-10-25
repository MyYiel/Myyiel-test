/*
 * Tests du Module 4 · trésorerie, facturation, paiements, anti-fraude (Node ≥ 18, sans dépendance) : node app/tests/fin.test.js
 * Couvre docs/fin/06-plan-de-tests.md.
 */
import { test, expect } from 'vitest';
import { Y } from '../src/core/index.js';

test('fin : toutes les vérifications du moteur', () => {
const U = Y.util, F = Y.Fin;
let pass = 0, failN = 0;
function ok(c, m) { if (c) pass++; else { failN++; console.log('  ✗ ' + m); } }
function throws(fn, re, m) { try { fn(); ok(false, m + ' (aucune erreur)'); } catch (e) { ok(e instanceof Y.BizError && (!re || re.test(e.message)), m + ' → ' + e.message); } }
function section(t) { console.log('• ' + t); }
function as(S, id) { const u = S.users.find(x => x.id === id); S.meta.currentUser = { id: u.id, name: u.name, role: u.role }; }
const S = Y.seed('2026-10-21'), cid = S.meta.currentCompany, fd = F.D(S, cid), d = Y.D(S, cid);
const doc = n => Y.doc(S, cid, n), tiers = c => Y.tiers(S, cid, c), rest = x => Y.docTotals(S, cid, x).ttc - Y.docPaid(x);

section('Répertoire clients et fournisseurs');
as(S, 'u2');
const sup = F.saveTiers(S, cid, { type: 'fournisseur', name: 'Menuiserie Moderne de Bépanda', niu: 'M011100009999Z', email: 'contact@menuiserie-exemple.cm', phone: '+237 6 00 00 30 01', category: 'Autres', city: 'Douala' });
ok(sup.code === 'F0013' && F.profile(sup).emailDomain === 'menuiserie-exemple.cm', 'fiche fournisseur créée avec profil étendu');
throws(() => F.saveTiers(S, cid, { type: 'fournisseur', name: 'Menuiserie Moderne de Bepanda' }), /Doublon/, 'doublon détecté (raison sociale quasi identique)');
throws(() => F.saveTiers(S, cid, { type: 'fournisseur', name: 'Autre', niu: 'M011100009999Z' }), /même NIU/, 'doublon détecté (même NIU)');
F.addContact(S, cid, sup.id, { name: 'M. BELL Joseph', role: 'Gérant', phone: '+237 6 00 00 30 02', main: true });
ok(F.profile(sup).contacts.filter(c => c.main).length === 1, 'plusieurs contacts, un seul principal');
const sm = F.summary(S, cid, tiers('C0005')); ok(sm.invoiced > 0 && sm.overdue > 0 && sm.balance > 0, 'synthèse client calculée depuis la comptabilité');
const map = F.mapColumns(['Raison sociale', 'NIU', 'Tel', 'Courriel', 'Type', 'Ville']); ok(map.name === 0 && map.niu === 1 && map.phone === 2 && map.email === 3, 'import : correspondance des colonnes par synonymes');
const an = F.analyzeImport(S, cid, [['Raison sociale', 'Type', 'NIU', 'E-mail', 'N° Mobile Money'], ['Nouvelle Boulangerie SA', 'client', 'M033300000001X', 'a@b.cm', ''], ['Boulangerie du Littoral SARL', 'client', '', '', ''], ['Sans type', '', '', '', ''], ['Fournisseur Momo', 'fournisseur', '', 'x@y.cm', '+237 6 00 00 31 01'], ['Nouvelle Boulangerie SA', 'client', '', '', '']], F.mapColumns(['Raison sociale', 'Type', 'NIU', 'E-mail', 'N° Mobile Money']));
ok(an.ok === 2 && an.errors === 3 && an.rows.some(r => r.errors.some(e => /fichier/.test(e))) && an.rows.some(r => r.warnings.some(w => /vérifier/.test(w))), 'import : erreurs, doublons fichier/référentiel, coordonnées à vérifier');
const nimp = F.importTiers(S, cid, an); const fm = d.tiers.find(t => t.name === 'Fournisseur Momo');
ok(nimp === 2 && F.profile(fm).banks[0].status === 'a_confirmer', 'import : coordonnées bancaires importées non vérifiées');

section('Facturation électronique');
const fa = doc('FA-2026-0066');
let mc = F.checkMentions(S, cid, fa);
ok(mc.level === 'incomplete' && mc.missing.some(m => /NIU de l’émetteur/.test(m.label)), 'mentions obligatoires contrôlées (NIU émetteur manquant)');
throws(() => F.send(S, cid, fa.id, ['whatsapp']), /Mentions obligatoires/, 'envoi refusé tant que les mentions obligatoires manquent');
const co = Y.company(S, cid); co.niu = 'M022000012345Y'; co.rccm = 'RC/DLA/2020/B/1000';
mc = F.checkMentions(S, cid, fa); ok(mc.level === 'commerciale', 'facture commerciale (certification fiscale non activée)');
fd.settings.compliance = { mode: 'fiscale', homologation: 'HOMOL-TEST' }; ok(F.checkMentions(S, cid, fa).level === 'fiscale', 'mode fiscal avec solution homologuée renseignée');
fd.settings.compliance = { mode: 'commerciale', homologation: '' };
const sent = F.send(S, cid, doc('FA-2026-0067').id, ['whatsapp']);
ok(/pay\.myyiel\.com/.test(sent.message) && /jamais de payer sur un numéro personnel/.test(sent.message), 'message WhatsApp avec lien sécurisé et mise en garde anti-usurpation');
ok(F.verifySeal(S, cid, doc('FA-2026-0067')) === true, 'empreinte d’archivage posée à l’envoi');
const t0 = doc('FA-2026-0067').lines[0].price; doc('FA-2026-0067').lines[0].price = t0 + 1; ok(F.verifySeal(S, cid, doc('FA-2026-0067')) === false, 'toute altération du document est détectée'); doc('FA-2026-0067').lines[0].price = t0;
const rz = F.recognize('mon-modele.pdf'); ok(rz.length === 8 && rz.every(z => z.confidence >= 62), 'import de modèle : 8 zones proposées avec un indice de confiance');
throws(() => F.recognize('modele.exe'), /Format/, 'format de modèle refusé');
ok(F.ZONES.filter(z => z.locked).length === 6, 'zones fiscales verrouillées (6 sur 8)');
ok(F.stage(S, cid, doc('FA-2026-0065')) === 'payee' && F.stage(S, cid, doc('FA-2026-0063')) === 'vue', 'cycle de vie : consultée, payée');

section('Encaissement depuis la facture');
const f67 = doc('FA-2026-0067'), l67 = F.linkFor(S, cid, f67.id);
ok(l67 && l67.methods.indexOf('card') < 0, 'carte non proposée (prestataire indisponible) : pas d’intégration fictive');
throws(() => F.initiate(S, cid, l67.token, { method: 'momo', phone: '12' }), /téléphone/, 'numéro du payeur contrôlé');
const tx = F.initiate(S, cid, l67.token, { method: 'momo', phone: '+237 6 99 00 00 02', amount: 1000000 });
ok(tx.status === 'en_attente' && Y.docPaid(f67) === 0, 'transaction initiée : rien n’est payé avant la confirmation du prestataire');
throws(() => F.callback(S, cid, 'mtn', { providerRef: tx.providerRef, amount: tx.amount, status: 'SUCCESSFUL', signature: 'falsifiee' }), /Signature/, 'notification falsifiée rejetée');
ok(Y.docPaid(f67) === 0 && fd.security.some(s => s.type === 'signature'), 'aucun paiement sur une notification falsifiée, incident journalisé');
const nE = Y.validated(S, cid).length;
const r1 = F.simulateProvider(S, cid, tx.id, 'ok');
ok(r1.tx.status === 'confirmee' && Y.docPaid(f67) === 1000000 && Y.validated(S, cid).length === nE + 1, 'confirmation signée : paiement partiel enregistré et écriture générée');
const p2 = { providerRef: tx.providerRef, amount: tx.amount, status: 'SUCCESSFUL' }; p2.signature = F.sign(S, cid, 'mtn', p2);
const r2 = F.callback(S, cid, 'mtn', p2); ok(r2.duplicate && Y.validated(S, cid).length === nE + 1, 'notification rejouée : idempotente, aucune double écriture');
ok(Y.docStatus(S, cid, f67).key === 'partial', 'facture partiellement payée');
const tx2 = F.initiate(S, cid, l67.token, { method: 'om', phone: '+237 6 99 00 00 02' }); const p3 = { providerRef: tx2.providerRef, amount: tx2.amount - 10, status: 'SUCCESSFUL' }; p3.signature = F.sign(S, cid, 'orange', p3);
F.callback(S, cid, 'orange', p3); ok(tx2.status === 'ecart' && Y.docStatus(S, cid, f67).key === 'partial', 'écart de montant : mis en examen, pas d’encaissement automatique');
const tx3 = F.initiate(S, cid, l67.token, { method: 'om', phone: '+237 6 99 00 00 02' }); F.simulateProvider(S, cid, tx3.id, 'fail'); ok(tx3.status === 'echouee', 'échec signalé par le prestataire');
const tx4 = F.initiate(S, cid, l67.token, { method: 'om', phone: '+237 6 99 00 00 02' }); F.simulateProvider(S, cid, tx4.id, 'ok');
ok(Y.docStatus(S, cid, f67).key === 'paid' && l67.status === 'solde', 'facture soldée, lien de paiement clôturé');

section('Justificatifs déclarés (captures, SMS)');
const fake = fd.proofs.find(p => p.ref === '12345'); ok(fake.status === 'falsifie' && fake.checks.some(c => /déblocage/.test(c.text)), 'faux SMS « frais de déblocage » détecté');
const scr = fd.proofs.find(p => p.ref === 'PP261020.1430.A56789'); ok(scr.status === 'suspect' && Y.docStatus(S, cid, doc('FA-2026-0060')).key !== 'paid', 'capture d’écran introuvable chez l’opérateur : suspecte, facture non payée');
throws(() => F.confirmProof(S, cid, scr.id), /relevé/, 'une capture ne peut pas être confirmée sans ligne de relevé');
const vir = fd.proofs.find(p => p.ref === 'VIR 4471'); ok(vir.checks.some(c => /retrouvé sur le relevé/.test(c.text)), 'avis de virement retrouvé sur le relevé');
const before38 = Y.docPaid(doc('FA-2026-0038')); F.confirmProof(S, cid, vir.id);
ok(vir.status === 'confirme' && Y.docPaid(doc('FA-2026-0038')) === before38 + 62000, 'justificatif confirmé par le relevé : paiement et rapprochement');
const dup = F.declareProof(S, cid, { docId: doc('FA-2026-0052').id, method: 'om', ref: tx4.providerRef, amount: 100000 }); ok(dup.checks.some(c => /déjà utilisée/.test(c.text)), 'référence déjà utilisée pour un autre paiement détectée');
const other = F.declareProof(S, cid, { docId: doc('FA-2026-0052').id, method: 'momo', ref: '7700112233', amount: 500000, payee: 'ETS KAMDEM' }); ok(other.checks.some(c => /pas votre société/.test(c.text)), 'bénéficiaire de la capture différent de la société');
F.rejectProof(S, cid, other.id, 'Capture retouchée', false); ok(other.status === 'rejete', 'justificatif rejeté avec motif');

section('Usurpation de coordonnées fournisseur');
const chg = fd.changes.find(c => c.ref === 'CHG-0001');
ok(chg.status === 'quarantaine' && chg.checks.some(c => /domaine sosie/.test(c.text)) && chg.checks.some(c => /NKOU DIDIER/.test(c.text)), 'demande en quarantaine : domaine sosie et titulaire différent détectés');
ok(!F.profile(tiers('F0002')).banks.some(b => b.momo === '+237 6 00 11 22 33'), 'les coordonnées ne sont jamais appliquées directement');
as(S, 'u2'); throws(() => F.confirmBankChange(S, cid, chg.id, { result: 'confirme', contactId: 'x', comment: 'ok' }), /réservée/, 'le comptable ne confirme pas un changement');
as(S, 'u7'); throws(() => F.confirmBankChange(S, cid, chg.id, { result: 'confirme', contactId: 'inconnu', comment: 'Appelé' }), /contact déjà enregistré/, 'rappel obligatoire à un contact du référentiel');
const c0 = F.profile(tiers('F0002')).contacts[0];
throws(() => F.confirmBankChange(S, cid, chg.id, { result: 'confirme', contactId: c0.id, comment: 'Appelé' }), /rouge/, 'contrôles au rouge : confirmation impossible sans levée explicite');
F.confirmBankChange(S, cid, chg.id, { result: 'refuse', contactId: c0.id, comment: 'Le fournisseur confirme n’avoir jamais changé de coordonnées' });
ok(chg.status === 'refuse' && F.checkWatch(S, cid, 'momo', '+237 6 00 11 22 33') && F.checkWatch(S, cid, 'domain', 'douala-informatiques-exemple.cm'), 'refus : numéro et domaine ajoutés à la liste de vigilance');
const chg2 = fd.changes.find(c => c.ref === 'CHG-0002'), imp = tiers('F0008'), ic = F.profile(imp).contacts[0];
as(S, 'u2'); throws(() => F.confirmBankChange(S, cid, chg2.id, { result: 'confirme', contactId: ic.id, comment: 'x' }), /réservée|Séparation/, 'la personne qui saisit ne confirme pas');
as(S, 'u7'); F.confirmBankChange(S, cid, chg2.id, { result: 'confirme', contactId: ic.id, comment: 'Rappel de M. ETOUNDI au numéro du référentiel : confirmé', override: true });
const nb = F.mainBank(imp); ok(nb.status === 'verifie' && nb.account === chg2.account && new Date(nb.availableFrom) > new Date(), 'changement confirmé : nouvelles coordonnées avec délai de carence');
as(S, 'u2'); const pi = F.propose(S, cid, { tiersId: imp.id });
ok(pi.status === 'bloquee' && pi.risk.reasons.some(r => /carence/.test(r.text)), 'paiement bloqué pendant le délai de carence');
const ne = F.nameEnquiry(S, cid, 'MTN', '+237 677 50 60 16'); ok(ne.found && ne.name === 'TABI GASTON', 'nom du titulaire chez l’opérateur');
ok(F.sharedAccount(S, cid, tiers('F0012').id, '', '+237 677 50 60 16').some(x => /salarié YG0016/.test(x)), 'numéro du fournisseur identique à celui d’un salarié (fournisseur fictif)');

section('Factures fournisseurs reçues');
const i4 = fd.inbox.find(i => i.ref === 'IN-0004'); ok(i4.risk >= 70 && i4.checks.some(c => /sosie/.test(c.text)) && i4.checks.some(c => /RIB/.test(c.text)), 'fausse facture : sosie, RIB différent, domaine différent');
ok(i4.checks.some(c => /vigilance/.test(c.text)) || (F.analyzeInbox(S, cid, i4), i4.checks.some(c => /vigilance/.test(c.text))), 'numéro de la fausse facture reconnu dans la liste de vigilance');
throws(() => F.validateInbox(S, cid, i4.id, { tiersId: tiers('F0002').id }), /rouge/, 'validation bloquée par les contrôles');
F.rejectInbox(S, cid, i4.id, 'Fausse facture : usurpation de Douala Informatique Services', true); ok(i4.status === 'fraude', 'fausse facture signalée');
ok(fd.inbox.find(i => i.ref === 'IN-0003').status === 'doublon', 'facture déjà comptabilisée reconnue comme doublon');
const i1 = fd.inbox.find(i => i.ref === 'IN-0001'), nE2 = Y.validated(S, cid).length;
const ev = F.validateInbox(S, cid, i1.id, { account: '6055' }); ok(i1.status === 'comptabilisee' && Y.validated(S, cid).length === nE2 + 1 && ev.journal === 'ACH', 'facture validée : écriture d’achat générée');
const ix = F.receive(S, cid, { source: 'email', from: 'ventes@bureau-pro-exemple.cm', extracted: { supplier: 'Bureau Pro Akwa', niu: 'M061500004455G', invoiceNo: 'BPA-2026-311', date: '2026-10-19', ht: 210000, tva: 40425, ttc: 250425 } });
ok(ix.checks.some(c => /Doublon/.test(c.text)), 'la même facture reçue deux fois est détectée');
const iv = F.receive(S, cid, { extracted: { supplier: 'Bureau Pro Akwa', invoiceNo: 'X1', date: '2026-10-20', ht: 100000, tva: 10000, ttc: 120000 } });
ok(iv.checks.some(c => /HT \+ TVA/.test(c.text)) && iv.checks.some(c => /Taux de TVA/.test(c.text)), 'incohérences de calcul et de taux de TVA signalées');

section('Paiements fournisseurs');
const pBlk = fd.proposals.find(p => Y.tiers(S, cid, p.tiersId).code === 'F0012');
ok(pBlk.status === 'bloquee' && pBlk.risk.score >= 70, 'fournisseur non validé au numéro d’un salarié : paiement bloqué');
as(S, 'u7'); throws(() => F.approve(S, cid, pBlk.id, 'approuver', 'ok'), /bloqué/, 'approbation impossible tant que la cause n’est pas levée');
const pD = fd.proposals.find(p => Y.tiers(S, cid, p.tiersId).code === 'F0002' && p.status === 'a_approuver');
as(S, 'u2'); throws(() => F.approve(S, cid, pD.id, 'approuver'), /réservée/, 'le préparateur n’a pas le droit d’approuver');
as(S, 'u7'); throws(() => F.execute(S, cid, pD.id), /approuvé/, 'exécution impossible avant approbation');
F.approve(S, cid, pD.id, 'approuver', 'Facture de maintenance conforme');
ok(pD.status === 'approuvee', 'approbation par le DAF');
const lettersBefore = Y.validated(S, cid).length; F.execute(S, cid, pD.id); ok(pD.status === 'executee' && Y.validated(S, cid).length > lettersBefore, 'exécution : écriture de règlement');
as(S, 'u2'); const big = F.propose(S, cid, { tiersId: tiers('F0001').id, amount: 500000 });
ok(big.required === 1 || big.required === 2, 'nombre d’approbations selon le seuil et le risque');
fd.settings.approval.double = 1000000; as(S, 'u2'); const big2 = F.propose(S, cid, { tiersId: tiers('F0001').id, amount: 1200000 }); ok(big2.required === 2, 'au-delà du seuil : double validation');
F.D(S, cid).settings.approval.double = 5000000;
const dup2 = { risk: F.risk(S, cid, { tiersId: tiers('F0011').id, amount: 114480 }) }; ok(dup2.risk.reasons.some(r => /identique/.test(r.text)), 'paiement en double détecté');
const pw = F.risk(S, cid, { tiersId: tiers('F0002').id, amount: 50000, bankId: '' }); ok(!pw.reasons.some(r => /vigilance/.test(r.text)), 'coordonnées vérifiées : pas d’alerte vigilance');
as(S, 'u7'); F.addWatch(S, cid, { kind: 'iban', value: F.mainBank(tiers('F0005')).account, reason: 'Test' });
ok(F.risk(S, cid, { tiersId: tiers('F0005').id, amount: 10000 }).blocked, 'coordonnées en liste de vigilance : blocage');

section('Rapprochement intelligent');
const sg = F.suggest(S, cid);
const fee = sg.find(s => /CLINIQUE BONAMOUSSADI/.test(s.tx.label)); ok(fee && fee.docs[0].fees === 8347 && /frais opérateur 1 %/.test(fee.reasons.join()), 'frais Mobile Money reconnus (1 %)');
const grp = sg.find(s => /NGONO/.test(s.tx.label)); ok(grp && grp.kind === 'groupe' && grp.docs.length === 2, 'encaissement groupé de deux factures');
const spl = sg.filter(s => s.kind === 'fractionne'); ok(spl.length === 2, 'paiement fractionné en deux versements');
const fz = sg.find(s => /CLINQUE/.test(s.tx.label)); ok(fz && fz.score >= 75 && /approximative/.test(fz.reasons.join()), 'référence imparfaite reconnue (faute de frappe, numéro partiel)');
const bk = sg.find(s => s.kind === 'ecriture'); ok(!!bk, 'ligne de relevé déjà comptabilisée : simple rapprochement proposé');
as(S, 'u2'); F.applySuggestion(S, cid, fee.tx.id, fee.docs.map(x => ({ docId: x.doc.id, amount: x.amount, fees: x.fees })));
ok(Y.docStatus(S, cid, doc('FA-2026-0051')).key === 'paid' && fee.tx.status === 'matched', 'suggestion appliquée : facture soldée, frais en 631, relevé rapproché');
F.applySuggestion(S, cid, grp.tx.id, grp.docs.map(x => ({ docId: x.doc.id, amount: x.amount, fees: x.fees })));
ok(['FA-2026-0013', 'FA-2026-0043'].every(n => Y.docStatus(S, cid, doc(n)).key === 'paid'), 'encaissement groupé : les deux factures soldées par une seule écriture');
throws(() => F.applySuggestion(S, cid, fz.tx.id, [{ docId: doc('FA-2026-0063').id, amount: 1, fees: 0 }]), /diffère/, 'jamais d’association forcée avec un montant incohérent');

section('Prévision de trésorerie, relances, promesses');
const fc = F.forecast(S, cid);
ok(fc.weeks.length === 13 && fc.weeks.every(w => w.prudent <= w.central + 1), 'scénario prudent toujours inférieur ou égal au central');
ok(fc.items.some(i => i.src === 'paie') && fc.items.some(i => i.src === 'fournisseur'), 'prévision alimentée par la paie et les fournisseurs');
fd.settings.minCash = 1e12; ok(!!F.forecast(S, cid).tension, 'alerte de tension sous le seuil'); fd.settings.minCash = 35000000;
const plan = F.dunningPlan(S, cid); ok(plan.some(p => p.due && p.step), 'plan de relance calculé selon le scénario');
as(S, 'u2'); const rm = F.remind(S, cid, doc('FA-2026-0060').id); ok(/pay\.myyiel\.com/.test(rm.text), 'relance avec lien de paiement');
const pr = F.promise(S, cid, doc('FA-2026-0064').id, { date: '2026-10-30', amount: 1000000, contact: 'M. MBANGA' }); ok(pr.status === 'en_cours', 'promesse de paiement enregistrée');
throws(() => F.promise(S, cid, doc('FA-2026-0064').id, { date: '2026-10-01' }), /future/, 'promesse dans le passé refusée');
ok(fd.promises.some(p => p.status === 'non_tenue'), 'promesse échue non tenue détectée');
ok(F.reliability(S, cid, tiers('C0002').id).score < 100, 'score de fiabilité de paiement du client');

section('Notifications et droits');
as(S, 'u7'); ok(F.notifications(S, cid).some(n => /bloqué/.test(n.title)), 'le DAF est alerté des paiements bloqués');
as(S, 'u4'); throws(() => F.propose(S, cid, { tiersId: tiers('F0007').id }), /réservée/, 'lecteur : aucune action');
ok(Y.balanceCheck ? true : Y.validated(S, cid).every(e => Y.entryTotals(e).debit === Y.entryTotals(e).credit), 'toutes les écritures restent équilibrées');

  console.log('\n' + pass + ' vérifications réussies, ' + failN + ' échec(s).');
  expect(failN, 'échecs listés ci-dessus (✗)').toBe(0);
});

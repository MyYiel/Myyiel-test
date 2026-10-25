/*
 * Tests Yiel CRM (Node ≥ 18, sans dépendance) : node app/tests/crm.test.js
 * Couvre les critères de recette REC-01 à REC-20 du cahier des charges (docs/crm/06-recette.md) et les règles d'automatisation.
 */
import { test, expect } from 'vitest';
import { Y } from '../src/core/index.js';

test('crm : toutes les vérifications du moteur', () => {
const U = Y.util, C = Y.CRM;
let pass = 0, failN = 0;
function ok(c, m) { if (c) pass++; else { failN++; console.log('  ✗ ' + m); } }
function throws(fn, re, m) { try { fn(); ok(false, m + ' (aucune erreur)'); } catch (e) { ok(e instanceof Y.BizError && (!re || re.test(e.message)), m + ' → ' + e.message); } }
function section(t) { console.log('• ' + t); }
const S = Y.seed('2026-10-21'), cid = S.meta.currentCompany, deygo = S.companies.find(c => c.id !== cid).id, d = C.D(S, cid);
function as(id) { const u = S.users.find(x => x.id === id); S.meta.currentUser = { id: u.id, name: u.name, role: u.role }; }
const ct = n => d.contacts.find(c => (c.firstName + ' ' + c.lastName) === n), co = n => d.companies.find(c => c.name === n), cp = r => C.campaign(S, cid, r);

section('REC-01 · REC-02 · accès et isolation');
throws(() => C.authenticate(S, cid, { email: 'b.fotso@yielgroup.com', password: 'demo' }), /aucun droit/, 'REC-01 salarié sans droit CRM : accès refusé');
throws(() => C.authenticate(S, cid, { email: 'inconnu@exemple.com', password: 'demo' }), /identifiants/, 'REC-01 compte inconnu refusé');
throws(() => C.authenticate(S, cid, { email: 'l.mvondo@yielgroup.com', password: 'faux' }), /identifiants/, 'REC-01 mauvais mot de passe refusé');
throws(() => C.authenticate(S, cid, { email: 'pdg@yielgroup.com', password: 'demo' }), /second facteur/, 'MFA exigée pour un compte sensible');
ok(C.authenticate(S, cid, { email: 'pdg@yielgroup.com', password: 'demo', mfa: '123456' }).role === 'Propriétaire', 'connexion PDG avec MFA, rôle affiché');
ok(S.meta.crmAuth.filter(x => !x.ok).length >= 4, 'tentatives refusées journalisées');
throws(() => C.authenticate(S, cid, { email: 'deygo@yielgroup.com', password: 'demo' }), /membre/, 'REC-02 utilisateur d’une autre organisation refusé à la connexion');
as('u3'); throws(() => C.list(S, cid, 'contacts'), /Espace non autorisé/, 'REC-02 aucune donnée d’une autre organisation divulguée');
as('u20'); ok(!C.list(S, cid, 'contacts').some(c => /CONFIDENTIEL/.test(c.lastName)), 'REC-02 données DeyGo absentes de l’espace Yiel Holding');
throws(() => C.list(S, deygo, 'contacts'), /Espace non autorisé/, 'REC-02 la PDG de la holding n’est pas membre de l’espace DeyGo');

section('Rôles et périmètre');
as('u22'); const mine = C.list(S, cid, 'contacts'); ok(mine.length > 0 && mine.every(c => c.ownerId === 'u22' || c.team === 'Santé & éducation'), 'commercial : seulement son portefeuille et son équipe');
as('u23'); throws(() => C.saveContact(S, cid, { id: ct('Odette KOUMA').id, phone: '+237 6 00 99 00 00' }), /périmètre/, 'commercial : pas de modification hors périmètre');
as('u21'); ok(C.list(S, cid, 'opps').every(o => o.ownerId === 'u21' || o.team === 'Grands comptes'), 'responsable commercial : périmètre de son équipe');
as('u25'); ok(C.list(S, cid, 'contacts').length === 0, 'administrateur CRM : pas d’accès automatique aux contacts');
throws(() => C.approve(S, cid, cp('CMP-002').id), /droit de valider/, 'administrateur CRM : ne valide pas les campagnes');
as('u20'); ok(C.scope(S) === 'all', 'PDG : toutes les données');

section('REC-03 · import avec doublons');
as('u24');
const rows = [['Nom', 'Prénom', 'Société', 'Courriel', 'Tel', 'Poste', 'Pays'], ['KOUMA', 'Odette', 'Polyclinique du Wouri', 'o.kouma@polyclinique-wouri-exemple.cm', '', 'DRH', 'Cameroun'], ['NDOUMBE', 'Alice', 'Pharmacie Centrale Akwa', 'a.ndoumbe@pharma-akwa-exemple.cm', '+237 6 00 40 00 01', 'Gérante', 'Cameroun'], ['NDOUMBE', 'Alice', 'Pharmacie Centrale Akwa', 'a.ndoumbe@pharma-akwa-exemple.cm', '', 'Gérante', 'Cameroun'], ['', 'Sans', 'Nom SARL', 'x@y', '', '', ''], ['NDEDI', 'Joseph', 'Collège bilingue La Réussite', 'principal@lareussite-exemple.cm', '', 'Principal', 'Cameroun'], ['ETOA', 'Marc', 'Garage Moderne Bépanda', 'm.etoa@garage-exemple.cm', '', 'DAF', 'Cameroun']];
const map = C.mapColumns(rows[0]); ok(map.lastName === 0 && map.company === 2 && map.email === 3 && map.phone === 4 && map.function === 5, 'correspondance des colonnes par synonymes');
const an = C.analyzeImport(S, cid, rows, map);
ok(an.ok === 2 && an.errors === 4 && an.duplicates >= 1, 'REC-03 doublons (référentiel, fichier), erreurs et opposition détectés');
ok(an.rows.some(r => r.errors.some(e => /opposition/.test(e))), 'une adresse en opposition n’est pas réimportée');
const nb = d.contacts.length;
throws(() => C.importContacts(S, cid, an, { file: 'salon.csv' }), /Rien n’a été créé/, 'import invalide refusé sans confirmation explicite');
ok(d.contacts.length === nb, 'aucune création partielle incontrôlée');
const rep = C.importContacts(S, cid, an, { file: 'salon.csv', skipErrors: true });
ok(rep.created === 2 && rep.ignored === 4 && rep.errors.length === 4 && d.contacts.length === nb + 2, 'REC-03 rapport : 2 créés, 4 ignorés avec motifs');
ok(d.contacts.find(c => c.lastName === 'ETOA').source.type === 'import', 'provenance « import » conservée');

section('REC-04 · carte de visite');
const draft = C.cardDraft(S, cid, { civility: 'M.', firstName: 'Brice', lastName: 'MBOMA', function: 'DRH', company: 'Hôtel Akwa Résidence', email: 'b.mboma@akwa-residence-exemple', phone: '+237 6 00 50 00 01', confidence: { email: 55, phone: 92, lastName: 96 } });
ok(draft.uncertain.indexOf('email') > -1 && draft.missing.indexOf('website') > -1 && !draft.fields.website.value, 'REC-04 champ incertain signalé, champ absent non inventé');
throws(() => C.createFromCard(S, cid, { lastName: 'MBOMA', company: 'Hôtel Akwa Résidence' }), /Validez/, 'REC-04 création impossible sans validation');
const card = C.createFromCard(S, cid, { civility: 'M.', firstName: 'Brice', lastName: 'MBOMA', function: 'DRH', company: 'Hôtel Akwa Résidence', email: 'b.mboma@akwa-residence-exemple.cm', phone: '+237 6 00 50 00 01', event: 'Salon RH Douala' }, { confirmed: true });
ok(card.email === 'b.mboma@akwa-residence-exemple.cm' && card.companyId === co('Hôtel Akwa Résidence').id && card.source.type === 'carte', 'REC-04 champs corrigés, rattachés à l’entreprise existante');
const dd = C.cardDraft(S, cid, { lastName: 'MBOMA', firstName: 'Brice', email: 'b.mboma@akwa-residence-exemple.cm' }); ok(dd.duplicates.length === 1, 'doublon signalé avant création depuis une carte');
throws(() => C.createFromCard(S, cid, { lastName: 'MBOMA', firstName: 'Brice', email: 'b.mboma@akwa-residence-exemple.cm', company: 'Hôtel Akwa Résidence' }, { confirmed: true }), /Doublon/, 'doublon potentiel bloqué avant création');

section('REC-05 · recherche d’entreprises');
const res = C.search(S, cid, { country: 'Cameroun', sector: 'Santé', offer: 'myyiel RH & Paie' });
ok(res.length >= 2 && res.every(r => r.source && r.source.type && r.source.collectedAt), 'REC-05 chaque résultat a sa source et sa date de collecte');
ok(res[0].fit.score >= res[res.length - 1].fit.score && res[0].fit.reasons.length, 'qualification assistée expliquée et triée');
ok(C.search(S, cid, { reliability: 'verifie' }).every(r => r.contacts.some(c => c.emailStatus === 'verifie')), 'filtre « coordonnée vérifiée »');
throws(() => C.discard(S, cid, 'dir011', ''), /Motif/, 'écarter une cible exige un motif');
C.discard(S, cid, 'dir011', 'Hors zone de prospection'); ok(!C.search(S, cid, {}).some(r => r.id === 'dir011'), 'cible écartée retirée des résultats');
const mic = C.importResults(S, cid, ['dir017'], 'Banques & microfinance');
const bt = d.contacts.find(c => c.lastName === 'TCHOUA');
ok(mic.companies === 1 && bt && bt.emailUnconfirmed && bt.fields.email.source.type === 'deduit' && bt.fields.email.confidence < 50, 'REC-05 adresse déduite jamais présentée comme confirmée');
ok(C.company(S, cid, bt.companyId).source.collectedAt && C.company(S, cid, bt.companyId).source.label, 'provenance et date de collecte conservées à l’import');
ok(C.importResults(S, cid, ['dir001']).companies === 0, 'entreprise déjà présente non dupliquée');

section('REC-06 · opportunité et pipeline');
as('u20');
const before = C.cockpit(S, cid, {}).pipeline.value; as('u22');
const op = C.saveOpp(S, cid, { companyId: co('Hôtel Akwa Résidence').id, offer: 'Conseil en organisation', amount: 4000000, closeDate: '2026-12-15', contactIds: [card.id] });
ok(op.history.length === 1 && op.probability === 5, 'REC-06 opportunité créée, historisée, probabilité de l’étape');
as('u20'); ok(C.cockpit(S, cid, {}).pipeline.value === before + 4000000, 'REC-06 pipeline mis à jour');
as('u22'); C.moveStage(S, cid, op.id, 'proposition', { note: 'Envoyée par e-mail' });
ok(op.history.length === 2 && op.history[1].from === 'a_qualifier' && op.history[1].by && op.probability === 60, 'changement d’étape historisé (qui, quand, de → vers)');
throws(() => C.moveStage(S, cid, op.id, 'perdu', {}), /Motif de perte/, '« Perdu » exige un motif');
throws(() => C.moveStage(S, cid, op.id, 'perdu', { lostReason: 'Météo' }), /non prévu/, 'motif hors liste de la direction refusé');
C.moveStage(S, cid, op.id, 'gagne', { amount: 4200000, signedAt: '2026-10-21' }); ok(op.amount === 4200000 && C.company(S, cid, op.companyId).status === 'client', '« Gagné » : montant signé et entreprise cliente');
const t = C.convertToClient(S, cid, op.companyId); ok(t && t.type === 'client' && C.company(S, cid, op.companyId).tiersId === t.id, 'saisie unique : client créé en comptabilité');

section('REC-07 · message IA et modèles');
const tpl = d.templates[0], kouma = ct('Odette KOUMA');
const r1 = C.render(S, cid, tpl, kouma); ok(/Mme KOUMA/.test(r1.body) && /Polyclinique du Wouri/.test(r1.subject) && !r1.missing.length, 'REC-07 modèle personnalisé (aperçu)');
ok(/Madame, Monsieur/.test(C.rewrite('Bonjour,\n\nMerci.\n\nBien à vous', { tone: 'formel' })), 'reformulation du ton (repli local)');
const noName = C.saveContact(S, cid, { lastName: 'X', companyId: '', email: 'x@exemple-test.cm' }, { force: true });
ok(C.render(S, cid, tpl, noName).missing.indexOf('entreprise.nom') > -1, 'variable obligatoire vide signalée');
throws(() => C.sendMessage(S, cid, { contactId: noName.id, templateId: tpl.id }), /Variables obligatoires vides/, 'message refusé avec variable obligatoire vide');
throws(() => C.sendMessage(S, cid, { contactId: ct('Joseph NDEDI').id, subject: 'Bonjour', body: 'Test' }), /exclu/, 'message refusé vers un destinataire exclu');
as('u24'); throws(() => C.saveTemplate(S, cid, { name: 'X', subject: '{{contact.age}}', body: 'b' }), /Variable inconnue/, 'variable inconnue refusée dans un modèle');

section('REC-08 · REC-18 · campagne non approuvée');
as('u24'); const c2 = cp('CMP-002'), q0 = d.queue.length;
C.tick(S, cid, '2026-10-27T12:00'); ok(!d.queue.some(q => q.campaignId === c2.id), 'REC-08 aucune campagne exécutée avant approbation');
throws(() => C.approve(S, cid, c2.id), /droit de valider/, 'REC-18 marketing ne peut pas approuver');
as('u21'); throws(() => C.approve(S, cid, c2.id), /droit de valider/, 'REC-18 responsable commercial sans délégation ne peut pas approuver');
as('u20'); C.delegate(S, cid, 'u21', '2026-12-31'); as('u21'); ok(C.canApprove(S, cid), 'délégation explicite au responsable commercial');
as('u20'); C.revoke(S, cid, 'u21'); as('u21'); ok(!C.canApprove(S, cid), 'délégation retirée');
throws(() => { as('u20'); C.delegate(S, cid, 'u25'); }, /responsable commercial/, 'pas de délégation à l’administrateur technique');
void q0;

section('REC-09 · campagne approuvée');
as('u20'); C.setNow(S, '2026-10-21T09:30');
C.approve(S, cid, c2.id, 'OK pour 2 DAF'); ok(c2.status === 'programmee' && c2.approval.recipients.length === 2 && c2.approval.by.indexOf('Nkomane') > -1, 'approbation d’une version précise (destinataires, modèles, calendrier)');
ok(!c2.approval.recipients.includes(ct('Samuel OWONA').id), 'adresse déduite non confirmée exclue du périmètre');
C.tick(S, cid, '2026-10-25T23:00'); ok(!d.queue.some(q => q.campaignId === c2.id && q.status === 'envoye'), 'rien avant la date de lancement');
C.tick(S, cid, '2026-10-26T12:00'); const s2 = d.queue.filter(q => q.campaignId === c2.id && q.status === 'envoye');
ok(c2.status === 'en_cours' && s2.length === 2 && s2.every(q => q.sentAt >= '2026-10-26T08:00' && q.sentAt.slice(11) < '17:30'), 'REC-09 envois exécutés dans le périmètre, le planning et les horaires');
ok(s2.every(q => d.sentKeys[q.key]), 'clé d’idempotence enregistrée');
const dupq = Object.assign({}, s2[0], { id: 'qdup', status: 'planifie', dueAt: '2026-10-26T12:30' }); d.queue.push(dupq); C.tick(S, cid, '2026-10-26T13:00');
ok(dupq.status === 'bloque' && /idempotence/.test(dupq.reason), 'événement rejoué : pas de second envoi');

section('REC-10 · modification significative après approbation');
const c1 = cp('CMP-001'), v1 = c1.version;
as('u24'); C.saveCampaign(S, cid, { id: c1.id, extraIds: [ct('Marc ETOA').id] });
ok(c1.status === 'attente_pdg' && c1.version === v1 + 1 && /hors du périmètre/.test(c1.reapproval.reason), 'REC-10 ajout de destinataire hors périmètre : nouvelle validation');
C.tick(S, cid, '2026-10-26T15:00'); ok(!d.queue.some(q => q.campaignId === c1.id && q.status === 'envoye' && q.sentAt > '2026-10-26T13:00'), 'envois suspendus en attendant la validation');
as('u20'); C.approve(S, cid, c1.id, 'Ajout validé'); ok(c1.status === 'en_cours' && c1.approval.version === v1 + 1 && c1.approvals.length === 2, 'nouvelle version approuvée, historique des approbations');
as('u24'); C.saveTemplate(S, cid, { id: d.templates[1].id, name: d.templates[1].name, subject: d.templates[1].subject, body: d.templates[1].body + '\nPS : démonstration gratuite.' });
ok(c1.status === 'attente_pdg' && /Modèle/.test(c1.reapproval.reason), 'REC-10 modèle modifié : nouvelle validation exigée');
const kq = d.queue.find(q => q.campaignId === c1.id && ['planifie', 'reporte'].includes(q.status));
as('u20'); C.approve(S, cid, c1.id, 'Nouveau modèle validé');
C.saveContact(S, cid, { id: ct('Didier MOUSSA').id, phone: '+237 6 00 30 10 99' }); ok(c1.status === 'en_cours', 'simple modification d’une donnée de contact : pas de nouvelle validation');
ok(kq, 'relance planifiée conservée');

section('REC-11 · réponse commerciale');
const moussa = ct('Didier MOUSSA'), pend = () => d.queue.filter(q => q.contactId === moussa.id && q.campaignId === c1.id && ['planifie', 'reporte'].includes(q.status)).length;
ok(pend() > 0, 'relance prévue pour ce contact');
const nAct = d.activities.length, rr = C.receiveReply(S, cid, { contactId: moussa.id, text: 'Bonjour, intéressant. Pouvez-vous m’appeler mardi pour en parler ?' });
ok(rr.kind === 'positive' && pend() === 0 && d.activities.length === nAct + 1 && d.activities[d.activities.length - 1].ownerId === moussa.ownerId, 'REC-11 relances suspendues et tâche créée pour le responsable du contact');
ok(C.classify('Je suis en congé, de retour le 04/11').kind === 'absence' && C.classify('Je suis en congé, de retour le 04/11').back === '2026-11-04', 'réponse automatique d’absence distinguée, date de retour lue');
ok(d.queue.find(q => q.contactId === ct('Agnès MBALLA').id && q.step === 1).dueAt === '2026-10-31T09:00', 'absence : séquence reportée au retour');

section('REC-12 · opposition');
const bella = ct('Hervé BELLA'); C.receiveReply(S, cid, { contactId: bella.id, text: 'STOP. Retirez mon adresse de vos listes.' });
ok(C.isExcluded(S, cid, bella) && bella.consent.status === 'opposition' && !d.queue.some(q => q.contactId === bella.id && ['planifie', 'reporte', 'reessai'].includes(q.status)), 'REC-12 opposition : exclusion immédiate, envois annulés');
throws(() => C.sendMessage(S, cid, { contactId: bella.id, subject: 'Bonjour', body: 'Test' }), /exclu/, 'REC-12 plus aucun message individuel possible');

section('REC-13 · plafonds');
as('u20'); throws(() => C.setCaps(S, cid, { mailboxDay: 900, campaignDay: 50, campaignWeek: 200, recipientWeek: 2 }), /limite du fournisseur/, 'plafond supérieur à la limite du fournisseur refusé');
C.setCaps(S, cid, { mailboxDay: 150, campaignDay: 2, campaignWeek: 200, recipientWeek: 2 });
as('u24'); const L = { id: 'lst_cap', name: 'Test plafond', contactIds: [] }; d.lists.push(L);
for (let i = 0; i < 5; i++) { const c = C.saveContact(S, cid, { firstName: 'Test' + i, lastName: 'PLAFOND', companyId: co('BTP Sanaga Construction').id, email: 'test' + i + '@sanaga-construction-exemple.cm' }, { force: true }); L.contactIds.push(c.id); }
const c5 = C.saveCampaign(S, cid, { name: 'Test plafond', objective: 'Vérifier les plafonds', segment: { listIds: ['lst_cap'] }, steps: [{ templateId: d.templates[3].id, delayDays: 0 }], schedule: { start: '2026-10-27', end: '2026-11-30' } });
C.submit(S, cid, c5.id); as('u20'); C.approve(S, cid, c5.id); C.tick(S, cid, '2026-10-27T17:00');
const sent27 = d.queue.filter(q => q.campaignId === c5.id && q.status === 'envoye').length, rep27 = d.queue.filter(q => q.campaignId === c5.id && q.status === 'reporte');
ok(sent27 === 2 && rep27.length === 3 && rep27.every(q => q.dueAt >= '2026-10-28'), 'REC-13 aucun envoi au-delà du plafond journalier : report au jour suivant');
C.tick(S, cid, '2026-10-30T17:00'); ok(d.queue.filter(q => q.campaignId === c5.id && q.status === 'envoye').length === 5, 'reprise des envois reportés dans les plafonds');
ok(!d.queue.some(q => q.campaignId === c5.id && q.sentAt && [0, 6].includes(new Date(q.sentAt.slice(0, 10) + 'T12:00:00Z').getUTCDay())), 'aucun envoi le week-end');
C.setCaps(S, cid, { mailboxDay: 150, campaignDay: 60, campaignWeek: 250, recipientWeek: 2 });

section('REC-14 · erreur temporaire du fournisseur');
as('u24'); const L2 = { id: 'lst_tmp', name: 'Test panne', contactIds: [] }; d.lists.push(L2);
const tc = C.saveContact(S, cid, { firstName: 'Panne', lastName: 'TEST', companyId: co('BTP Sanaga Construction').id, email: 'panne@sanaga-construction-exemple.cm' }, { force: true }); L2.contactIds.push(tc.id);
const c6 = C.saveCampaign(S, cid, { name: 'Test panne', objective: 'Reprise', segment: { listIds: ['lst_tmp'] }, steps: [{ templateId: d.templates[3].id, delayDays: 0 }], schedule: { start: '2026-11-02', end: '2026-11-30' } });
C.submit(S, cid, c6.id); as('u20'); C.approve(S, cid, c6.id);
S.meta.crmOutage = true; C.tick(S, cid, '2026-11-02T08:15');
const qp = d.queue.find(q => q.campaignId === c6.id); ok(qp.status === 'reessai' && qp.attempts === 1 && d.runLog.some(l => l.key === qp.key && l.result === 'reessai'), 'REC-14 erreur journalisée, nouvelle tentative programmée');
S.meta.crmOutage = false; C.tick(S, cid, '2026-11-02T10:00'); ok(qp.status === 'envoye' && qp.attempts === 2, 'REC-14 reprise contrôlée après incident, sans doublon');
const qb = d.queue.find(q => q.to === 'assistante@adresse-invalide-exemple.cm'); ok(qb.status === 'echec' && ct('Irène EBOGO').emailInvalid, 'erreur définitive (adresse inexistante) : pas de nouvelle tentative, adresse marquée invalide');

section('REC-15 · REC-16 · agenda');
as('u20'); C.setIntegration(S, cid, 'gcal', 'deconnecte');
as('u22'); const rdv = C.saveActivity(S, cid, { type: 'rdv', title: 'Démo RH', at: '2026-11-05T10:00', contactId: card.id });
ok(rdv.gcal.sync === 'indisponible' && d.events.some(e => e.type === 'integration' && /Google Calendar/.test(e.text)), 'REC-15 déconnexion : alerte visible, synchronisation signalée indisponible');
as('u20'); ok(C.notifications(S, cid).some(n => /Google Calendar/.test(n.title)), 'alerte dans le centre de notifications');
C.setIntegration(S, cid, 'gcal', 'actif'); ok(rdv.gcal.sync === 'ok' && rdv.gcal.resynced, 'resynchronisation au retour de la connexion');
as('u22'); const rd2 = C.saveActivity(S, cid, { type: 'rdv', title: 'Rendez-vous découverte', at: '2026-11-06T09:00', contactId: ct('Odette KOUMA').id });
ok(rd2.companyId === co('Polyclinique du Wouri').id && rd2.reminder === 60 && rd2.gcal.sync === 'ok', 'REC-16 rendez-vous lié au prospect et à son entreprise, rappel programmé');
C.setNow(S, '2026-11-06T08:15'); ok(C.dueReminders(S, cid).some(a => a.id === rd2.id), 'rappel déclenché avant le rendez-vous');
const ta = d.activities.find(a => /Relancer la proposition comptable/.test(a.title)); as('u23');
C.completeActivity(S, cid, ta.id, { postpone: '2026-11-10T11:00', note: 'Client en déplacement' });
ok(ta.status === 'a_faire' && ta.history.length === 2 && C.nextAction(S, cid, a => a.contactId === ta.contactId).id === ta.id, 'activité reportée : prochaine action recalculée, historique conservé');
C.completeActivity(S, cid, ta.id, { note: 'Proposition acceptée oralement', next: { type: 'tache', title: 'Envoyer le bon de commande', at: '2026-11-11T09:00' } });
ok(ta.status === 'fait' && C.nextAction(S, cid, a => a.contactId === ta.contactId).title === 'Envoyer le bon de commande', 'activité terminée : prochaine action actualisée');

section('REC-17 · objectifs et cockpit');
as('u20'); const k1 = C.cockpit(S, cid, { from: '2026-10-01', to: '2026-12-31' });
const won = d.opps.filter(o => o.stage === 'gagne' && o.signedAt >= '2026-10-01');
ok(k1.signed.value === won.reduce((a, o) => a + o.amount, 0) && k1.signed.items.length === won.length, 'CA signé = somme des opportunités gagnées (dossiers sources)');
const open = d.opps.filter(o => !['gagne', 'perdu'].includes(o.stage));
ok(k1.pipeline.value === open.reduce((a, o) => a + o.amount, 0) && k1.weighted.value === Math.round(open.reduce((a, o) => a + o.amount * o.probability / 100, 0)), 'pipeline et pipeline pondéré recalculés depuis les opportunités');
ok(k1.invoiced.items.every(x => d.companies.some(c => c.tiersId === x.tiersId)) && k1.collected.value > 0, 'CA facturé et encaissé lus dans la comptabilité');
C.saveObjective(S, cid, { period: 'T4 2026', from: '2026-10-01', to: '2026-12-31', target: 30000000 });
const k2 = C.cockpit(S, cid, { from: '2026-10-01', to: '2026-12-31' }); ok(k2.target === 30000000 && k2.progress === Math.round(k2.signed.value * 1000 / 30000000) / 10 && d.objectives.find(o => o.period === 'T4 2026').history.length === 1, 'REC-17 objectif modifié : indicateurs recalculés, modification historisée');
ok(C.cockpit(S, cid, { from: '2026-10-01', to: '2026-12-31', offer: 'myyiel RH & Paie' }).pipeline.items.every(o => o.offer === 'myyiel RH & Paie'), 'filtre par offre');

section('REC-19 · arrêt d’urgence et suspension globale');
as('u24'); const L3 = { id: 'lst_stop', name: 'Test arrêt', contactIds: [] }; d.lists.push(L3);
for (let i = 0; i < 3; i++) { const c = C.saveContact(S, cid, { firstName: 'Stop' + i, lastName: 'ARRET', companyId: co('Télécom Services Cameroun').id, email: 'stop' + i + '@tsc-exemple.cm' }, { force: true }); L3.contactIds.push(c.id); }
const c7 = C.saveCampaign(S, cid, { name: 'Test arrêt', objective: 'Arrêt', segment: { listIds: ['lst_stop'] }, steps: [{ templateId: d.templates[3].id, delayDays: 0 }], schedule: { start: '2026-11-09', end: '2026-11-30' } });
C.submit(S, cid, c7.id); as('u20'); C.approve(S, cid, c7.id); C.suspend(S, cid, c7.id, 'Erreur dans le ciblage');
C.tick(S, cid, '2026-11-09T12:00'); ok(!d.queue.some(q => q.campaignId === c7.id && q.status === 'envoye'), 'REC-19 arrêt d’urgence : aucune nouvelle exécution');
as('u24'); throws(() => C.resume(S, cid, c7.id), /direction/, 'seule la direction reprend');
as('u20'); C.resume(S, cid, c7.id); C.globalStop(S, cid, true, 'Incident de réputation de la boîte d’envoi');
C.tick(S, cid, '2026-11-09T16:00'); ok(!d.queue.some(q => q.campaignId === c7.id && q.status === 'envoye') && d.runLog.some(l => /Suspension globale/.test(l.text)), 'suspension globale : aucun envoi sortant, motif journalisé');
as('u22'); throws(() => C.globalStop(S, cid, false), /réservée/, 'commercial : ne lève pas la suspension globale');
as('u20'); C.globalStop(S, cid, false); C.tick(S, cid, '2026-11-10T10:00'); ok(d.queue.filter(q => q.campaignId === c7.id && q.status === 'envoye').length === 3, 'reprise contrôlée après levée');

section('REC-20 · export');
as('u22'); throws(() => C.export(S, cid), /réservée/, 'commercial sans droit d’export : refusé');
as('u21'); const ex = C.export(S, cid), au = Y.D(S, cid).audit.slice(-1)[0];
ok(ex.length - 1 === C.list(S, cid, 'contacts').length && ex.length - 1 < d.contacts.filter(c => !c.deleted).length, 'REC-20 export limité au périmètre autorisé');
ok(au.action === 'CRM · export' && /périmètre team/.test(au.detail), 'REC-20 export journalisé (piste d’audit)');

section('Données personnelles, intégrations, notifications');
as('u20'); const etoa = d.contacts.find(c => c.lastName === 'ETOA'), mail = etoa.email;
C.personalRequest(S, cid, etoa.id, 'suppression', 'Courrier du 02/11');
ok(etoa.deleted && etoa.lastName === 'Contact supprimé' && !etoa.email && C.isExcluded(S, cid, { email: mail }), 'suppression : anonymisation et blocage d’une réimportation');
ok(C.timeline(S, cid, { kind: 'contact', id: moussa.id }).some(e => /Coordonnées modifiées/.test(e.text)) && C.timeline(S, cid, { kind: 'contact', id: moussa.id }).some(e => e.type === 'email'), 'historique commercial conservé après modification des coordonnées');
C.setIntegration(S, cid, 'mailbox', 'expire');
as('u24'); const L4 = { id: 'lst_mb', name: 'Test boîte', contactIds: [ct('Guy EKWA').id] }; d.lists.push(L4);
const c8 = C.saveCampaign(S, cid, { name: 'Test boîte', objective: 'Canal', segment: { listIds: ['lst_mb'] }, steps: [{ templateId: d.templates[3].id, delayDays: 0 }], schedule: { start: '2026-11-11', end: '2026-11-30' } });
C.submit(S, cid, c8.id); as('u20'); C.approve(S, cid, c8.id); C.tick(S, cid, '2026-11-11T10:00');
const qm = d.queue.find(q => q.campaignId === c8.id); ok(qm.status === 'attente_canal', 'boîte expirée : opérations dépendantes suspendues');
C.setIntegration(S, cid, 'mailbox', 'actif'); C.tick(S, cid, '2026-11-11T11:00'); ok(qm.status === 'envoye', 'envoi repris à la reconnexion');
const nEv = d.events.length; C.pushEvent(S, cid, 'reponse', 'rep_test', 'Test', 'haute'); C.pushEvent(S, cid, 'reponse', 'rep_test', 'Test', 'haute');
ok(d.events.length === nEv + 1 && d.waLog.filter(w => w.key === 'rep_test').length === 1, 'déduplication : une seule notification et une seule alerte WhatsApp par événement');
ok(d.waLog.every(w => w.status === 'non_envoyee'), 'WhatsApp non configuré : alertes marquées non envoyées (pas de faux envoi)');
ok(Y.validated(S, cid).every(e => Y.entryTotals(e).debit === Y.entryTotals(e).credit), 'les écritures comptables restent équilibrées');

  console.log('\n' + pass + ' vérifications réussies, ' + failN + ' échec(s).');
  expect(failN, 'échecs listés ci-dessus (✗)').toBe(0);
});

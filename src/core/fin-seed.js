/* Jeu de démonstration · Module 4 (trésorerie, facturation, paiements, anti-fraude). Numéros en +237 6 00 … : fictifs. */
import { Y } from './registry.js';

var U = Y.util, F = Y.Fin;
function as(S, id, name, role) { S.meta.currentUser = { id: id, name: name, role: role }; }
var C = {
  C0001: { legalForm: 'SARL', niu: 'M052100031407K', rccm: 'RC/DLA/2015/B/2231', category: 'PME', district: 'Akwa', bp: 'BP 4410', contacts: [['Mme EBOA Christelle', 'Gérante', '+237 6 77 00 00 01'], ['M. DIKA Paul', 'Comptable', '+237 6 00 00 01 12']], payModes: ['momo', 'bank'] },
  C0002: { legalForm: 'SCP', niu: 'M062000045219P', rccm: 'RC/DLA/2020/B/0815', category: 'PME', district: 'Bonanjo', bp: 'BP 1203', contacts: [['Me NGONO Albert', 'Associé gérant', '+237 6 99 00 00 02'], ['Mme TCHAKOUNTE Alice', 'Assistante', '+237 6 00 00 02 21']], payModes: ['bank', 'om'] },
  C0003: { legalForm: 'Association', niu: 'P011700012345M', rccm: '', category: 'Établissement scolaire', district: 'Makepe', bp: 'BP 8820', contacts: [['M. FOKOU Daniel', 'Économe', '+237 6 00 00 03 31']], payModes: ['bank'] },
  C0004: { legalForm: 'SA', niu: 'M041000078812Q', rccm: 'RC/DLA/2010/B/1544', category: 'Santé', district: 'Bonamoussadi', bp: 'BP 15002', contacts: [['Dr MOUKOKO Serge', 'Directeur', '+237 6 00 00 04 41'], ['Mme NJIKE Laure', 'Responsable financière', '+237 6 00 00 04 42']], payModes: ['bank', 'momo'] },
  C0005: { legalForm: 'SARL', niu: 'M071800023390R', rccm: 'RC/DLA/2018/B/3902', category: 'Transport & logistique', district: 'Ndokoti', bp: 'BP 3021', contacts: [['M. MBANGA Joël', 'Directeur général', '+237 6 78 00 00 05']], payModes: ['momo', 'om'] },
  C0006: { legalForm: 'Coopérative', niu: 'P091900054321S', rccm: 'COOP/LT/2019/017', category: 'Agriculture', district: 'Penja', bp: 'BP 22', contacts: [['M. NJOH Emmanuel', 'Président', '+237 6 90 00 00 06'], ['Mme EKWALLA Rose', 'Trésorière', '+237 6 00 00 06 62']], payModes: ['om', 'momo', 'bank'] }
};
var SUP = {
  F0001: { legalForm: 'SCI', niu: 'M030500011223A', category: 'Immobilier & locaux', email: 'gestion@akwa-business-exemple.cm', contacts: [['M. KOUOH Bertrand', 'Gestionnaire', '+237 6 00 00 11 01']], bank: ['Banque exemple A', 'CM21 10005 00001 12345678901 23', ''], rating: [5, 4, 3] },
  F0002: { legalForm: 'SARL', niu: 'M081600034561B', category: 'Informatique & numérique', email: 'contact@douala-informatique-exemple.cm', contacts: [['M. ESSOMBA Roger', 'Directeur commercial', '+237 6 00 00 12 01'], ['Mme MBIDA Sylvie', 'Comptable', '+237 6 00 00 12 02']], bank: ['Banque exemple B', 'CM21 10033 05202 00012345678 41', ''], rating: [4, 4, 4] },
  F0003: { legalForm: 'Société étrangère', niu: '', category: 'Informatique & numérique', email: 'billing@cloud-exemple.com', contacts: [['Support facturation', '', '']], bank: ['Prélèvement carte', '', ''], rating: [5, 5, 3] },
  F0004: { legalForm: 'SA', niu: 'M029800000777C', category: 'Télécommunications', email: 'entreprises@telecom-exemple.cm', contacts: [['Service entreprises', 'Conseiller', '+237 6 00 00 14 01']], bank: ['Banque exemple A', 'CM21 10005 00002 99887766554 12', ''], rating: [3, 3, 3] },
  F0005: { legalForm: 'SA', niu: 'M019900000123D', category: 'Énergie & eau', email: 'grandscomptes@energie-exemple.cm', contacts: [['Service grands comptes', '', '+237 6 00 00 15 01']], bank: ['Banque exemple C', 'CM21 10002 00100 11223344556 77', ''], rating: [3, 2, 3] },
  F0006: { legalForm: 'SARL', niu: 'M051400067788E', category: 'Conseil & expertise', email: 'cabinet@expertise-exemple.cm', contacts: [['M. NANA Félix', 'Expert-comptable associé', '+237 6 00 00 16 01']], bank: ['Mobile Money', '', '+237 6 00 00 16 09'], rating: [5, 4, 4] },
  F0007: { legalForm: 'SARL', niu: 'M061200001010F', category: 'Transport & mobilité', email: 'station.bonapriso@exemple.cm', contacts: [['M. TCHINDA Marc', 'Gérant', '+237 6 00 00 17 01']], bank: ['Mobile Money', '', '+237 6 00 00 17 09'], rating: [4, 5, 4] }
};
var NEW_SUP = [
  ['F0008', 'Imprimerie du Wouri SA', 'SA', 'M012100000002B', 'Communication & événementiel', 'devis@imprimerie-wouri-exemple.cm', 'Douala', [['M. ETOUNDI Jacques', 'Commercial', '+237 6 00 00 20 02']], ['Banque exemple B', 'CM21 10033 05202 00099887766 15', '']],
  ['F0009', 'Bureau Pro Akwa', 'SARL', 'M061500004455G', 'Fournitures de bureau', 'ventes@bureau-pro-exemple.cm', 'Douala', [['Mme NDOUMBE Diane', 'Responsable commerciale', '+237 6 00 00 21 01']], ['Orange Money', '', '+237 6 00 00 21 09']],
  ['F0010', 'Hôtel Les Cocotiers Kribi', 'SARL', 'M092300000001A', 'Hôtellerie & restauration', 'reservation@cocotiers-exemple.cm', 'Kribi', [['Mme ESSAMA Joëlle', 'Directrice', '+237 6 00 00 22 01']], ['Banque exemple A', 'CM21 10005 00003 55443322110 08', '']],
  ['F0011', 'Agence Voyages Sanaga', 'SARL', 'M071100008899H', 'Transport & mobilité', 'billetterie@voyages-sanaga-exemple.cm', 'Yaoundé', [['M. ABOMO Cyrille', 'Agent', '+237 6 00 00 23 01']], ['MTN Mobile Money', '', '+237 6 00 00 23 09']],
  ['F0012', 'Bonapriso Clean Services', 'Entreprise individuelle', '', 'Autres', 'bonaprisoclean@exemple.cm', 'Douala', [['M. TABI', 'Gérant', '+237 677 50 60 16']], ['MTN Mobile Money', '', '+237 677 50 60 16']]
];

Y.seedFin = function (S, cid, today) {
  if (!F) return;
  var save = S.meta.currentUser; F._bypass = true;
  try { seed(S, cid, today); } finally { F._bypass = false; S.meta.currentUser = save; }
};
function seed(S, cid, today) {
  var d = Y.D(S, cid), fd = F.D(S, cid);
  as(S, 'u2', 'A. Mbarga', 'accountant');
  F.templates(S, cid);
  F.saveTemplate(S, cid, { name: 'Modèle Yiel Conseil (importé)', base: 'import', fileName: 'modele-facture-yiel-conseil.docx', style: 'epure', color: '#141A3A', accent: '#F25C2A', footer: 'Pénalités de retard : taux légal majoré de 3 points. Escompte pour paiement anticipé : néant.', zones: { groups: true, pay: true } });
  F.templates(S, cid)[0].footer = 'Tout retard de paiement entraîne des pénalités au taux légal en vigueur. Paiement par MTN MoMo, Orange Money ou virement.';
  // clients
  Object.keys(C).forEach(function (code) { var t = Y.tiers(S, cid, code), c = C[code], p = F.profile(t); Object.assign(t, { niu: c.niu, rccm: c.rccm }); Object.assign(p, { legalForm: c.legalForm, category: c.category, district: c.district, bp: c.bp, payModes: c.payModes, emailDomain: (t.email.split('@')[1] || '') }); p.contacts = c.contacts.map(function (x, i) { return { id: U.uid('ct'), name: x[0], role: x[1], phone: x[2], whatsapp: x[2], email: i ? '' : t.email, main: !i }; }); p.addresses = [{ label: 'Siège', city: t.city || 'Douala', district: c.district, address: '', bp: c.bp }]; p.docs = [{ id: U.uid('fd'), name: 'Contrat-cadre ' + t.name + '.pdf', type: 'Contrat', date: '2026-01-05' }, { id: U.uid('fd'), name: 'Attestation de non-redevance.pdf', type: 'Administratif', date: '2026-03-02', expires: '2027-03-01' }]; });
  // fournisseurs
  Object.keys(SUP).forEach(function (code) { var t = Y.tiers(S, cid, code), c = SUP[code], p = F.profile(t); Object.assign(t, { niu: c.niu, email: c.email }); Object.assign(p, { legalForm: c.legalForm, category: c.category, emailDomain: c.email.split('@')[1], payModes: c.bank[2] ? [/^\+237 6 00 00 1[67]/.test(c.bank[2]) ? 'momo' : 'om'] : ['bank'] }); p.contacts = c.contacts.map(function (x, i) { return { id: U.uid('ct'), name: x[0], role: x[1], phone: x[2], whatsapp: x[2], email: i ? '' : c.email, main: !i }; }); p.banks = [{ id: U.uid('bk'), bank: c.bank[0], holder: t.name.toUpperCase(), account: c.bank[1], momo: c.bank[2], op: c.bank[2] ? 'MTN' : '', status: 'verifie', main: true, verifiedBy: 'DAF · P. Tchoumi', verifiedAt: '2026-01-10T10:00:00.000Z', callback: { contact: x0(c), comment: 'Coordonnées confirmées par rappel lors du référencement' } }]; p.docs = [{ id: U.uid('fd'), name: 'Extrait RCCM.pdf', type: 'Administratif', date: '2025-11-10' }, { id: U.uid('fd'), name: 'Attestation de non-redevance.pdf', type: 'Administratif', date: '2026-02-12', expires: '2027-02-11' }, { id: U.uid('fd'), name: 'RIB ' + t.name + '.pdf', type: 'Bancaire', date: '2026-01-10' }]; p.evaluations = [{ id: U.uid('ev'), date: '2026-06-30', quality: c.rating[0], delay: c.rating[1], price: c.rating[2], comment: 'Revue semestrielle', by: 'DAF · P. Tchoumi' }]; if (c.bank[2]) fd.operatorDir[F.phoneKey(c.bank[2])] = { name: t.name.toUpperCase(), op: 'MTN', since: '2021-04-02' }; });
  function x0(c) { return c.contacts[0][0]; }
  NEW_SUP.forEach(function (n) {
    var t = Y.createTiers(S, cid, { code: n[0], type: 'fournisseur', name: n[1], niu: n[3], email: n[5], city: n[6], phone: n[7][0][2], terms: 30 });
    var p = F.profile(t); Object.assign(p, { legalForm: n[2], category: n[4], emailDomain: n[5].split('@')[1], payModes: n[8][2] ? [/Orange/.test(n[8][0]) ? 'om' : 'momo'] : ['bank'], status: n[0] === 'F0012' ? 'a_valider' : 'actif' });
    p.contacts = n[7].map(function (x, i) { return { id: U.uid('ct'), name: x[0], role: x[1], phone: x[2], whatsapp: x[2], email: i ? '' : n[5], main: !i }; });
    p.banks = [{ id: U.uid('bk'), bank: n[8][0], holder: n[1].toUpperCase(), account: n[8][1], momo: n[8][2], op: n[8][2] ? (/Orange/.test(n[8][0]) ? 'Orange' : 'MTN') : '', status: n[0] === 'F0012' ? 'a_confirmer' : 'verifie', main: true, verifiedBy: n[0] === 'F0012' ? '' : 'DAF · P. Tchoumi', verifiedAt: '2026-03-01T10:00:00.000Z' }];
    if (n[8][2] && n[0] !== 'F0012') fd.operatorDir[F.phoneKey(n[8][2])] = { name: n[1].toUpperCase(), op: p.banks[0].op, since: '2022-01-10' };
    p.docs = n[0] === 'F0012' ? [] : [{ id: U.uid('fd'), name: 'Extrait RCCM.pdf', type: 'Administratif', date: '2026-02-01' }];
  });
  fd.operatorDir[F.phoneKey('+237 677 50 60 16')] = { name: 'TABI GASTON', op: 'MTN', since: '2017-03-01' };
  fd.operatorDir[F.phoneKey('+237 6 00 11 22 33')] = { name: 'NKOU DIDIER', op: 'MTN', since: '2026-10-02' };
  fd.operatorDir[F.phoneKey('+237 6 00 99 88 77')] = { name: 'SERVICE CLIENT OM', op: 'Orange', since: '2026-09-28' };
  // achats récents des nouveaux fournisseurs (factures à payer)
  function purchase(code, date, ref, label, ht, account) { return Y.postPurchase(S, cid, { tiersId: Y.tiers(S, cid, code).id, date: date, ref: ref, label: label, due: U.addDays(date, 30), lines: [{ account: account || '605', ht: ht, taxCode: 'TVA19', label: label }], silent: true }); }
  purchase('F0008', '2026-09-24', 'IW-2026-0412', 'Impression des brochures myyiel (2 000 ex.)', 1450000, '627');
  purchase('F0009', '2026-10-02', 'BPA-2026-298', 'Fournitures de bureau octobre', 185000, '6055');
  purchase('F0010', '2026-10-09', 'COC-8841', 'Séminaire équipe Conseil (12 personnes)', 2100000, '618');
  purchase('F0011', '2026-10-14', 'AVS-10-2026-77', 'Billets Douala-Yaoundé mission client', 96000, '618');
  purchase('F0012', '2026-10-16', 'BCS-001', 'Nettoyage des bureaux · octobre', 420000, '624');
  purchase('F0002', '2026-10-06', 'DIS-2026-1187', 'Maintenance du parc informatique T4', 1050000, '624');
  // liste de vigilance
  as(S, 'u7', 'DAF · P. Tchoumi', 'cfo');
  F.addWatch(S, cid, { kind: 'phone', value: '+237 6 00 99 88 77', reason: 'Faux « service client Orange Money » : demande de renvoi de fonds signalée par un client', source: 'Signalement client' });
  F.addWatch(S, cid, { kind: 'domain', value: 'yielgroup-paiement.com', reason: 'Domaine sosie de Yiel Group utilisé pour envoyer de faux liens de paiement', source: 'Veille' });
  // changements de coordonnées
  as(S, 'u2', 'A. Mbarga', 'accountant');
  var dis = Y.tiers(S, cid, 'F0002');
  F.requestBankChange(S, cid, dis.id, { momo: '+237 6 00 11 22 33', op: 'MTN', source: 'E-mail', senderEmail: 'compta@douala-informatiques-exemple.cm', senderPhone: '+237 6 00 11 22 33', message: 'Suite à un audit de notre banque, merci de régler désormais toutes nos factures sur ce numéro MoMo. C’est urgent, notre compte est bloqué.' }).at = today + 'T08:14:00.000Z';
  F.requestBankChange(S, cid, Y.tiers(S, cid, 'F0008').id, { bank: 'Banque exemple D', holder: 'IMPRIMERIE DU WOURI SA', account: 'CM21 10029 26000 00055667788 90', source: 'Courrier signé', message: 'Changement de banque principale à compter du 1er novembre (courrier signé du DG, cachet).' }).at = U.addDays(today, -1) + 'T15:40:00.000Z';
  // boîte de réception
  var rent = Y.validated(S, cid).filter(function (e) { return e.source === 'purchase' && e.lines.some(function (l) { return l.tiersId === Y.tiers(S, cid, 'F0001').id; }); }).pop();
  F.receive(S, cid, { source: 'email', from: 'ventes@bureau-pro-exemple.cm', fileName: 'Facture_BPA-2026-311.pdf', receivedAt: today + 'T07:02:00.000Z', confidence: 96, extracted: { supplier: 'Bureau Pro Akwa', niu: 'M061500004455G', invoiceNo: 'BPA-2026-311', date: '2026-10-19', due: '2026-11-18', ht: 210000, tva: 40425, ttc: 250425, label: 'Cartouches et ramettes', momo: '+237 6 00 00 21 09' } });
  F.receive(S, cid, { source: 'whatsapp', from: '+237 6 00 00 23 01', fileName: 'IMG-20261020-WA0012.jpg', receivedAt: U.addDays(today, -1) + 'T18:20:00.000Z', confidence: 81, extracted: { supplier: 'Agence Voyages Sanaga', niu: 'M071100008899H', invoiceNo: 'AVS-10-2026-91', date: '2026-10-20', due: '2026-10-30', ht: 144000, tva: 27720, ttc: 171720, label: 'Billets Yaoundé-Bertoua (2)', momo: '+237 6 00 00 23 09' } });
  if (rent) F.receive(S, cid, { source: 'email', from: 'gestion@akwa-business-exemple.cm', fileName: 'Avis_echeance_' + rent.ref + '.pdf', receivedAt: U.addDays(today, -2) + 'T10:05:00.000Z', confidence: 93, extracted: { supplier: 'SCI Akwa Business Center', niu: 'M030500011223A', invoiceNo: rent.ref, date: rent.date, due: U.addDays(rent.date, 30), ht: Math.round(Y.entryTotals(rent).credit / 1.1925), tva: Y.entryTotals(rent).credit - Math.round(Y.entryTotals(rent).credit / 1.1925), ttc: Y.entryTotals(rent).credit, label: 'Loyer des bureaux', account: 'CM21 10005 00001 12345678901 23' } });
  F.receive(S, cid, { source: 'email', from: 'factures@douala-informatique-services-exemple.com', fileName: 'FACTURE_URGENTE_DIS-2026-1203.pdf', receivedAt: today + 'T06:47:00.000Z', confidence: 91, extracted: { supplier: 'Douala Informatiques Services', niu: '', invoiceNo: 'DIS-2026-1203', date: '2026-10-20', due: '2026-10-22', ht: 3900000, tva: 750750, ttc: 4650750, label: 'Renouvellement licences et pare-feu', account: 'CM21 99990 00000 12121212121 99', momo: '+237 6 00 11 22 33' } });
  F.receive(S, cid, { source: 'depot', from: 'G. Tabi (chauffeur)', fileName: 'ticket-carburant-1810.jpg', receivedAt: U.addDays(today, -3) + 'T16:00:00.000Z', confidence: 58, extracted: { supplier: 'Station-service Bonapriso', invoiceNo: '', date: '2026-10-18', ht: 61000, tva: 0, ttc: 61000, label: 'Gazole véhicule de service' } });
  // encaissements : liens, transactions, confirmations
  function doc(num) { return Y.doc(S, cid, num); }
  function sendAt(num, at, channels) { var x = doc(num); var r = F.send(S, cid, x.id, channels || ['whatsapp', 'email']); var m = F.meta(S, cid, x.id); m.sent.forEach(function (s) { s.at = at; }); m.events[m.events.length - 1].at = at; r.link.createdAt = at; return r.link; }
  as(S, 'u2', 'A. Mbarga', 'accountant');
  ['FA-2026-0062', 'FA-2026-0063', 'FA-2026-0064', 'FA-2026-0065', 'FA-2026-0066', 'FA-2026-0067', 'FA-2026-0058', 'FA-2026-0060', 'FA-2026-0059'].forEach(function (n, i) { var x = doc(n); if (x) sendAt(n, x.date + 'T09:' + U.pad(10 + i, 2) + ':00.000Z'); });
  var l65 = F.linkFor(S, cid, doc('FA-2026-0065').id); F.view(S, cid, l65.token, '2026-10-12T08:31:00.000Z');
  var t65 = F.initiate(S, cid, l65.token, { method: 'om', phone: '+237 6 00 00 06 62', at: '2026-10-12T08:33:00.000Z' }); var cb = { providerRef: t65.providerRef, amount: t65.amount, status: 'SUCCESSFUL', at: '2026-10-12T08:34:10.000Z' }; cb.signature = F.sign(S, cid, 'orange', cb); F.callback(S, cid, 'orange', cb);
  var l66 = F.linkFor(S, cid, doc('FA-2026-0066').id); F.view(S, cid, l66.token, today + 'T09:58:00.000Z'); F.initiate(S, cid, l66.token, { method: 'momo', phone: '+237 6 77 00 00 01', amount: 3000000, at: today + 'T10:02:00.000Z' });
  var l64 = F.linkFor(S, cid, doc('FA-2026-0064').id); F.view(S, cid, l64.token, '2026-10-19T17:12:00.000Z'); var t64 = F.initiate(S, cid, l64.token, { method: 'momo', phone: '+237 6 78 00 00 05', at: '2026-10-19T17:13:00.000Z' }); var cf = { providerRef: t64.providerRef, amount: t64.amount, status: 'FAILED', reason: 'Solde insuffisant', at: '2026-10-19T17:15:00.000Z' }; cf.signature = F.sign(S, cid, 'mtn', cf); F.callback(S, cid, 'mtn', cf);
  try { F.callback(S, cid, 'mtn', { providerRef: t64.providerRef, amount: t64.amount, status: 'SUCCESSFUL', signature: 'faux', at: '2026-10-19T19:02:00.000Z' }); } catch (e) { /* notification falsifiée rejetée */ }
  var l63 = F.linkFor(S, cid, doc('FA-2026-0063').id); F.view(S, cid, l63.token, '2026-10-21T07:45:00.000Z');
  // justificatifs déclarés
  F.declareProof(S, cid, { docId: doc('FA-2026-0060').id, method: 'om', ref: 'PP261020.1430.A56789', amount: 4650750, date: '2026-10-20', payer: '+237 6 77 00 00 01', payee: 'YIEL GROUP HOLDING', source: 'WhatsApp (capture d’écran)', file: 'Screenshot_20261020-143212.jpg', at: '2026-10-20T14:35:00.000Z' });
  F.declareProof(S, cid, { docId: doc('FA-2026-0058').id, method: 'momo', ref: '12345', amount: 4531500, date: '2026-10-21', payer: '+237 6 00 99 88 77', payee: 'Yiel Group', source: 'SMS transféré', text: 'Moble Money: Vous avez recu 4531500 FCFA de MBANGA EXPRESS. Ref 12345. Transfert par erreur ? Pour confirmer renvoyez les frais de deblocage au 6 00 99 88 77 dans les 30 min.', at: today + 'T08:05:00.000Z' });
  F.declareProof(S, cid, { docId: doc('FA-2026-0038').id, method: 'bank', ref: 'VIR 4471', amount: 62000, date: '2026-10-20', payer: 'Groupe scolaire Les Palmiers', payee: 'Yiel Group Holding SA', source: 'E-mail (avis de virement)', file: 'avis-virement-4471.pdf', at: '2026-10-20T16:20:00.000Z' });
  // relances et promesses
  as(S, 'u2', 'A. Mbarga', 'accountant');
  [['FA-2026-0046', '2026-08-13', 'email'], ['FA-2026-0046', '2026-08-19', 'whatsapp'], ['FA-2026-0046', '2026-08-27', 'appel'], ['FA-2026-0013', '2026-03-06', 'email'], ['FA-2026-0013', '2026-03-12', 'whatsapp'], ['FA-2026-0013', '2026-03-20', 'appel'], ['FA-2026-0013', '2026-04-04', 'courrier'], ['FA-2026-0060', '2026-10-15', 'email'], ['FA-2026-0058', '2026-10-07', 'email'], ['FA-2026-0058', '2026-10-13', 'whatsapp']].forEach(function (r) { var x = doc(r[0]); x.reminders = (x.reminders || []).filter(function (y) { return y.channel; }); x.reminders.push({ date: r[1], channel: r[2], label: { email: 'Échéance dépassée', whatsapp: 'Relance avec lien de paiement', appel: 'Appel du responsable de compte', courrier: 'Mise en demeure' }[r[2]], by: 'A. Mbarga', text: '' }); });
  var p1 = F.promise(S, cid, doc('FA-2026-0046').id, { date: U.addDays(today, 4), amount: 2000000, contact: 'M. MBANGA Joël (appel)', channel: 'appel' }); p1.at = U.addDays(today, -2) + 'T11:00:00.000Z';
  var savedToday = S.meta.today; S.meta.today = '2026-10-01';
  var p2 = F.promise(S, cid, doc('FA-2026-0013').id, { date: '2026-10-10', amount: 3577500, contact: 'Me NGONO Albert', channel: 'appel' }); p2.at = '2026-10-01T10:00:00.000Z';
  S.meta.today = savedToday; F.refreshPromises(S, cid);
  // paiements fournisseurs : propositions
  as(S, 'u2', 'A. Mbarga', 'accountant');
  var pay = F.payables(S, cid);
  function prop(code, ref) { var it = pay.filter(function (x) { return x.tiersId === Y.tiers(S, cid, code).id && (!ref || x.ref === ref); }); if (!it.length) return null; return F.propose(S, cid, { tiersId: Y.tiers(S, cid, code).id, items: it.map(function (x) { return x.id; }), at: today + 'T09:00:00.000Z' }); }
  var a = prop('F0009', 'BPA-2026-298'); if (a) { as(S, 'u7', 'DAF · P. Tchoumi', 'cfo'); F.approve(S, cid, a.id, 'approuver', ''); F.execute(S, cid, a.id, { date: '2026-10-20' }); a.at = '2026-10-19T09:00:00.000Z'; }
  as(S, 'u2', 'A. Mbarga', 'accountant');
  prop('F0002', 'DIS-2026-1187'); prop('F0010'); prop('F0012'); prop('F0011');
  // relevés : frais d'opérateur, paiement fractionné, encaissement groupé, référence imparfaite
  var bk = function (acc) { return d.bankAccounts.find(function (b) { return b.account === acc; }).id; };
  Y.importStatement(S, cid, bk('5521'), [{ date: '2026-10-21', amount: 826403, label: 'MOMO P2P RECU CLINIQUE BONAMOUSSADI', ref: '7712093456' }]);
  Y.importStatement(S, cid, bk('5522'), [{ date: '2026-10-18', amount: 1000000, label: 'OM RECU MBANGA EXPRESS ACOMPTE', ref: 'CI261018.0912.B10442' }, { date: '2026-10-21', amount: 818562, label: 'OM RECU MBANGA EXPRESS SOLDE', ref: 'CI261021.0815.B22871' }]);
  Y.importStatement(S, cid, bk('5211'), [{ date: '2026-10-20', amount: 6916500, label: 'VIR CABINET NGONO ET ASSOCIES REGLEMENT FACTURES', ref: 'VIR 88213' }, { date: '2026-10-21', amount: 6499125, label: 'VRT CLINQUE BNMSSDI F0063', ref: 'VIR 4521' }]);
  fd.security.unshift({ type: 'signature', text: 'Notification de paiement falsifiée rejetée (signature invalide) sur la facture FA-2026-0064', at: '2026-10-19T19:02:00.000Z', by: 'Passerelle mtn' });
}

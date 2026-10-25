/* myyiel Paie · jeu de démonstration : établissements, conventions, salariés, historique de paie janvier → septembre 2026, octobre en préparation. */
import { Y } from './registry.js';

var U = Y.util, P = Y.Paie;

var HOLDING = [
  // matricule, civ, nom, prénoms, sexe, naissance, poste, service, site, conv, cat, contrat, embauche, sb, fixes, mode, section, extra
  ['YG0001', 'M.', 'Tchoumi', 'Paul-Henri', 'M', '1979-05-14', 'Directeur administratif et financier', 'Direction financière', 'DLA', 'CC-COM', '12', 'CDI', '2019-02-01', 1450000, { IND_LOG: 300000, IND_TRANSP: 50000, AN_VEH: 1 }, 'virement', 'STR', { enfants: 3, situation: 'Marié(e)' }],
  ['YG0002', 'Mme', 'Fouda', 'Estelle', 'F', '1982-11-02', 'Directrice des ressources humaines', 'Ressources humaines', 'DLA', 'CC-COM', '12', 'CDI', '2020-01-06', 1250000, { IND_LOG: 250000, IND_TRANSP: 50000 }, 'virement', 'STR', { enfants: 2, situation: 'Mariée' }],
  ['YG0003', 'Mme', 'Ngono', 'Brigitte', 'F', '1991-03-23', 'Gestionnaire de paie', 'Ressources humaines', 'DLA', 'CC-COM', '6', 'CDI', '2021-04-12', 280000, { IND_TRANSP: 25000, MUTUELLE: 8000 }, 'virement', 'STR', { enfants: 1 }],
  ['YG0004', 'M.', 'Mbarga', 'Alain', 'M', '1986-07-08', 'Comptable', 'Direction financière', 'DLA', 'CC-COM', '6', 'CDI', '2018-09-03', 420000, { IND_TRANSP: 30000, PRIME_RESP: 40000, SYND: 3000 }, 'virement', 'STR', { enfants: 2, situation: 'Marié(e)' }],
  ['YG0005', 'M.', 'Essomba', 'Jean-Paul', 'M', '1990-04-15', 'Consultant senior', 'Conseil', 'DLA', 'CC-COM', '8', 'CDI', '2021-03-01', 850000, { IND_LOG: 120000, IND_TRANSP: 40000 }, 'virement', 'CNS', { enfants: 2, situation: 'Marié(e)' }],
  ['YG0006', 'Mme', 'Atangana', 'Clarisse', 'F', '1993-01-30', 'Consultante', 'Conseil', 'YDE', 'CC-COM', '8', 'CDI', '2022-07-18', 620000, { IND_TRANSP: 35000 }, 'virement', 'CNS', {}],
  ['YG0007', 'M.', 'Kamga', 'Hervé', 'M', '1997-08-19', 'Consultant junior', 'Conseil', 'YDE', 'CC-COM', '6', 'CDI', '2024-10-01', 380000, { IND_TRANSP: 30000 }, 'momo', 'CNS', { operateur: 'MTN', momo: '+237 677 10 20 07' }],
  ['YG0008', 'Mme', 'Bella', 'Nadège', 'F', '1995-12-05', 'Chargée de mission', 'Conseil', 'DLA', 'CC-COM', '6', 'CDI', '2023-05-02', 330000, { IND_TRANSP: 25000 }, 'virement', 'CNS', {}],
  ['YG0009', 'M.', 'Nana', 'Rodrigue', 'M', '1984-02-11', 'Directeur technique', 'Produit', 'DLA', 'CC-NUM', '5', 'CDI', '2020-11-02', 1300000, { IND_LOG: 250000, IND_TRANSP: 50000, AN_VEH: 1 }, 'virement', 'LOG', { enfants: 3, situation: 'Marié(e)' }],
  ['YG0010', 'M.', 'Fotso', 'Brice', 'M', '1992-06-27', 'Lead développeur', 'Produit', 'DLA', 'CC-NUM', '4', 'CDI', '2021-08-16', 820000, { IND_TRANSP: 40000 }, 'virement', 'LOG', { enfants: 1 }],
  ['YG0011', 'Mme', 'Njoya', 'Aïcha', 'F', '1997-09-02', 'Développeuse', 'Produit', 'YDE', 'CC-NUM', '3', 'CDI', '2023-02-01', 480000, { IND_TRANSP: 30000 }, 'momo', 'LOG', { operateur: 'Orange', momo: '+237 690 20 30 11' }],
  ['YG0012', 'M.', 'Abena', 'Steve', 'M', '1999-10-21', 'Développeur', 'Produit', 'DLA', 'CC-NUM', '2', 'CDD', '2025-11-17', 300000, { IND_TRANSP: 25000 }, 'momo', 'LOG', { operateur: 'MTN', momo: '+237 678 30 40 12', finContrat: '2026-11-15' }],
  ['YG0013', 'Mme', 'Ekani', 'Prisca', 'F', '1994-03-14', 'Designer UX', 'Produit', 'DLA', 'CC-NUM', '3', 'CDI', '2022-03-14', 450000, { IND_TRANSP: 30000 }, 'virement', 'LOG', {}],
  ['YG0014', 'M.', 'Moussa', 'Ibrahim', 'M', '1998-05-09', 'Technicien support', 'Produit', 'YDE', 'CC-NUM', '1', 'CDI', '2024-06-03', 160000, { IND_TRANSP: 20000 }, 'momo', 'LOG', { operateur: 'MTN', momo: '+237 679 40 50 14' }],
  ['YG0015', 'Mme', 'Ondoua', 'Linda', 'F', '1988-08-01', 'Assistante de direction', 'Direction générale', 'DLA', 'CC-COM', '4', 'CDI', '2019-06-10', 210000, { IND_TRANSP: 20000 }, 'virement', 'STR', { enfants: 2 }],
  ['YG0016', 'M.', 'Tabi', 'Gaston', 'M', '1976-12-12', 'Chauffeur', 'Moyens généraux', 'DLA', 'CC-COM', '2', 'CDI', '2017-03-01', 95000, { IND_TRANSP: 15000, SYND: 1500 }, 'momo', 'STR', { operateur: 'MTN', momo: '+237 677 50 60 16', enfants: 4, situation: 'Marié(e)' }],
  ['YG0017', 'Mme', 'Manga', 'Sandrine', 'F', '1989-04-22', 'Responsable commerciale', 'Commercial', 'DLA', 'CC-COM', '8', 'CDI', '2022-01-10', 700000, { IND_TRANSP: 40000, PRIME_RESP: 50000 }, 'virement', 'CNS', { enfants: 1 }],
  ['YG0018', 'M.', 'Ndongo', 'Patrick', 'M', '1983-09-17', 'Agent d’entretien', 'Moyens généraux', 'DLA', 'CC-COM', '1', 'CDI', '2021-09-01', 52000, { IND_TRANSP: 10000 }, 'especes', 'STR', { enfants: 3 }]
];
var DEYGO = [
  ['DG0001', 'M.', 'Eyenga', 'Thierry', 'M', '1987-01-19', 'Responsable d’exploitation', 'Exploitation', 'DLA', 'CC-TRANS', '7', 'CDI', '2024-03-01', 420000, { IND_TRANSP: 30000 }, 'virement', 'DGO', {}],
  ['DG0002', 'M.', 'Onana', 'Félix', 'M', '1995-06-30', 'Chauffeur-livreur', 'Exploitation', 'DLA', 'CC-TRANS', '3', 'CDI', '2024-05-02', 110000, { IND_TRANSP: 15000 }, 'momo', 'DGO', { operateur: 'MTN', momo: '+237 670 11 22 02' }],
  ['DG0003', 'M.', 'Biya', 'Serge', 'M', '1998-02-14', 'Coursier', 'Exploitation', 'DLA', 'CC-TRANS', '1', 'CDD', '2026-01-05', 60000, { IND_TRANSP: 10000 }, 'momo', 'DGO', { operateur: 'Orange', momo: '+237 691 22 33 03', finContrat: '2026-12-31' }],
  ['DG0004', 'Mme', 'Mballa', 'Rose', 'F', '1996-11-11', 'Chargée de clientèle', 'Commercial', 'DLA', 'CC-TRANS', '3', 'CDI', '2024-09-16', 150000, { IND_TRANSP: 15000 }, 'momo', 'DGO', { operateur: 'MTN', momo: '+237 671 33 44 04' }],
  ['DG0005', 'M.', 'Talla', 'Junior', 'M', '2000-07-07', 'Coursier', 'Exploitation', 'DLA', 'CC-TRANS', '1', 'CDI', '2025-02-03', 55000, { IND_TRANSP: 10000 }, 'especes', 'DGO', {}]
];
function rib(i) { return { banque: '[BANQUE]', codeBanque: '1000' + (i % 3), guichet: '0000' + (1 + i % 4), compte: '0' + String(31004500000 + i * 7919).slice(0, 10), cle: String(10 + (i * 7) % 89).padStart(2, '0'), agence: i % 2 ? 'Akwa' : 'Bonapriso' }; }

function payPrev(S, cid, key, today) {
  var d = P.D(S, cid), prevKey = P.prevKey(key), pp = d.periods[prevKey];
  if (pp && P.isFrozen(pp) && key + '-15' <= today) ['CNPS', 'DGI', 'COMMUNE'].forEach(function (c) { var dc = P.declarations(S, cid, prevKey).find(function (x) { return x.code === c; }); if (!dc || !dc.total || (pp.decl[c] && pp.decl[c].status === 'payee')) return; S.meta.currentUser = { id: 'u7', name: 'DAF · P. Tchoumi', role: 'cfo' }; P.declAction(S, cid, prevKey, c, 'teletransmettre'); P.declAction(S, cid, prevKey, c, 'payer', { date: key + '-15' }); });
}
P.seedCompany = function (S, cid, profile, today) {
  var d = P.D(S, cid), list = profile === 'deygo' ? DEYGO : HOLDING;
  P._bypass = true;
  try {
    d.establishments = profile === 'deygo'
      ? [{ code: 'DLA', label: 'DeyGo · Douala (Bonamoussadi)', city: 'Douala', address: '[ADRESSE]', cnpsEmployer: '[N° EMPLOYEUR CNPS]', taxCenter: '[CENTRE DES IMPÔTS]', commune: 'Douala 5e', atGroup: 'B', manager: 'Gestionnaire DeyGo' }]
      : [{ code: 'DLA', label: 'Siège · Douala (Bonapriso)', city: 'Douala', address: '[ADRESSE DU SIÈGE]', cnpsEmployer: '[N° EMPLOYEUR CNPS DLA]', taxCenter: '[CENTRE DES IMPÔTS]', commune: 'Douala 1er', atGroup: 'A', manager: 'Direction générale' },
         { code: 'YDE', label: 'Agence · Yaoundé (Bastos)', city: 'Yaoundé', address: '[ADRESSE DE L’AGENCE]', cnpsEmployer: '[N° EMPLOYEUR CNPS YDE]', taxCenter: '[CENTRE DES IMPÔTS]', commune: 'Yaoundé 1er', atGroup: 'A', manager: 'Responsable d’agence' }];
    d.advisors = [{ id: 'adv1', bank: '[BANQUE PRINCIPALE]', agence: 'Agence entreprises · Akwa', nom: '[Nom du conseiller]', email: 'conseiller.entreprises@exemple.cm', telephone: '+237 6XX XX XX XX', compteDebite: '5211', note: 'Destinataire des ordres de virement des salaires' }];
    list.forEach(function (r, i) {
      var e = Object.assign({ matricule: r[0], civilite: r[1], nom: r[2], prenoms: r[3], sexe: r[4], naissance: r[5], lieuNaissance: ['Douala', 'Yaoundé', 'Bafoussam', 'Garoua', 'Ebolowa', 'Bamenda'][i % 6], nationalite: 'Camerounaise', poste: r[6], service: r[7], site: r[8], convention: r[9], categorie: r[10], echelon: 'A', contrat: r[11], embauche: r[12], sb: r[13], modePaiement: r[15], section: r[16],
        niu: i % 5 === 3 ? '' : 'P0' + String(1234567890123 + i * 104729).slice(0, 11) + 'A', cnps: (profile === 'deygo' ? '2' : '1') + String(10203040 + i * 9173).slice(0, 7) + '-' + String.fromCharCode(65 + i % 20),
        cni: 'CE' + String(10203040 + i * 3571).slice(0, 7), telephone: '+237 6' + String(77000000 + i * 131071).slice(0, 8).replace(/(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4'), email: (r[3].split(/[- ]/)[0] + '.' + r[2]).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z.]/g, '') + (profile === 'deygo' ? '@deygo.cm' : '@yielgroup.com'),
        ville: r[8] === 'YDE' ? 'Yaoundé' : 'Douala', adresse: r[8] === 'YDE' ? 'Bastos' : ['Bonapriso', 'Akwa', 'Bonamoussadi', 'Makepe', 'Kotto'][i % 5], situation: 'Célibataire', enfants: 0, essaiFin: U.addMonths(r[12], 3), horaire: 0 }, r[15] === 'virement' ? rib(i) : {}, r[17]);
      e.whatsapp = e.telephone; e.urgence = 'Famille · +237 699 ' + String(100000 + i * 7777).slice(0, 6).replace(/(\d{2})(\d{2})(\d{2})/, '$1 $2 $3');
      var rec = P.saveEmployee(S, cid, e, { source: 'reprise initiale' });
      rec.fixes = r[14];
      var anc = Math.max(0, U.daysBetween(rec.embauche, '2025-12-31') / 30.4);
      rec.conges.solde = Math.min(30, Math.round(((anc % 12) * 1.5 + 6) * 10) / 10);
    });
    d.seq.emp = list.length;
  } finally { P._bypass = false; }
};

/** Rejoue la paie d'un mois passé de bout en bout (préparation → validation DRH → signature → virement → clôture) et paie les déclarations du mois précédent. */
P.seedMonth = function (S, cid, y, m, today) {
  var d = P.D(S, cid), key = y + '-' + U.pad(m, 2), b = P.periodBounds(key), prevKey = P.prevKey(key);
  P._bypass = true;
  var saveUser = S.meta.currentUser;
  try {
    payPrev(S, cid, key, today);
    var p = P.period(S, cid, key, true);
    var emps = P.activeEmployees(S, cid, key), seedN = function (i, k) { return ((i + 3) * (m + 7) * (k + 11)) % 97; };
    S.meta.currentUser = { id: 'u5', name: 'Gestionnaire paie · B. Ngono', role: 'payroll' };
    emps.forEach(function (e, i) {
      var n = seedN(i, 1);
      if (/Produit/.test(e.service) && n % 3 === 0) P.addVar(S, cid, key, e.id, { code: 'HS1', qty: 4 + n % 5, source: 'GTA' });
      if (/Produit/.test(e.service) && n % 7 === 0) P.addVar(S, cid, key, e.id, { code: 'HS2', qty: 2 + n % 4, source: 'GTA' });
      if (/Moyens/.test(e.service) && n % 2 === 0) P.addVar(S, cid, key, e.id, { code: 'HSN', qty: 3 + n % 6, source: 'GTA' });
      if (/Conseil|Commercial/.test(e.service) && m % 3 === 0) P.addVar(S, cid, key, e.id, { code: 'PRIME_REND', amount: Math.round(e.sb * (0.08 + (n % 5) / 100) / 1000) * 1000, source: 'saisie', note: 'Objectifs trimestriels' });
      if (n === 13 || n === 41) P.addVar(S, cid, key, e.id, { code: 'ABS_NP', qty: 1 + n % 2, source: 'GTA' });
      if (m === 8 && i % 3 === 0) P.addVar(S, cid, key, e.id, { code: 'CONGE', qty: 12, source: 'GTA', note: 'Congés annuels' });
    });
    if (m === 5) { var t = emps.find(function (e) { return e.matricule === 'YG0016' || e.matricule === 'DG0002'; }); if (t) { var adv = P.requestAdvance(S, cid, { empId: t.id, amount: 30000, date: key + '-08', reason: 'Frais de scolarité' }); S.meta.currentUser = { id: 'u6', name: 'DRH · E. Fouda', role: 'hr' }; P.advanceAction(S, cid, adv.id, 'approuver'); S.meta.currentUser = { id: 'u5', name: 'Gestionnaire paie · B. Ngono', role: 'payroll' }; P.advanceAction(S, cid, adv.id, 'verser', { date: key + '-09' }); } }
    if (m === 3) { var l = emps.find(function (e) { return e.matricule === 'YG0004'; }); if (l) { S.meta.currentUser = { id: 'u6', name: 'DRH · E. Fouda', role: 'hr' }; P.createLoan(S, cid, { empId: l.id, amount: 600000, monthly: 50000, start: key, reason: 'Prêt équipement' }); } }
    S.meta.currentUser = { id: 'u5', name: 'Gestionnaire paie · B. Ngono', role: 'payroll' };
    P.calculate(S, cid, key, { system: true });
    if (p.status !== 'controlee') { p.status = 'controlee'; }
    P.submit(S, cid, key, 'Paie conforme aux contrôles');
    S.meta.currentUser = { id: 'u6', name: 'DRH · E. Fouda', role: 'hr' };
    P.approve(S, cid, key, 'Bon pour paiement', { system: true });
    Object.keys(p.slips).forEach(function (id) { var s = p.slips[id]; s.signed = { by: 'DRH · E. Fouda', at: key + '-26T17:30:00.000Z', sigId: 'historique', hash: U.fnv(s.hash + '|historique|' + key) }; });
    if (d.advisors.length) {
      S.meta.currentUser = { id: 'u5', name: 'Gestionnaire paie · B. Ngono', role: 'payroll' };
      var o = P.createOrder(S, cid, { key: key, advisorId: d.advisors[0].id, executionDate: key + '-28', confidentiality: 'matricule' });
      P.orderAction(S, cid, o.id, 'soumettre');
      S.meta.currentUser = { id: 'u6', name: 'DRH · E. Fouda', role: 'hr' }; P.orderAction(S, cid, o.id, 'valider');
      S.meta.currentUser = { id: 'u5', name: 'Gestionnaire paie · B. Ngono', role: 'payroll' }; P.orderAction(S, cid, o.id, 'envoyer');
      P.orderAction(S, cid, o.id, 'executer', { date: key + '-28', bankRef: 'BK' + key.replace('-', '') });
    }
    S.meta.currentUser = { id: 'u7', name: 'DAF · P. Tchoumi', role: 'cfo' };
    P.close(S, cid, key, 'Écritures vérifiées');
  } finally { P._bypass = false; S.meta.currentUser = saveUser; }
};

/** Octobre (mois courant) : variables saisies, pointages GTA, une avance en attente, une entrée en cours de mois, calcul lancé. */
P.seedCurrent = function (S, cid, key, profile) {
  var d = P.D(S, cid), saveUser = S.meta.currentUser;
  P._bypass = true;
  try {
    payPrev(S, cid, key, S.meta.today);
    S.meta.currentUser = { id: 'u5', name: 'Gestionnaire paie · B. Ngono', role: 'payroll' };
    if (profile !== 'deygo') {
      P.saveEmployee(S, cid, { matricule: 'YG0019', civilite: 'Mme', nom: 'Nguema', prenoms: 'Vanessa', sexe: 'F', naissance: '1999-02-18', lieuNaissance: 'Kribi', nationalite: 'Camerounaise', poste: 'Consultante junior', service: 'Conseil', site: 'DLA', convention: 'CC-COM', categorie: '6', echelon: 'A', contrat: 'CDD', embauche: key + '-12', finContrat: '2027-10-11', essaiFin: '2027-01-11', sb: 350000, modePaiement: 'momo', operateur: 'Orange', momo: '+237 694 55 66 19', section: 'CNS', telephone: '+237 694 55 66 19', email: 'vanessa.nguema@yielgroup.com', ville: 'Douala', adresse: 'Logpom', cnps: '' }, { source: 'saisie' }).fixes = { IND_TRANSP: 25000 };
      var p = P.period(S, cid, key, true);
      P.importTimeEvents(S, cid, key, [
        { matricule: 'YG0010', date: key + '-07', type: 'HS1', quantite: 4 }, { matricule: 'YG0010', date: key + '-14', type: 'HS1', quantite: 4 }, { matricule: 'YG0010', date: key + '-15', type: 'HS2', quantite: 3 },
        { matricule: 'YG0011', date: key + '-09', type: 'HS1', quantite: 6 }, { matricule: 'YG0016', date: key + '-04', type: 'HSN', quantite: 8 }, { matricule: 'YG0016', date: key + '-11', type: 'HSN', quantite: 6 },
        { matricule: 'YG0008', date: key + '-16', type: 'ABS_NP', quantite: 1 }, { matricule: 'YG0013', date: key + '-20', type: 'ABS_MAL', quantite: 2 }, { matricule: 'YG0006', date: key + '-06', type: 'CONGE', quantite: 5 }
      ], { source: 'GTA' });
      P.addVar(S, cid, key, P.emp(S, cid, 'YG0005').id, { code: 'PRIME_REND', amount: 120000, source: 'saisie', note: 'Mission Port autonome · objectif atteint' });
      P.addVar(S, cid, key, P.emp(S, cid, 'YG0017').id, { code: 'PRIME_REND', amount: 95000, source: 'saisie', note: 'Commissions T3' });
      var a1 = P.requestAdvance(S, cid, { empId: P.emp(S, cid, 'YG0014').id, amount: 50000, date: key + '-06', reason: 'Rentrée scolaire' });
      S.meta.currentUser = { id: 'u6', name: 'DRH · E. Fouda', role: 'hr' }; P.advanceAction(S, cid, a1.id, 'approuver');
      S.meta.currentUser = { id: 'u5', name: 'Gestionnaire paie · B. Ngono', role: 'payroll' }; P.advanceAction(S, cid, a1.id, 'verser', { date: key + '-07' });
      P.requestAdvance(S, cid, { empId: P.emp(S, cid, 'YG0008').id, amount: 80000, date: key + '-14', reason: 'Frais médicaux' });
      P.requestAdvance(S, cid, { empId: P.emp(S, cid, 'YG0007').id, amount: 60000, date: key + '-20', reason: 'Loyer' });
      P.calculate(S, cid, key, { system: true });
    } else {
      P.period(S, cid, key, true);
      P.addVar(S, cid, key, d.employees[1].id, { code: 'HSN', qty: 10, source: 'saisie', note: 'Livraisons du dimanche' });
    }
  } finally { P._bypass = false; S.meta.currentUser = saveUser; }
};

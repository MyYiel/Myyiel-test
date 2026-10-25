/*
 * myyiel Comptabilité · coquille de l'application : navigation, barre supérieure, routage,
 * délégation d'évènements, palette de commandes, mode simulation, changement de société et d'utilisateur.
 */
(function () {
  'use strict';
  var Y = window.Yiel, U = Y.util, App = window.App, esc = App.esc;

  /* Navigation : sections → modules (accordéon) → sous-onglets [page, onglet, libellé, droit]. */
  App.NAV2 = [
    ['Finance', [
      { k: 'dashboard', label: 'Tableau de bord', icon: 'dashboard', page: 'dashboard', right: 'read' },
      { k: 'compta', label: 'Comptabilité', icon: 'saisie', right: 'read', items: [['saisie', 'new', 'Nouvelle écriture'], ['saisie', 'drafts', 'Brouillons'], ['saisie', 'list', 'Écritures validées'], ['saisie', 'tpl', 'Modèles & abonnements'], ['plan', 'comptes', 'Plan comptable'], ['plan', 'taxes', 'Codes de taxe']] },
      { k: 'ventes', label: 'Ventes', icon: 'ventes', right: 'read', items: [['ventes', 'factures', 'Factures'], ['ventes', 'devis', 'Devis'], ['ventes', 'avoirs', 'Avoirs'], ['ventes', 'encaissements', 'Encaissements'], ['ventes', 'relances', 'Relances'], ['ventes', 'articles', 'Catalogue & tarifs'], ['plan', 'tiers', 'Clients & fournisseurs']] },
      { k: 'achats', label: 'Achats', icon: 'achats', right: 'read', items: [['achats', 'factures', 'Suivi des factures'], ['achats', 'echeancier', 'Échéancier & règlements']] },
      { k: 'tresorerie', label: 'Trésorerie & Mobile Money', icon: 'banque', right: 'read', items: [['banque', 'comptes', 'Comptes'], ['banque', 'rappro', 'Rapprochement'], ['banque', 'etat', 'État de rapprochement'], ['banque', 'regles', 'Règles d’affectation'], ['banque', 'caisse', 'Arrêtés de caisse']] },
      { k: 'stocks', label: 'Stocks & inventaires', icon: 'stocks', right: 'read', items: [['stocks', 'articles', 'Articles & niveaux'], ['stocks', 'mouvements', 'Mouvements'], ['stocks', 'inventaires', 'Inventaires physiques'], ['stocks', 'valorisation', 'Valorisation & variation'], ['stocks', 'depots', 'Dépôts & paramètres']] },
      { k: 'immos', label: 'Immobilisations', icon: 'immos', right: 'read', items: [['immos', 'registre', 'Registre'], ['immos', 'dotations', 'Dotations'], ['immos', 'cessions', 'Cessions & rebuts'], ['immos', 'synthese', 'Tableau de synthèse']] },
      { k: 'controle', label: 'Livres & contrôle', icon: 'livres', right: 'read', items: [['livres', 'balance', 'Balance générale'], ['livres', 'gl', 'Grand livre'], ['livres', 'journaux', 'Journaux'], ['livres', 'tiers', 'Balance des tiers'], ['livres', 'agee', 'Balance âgée'], ['livres', 'lettrage', 'Lettrage'], ['analytique', 'resultat', 'Analytique']] },
      { k: 'etats', label: 'États & fiscalité', icon: 'etats', right: 'read', items: [['etats', 'bilan', 'Bilan'], ['etats', 'cr', 'Compte de résultat'], ['etats', 'tft', 'Flux de trésorerie'], ['etats', 'notes', 'Notes annexes'], ['etats', 'dsf', 'DSF & liasse'], ['fiscalite', 'tva', 'TVA'], ['fiscalite', 'echeancier', 'Échéancier fiscal'], ['fiscalite', 'is', 'Impôt sur les sociétés'], ['fiscalite', 'fec', 'FEC']] },
      { k: 'cloture', label: 'Clôture & à-nouveaux', icon: 'cloture', page: 'cloture', right: 'read' }
    ]],
    ['Trésorerie, facturation & paiements', [
      { k: 'm4pilot', label: 'Pilotage de trésorerie', icon: 'tresor', right: 'fin.read', items: [['tresor', 'pilotage', 'Vue d’ensemble'], ['tresor', 'prevision', 'Prévision 13 semaines'], ['tresor', 'comptes', 'Comptes & Mobile Money']] },
      { k: 'm4factu', label: 'Facturation électronique', icon: 'fin-factu', right: 'fin.read', items: [['fin-factu', 'cycle', 'Factures & cycle de vie'], ['fin-factu', 'modeles', 'Modèles de facture'], ['fin-factu', 'conformite', 'Mentions & conformité']] },
      { k: 'm4enc', label: 'Encaissements & relances', icon: 'fin-encaiss', right: 'fin.read', items: [['fin-encaiss', 'transactions', 'Paiements en ligne'], ['fin-encaiss', 'liens', 'Liens de paiement'], ['fin-encaiss', 'justificatifs', 'Justificatifs déclarés'], ['fin-encaiss', 'verifier', 'Vérifier un justificatif'], ['fin-relances', 'plan', 'Relances du jour'], ['fin-relances', 'promesses', 'Promesses de paiement'], ['fin-relances', 'historique', 'Historique des relances']] },
      { k: 'm4dep', label: 'Dépenses & paiements', icon: 'fin-pay', right: 'fin.read', items: [['fin-inbox', 'a_traiter', 'Boîte de réception'], ['fin-inbox', 'tous', 'Factures reçues'], ['fin-pay', 'echeancier', 'Échéancier fournisseurs'], ['fin-pay', 'propositions', 'Paiements à approuver'], ['fin-pay', 'salaires', 'Salaires & charges']] },
      { k: 'm4tiers', label: 'Clients & fournisseurs', icon: 'fin-tiers', right: 'fin.read', items: [['fin-tiers', 'fournisseur', 'Répertoire fournisseurs'], ['fin-tiers', 'client', 'Répertoire clients'], ['fin-tiers', 'import', 'Import & export']] },
      { k: 'm4rappro', label: 'Rapprochement intelligent', icon: 'fin-rappro', page: 'fin-rappro', right: 'fin.read' },
      { k: 'm4fraude', label: 'Anti-fraude', icon: 'fin-fraude', right: 'fin.read', items: [['fin-fraude', 'alertes', 'Vue d’ensemble'], ['fin-fraude', 'coordonnees', 'Coordonnées en quarantaine'], ['fin-fraude', 'vigilance', 'Liste de vigilance'], ['fin-fraude', 'verifier', 'Vérifier un numéro / RIB'], ['fin-fraude', 'journal', 'Journal de sécurité']] },
      { k: 'm4param', label: 'Contrôles & paramètres', icon: 'fin-param', right: 'fin.read', items: [['fin-param', 'circuits', 'Seuils & droits'], ['fin-param', 'prestataires', 'Prestataires de paiement'], ['fin-param', 'relances', 'Scénario de relance'], ['fin-param', 'offre', 'Offre & fonctions']] }
    ]],
    ['Commercial · Yiel CRM', [
      { k: 'crmck', label: 'Cockpit commercial', icon: 'crm-cockpit', right: 'crm.read', items: [['crm-cockpit', null, 'Cockpit du PDG'], ['crm-analyse', null, 'Analyse']] },
      { k: 'crmsr', label: 'Prospection', icon: 'crm-search', right: 'crm.read', items: [['crm-search', 'recherche', 'Recherche d’entreprises'], ['crm-search', 'sauvegardes', 'Recherches enregistrées'], ['crm-search', 'listes', 'Listes de prospection']] },
      { k: 'crmdb', label: 'Entreprises & contacts', icon: 'crm-base', right: 'crm.read', items: [['crm-base', 'contacts', 'Contacts'], ['crm-base', 'entreprises', 'Entreprises'], ['crm-base', 'import', 'Import Excel / CSV'], ['crm-base', 'carte', 'Carte de visite']] },
      { k: 'crmpp', label: 'Pipeline & agenda', icon: 'crm-pipeline', right: 'crm.read', items: [['crm-pipeline', 'colonnes', 'Pipeline'], ['crm-pipeline', 'liste', 'Opportunités (liste)'], ['crm-agenda', 'semaine', 'Agenda'], ['crm-agenda', 'liste', 'Activités']] },
      { k: 'crmms', label: 'Messagerie & campagnes', icon: 'crm-campaigns', right: 'crm.read', items: [['crm-messages', 'inbox', 'Réponses reçues'], ['crm-messages', 'modeles', 'Modèles'], ['crm-messages', 'envois', 'Envois & historique'], ['crm-campaigns', 'liste', 'Studio de campagnes'], ['crm-campaigns', 'validation', 'Campagnes à valider'], ['crm-campaigns', 'moteur', 'Journal du moteur']] },
      { k: 'crmad', label: 'Contrôle & administration', icon: 'crm-admin', right: 'crm.read', items: [['crm-notifs', null, 'Notifications'], ['crm-admin', 'utilisateurs', 'Utilisateurs & rôles', 'crm.admin'], ['crm-admin', 'integrations', 'Intégrations', 'crm.admin'], ['crm-admin', 'gouvernance', 'Gouvernance'], ['crm-admin', 'securite', 'Sécurité & accès', 'crm.admin']] },
      { k: 'crmad2', label: 'Administration CRM', icon: 'crm-admin', right: 'crm.admin', only: 'crm_admin', items: [['crm-admin', 'utilisateurs', 'Utilisateurs & rôles'], ['crm-admin', 'integrations', 'Intégrations'], ['crm-admin', 'securite', 'Sécurité & accès'], ['crm-notifs', null, 'Notifications']] }
    ]],
    ['Ressources humaines', [
      { k: 'moi', label: 'Mon espace', icon: 'moi', page: 'moi', right: 'self' },
      { k: 'paie', label: 'Paie', icon: 'paie', right: 'pay.read', items: [['paie', null, 'Tableau de bord paie'], ['paie-salaries', null, 'Salariés'], ['paie-periode', null, 'Période de paie'], ['paie-bulletins', null, 'Bulletins'], ['paie-drh', null, 'Espace DRH & DAF'], ['paie-paiements', null, 'Virements'], ['paie-declarations', null, 'Déclarations'], ['paie-avances', null, 'Avances & prêts'], ['paie-param', null, 'Paramétrage paie']] },
      { k: 'gta', label: 'Temps & présence', icon: 'gta', right: 'gta.read', items: [['gta', 'vue', 'Présences du jour'], ['gta-missions', 'live', 'Missions terrain', 'gta.track'], ['gta', 'pointages', 'Pointages'], ['gta', 'controles', 'Contrôles aléatoires'], ['gta-feuilles', null, 'Feuilles de temps'], ['gta-param', 'sites', 'Sites & géozones', 'gta.manage'], ['gta-param', 'affectations', 'Horaires & appareils', 'gta.manage'], ['gta-param', 'regles', 'Règles & confidentialité', 'gta.manage']] },
      { k: 'abs', label: 'Congés & absences', icon: 'abs', right: 'abs.read', items: [['abs', 'planning', 'Planning d’équipe'], ['abs', 'demandes', 'Demandes'], ['abs', 'validations', 'Validations'], ['abs', 'soldes', 'Soldes & compteurs'], ['abs-param', 'motifs', 'Motifs d’absence', 'abs.settings'], ['abs-param', 'circuits', 'Circuits & jours fériés', 'abs.settings']] }
    ]],
    ['Administration', [
      { k: 'admin', label: 'Administration', icon: 'parametres', right: 'read', items: [['imports', 'import', 'Importer'], ['imports', 'exports', 'Centre d’export'], ['parametres', 'societe', 'Société & exercices'], ['parametres', 'users', 'Utilisateurs & droits'], ['parametres', 'integrations', 'Intégrations'], ['parametres', 'audit', 'Piste d’audit'], ['parametres', 'donnees', 'Sauvegarde & données']] }
    ]]
  ];
  // Compatibilité : liste plate [section, [[page, libellé]]] utilisée par la palette et les titres.
  App.NAV = App.NAV2.map(function (sec) { var seen = {}, list = []; sec[1].forEach(function (m) { (m.items || [[m.page, null, m.label]]).forEach(function (it) { if (!seen[it[0]]) { seen[it[0]] = 1; list.push([it[0], m.items ? (it[1] ? m.label + ' · ' + it[2] : it[2]) : m.label]); } }); }); return [sec[0], list]; });
  App.title = function (k) { var t = ''; App.NAV.forEach(function (g) { g[1].forEach(function (n) { if (n[0] === k) t = n[1]; }); }); return t; };
  /** Droit requis pour afficher une page (le plus permissif des sous-onglets qui y mènent). */
  App.pageRight = function (page) {
    var rights = [];
    App.NAV2.forEach(function (sec) { sec[1].forEach(function (m) { (m.items || [[m.page]]).forEach(function (it) { if (it[0] === page) rights.push(it[3] || m.right); }); }); });
    return rights;
  };
  App.canPage = function (page) { var r = App.pageRight(page); return !r.length || r.some(function (x) { return App.can(x); }); };
  App.firstPage = function () { var out = null; App.NAV2.forEach(function (sec) { sec[1].forEach(function (m) { if (out || !App.can(m.right)) return; out = m.page || m.items[0][0]; }); }); return out || 'moi'; };

  function badges() {
    var d = App.D(), b = {};
    try {
      b.saisie = d.entries.filter(function (e) { return e.status === 'draft'; }).length;
      b.banque = d.bankTx.filter(function (t) { return t.status === 'open'; }).length;
      b.ventes = d.docs.filter(function (x) { return x.type === 'FA' && x.status === 'emitted' && Y.docStatus(App.S, App.cid(), x).key === 'late'; }).length;
    } catch (e) { /* rien */ }
    try { var P = Y.Paie, pd = P.D(App.S, App.cid()), pk = P.openKey(App.S, App.cid()), pp = pd.periods[pk];
      b['paie-periode'] = pp ? (pp.anomalies || []).filter(function (a) { return a.level === 'bloquante'; }).length : 0;
      b['paie-drh'] = Object.keys(pd.periods).filter(function (k) { return pd.periods[k].status === 'soumise'; }).length + pd.bankOrders.filter(function (o) { return o.status === 'soumis'; }).length + Object.keys(pd.periods).reduce(function (n, k) { var x = pd.periods[k]; return n + (P.isFrozen(x) ? Object.keys(x.slips).filter(function (i) { return !x.slips[i].signed; }).length : 0); }, 0);
      b['paie-avances'] = pd.advances.filter(function (a) { return a.status === 'demandee'; }).length; } catch (e) { /* paie non initialisée */ }
    try { var A = Y.Abs, me = A.me(App.S, App.cid()), ad = A.D(App.S, App.cid());
      b['abs|validations'] = ad.requests.filter(function (r) { return ['en_attente_n1', 'en_attente_rh', 'a_notifier'].indexOf(r.status) > -1 && !A.canAct(App.S, App.cid(), r); }).length;
      var G = Y.GTA, ids = G.scope(App.S, App.cid()).map(function (e) { return e.id; });
      if (App.can('gta.validate')) b['gta|pointages'] = G.D(App.S, App.cid()).punches.filter(function (p) { return p.status === 'a_verifier' && ids.indexOf(p.empId) > -1 && (!me || me.id !== p.empId); }).length;
      if (App.can('gta.track')) b['gta-missions|live'] = G.D(App.S, App.cid()).missions.filter(function (m) { var v = G.missionView(App.S, App.cid(), m); return ['NO_DEP', 'LATE', 'ECART'].indexOf(v.code) > -1 && m.empIds.some(function (x) { return ids.indexOf(x) > -1; }); }).length;
    } catch (e) { /* modules RH absents */ }
    try { var K = Y.Stock; b['stocks|inventaires'] = K.D(App.S, App.cid()).counts.filter(function (c) { return c.status === 'a_valider'; }).length; b['stocks|articles'] = K.valuation(App.S, App.cid(), App.today()).filter(function (r) { return r.below && r.minQty > 0; }).length; } catch (e) { /* stocks absents */ }
    try { var CR = Y.CRM, cd = CR.D(App.S, App.cid());
      if (CR.canApprove(App.S, App.cid())) b['crm-campaigns|validation'] = cd.campaigns.filter(function (c) { return c.status === 'attente_pdg'; }).length;
      if (App.can('crm.read')) { b['crm-messages|inbox'] = cd.replies.filter(function (r) { var c = CR.contact(App.S, App.cid(), r.contactId); return !r.handled && ['positive', 'question'].indexOf(r.kind) > -1 && c && CR.visible(App.S, c); }).length; b['crm-agenda|liste'] = CR.list(App.S, App.cid(), 'activities').filter(function (a) { return a.status === 'a_faire' && a.at < CR.now(App.S); }).length; }
    } catch (e) { /* CRM absent ou espace non autorisé */ }
    try { var F = Y.Fin, fd = F.D(App.S, App.cid());
      if (App.can('fin.verify')) b['fin-fraude|coordonnees'] = fd.changes.filter(function (c) { return c.status === 'quarantaine'; }).length;
      if (App.can('fin.approve')) b['fin-pay|propositions'] = fd.proposals.filter(function (p) { return p.status === 'bloquee' || (p.status === 'a_approuver' && p.preparedBy.byId !== App.user().id); }).length;
      if (App.can('fin.payables')) b['fin-inbox|a_traiter'] = fd.inbox.filter(function (i) { return i.status === 'a_traiter'; }).length;
      if (App.can('fin.collect')) { b['fin-encaiss|justificatifs'] = fd.proofs.filter(function (p) { return ['suspect', 'falsifie'].indexOf(p.status) > -1; }).length; b['fin-rappro'] = Y.D(App.S, App.cid()).bankTx.filter(function (t) { return t.status === 'open'; }).length; }
    } catch (e) { /* module 4 absent */ }
    return b;
  }
  function activeItem() {
    var page = App.ui.page, tab = App.ui.tabs[page], best = null;
    App.NAV2.forEach(function (sec) { sec[1].forEach(function (m) { (m.items || [[m.page, null, m.label]]).forEach(function (it, i) { if (it[0] !== page) return; var score = it[1] && it[1] === tab ? 3 : (!it[1] ? 2 : 1); if (!best || score > best.score) best = { m: m.k, i: i, score: score }; }); }); });
    return best;
  }
  function totals() { var t = 0; Y.validated(App.S, App.cid()).forEach(function (e) { e.lines.forEach(function (l) { t += l.debit; }); }); var c = 0; Y.validated(App.S, App.cid()).forEach(function (e) { e.lines.forEach(function (l) { c += l.credit; }); }); return { d: t, c: c }; }
  /* Le rendu de la coque (barre latérale, barre supérieure) est assuré par les composants React
   * (src/components/Sidebar.tsx, Topbar.tsx) qui lisent les fonctions exposées ci-dessous. */
  App.badges = badges; App.activeItem = activeItem; App.totals = totals;

  /* ----------------------------------------------------------------- rendu */
  /** HTML de la page courante (appelé par PageHost à chaque rendu React). */
  App.pageHtml = function () {
    if (!App.canPage(App.ui.page)) App.ui.page = App.firstPage();
    var p = App._page = App.pages[App.ui.page] || App.pages.dashboard;
    try { return p.render(); } catch (e) { console.error(e); return '<div class="page"><div class="callout warn">Erreur d’affichage : ' + esc(e.message) + '</div></div>'; }
  };
  /** Après insertion du HTML dans le DOM : branchements propres à la page, compteurs animés, assistante. */
  App.pageAfter = function (root) {
    var p = App._page;
    if (p && p.after) try { p.after(); } catch (e) { console.error(e); }
    if (App._countPage !== App.ui.page) { App._countPage = App.ui.page; App.countUp(root); }
    if (App.ylDraw) App.ylDraw();
  };
  /** Demande un nouveau rendu React (synchrone : le DOM est à jour au retour de l’appel). Branché par src/lib/store.ts. */
  App.render = function () { if (App._renderHook) App._renderHook(); };
  /** Change de page (et d’onglet) ; l’URL est mise à jour par App.navigate (branché par le routeur Next). */
  App.go = function (page, tab) {
    App.ui.page = page; App.ui.navMobile = false; if (tab) App.ui.tabs[page] = tab;
    App.closeDrawer(true); App.persist();
    if (App.navigate) App.navigate(page, tab);
    App.render(); window.scrollTo(0, 0);
  };


  /* -------------------------------------------------------- actions communes */
  var A = App.actions;
  A.go = function (el) { if (el.closest && el.closest('.rail')) App.ui.navMobile = false; App.go(el.dataset.page, el.dataset.tab); };
  A['nav-toggle'] = function (el) { var k = el.dataset.k, o = App.ui.navOpen = App.ui.navOpen || {}; var cur = el.getAttribute('aria-expanded') === 'true'; o[k] = !cur; App.persist(); App.render(); };
  A['nav-mobile'] = function () { App.ui.navMobile = !App.ui.navMobile; App.render(); };
  A.tab = function (el) { App.ui.tabs[el.dataset.page] = el.dataset.tab; App.persist(); App.render(); };
  A.setv = function (el) { var v = el.dataset.val; App.ui.v[el.dataset.k] = v === 'true' ? true : (v === 'false' ? false : v); Object.keys(App.ui.t).forEach(function (k) { App.ui.t[k].page = 0; }); App.render(); };
  A['tbl-sort'] = function (el) { var st = App.ui.t[el.dataset.id]; if (st.sort === el.dataset.k) st.dir = -st.dir; else { st.sort = el.dataset.k; st.dir = 1; } App.render(); };
  A['tbl-page'] = function (el) { App.ui.t[el.dataset.id].page += +el.dataset.d; App.render(); };
  A['tbl-sel'] = function (el, ev) { ev.stopPropagation(); var st = App.ui.t[el.dataset.id]; st.sel[el.dataset.row] = el.checked; App.render(); };
  A['tbl-export'] = function (el) { App.exportTable(el.dataset.id, el.dataset.fmt); };
  A['close-drawer'] = function () { App.closeDrawer(); App._form = null; };
  A['form-submit'] = function () { App.formSubmit(); };
  A['modal-ok'] = function () { App.modalOk(); };
  A['modal-cancel'] = function () { if (App._modal) App._modal.resolve(false); };
  A.palette = function () { App.openPalette(); };
  A['switch-company'] = function (el) { App.S.meta.currentCompany = el.value; if (App.sim) App.real.meta.currentCompany = el.value; App.ui.t = {}; App.ui.year = null; var u = App.user(); var ok = (App.S.users || []).find(function (x) { return x.id === u.id && x.companies.indexOf(el.value) > -1; }); if (!ok) { var first = App.S.users.find(function (x) { return x.companies.indexOf(el.value) > -1; }); if (first) App.S.meta.currentUser = { id: first.id, name: first.name, role: first.role }; } App.toast('Société active : ' + App.co().name, 'ok'); App.commit(); };
  A['switch-year'] = function (el) { App.ui.year = +el.value; App.render(); };
  A['switch-user'] = function (el) { var u = App.S.users.find(function (x) { return x.id === el.value; }); App.S.meta.currentUser = { id: u.id, name: u.name, role: u.role }; App.toast('Connecté en tant que ' + u.name + ' · ' + Y.ROLES[u.role].label, 'ok'); App.commit(); };
  A['sim-start'] = function () { App.startSim(); };
  A['sim-end'] = function (el) { App.endSim(el.dataset.keep === '1'); };
  App.startSim = function () { if (App.sim) return; App.sim = U.clone(App.real); App.S = App.sim; App.toast('Simulation ouverte : vos données réelles restent intactes.', 'ok'); App.render(); };
  App.endSim = function (keep) {
    if (!App.sim) return;
    if (keep) { App.real = App.sim; App.toast('Résultat de la simulation conservé.', 'ok'); } else App.toast('Simulation abandonnée : aucune modification enregistrée.', 'ok');
    App.sim = null; App.S = App.real; App.commit();
  };

  /* ------------------------------------------------------ palette de commandes */
  App.commands = function (q) {
    var cmds = [];
    App.NAV.forEach(function (g) { g[1].forEach(function (n) { cmds.push({ label: 'Aller à · ' + n[1], hint: g[0], icon: n[0], run: function () { App.go(n[0]); } }); }); });
    [['Nouvelle écriture', 'saisie', function () { App.go('saisie', 'new'); }], ['Nouvelle facture', 'ventes', function () { App.go('ventes'); App.actions['doc-new']({ dataset: { type: 'FA' } }); }],
     ['Nouveau devis', 'ventes', function () { App.go('ventes'); App.actions['doc-new']({ dataset: { type: 'DV' } }); }], ['Nouvelle facture fournisseur', 'achats', function () { App.go('achats'); App.actions['purchase-new'](); }],
     ['Nouveau client ou fournisseur', 'plan', function () { App.go('plan', 'tiers'); App.actions['tiers-new']({ dataset: {} }); }], ['Nouveau compte', 'plan', function () { App.go('plan', 'comptes'); App.actions['account-new']({ dataset: {} }); }],
     ['Nouvelle immobilisation', 'immos', function () { App.go('immos'); App.actions['asset-new'](); }], ['Importer un fichier', 'imports', function () { App.go('imports', 'import'); }],
     ['Rapprocher la banque', 'banque', function () { App.go('banque', 'rappro'); }], ['Déclaration de TVA', 'fiscalite', function () { App.go('fiscalite', 'tva'); }],
     ['Générer le FEC', 'fiscalite', function () { App.go('fiscalite', 'fec'); }], ['Bilan', 'etats', function () { App.go('etats', 'bilan'); }], ['Compte de résultat', 'etats', function () { App.go('etats', 'cr'); }],
     ['Balance générale', 'livres', function () { App.go('livres', 'balance'); }], ['Lettrage', 'livres', function () { App.go('livres', 'lettrage'); }], ['Assistant de clôture', 'cloture', function () { App.go('cloture'); }],
     ['Sauvegarder toutes les données (JSON)', 'imports', function () { App.actions['backup-export'](); }],
     ['Nouveau salarié', 'paie-salaries', function () { App.go('paie-salaries'); App.actions['emp-new'](); }], ['Importer le fichier des salariés', 'paie-salaries', function () { App.go('paie-salaries', 'import'); }],
     ['Calculer la paie du mois', 'paie-periode', function () { App.go('paie-periode', 'controle'); App.actions['pp-calc'](); }], ['Variables de paie', 'paie-periode', function () { App.go('paie-periode', 'variables'); }],
     ['Signer les bulletins (DRH)', 'paie-drh', function () { App.go('paie-drh', 'signature'); }], ['Ordre de virement des salaires', 'paie-paiements', function () { App.go('paie-paiements'); App.actions['ov-new'](); }],
     ['Demande d’avance sur salaire', 'paie-avances', function () { App.go('paie-avances'); App.actions['adv-req'](); }], ['Simulateur brut ⇄ net', 'paie', function () { App.go('paie', 'simulateur'); }],
     ['Déclarations CNPS et DGI', 'paie-declarations', function () { App.go('paie-declarations'); }], ['Demander à Yiélina', 'paie', function () { App.actions['yl-open']({ dataset: {} }); }]
    ].forEach(function (c) { cmds.push({ label: c[0], hint: 'Action', icon: c[1], run: c[2] }); });
    if (!q) return cmds.slice(0, 14).concat(cmds.slice(14));
    var ql = q.toLowerCase(), out = cmds.filter(function (c) { return c.label.toLowerCase().indexOf(ql) > -1; });
    var d = App.D();
    d.accounts.filter(function (a) { return a.num.indexOf(q) === 0 || a.label.toLowerCase().indexOf(ql) > -1; }).slice(0, 6).forEach(function (a) { out.push({ label: a.num + ' · ' + a.label, hint: 'Compte', icon: 'plan', run: function () { App.go('livres', 'gl'); App.ui.v.glAcc = a.num; App.render(); } }); });
    d.tiers.filter(function (t) { return t.name.toLowerCase().indexOf(ql) > -1 || t.code.toLowerCase().indexOf(ql) > -1; }).slice(0, 6).forEach(function (t) { out.push({ label: t.code + ' · ' + t.name, hint: t.type === 'client' ? 'Client' : (t.type === 'fournisseur' ? 'Fournisseur' : 'Tiers'), icon: 'user', run: function () { App.go('plan', 'tiers'); App.actions['tiers-open']({ dataset: { id: t.id } }); } }); });
    try { Y.Paie.D(App.S, App.cid()).employees.filter(function (e) { return (e.nom + ' ' + e.prenoms + ' ' + e.matricule).toLowerCase().indexOf(ql) > -1; }).slice(0, 6).forEach(function (e) { out.push({ label: e.matricule + ' · ' + Y.Paie.fullName(e) + ' · ' + e.poste, hint: 'Salarié', icon: 'paie-salaries', run: function () { App.go('paie-salaries'); App.actions['emp-open']({ dataset: { id: e.id } }); } }); }); } catch (x) { /* rien */ }
    d.docs.filter(function (x) { return x.num && x.num.toLowerCase().indexOf(ql) > -1; }).slice(0, 6).forEach(function (x) { out.push({ label: x.num + ' · ' + ((Y.tiers(App.S, App.cid(), x.tiersId) || {}).name || ''), hint: 'Document', icon: 'ventes', run: function () { App.go('ventes'); App.ui.v.docId = x.id; App.render(); } }); });
    d.entries.filter(function (e) { return e.num && e.num.toLowerCase().indexOf(ql) > -1; }).slice(0, 6).forEach(function (e) { out.push({ label: e.num + ' · ' + e.label, hint: 'Écriture', icon: 'saisie', run: function () { App.go('saisie', 'list'); App.actions['entry-open']({ dataset: { id: e.id } }); } }); });
    var amt = U.parseAmount(q);
    if (amt > 999) { var hits = 0; Y.validated(App.S, App.cid()).forEach(function (e) { if (hits < 6 && e.lines.some(function (l) { return l.debit === amt || l.credit === amt; })) { hits++; out.push({ label: e.num + ' · ' + e.label + ' · ' + U.fmt(amt), hint: 'Montant', icon: 'money', run: function () { App.go('saisie', 'list'); App.actions['entry-open']({ dataset: { id: e.id } }); } }); } }); }
    return out.slice(0, 40);
  };
  App.openPalette = function () {
    var o = document.getElementById('palroot');
    o.innerHTML = '<div class="scrim show" data-act="pal-close"></div><div class="palette" role="dialog" aria-modal="true" aria-label="Palette de commandes"><input id="pal_q" placeholder="Compte, tiers, n° de pièce, montant ou action…" autocomplete="off" aria-controls="pal_list"><ul id="pal_list" role="listbox"></ul><div class="hint">↑ ↓ pour naviguer · Entrée pour ouvrir · Échap pour fermer</div></div>';
    App._pal = { i: 0, items: [] };
    var q = document.getElementById('pal_q'); q.focus(); App.palFill('');
  };
  App.palFill = function (q) {
    var items = App.commands(q); App._pal.items = items; App._pal.i = 0;
    document.getElementById('pal_list').innerHTML = items.length ? items.map(function (c, i) { return '<li role="option" class="' + (i === 0 ? 'on' : '') + '"><button type="button" data-act="pal-run" data-i="' + i + '">' + App.ic(c.icon) + '<span>' + esc(c.label) + '</span><small>' + esc(c.hint) + '</small></button></li>'; }).join('') : '<li style="padding:14px;color:var(--muted)">Aucun résultat.</li>';
  };
  App.palMove = function (d) { var p = App._pal; if (!p || !p.items.length) return; p.i = (p.i + d + p.items.length) % p.items.length; var lis = document.querySelectorAll('#pal_list li'); lis.forEach(function (li, i) { li.classList.toggle('on', i === p.i); }); if (lis[p.i]) lis[p.i].scrollIntoView({ block: 'nearest' }); };
  App.palClose = function () { document.getElementById('palroot').innerHTML = ''; App._pal = null; };
  A['pal-close'] = function () { App.palClose(); };
  A['pal-run'] = function (el) { var c = App._pal.items[+el.dataset.i]; App.palClose(); if (c) c.run(); };

  /* ------------------------------------------------------------ évènements */
  /** Lit la page et l’onglet depuis l’URL (/ventes?tab=devis) ; vrai si l’URL désigne un écran connu. */
  App.fromLocation = function () {
    var seg = (location.pathname || '').replace(/^\/+|\/+$/g, '').split('/')[0];
    if (!seg || !App.pages[seg]) return false;
    App.ui.page = seg;
    var t = new URLSearchParams(location.search).get('tab'); if (t) App.ui.tabs[seg] = t;
    return true;
  };
  function boot() {
    if (App._booted) return; App._booted = true;
    try { if (window.YIEL_MARK) document.documentElement.style.setProperty('--wm', 'url("' + window.YIEL_MARK + '")'); } catch (e) { /* filigrane facultatif */ }
    var stored = App.load();
    App.real = (stored && stored.meta && stored.meta.schema === 'myyiel-compta/2' && stored.companies && stored.companies.length) ? stored : Y.seed('2026-10-21');
    App.S = App.real; App.sim = null;
    var ui = App.loadUi(); if (ui) { App.ui.page = ui.page || 'dashboard'; App.ui.tabs = ui.tabs || {}; App.ui.navOpen = ui.navOpen || {}; }
    App.fromLocation();
    document.addEventListener('click', function (ev) {
      var el = ev.target.closest('[data-act]'); if (!el) return;
      if (el.disabled || el.getAttribute('aria-disabled') === 'true') return;
      var f = A[el.dataset.act]; if (!f) return;
      if (el.tagName === 'INPUT' && el.type === 'checkbox' && el.dataset.act !== 'tbl-sel') { /* case gérée par change */ }
      if (el.tagName === 'A' || el.tagName === 'BUTTON') ev.preventDefault();
      f(el, ev);
    });
    document.addEventListener('submit', function (ev) { ev.preventDefault(); });
    document.addEventListener('change', function (ev) { var el = ev.target.closest('[data-change]'); if (el && A[el.dataset.change]) A[el.dataset.change](el, ev); if (ev.target.closest('.drawer')) App.formLive(); });
    var tq;
    document.addEventListener('input', function (ev) {
      var el = ev.target;
      if (el.id === 'pal_q') { App.palFill(el.value.trim()); return; }
      if (el.dataset.tblSearch) { clearTimeout(tq); var id = el.dataset.tblSearch; tq = setTimeout(function () { App.ui.t[id].q = el.value; App.ui.t[id].page = 0; App.render(); }, 140); return; }
      if (el.dataset.input && A[el.dataset.input]) { A[el.dataset.input](el, ev); return; }
      if (el.closest('.drawer')) App.formLive();
    });
    document.addEventListener('keydown', function (ev) {
      if ((ev.ctrlKey || ev.metaKey) && (ev.key === 'k' || ev.key === 'K')) { ev.preventDefault(); if (App._pal) App.palClose(); else App.openPalette(); return; }
      if (App._pal) {
        if (ev.key === 'ArrowDown') { ev.preventDefault(); App.palMove(1); } else if (ev.key === 'ArrowUp') { ev.preventDefault(); App.palMove(-1); }
        else if (ev.key === 'Enter') { ev.preventDefault(); var c = App._pal.items[App._pal.i]; App.palClose(); if (c) c.run(); } else if (ev.key === 'Escape') App.palClose();
        return;
      }
      if (ev.key === 'Escape') { if (App._modal) App._modal.resolve(false); else if (App._drawer) { App.closeDrawer(); App._form = null; } return; }
      if ((ev.ctrlKey || ev.metaKey) && ev.key === 'Enter') {
        if (App._modal) { ev.preventDefault(); App.modalOk(); return; }
        if (App._form) { ev.preventDefault(); App.formSubmit(); return; }
        var p = App.pages[App.ui.page]; if (p && p.onSubmitKey) { ev.preventDefault(); p.onSubmitKey(); }
      }
    });
    window.addEventListener('popstate', function () { if (App.fromLocation()) { App.closeDrawer(true); App.render(); } });
  }
  App.boot = boot;
})();

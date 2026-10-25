/* Paramètres : société et multi-société, exercices et périodes, journaux, utilisateurs et droits, paramètres fiscaux, intégrations, piste d'audit, sauvegarde. */
(function () {
  'use strict';
  var Y = window.Yiel, U = Y.util, App = window.App, esc = App.esc, A = App.actions;
  function S() { return App.S; } function cid() { return App.cid(); }
  var JTYPES = { opening: 'À-nouveaux', purchase: 'Achats', sale: 'Ventes', bank: 'Trésorerie', cash: 'Caisse', misc: 'Opérations diverses', payroll: 'Paie' };

  /* ---------------------------------------------------------------- société */
  function coFields(c) {
    return [{ type: 'sep', label: 'Identité légale' }, { k: 'name', label: 'Raison sociale', req: true, val: c.name, span: true },
      { k: 'legalForm', label: 'Forme juridique', type: 'select', val: c.legalForm, opts: ['SA', 'SAS', 'SARL', 'SARLU', 'SNC', 'GIE', 'Entreprise individuelle', 'Association', 'Établissement public'] },
      { k: 'capital', label: 'Capital social (XAF)', type: 'money', val: c.capital }, { k: 'niu', label: 'NIU', val: c.niu, mono: true }, { k: 'rccm', label: 'RCCM', val: c.rccm, mono: true },
      { k: 'address', label: 'Adresse du siège', val: c.address }, { k: 'city', label: 'Ville', val: c.city },
      { k: 'country', label: 'Pays', type: 'select', val: c.country, opts: ['Cameroun', 'Gabon', 'Congo', 'Tchad', 'République centrafricaine', 'Guinée équatoriale', 'Côte d’Ivoire', 'Sénégal', 'Bénin', 'Togo', 'Burkina Faso', 'Mali', 'Niger', 'Guinée-Bissau'] },
      { type: 'sep', label: 'Référentiel et fiscalité' }, { k: 'framework', label: 'Référentiel comptable', type: 'select', val: c.framework, opts: ['SYSCOHADA révisé'] },
      { k: 'system', label: 'Système comptable', type: 'select', val: c.system, opts: [['normal', 'Système normal'], ['smt', 'Système minimal de trésorerie (SMT)']] },
      { k: 'currency', label: 'Monnaie de tenue', val: c.currency, ro: true, help: 'XAF (CEMAC) · XOF pour l’UEMOA : 0 décimale.' },
      { k: 'taxRegime', label: 'Régime fiscal', type: 'select', val: c.taxRegime, opts: ['Réel', 'Simplifié', 'Impôt libératoire'] }, { k: 'taxCenter', label: 'Centre des impôts de rattachement', val: c.taxCenter, ph: 'CIME, CSI, DGE…' },
      { k: 'cnps', label: 'N° employeur CNPS', val: c.cnps, mono: true }, { k: 'yearEnd', label: 'Date de clôture (JJ-MM)', val: c.yearEnd, ro: true, help: 'Exercice civil (31 décembre), règle OHADA.' },
      { k: 'statementsLang', label: 'Langue des états par défaut', type: 'select', val: c.statementsLang, opts: [['fr', 'Français'], ['en', 'Anglais']] },
      { type: 'sep', label: 'Facturation et encaissements' }, { k: 'iban', label: 'RIB affiché sur les factures', val: c.iban, mono: true, span: true },
      { k: 'momoMerchant', label: 'N° marchand MTN MoMo', val: c.momoMerchant, mono: true }, { k: 'omMerchant', label: 'N° marchand Orange Money', val: c.omMerchant, mono: true },
      { k: 'invoiceFooter', label: 'Pied de facture (mentions légales)', type: 'textarea', val: c.invoiceFooter, span: true }];
  }
  A['co-save'] = function () {
    if (!App.guard('settings')) return;
    var c = App.co(), f = coFields(c), r = App.collect(f, 'co_');
    if (r.missing.length) return App.toast('Champs obligatoires : ' + r.missing.join(', '), 'bad');
    if (r.vals.niu && !/^[A-Z0-9\[\] ÀÉ]{8,30}$/i.test(r.vals.niu)) return App.toast('NIU invalide.', 'bad');
    Object.keys(r.vals).forEach(function (k) { if (k !== 'currency' && k !== 'yearEnd') c[k] = r.vals[k]; });
    Y.audit(S(), cid(), 'Modification', 'Fiche société', c.name);
    App.toast('Fiche société enregistrée.', 'ok'); App.commit();
  };
  A['co-new'] = function () {
    if (!App.guard('users')) return;
    App.form({ title: 'Nouvelle société', sub: 'Dossier indépendant : plan, journaux, tiers et exercices propres', fields: [{ k: 'name', label: 'Raison sociale', req: true, span: true }, { k: 'legalForm', label: 'Forme juridique', type: 'select', val: 'SARL', opts: ['SA', 'SAS', 'SARL', 'SARLU', 'SNC', 'GIE', 'Entreprise individuelle'] }, { k: 'capital', label: 'Capital (XAF)', type: 'money', val: 1000000 }, { k: 'niu', label: 'NIU', mono: true }, { k: 'city', label: 'Ville', val: 'Douala' }, { k: 'system', label: 'Système', type: 'select', val: 'normal', opts: [['normal', 'Système normal'], ['smt', 'SMT']] }, { k: 'banks', label: 'Créer les comptes banque, MTN MoMo, Orange Money et caisse', type: 'check', val: true, span: true }],
      submit: 'Créer la société', onSubmit: function (v) {
        if (S().companies.some(function (c) { return c.name.toLowerCase() === v.name.toLowerCase(); })) throw new Y.BizError('Une société porte déjà ce nom.');
        var c = Y.addCompany(S(), { name: v.name, legalForm: v.legalForm, capital: v.capital || 0, niu: v.niu, city: v.city, system: v.system });
        Y.createFiscalYear(S(), c.id, U.year(App.today()));
        if (v.banks) [['Banque principale', 'bank', '5211', 'BQ1'], ['MTN Mobile Money', 'momo', '5521', 'MTN'], ['Orange Money', 'momo', '5522', 'OM'], ['Caisse', 'cash', '5711', 'CAI']].forEach(function (b) { Y.createBankAccount(S(), c.id, { label: b[0], kind: b[1], account: b[2], journal: b[3] }); });
        var u = App.user(); (S().users || []).forEach(function (x) { if (x.id === u.id) x.companies.push(c.id); });
        S().meta.currentCompany = c.id; App.ui.t = {}; App.ui.year = null;
        return c;
      }, done: function (c) { return c.name + ' créée et activée.'; } });
  };

  /* --------------------------------------------------------------- périodes */
  A['per-toggle'] = function (el) {
    var y = App.year(), m = +el.dataset.m, fy = Y.fiscalYear(S(), cid(), y), locked = fy.locked.indexOf(m) > -1;
    if (!App.guard(locked ? 'reopen' : 'lock')) return;
    if (!locked) return App.run(function () { Y.togglePeriod(S(), cid(), y, m); }, U.MONTHS[m - 1] + ' ' + y + ' verrouillé.');
    App.confirm({ title: 'Rouvrir ' + U.MONTHS[m - 1] + ' ' + y, body: 'La réouverture d’une période est tracée dans la piste d’audit.', fields: [{ k: 'reason', label: 'Motif', req: true, type: 'textarea' }], ok: 'Rouvrir' }).then(function (v) { if (v) App.run(function () { Y.togglePeriod(S(), cid(), y, m, v.reason); }, 'Période rouverte.'); });
  };
  A['fy-new'] = function () { if (!App.guard('close')) return; var last = App.D().fiscalYears.slice(-1)[0]; App.run(function () { return Y.createFiscalYear(S(), cid(), last ? last.year + 1 : U.year(App.today())); }, function (f) { return 'Exercice ' + f.year + ' ouvert.'; }); };

  /* ---------------------------------------------------------------- journaux */
  function jFields(j) {
    return [{ k: 'code', label: 'Code', req: true, val: j ? j.code : '', mono: true, ro: !!j, ph: 'VTE2' }, { k: 'label', label: 'Intitulé', req: true, val: j ? j.label : '' },
      { k: 'type', label: 'Type', type: 'select', val: j ? j.type : 'misc', ro: !!(j && j.system), opts: Object.keys(JTYPES).filter(function (k) { return k !== 'opening'; }).map(function (k) { return [k, JTYPES[k]]; }) },
      { k: 'counterpart', label: 'Compte de contrepartie / trésorerie', val: j ? j.counterpart : '', mono: true, help: 'Obligatoire pour un journal de trésorerie : chaque écriture doit le mouvementer.' },
      { k: 'seqFormat', label: 'Format de numérotation', val: j ? j.seqFormat : '', mono: true, ph: 'XXX-{YYYY}-{0000}', help: 'Séquence continue par exercice, attribuée à la validation.' },
      { k: 'source', label: 'Alimentation', val: j ? j.source : 'Saisie' }, { k: 'active', label: 'Journal actif', type: 'check', val: j ? j.active : true }];
  }
  function saveJ(j, v) {
    if (!/\{0+\}/.test(v.seqFormat || '')) throw new Y.BizError('Le format doit contenir un compteur, par exemple {0000}.');
    if (v.type === 'bank' && !Y.account(S(), cid(), v.counterpart)) throw new Y.BizError('Un journal de trésorerie exige un compte de contrepartie existant.');
    if (j.code && j.seq && Object.keys(j.seq).length && j.seqFormat !== v.seqFormat) throw new Y.BizError('Le format de numérotation ne peut plus changer : le journal a déjà des pièces.');
    ['label', 'type', 'counterpart', 'seqFormat', 'source', 'active'].forEach(function (k) { if (!(j.system && k === 'type')) j[k] = v[k]; }); return j;
  }
  A['jr-new'] = function () { if (!App.guard('settings')) return; App.form({ title: 'Nouveau journal', fields: jFields(null), submit: 'Créer', done: 'Journal créé.', onSubmit: function (v) { v.code = v.code.toUpperCase(); if (!/^[A-Z0-9]{2,6}$/.test(v.code)) throw new Y.BizError('Code : 2 à 6 caractères.'); if (Y.journal(S(), cid(), v.code)) throw new Y.BizError('Ce code existe déjà.'); if (!v.seqFormat) v.seqFormat = v.code + '-{YYYY}-{0000}'; var j = saveJ({ code: v.code, seq: {} }, v); App.D().journals.push(j); Y.audit(S(), cid(), 'Création', 'Journal ' + j.code, j.label); } }); };
  A['jr-edit'] = function (el) { var j = Y.journal(S(), cid(), el.dataset.id); App.form({ title: 'Journal ' + j.code, sub: j.system ? 'Journal système' : '', fields: jFields(j), submit: 'Enregistrer', done: 'Journal mis à jour.', onSubmit: function (v) { if (!App.can('settings')) throw new Y.BizError('Droit requis : ' + Y.RIGHTS.settings); if (j.system) { v.type = j.type; v.active = true; } saveJ(j, v); Y.audit(S(), cid(), 'Modification', 'Journal ' + j.code, j.label); } }); };

  /* ------------------------------------------------------------ utilisateurs */
  function uFields(u) {
    return [{ k: 'name', label: 'Nom', req: true, val: u ? u.name : '' }, { k: 'email', label: 'E-mail', type: 'email', req: true, val: u ? u.email : '' },
      { k: 'role', label: 'Rôle', type: 'select', val: u ? u.role : 'accountant', opts: Object.keys(Y.ROLES).map(function (k) { return [k, Y.ROLES[k].label]; }) },
      { type: 'sep', label: 'Sociétés accessibles' }].concat(S().companies.map(function (c) { return { k: 'c_' + c.id, label: c.name, type: 'check', val: u ? u.companies.indexOf(c.id) > -1 : c.id === cid() }; })).concat([{ k: 'mfa', label: 'Double authentification obligatoire', type: 'check', val: u ? u.mfa : true, span: true }]);
  }
  function saveU(u, v) {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email)) throw new Y.BizError('Adresse e-mail invalide.');
    var cs = S().companies.filter(function (c) { return v['c_' + c.id]; }).map(function (c) { return c.id; });
    if (!cs.length) throw new Y.BizError('Donnez accès à au moins une société.');
    var owners = S().users.filter(function (x) { return x.role === 'owner' && x.id !== u.id; });
    if (u.role === 'owner' && v.role !== 'owner' && !owners.length) throw new Y.BizError('Il doit rester au moins un propriétaire.');
    Object.assign(u, { name: v.name, email: v.email, role: v.role, companies: cs, mfa: v.mfa }); return u;
  }
  A['user-new'] = function () { if (!App.guard('users')) return; App.form({ title: 'Inviter un utilisateur', sub: 'Un e-mail d’invitation est envoyé en production.', fields: uFields(null), submit: 'Inviter', done: function (u) { return u.name + ' invité · ' + Y.ROLES[u.role].label + '.'; }, onSubmit: function (v) { if (S().users.some(function (x) { return x.email.toLowerCase() === v.email.toLowerCase(); })) throw new Y.BizError('Cet e-mail est déjà utilisé.'); var u = saveU({ id: U.uid('u'), status: 'invited', lastLogin: '' }, v); S().users.push(u); Y.audit(S(), cid(), 'Invitation', 'Utilisateur ' + u.email, Y.ROLES[u.role].label); return u; } }); };
  A['user-edit'] = function (el) { var u = S().users.find(function (x) { return x.id === el.dataset.id; }); App.form({ title: u.name, sub: u.email, fields: uFields(u), submit: 'Enregistrer', done: 'Droits mis à jour.', extraFoot: u.id !== App.user().id ? '<button type="button" class="btn danger" data-act="user-del" data-id="' + u.id + '">Retirer l’accès</button>' : '', onSubmit: function (v) { if (!App.can('users')) throw new Y.BizError('Droit requis : ' + Y.RIGHTS.users); var old = u.role; saveU(u, v); Y.audit(S(), cid(), 'Droits', 'Utilisateur ' + u.email, old + ' → ' + u.role); if (u.id === App.user().id) S().meta.currentUser.role = u.role; } }); };
  A['user-del'] = function (el) { var u = S().users.find(function (x) { return x.id === el.dataset.id; }); App.closeDrawer(true); App._form = null; App.confirm({ title: 'Retirer l’accès de ' + u.name, body: 'L’historique de ses actions reste dans la piste d’audit.', danger: true, ok: 'Retirer' }).then(function (ok) { if (ok) App.run(function () { if (u.role === 'owner' && S().users.filter(function (x) { return x.role === 'owner'; }).length < 2) throw new Y.BizError('Il doit rester au moins un propriétaire.'); S().users = S().users.filter(function (x) { return x.id !== u.id; }); Y.audit(S(), cid(), 'Retrait', 'Utilisateur ' + u.email, ''); }, 'Accès retiré.'); }); };

  /* --------------------------------------------------------------- fiscalité */
  A['fisc-save'] = function () {
    if (!App.guard('settings')) return;
    var st = App.D().settings, f = fiscFields(st), r = App.collect(f, 'fs_');
    Object.keys(r.vals).forEach(function (k) { st[k] = +r.vals[k] || 0; });
    if (st.isRate <= 0 || st.isRate > 50) return App.toast('Taux d’IS incohérent.', 'bad');
    Y.audit(S(), cid(), 'Paramétrage', 'Paramètres fiscaux', JSON.stringify(r.vals)); App.toast('Paramètres fiscaux enregistrés.', 'ok'); App.commit();
  };
  function fiscFields(st) { return [{ k: 'isRate', label: 'Taux de l’IS, CAC inclus (%)', type: 'number', val: st.isRate }, { k: 'minTaxRate', label: 'Minimum de perception / acompte (% du CA)', type: 'number', val: st.minTaxRate }, { k: 'ircmRate', label: 'IRCM sur dividendes (%)', type: 'number', val: st.ircmRate }, { k: 'legalReserveRate', label: 'Dotation à la réserve légale (% du bénéfice)', type: 'number', val: st.legalReserveRate }, { k: 'legalReserveCap', label: 'Plafond de la réserve légale (% du capital)', type: 'number', val: st.legalReserveCap }]; }

  /* ---------------------------------------------------------------- intégrations */
  var INTEG = [
    ['bank', 'banque', 'Banques (API / EBICS / relevés)', 'Afriland First Bank, Société Générale, Ecobank, UBA, BICEC… : synchronisation quotidienne des relevés ou import CAMT.053, MT940, CSV.'],
    ['momo', 'phone', 'MTN Mobile Money', 'API marchand MoMo : transactions, frais et commissions importés dans le journal MTN (compte 5521).'],
    ['om', 'phone', 'Orange Money', 'API marchand Orange Money : encaissements et décaissements vers le journal OM (compte 5522).'],
    ['dgi', 'fiscalite', 'DGI · impots.cm', 'Préparation des déclarations (TVA, acomptes, DSF) au format de téléversement ; le dépôt reste réalisé par le contribuable.'],
    ['cnps', 'shield', 'CNPS · déclarations sociales', 'Export du DIPE et des cotisations à partir des centralisations de paie.'],
    ['rh', 'user', 'myyiel RH & Paie', 'Écritures de paie générées automatiquement à chaque clôture de paie (journal PAIE).'],
    ['crm', 'ventes', 'myyiel Commercial', 'Devis acceptés dans le CRM transformés en factures dans la comptabilité.'],
    ['mail', 'mail', 'E-mail et WhatsApp', 'Envoi des factures et relances avec lien de paiement Mobile Money.']
  ];
  A['int-toggle'] = function (el) { if (!App.guard('settings')) return; var st = App.D().settings, i = st.integrations || (st.integrations = {}); i[el.dataset.id] = !i[el.dataset.id]; Y.audit(S(), cid(), i[el.dataset.id] ? 'Connexion' : 'Déconnexion', 'Intégration ' + el.dataset.id, ''); App.toast(i[el.dataset.id] ? 'Intégration activée (démonstration : aucun appel externe).' : 'Intégration désactivée.', 'ok'); App.commit(); };

  /* -------------------------------------------------------------- audit & données */
  A['audit-verify'] = function () { var r = Y.verifyAudit(S(), cid()); App.toast(r.ok ? 'Piste d’audit intègre : ' + r.count + ' événements, chaîne d’empreintes vérifiée.' : 'Rupture de la chaîne à l’événement n° ' + (r.at + 1) + ' : altération détectée.', r.ok ? 'ok' : 'bad'); };
  A['backup-export'] = function () { if (!App.guard('export')) return; App.save('myyiel-compta_sauvegarde_' + App.today() + '.json', new Blob([Y.exportBackup(App.real)], { type: 'application/json' })); };
  A['backup-import'] = function () { var el = document.getElementById('bk_file'); if (el) el.click(); };
  A['backup-file'] = function (el) {
    if (!App.guard('users')) return;
    var f = el.files && el.files[0]; if (!f) return;
    App.readFile(f).then(function (r) {
      var st; try { st = Y.importBackup(r.text || ''); } catch (e) { return App.toast(e.messages ? e.messages[0] : 'Fichier illisible : ' + e.message, 'bad'); }
      App.confirm({ title: 'Restaurer la sauvegarde', body: st.companies.length + ' société(s) : ' + esc(st.companies.map(function (c) { return c.name; }).join(', ')) + '. Les données actuelles seront remplacées.', requireText: 'RESTAURER', danger: true, ok: 'Restaurer' }).then(function (ok) {
        if (!ok) return; App.real = st; App.S = st; App.sim = null; App.ui.t = {}; App.ui.year = null; App.toast('Sauvegarde restaurée.', 'ok'); App.commit();
      });
    }, function (e) { App.toast(e.message, 'bad'); });
  };
  A['data-reset'] = function () {
    if (!App.guard('users')) return;
    App.confirm({ title: 'Réinitialiser la démonstration', body: 'Toutes les données de ce navigateur sont remplacées par le jeu de démonstration Yiel Group Holding et DeyGo.', requireText: 'RÉINITIALISER', danger: true, ok: 'Réinitialiser' }).then(function (ok) {
      if (!ok) return; App.clearStore(); App.real = Y.seed(App.real.meta.today); App.S = App.real; App.sim = null; App.ui.t = {}; App.ui.v = {}; App.ui.year = null; App.toast('Démonstration réinitialisée.', 'ok'); App.commit();
    });
  };

  App.pages.parametres = {
    render: function () {
      var d = App.D(), tab = App.tab('parametres', 'societe'), co = App.co(), y = App.year();
      var h = '<div class="page">' + App.head('Administration', 'Paramètres', 'Dossier ' + esc(co.name) + ' · chaque modification est horodatée et chaînée dans la piste d’audit.', '<button type="button" class="btn" data-act="co-new"' + App.dis('users') + '>' + App.ic('plus') + 'Nouvelle société</button>');
      h += App.tabs('parametres', [['societe', 'Société'], ['exercices', 'Exercices & périodes'], ['journaux', 'Journaux', d.journals.length], ['users', 'Utilisateurs & droits', (S().users || []).filter(function (u) { return u.companies.indexOf(cid()) > -1; }).length], ['fiscal', 'Paramètres fiscaux'], ['integrations', 'Intégrations'], ['audit', 'Piste d’audit', d.audit.length], ['donnees', 'Sauvegarde & données']], 'societe');
      if (tab === 'societe') {
        h += '<div class="card"><div class="form-grid">' + coFields(co).map(function (f) { return App.fieldHtml(f, 'co_'); }).join('') + '</div><div class="actions" style="justify-content:flex-end;margin-top:14px"><button type="button" class="btn acc" data-act="co-save"' + App.dis('settings') + '>' + App.ic('check') + 'Enregistrer la fiche société</button></div></div>';
        h += '<div class="card flush"><div class="card-h"><h2>Sociétés du groupe</h2><span class="sub">Bascule depuis la barre supérieure ; données strictement cloisonnées</span></div>' + App.table('companies', { exportName: false, search: false, rows: S().companies, cols: [{ k: 'name', label: 'Société', fmt: function (v, c) { return '<b>' + esc(v) + '</b>' + (c.id === cid() ? ' ' + App.chip('Active', 'ok', true) : ''); } }, { k: 'legalForm', label: 'Forme' }, { k: 'capital', label: 'Capital', num: true, fmt: function (v) { return U.fmt(v); } }, { k: 'system', label: 'Système', fmt: function (v) { return v === 'smt' ? 'SMT' : 'Normal'; } }, { k: 'n', label: 'Écritures', num: true, val: function (c) { return S().data[c.id].entries.length; } }] }) + '</div>';
      }
      if (tab === 'exercices') {
        h += '<div class="actions"><button type="button" class="btn" data-act="fy-new"' + App.dis('close') + '>' + App.ic('plus') + 'Ouvrir l’exercice suivant</button></div>';
        d.fiscalYears.slice().reverse().forEach(function (fy) {
          h += '<div class="card" style="display:flex;flex-direction:column;gap:12px"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><b style="font-size:16px">Exercice ' + fy.year + '</b>' + App.chip(fy.status === 'closed' ? 'Clôturé' : 'Ouvert', fy.status === 'closed' ? '' : 'ok', true) + '<span class="muted" style="font-size:12.5px">' + App.date(fy.start) + ' → ' + App.date(fy.end) + ' · ' + fy.locked.length + ' / 12 périodes verrouillées</span></div>' +
            '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:8px">' + U.MONTHS.map(function (m, i) { var lk = fy.locked.indexOf(i + 1) > -1, n = d.entries.filter(function (e) { return e.status === 'validated' && U.year(e.date) === fy.year && U.month(e.date) === i + 1; }).length; return '<button type="button" class="btn" style="flex-direction:column;align-items:flex-start;height:auto;padding:10px;gap:2px;' + (lk ? 'background:var(--surface-3)' : '') + '" data-act="per-toggle" data-m="' + (i + 1) + '"' + (fy.year !== y || fy.status === 'closed' ? ' disabled' : '') + ' title="' + (lk ? 'Rouvrir' : 'Verrouiller') + '"><span style="display:flex;gap:6px;align-items:center">' + App.ic(lk ? 'lock' : 'unlockI') + '<b>' + m.slice(0, 4) + '.</b></span><small class="muted">' + n + ' pièce' + (n > 1 ? 's' : '') + '</small></button>'; }).join('') + '</div>' + (fy.year !== y && fy.status !== 'closed' ? '<span class="muted" style="font-size:12px">Sélectionnez l’exercice ' + fy.year + ' dans la barre supérieure pour gérer ses périodes.</span>' : '') + '</div>';
        });
      }
      if (tab === 'journaux') {
        h += '<div class="card flush">' + App.table('journals', { exportName: 'journaux', rows: d.journals, rowId: function (j) { return j.code; }, rowAct: 'jr-edit', toolbar: '<button type="button" class="btn sm acc" data-act="jr-new"' + App.dis('settings') + '>' + App.ic('plus') + 'Journal</button>',
          cols: [{ k: 'code', label: 'Code', fmt: function (v) { return '<span class="mono"><b>' + esc(v) + '</b></span>'; } }, { k: 'label', label: 'Intitulé' }, { k: 'type', label: 'Type', fmt: function (v) { return JTYPES[v] || v; } }, { k: 'counterpart', label: 'Contrepartie', fmt: function (v) { return v ? '<span class="ac">' + esc(v) + '</span>' : ''; } }, { k: 'seqFormat', label: 'Numérotation', fmt: function (v) { return '<span class="mono">' + esc(v) + '</span>'; } }, { k: 'last', label: 'Dernière pièce ' + y, val: function (j) { return j.seq[y] || 0; }, num: true }, { k: 'source', label: 'Alimentation' }, { k: 'active', label: 'État', fmt: function (v, j) { return App.chip(j.system ? 'Système' : (v ? 'Actif' : 'Inactif'), v ? 'ok' : '', true); } }] }) + '</div>';
      }
      if (tab === 'users') {
        var us = (S().users || []).filter(function (u) { return u.companies.indexOf(cid()) > -1; });
        h += '<div class="card flush">' + App.table('users', { exportName: 'utilisateurs', rows: us, rowAct: 'user-edit', toolbar: '<button type="button" class="btn sm acc" data-act="user-new"' + App.dis('users') + '>' + App.ic('plus') + 'Inviter</button>',
          cols: [{ k: 'name', label: 'Utilisateur', fmt: function (v, u) { return '<b>' + esc(v) + '</b><br><span class="muted" style="font-size:12px">' + esc(u.email) + '</span>'; } }, { k: 'role', label: 'Rôle', fmt: function (v) { return App.chip(Y.ROLES[v].label, v === 'owner' ? 'warn' : (v === 'accountant' ? 'info' : '')); } }, { k: 'companies', label: 'Sociétés', val: function (u) { return u.companies.map(function (c) { var x = S().companies.find(function (z) { return z.id === c; }); return x ? x.name : ''; }).join(', '); } }, { k: 'mfa', label: '2FA', fmt: function (v) { return App.chip(v ? 'Activée' : 'Désactivée', v ? 'ok' : 'bad', true); } }, { k: 'lastLogin', label: 'Dernière connexion', fmt: function (v, u) { return u.status === 'invited' ? App.chip('Invitation envoyée', 'info') : (v ? new Date(v).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—'); } }] }) + '</div>';
        h += '<div class="card flush"><div class="card-h"><h2>Matrice des droits</h2><span class="sub">Appliquée côté interface et, en production, côté API (voir dossier développeurs)</span></div><div class="tbl-wrap"><table class="t"><thead><tr><th>Droit</th>' + Object.keys(Y.ROLES).map(function (r) { return '<th style="text-align:center">' + Y.ROLES[r].label + '</th>'; }).join('') + '</tr></thead><tbody>' + Object.keys(Y.RIGHTS).map(function (k) { return '<tr><td>' + esc(Y.RIGHTS[k]) + '</td>' + Object.keys(Y.ROLES).map(function (r) { return '<td style="text-align:center">' + (Y.can(r, k) ? '<span style="color:var(--ok)">' + App.ic('check') + '</span>' : '<span class="muted">—</span>') + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div></div>';
        h += '<div class="callout info">' + App.ic('user') + '<span>Démonstration : changez d’utilisateur dans la barre supérieure (ex. « Expert-comptable externe », lecteur) pour voir les boutons se désactiver selon le rôle.</span></div>';
      }
      if (tab === 'fiscal') {
        h += '<div class="card"><div class="form-grid">' + fiscFields(d.settings).map(function (f) { return App.fieldHtml(f, 'fs_'); }).join('') + '</div><div class="actions" style="justify-content:flex-end;margin-top:14px"><button type="button" class="btn acc" data-act="fisc-save"' + App.dis('settings') + '>' + App.ic('check') + 'Enregistrer</button></div></div>';
        h += '<div class="row"><div class="card grow"><b>Codes de taxe</b><p class="muted" style="font-size:13px;margin:6px 0 10px">TVA 19,25 %, exonérations, exportations, hors champ.</p><button type="button" class="btn sm" data-act="go" data-page="plan" data-tab="taxes">Gérer les codes de taxe</button></div><div class="card grow"><b>Taux sociaux</b><p class="muted" style="font-size:13px;margin:6px 0 10px">CNPS, crédit foncier, FNE.</p><button type="button" class="btn sm" data-act="go" data-page="fiscalite" data-tab="paie">Paie & CNPS</button></div></div>';
        h += '<div class="callout warn">' + App.ic('shield') + '<span>Valeurs par défaut issues du CGI du Cameroun ; elles évoluent avec chaque loi de finances et doivent être validées par votre expert-comptable.</span></div>';
      }
      if (tab === 'integrations') {
        var on = d.settings.integrations || {};
        h += '<div class="grid g2">' + INTEG.map(function (x) { var active = !!on[x[0]]; return '<div class="card" style="display:flex;gap:14px;align-items:flex-start"><span style="width:42px;height:42px;flex:0 0 42px;border-radius:12px;background:' + (active ? 'var(--brand-soft)' : 'var(--surface-3)') + ';color:' + (active ? 'var(--brand-ink)' : 'var(--muted)') + ';display:inline-flex;align-items:center;justify-content:center">' + App.ic(x[1]) + '</span><span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:6px"><span style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><b>' + esc(x[2]) + '</b>' + App.chip(active ? 'Connecté' : 'Non connecté', active ? 'ok' : '', true) + '</span><span class="muted" style="font-size:13px">' + esc(x[3]) + '</span><span><button type="button" class="btn sm' + (active ? '' : ' pri') + '" data-act="int-toggle" data-id="' + x[0] + '"' + App.dis('settings') + '>' + (active ? 'Déconnecter' : 'Connecter') + '</button></span></span></div>'; }).join('') + '</div>';
        h += '<div class="callout">' + App.ic('bolt') + '<span>Démonstration : les connexions n’appellent aucun service. Les contrats d’intégration (webhooks, idempotence, mapping comptable) sont décrits dans le dossier développeurs.</span></div>';
      }
      if (tab === 'audit') {
        h += '<div class="card flush">' + App.table('audit', { exportName: 'piste_audit', pdf: true, title: 'Piste d’audit', rows: d.audit.slice().reverse().map(function (r, i) { r.id = r.hash + i; return r; }), pageSize: 40,
          toolbar: '<button type="button" class="btn sm acc" data-act="audit-verify">' + App.ic('shield') + 'Vérifier l’intégrité</button>',
          cols: [{ k: 'ts', label: 'Horodatage', fmt: function (v) { return new Date(v).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'medium' }); } }, { k: 'user', label: 'Utilisateur' }, { k: 'action', label: 'Action', fmt: function (v) { return App.chip(v, /Suppr|Retrait|Réouverture|Délettrage|Annulation/.test(v) ? 'warn' : (/Clôture|Validation|Génération/.test(v) ? 'ok' : '')); } }, { k: 'object', label: 'Objet' }, { k: 'detail', label: 'Détail' }, { k: 'hash', label: 'Empreinte', fmt: function (v, r) { return '<span class="mono muted" title="précédente : ' + esc(r.prev) + '">' + esc(v) + '</span>'; } }] }) + '</div>';
      }
      if (tab === 'donnees') {
        h += '<div class="grid g3"><div class="card" style="display:flex;flex-direction:column;gap:10px"><b>Sauvegarde complète</b><span class="muted" style="font-size:13px">Toutes les sociétés, écritures, tiers, paramètres et la piste d’audit, au format JSON (schéma myyiel-compta/1).</span><button type="button" class="btn pri" data-act="backup-export"' + App.dis('export') + '>' + App.ic('download') + 'Télécharger la sauvegarde</button></div>' +
          '<div class="card" style="display:flex;flex-direction:column;gap:10px"><b>Restauration</b><span class="muted" style="font-size:13px">Remplace les données de ce navigateur par une sauvegarde myyiel.</span><input type="file" id="bk_file" accept=".json" class="sr" data-change="backup-file"><button type="button" class="btn" data-act="backup-import"' + App.dis('users') + '>' + App.ic('upload') + 'Restaurer un fichier</button></div>' +
          '<div class="card" style="display:flex;flex-direction:column;gap:10px"><b>Démonstration</b><span class="muted" style="font-size:13px">Données stockées localement dans ce navigateur uniquement. Réinitialisez pour repartir du jeu d’exemple.</span><button type="button" class="btn danger" data-act="data-reset"' + App.dis('users') + '>' + App.ic('refresh') + 'Réinitialiser</button></div></div>';
        h += '<div class="callout">' + App.ic('imports') + '<span>Imports de plan, tiers, écritures, relevés, immobilisations et soldes d’ouverture : <button type="button" class="btn xs" data-act="go" data-page="imports">Imports & exports</button></span></div>';
      }
      return h + '</div>';
    }
  };
})();

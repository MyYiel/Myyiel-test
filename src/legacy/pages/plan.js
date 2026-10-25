/* Plan comptable SYSCOHADA révisé (9 classes, FR/EN), fichier des tiers (clients, fournisseurs, personnel) et codes de taxe. */
(function () {
  'use strict';
  var Y = window.Yiel, U = Y.util, App = window.App, esc = App.esc, A = App.actions;
  function S() { return App.S; } function cid() { return App.cid(); }
  var NAT = { general: 'Général', tiers: 'Collectif (tiers)', tresorerie: 'Trésorerie', analytique: 'Analytique' };
  var TYPES = { client: 'Client', fournisseur: 'Fournisseur', personnel: 'Personnel', associe: 'Associé' };

  /* ----------------------------------------------------------------- comptes */
  function parentOf(num) { return App.D().accounts.filter(function (x) { return num.indexOf(x.num) === 0 && x.num !== num; }).sort(function (a, b) { return b.num.length - a.num.length; })[0]; }
  function accFields(a) {
    return [{ k: 'num', label: 'Numéro de compte', req: true, val: a ? a.num : '', mono: true, ro: !!a, ph: '60551', help: a ? 'Un compte mouvementé ne peut pas être renuméroté.' : 'Sous-compte d’un compte SYSCOHADA existant (racine à 2 chiffres minimum).' },
      { k: 'label', label: 'Intitulé (français)', req: true, val: a ? a.label : '' }, { k: 'labelEn', label: 'Intitulé (anglais)', val: a ? a.labelEn : '', help: 'Utilisé pour les états financiers en anglais (Cameroun bilingue).' },
      { k: 'sens', label: 'Sens normal', type: 'select', val: a ? a.sens : '', opts: [['', 'Automatique selon la classe'], ['D', 'Débiteur'], ['C', 'Créditeur']] },
      { k: 'nature', label: 'Nature', type: 'select', val: a ? a.nature : '', opts: [['', 'Automatique'], ['general', 'Général'], ['tiers', 'Collectif (exige un tiers)'], ['tresorerie', 'Trésorerie']] },
      { k: 'taxCode', label: 'Code TVA par défaut', type: 'select', val: a ? a.taxCode : '', empty: 'Aucun', opts: App.D().taxCodes.map(function (t) { return [t.code, t.code + ' · ' + t.label]; }) },
      { k: 'lettrable', label: 'Compte lettrable', type: 'check', val: a ? a.lettrable : false }, { k: 'bankReconcile', label: 'Rapprochement bancaire', type: 'check', val: a ? a.bankReconcile : false },
      { k: 'analyticRequired', label: 'Section analytique obligatoire', type: 'check', val: a ? a.analyticRequired : false }].concat(a ? [{ k: 'active', label: 'Compte actif (sinon : saisie interdite)', type: 'check', val: a.active }] : []);
  }
  A['account-new'] = function (el) {
    if (!App.guard('settings')) return;
    var pre = el && el.dataset && el.dataset.parent || '';
    var f = accFields(null); f[0].val = pre;
    App.form({ title: 'Nouveau compte', sub: 'Création d’un sous-compte du plan SYSCOHADA révisé', fields: f, submit: 'Créer le compte',
      live: function (v) { if (!v.num) return ''; var p = parentOf(v.num), m = /^[1-9]\d{1,9}$/.test(v.num) ? Y.accountMeta(v.num) : null; return p && m ? '<div class="balance-bar ok">' + App.ic('layers') + 'Rattaché à <b class="ac" style="margin:0 4px">' + esc(p.num) + '</b> ' + esc(p.label) + ' · classe ' + m.cls + ' · ' + (m.type === 'bilan' ? 'compte de bilan' : 'compte de gestion') + ' · sens ' + (m.sens || '—') + '</div>' : '<div class="balance-bar bad">' + App.ic('x') + 'Aucun compte parent SYSCOHADA pour ' + esc(v.num) + '.</div>'; },
      onSubmit: function (v) { return Y.createAccount(S(), cid(), { num: v.num, label: v.label, labelEn: v.labelEn, sens: v.sens || undefined, nature: v.nature || undefined, taxCode: v.taxCode, lettrable: v.lettrable, bankReconcile: v.bankReconcile, analyticRequired: v.analyticRequired }); }, done: function (a) { App._accList = null; return 'Compte ' + a.num + ' créé.'; } });
  };
  A['account-edit'] = function (el) {
    var a = Y.account(S(), cid(), el.dataset.id); if (!a) return;
    var mv = Y.accountHasMovements(S(), cid(), a.num), leaf = Y.isLeaf(S(), cid(), a.num);
    var bal = Y.net(S(), cid(), a.num, { to: App.today() });
    App.form({ title: a.num + ' · ' + a.label, sub: 'Classe ' + a.cls + ' · ' + (leaf ? 'compte de détail' : 'compte de regroupement') + (a.custom ? ' · personnalisé' : ' · SYSCOHADA'),
      intro: (mv ? 'Compte mouvementé · solde ' + U.fmtDC(bal) + '. ' : 'Aucun mouvement. ') + (leaf ? '' : 'Compte de regroupement : la saisie se fait sur ses sous-comptes.'),
      fields: accFields(a), submit: 'Enregistrer', extraFoot: '<button type="button" class="btn" data-act="acc-gl" data-id="' + a.num + '">' + App.ic('livres') + 'Grand livre</button>' + (App.can('settings') && a.num.length < 8 ? '<button type="button" class="btn" data-act="account-new" data-parent="' + a.num + '">' + App.ic('plus') + 'Sous-compte</button>' : ''),
      onSubmit: function (v) { if (!App.can('settings')) throw new Y.BizError('Droit requis : ' + Y.RIGHTS.settings); if (!v.active && bal) throw new Y.BizError('Un compte non soldé ne peut pas être désactivé (solde ' + U.fmtDC(bal) + ').'); App._accList = null; return Y.updateAccount(S(), cid(), a.num, { label: v.label, labelEn: v.labelEn, sens: v.sens || a.sens, nature: v.nature || a.nature, taxCode: v.taxCode, lettrable: v.lettrable, bankReconcile: v.bankReconcile, analyticRequired: v.analyticRequired, active: v.active }); }, done: 'Compte mis à jour.' });
  };
  A['acc-gl'] = function (el) { App.ui.v.glAcc = el.dataset.id; App.go('livres', 'gl'); };

  /* -------------------------------------------------------------------- tiers */
  function tiersFields(t, type) {
    type = t ? t.type : (type || 'client');
    return [{ type: 'sep', label: 'Identité' },
      { k: 'type', label: 'Type', type: 'select', req: true, val: type, opts: [['client', 'Client'], ['fournisseur', 'Fournisseur'], ['personnel', 'Personnel (salarié)'], ['associe', 'Associé']], ro: !!t },
      { k: 'code', label: 'Code', val: t ? t.code : '', mono: true, ro: !!t, ph: 'Automatique (C0012, F0007…)' },
      { k: 'name', label: 'Raison sociale / nom', req: true, val: t ? t.name : '', span: true },
      { k: 'niu', label: 'NIU (numéro d’identifiant unique)', val: t ? t.niu : '', mono: true, ph: 'M0123456789012A', help: 'Obligatoire sur les factures B2B et pour la DSF.' },
      { k: 'rccm', label: 'RCCM', val: t ? t.rccm : '', mono: true, ph: 'RC/DLA/2021/B/0000' },
      { k: 'regime', label: 'Régime fiscal', type: 'select', val: t ? t.regime : 'Réel', opts: ['Réel', 'Simplifié', 'Impôt libératoire', 'Non assujetti', 'Administration', 'Étranger'] },
      { k: 'collective', label: 'Compte collectif', type: 'select', val: t ? t.collective : '', empty: 'Selon le type (4111, 4011, 422)', opts: Y.postableAccounts(S(), cid()).filter(function (a) { return a.nature === 'tiers' || /^4[0-8]/.test(a.num) && a.lettrable; }).map(function (a) { return [a.num, a.num + ' · ' + a.label]; }) },
      { type: 'sep', label: 'Contact et paiement' },
      { k: 'email', label: 'E-mail', type: 'email', val: t ? t.email : '' }, { k: 'phone', label: 'Téléphone', val: t ? t.phone : '', ph: '+237 6 …' },
      { k: 'momo', label: 'N° Mobile Money', val: t ? t.momo : '', ph: '+237 6 77 …' }, { k: 'momoOp', label: 'Opérateur', type: 'select', val: t ? t.momoOp : '', empty: '—', opts: [['MTN', 'MTN MoMo'], ['Orange', 'Orange Money']] },
      { k: 'address', label: 'Adresse', val: t ? t.address : '' }, { k: 'city', label: 'Ville', val: t ? t.city : 'Douala' },
      { k: 'country', label: 'Pays', type: 'select', val: t ? t.country : 'Cameroun', opts: ['Cameroun', 'Gabon', 'Congo', 'Tchad', 'République centrafricaine', 'Guinée équatoriale', 'Côte d’Ivoire', 'Sénégal', 'Bénin', 'Togo', 'Burkina Faso', 'Mali', 'Niger', 'France', 'Autre'] },
      { k: 'terms', label: 'Délai de paiement (jours)', type: 'number', val: t ? t.terms : 30 }, { k: 'creditLimit', label: 'Plafond de crédit (XAF)', type: 'money', val: t ? t.creditLimit : 0 },
      { k: 'notes', label: 'Notes internes', type: 'textarea', val: t ? t.notes : '', span: true }].concat(t ? [{ k: 'active', label: 'Tiers actif', type: 'check', val: t.active !== false }] : []);
  }
  A['tiers-new'] = function (el) {
    if (!App.guard('draft')) return;
    App.form({ title: 'Nouveau tiers', sub: 'Client, fournisseur, salarié ou associé', fields: tiersFields(null, el && el.dataset && el.dataset.type), wide: true, submit: 'Créer le tiers',
      onSubmit: function (v) { var o = Object.assign({}, v); if (!o.code) delete o.code; if (!o.collective) delete o.collective; o.terms = +o.terms || 0; o.creditLimit = o.creditLimit || 0; return Y.createTiers(S(), cid(), o); }, done: function (t) { return t.code + ' · ' + t.name + ' créé (collectif ' + t.collective + ').'; } });
  };
  A['tiers-edit'] = function (el) {
    var t = Y.tiers(S(), cid(), el.dataset.id);
    App.form({ title: 'Modifier · ' + t.name, sub: t.code + ' · ' + TYPES[t.type], fields: tiersFields(t), wide: true, submit: 'Enregistrer',
      onSubmit: function (v) {
        var errs = [];
        if (v.niu && !/^[A-Z0-9]{8,20}$/i.test(v.niu)) errs.push('NIU invalide : 8 à 20 caractères alphanumériques.');
        if (v.momo && !/^\+?\d[\d ]{7,20}$/.test(v.momo)) errs.push('Numéro Mobile Money invalide.');
        if (v.collective && v.collective !== t.collective && Y.validated(S(), cid()).some(function (e) { return e.lines.some(function (l) { return l.tiersId === t.id; }); })) errs.push('Ce tiers est mouvementé : son compte collectif ne peut plus changer.');
        if (errs.length) throw new Y.BizError(errs);
        ['name', 'niu', 'rccm', 'regime', 'email', 'phone', 'momo', 'momoOp', 'address', 'city', 'country', 'notes', 'active'].forEach(function (k) { t[k] = v[k]; });
        if (v.collective) t.collective = v.collective; t.terms = +v.terms || 0; t.creditLimit = v.creditLimit || 0;
        Y.audit(S(), cid(), 'Modification', 'Tiers ' + t.code, t.name);
      }, done: 'Fiche tiers mise à jour.' });
  };
  function tiersLines(t, from, to) { return Y.ledger(S(), cid(), t.collective.slice(0, 2), from, to, t.id); }
  A['tiers-open'] = function (el) {
    var t = Y.tiers(S(), cid(), el.dataset.id); if (!t) return;
    var y = App.year(), rows = tiersLines(t, y + '-01-01', App.today()), bal = rows.length ? rows[rows.length - 1].balance : 0;
    var aged = Y.agedBalance(S(), cid(), t.type === 'fournisseur' ? '401' : '411', App.today()).find(function (r) { return r.tiersId === t.id; });
    var docs = App.D().docs.filter(function (x) { return x.tiersId === t.id && x.num; }).slice(-8).reverse();
    var ca = 0; Y.eachLine(S(), cid(), function (l, e) { if (/^70/.test(l.account) && e.lines.some(function (z) { return z.tiersId === t.id; })) ca += l.credit - l.debit; }, { from: y + '-01-01', to: App.today(), excludeJournal: 'AN' });
    var body = '<div class="actions">' + App.chip(TYPES[t.type], 'info') + App.chip(t.active === false ? 'Inactif' : 'Actif', t.active === false ? '' : 'ok', true) + (t.creditLimit && Math.abs(bal) > t.creditLimit ? App.chip('Plafond dépassé', 'bad') : '') + '</div>' +
      '<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px"><div class="kpi"><span class="lbl">Solde ' + esc(t.collective) + '</span><span class="val" style="font-size:19px">' + U.fmtDC(bal) + '</span></div><div class="kpi"><span class="lbl">Dont échu</span><span class="val' + (aged && aged.total - aged.b[0] > 0 ? ' neg' : '') + '" style="font-size:19px">' + U.fmt(aged ? aged.total - aged.b[0] : 0) + '</span></div>' + (t.type === 'client' ? '<div class="kpi"><span class="lbl">CA HT ' + y + '</span><span class="val" style="font-size:19px">' + U.fmt(ca) + '</span></div>' : '') + '</div>' +
      '<dl class="kv"><dt>Code</dt><dd class="mono">' + esc(t.code) + '</dd><dt>NIU</dt><dd class="mono">' + esc(t.niu || '—') + '</dd><dt>RCCM</dt><dd class="mono">' + esc(t.rccm || '—') + '</dd><dt>Régime</dt><dd>' + esc(t.regime || '—') + '</dd><dt>E-mail</dt><dd>' + esc(t.email || '—') + '</dd><dt>Téléphone</dt><dd>' + esc(t.phone || '—') + '</dd><dt>Mobile Money</dt><dd>' + esc(t.momo ? t.momo + ' · ' + (t.momoOp || '') : '—') + '</dd><dt>Adresse</dt><dd>' + esc([t.address, t.city, t.country].filter(Boolean).join(', ') || '—') + '</dd><dt>Conditions</dt><dd>' + (t.terms || 0) + ' jours · plafond ' + U.fmt(t.creditLimit || 0) + '</dd></dl>' +
      (t.notes ? '<div class="callout">' + App.ic('chat') + '<span>' + esc(t.notes) + '</span></div>' : '') +
      '<h3 style="font-size:14px;margin:6px 0 0">Relevé de compte ' + y + '</h3><div class="tbl-wrap" style="border:1px solid var(--line);border-radius:12px;max-height:320px;overflow:auto"><table class="t"><thead><tr><th>Date</th><th>Pièce</th><th>Libellé</th><th>Let.</th><th class="num">Débit</th><th class="num">Crédit</th><th class="num">Solde</th></tr></thead><tbody>' +
      (rows.length ? rows.map(function (r) { return '<tr' + (r.opening ? ' class="sub"' : '') + '><td>' + App.date(r.date) + '</td><td><span class="mono">' + esc(r.num) + '</span></td><td>' + esc(r.label) + '</td><td class="mono">' + esc(r.letter || '') + '</td><td class="num">' + App.m0(r.debit) + '</td><td class="num">' + App.m0(r.credit) + '</td><td class="num">' + U.fmtDC(r.balance) + '</td></tr>'; }).join('') : '<tr><td colspan="7" class="muted">Aucun mouvement.</td></tr>') + '</tbody></table></div>' +
      (docs.length ? '<h3 style="font-size:14px;margin:6px 0 0">Derniers documents</h3><div class="list">' + docs.map(function (x) { var st = Y.docStatus(S(), cid(), x); return '<div><span class="mono" style="font-weight:700">' + esc(x.num) + '</span><span class="grow muted" style="font-size:12.5px">' + App.date(x.date) + '</span><span class="num">' + U.fmt(Y.docTotals(S(), cid(), x).ttc) + '</span>' + App.chip(st.label, st.tone) + '</div>'; }).join('') + '</div>' : '');
    var foot = '<button type="button" class="btn" data-act="tiers-pdf" data-id="' + t.id + '">' + App.ic('pdf') + 'Relevé PDF</button>' + (t.type === 'client' ? '<button type="button" class="btn" data-act="tiers-invoice" data-id="' + t.id + '"' + App.dis('invoice') + '>' + App.ic('ventes') + 'Facturer</button>' : '') + '<button type="button" class="btn pri" data-act="tiers-edit" data-id="' + t.id + '">Modifier</button>';
    App.drawer({ title: t.name, sub: t.code + ' · collectif ' + t.collective, body: body, foot: foot, wide: true, noFocus: true });
  };
  A['tiers-invoice'] = function (el) { App.closeDrawer(true); App.go('ventes', 'factures'); A['doc-new']({ dataset: { type: 'FA', tiers: el.dataset.id } }); };
  A['tiers-pdf'] = function (el) {
    var t = Y.tiers(S(), cid(), el.dataset.id), y = App.year(), rows = tiersLines(t, y + '-01-01', App.today());
    var doc = App.pdfDoc('Relevé de compte', t.code + ' · ' + t.name + ' · au ' + App.date(App.today())); if (!doc) return;
    doc.setFontSize(9); doc.setTextColor(18, 22, 46); doc.text([t.name, [t.address, t.city].filter(Boolean).join(', '), t.niu ? 'NIU ' + t.niu : ''].filter(Boolean), 40, doc._y); doc._y += 40;
    App.pdfAuto(doc, ['Date', 'Pièce', 'Libellé', 'Lettre', 'Débit', 'Crédit', 'Solde'], rows.map(function (r) { return [App.date(r.date), r.num, r.label, r.letter || '', U.fmt(r.debit, { zero: false }), U.fmt(r.credit, { zero: false }), U.fmtDC(r.balance)]; }), { numCols: [4, 5, 6], boldRow: function (r) { return /^Solde au/.test(r[2]); } });
    var bal = rows.length ? rows[rows.length - 1].balance : 0;
    doc.setFontSize(10.5); doc.setFont('helvetica', 'bold'); doc.text('Solde à ce jour : ' + U.fmtDC(bal) + ' XAF', 40, doc._y);
    App.pdfFinish(doc, 'releve_' + t.code + '_' + App.today() + '.pdf');
  };

  /* ------------------------------------------------------------- codes de taxe */
  function taxFields(x) {
    return [{ k: 'code', label: 'Code', req: true, val: x ? x.code : '', mono: true, ro: !!x }, { k: 'label', label: 'Libellé', req: true, val: x ? x.label : '', span: true },
      { k: 'rate', label: 'Taux global (%)', type: 'number', val: x ? x.rate : 19.25, help: 'Cameroun : 17,5 % + CAC 10 % du principal = 19,25 %.' }, { k: 'principal', label: 'Dont principal (%)', type: 'number', val: x ? x.principal : 17.5 }, { k: 'cac', label: 'Dont centimes additionnels (%)', type: 'number', val: x ? x.cac : 1.75 },
      { k: 'collect', label: 'Compte de TVA collectée', val: x ? x.collect : '4431', mono: true }, { k: 'deductGoods', label: 'TVA déductible biens et services', val: x ? x.deductGoods : '4452', mono: true }, { k: 'deductAssets', label: 'TVA déductible immobilisations', val: x ? x.deductAssets : '4451', mono: true },
      { k: 'validFrom', label: 'Applicable à partir du', type: 'date', val: x ? x.validFrom : App.today() }, { k: 'deductible', label: 'Ouvre droit à déduction', type: 'check', val: x ? x.deductible : true }, { k: 'active', label: 'Actif', type: 'check', val: x ? x.active : true }];
  }
  function saveTax(x, v) { if (Math.abs((+v.principal || 0) + (+v.cac || 0) - (+v.rate || 0)) > 0.001) throw new Y.BizError('Le taux global doit égaler principal + centimes additionnels.'); ['collect', 'deductGoods', 'deductAssets'].forEach(function (k) { if (v[k] && !Y.account(S(), cid(), v[k])) throw new Y.BizError('Le compte ' + v[k] + ' n’existe pas.'); }); Object.assign(x, v, { rate: +v.rate || 0, principal: +v.principal || 0, cac: +v.cac || 0 }); return x; }
  A['tax-new'] = function () { if (!App.guard('settings')) return; App.form({ title: 'Nouveau code de taxe', fields: taxFields(null), submit: 'Créer', done: 'Code de taxe créé.', onSubmit: function (v) { v.code = v.code.toUpperCase(); if (Y.taxCode(S(), cid(), v.code)) throw new Y.BizError('Code déjà utilisé.'); App.D().taxCodes.push(saveTax({}, v)); Y.audit(S(), cid(), 'Création', 'Code TVA ' + v.code, v.label); } }); };
  A['tax-edit'] = function (el) { var x = Y.taxCode(S(), cid(), el.dataset.id); App.form({ title: 'Code de taxe ' + x.code, intro: 'Un changement de taux s’applique aux nouvelles écritures uniquement ; les écritures validées conservent leurs montants.', fields: taxFields(x), submit: 'Enregistrer', done: 'Code de taxe mis à jour.', onSubmit: function (v) { if (!App.can('settings')) throw new Y.BizError('Droit requis : ' + Y.RIGHTS.settings); delete v.code; saveTax(x, v); Y.audit(S(), cid(), 'Modification', 'Code TVA ' + x.code, x.rate + ' %'); } }); };

  App.pages.plan = {
    render: function () {
      var d = App.D(), tab = App.tab('plan', 'comptes');
      var h = '<div class="page">' + App.head('Comptabilité · Référentiels', 'Plan comptable <span class="serif">&amp; tiers</span>', 'Plan SYSCOHADA révisé complet en 9 classes, bilingue français/anglais, extensible par sous-comptes. Les tiers sont rattachés à leur compte collectif.',
        tab === 'tiers' ? '<button type="button" class="btn acc" data-act="tiers-new"' + App.dis('draft') + '>' + App.ic('plus') + 'Tiers</button>' : (tab === 'taxes' ? '<button type="button" class="btn acc" data-act="tax-new"' + App.dis('settings') + '>' + App.ic('plus') + 'Code de taxe</button>' : '<button type="button" class="btn acc" data-act="account-new"' + App.dis('settings') + '>' + App.ic('plus') + 'Compte</button>'));
      h += App.tabs('plan', [['comptes', 'Plan comptable', d.accounts.length], ['tiers', 'Tiers', d.tiers.length], ['taxes', 'Codes de taxe', d.taxCodes.length]], 'comptes');
      if (tab === 'comptes') {
        var cls = App.v('plCls', ''), lang = App.v('plLang', 'fr'), show = App.v('plShow', 'all');
        var bal = Y.balances(S(), cid(), { to: App.today() });
        var rows = d.accounts.filter(function (a) { return (!cls || String(a.cls) === cls) && (show === 'all' || (show === 'custom' ? a.custom : (show === 'used' ? bal[a.num] : !a.active))); });
        h += '<div class="actions">' + App.filters('plCls', [['', 'Toutes']].concat([1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (c) { return [String(c), c + ' · ' + Y.CLASSES[c][0].replace(/^Comptes (de |d’)/, '')]; })), cls) + '</div><div class="actions">' + App.seg('plLang', [['fr', 'Français'], ['en', 'English'], ['both', 'FR + EN']], lang) + App.filters('plShow', [['all', 'Tous'], ['used', 'Mouvementés'], ['custom', 'Personnalisés'], ['off', 'Inactifs']], show) + '</div>';
        var cols = [{ k: 'num', label: 'Compte', fmt: function (v, a) { return '<span class="ac" style="padding-left:' + Math.max(0, v.length - 2) * 8 + 'px">' + esc(v) + '</span>'; } }];
        if (lang !== 'en') cols.push({ k: 'label', label: 'Intitulé', fmt: function (v, a) { return a.num.length <= 2 ? '<b>' + esc(v) + '</b>' : esc(v); } });
        if (lang !== 'fr') cols.push({ k: 'labelEn', label: 'Account name', fmt: function (v, a) { return a.num.length <= 2 ? '<b>' + esc(v) + '</b>' : esc(v); } });
        cols = cols.concat([{ k: 'nature', label: 'Nature', fmt: function (v) { return NAT[v] || v; } }, { k: 'sens', label: 'Sens' },
          { k: 'flags', label: 'Options', val: function (a) { return [a.lettrable ? 'Lettrable' : '', a.bankReconcile ? 'Rapprochable' : '', a.analyticRequired ? 'Analytique' : '', a.taxCode || ''].filter(Boolean).join(' · '); }, fmt: function (v, a) { return (a.lettrable ? App.chip('Lettrable', 'info') + ' ' : '') + (a.bankReconcile ? App.chip('Rapprochable', 'info') + ' ' : '') + (a.analyticRequired ? App.chip('Analytique', 'warn') + ' ' : '') + (a.taxCode ? App.chip(a.taxCode) : '') + (a.custom ? ' ' + App.chip('Perso', 'ok') : '') + (a.active ? '' : ' ' + App.chip('Inactif', 'bad')); } },
          { k: 'solde', label: 'Solde', num: true, val: function (a) { var b = bal[a.num]; return b ? b.d - b.c : 0; }, fmt: function (v) { return v ? U.fmtDC(v) : ''; } }]);
        h += '<div class="card flush">' + App.table('accounts', { exportName: 'plan_comptable_syscohada', pdf: true, title: 'Plan comptable SYSCOHADA révisé', rows: rows, rowId: function (a) { return a.num; }, rowAct: 'account-edit', pageSize: 80, cols: cols,
          groupBy: cls ? null : function (a) { return 'Classe ' + a.cls + ' · ' + esc(Y.CLASSES[a.cls][lang === 'en' ? 1 : 0]); }, placeholder: 'Numéro ou intitulé (ex. 445, Mobile Money, VAT)…' }) + '</div>';
      }
      if (tab === 'tiers') {
        var ty = App.v('tiType', 'all');
        var bal2 = {}; Y.eachLine(S(), cid(), function (l) { if (l.tiersId) bal2[l.tiersId] = (bal2[l.tiersId] || 0) + l.debit - l.credit; }, { to: App.today() });
        var trows = d.tiers.filter(function (t) { return ty === 'all' || t.type === ty; });
        h += '<div class="actions">' + App.filters('tiType', [['all', 'Tous'], ['client', 'Clients'], ['fournisseur', 'Fournisseurs'], ['personnel', 'Personnel'], ['associe', 'Associés']], ty) + '<button type="button" class="btn sm" style="margin-left:auto" data-act="go" data-page="imports" data-tab="import">' + App.ic('upload') + 'Importer des tiers</button></div>';
        h += '<div class="card flush">' + App.table('tiers', { exportName: 'tiers', rows: trows, rowAct: 'tiers-open', select: true,
          cols: [{ k: 'code', label: 'Code', fmt: function (v) { return '<span class="mono"><b>' + esc(v) + '</b></span>'; } }, { k: 'name', label: 'Raison sociale', fmt: function (v, t) { return '<b>' + esc(v) + '</b><br><span class="muted" style="font-size:12px">' + esc([t.city, t.email].filter(Boolean).join(' · ')) + '</span>'; } }, { k: 'type', label: 'Type', fmt: function (v) { return App.chip(TYPES[v] || v, v === 'client' ? 'info' : (v === 'fournisseur' ? 'warn' : '')); } },
            { k: 'niu', label: 'NIU', fmt: function (v) { return v ? '<span class="mono">' + esc(v) + '</span>' : '<span class="muted">—</span>'; } }, { k: 'collective', label: 'Collectif', fmt: function (v) { return '<span class="ac">' + esc(v) + '</span>'; } }, { k: 'momo', label: 'Mobile Money', fmt: function (v, t) { return v ? esc(v) + ' <span class="muted">' + esc(t.momoOp || '') + '</span>' : ''; } },
            { k: 'terms', label: 'Délai', num: true, fmt: function (v) { return v + ' j'; } }, { k: 'solde', label: 'Solde', num: true, val: function (t) { return bal2[t.id] || 0; }, fmt: function (v) { return v ? '<b>' + U.fmtDC(v) + '</b>' : ''; } }] }) + '</div>';
      }
      if (tab === 'taxes') {
        h += '<div class="card flush">' + App.table('taxes', { exportName: 'codes_taxe', rows: d.taxCodes, rowId: function (x) { return x.code; }, rowAct: 'tax-edit',
          cols: [{ k: 'code', label: 'Code', fmt: function (v) { return '<span class="mono"><b>' + esc(v) + '</b></span>'; } }, { k: 'label', label: 'Libellé' }, { k: 'rate', label: 'Taux', num: true, fmt: function (v) { return String(v).replace('.', ',') + ' %'; } }, { k: 'principal', label: 'Principal', num: true, fmt: function (v) { return String(v).replace('.', ',') + ' %'; } }, { k: 'cac', label: 'CAC', num: true, fmt: function (v) { return String(v).replace('.', ',') + ' %'; } },
            { k: 'collect', label: 'Collectée' }, { k: 'deductGoods', label: 'Déductible B&S' }, { k: 'deductAssets', label: 'Déductible immo.' }, { k: 'active', label: 'État', fmt: function (v) { return App.chip(v ? 'Actif' : 'Inactif', v ? 'ok' : '', true); } }] }) + '</div>';
        h += '<div class="callout info">' + App.ic('fiscalite') + '<span>Paramétrage par défaut Cameroun (CGI) : TVA 17,5 % majorée de 10 % de centimes additionnels communaux, soit 19,25 %. Les taux des autres pays de la zone (CEMAC, UEMOA) se créent ici. À faire valider par votre expert-comptable.</span></div>';
      }
      return h + '</div>';
    }
  };
})();

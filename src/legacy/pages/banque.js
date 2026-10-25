/* Trésorerie : comptes bancaires, MTN MoMo, Orange Money et caisse ; rapprochement, règles, état de rapprochement, virements internes, arrêté de caisse. */
(function () {
  'use strict';
  var Y = window.Yiel, U = Y.util, App = window.App, esc = App.esc, A = App.actions;
  function S() { return App.S; } function cid() { return App.cid(); }
  var KIND = { bank: 'Banque', momo: 'Mobile Money', cash: 'Caisse' };

  function bankFields(b) {
    return [{ k: 'label', label: 'Nom du compte', req: true, val: b ? b.label : '', span: true, ph: 'Ex. Banque principale, MTN MoMo marchand' },
      { k: 'kind', label: 'Type', type: 'select', req: true, val: b ? b.kind : 'bank', opts: [['bank', 'Compte bancaire'], ['momo', 'Mobile Money (MTN, Orange)'], ['cash', 'Caisse']], ro: !!b },
      { k: 'account', label: 'Compte comptable', req: true, val: b ? b.account : '', mono: true, ph: '5213, 5523, 5712…', help: 'Sous-compte de 52 (banques), 55 (monnaie électronique) ou 57 (caisse).', ro: !!b },
      { k: 'provider', label: 'Établissement ou opérateur', val: b ? b.provider : '' }, { k: 'iban', label: 'RIB / IBAN ou n° marchand', val: b ? b.iban : '', mono: true },
      { k: 'syncMode', label: 'Alimentation', type: 'select', val: b ? b.syncMode : 'import', opts: [['api', 'Connexion directe (API)'], ['import', 'Import de relevés'], ['manual', 'Saisie manuelle / arrêté de caisse']] },
      { k: 'alertBelow', label: 'Alerte si solde inférieur à (XAF)', type: 'money', val: b ? b.alertBelow : '' },
      { k: 'openingStatement', label: 'Solde d’ouverture du relevé (XAF)', type: 'money', val: b ? b.openingStatement : 0, help: 'Point de départ du rapprochement.' }];
  }
  A['bank-new'] = function () { if (!App.guard('settings')) return; App.form({ title: 'Nouveau compte de trésorerie', sub: 'Un journal de trésorerie dédié est créé automatiquement.', fields: bankFields(null), submit: 'Créer le compte', done: function (b) { return 'Compte ' + b.account + ' créé · journal ' + b.journal + '.'; }, onSubmit: function (v) { return Y.createBankAccount(S(), cid(), v); } }); };
  A['bank-edit'] = function (el) { var b = Y.bankAccount(S(), cid(), el.dataset.id); App.form({ title: 'Paramètres · ' + b.label, sub: 'Compte ' + b.account + ' · journal ' + b.journal, fields: bankFields(b), submit: 'Enregistrer', done: 'Paramètres enregistrés.', onSubmit: function (v) { ['label', 'provider', 'iban', 'syncMode', 'alertBelow', 'openingStatement'].forEach(function (k) { b[k] = v[k]; }); Y.audit(S(), cid(), 'Modification', 'Trésorerie ' + b.account, b.label); } }); };
  A['bank-sync'] = function (el) { if (!App.guard('bank')) return; var b = Y.bankAccount(S(), cid(), el.dataset.id); b.lastSync = new Date().toISOString(); App.persist(); App.toast(b.label + ' : connexion vérifiée, aucune nouvelle transaction depuis la dernière synchronisation. (Démonstration : en production, l’API de la banque ou de l’opérateur alimente le relevé.)', 'ok'); App.render(); };
  A['bank-import'] = function (el) { App.ui.v.impType = 'bank'; App.ui.v.impBank = el.dataset.id; App.ui.v.impStep = 2; App.go('imports', 'import'); };
  A['bank-rappro'] = function (el) { App.ui.v.rpBank = el.dataset.id; App.go('banque', 'rappro'); };
  A['transfer-new'] = function () {
    if (!App.guard('bank')) return;
    var bks = App.D().bankAccounts.map(function (b) { return [b.id, b.account + ' · ' + b.label]; });
    App.form({ title: 'Virement interne', sub: 'Banque ↔ Mobile Money ↔ caisse, via le compte 585 Virements de fonds.', fields: [{ k: 'from', label: 'Depuis', type: 'select', opts: bks, req: true }, { k: 'to', label: 'Vers', type: 'select', opts: bks, val: bks[1] && bks[1][0], req: true }, { k: 'amount', label: 'Montant (XAF)', type: 'money', req: true }, { k: 'date', label: 'Date', type: 'date', val: App.today(), req: true }, { k: 'label', label: 'Libellé', val: 'Virement interne', span: true }],
      submit: 'Passer le virement', live: function (v) { var a = Y.bankAccount(S(), cid(), v.from), b = Y.bankAccount(S(), cid(), v.to); if (!a || !b) return ''; return '<div class="mini-entry">' + a.journal + ' : 585 D ' + U.fmt(v.amount || 0) + ' / ' + a.account + ' C\n' + b.journal + ' : ' + b.account + ' D ' + U.fmt(v.amount || 0) + ' / 585 C</div>'; },
      onSubmit: function (v) {
        if (v.from === v.to) throw new Y.BizError('Choisissez deux comptes différents.');
        var a = Y.bankAccount(S(), cid(), v.from), b = Y.bankAccount(S(), cid(), v.to), ref = 'VI-' + v.date.replace(/-/g, '');
        Y.postEntry(S(), cid(), { journal: a.journal, date: v.date, ref: ref, label: v.label + ' vers ' + b.label, source: 'transfer', lines: [{ account: '585', debit: v.amount, credit: 0 }, { account: a.account, debit: 0, credit: v.amount }] });
        return Y.postEntry(S(), cid(), { journal: b.journal, date: v.date, ref: ref, label: v.label + ' depuis ' + a.label, source: 'transfer', lines: [{ account: b.account, debit: v.amount, credit: 0 }, { account: '585', debit: 0, credit: v.amount }] });
      }, done: 'Virement interne passé : deux écritures liées par le compte 585.' });
  };
  var DENOM = [[10000, 'Billet'], [5000, 'Billet'], [2000, 'Billet'], [1000, 'Billet'], [500, 'Billet'], [500, 'Pièce'], [100, 'Pièce'], [50, 'Pièce'], [25, 'Pièce'], [10, 'Pièce'], [5, 'Pièce'], [2, 'Pièce'], [1, 'Pièce']];
  A['cash-count'] = function (el) {
    if (!App.guard('bank')) return;
    var b = Y.bankAccount(S(), cid(), el.dataset.id), book = Y.net(S(), cid(), b.account, { to: App.today() });
    var f = [{ k: 'date', label: 'Date de l’arrêté', type: 'date', val: App.today(), req: true }, { type: 'sep', label: 'Billetage' }].concat(DENOM.map(function (d, i) { return { k: 'n' + i, label: d[1] + ' de ' + U.fmt(d[0]), type: 'number', val: '' }; }));
    function count(v) { return DENOM.reduce(function (t, d, i) { return t + (+v['n' + i] || 0) * d[0]; }, 0); }
    App.form({ title: 'Arrêté de caisse · ' + b.label, sub: 'Solde comptable au ' + App.date(App.today()) + ' : ' + U.fmt(book) + ' XAF', fields: f, wide: true, submit: 'Enregistrer l’arrêté',
      live: function (v) { var c = count(v), g = c - book; return '<div class="balance-bar ' + (g ? 'bad' : 'ok') + '">' + App.ic(g ? 'x' : 'check') + 'Compté : ' + U.fmt(c) + ' XAF · solde comptable : ' + U.fmt(book) + ' XAF · écart : ' + U.fmt(g) + (g ? (g < 0 ? ' (manquant : 658 D / ' + b.account + ' C)' : ' (excédent : ' + b.account + ' D / 758 C)') : '') + '</div>'; },
      onSubmit: function (v) {
        var c = count(v), g = c - book, d = App.D();
        d.cashCounts = d.cashCounts || []; d.cashCounts.push({ date: v.date, bank: b.account, counted: c, book: book, gap: g, by: App.user().name });
        b.lastSync = new Date().toISOString();
        if (g) Y.postEntry(S(), cid(), { journal: b.journal, date: v.date, ref: 'ARRETE-' + v.date, label: (g < 0 ? 'Manquant' : 'Excédent') + ' de caisse constaté à l’arrêté', source: 'cash-count', lines: g < 0 ? [{ account: '658', debit: -g, credit: 0, section: 'STR' }, { account: b.account, debit: 0, credit: -g }] : [{ account: b.account, debit: g, credit: 0 }, { account: '758', debit: 0, credit: g }] });
        Y.audit(S(), cid(), 'Arrêté de caisse', b.account, 'Compté ' + U.fmt(c) + ' · écart ' + U.fmt(g));
        return g;
      }, done: function (g) { return g ? 'Arrêté enregistré et écart comptabilisé (' + U.fmt(g) + ' XAF).' : 'Arrêté enregistré : caisse juste.'; } });
  };

  /* ------------------------------------------------------------ rapprochement */
  function curBank() { var d = App.D(), id = App.v('rpBank', null); var b = d.bankAccounts.find(function (x) { return x.id === id; }) || d.bankAccounts.find(function (x) { return x.kind !== 'cash'; }); return b; }
  A['rp-tx'] = function (el) { App.ui.v.rpTx = App.ui.v.rpTx === el.dataset.id ? null : el.dataset.id; App.render(); };
  A['rp-bk'] = function (el) { var k = el.dataset.id + '|' + el.dataset.i; App.ui.v.rpBk = App.ui.v.rpBk === k ? null : k; App.render(); };
  A['rp-match'] = function () { if (!App.guard('bank')) return; var p = App.ui.v.rpBk.split('|'); App.run(function () { return Y.reconcile(S(), cid(), App.ui.v.rpTx, p[0], +p[1]); }, 'Rapprochement enregistré.'); App.ui.v.rpTx = null; App.ui.v.rpBk = null; App.render(); };
  A['rp-auto'] = function () { if (!App.guard('bank')) return; var b = curBank(); App.run(function () { return Y.autoReconcile(S(), cid(), b.id); }, function (n) { return n + ' rapprochement(s) automatique(s) par montant, date (± 10 jours) et référence.'; }); };
  A['rp-undo'] = function (el) { App.run(function () { Y.unreconcile(S(), cid(), el.dataset.id); }, 'Rapprochement annulé.'); };
  A['rp-create'] = function () {
    if (!App.guard('bank')) return;
    var tx = App.D().bankTx.find(function (t) { return t.id === App.ui.v.rpTx; }); var r = Y.ruleFor(S(), cid(), tx);
    var acc = Y.postableAccounts(S(), cid()).filter(function (a) { return !/^5[25]/.test(a.num); }).map(function (a) { return [a.num, a.num + ' · ' + a.label]; });
    App.form({ title: 'Créer l’écriture depuis le relevé', sub: App.date(tx.date) + ' · ' + tx.label + ' · ' + U.fmt(tx.amount) + ' XAF', intro: r ? 'Règle reconnue : « ' + esc(r.label || r.contains) + ' » → compte ' + esc(r.account) + '.' : '',
      fields: [{ k: 'account', label: 'Compte de contrepartie', type: 'select', req: true, opts: acc, val: r ? r.account : (tx.amount > 0 ? '4111' : '6055') }, { k: 'tiersId', label: 'Tiers (comptes 40, 41, 42…)', type: 'select', empty: '—', opts: App.D().tiers.map(function (t) { return [t.id, t.code + ' · ' + t.name]; }) },
        { k: 'taxCode', label: 'TVA incluse dans le montant', type: 'select', empty: 'Aucune', opts: App.D().taxCodes.filter(function (t) { return t.rate; }).map(function (t) { return [t.code, t.code]; }), val: r ? (r.taxCode === 'HC' ? '' : r.taxCode) : '' }, { k: 'section', label: 'Section analytique', type: 'select', empty: '—', val: r ? r.section : '', opts: App.D().sections.map(function (s) { return [s.code, s.code + ' · ' + s.label]; }) },
        { k: 'label', label: 'Libellé', val: tx.label, span: true }],
      submit: 'Créer et rapprocher', onSubmit: function (v) { return Y.createFromTx(S(), cid(), tx.id, v); }, done: function (e) { App.ui.v.rpTx = null; return 'Écriture ' + e.num + ' créée et rapprochée.'; } });
  };

  /* ------------------------------------------------------------------- règles */
  function ruleFields(r) {
    return [{ k: 'label', label: 'Nom de la règle', req: true, val: r ? r.label : '', span: true }, { k: 'contains', label: 'Si le libellé ou la référence contient', req: true, val: r ? r.contains : '', mono: true },
      { k: 'sign', label: 'Sens du mouvement', type: 'select', val: r ? r.sign : '', opts: [['', 'Indifférent'], ['in', 'Encaissement'], ['out', 'Décaissement']] },
      { k: 'accounts', label: 'Comptes de trésorerie concernés', val: r ? (r.accounts || []).join(', ') : '', ph: '5211, 5521 (vide = tous)' },
      { k: 'account', label: 'Imputer au compte', req: true, val: r ? r.account : '', mono: true, list: 'acc_list' }, { k: 'taxCode', label: 'Code TVA', type: 'select', val: r ? r.taxCode : 'HC', opts: App.D().taxCodes.map(function (t) { return [t.code, t.code]; }) },
      { k: 'section', label: 'Section analytique', type: 'select', empty: '—', val: r ? r.section : '', opts: App.D().sections.map(function (s) { return [s.code, s.code + ' · ' + s.label]; }) }, { k: 'active', label: 'Règle active', type: 'check', val: r ? r.active : true }];
  }
  function saveRule(r, v) { if (!Y.account(S(), cid(), v.account)) throw new Y.BizError('Le compte ' + v.account + ' n’existe pas.'); Object.assign(r, { label: v.label, contains: v.contains, sign: v.sign, accounts: v.accounts ? v.accounts.split(/[,; ]+/).filter(Boolean) : [], account: v.account, taxCode: v.taxCode, section: v.section, active: v.active }); return r; }
  A['rule-new'] = function () { if (!App.guard('settings')) return; App.form({ title: 'Nouvelle règle d’affectation', sub: 'Proposée à chaque ligne de relevé correspondante ; la validation reste manuelle.', fields: ruleFields(null), submit: 'Créer la règle', done: 'Règle créée.', after: App.accDatalist(), onSubmit: function (v) { App.D().bankRules.push(saveRule({ id: U.uid('r'), uses: 0 }, v)); } }); };
  A['rule-edit'] = function (el) { var r = App.D().bankRules.find(function (x) { return x.id === el.dataset.id; }); App.form({ title: 'Règle · ' + r.label, fields: ruleFields(r), submit: 'Enregistrer', done: 'Règle mise à jour.', after: App.accDatalist(), extraFoot: '<button type="button" class="btn danger" data-act="rule-del" data-id="' + r.id + '">Supprimer</button>', onSubmit: function (v) { saveRule(r, v); } }); };
  A['rule-del'] = function (el) { var d = App.D(); App.closeDrawer(true); App._form = null; App.run(function () { d.bankRules = d.bankRules.filter(function (x) { return x.id !== el.dataset.id; }); }, 'Règle supprimée.'); };

  A['recon-pdf'] = function () {
    var b = curBank(), date = App.v('rsDate', App.today()), r = Y.reconState(S(), cid(), b.id, date);
    var doc = App.pdfDoc('État de rapprochement', b.account + ' · ' + b.label + ' · au ' + App.date(date)); if (!doc) return;
    App.pdfAuto(doc, ['Côté banque', 'Montant'], [['Solde du relevé', U.fmt(r.statement)]].concat(r.openBook.map(function (x) { return ['+/− ' + x.num + ' · ' + x.label + ' (non encore au relevé)', U.fmt(x.amount)]; })).concat([['Solde bancaire rectifié', U.fmt(r.statementAdj)]]), { numCols: [1], boldRow: function (x) { return /rectifié|Solde du/.test(x[0]); } });
    App.pdfAuto(doc, ['Côté comptabilité', 'Montant'], [['Solde comptable ' + b.account, U.fmt(r.book)]].concat(r.openTx.map(function (x) { return ['+/− ' + App.date(x.date) + ' · ' + x.label + ' (non comptabilisé)', U.fmt(x.amount)]; })).concat([['Solde comptable rectifié', U.fmt(r.bookAdj)]]), { numCols: [1], boldRow: function (x) { return /rectifié|Solde comptable/.test(x[0]); } });
    doc.setFontSize(10); doc.setTextColor(18, 22, 46); doc.text('Écart : ' + U.fmt(r.gap) + ' XAF ' + (r.gap ? '(à analyser)' : '· rapprochement concordant'), 40, doc._y);
    App.pdfFinish(doc, 'etat_rapprochement_' + b.account + '_' + date + '.pdf');
  };

  App.pages.banque = {
    render: function () {
      var d = App.D(), tab = App.tab('banque', 'comptes');
      var open = d.bankTx.filter(function (t) { return t.status === 'open'; }).length;
      var h = '<div class="page">' + App.head('Comptabilité · Trésorerie', 'Trésorerie <span class="serif">&amp; Mobile Money</span>', 'Banques en compte 52, MTN MoMo et Orange Money en compte 55 (instruments de monnaie électronique), caisse en 57.',
        '<button type="button" class="btn" data-act="transfer-new"' + App.dis('bank') + '>' + App.ic('refresh') + 'Virement interne</button><button type="button" class="btn acc" data-act="bank-new"' + App.dis('settings') + '>' + App.ic('plus') + 'Compte de trésorerie</button>');
      h += App.tabs('banque', [['comptes', 'Comptes', d.bankAccounts.length], ['rappro', 'Rapprochement', open], ['etat', 'État de rapprochement'], ['regles', 'Règles d’affectation', d.bankRules.length], ['caisse', 'Arrêtés de caisse', (d.cashCounts || []).length]], 'comptes');
      if (tab === 'comptes') {
        h += '<div class="grid g3">' + d.bankAccounts.map(function (b) {
          var book = Y.net(S(), cid(), b.account, { to: App.today() }), rs = b.kind !== 'cash' ? Y.reconState(S(), cid(), b.id) : null;
          var openN = d.bankTx.filter(function (t) { return t.bankId === b.id && t.status === 'open'; }).length;
          var low = b.alertBelow && book < b.alertBelow;
          return '<div class="card" style="display:flex;flex-direction:column;gap:12px"><div style="display:flex;gap:10px;align-items:center"><span style="width:42px;height:42px;border-radius:12px;background:var(--navy);color:#fff;display:inline-flex;align-items:center;justify-content:center">' + App.ic(b.kind === 'momo' ? 'phone' : (b.kind === 'cash' ? 'money' : 'banque')) + '</span><span style="flex:1;min-width:0"><b>' + esc(b.label) + '</b><br><span class="muted" style="font-size:12px"><span class="ac">' + esc(b.account) + '</span> · journal ' + esc(b.journal) + ' · ' + esc(b.provider || KIND[b.kind]) + '</span></span>' + App.chip(b.syncMode === 'api' ? 'Connecté' : (b.syncMode === 'import' ? 'Import' : 'Manuel'), b.syncMode === 'api' ? 'ok' : '', true) + '</div>' +
            '<div class="grid" style="grid-template-columns:repeat(2,minmax(0,1fr));gap:10px"><div class="kpi"><span class="lbl">Solde comptable</span><span class="val' + (low ? ' neg' : '') + '" style="font-size:20px">' + U.fmt(book) + '</span></div><div class="kpi"><span class="lbl">' + (rs ? 'Solde du relevé' : 'Dernier arrêté') + '</span><span class="val" style="font-size:20px">' + (rs ? U.fmt(rs.statement) : ((d.cashCounts || []).filter(function (c) { return c.bank === b.account; }).slice(-1).map(function (c) { return U.fmt(c.counted); })[0] || '—')) + '</span></div></div>' +
            (low ? '<div class="callout warn" style="padding:8px 10px;font-size:12.5px">' + App.ic('bell') + 'Solde sous le seuil d’alerte de ' + U.fmt(b.alertBelow) + ' XAF.</div>' : '') +
            '<div class="muted" style="font-size:12.5px">' + (rs ? openN + ' ligne(s) de relevé à rapprocher · écart rectifié ' + U.fmt(rs.gap) : 'Comptez la caisse pour la justifier.') + (b.lastSync ? ' · mis à jour le ' + new Date(b.lastSync).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '') + '</div>' +
            '<div class="actions">' + (b.kind === 'cash' ? '<button type="button" class="btn sm pri" data-act="cash-count" data-id="' + b.id + '"' + App.dis('bank') + '>Arrêté de caisse</button>' : (b.syncMode === 'api' ? '<button type="button" class="btn sm pri" data-act="bank-sync" data-id="' + b.id + '"' + App.dis('bank') + '>' + App.ic('refresh') + 'Synchroniser</button>' : '') + '<button type="button" class="btn sm" data-act="bank-import" data-id="' + b.id + '"' + App.dis('import') + '>' + App.ic('upload') + 'Importer un relevé</button><button type="button" class="btn sm" data-act="bank-rappro" data-id="' + b.id + '">Rapprocher</button>') + '<button type="button" class="btn sm ghost" data-act="bank-edit" data-id="' + b.id + '"' + App.dis('settings') + '>Paramètres</button></div></div>';
        }).join('') + '</div>';
      }
      if (tab === 'rappro') {
        var b = curBank(); App.ui.v.rpBank = b.id;
        var txs = d.bankTx.filter(function (t) { return t.bankId === b.id && t.status === 'open'; }).sort(function (x, y) { return x.date < y.date ? 1 : -1; });
        var book = Y.unreconciledBookLines(S(), cid(), b.id).filter(function (x) { return x.date >= (b.reconFrom || '0000'); }).sort(function (x, y) { return x.date < y.date ? 1 : -1; });
        var selTx = txs.find(function (t) { return t.id === App.ui.v.rpTx; }), selBk = App.ui.v.rpBk ? book.find(function (x) { return x.entryId + '|' + x.idx === App.ui.v.rpBk; }) : null;
        if (selTx) { book.forEach(function (x) { x.match = x.amount === selTx.amount; }); book.sort(function (x, y) { return (y.match ? 1 : 0) - (x.match ? 1 : 0); }); }
        h += '<div class="actions">' + App.seg('rpBank', d.bankAccounts.filter(function (x) { return x.kind !== 'cash'; }).map(function (x) { return [x.id, x.account + ' · ' + x.label]; }), b.id) + '<button type="button" class="btn sm" style="margin-left:auto" data-act="rp-auto"' + App.dis('bank') + '>' + App.ic('wand') + 'Rapprochement automatique</button></div>';
        h += '<div class="row"><div class="card flush grow" style="flex-basis:380px"><div class="card-h"><h2>Relevé · à rapprocher</h2><span class="sub">' + txs.length + ' ligne(s)</span></div><div class="list" style="padding:0 10px 10px;max-height:560px;overflow:auto">' + (txs.length ? txs.map(function (t) { var r = Y.ruleFor(S(), cid(), t); return '<button type="button" class="item" style="' + (selTx && selTx.id === t.id ? 'background:var(--brand-soft)' : '') + '" data-act="rp-tx" data-id="' + t.id + '"><span class="grow"><span class="muted" style="font-size:12px">' + App.date(t.date) + ' · <span class="mono">' + esc(t.ref) + '</span>' + (r ? ' · ' + App.chip('Règle : ' + (r.label || r.contains), 'info') : '') + '</span><br><b style="font-size:13px">' + esc(t.label) + '</b></span><span class="num" style="font-weight:800;color:' + (t.amount > 0 ? 'var(--ok)' : 'var(--bad)') + '">' + (t.amount > 0 ? '+' : '') + U.fmt(t.amount) + '</span></button>'; }).join('') : '<div class="empty"><b>Relevé entièrement rapproché</b>Importez un nouveau relevé ou synchronisez le compte.</div>') + '</div></div>';
        h += '<div class="card flush grow" style="flex-basis:380px"><div class="card-h"><h2>Écritures non rapprochées</h2><span class="sub">compte ' + esc(b.account) + '</span></div><div class="list" style="padding:0 10px 10px;max-height:560px;overflow:auto">' + (book.length ? book.map(function (x) { return '<button type="button" class="item" style="' + (selBk && selBk === x ? 'background:var(--brand-soft)' : (x.match ? 'background:var(--ok-bg)' : '')) + '" data-act="rp-bk" data-id="' + x.entryId + '" data-i="' + x.idx + '"><span class="grow"><span class="muted" style="font-size:12px"><span class="mono">' + esc(x.num) + '</span> · ' + App.date(x.date) + (x.match ? ' · ' + App.chip('Même montant', 'ok') : '') + '</span><br><b style="font-size:13px">' + esc(x.label) + '</b></span><span class="num" style="font-weight:800;color:' + (x.amount > 0 ? 'var(--ok)' : 'var(--bad)') + '">' + (x.amount > 0 ? '+' : '') + U.fmt(x.amount) + '</span></button>'; }).join('') : '<div class="empty"><b>Aucune écriture en attente</b></div>') + '</div></div>';
        var can = selTx && selBk && selTx.amount === selBk.amount;
        h += '<div class="card side" style="display:flex;flex-direction:column;gap:12px;flex-basis:280px"><h2 style="font-size:15.5px">Action</h2><div style="font-size:13.5px;line-height:1.5">' + (selTx && selBk ? (can ? 'Montants identiques : ' + U.fmt(selTx.amount) + ' XAF.' : 'Montants différents : ' + U.fmt(selTx.amount) + ' au relevé, ' + U.fmt(selBk.amount) + ' en comptabilité.') : (selTx ? 'Sélectionnez l’écriture correspondante, ou créez-la depuis le relevé.' : 'Sélectionnez une ligne du relevé.')) + '</div>' +
          '<button type="button" class="btn acc" data-act="rp-match"' + (can ? App.dis('bank') : ' disabled') + '>' + App.ic('link') + 'Rapprocher</button><button type="button" class="btn" data-act="rp-create"' + (selTx && !selBk ? App.dis('bank') : ' disabled') + '>Créer l’écriture depuis le relevé</button>' +
          '<div style="border-top:1px solid var(--line-2);padding-top:12px;font-size:12.5px;color:var(--muted)">' + d.bankTx.filter(function (t) { return t.bankId === b.id && t.status === 'matched'; }).length + ' ligne(s) déjà rapprochée(s) sur ce compte.</div></div></div>';
        var done = d.bankTx.filter(function (t) { return t.bankId === b.id && t.status === 'matched'; }).sort(function (x, y) { return x.date < y.date ? 1 : -1; });
        h += '<div class="card flush"><div class="card-h"><h2>Rapprochements effectués</h2></div>' + App.table('rpDone', { exportName: 'rapprochements_' + b.account, rows: done, pageSize: 10,
          cols: [{ k: 'date', label: 'Date', fmt: App.date }, { k: 'label', label: 'Libellé du relevé' }, { k: 'ref', label: 'Référence', fmt: function (v) { return '<span class="mono">' + esc(v) + '</span>'; } }, { k: 'entry', label: 'Écriture', val: function (r) { var e = Y.entry(S(), cid(), r.entryId); return e ? e.num : ''; }, fmt: function (v) { return '<span class="ac">' + esc(v) + '</span>'; } }, { k: 'amount', label: 'Montant', num: true, fmt: function (v) { return U.fmt(v); } }],
          rowActions: function (r) { return '<button type="button" class="btn xs" data-act="rp-undo" data-id="' + r.id + '"' + App.dis('bank') + '>' + App.ic('unlink') + 'Annuler</button>'; } }) + '</div>';
      }
      if (tab === 'etat') {
        var b2 = curBank(), date = App.v('rsDate', App.today()), r = Y.reconState(S(), cid(), b2.id, date);
        h += '<div class="actions">' + App.seg('rpBank', d.bankAccounts.filter(function (x) { return x.kind !== 'cash'; }).map(function (x) { return [x.id, x.account + ' · ' + x.label]; }), b2.id) + '<label class="fld" style="flex-direction:row;align-items:center;gap:8px"><span>Au</span><input class="in" type="date" id="rs_date" data-change="rs-date" value="' + date + '" style="width:auto"></label><button type="button" class="btn sm" style="margin-left:auto" data-act="recon-pdf">' + App.ic('pdf') + 'Exporter l’état (PDF)</button></div>';
        h += '<div class="row"><div class="card flush grow" style="flex-basis:420px"><div class="card-h"><h2>Côté banque</h2></div><table class="t"><tbody><tr class="sub"><td>Solde du relevé au ' + App.date(date) + '</td><td class="num">' + U.fmt(r.statement) + '</td></tr>' + r.openBook.map(function (x) { return '<tr><td>' + esc(x.num) + ' · ' + esc(x.label) + ' <span class="muted">(passée en comptabilité, absente du relevé)</span></td><td class="num">' + (x.amount > 0 ? '+' : '') + U.fmt(x.amount) + '</td></tr>'; }).join('') + '<tr class="tot"><td>Solde bancaire rectifié</td><td class="num">' + U.fmt(r.statementAdj) + '</td></tr></tbody></table></div>';
        h += '<div class="card flush grow" style="flex-basis:420px"><div class="card-h"><h2>Côté comptabilité</h2></div><table class="t"><tbody><tr class="sub"><td>Solde comptable ' + esc(b2.account) + '</td><td class="num">' + U.fmt(r.book) + '</td></tr>' + r.openTx.map(function (x) { return '<tr><td>' + App.date(x.date) + ' · ' + esc(x.label) + ' <span class="muted">(au relevé, non comptabilisé)</span></td><td class="num">' + (x.amount > 0 ? '+' : '') + U.fmt(x.amount) + '</td></tr>'; }).join('') + '<tr class="tot"><td>Solde comptable rectifié</td><td class="num">' + U.fmt(r.bookAdj) + '</td></tr></tbody></table></div></div>';
        h += '<div class="callout ' + (r.gap ? 'warn' : 'ok') + '">' + App.ic(r.gap ? 'x' : 'check') + '<span><b>Écart : ' + U.fmt(r.gap) + ' XAF.</b> ' + (r.gap ? 'Un écart subsiste : vérifiez le solde d’ouverture du relevé et les lignes saisies deux fois.' : 'Le rapprochement est concordant. Les lignes « non comptabilisées » se traitent depuis l’onglet Rapprochement.') + '</span></div>';
      }
      if (tab === 'regles') {
        h += '<div class="card flush">' + App.table('rules', { exportName: 'regles_affectation', rows: d.bankRules, rowAct: 'rule-edit', toolbar: '<button type="button" class="btn sm acc" data-act="rule-new"' + App.dis('settings') + '>' + App.ic('plus') + 'Règle</button>',
          cols: [{ k: 'active', label: 'État', fmt: function (v) { return App.chip(v ? 'Active' : 'Inactive', v ? 'ok' : '', true); } }, { k: 'label', label: 'Règle' }, { k: 'contains', label: 'Si le libellé contient', fmt: function (v) { return '<span class="mono">' + esc(v) + '</span>'; } }, { k: 'sign', label: 'Sens', fmt: function (v) { return v === 'in' ? 'Encaissement' : (v === 'out' ? 'Décaissement' : 'Indifférent'); } },
            { k: 'accounts', label: 'Comptes', val: function (r) { return (r.accounts || []).join(', ') || 'Tous'; } }, { k: 'account', label: 'Imputation', fmt: function (v) { return '<span class="ac">' + esc(v) + '</span> ' + esc(Y.accountLabel(S(), cid(), v)); } }, { k: 'taxCode', label: 'TVA' }, { k: 'section', label: 'Section' }, { k: 'uses', label: 'Utilisations', num: true }] }) + '</div>';
      }
      if (tab === 'caisse') {
        h += '<div class="card flush">' + App.table('cashCounts', { exportName: 'arretes_caisse', rows: (d.cashCounts || []).slice().reverse(), emptyTitle: 'Aucun arrêté de caisse', empty: 'Ouvrez la carte de la caisse et lancez un arrêté avec billetage.', rowId: function (r) { return r.date + r.bank; },
          cols: [{ k: 'date', label: 'Date', fmt: App.date }, { k: 'bank', label: 'Caisse', fmt: function (v) { return '<span class="ac">' + esc(v) + '</span>'; } }, { k: 'counted', label: 'Compté', num: true, fmt: function (v) { return U.fmt(v); } }, { k: 'book', label: 'Solde comptable', num: true, fmt: function (v) { return U.fmt(v); } }, { k: 'gap', label: 'Écart', num: true, fmt: function (v) { return v ? '<b class="neg">' + U.fmt(v) + '</b>' : '0'; } }, { k: 'by', label: 'Par' }] }) + '</div>';
      }
      return h + '</div>';
    }
  };
  A['rs-date'] = function (el) { App.ui.v.rsDate = el.value; App.render(); };
})();

/* Achats : factures fournisseurs (journal ACH / IMMO), échéancier et règlements lettrés automatiquement. */
(function () {
  'use strict';
  var Y = window.Yiel, U = Y.util, App = window.App, esc = App.esc, A = App.actions;
  function S() { return App.S; } function cid() { return App.cid(); }

  function purchases() {
    return Y.validated(S(), cid()).filter(function (e) { return (e.journal === 'ACH' || e.journal === 'IMMO') && !e.reversalOf && e.lines.some(function (l) { return /^(40|481)/.test(l.account) && l.credit && l.tiersId; }); }).map(function (e) {
      var l = e.lines.find(function (x) { return /^(40|481)/.test(x.account) && x.credit && x.tiersId; });
      var paid = 0;
      if (l.letter && l.letter === l.letter.toUpperCase()) paid = l.credit;
      else Y.eachLine(S(), cid(), function (x, en) { if (en.id !== e.id && x.tiersId === l.tiersId && x.debit && (en.ref === e.ref && e.ref)) paid += x.debit; }, { account: l.account });
      var t = Y.tiers(S(), cid(), l.tiersId);
      var st = e.reversedBy ? 'Annulée' : (paid >= l.credit ? 'Payée' : (paid ? 'Partielle' : ((l.due || e.date) < App.today() ? 'Échue' : 'À payer')));
      return { id: e.id, num: e.num, date: e.date, ref: e.ref, label: e.label, supplier: t ? t.name : '', tiersId: l.tiersId, collective: l.account, due: l.due || e.date, ttc: l.credit, paid: Math.min(paid, l.credit), rest: Math.max(0, l.credit - paid), st: st };
    }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  }
  function expenseAccounts() { return Y.postableAccounts(S(), cid()).filter(function (a) { return /^(6|2[1-5])/.test(a.num) && !/^(28|29|68|69)/.test(a.num); }).map(function (a) { return [a.num, a.num + ' · ' + a.label]; }); }
  A['purchase-new'] = function () {
    if (!App.guard('draft')) return;
    var dd = App.D(), sup = dd.tiers.filter(function (t) { return t.type === 'fournisseur' && t.active !== false; });
    var acc = expenseAccounts(), secs = dd.sections.map(function (s) { return [s.code, s.code + ' · ' + s.label]; }), taxes = dd.taxCodes.map(function (t) { return [t.code, t.code]; });
    var f = [{ k: 'tiersId', label: 'Fournisseur', type: 'select', req: true, opts: sup.map(function (t) { return [t.id, t.code + ' · ' + t.name]; }), span: true },
      { k: 'ref', label: 'N° de facture du fournisseur', req: true, ph: 'F-2026-0331' }, { k: 'date', label: 'Date comptable', type: 'date', val: App.today(), req: true },
      { k: 'pieceDate', label: 'Date de la facture', type: 'date', val: App.today() }, { k: 'due', label: 'Échéance', type: 'date', val: U.addDays(App.today(), 30) },
      { k: 'label', label: 'Libellé', req: true, span: true, ph: 'Ex. Fournitures de bureau · octobre' }];
    [1, 2, 3].forEach(function (i) {
      f.push({ type: 'sep', label: 'Ligne ' + i + (i > 1 ? ' (facultative)' : '') });
      f.push({ k: 'a' + i, label: 'Compte de charge ou d’immobilisation', type: 'select', empty: i > 1 ? '—' : undefined, opts: acc, req: i === 1, val: i === 1 ? '6055' : '' });
      f.push({ k: 'h' + i, label: 'Montant HT (XAF)', type: 'money', req: i === 1 });
      f.push({ k: 't' + i, label: 'Code TVA', type: 'select', opts: taxes, val: 'TVA19' });
      f.push({ k: 's' + i, label: 'Section analytique', type: 'select', empty: '—', opts: secs, val: 'STR' });
    });
    f.push({ type: 'sep', label: 'Pièce justificative' }); f.push({ k: 'file', label: 'Facture scannée (PDF, photo)', type: 'file', accept: '.pdf,.jpg,.jpeg,.png', span: true });
    App.form({ title: 'Nouvelle facture fournisseur', sub: 'Journal ACH (ou IMMO si un compte 2 est utilisé) · TVA récupérable calculée automatiquement.', fields: f, wide: true, submit: 'Comptabiliser la facture',
      live: function (v) {
        var lines = [1, 2, 3].filter(function (i) { return v['a' + i] && v['h' + i]; }).map(function (i) { return { account: v['a' + i], ht: v['h' + i], taxCode: v['t' + i] }; });
        if (!lines.length) return '';
        var tva = 0, ttc = 0, txt = ''; lines.forEach(function (l) { var tc = Y.taxCode(S(), cid(), l.taxCode), t = tc && tc.rate ? U.round(l.ht * tc.rate / 100) : 0; tva += t; ttc += l.ht + t; txt += U.pad(l.account, 6).replace(/^0+/, function (z) { return z.replace(/0/g, ' '); }) + '  D ' + U.fmt(l.ht) + '\n'; });
        var immo = lines.some(function (l) { return /^2/.test(l.account); });
        return '<div class="eyebrow" style="margin-bottom:6px">Écriture qui sera passée</div><div class="mini-entry">' + esc(txt) + (tva ? (immo ? '  4451' : '  4452') + '  D ' + U.fmt(tva) + '   TVA récupérable\n' : '') + (immo ? '   481' : '  4011') + '  C ' + U.fmt(ttc) + '   Fournisseur</div>';
      },
      onSubmit: function (v) {
        var lines = [1, 2, 3].filter(function (i) { return v['a' + i] && v['h' + i]; }).map(function (i) { return { account: v['a' + i], ht: v['h' + i], taxCode: v['t' + i], section: v['s' + i], label: v.label }; });
        return Y.postPurchase(S(), cid(), { tiersId: v.tiersId, ref: v.ref, date: v.date, pieceDate: v.pieceDate, due: v.due, label: v.label, lines: lines, attachments: v.file ? [{ name: v.file.name, size: v.file.size, type: v.file.type }] : [] });
      }, done: function (e) { return 'Facture comptabilisée : ' + e.num + '.'; } });
  };
  A['purchase-pay'] = function (el) {
    if (!App.guard('bank')) return;
    var p = purchases().find(function (x) { return x.id === el.dataset.id; });
    App.form({ title: 'Régler ' + p.supplier, sub: 'Facture ' + (p.ref || p.num) + ' · reste dû ' + U.fmt(p.rest) + ' XAF',
      fields: [{ k: 'date', label: 'Date du règlement', type: 'date', val: App.today(), req: true }, { k: 'amount', label: 'Montant (XAF)', type: 'money', val: p.rest, req: true }, { k: 'method', label: 'Moyen de paiement', type: 'select', val: 'bank', opts: Object.keys(Y.PAY_METHODS).map(function (k) { return [k, Y.PAY_METHODS[k].label]; }) }],
      submit: 'Enregistrer le règlement', onSubmit: function (v) { return Y.paySupplier(S(), cid(), { tiersId: p.tiersId, amount: v.amount, date: v.date, method: v.method, ref: p.ref, letterRef: v.amount === p.rest ? p.ref : '', collective: p.collective }); }, done: function (e) { return 'Règlement passé : ' + e.num + '.'; } });
  };
  App.pages.achats = {
    render: function () {
      var rows = purchases(), tab = App.tab('achats', 'factures'), f = App.v('achSt', 'all');
      var due = rows.filter(function (r) { return r.rest > 0 && r.st !== 'Annulée'; });
      var h = '<div class="page">' + App.head('Comptabilité · Achats', 'Achats <span class="serif">&amp; fournisseurs</span>', 'Factures fournisseurs, TVA récupérable, échéancier et règlements lettrés automatiquement.',
        '<button type="button" class="btn" data-act="go" data-page="plan" data-tab="tiers">Fournisseurs</button><button type="button" class="btn acc" data-act="purchase-new"' + App.dis('draft') + '>' + App.ic('plus') + 'Facture fournisseur</button>');
      h += '<div class="grid g4"><div class="card kpi"><span class="lbl">Dettes fournisseurs</span><span class="val"><span data-count="' + U.sum(due, function (r) { return r.rest; }) + '">0</span></span><span class="delta">' + due.length + ' facture(s) ouverte(s)</span></div>' +
        '<div class="card kpi"><span class="lbl">Échues</span><span class="val neg"><span data-count="' + U.sum(due.filter(function (r) { return r.due < App.today(); }), function (r) { return r.rest; }) + '">0</span></span><span class="delta">à régler en priorité</span></div>' +
        '<div class="card kpi"><span class="lbl">À 30 jours</span><span class="val"><span data-count="' + U.sum(due.filter(function (r) { return r.due >= App.today() && r.due <= U.addDays(App.today(), 30); }), function (r) { return r.rest; }) + '">0</span></span><span class="delta">prévision de décaissement</span></div>' +
        '<div class="card kpi"><span class="lbl">Achats ' + App.year() + ' (TTC)</span><span class="val"><span data-count="' + U.sum(rows.filter(function (r) { return U.year(r.date) === App.year(); }), function (r) { return r.ttc; }) + '">0</span></span><span class="delta">' + rows.length + ' factures</span></div></div>';
      h += App.tabs('achats', [['factures', 'Factures fournisseurs', rows.length], ['echeancier', 'Échéancier', due.length]], 'factures');
      if (tab === 'factures') {
        var list = f === 'all' ? rows : rows.filter(function (r) { return r.st === f; });
        h += '<div class="card flush">' + App.table('purch', { exportName: 'factures_fournisseurs', pdf: true, title: 'Factures fournisseurs', rows: list, rowAct: 'entry-open', toolbar: App.filters('achSt', [['all', 'Toutes'], ['À payer', 'À payer'], ['Échue', 'Échues'], ['Partielle', 'Partielles'], ['Payée', 'Payées']], f),
          cols: [{ k: 'num', label: 'Pièce', fmt: function (v) { return '<span class="ac">' + esc(v) + '</span>'; } }, { k: 'date', label: 'Date', fmt: App.date }, { k: 'supplier', label: 'Fournisseur' }, { k: 'ref', label: 'N° facture' }, { k: 'label', label: 'Libellé' }, { k: 'due', label: 'Échéance', fmt: App.date },
            { k: 'ttc', label: 'TTC', num: true, fmt: function (v) { return U.fmt(v); } }, { k: 'rest', label: 'Reste dû', num: true, fmt: function (v) { return v ? '<b>' + U.fmt(v) + '</b>' : '—'; } }, { k: 'st', label: 'Statut', fmt: function (v) { return App.chip(v, v === 'Payée' ? 'ok' : (v === 'Échue' ? 'bad' : (v === 'Partielle' ? 'warn' : 'info')), true); } }],
          rowActions: function (r) { return r.rest ? '<button type="button" class="btn xs" data-act="purchase-pay" data-id="' + r.id + '"' + App.dis('bank') + '>Payer</button>' : ''; } }) + '</div>';
      }
      if (tab === 'echeancier') {
        var aged = Y.agedBalance(S(), cid(), '401', App.today());
        h += '<div class="card flush"><div class="card-h"><h2>Balance âgée fournisseurs</h2><span class="sub">au ' + App.date(App.today()) + '</span></div>' + App.table('agedSup', { exportName: 'balance_agee_fournisseurs', rows: aged, rowId: function (r) { return r.tiersId; }, search: false,
          cols: [{ k: 'name', label: 'Fournisseur' }, { k: 'b0', label: 'Non échu', num: true, val: function (r) { return r.b[0]; }, fmt: App.m0 }, { k: 'b1', label: '1–30 j', num: true, val: function (r) { return r.b[1]; }, fmt: App.m0 }, { k: 'b2', label: '31–60 j', num: true, val: function (r) { return r.b[2]; }, fmt: App.m0 }, { k: 'b3', label: '61–90 j', num: true, val: function (r) { return r.b[3]; }, fmt: App.m0 }, { k: 'b4', label: '> 90 j', num: true, val: function (r) { return r.b[4]; }, fmt: App.m0 }, { k: 'total', label: 'Total', num: true, fmt: function (v) { return '<b>' + U.fmt(v) + '</b>'; } }] }) + '</div>';
        h += '<div class="card flush"><div class="card-h"><h2>Prochains décaissements</h2></div>' + App.table('dueSup', { exportName: 'echeancier_fournisseurs', rows: due.slice().sort(function (a, b) { return a.due < b.due ? -1 : 1; }), search: false, rowAct: 'entry-open',
          cols: [{ k: 'due', label: 'Échéance', fmt: function (v) { return App.date(v) + (v < App.today() ? ' ' + App.chip('Échue', 'bad') : ''); } }, { k: 'supplier', label: 'Fournisseur' }, { k: 'ref', label: 'N° facture' }, { k: 'rest', label: 'Montant', num: true, fmt: function (v) { return U.fmt(v); } }],
          rowActions: function (r) { return '<button type="button" class="btn xs" data-act="purchase-pay" data-id="' + r.id + '"' + App.dis('bank') + '>Payer</button>'; } }) + '</div>';
      }
      return h + '</div>';
    }
  };
})();

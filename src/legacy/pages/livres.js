/* Livres et balances : balance générale 6 colonnes, grand livre, journaux légaux et centralisateur, balance des tiers, balance âgée, lettrage interactif. */
(function () {
  'use strict';
  var Y = window.Yiel, U = Y.util, App = window.App, esc = App.esc, A = App.actions;
  function S() { return App.S; } function cid() { return App.cid(); }
  function yTo(y) { var t = App.today(); return U.year(t) === y ? t : y + '-12-31'; }

  function balanceRows(y, to, level, cls, onlyMv) {
    var tb = Y.trialBalance(S(), cid(), y, to);
    if (cls) tb = tb.filter(function (r) { return r.account[0] === cls; });
    if (onlyMv) tb = tb.filter(function (r) { return r.mvD || r.mvC; });
    if (level === 'detail') return tb;
    var n = level === '2' ? 2 : 3, g = {};
    tb.forEach(function (r) {
      var k = r.account.slice(0, n), x = g[k] || (g[k] = { account: k, label: Y.accountLabel(S(), cid(), k) || r.label, an: 0, mvD: 0, mvC: 0 });
      x.an += r.anD - r.anC; x.mvD += r.mvD; x.mvC += r.mvC;
    });
    return Object.keys(g).sort().map(function (k) { var x = g[k], f = x.an + x.mvD - x.mvC; return { account: k, label: x.label, anD: x.an > 0 ? x.an : 0, anC: x.an < 0 ? -x.an : 0, mvD: x.mvD, mvC: x.mvC, fD: f > 0 ? f : 0, fC: f < 0 ? -f : 0 }; });
  }
  A['gl-acc'] = function (el) { App.ui.v.glAcc = el.value.trim(); App.render(); };
  A['gl-from'] = function (el) { App.ui.v.glFrom = el.value; App.render(); };
  A['gl-to'] = function (el) { App.ui.v.glTo = el.value; App.render(); };
  A['gl-tiers'] = function (el) { App.ui.v.glTiers = el.value; App.render(); };
  A['bal-to'] = function (el) { App.ui.v.balTo = el.value; App.render(); };
  A['bal-goto'] = function (el) { var acc = el.dataset.id; if (acc.length < 4 && !Y.isLeaf(S(), cid(), acc)) { App.ui.v.glAcc = acc; } else App.ui.v.glAcc = acc; App.go('livres', 'gl'); };
  A['gl-line'] = function (el) { A['entry-open'](el); };
  A['gl-pdf'] = function () {
    var y = App.year(), acc = App.v('glAcc', '5211'), from = App.v('glFrom', y + '-01-01'), to = App.v('glTo', yTo(y)), rows = Y.ledger(S(), cid(), acc, from, to, App.v('glTiers', '') || undefined);
    var doc = App.pdfDoc('Grand livre · ' + acc, Y.accountLabel(S(), cid(), acc) + ' · du ' + App.date(from) + ' au ' + App.date(to), true); if (!doc) return;
    App.pdfAuto(doc, ['Date', 'Journal', 'Pièce', 'Libellé', 'Lettre', 'Débit', 'Crédit', 'Solde'], rows.map(function (r) { return [App.date(r.date), r.journal, r.num, r.label, r.letter || '', U.fmt(r.debit, { zero: false }), U.fmt(r.credit, { zero: false }), U.fmtDC(r.balance)]; }), { numCols: [5, 6, 7], boldRow: function (r) { return /^Solde au/.test(r[3]); } });
    App.pdfFinish(doc, 'grand_livre_' + acc + '_' + to + '.pdf');
  };
  A['gl-xlsx'] = function () {
    if (!App.guard('export')) return;
    var y = App.year(), from = App.v('glFrom', y + '-01-01'), to = App.v('glTo', yTo(y)), sheets = [];
    var prefix = App.v('glAcc', '5211');
    var accs = Y.postableAccounts(S(), cid()).filter(function (a) { return a.num.indexOf(prefix.slice(0, 1)) === 0 && a.num.indexOf(prefix) === 0; }).map(function (a) { return a.num; });
    if (!accs.length) accs = [prefix];
    var aoa = [['Compte', 'Intitulé', 'Date', 'Journal', 'Pièce', 'Libellé', 'Tiers', 'Lettre', 'Débit', 'Crédit', 'Solde']];
    accs.forEach(function (n) { var rows = Y.ledger(S(), cid(), n, from, to); if (rows.length <= 1 && !rows.some(function (r) { return r.debit || r.credit; })) return; rows.forEach(function (r) { var t = r.tiersId ? Y.tiers(S(), cid(), r.tiersId) : null; aoa.push([n, Y.accountLabel(S(), cid(), n), r.date, r.journal, r.num, r.label, t ? t.code : '', r.letter || '', r.debit, r.credit, r.balance]); }); });
    sheets.push({ name: 'Grand livre', rows: aoa });
    App.xlsx('grand_livre_' + prefix + '_' + from + '_' + to + '.xlsx', sheets);
  };
  A['jr-pdf'] = function () {
    var y = App.year(), j = App.v('jrCode', 'VTE'), m = +App.v('jrMonth', U.month(App.today())), from = y + '-' + U.pad(m, 2) + '-01', to = U.monthEnd(y, m);
    var es = Y.validated(S(), cid()).filter(function (e) { return e.journal === j && e.date >= from && e.date <= to; }).sort(function (a, b) { return a.num < b.num ? -1 : 1; });
    var doc = App.pdfDoc('Journal ' + j + ' · ' + U.MONTHS[m - 1] + ' ' + y, (Y.journal(S(), cid(), j) || {}).label, true); if (!doc) return;
    var body = []; es.forEach(function (e) { e.lines.forEach(function (l, i) { var t = l.tiersId ? Y.tiers(S(), cid(), l.tiersId) : null; body.push([i ? '' : App.date(e.date), i ? '' : e.num, l.account, t ? t.code : '', l.label || e.label, U.fmt(l.debit, { zero: false }), U.fmt(l.credit, { zero: false })]); }); });
    var td = 0, tc = 0; es.forEach(function (e) { var t = Y.entryTotals(e); td += t.debit; tc += t.credit; });
    body.push(['', '', '', '', 'Totaux du journal', U.fmt(td), U.fmt(tc)]);
    App.pdfAuto(doc, ['Date', 'Pièce', 'Compte', 'Tiers', 'Libellé', 'Débit', 'Crédit'], body, { numCols: [5, 6], boldRow: function (r) { return r[4] === 'Totaux du journal'; } });
    App.pdfFinish(doc, 'journal_' + j + '_' + y + '-' + U.pad(m, 2) + '.pdf');
  };

  /* ---------------------------------------------------------------- lettrage */
  function letSel() { return App.ui.v.letSel || (App.ui.v.letSel = {}); }
  A['let-acc'] = function (el) { App.ui.v.letAcc = el.value; App.ui.v.letSel = {}; App.render(); };
  A['let-tiers'] = function (el) { App.ui.v.letTiers = el.value; App.ui.v.letSel = {}; App.render(); };
  A['let-toggle'] = function (el) { var s = letSel(), k = el.dataset.id; if (s[k]) delete s[k]; else s[k] = true; App.render(); };
  A['let-clear'] = function () { App.ui.v.letSel = {}; App.render(); };
  A['let-do'] = function (el) {
    if (!App.guard('letter')) return;
    var refs = Object.keys(letSel()).map(function (k) { var p = k.split('|'); return { entryId: p[0], idx: +p[1] }; });
    App.run(function () { return Y.letterLines(S(), cid(), refs, { partial: el.dataset.partial === '1' }); }, function (c) { return 'Lettrage ' + c + ' appliqué sur ' + refs.length + ' lignes' + (c === c.toLowerCase() ? ' (lettrage partiel)' : '') + '.'; });
    App.ui.v.letSel = {}; App.render();
  };
  A['let-auto'] = function () { if (!App.guard('letter')) return; var acc = App.v('letAcc', '4111'); App.run(function () { return Y.autoLetter(S(), cid(), acc); }, function (n) { return n ? n + ' paire(s) lettrée(s) automatiquement sur ' + acc + ' (même tiers, même montant, référence prioritaire).' : 'Aucune paire évidente à lettrer.'; }); };
  A['let-undo'] = function (el) { if (!App.guard('letter')) return; App.run(function () { return Y.unletter(S(), cid(), el.dataset.acc, el.dataset.code); }, function (n) { return 'Lettre ' + el.dataset.code + ' supprimée (' + n + ' lignes).'; }); };

  App.pages.livres = {
    render: function () {
      var d = App.D(), y = App.year(), tab = App.tab('livres', 'balance');
      var h = '<div class="page">' + App.head('Comptabilité · Contrôle', 'Livres <span class="serif">&amp; balances</span>', 'Les livres sont calculés à la volée à partir des seules écritures validées : aucune donnée dupliquée, aucune incohérence possible entre balance, grand livre et états.', '');
      h += App.tabs('livres', [['balance', 'Balance générale'], ['gl', 'Grand livre'], ['journaux', 'Journaux & centralisateur'], ['tiers', 'Balance des tiers'], ['agee', 'Balance âgée'], ['lettrage', 'Lettrage']], 'balance');

      if (tab === 'balance') {
        var to = App.v('balTo', yTo(y)), lvl = App.v('balLvl', 'detail'), cls = App.v('balCls', ''), mv = App.v('balMv', false);
        var rows = balanceRows(y, to, lvl, cls, mv);
        var T = ['anD', 'anC', 'mvD', 'mvC', 'fD', 'fC'].reduce(function (o, k) { o[k] = U.sum(rows, function (r) { return r[k]; }); return o; }, {});
        h += '<div class="actions"><label class="fld" style="flex-direction:row;align-items:center;gap:8px"><span>Arrêtée au</span><input class="in" type="date" id="bal_to" data-change="bal-to" value="' + to + '" style="width:auto"></label>' + App.seg('balLvl', [['detail', 'Comptes détaillés'], ['3', 'Niveau 3 chiffres'], ['2', 'Niveau 2 chiffres']], lvl) + App.filters('balCls', [['', 'Toutes classes']].concat([1, 2, 3, 4, 5, 6, 7, 8].map(function (c) { return [String(c), 'Classe ' + c]; })), cls) + App.filters('balMv', [[false, 'Tous les soldes'], [true, 'Mouvementés sur la période']], mv) + '</div>';
        h += '<div class="balance-bar ' + (T.fD === T.fC && T.mvD === T.mvC ? 'ok' : 'bad') + '">' + App.ic(T.fD === T.fC ? 'check' : 'x') + 'Contrôle : mouvements ' + U.fmt(T.mvD) + ' = ' + U.fmt(T.mvC) + ' · soldes ' + U.fmt(T.fD) + (T.fD === T.fC ? ' = ' : ' ≠ ') + U.fmt(T.fC) + ' · ' + rows.length + ' comptes</div>';
        h += '<div class="card flush">' + App.table('balance', { exportName: 'balance_generale_' + y, pdf: true, title: 'Balance générale au ' + App.date(to), rows: rows, rowId: function (r) { return r.account; }, rowAct: 'bal-goto', pageSize: 60, groupBy: cls || lvl === '2' ? null : function (r) { return 'Classe ' + r.account[0] + ' · ' + esc((Y.CLASSES[r.account[0]] || [''])[0]); },
          cols: [{ k: 'account', label: 'Compte', fmt: function (v) { return '<span class="ac">' + esc(v) + '</span>'; } }, { k: 'label', label: 'Intitulé' }, { k: 'anD', label: 'À-nouveaux débit', num: true, fmt: App.m0 }, { k: 'anC', label: 'À-nouveaux crédit', num: true, fmt: App.m0 }, { k: 'mvD', label: 'Mouvements débit', num: true, fmt: App.m0 }, { k: 'mvC', label: 'Mouvements crédit', num: true, fmt: App.m0 }, { k: 'fD', label: 'Solde débiteur', num: true, fmt: function (v) { return v ? '<b>' + U.fmt(v) + '</b>' : ''; } }, { k: 'fC', label: 'Solde créditeur', num: true, fmt: function (v) { return v ? '<b>' + U.fmt(v) + '</b>' : ''; } }],
          foot: function () { return '<tr class="tot"><td colspan="2">Totaux</td><td class="num">' + U.fmt(T.anD) + '</td><td class="num">' + U.fmt(T.anC) + '</td><td class="num">' + U.fmt(T.mvD) + '</td><td class="num">' + U.fmt(T.mvC) + '</td><td class="num">' + U.fmt(T.fD) + '</td><td class="num">' + U.fmt(T.fC) + '</td></tr>'; } }) + '</div>';
      }

      if (tab === 'gl') {
        var acc = App.v('glAcc', '5211'), from = App.v('glFrom', y + '-01-01'), to2 = App.v('glTo', yTo(y)), tid = App.v('glTiers', '');
        var a = Y.account(S(), cid(), acc), led = acc ? Y.ledger(S(), cid(), acc, from, to2, tid || undefined) : [];
        var td = U.sum(led, function (r) { return r.opening ? 0 : r.debit; }), tc = U.sum(led, function (r) { return r.opening ? 0 : r.credit; }), end = led.length ? led[led.length - 1].balance : 0;
        h += App.accDatalist() + '<div class="card"><div class="form-grid" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr))"><label class="fld"><span>Compte ou racine</span><input class="in mono" id="gl_acc" list="acc_list" value="' + esc(acc) + '" data-change="gl-acc" placeholder="411, 5211, 6…"></label><label class="fld"><span>Du</span><input class="in" type="date" id="gl_from" value="' + from + '" data-change="gl-from"></label><label class="fld"><span>Au</span><input class="in" type="date" id="gl_to" value="' + to2 + '" data-change="gl-to"></label>' +
          '<label class="fld"><span>Tiers</span><select class="in" id="gl_tiers" data-change="gl-tiers"><option value="">Tous</option>' + d.tiers.map(function (t) { return '<option value="' + t.id + '"' + (t.id === tid ? ' selected' : '') + '>' + esc(t.code + ' · ' + t.name) + '</option>'; }).join('') + '</select></label></div></div>';
        h += '<div class="grid g4"><div class="kpi"><span class="lbl">Compte</span><span class="val" style="font-size:18px"><span class="ac">' + esc(acc) + '</span></span><span class="delta">' + esc(a ? a.label : 'Racine de comptes') + '</span></div><div class="kpi"><span class="lbl">Total débit</span><span class="val">' + U.fmt(td) + '</span></div><div class="kpi"><span class="lbl">Total crédit</span><span class="val">' + U.fmt(tc) + '</span></div><div class="kpi"><span class="lbl">Solde au ' + App.date(to2) + '</span><span class="val">' + U.fmtDC(end) + '</span></div></div>';
        h += '<div class="card flush">' + App.table('gl', { exportName: 'grand_livre_' + acc, rows: led.map(function (r, i) { r._i = i; return r; }), rowId: function (r) { return r.entryId || ''; }, rowAct: 'gl-line', pageSize: 50, rowClass: function (r) { return r.opening ? 'sub' : ''; },
          toolbar: '<button type="button" class="btn sm" data-act="gl-pdf">' + App.ic('pdf') + 'PDF</button><button type="button" class="btn sm" data-act="gl-xlsx" title="Tous les comptes de la racine, un onglet">' + App.ic('table') + 'Grand livre Excel (racine ' + esc(acc) + ')</button>',
          cols: [{ k: 'date', label: 'Date', fmt: App.date }, { k: 'journal', label: 'Jnl', fmt: function (v) { return v ? App.chip(v) : ''; } }, { k: 'num', label: 'Pièce', fmt: function (v) { return '<span class="mono">' + esc(v) + '</span>'; } }, { k: 'account', label: 'Compte', fmt: function (v) { return v ? '<span class="ac">' + esc(v) + '</span>' : ''; } }, { k: 'label', label: 'Libellé' },
            { k: 'tiers', label: 'Tiers', val: function (r) { var t = r.tiersId ? Y.tiers(S(), cid(), r.tiersId) : null; return t ? t.code : ''; } }, { k: 'letter', label: 'Let.', fmt: function (v) { return v ? '<span class="mono" style="font-weight:800;color:' + (v === v.toUpperCase() ? 'var(--ok)' : 'var(--warn)') + '">' + esc(v) + '</span>' : ''; } },
            { k: 'debit', label: 'Débit', num: true, fmt: App.m0 }, { k: 'credit', label: 'Crédit', num: true, fmt: App.m0 }, { k: 'balance', label: 'Solde', num: true, fmt: function (v) { return '<b>' + U.fmtDC(v) + '</b>'; } }],
          emptyTitle: 'Aucun mouvement', empty: 'Aucune écriture validée sur ce compte pour la période.' }) + '</div>';
      }

      if (tab === 'journaux') {
        var sub = App.v('jrView', 'central');
        h += '<div class="actions">' + App.seg('jrView', [['central', 'Journal centralisateur'], ['legal', 'Journal légal (détail)']], sub) + '</div>';
        if (sub === 'central') {
          var js = d.journals.filter(function (j) { return j.active; }), grid = {}, tot = {};
          Y.validated(S(), cid()).forEach(function (e) { if (U.year(e.date) !== y) return; var m = U.month(e.date), k = e.journal + '|' + m, t = Y.entryTotals(e); grid[k] = (grid[k] || 0) + t.debit; tot[m] = (tot[m] || 0) + t.debit; });
          h += '<div class="card flush"><div class="card-h"><h2>Centralisateur ' + y + '</h2><span class="sub">Total des mouvements (débit = crédit) par journal et par mois</span></div><div class="tbl-wrap"><table class="t"><thead><tr><th>Journal</th>' + U.MONTHS.map(function (m) { return '<th class="num">' + m.slice(0, 4) + '.</th>'; }).join('') + '<th class="num">Total</th></tr></thead><tbody>' +
            js.map(function (j) { var s = 0; return '<tr><td><b>' + esc(j.code) + '</b> <span class="muted">' + esc(j.label) + '</span></td>' + [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(function (m) { var v = grid[j.code + '|' + m] || 0; s += v; return '<td class="num">' + (v ? '<button type="button" class="btn xs ghost" data-act="jr-open" data-j="' + j.code + '" data-m="' + m + '">' + (v >= 1e6 ? (v / 1e6).toFixed(1).replace('.', ',') + ' M' : U.fmt(v)) + '</button>' : '<span class="muted">·</span>') + '</td>'; }).join('') + '<td class="num"><b>' + U.fmt(s) + '</b></td></tr>'; }).join('') +
            '<tr class="tot"><td>Total</td>' + [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(function (m) { return '<td class="num">' + (tot[m] ? (tot[m] / 1e6).toFixed(1).replace('.', ',') + ' M' : '') + '</td>'; }).join('') + '<td class="num">' + U.fmt(U.sum(Object.keys(tot), function (k) { return tot[k]; })) + '</td></tr></tbody></table></div></div>';
        } else {
          var jc = App.v('jrCode', 'VTE'), jm = +App.v('jrMonth', U.month(App.today())), f2 = y + '-' + U.pad(jm, 2) + '-01', t2 = U.monthEnd(y, jm);
          var es = Y.validated(S(), cid()).filter(function (e) { return e.journal === jc && e.date >= f2 && e.date <= t2; }).sort(function (a, b) { return a.num < b.num ? -1 : 1; });
          var lines = []; es.forEach(function (e) { e.lines.forEach(function (l, i) { lines.push({ id: e.id + '|' + i, eid: e.id, first: !i, date: e.date, num: e.num, account: l.account, tiersId: l.tiersId, label: l.label || e.label, debit: l.debit, credit: l.credit }); }); });
          h += '<div class="actions"><select class="in" style="width:auto" data-change="jr-code">' + d.journals.map(function (j) { return '<option value="' + j.code + '"' + (j.code === jc ? ' selected' : '') + '>' + esc(j.code + ' · ' + j.label) + '</option>'; }).join('') + '</select><select class="in" style="width:auto" data-change="jr-month">' + U.MONTHS.map(function (m, i) { return '<option value="' + (i + 1) + '"' + (i + 1 === jm ? ' selected' : '') + '>' + m + ' ' + y + '</option>'; }).join('') + '</select><button type="button" class="btn sm" style="margin-left:auto" data-act="jr-pdf">' + App.ic('pdf') + 'Journal PDF</button></div>';
          h += '<div class="card flush">' + App.table('jrLegal', { exportName: 'journal_' + jc + '_' + y + '-' + U.pad(jm, 2), rows: lines, noPaging: lines.length < 400, rowClass: function (r) { return r.first ? '' : 'dim'; },
            cols: [{ k: 'date', label: 'Date', fmt: function (v, r) { return r.first ? App.date(v) : ''; } }, { k: 'num', label: 'Pièce', fmt: function (v, r) { return r.first ? '<button type="button" class="btn xs ghost" data-act="entry-open" data-id="' + r.eid + '"><span class="mono">' + esc(v) + '</span></button>' : ''; } }, { k: 'account', label: 'Compte', fmt: function (v) { return '<span class="ac">' + esc(v) + '</span>'; } }, { k: 'tiers', label: 'Tiers', val: function (r) { var t = r.tiersId ? Y.tiers(S(), cid(), r.tiersId) : null; return t ? t.code : ''; } }, { k: 'label', label: 'Libellé' }, { k: 'debit', label: 'Débit', num: true, fmt: App.m0 }, { k: 'credit', label: 'Crédit', num: true, fmt: App.m0 }],
            foot: function (rows) { return '<tr class="tot"><td colspan="5">Totaux · ' + es.length + ' pièce(s)</td><td class="num">' + U.fmt(U.sum(rows, function (r) { return r.debit; })) + '</td><td class="num">' + U.fmt(U.sum(rows, function (r) { return r.credit; })) + '</td></tr>'; }, emptyTitle: 'Journal vide sur la période' }) + '</div>';
        }
      }

      if (tab === 'tiers') {
        var kind = App.v('tbKind', 'client'), col = kind === 'client' ? '41' : (kind === 'fournisseur' ? '40' : '42');
        var bal = {}; Y.eachLine(S(), cid(), function (l) { if (!l.tiersId) return; var b = bal[l.tiersId] || (bal[l.tiersId] = { d: 0, c: 0, open: 0 }); b.d += l.debit; b.c += l.credit; if (!l.letter || l.letter !== l.letter.toUpperCase()) b.open++; }, { account: col, to: yTo(y) });
        var rows2 = d.tiers.filter(function (t) { return t.type === kind; }).map(function (t) { var b = bal[t.id] || { d: 0, c: 0, open: 0 }; return { id: t.id, code: t.code, name: t.name, collective: t.collective, d: b.d, c: b.c, solde: b.d - b.c, open: b.open, limit: t.creditLimit }; }).filter(function (r) { return r.d || r.c; });
        h += '<div class="actions">' + App.seg('tbKind', [['client', 'Clients (411)'], ['fournisseur', 'Fournisseurs (401)'], ['personnel', 'Personnel (42)']], kind) + '</div>';
        h += '<div class="card flush">' + App.table('tbal', { exportName: 'balance_tiers_' + kind, pdf: true, title: 'Balance des tiers · ' + kind, rows: rows2, rowAct: 'tiers-open',
          cols: [{ k: 'code', label: 'Code', fmt: function (v) { return '<span class="mono">' + esc(v) + '</span>'; } }, { k: 'name', label: 'Tiers' }, { k: 'collective', label: 'Collectif', fmt: function (v) { return '<span class="ac">' + esc(v) + '</span>'; } }, { k: 'd', label: 'Total débit', num: true, fmt: App.m0 }, { k: 'c', label: 'Total crédit', num: true, fmt: App.m0 },
            { k: 'solde', label: 'Solde', num: true, fmt: function (v, r) { return '<b' + (r.limit && v > r.limit ? ' class="neg" title="Plafond de crédit dépassé"' : '') + '>' + U.fmtDC(v) + '</b>'; } }, { k: 'open', label: 'Lignes non lettrées', num: true }],
          foot: function (rs) { return '<tr class="tot"><td colspan="3">Total</td><td class="num">' + U.fmt(U.sum(rs, function (r) { return r.d; })) + '</td><td class="num">' + U.fmt(U.sum(rs, function (r) { return r.c; })) + '</td><td class="num">' + U.fmtDC(U.sum(rs, function (r) { return r.solde; })) + '</td><td></td></tr>'; } }) + '</div>';
      }

      if (tab === 'agee') {
        var k2 = App.v('agKind', '411'), dt = App.v('agDate', App.today()), ag = Y.agedBalance(S(), cid(), k2, dt);
        var B = [0, 1, 2, 3, 4].map(function (i) { return U.sum(ag, function (r) { return r.b[i]; }); }), TT = U.sum(ag, function (r) { return r.total; });
        h += '<div class="actions">' + App.seg('agKind', [['411', 'Créances clients'], ['401', 'Dettes fournisseurs']], k2) + '<label class="fld" style="flex-direction:row;align-items:center;gap:8px"><span>Au</span><input class="in" type="date" id="ag_date" data-change="ag-date" value="' + dt + '" style="width:auto"></label></div>';
        h += '<div class="card"><div style="display:flex;height:14px;border-radius:8px;overflow:hidden;background:var(--surface-3)">' + B.map(function (v, i) { var c = ['var(--ok)', '#E8B53A', 'var(--warn)', '#E0703A', 'var(--bad)'][i]; return TT > 0 && v > 0 ? '<span title="' + U.fmt(v) + '" style="width:' + (v / TT * 100).toFixed(2) + '%;background:' + c + '"></span>' : ''; }).join('') + '</div><div class="legend" style="margin-top:10px;display:flex;flex-wrap:wrap;gap:14px;font-size:12.5px">' + ['Non échu', '1–30 j', '31–60 j', '61–90 j', '+ 90 j'].map(function (l, i) { return '<span><b>' + l + '</b> · ' + U.fmt(B[i]) + (TT ? ' (' + Math.round(B[i] / TT * 100) + ' %)' : '') + '</span>'; }).join('') + '</div></div>';
        h += '<div class="card flush">' + App.table('aged', { exportName: 'balance_agee_' + k2, pdf: true, title: 'Balance âgée ' + (k2 === '411' ? 'clients' : 'fournisseurs') + ' au ' + App.date(dt), rows: ag, rowId: function (r) { return r.tiersId; }, rowAct: 'tiers-open',
          cols: [{ k: 'code', label: 'Code' }, { k: 'name', label: 'Tiers' }].concat(['Non échu', '1–30 j', '31–60 j', '61–90 j', '+ 90 j'].map(function (l, i) { return { k: 'b' + i, label: l, num: true, val: function (r) { return r.b[i]; }, fmt: function (v) { return v ? (i >= 3 ? '<b class="neg">' + U.fmt(v) + '</b>' : U.fmt(v)) : ''; } }; })).concat([{ k: 'total', label: 'Total', num: true, fmt: function (v) { return '<b>' + U.fmt(v) + '</b>'; } }]),
          foot: function () { return '<tr class="tot"><td colspan="2">Total</td>' + B.map(function (v) { return '<td class="num">' + U.fmt(v) + '</td>'; }).join('') + '<td class="num">' + U.fmt(TT) + '</td></tr>'; } }) + '</div>';
      }

      if (tab === 'lettrage') {
        var lacc = App.v('letAcc', '4111'), ltid = App.v('letTiers', ''), sel = letSel();
        var lettrables = Y.postableAccounts(S(), cid()).filter(function (x) { return x.lettrable; });
        var open = [], lettered = {};
        Y.eachLine(S(), cid(), function (l, e, idx) {
          if (ltid && l.tiersId !== ltid) return;
          if (l.letter && l.letter === l.letter.toUpperCase()) { var g = lettered[l.letter] || (lettered[l.letter] = { code: l.letter, n: 0, amt: 0, tiersId: l.tiersId, last: '' }); g.n++; g.amt += l.debit; if (e.date > g.last) g.last = e.date; return; }
          open.push({ id: e.id + '|' + idx, eid: e.id, date: e.date, num: e.num, label: l.label || e.label, tiersId: l.tiersId, debit: l.debit, credit: l.credit, letter: l.letter, due: l.due });
        }, { account: lacc });
        open.sort(function (a, b) { return (a.tiersId < b.tiersId ? -1 : (a.tiersId > b.tiersId ? 1 : (a.date < b.date ? -1 : 1))); });
        var selRows = open.filter(function (r) { return sel[r.id]; }), sd = U.sum(selRows, function (r) { return r.debit; }), sc = U.sum(selRows, function (r) { return r.credit; });
        h += '<div class="card"><div class="form-grid" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr))"><label class="fld"><span>Compte lettrable</span><select class="in" id="let_acc" data-change="let-acc">' + lettrables.map(function (x) { return '<option value="' + x.num + '"' + (x.num === lacc ? ' selected' : '') + '>' + esc(x.num + ' · ' + x.label) + '</option>'; }).join('') + '</select></label><label class="fld"><span>Tiers</span><select class="in" id="let_tiers" data-change="let-tiers"><option value="">Tous les tiers</option>' + d.tiers.filter(function (t) { return !lacc || t.collective === lacc || (lacc.slice(0, 2) === t.collective.slice(0, 2)); }).map(function (t) { return '<option value="' + t.id + '"' + (t.id === ltid ? ' selected' : '') + '>' + esc(t.code + ' · ' + t.name) + '</option>'; }).join('') + '</select></label></div></div>';
        h += '<div class="balance-bar ' + (!selRows.length ? 'neu' : (sd === sc ? 'ok' : 'bad')) + '" style="position:sticky;top:calc(env(safe-area-inset-top,0px) + 64px);z-index:3">' + App.ic(sd === sc && selRows.length ? 'check' : 'link') + '<span>' + (selRows.length ? selRows.length + ' ligne(s) · débit ' + U.fmt(sd) + ' · crédit ' + U.fmt(sc) + ' · ' + (sd === sc ? 'sélection soldée' : 'écart ' + U.fmt(Math.abs(sd - sc))) : 'Cochez des lignes de même tiers dont le débit égale le crédit.') + '</span><span class="actions" style="margin-left:auto"><button type="button" class="btn sm" data-act="let-auto"' + App.dis('letter') + '>' + App.ic('wand') + 'Lettrage automatique</button>' + (selRows.length ? '<button type="button" class="btn sm" data-act="let-clear">Désélectionner</button>' : '') + '<button type="button" class="btn sm" data-act="let-do" data-partial="1"' + (selRows.length > 1 && sd !== sc ? App.dis('letter') : ' disabled') + ' title="Lettre minuscule : rapprochement partiel (acompte, règlement partiel)">Lettrage partiel</button><button type="button" class="btn sm acc" data-act="let-do"' + (selRows.length > 1 && sd === sc ? App.dis('letter') : ' disabled') + '>' + App.ic('link') + 'Lettrer</button></span></div>';
        h += '<div class="row"><div class="card flush grow"><div class="card-h"><h2>Lignes non lettrées</h2><span class="sub">' + open.length + ' ligne(s) · solde ' + U.fmtDC(U.sum(open, function (r) { return r.debit - r.credit; })) + '</span></div><div class="tbl-wrap" style="max-height:560px;overflow:auto"><table class="t"><thead><tr><th style="width:36px"></th><th>Date</th><th>Pièce</th><th>Tiers</th><th>Libellé</th><th>Échéance</th><th class="num">Débit</th><th class="num">Crédit</th></tr></thead><tbody>' +
          (open.length ? open.map(function (r) { var t = r.tiersId ? Y.tiers(S(), cid(), r.tiersId) : null; return '<tr class="' + (sel[r.id] ? 'sel' : '') + '"><td><input type="checkbox" aria-label="Sélectionner" data-act="let-toggle" data-id="' + r.id + '"' + (sel[r.id] ? ' checked' : '') + '></td><td>' + App.date(r.date) + '</td><td><span class="mono">' + esc(r.num) + '</span></td><td>' + esc(t ? t.code + ' · ' + t.name : '—') + '</td><td>' + esc(r.label) + (r.letter ? ' ' + App.chip('partiel ' + r.letter, 'warn') : '') + '</td><td>' + App.date(r.due || '') + '</td><td class="num">' + App.m0(r.debit) + '</td><td class="num">' + App.m0(r.credit) + '</td></tr>'; }).join('') : '<tr><td colspan="8"><div class="empty"><b>Tout est lettré</b>Aucune ligne ouverte sur ce compte.</div></td></tr>') + '</tbody></table></div></div>';
        var lg = Object.keys(lettered).map(function (k) { return lettered[k]; }).sort(function (a, b) { return a.last < b.last ? 1 : -1; }).slice(0, 30);
        h += '<div class="card flush side"><div class="card-h"><h2>Derniers lettrages</h2></div><div class="list" style="padding:0 14px 10px">' + (lg.length ? lg.map(function (g) { var t = g.tiersId ? Y.tiers(S(), cid(), g.tiersId) : null; return '<div><span class="mono" style="font-weight:800;color:var(--ok);width:30px">' + esc(g.code) + '</span><span class="grow"><b style="font-size:13px">' + esc(t ? t.name : '—') + '</b><br><span class="muted" style="font-size:12px">' + g.n + ' lignes · ' + U.fmt(g.amt) + ' · ' + App.date(g.last) + '</span></span><button type="button" class="btn xs" data-act="let-undo" data-acc="' + lacc + '" data-code="' + esc(g.code) + '"' + App.dis('letter') + ' aria-label="Délettrer">' + App.ic('unlink') + '</button></div>'; }).join('') : '<div class="muted">Aucun lettrage.</div>') + '</div></div></div>';
      }
      return h + '</div>';
    }
  };
  A['ag-date'] = function (el) { App.ui.v.agDate = el.value; App.render(); };
  A['jr-code'] = function (el) { App.ui.v.jrCode = el.value; App.render(); };
  A['jr-month'] = function (el) { App.ui.v.jrMonth = el.value; App.render(); };
  A['jr-open'] = function (el) { App.ui.v.jrView = 'legal'; App.ui.v.jrCode = el.dataset.j; App.ui.v.jrMonth = el.dataset.m; App.render(); };
})();

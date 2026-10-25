/* Immobilisations : registre, fiche et plan d'amortissement, dotations mensuelles, cessions et mises au rebut, tableau de synthèse. */
(function () {
  'use strict';
  var Y = window.Yiel, U = Y.util, App = window.App, esc = App.esc, A = App.actions;
  function S() { return App.S; } function cid() { return App.cid(); }
  var METH = { L: 'Linéaire', D: 'Dégressif' };
  function assetGroup(num) { return /^21/.test(num) ? 'Incorporelles (21)' : (/^22/.test(num) ? 'Terrains (22)' : (/^23/.test(num) ? 'Bâtiments et installations (23)' : (/^245/.test(num) ? 'Matériel de transport (245)' : (/^24/.test(num) ? 'Matériel, mobilier, informatique (24)' : 'Autres (25)')))); }
  function lastMonth(y) { var t = App.today(); return U.year(t) > y ? 12 : (U.year(t) < y ? 0 : U.month(t) - 1); }
  function vncAt(a, date) { return a.value - Y.assetCumAt(a, date); }

  function assetFields() {
    var d = App.D();
    return [{ type: 'sep', label: 'Identification' },
      { k: 'label', label: 'Désignation', req: true, span: true, ph: 'Ex. Ordinateurs portables équipe conseil (x6)' },
      { k: 'account', label: 'Compte d’immobilisation', type: 'select', req: true, opts: Y.postableAccounts(S(), cid()).filter(function (a) { return /^2[1-5]/.test(a.num) && !/^2[89]/.test(a.num); }).map(function (a) { return [a.num, a.num + ' · ' + a.label]; }), val: '2441' },
      { k: 'location', label: 'Localisation', ph: 'Siège Douala, agence Yaoundé…' },
      { k: 'section', label: 'Section analytique', type: 'select', val: 'STR', opts: d.sections.filter(function (s) { return s.axis === 'ACT'; }).map(function (s) { return [s.code, s.code + ' · ' + s.label]; }) },
      { k: 'serial', label: 'N° de série / immatriculation', mono: true },
      { type: 'sep', label: 'Valeur et amortissement' },
      { k: 'value', label: 'Valeur d’origine HT (XAF)', type: 'money', req: true },
      { k: 'residual', label: 'Valeur résiduelle (XAF)', type: 'money', val: 0, help: 'Généralement nulle.' },
      { k: 'acqDate', label: 'Date d’acquisition', type: 'date', val: App.today(), req: true },
      { k: 'serviceDate', label: 'Date de mise en service', type: 'date', val: App.today(), req: true, help: 'Point de départ de l’amortissement (prorata mensuel).' },
      { k: 'years', label: 'Durée d’utilité (années)', type: 'number', req: true, val: 3 },
      { k: 'method', label: 'Mode', type: 'select', val: 'L', opts: [['L', 'Linéaire'], ['D', 'Dégressif (coefficient fiscal 1,5 / 2 / 2,5)']] },
      { type: 'sep', label: 'Origine' },
      { k: 'supplierId', label: 'Fournisseur', type: 'select', empty: '— (déjà comptabilisée ou apport)', opts: d.tiers.filter(function (t) { return t.type === 'fournisseur'; }).map(function (t) { return [t.id, t.code + ' · ' + t.name]; }) },
      { k: 'piece', label: 'N° de facture', mono: true },
      { k: 'withEntry', label: 'Comptabiliser l’acquisition dans le journal IMMO (481 fournisseur d’investissement, TVA 4451)', type: 'check', span: true, val: false },
      { k: 'taxCode', label: 'TVA de la facture', type: 'select', val: 'TVA19', opts: [['TVA19', 'TVA 19,25 %'], ['EXO', 'Exonérée']] }];
  }
  A['asset-new'] = function () {
    if (!App.guard('post')) return;
    App.form({ title: 'Nouvelle immobilisation', sub: 'Inscription au registre, plan d’amortissement calculé immédiatement.', fields: assetFields(), wide: true, submit: 'Inscrire au registre',
      live: function (v) {
        if (!(v.value > 0) || !(v.years > 0) || !v.serviceDate) return '<div class="balance-bar neu">' + App.ic('cal') + 'Renseignez la valeur, la durée et la date de mise en service pour voir le plan.</div>';
        var acc = Y.assetAccounts(v.account || '24'), rows = Y.assetSchedule({ value: v.value, residual: v.residual || 0, years: v.years, method: v.method, serviceDate: v.serviceDate });
        return '<div class="card flush" style="margin-top:6px"><div class="card-h"><h2>Plan d’amortissement prévisionnel</h2><span class="sub">' + esc(acc.dot) + ' / ' + esc(acc.amort) + (v.method === 'D' ? ' · coefficient ' + String(Y.degCoef(v.years)).replace('.', ',') : '') + '</span></div><div class="tbl-wrap"><table class="t"><thead><tr><th>Exercice</th><th class="num">Mois</th><th class="num">Dotation</th><th class="num">Cumul</th><th class="num">VNC fin</th></tr></thead><tbody>' + rows.map(function (r) { return '<tr><td>' + r.year + '</td><td class="num">' + r.months + '</td><td class="num">' + U.fmt(r.dot) + '</td><td class="num">' + U.fmt(r.cum) + '</td><td class="num">' + U.fmt(r.vnc) + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
      },
      onSubmit: function (v) {
        if (v.withEntry && !v.supplierId) throw new Y.BizError('Choisissez le fournisseur pour comptabiliser l’acquisition.');
        var a = { label: v.label, account: v.account, location: v.location, section: v.section, serial: v.serial, value: v.value, residual: v.residual || 0, acqDate: v.acqDate, serviceDate: v.serviceDate, years: v.years, method: v.method, supplierId: v.supplierId, piece: v.piece };
        var rec = Y.createAsset(S(), cid(), a, { withEntry: v.withEntry, taxCode: v.taxCode });
        var y = U.year(App.today());
        for (var yy = U.year(rec.serviceDate); yy < y; yy++) for (var m = 1; m <= 12; m++) if (Y.assetMonthDot(rec, yy, m)) rec.posted[yy + '-' + U.pad(m, 2)] = true;
        return rec;
      }, done: function (r) { return r.code + ' inscrite au registre' + (r.entryNum ? ' · acquisition ' + r.entryNum : '') + '.'; } });
  };
  A['asset-open'] = function (el) {
    var a = App.D().assets.find(function (x) { return x.id === el.dataset.id; }); if (!a) return;
    var rows = Y.assetSchedule(a), t = Y.tiers(S(), cid(), a.supplierId);
    var body = '<div class="actions">' + App.chip(a.status === 'active' ? 'En service' : (a.disposal.kind === 'cession' ? 'Cédée' : 'Mise au rebut'), a.status === 'active' ? 'ok' : '', true) + App.chip(METH[a.method] + ' · ' + a.years + ' ans', 'info') + '</div>' +
      '<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px"><div class="kpi"><span class="lbl">Valeur d’origine</span><span class="val" style="font-size:19px">' + U.fmt(a.value) + '</span></div><div class="kpi"><span class="lbl">Amortissements cumulés</span><span class="val" style="font-size:19px">' + U.fmt(Y.assetCumAt(a, a.disposal ? a.disposal.date : App.today())) + '</span></div><div class="kpi"><span class="lbl">VNC ' + (a.disposal ? 'à la sortie' : 'à ce jour') + '</span><span class="val" style="font-size:19px">' + U.fmt(a.disposal ? a.disposal.vnc : vncAt(a, App.today())) + '</span></div></div>' +
      '<dl class="kv"><dt>Code</dt><dd class="mono">' + esc(a.code) + '</dd><dt>Compte</dt><dd><span class="ac">' + esc(a.account) + '</span> ' + esc(Y.accountLabel(S(), cid(), a.account)) + '</dd><dt>Amortissement / dotation</dt><dd>' + esc(a.amortAccount) + ' / ' + esc(a.dotAccount) + '</dd><dt>Acquisition</dt><dd>' + App.date(a.acqDate) + '</dd><dt>Mise en service</dt><dd>' + App.date(a.serviceDate) + '</dd><dt>Fournisseur</dt><dd>' + esc(t ? t.name : '—') + '</dd><dt>Facture</dt><dd>' + esc(a.piece || '—') + '</dd><dt>Localisation</dt><dd>' + esc(a.location || '—') + '</dd><dt>Section</dt><dd>' + esc(a.section || '—') + '</dd>' + (a.serial ? '<dt>N° de série</dt><dd class="mono">' + esc(a.serial) + '</dd>' : '') + (a.entryNum ? '<dt>Écriture d’acquisition</dt><dd class="mono">' + esc(a.entryNum) + '</dd>' : '') + (a.disposal ? '<dt>Sortie</dt><dd>' + App.date(a.disposal.date) + ' · ' + esc(a.disposal.entryNum) + '</dd><dt>Prix de cession</dt><dd>' + U.fmt(a.disposal.price) + '</dd><dt>Plus ou moins-value</dt><dd class="' + (a.disposal.gain < 0 ? 'neg' : 'pos') + '">' + U.fmt(a.disposal.gain) + '</dd>' : '') + '</dl>' +
      '<div class="tbl-wrap" style="border:1px solid var(--line);border-radius:12px"><table class="t"><thead><tr><th>Exercice</th><th class="num">Mois</th><th class="num">Base</th><th class="num">Dotation</th><th class="num">Cumul</th><th class="num">VNC</th><th>Passée</th></tr></thead><tbody>' +
      rows.map(function (r) { var n = 0, tot = 0; for (var m = 1; m <= 12; m++) if (Y.assetMonthDot(a, r.year, m)) { tot++; if (a.posted[r.year + '-' + U.pad(m, 2)]) n++; } return '<tr' + (r.year === App.year() ? ' class="sub"' : '') + '><td>' + r.year + '</td><td class="num">' + r.months + '</td><td class="num">' + U.fmt(r.base) + '</td><td class="num">' + U.fmt(r.dot) + '</td><td class="num">' + U.fmt(r.cum) + '</td><td class="num">' + U.fmt(r.vnc) + '</td><td>' + App.chip(n + ' / ' + tot, n === tot ? 'ok' : (n ? 'warn' : ''), true) + '</td></tr>'; }).join('') + '</tbody></table></div>';
    var foot = '<button type="button" class="btn" data-act="asset-pdf" data-id="' + a.id + '">' + App.ic('pdf') + 'Fiche PDF</button>' + (a.status === 'active' ? '<button type="button" class="btn acc" data-act="asset-dispose" data-id="' + a.id + '"' + App.dis('post') + '>Céder ou mettre au rebut</button>' : '');
    App.drawer({ title: a.code + ' · ' + a.label, sub: assetGroup(a.account), body: body, foot: foot, wide: true, noFocus: true });
  };
  A['asset-pdf'] = function (el) {
    var a = App.D().assets.find(function (x) { return x.id === el.dataset.id; });
    var doc = App.pdfDoc('Fiche d’immobilisation', a.code + ' · ' + a.label); if (!doc) return;
    App.pdfAuto(doc, ['Élément', 'Valeur'], [['Compte', a.account + ' · ' + Y.accountLabel(S(), cid(), a.account)], ['Valeur d’origine HT', U.fmt(a.value)], ['Mise en service', App.date(a.serviceDate)], ['Mode / durée', METH[a.method] + ' · ' + a.years + ' ans'], ['Comptes', a.amortAccount + ' / ' + a.dotAccount], ['Localisation', a.location || '—'], ['VNC à ce jour', U.fmt(vncAt(a, App.today()))]]);
    App.pdfAuto(doc, ['Exercice', 'Mois', 'Base', 'Dotation', 'Cumul', 'VNC'], Y.assetSchedule(a).map(function (r) { return [r.year, r.months, U.fmt(r.base), U.fmt(r.dot), U.fmt(r.cum), U.fmt(r.vnc)]; }), { numCols: [2, 3, 4, 5] });
    App.pdfFinish(doc, 'fiche_' + a.code + '.pdf');
  };
  A['asset-dispose'] = function (el) {
    if (!App.guard('post')) return;
    var a = App.D().assets.find(function (x) { return x.id === el.dataset.id; });
    App.form({ title: 'Sortie de l’actif · ' + a.code, sub: a.label + ' · VO ' + U.fmt(a.value) + ' XAF',
      intro: 'La sortie passe les dotations complémentaires jusqu’à la date de cession, sort les amortissements (28), constate la valeur comptable (81) et le produit de cession (82) contre la créance sur cession (485).',
      fields: [{ k: 'date', label: 'Date de sortie', type: 'date', val: App.today(), req: true }, { k: 'kind', label: 'Nature', type: 'select', val: 'cession', opts: [['cession', 'Cession (vente)'], ['rebut', 'Mise au rebut (prix nul)']] },
        { k: 'price', label: 'Prix de cession HT (XAF)', type: 'money', val: '' }, { k: 'tiersId', label: 'Acquéreur', type: 'select', empty: 'Acquéreurs divers (C9999)', opts: App.D().tiers.filter(function (t) { return t.type === 'client'; }).map(function (t) { return [t.id, t.code + ' · ' + t.name]; }) }],
      submit: 'Comptabiliser la sortie',
      live: function (v) { if (!v.date) return ''; var cum = Y.assetCumAt(a, v.date), vnc = a.value - cum, p = v.kind === 'rebut' ? 0 : (v.price || 0); return '<div class="balance-bar ' + (p - vnc >= 0 ? 'ok' : 'bad') + '">' + App.ic('money') + 'Cumul d’amortissements ' + U.fmt(cum) + ' · VNC ' + U.fmt(vnc) + ' · ' + (p - vnc >= 0 ? 'plus-value ' : 'moins-value ') + U.fmt(Math.abs(p - vnc)) + ' XAF</div>'; },
      onSubmit: function (v) { return Y.disposeAsset(S(), cid(), a.id, { date: v.date, price: v.kind === 'rebut' ? 0 : v.price, tiersId: v.tiersId }); }, done: function (e) { return 'Sortie comptabilisée : ' + e.num + '.'; } });
  };
  A['dep-run'] = function (el) {
    if (!App.guard('post')) return;
    var y = App.year(), m = +el.dataset.m;
    App.run(function () { var e = Y.depreciationRun(S(), cid(), y, m); if (!e) throw new Y.BizError('Aucune dotation à passer pour ' + U.MONTHS[m - 1] + ' ' + y + '.'); return e; }, function (e) { return 'Dotations de ' + U.MONTHS[m - 1] + ' passées : ' + e.num + ' (' + U.fmt(Y.entryTotals(e).debit) + ' XAF).'; });
  };
  A['dep-run-all'] = function () {
    if (!App.guard('post')) return;
    var y = App.year(), lm = lastMonth(y), done = [], errs = [], locked = [], fy = Y.fiscalYear(S(), cid(), y) || { locked: [] };
    for (var m = 1; m <= lm; m++) { if (fy.locked.indexOf(m) > -1) { if (App.D().assets.some(function (a) { return a.status === 'active' && Y.assetMonthDot(a, y, m) && !a.posted[y + '-' + U.pad(m, 2)]; })) locked.push(U.MONTHS[m - 1]); continue; } try { var e = Y.depreciationRun(S(), cid(), y, m); if (e) done.push(e.num); } catch (x) { errs.push(U.MONTHS[m - 1] + ' : ' + (x.messages || [x.message]).join(' ')); } }
    App.commit();
    if (done.length) App.toast(done.length + ' écriture(s) de dotation passée(s) : ' + done.join(', ') + '.', 'ok'); else if (!errs.length && !locked.length) App.toast('Toutes les dotations échues sont déjà passées.', 'ok');
    if (locked.length) App.toast('Périodes verrouillées ignorées (' + locked.join(', ') + ') : rouvrez-les dans Paramètres ou passez une dotation de rattrapage sur une période ouverte.', 'bad');
    if (errs.length) App.toast(errs.join(' · '), 'bad');
  };

  function synth(y) {
    var d = App.D(), from = y + '-01-01', to = y + '-12-31', g = {};
    d.assets.forEach(function (a) {
      var k = assetGroup(a.account), r = g[k] || (g[k] = { group: k, b0: 0, acq: 0, out: 0, b1: 0, a0: 0, dot: 0, rep: 0, a1: 0 });
      var inStart = a.serviceDate < from, outDate = a.disposal ? a.disposal.date : null;
      if (inStart && !(outDate && outDate < from)) { r.b0 += a.value; r.a0 += Y.assetCumAt(a, (y - 1) + '-12-31'); }
      if (a.serviceDate >= from && a.serviceDate <= to) r.acq += a.value;
      if (outDate && outDate >= from && outDate <= to) { r.out += a.value; r.rep += Y.assetCumAt(a, outDate); }
      if (a.serviceDate <= to && !(outDate && outDate < from)) { var cEnd = Y.assetCumAt(a, outDate && outDate <= to ? outDate : (to > App.today() ? App.today() : to)), cStart = inStart ? Y.assetCumAt(a, (y - 1) + '-12-31') : 0; r.dot += cEnd - cStart; }
    });
    return Object.keys(g).sort().map(function (k) { var r = g[k]; r.b1 = r.b0 + r.acq - r.out; r.a1 = r.a0 + r.dot - r.rep; r.vnc = r.b1 - r.a1; return r; });
  }

  App.pages.immos = {
    render: function () {
      var d = App.D(), y = App.year(), tab = App.tab('immos', 'registre'), lm = lastMonth(y);
      var active = d.assets.filter(function (a) { return a.status === 'active'; });
      var fyL = (Y.fiscalYear(S(), cid(), y) || { locked: [] }).locked, missing = 0; active.forEach(function (a) { for (var m = 1; m <= lm; m++) if (fyL.indexOf(m) < 0 && Y.assetMonthDot(a, y, m) && !a.posted[y + '-' + U.pad(m, 2)]) missing++; });
      var vo = U.sum(active, function (a) { return a.value; }), vnc = U.sum(active, function (a) { return vncAt(a, App.today()); });
      var h = '<div class="page">' + App.head('Comptabilité · Actif immobilisé', 'Immobilisations <span class="serif">&amp; amortissements</span>', 'Registre conforme SYSCOHADA révisé : amortissement linéaire ou dégressif au prorata mensuel, dotations automatisées, cessions avec plus ou moins-values (comptes 81/82).',
        (missing ? '<button type="button" class="btn" data-act="dep-run-all"' + App.dis('post') + '>' + App.ic('bolt') + 'Passer les ' + missing + ' dotation(s) en retard</button>' : '') + '<button type="button" class="btn acc" data-act="asset-new"' + App.dis('post') + '>' + App.ic('plus') + 'Immobilisation</button>');
      h += '<div class="grid g4"><div class="kpi"><span class="lbl">Valeur brute en service</span><span class="val" data-count="' + vo + '">' + U.fmt(vo) + '</span><span class="delta">' + active.length + ' bien(s)</span></div><div class="kpi"><span class="lbl">Valeur nette comptable</span><span class="val" data-count="' + vnc + '">' + U.fmt(vnc) + '</span><span class="delta">' + (vo ? Math.round(vnc / vo * 100) : 0) + ' % de la valeur brute</span></div><div class="kpi"><span class="lbl">Dotations ' + y + ' (plan)</span><span class="val">' + U.fmt(U.sum(active, function (a) { var r = Y.assetSchedule(a).find(function (x) { return x.year === y; }); return r ? r.dot : 0; })) + '</span><span class="delta">comptes 681</span></div><div class="kpi"><span class="lbl">Dotations en retard</span><span class="val' + (missing ? ' neg' : '') + '">' + missing + '</span><span class="delta">' + (missing ? 'à passer avant la clôture' : 'registre à jour') + '</span></div></div>';
      h += App.tabs('immos', [['registre', 'Registre', d.assets.length], ['dotations', 'Dotations ' + y], ['cessions', 'Cessions & rebuts', d.assets.filter(function (a) { return a.disposal; }).length], ['synthese', 'Tableau de synthèse']], 'registre');
      if (tab === 'registre') {
        var st = App.v('asSt', 'active');
        h += '<div class="card flush">' + App.table('assets', { exportName: 'registre_immobilisations', pdf: true, title: 'Registre des immobilisations', rowAct: 'asset-open', groupBy: function (a) { return assetGroup(a.account); },
          rows: d.assets.filter(function (a) { return st === 'all' || (st === 'active' ? a.status === 'active' : a.status !== 'active'); }).sort(function (a, b) { return a.account < b.account ? -1 : (a.account > b.account ? 1 : (a.code < b.code ? -1 : 1)); }),
          toolbar: App.filters('asSt', [['active', 'En service'], ['out', 'Sorties'], ['all', 'Toutes']], st),
          cols: [{ k: 'code', label: 'Code', fmt: function (v) { return '<span class="mono">' + esc(v) + '</span>'; } }, { k: 'label', label: 'Désignation', fmt: function (v, a) { return '<b>' + esc(v) + '</b><br><span class="muted" style="font-size:12px">' + esc(a.location || '') + (a.section ? ' · ' + esc(a.section) : '') + '</span>'; } },
            { k: 'account', label: 'Compte', fmt: function (v) { return '<span class="ac">' + esc(v) + '</span>'; } }, { k: 'serviceDate', label: 'Mise en service', fmt: App.date }, { k: 'method', label: 'Mode', val: function (a) { return METH[a.method] + ' ' + a.years + ' ans'; } },
            { k: 'value', label: 'Valeur d’origine', num: true, fmt: function (v) { return U.fmt(v); } }, { k: 'cum', label: 'Amort. cumulés', num: true, val: function (a) { return Y.assetCumAt(a, a.disposal ? a.disposal.date : App.today()); }, fmt: function (v) { return U.fmt(v); } },
            { k: 'vnc', label: 'VNC', num: true, val: function (a) { return a.disposal ? 0 : vncAt(a, App.today()); }, fmt: function (v) { return '<b>' + U.fmt(v) + '</b>'; } }, { k: 'status', label: 'État', fmt: function (v, a) { return App.chip(v === 'active' ? 'En service' : (a.disposal.kind === 'cession' ? 'Cédée' : 'Rebut'), v === 'active' ? 'ok' : '', true); } }],
          foot: function (rows) { return '<tr class="tot"><td colspan="5">Total</td><td class="num">' + U.fmt(U.sum(rows, function (a) { return a.value; })) + '</td><td class="num">' + U.fmt(U.sum(rows, function (a) { return Y.assetCumAt(a, a.disposal ? a.disposal.date : App.today()); })) + '</td><td class="num">' + U.fmt(U.sum(rows, function (a) { return a.disposal ? 0 : vncAt(a, App.today()); })) + '</td><td></td></tr>'; },
          emptyTitle: 'Aucune immobilisation', emptyAction: '<div style="margin-top:10px"><button type="button" class="btn sm acc" data-act="asset-new">' + App.ic('plus') + 'Inscrire une immobilisation</button> <button type="button" class="btn sm" data-act="go" data-page="imports" data-tab="import">Importer un registre</button></div>' }) + '</div>';
      }
      if (tab === 'dotations') {
        var fy = Y.fiscalYear(S(), cid(), y) || { locked: [] };
        h += '<div class="card flush"><div class="card-h"><h2>Dotations mensuelles · exercice ' + y + '</h2><span class="sub">Une écriture OD par mois, regroupée par compte de dotation, d’amortissement et section.</span></div><div class="tbl-wrap"><table class="t"><thead><tr><th>Mois</th><th class="num">Biens concernés</th><th class="num">Dotation du mois</th><th>État</th><th>Écriture</th><th></th></tr></thead><tbody>';
        var tot = 0;
        for (var m = 1; m <= 12; m++) {
          var key = y + '-' + U.pad(m, 2), amt = 0, n = 0, posted = 0;
          d.assets.forEach(function (a) { var dot = Y.assetMonthDot(a, y, m); if (dot && (a.status === 'active' || a.posted[key])) { amt += dot; n++; if (a.posted[key]) posted++; } });
          tot += amt;
          var e = d.entries.find(function (x) { return x.status === 'validated' && x.ref === 'DOT-' + key; });
          var due = m <= lm, locked = fy.locked.indexOf(m) > -1;
          h += '<tr><td><b>' + U.MONTHS[m - 1] + '</b></td><td class="num">' + n + '</td><td class="num">' + U.fmt(amt) + '</td><td>' + (posted && posted === n ? App.chip('Passée', 'ok', true) : (due ? App.chip(locked ? 'Période verrouillée' : 'En retard', locked ? '' : 'warn', true) : App.chip('À venir', '', true))) + '</td><td>' + (e ? '<button type="button" class="btn xs" data-act="entry-open" data-id="' + e.id + '"><span class="mono">' + esc(e.num) + '</span></button>' : '') + '</td><td style="text-align:right">' + (posted < n && !locked ? '<button type="button" class="btn xs pri" data-act="dep-run" data-m="' + m + '"' + App.dis('post') + '>Passer</button>' : '') + '</td></tr>';
        }
        h += '<tr class="tot"><td>Total ' + y + '</td><td></td><td class="num">' + U.fmt(tot) + '</td><td colspan="3"></td></tr></tbody></table></div></div>';
        h += '<div class="callout info">' + App.ic('shield') + '<span>Chaque mois n’est passé qu’une fois (marqueur par bien). Les mois verrouillés ne peuvent plus recevoir de dotation : rouvrez la période dans Paramètres, avec motif tracé dans la piste d’audit.</span></div>';
      }
      if (tab === 'cessions') {
        h += '<div class="card flush">' + App.table('disposals', { exportName: 'cessions_immobilisations', rows: d.assets.filter(function (a) { return a.disposal; }), rowAct: 'asset-open', emptyTitle: 'Aucune sortie d’actif', empty: 'Ouvrez une immobilisation du registre pour la céder ou la mettre au rebut.',
          cols: [{ k: 'code', label: 'Code' }, { k: 'label', label: 'Désignation' }, { k: 'date', label: 'Date de sortie', val: function (a) { return a.disposal.date; }, fmt: App.date }, { k: 'kind', label: 'Nature', val: function (a) { return a.disposal.kind === 'cession' ? 'Cession' : 'Mise au rebut'; } },
            { k: 'value', label: 'Valeur d’origine', num: true, fmt: function (v) { return U.fmt(v); } }, { k: 'vnc', label: 'VNC (81)', num: true, val: function (a) { return a.disposal.vnc; }, fmt: function (v) { return U.fmt(v); } }, { k: 'price', label: 'Prix (82)', num: true, val: function (a) { return a.disposal.price; }, fmt: function (v) { return U.fmt(v); } },
            { k: 'gain', label: '+/− value', num: true, val: function (a) { return a.disposal.gain; }, fmt: function (v) { return '<b class="' + (v < 0 ? 'neg' : 'pos') + '">' + U.fmt(v) + '</b>'; } }, { k: 'entry', label: 'Écriture', val: function (a) { return a.disposal.entryNum; }, fmt: function (v) { return '<span class="mono">' + esc(v) + '</span>'; } }] }) + '</div>';
      }
      if (tab === 'synthese') {
        var rows = synth(y);
        App._tables.synth = { name: 'synthese_immobilisations_' + y, title: 'Tableau des immobilisations ' + y, cols: [{ label: 'Rubrique' }, { label: 'Brut début', num: 1 }, { label: 'Acquisitions', num: 1 }, { label: 'Sorties', num: 1 }, { label: 'Brut fin', num: 1 }, { label: 'Amort. début', num: 1 }, { label: 'Dotations', num: 1 }, { label: 'Reprises', num: 1 }, { label: 'Amort. fin', num: 1 }, { label: 'VNC fin', num: 1 }],
          rows: rows.map(function (r) { return { a: r.group, b: r.b0, c: r.acq, d: r.out, e: r.b1, f: r.a0, g: r.dot, h: r.rep, i: r.a1, j: r.vnc }; }) };
        App._tables.synth.cols.forEach(function (c, i) { c.k = 'abcdefghij'[i]; });
        h += '<div class="card flush"><div class="card-h"><h2>Tableau des immobilisations et des amortissements · ' + y + '</h2><span class="sub">Notes annexes 3A et 3C de la liasse (mouvements de l’exercice)</span><div class="actions" style="margin-left:auto"><button type="button" class="btn sm" data-act="tbl-export" data-id="synth" data-fmt="xlsx">' + App.ic('table') + 'Excel</button><button type="button" class="btn sm" data-act="tbl-export" data-id="synth" data-fmt="pdf">' + App.ic('pdf') + 'PDF</button></div></div><div class="tbl-wrap"><table class="t"><thead><tr><th>Rubrique</th><th class="num">Brut début</th><th class="num">Acquisitions</th><th class="num">Sorties</th><th class="num">Brut fin</th><th class="num">Amort. début</th><th class="num">Dotations</th><th class="num">Reprises</th><th class="num">Amort. fin</th><th class="num">VNC fin</th></tr></thead><tbody>' +
          rows.map(function (r) { return '<tr><td><b>' + esc(r.group) + '</b></td><td class="num">' + U.fmt(r.b0) + '</td><td class="num">' + U.fmt(r.acq) + '</td><td class="num">' + U.fmt(r.out) + '</td><td class="num">' + U.fmt(r.b1) + '</td><td class="num">' + U.fmt(r.a0) + '</td><td class="num">' + U.fmt(r.dot) + '</td><td class="num">' + U.fmt(r.rep) + '</td><td class="num">' + U.fmt(r.a1) + '</td><td class="num"><b>' + U.fmt(r.vnc) + '</b></td></tr>'; }).join('') +
          '<tr class="tot"><td>Total</td>' + ['b0', 'acq', 'out', 'b1', 'a0', 'dot', 'rep', 'a1', 'vnc'].map(function (k) { return '<td class="num">' + U.fmt(U.sum(rows, function (r) { return r[k]; })) + '</td>'; }).join('') + '</tr></tbody></table></div></div>';
        h += '<div class="callout">' + App.ic('eye') + '<span>Dotations de l’exercice calculées jusqu’au ' + App.date(y < U.year(App.today()) ? y + '-12-31' : App.today()) + ' (exercice en cours : cumul à date).</span></div>';
      }
      return h + '</div>';
    }
  };
})();

/* Tableau de bord du DAF : preuve d'équilibre, santé comptable, indicateurs, trésorerie, échéances, points d'attention. */
(function () {
  'use strict';
  var Y = window.Yiel, U = Y.util, App = window.App, esc = App.esc, A = App.actions;

  App.head = function (eyebrow, title, desc, actions) {
    return '<div class="page-head"><div class="t"><div class="eyebrow">' + esc(eyebrow) + '</div><h1>' + title + '</h1>' + (desc ? '<p>' + desc + '</p>' : '') + '</div>' + (actions ? '<div class="actions">' + actions + '</div>' : '') + '</div>';
  };

  App.insights = function () {
    var S = App.S, cid = App.cid(), d = App.D(), out = [], today = App.today();
    var late = Y.agedBalance(S, cid, '411', today).filter(function (r) { return r.b[3] + r.b[4] > 0; });
    late.slice(0, 2).forEach(function (r) { out.push({ tone: 'bad', title: r.name + ' : ' + U.fmt(r.b[3] + r.b[4]) + ' XAF échus depuis plus de 60 jours', text: 'Relancez avec un lien de paiement Mobile Money ou provisionnez la créance à la clôture.', act: 'go', page: 'ventes', tab: 'relances', btn: 'Relancer' }); });
    var dup = [], ach = Y.validated(S, cid).filter(function (e) { return e.journal === 'ACH'; });
    ach.forEach(function (e, i) { ach.slice(i + 1).forEach(function (f) { var a = e.lines.find(function (l) { return l.tiersId; }), b = f.lines.find(function (l) { return l.tiersId; }); if (a && b && a.tiersId === b.tiersId && a.credit === b.credit && Math.abs(U.daysBetween(e.date, f.date)) <= 3) dup.push([e, f]); }); });
    if (dup.length) out.push({ tone: 'warn', title: 'Doublon probable : ' + dup[0][0].num + ' et ' + dup[0][1].num, text: 'Même fournisseur, même montant, à moins de 3 jours d’écart.', act: 'entry-open', id: dup[0][1].id, btn: 'Examiner' });
    var open = d.bankTx.filter(function (t) { return t.status === 'open'; });
    if (open.length) out.push({ tone: 'info', title: open.length + ' mouvement(s) de trésorerie à rapprocher', text: 'Dont ' + open.filter(function (t) { return Y.ruleFor(S, cid, t); }).length + ' reconnus par une règle d’affectation.', act: 'go', page: 'banque', tab: 'rappro', btn: 'Rapprocher' });
    var s471 = Y.net(S, cid, '471');
    if (s471) out.push({ tone: 'warn', title: 'Compte d’attente 471 non soldé : ' + U.fmtDC(s471), text: 'À affecter avant la clôture.', act: 'go', page: 'livres', tab: 'gl', btn: 'Voir' });
    var k = Y.kpis(S, cid, App.year(), U.month(today));
    var avg = U.sum(k.series.slice(0, U.month(today) - 1), function (x) { return x.ch; }) / Math.max(1, U.month(today) - 1);
    var prev = k.series[U.month(today) - 2];
    if (prev && prev.ch > avg * 1.25) out.push({ tone: 'info', title: 'Charges de ' + U.MONTHS[U.month(today) - 2] + ' supérieures de ' + Math.round((prev.ch / avg - 1) * 100) + ' % à la moyenne', text: 'Vérifiez les imputations du mois dans le grand livre.', act: 'go', page: 'livres', tab: 'balance', btn: 'Analyser' });
    var drafts = d.entries.filter(function (e) { return e.status === 'draft'; });
    var bad = drafts.filter(function (e) { return Y.entryTotals(e).diff !== 0; });
    if (bad.length) out.push({ tone: 'bad', title: bad.length + ' brouillon(s) déséquilibré(s)', text: 'Ils ne pourront pas être validés en l’état.', act: 'go', page: 'saisie', tab: 'drafts', btn: 'Corriger' });
    return out;
  };

  App.deadlines = function () {
    var S = App.S, cid = App.cid(), d = App.D(), today = App.today(), y = U.year(today), m = U.month(today), out = [];
    function add(date, title, sub, amount, status) { out.push({ date: date, title: title, sub: sub, amount: amount, status: status }); }
    for (var k = 0; k < 2; k++) {
      var mm = m + k, yy = y; if (mm > 12) { mm -= 12; yy++; }
      var pm = mm - 1, py = yy; if (pm < 1) { pm = 12; py--; }
      var due = yy + '-' + U.pad(mm, 2) + '-15';
      var vr = Y.vatReturn(S, cid, py, pm);
      add(due, 'TVA · ' + U.MONTHS[pm - 1] + ' ' + py, 'Déclaration et paiement DGI', vr.due, vr.status === 'paid' ? 'paid' : (vr.status === 'liquidated' ? 'ready' : 'todo'));
      var cn = -Y.net(S, cid, '431', { to: U.monthEnd(py, pm) });
      add(due, 'CNPS · ' + U.MONTHS[pm - 1], 'Cotisations sociales', cn > 0 ? cn : 0, cn > 0 ? 'todo' : 'paid');
      var ir = -Y.net(S, cid, '447', { to: U.monthEnd(py, pm) });
      add(due, 'IRPP et retenues · ' + U.MONTHS[pm - 1], 'Retenues à la source', ir > 0 ? ir : 0, ir > 0 ? 'todo' : 'paid');
      var ca = 0; Y.eachLine(S, cid, function (l) { ca += l.credit - l.debit; }, { account: '70', from: py + '-' + U.pad(pm, 2) + '-01', to: U.monthEnd(py, pm) });
      add(due, 'Acompte d’IS · ' + U.MONTHS[pm - 1], d.settings.minTaxRate.toString().replace('.', ',') + ' % du chiffre d’affaires', U.round(Math.max(ca, 0) * d.settings.minTaxRate / 100), 'todo');
    }
    add((y + 1) + '-03-15', 'DSF ' + y, 'Liasse annuelle · télédéclaration DGI', null, 'todo');
    return out.filter(function (x) { return x.date >= U.addDays(today, -10); }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  };

  App.pages.dashboard = {
    render: function () {
      var S = App.S, cid = App.cid(), d = App.D(), today = App.today(), y = App.year();
      var per = App.v('dashPer', 'ytd'), m = y === U.year(today) ? U.month(today) : 12;
      var k = Y.kpis(S, cid, y, m), hl = Y.health(S, cid, y);
      var tt = 0, n = 0; Y.validated(S, cid).forEach(function (e) { n++; e.lines.forEach(function (l) { tt += l.debit; }); });
      var audit = Y.verifyAudit(S, cid);
      var hour = new Date().getHours(), hello = hour < 12 ? 'Bonjour' : (hour < 18 ? 'Bon après-midi' : 'Bonsoir');
      var h = '<div class="page">';
      h += '<section class="hero">' + (window.YIEL_MARK ? '<img class="mark" src="' + window.YIEL_MARK + '" alt="">' : '') +
        '<div style="flex:1 1 460px;min-width:0;position:relative"><div class="eyebrow" style="color:#AEB3CF">' + esc(hello) + ', ' + esc(App.user().name) + ' · ' + esc(U.frDate(today)) + '</div><h1 style="margin-top:8px">' + esc(App.co().name) + ', <span class="serif">des comptes prouvés en temps réel.</span></h1>' +
        '<div class="proof"><span>Débit = crédit · <b>' + U.fmt(tt) + '</b> <span class="okc">✓</span></span><span><b>' + n + '</b> écritures validées</span><span>Piste d’audit ' + (audit.ok ? '<span class="okc">intègre</span> · ' + audit.count + ' évènements chaînés' : '<b style="color:#FF8A7E">rompue</b>') + '</span><span>Exercice ' + y + ' · ' + (Y.fiscalYear(S, cid, y) || { locked: [] }).locked.length + '/12 périodes verrouillées</span></div></div>' +
        '<div style="display:flex;align-items:center;gap:14px;position:relative">' + App.ring(hl.score).replace('fill:var(--fg)', 'fill:#fff').replace('var(--surface-3)', 'rgba(255,255,255,.14)') + '<div><div style="font-weight:800">Santé comptable</div><div style="color:#C7CAE0;font-size:12.5px;max-width:200px">' + hl.checks.filter(function (c) { return c.level !== 'ok'; }).length + ' point(s) à traiter avant la clôture</div><button type="button" class="btn sm" style="margin-top:8px" data-act="go" data-page="cloture">Voir les contrôles</button></div></div></section>';

      h += '<div class="actions" style="justify-content:space-between"><div class="actions">' + App.seg('dashPer', [['month', U.MONTHS[m - 1].replace(/^./, function (c) { return c.toUpperCase(); }) + ' ' + y], ['ytd', 'Cumul ' + y]], per) + '</div><div class="actions"><button type="button" class="btn sm" data-act="go" data-page="saisie" data-tab="new"' + App.dis('draft') + '>' + App.ic('plus') + 'Écriture</button><button type="button" class="btn sm" data-act="doc-new-go" data-type="FA"' + App.dis('invoice') + '>' + App.ic('plus') + 'Facture</button><button type="button" class="btn sm" data-act="go" data-page="imports" data-tab="import">' + App.ic('upload') + 'Importer</button></div></div>';

      var ca = per === 'ytd' ? k.caYtd : k.caMonth, ch = per === 'ytd' ? k.chYtd : k.chMonth, res = per === 'ytd' ? k.resYtd : k.resMonth;
      var ser = k.series.slice(0, m);
      function kpi(lbl, val, sub, spark, color, tone) { return '<div class="card kpi"><span class="lbl">' + esc(lbl) + '</span><span class="val' + (tone ? ' ' + tone : '') + '"><span data-count="' + val + '">' + U.fmt(val) + '</span><small>XAF</small></span><span class="delta">' + sub + '</span>' + (spark || '') + '</div>'; }
      h += '<section class="grid g3" aria-label="Indicateurs">' +
        kpi('Chiffre d’affaires HT', ca, 'Comptes 70 · ' + (per === 'ytd' ? 'depuis le 1er janvier' : 'mois en cours'), App.spark(ser.map(function (x) { return x.ca; }), 'var(--c1)'), 'var(--c1)') +
        kpi('Charges d’exploitation', ch, 'Classe 6 · ' + (ca ? Math.round(ch / ca * 100) + ' % du CA' : '—'), App.spark(ser.map(function (x) { return x.ch; }), 'var(--c2)'), 'var(--c2)') +
        kpi('Résultat avant impôt', res, res >= 0 ? 'Marge ' + (ca ? Math.round(res / ca * 100) : 0) + ' %' : 'Perte', App.spark(ser.map(function (x) { return x.ca - x.ch; }), 'var(--c4)'), '', res < 0 ? 'neg' : '') +
        kpi('Trésorerie disponible', k.treso, 'Banques, Mobile Money et caisse', App.spark(ser.map(function (x) { return x.cash; }), 'var(--c1)')) +
        kpi('TVA à reverser · ' + U.MONTHS[m - 1], k.vat.due, 'Collectée ' + U.fmt(k.vat.collected) + ' − déductible ' + U.fmt(k.vat.deductible)) +
        kpi('Créances clients échues', k.late, 'Sur ' + U.fmt(k.receivable) + ' de créances ouvertes', '', '', k.late ? 'neg' : '') + '</section>';

      h += '<div class="row"><div class="card grow"><div class="card-h"><h2>Produits, charges et trésorerie · ' + y + '</h2><div class="legend" style="margin-left:auto"><span><i style="background:var(--c1)"></i>Produits</span><span><i style="background:var(--c2)"></i>Charges</span><span><i style="background:var(--c4)"></i>Trésorerie fin de mois</span></div></div>' +
        App.barChart([{ name: 'Produits', values: k.series.map(function (x) { return x.ca; }), color: 'var(--c1)' }, { name: 'Charges', values: k.series.map(function (x) { return x.ch; }), color: 'var(--c2)' }, { name: 'Trésorerie', values: k.series.map(function (x, i) { return i < m ? x.cash : null; }).filter(function (v) { return v !== null; }), color: 'var(--c4)', line: true }], ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'], { dimFrom: m, label: 'Produits, charges et trésorerie mensuels en XAF' }) + '</div>';
      var ins = App.insights();
      h += '<div class="card side"><div class="card-h"><h2>Points d’attention</h2><span class="chip brand">' + App.ic('sparkle') + 'Révision automatique</span></div><div class="list">' + (ins.length ? ins.map(function (i) { return '<div style="display:block"><div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><span class="chip ' + i.tone + ' dot">' + (i.tone === 'bad' ? 'Urgent' : (i.tone === 'warn' ? 'À vérifier' : 'Info')) + '</span><button type="button" class="btn xs" style="margin-left:auto" data-act="' + i.act + '"' + (i.page ? ' data-page="' + i.page + '"' : '') + (i.tab ? ' data-tab="' + i.tab + '"' : '') + (i.id ? ' data-id="' + i.id + '"' : '') + '>' + esc(i.btn) + '</button></div><b style="display:block;font-size:13px">' + esc(i.title) + '</b><span class="muted" style="font-size:12.5px">' + esc(i.text) + '</span></div>'; }).join('') : '<div class="empty"><b>Rien à signaler</b>Les contrôles automatiques ne relèvent aucune anomalie.</div>') + '</div></div></div>';

      h += '<div class="grid g3">';
      h += '<div class="card"><div class="card-h"><h2>Trésorerie par compte</h2><div class="actions"><button type="button" class="btn xs" data-act="go" data-page="banque" data-tab="rappro">Rapprocher</button></div></div><div class="list">' + k.byAcc.map(function (x) {
        var open = d.bankTx.filter(function (t) { return t.bankId === x.b.id && t.status === 'open'; }).length;
        return '<div><span class="ac" style="width:44px">' + esc(x.b.account) + '</span><span class="grow"><b style="display:block;font-size:13px">' + esc(x.b.label) + '</b><span class="muted" style="font-size:12px">' + (x.b.syncMode === 'api' ? 'Synchronisé' : (x.b.syncMode === 'import' ? 'Relevé importé' : 'Arrêté de caisse')) + (open ? ' · ' + open + ' à rapprocher' : '') + '</span></span><span class="num" style="font-weight:750' + (x.b.alertBelow && x.v < x.b.alertBelow ? ';color:var(--bad)' : '') + '">' + U.fmt(x.v) + '</span></div>';
      }).join('') + '<div><span class="grow" style="font-weight:800">Total disponible</span><span class="num" style="font-weight:800">' + U.fmt(k.treso) + '</span></div></div></div>';
      var dl = App.deadlines();
      h += '<div class="card"><div class="card-h"><h2>Échéancier fiscal et social</h2><div class="actions"><button type="button" class="btn xs" data-act="go" data-page="fiscalite" data-tab="echeancier">Tout voir</button></div></div><div class="list">' + dl.slice(0, 6).map(function (x) {
        var days = U.daysBetween(today, x.date);
        return '<div><span class="date-tile ' + (days <= 30 && x.status !== 'paid' ? 'hot' : '') + '">' + x.date.slice(8, 10) + '<br>' + U.MONTHS[U.month(x.date) - 1].slice(0, 4).toUpperCase() + '</span><span class="grow"><b style="display:block;font-size:13px">' + esc(x.title) + '</b><span class="muted" style="font-size:12px">' + esc(x.sub) + (x.amount !== null ? ' · ' + U.fmt(x.amount) + ' XAF' : '') + '</span></span>' + App.chip(x.status === 'paid' ? 'Réglé' : (x.status === 'ready' ? 'Prêt' : (days < 0 ? 'En retard' : 'J-' + days)), x.status === 'paid' ? 'ok' : (days < 0 ? 'bad' : (days <= 30 ? 'warn' : ''))) + '</div>';
      }).join('') + '</div></div>';
      h += '<div class="card"><div class="card-h"><h2>Activité récente</h2><div class="actions"><button type="button" class="btn xs" data-act="go" data-page="parametres" data-tab="audit">Piste d’audit</button></div></div><div class="list">' + d.audit.slice(-7).reverse().map(function (a) {
        return '<div><span class="grow"><b style="display:block;font-size:13px">' + esc(a.action) + ' · ' + esc(a.object) + '</b><span class="muted" style="font-size:12px">' + esc(a.user) + ' · ' + esc(new Date(a.ts).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })) + '</span></span><span class="mono faint" style="font-size:11px" title="Empreinte">' + esc(a.hash) + '</span></div>';
      }).join('') + '</div></div></div>';
      h += '</div>';
      return h;
    }
  };
  A['doc-new-go'] = function (el) { App.go('ventes'); A['doc-new'](el); };
})();

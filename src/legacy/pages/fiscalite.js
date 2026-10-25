/* TVA et fiscalité : déclarations mensuelles de TVA (principal + CAC), échéancier fiscal et social, impôt sur les sociétés et minimum de perception, retenues à la source, paie et CNPS, FEC. */
(function () {
  'use strict';
  var Y = window.Yiel, U = Y.util, App = window.App, esc = App.esc, A = App.actions;
  function S() { return App.S; } function cid() { return App.cid(); }
  function lastM(y) { var t = App.today(); return U.year(t) > y ? 12 : (U.year(t) < y ? 0 : U.month(t)); }
  var ST = { computed: ['À liquider', 'warn'], liquidated: ['Liquidée · à payer', 'info'], paid: ['Payée', 'ok'] };

  /* ---------------------------------------------------------------- TVA */
  A['vat-open'] = function (el) {
    var y = App.year(), m = +el.dataset.m, r = Y.vatReturn(S(), cid(), y, m);
    var row = function (l, a, b) { return '<tr><td>' + l + '</td><td class="num">' + U.fmt(a) + '</td>' + (b !== undefined ? '<td class="num">' + U.fmt(b) + '</td>' : '<td></td>') + '</tr>'; };
    var body = '<div class="actions">' + App.chip((ST[r.status] || ST.computed)[0], (ST[r.status] || ST.computed)[1], true) + App.chip('Échéance ' + App.date(r.deadline), U.daysBetween(App.today(), r.deadline) < 0 && r.status !== 'paid' ? 'bad' : '') + '</div>' +
      '<div class="tbl-wrap" style="border:1px solid var(--line);border-radius:12px"><table class="t"><thead><tr><th>Cadre</th><th class="num">Base / montant</th><th class="num">Dont CAC</th></tr></thead><tbody>' +
      '<tr class="grp"><td colspan="3">Chiffre d’affaires</td></tr>' + row('Opérations taxables (TVA 19,25 %)', r.taxable) + row('Exportations (taux zéro)', r.export) + row('Opérations exonérées ou hors champ', r.exempt) +
      '<tr class="grp"><td colspan="3">TVA collectée</td></tr>' + row('TVA brute collectée (4431)', r.collected, r.split.collected.cac) +
      '<tr class="grp"><td colspan="3">TVA déductible</td></tr>' + row('Sur biens et services (4452)', r.dedGoods) + row('Sur immobilisations (4451)', r.dedAssets) + row('Crédit du mois précédent (4449)', r.priorCredit) + row('Total déductible', r.deductible + r.priorCredit, r.split.deductible.cac) +
      '<tr class="tot"><td>' + (r.due ? 'TVA nette à payer (4441)' : 'Crédit de TVA à reporter (4449)') + '</td><td class="num">' + U.fmt(r.due || r.credit) + '</td><td class="num">' + U.fmt(r.split.due.cac) + '</td></tr></tbody></table></div>' +
      '<dl class="kv"><dt>Dont principal (17,5 %)</dt><dd>' + U.fmt(r.split.due.principal) + '</dd><dt>Dont centimes additionnels communaux</dt><dd>' + U.fmt(r.split.due.cac) + '</dd><dt>Écriture de liquidation</dt><dd class="mono">' + esc(r.entryNum || '—') + '</dd><dt>Écriture de paiement</dt><dd class="mono">' + esc(r.paymentNum || '—') + '</dd></dl>';
    var foot = '<button type="button" class="btn" data-act="vat-pdf" data-m="' + m + '">' + App.ic('pdf') + 'Brouillon de déclaration</button>' + (r.status === 'computed' ? '<button type="button" class="btn acc" data-act="vat-liq" data-m="' + m + '"' + App.dis('post') + '>Liquider</button>' : '') + (r.status === 'liquidated' ? '<button type="button" class="btn acc" data-act="vat-pay" data-m="' + m + '"' + App.dis('bank') + '>Enregistrer le télépaiement</button>' : '');
    App.drawer({ title: 'Déclaration de TVA · ' + U.MONTHS[m - 1] + ' ' + y, sub: 'Du ' + App.date(r.from) + ' au ' + App.date(r.to), body: body, foot: foot, wide: true, noFocus: true });
  };
  A['vat-liq'] = function (el) {
    if (!App.guard('post')) return;
    var y = App.year(), m = +el.dataset.m, r = Y.vatReturn(S(), cid(), y, m);
    App.confirm({ title: 'Liquider la TVA de ' + U.MONTHS[m - 1] + ' ' + y, body: 'Écriture OD au ' + App.date(r.to) + ' : solde 4431 contre 4452 / 4451' + (r.priorCredit ? ' / 4449' : '') + ', ' + (r.due ? 'TVA due de <b>' + U.fmt(r.due) + ' XAF</b> en 4441.' : 'crédit de <b>' + U.fmt(r.credit) + ' XAF</b> reporté en 4449.'), ok: 'Liquider' }).then(function (ok) {
      if (!ok) return; App.closeDrawer(true); App.run(function () { return Y.postVatLiquidation(S(), cid(), y, m); }, function (e) { return 'TVA ' + r.key + ' liquidée : ' + e.num + '.'; });
    });
  };
  A['vat-pay'] = function (el) {
    if (!App.guard('bank')) return;
    var y = App.year(), m = +el.dataset.m, r = Y.vatReturn(S(), cid(), y, m);
    App.confirm({ title: 'Télépaiement de la TVA ' + r.key, body: 'Montant : <b>' + U.fmt(App.D().vat[r.key].due) + ' XAF</b> · journal BQ1 (4441 / 5211).', fields: [{ k: 'date', label: 'Date du paiement', type: 'date', val: App.today() > r.deadline ? App.today() : r.deadline, req: true }, { k: 'ref', label: 'Référence de l’avis d’imposition', ph: 'AMR / quittance' }], ok: 'Enregistrer' }).then(function (v) {
      if (!v) return; App.closeDrawer(true); App.run(function () { var e = Y.postVatPayment(S(), cid(), y, m, v.date); if (v.ref) App.D().vat[r.key].quittance = v.ref; return e; }, 'Paiement de la TVA enregistré.');
    });
  };
  A['vat-pdf'] = function (el) {
    var y = App.year(), m = +el.dataset.m, r = Y.vatReturn(S(), cid(), y, m), co = App.co();
    var doc = App.pdfDoc('Déclaration de TVA · brouillon', U.MONTHS[m - 1] + ' ' + y + ' · échéance ' + App.date(r.deadline)); if (!doc) return;
    App.pdfAuto(doc, ['Cadre', 'Montant (XAF)'], [['Contribuable', co.name + ' · NIU ' + co.niu], ['Centre des impôts', co.taxCenter || '—'], ['Opérations taxables', U.fmt(r.taxable)], ['Exportations', U.fmt(r.export)], ['Opérations exonérées', U.fmt(r.exempt)], ['TVA collectée', U.fmt(r.collected)], ['TVA déductible biens et services', U.fmt(r.dedGoods)], ['TVA déductible immobilisations', U.fmt(r.dedAssets)], ['Crédit antérieur', U.fmt(r.priorCredit)], ['TVA nette due', U.fmt(r.due)], ['  dont principal 17,5 %', U.fmt(r.split.due.principal)], ['  dont CAC', U.fmt(r.split.due.cac)], ['Crédit à reporter', U.fmt(r.credit)]], { numCols: [1], boldRow: function (x) { return /nette due|Crédit à reporter/.test(x[0]); } });
    doc.setFontSize(8.5); doc.setTextColor(87, 93, 121); doc.text('Document préparatoire : la déclaration officielle se dépose sur impots.cm.', 40, doc._y);
    App.pdfFinish(doc, 'TVA_' + r.key + '_brouillon.pdf');
  };

  /* ------------------------------------------------------------------ IS */
  A['is-line'] = function (el) {
    if (!App.guard('close')) return;
    var y = App.year(), kind = el.dataset.k;
    App.form({ title: kind === 'reint' ? 'Réintégration extra-comptable' : 'Déduction extra-comptable', sub: 'Tableau de détermination du résultat fiscal ' + y,
      fields: [{ k: 'label', label: 'Nature', req: true, span: true, type: 'select', opts: kind === 'reint' ? ['Amendes et pénalités', 'Cadeaux et libéralités au-delà du plafond', 'Charges somptuaires', 'Provisions non déductibles', 'Intérêts excédentaires des comptes courants d’associés', 'Impôt sur les sociétés comptabilisé', 'Autre réintégration'] : ['Dividendes reçus (régime mère-fille)', 'Plus-values exonérées', 'Reprises de provisions taxées', 'Déficits antérieurs reportables', 'Autre déduction'] },
        { k: 'amount', label: 'Montant (XAF)', type: 'money', req: true }, { k: 'note', label: 'Justification / référence', span: true }],
      submit: 'Ajouter', done: 'Ligne ajoutée au tableau fiscal.', onSubmit: function (v) { Y.closingState(S(), cid(), y)[kind].push({ id: U.uid('fx'), label: v.label, amount: v.amount, note: v.note }); Y.audit(S(), cid(), kind === 'reint' ? 'Réintégration fiscale' : 'Déduction fiscale', 'Exercice ' + y, v.label + ' · ' + U.fmt(v.amount)); } });
  };
  A['is-del'] = function (el) { if (!App.guard('close')) return; var cs = Y.closingState(S(), cid(), App.year()); App.run(function () { cs[el.dataset.k] = cs[el.dataset.k].filter(function (x) { return x.id !== el.dataset.id; }); }, 'Ligne supprimée.'); };
  A['is-post'] = function () {
    if (!App.guard('close')) return;
    var y = App.year(), t = Y.incomeTax(S(), cid(), y);
    App.confirm({ title: 'Comptabiliser l’impôt ' + y, body: 'Écriture au 31/12/' + y + ' : 891 Impôt sur les bénéfices / 441 État, pour <b>' + U.fmt(t.due) + ' XAF</b>' + (t.due === t.min && t.min > t.is ? ' (minimum de perception de ' + String(App.D().settings.minTaxRate).replace('.', ',') + ' % du chiffre d’affaires).' : '.'), ok: 'Comptabiliser' }).then(function (ok) { if (ok) App.run(function () { return Y.postIncomeTax(S(), cid(), y); }, function (e) { return 'IS comptabilisé : ' + e.num + '.'; }); });
  };

  /* ---------------------------------------------------------------- paie */
  function payRates() { var s = App.D().settings; return s.pay || (s.pay = { cap: 750000, pvidS: 4.2, pvidP: 4.2, pf: 7, at: 1.75, cfcS: 1, cfcP: 1.5, fne: 1 }); }
  A['pay-new'] = function () {
    if (!App.guard('post')) return;
    var r = payRates(), y = App.year(), m = Math.max(1, lastM(y));
    App.form({ title: 'Centraliser une paie mensuelle', sub: 'Écriture du journal PAIE : 661, 664 / 431, 447, 422', wide: true,
      intro: 'Saisissez les totaux du livre de paie (ou importez-les depuis le module RH & Paie myyiel). Le calcul CNPS est une aide : vérifiez les taux et plafonds en vigueur avec votre expert-comptable.',
      fields: [{ k: 'month', label: 'Mois de paie', type: 'select', val: m, opts: U.MONTHS.map(function (x, i) { return [i + 1, x + ' ' + y]; }) }, { k: 'date', label: 'Date comptable', type: 'date', val: U.monthEnd(y, m), req: true },
        { k: 'heads', label: 'Effectif payé', type: 'number', val: 18 }, { k: 'gross', label: 'Salaires bruts (XAF)', type: 'money', req: true },
        { k: 'capped', label: 'Base plafonnée CNPS (XAF)', type: 'money', help: 'Somme des salaires plafonnés à ' + U.fmt(r.cap) + ' par salarié. Vide = brut.' },
        { k: 'irpp', label: 'IRPP + CAC, RAV, TDL retenus (XAF)', type: 'money', req: true }, { k: 'section', label: 'Section analytique', type: 'select', val: 'STR', opts: App.D().sections.filter(function (s) { return s.axis === 'ACT'; }).map(function (s) { return [s.code, s.code + ' · ' + s.label]; }) }],
      live: function (v) {
        var g = v.gross || 0, c = v.capped || g, cs = Math.round(c * r.pvidS / 100 + g * r.cfcS / 100), cp = Math.round(c * (r.pvidP + r.pf + r.at) / 100 + g * (r.cfcP + r.fne) / 100), net = g - cs - (v.irpp || 0);
        return '<div class="mini-entry">661 Salaires bruts            D ' + U.fmt(g) + '\n664 Charges patronales        D ' + U.fmt(cp) + '\n431 CNPS et organismes        C ' + U.fmt(cs + cp) + '\n447 Retenues fiscales         C ' + U.fmt(v.irpp || 0) + '\n422 Salaires nets à payer     C ' + U.fmt(net) + '</div><div class="muted" style="font-size:12px">Part salariale ' + U.fmt(cs) + ' (PVID ' + r.pvidS + ' % plafonné, CFC ' + r.cfcS + ' %) · part patronale ' + U.fmt(cp) + ' (PVID ' + r.pvidP + ' %, PF ' + r.pf + ' %, AT ' + r.at + ' %, CFC ' + r.cfcP + ' %, FNE ' + r.fne + ' %)</div>';
      },
      submit: 'Comptabiliser la paie', onSubmit: function (v) {
        var g = v.gross, c = v.capped || g, cs = Math.round(c * r.pvidS / 100 + g * r.cfcS / 100), cp = Math.round(c * (r.pvidP + r.pf + r.at) / 100 + g * (r.cfcP + r.fne) / 100);
        var key = y + '-' + U.pad(v.month, 2);
        if (Y.validated(S(), cid()).some(function (e) { return e.source === 'payroll' && e.ref === 'PAIE-' + key; })) throw new Y.BizError('La paie de ' + U.MONTHS[v.month - 1] + ' est déjà centralisée.');
        return Y.postPayroll(S(), cid(), { date: v.date, ref: 'PAIE-' + key, label: 'Centralisation de la paie · ' + U.MONTHS[v.month - 1] + ' ' + y + (v.heads ? ' · ' + v.heads + ' salariés' : ''), gross: g, employer: cp, cnpsEmployee: cs, irpp: v.irpp, section: v.section });
      }, done: function (e) { return 'Paie centralisée : ' + e.num + '.'; } });
  };
  A['pay-rates'] = function () {
    if (!App.guard('settings')) return; var r = payRates();
    App.form({ title: 'Taux sociaux (Cameroun)', intro: 'Valeurs par défaut indicatives, à valider : la législation sociale évolue.', fields: [{ k: 'cap', label: 'Plafond mensuel CNPS (XAF)', type: 'money', val: r.cap }, { k: 'pvidS', label: 'Pension vieillesse · salarié (%)', type: 'number', val: r.pvidS }, { k: 'pvidP', label: 'Pension vieillesse · employeur (%)', type: 'number', val: r.pvidP }, { k: 'pf', label: 'Prestations familiales (%)', type: 'number', val: r.pf }, { k: 'at', label: 'Accidents du travail (%)', type: 'number', val: r.at }, { k: 'cfcS', label: 'Crédit foncier · salarié (%)', type: 'number', val: r.cfcS }, { k: 'cfcP', label: 'Crédit foncier · employeur (%)', type: 'number', val: r.cfcP }, { k: 'fne', label: 'Fonds national de l’emploi (%)', type: 'number', val: r.fne }],
      submit: 'Enregistrer', done: 'Taux sociaux enregistrés.', onSubmit: function (v) { Object.keys(v).forEach(function (k) { r[k] = +v[k] || 0; }); Y.audit(S(), cid(), 'Paramétrage', 'Taux sociaux', JSON.stringify(v)); } });
  };

  /* ------------------------------------------------------------------ FEC */
  A['fec-gen'] = function () {
    if (!App.guard('export')) return;
    var y = App.year(), from = App.v('fecFrom', y + '-01-01'), to = App.v('fecTo', y + '-12-31'), sep = App.v('fecSep', 'tab') === 'tab' ? '\t' : '|';
    var rows = Y.fecRows(S(), cid(), from, to);
    var txt = [Y.FEC_COLUMNS.join(sep)].concat(rows.map(function (r) { return r.map(function (v) { return String(v).split(sep).join(' '); }).join(sep); })).join('\r\n');
    var niu = (App.co().niu || 'NIU').replace(/\W/g, '') || 'NIU';
    Y.audit(S(), cid(), 'Export FEC', from + ' → ' + to, rows.length + ' lignes');
    App.save(niu + 'FEC' + to.replace(/-/g, '') + '.txt', new Blob(['﻿' + txt], { type: 'text/plain;charset=utf-8' }));
    App.persist();
  };
  A['fec-from'] = function (el) { App.ui.v.fecFrom = el.value; App.render(); };
  A['fec-to'] = function (el) { App.ui.v.fecTo = el.value; App.render(); };

  function deadlines(y) {
    var d = App.D(), out = [], t = App.today();
    for (var m = 1; m <= 12; m++) {
      var key = y + '-' + U.pad(m, 2), next = U.addMonths(y + '-' + U.pad(m, 2) + '-15', 1), vr = m <= lastM(y) ? Y.vatReturn(S(), cid(), y, m) : null;
      out.push({ date: next, kind: 'TVA', label: 'Déclaration et paiement de la TVA · ' + U.MONTHS[m - 1], amount: vr ? vr.due : null, done: !!(d.vat[key] && d.vat[key].status === 'paid'), go: 'fiscalite' });
      var ca = 0; Y.eachLine(S(), cid(), function (l) { ca += l.credit - l.debit; }, { account: '70', from: key + '-01', to: U.monthEnd(y, m), excludeJournal: 'AN' });
      var paidIS = Y.validated(S(), cid()).some(function (e) { return e.ref === 'ACPT-IS-' + key; });
      out.push({ date: next, kind: 'IS', label: 'Acompte d’IS (' + String(d.settings.minTaxRate).replace('.', ',') + ' % du CA) · ' + U.MONTHS[m - 1], amount: m <= lastM(y) ? Math.round(ca * d.settings.minTaxRate / 100) : null, done: paidIS || next < t, go: 'fiscalite' });
      out.push({ date: next, kind: 'Social', label: 'CNPS et retenues sur salaires (IRPP, CAC, RAV, TDL) · ' + U.MONTHS[m - 1], amount: null, done: next < t, go: 'fiscalite' });
    }
    out.push({ date: y + '-02-28', kind: 'Local', label: 'Contribution des patentes ' + y, amount: null, done: U.year(t) > y || t > y + '-02-28' });
    out.push({ date: (y + 1) + '-03-15', kind: 'DSF', label: 'Dépôt de la DSF ' + y + ' et solde de l’IS', amount: null, done: !!Y.closingState(S(), cid(), y).dsf, go: 'etats' });
    return out.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  }

  App.pages.fiscalite = {
    render: function () {
      var d = App.D(), y = App.year(), tab = App.tab('fiscalite', 'tva'), lm = lastM(y);
      var h = '<div class="page">' + App.head('Comptabilité · Fiscalité', 'TVA <span class="serif">&amp; fiscalité</span>', 'Déclarations calculées depuis les écritures validées (aucune ressaisie), conformes au Code général des impôts du Cameroun : TVA 17,5 % + CAC, acomptes et minimum de perception, IS 27,5 %, FEC.', '');
      h += App.tabs('fiscalite', [['tva', 'Déclarations de TVA'], ['echeancier', 'Échéancier fiscal & social'], ['is', 'Impôt sur les sociétés'], ['retenues', 'Retenues à la source'], ['paie', 'Paie & CNPS'], ['fec', 'FEC']], 'tva');
      if (tab === 'tva') {
        var rows = []; for (var m = 1; m <= lm; m++) rows.push(Y.vatReturn(S(), cid(), y, m));
        var todo = rows.filter(function (r) { return r.status === 'computed'; }).length, toPay = rows.filter(function (r) { return r.status === 'liquidated' && d.vat[r.key] && d.vat[r.key].due; });
        h += '<div class="grid g4"><div class="kpi"><span class="lbl">TVA collectée ' + y + '</span><span class="val">' + U.fmt(U.sum(rows, function (r) { return r.collected; })) + '</span></div><div class="kpi"><span class="lbl">TVA déductible ' + y + '</span><span class="val">' + U.fmt(U.sum(rows, function (r) { return r.deductible; })) + '</span></div><div class="kpi"><span class="lbl">Déclarations à liquider</span><span class="val' + (todo ? ' neg' : '') + '">' + todo + '</span></div><div class="kpi"><span class="lbl">Reste à payer</span><span class="val">' + U.fmt(U.sum(toPay, function (r) { return d.vat[r.key].due; })) + '</span></div></div>';
        h += '<div class="card flush">' + App.table('vat', { exportName: 'declarations_tva_' + y, rows: rows, rowId: function (r) { return r.month; }, rowAct: 'vat-open', noPaging: true, search: false,
          cols: [{ k: 'month', label: 'Période', fmt: function (v) { return '<b>' + U.MONTHS[v - 1] + ' ' + y + '</b>'; }, exp: function (r) { return r.key; } }, { k: 'taxable', label: 'CA taxable', num: true, fmt: App.m0 }, { k: 'collected', label: 'Collectée', num: true, fmt: App.m0 }, { k: 'deductible', label: 'Déductible', num: true, fmt: App.m0 }, { k: 'priorCredit', label: 'Crédit antérieur', num: true, fmt: App.m0 },
            { k: 'due', label: 'Nette due', num: true, fmt: function (v) { return v ? '<b>' + U.fmt(v) + '</b>' : ''; } }, { k: 'credit', label: 'Crédit reporté', num: true, fmt: App.m0 }, { k: 'deadline', label: 'Échéance', fmt: App.date }, { k: 'status', label: 'Statut', fmt: function (v, r) { var s = ST[v] || ST.computed, late = v !== 'paid' && r.deadline < App.today(); return App.chip(late ? s[0] + ' · en retard' : s[0], late ? 'bad' : s[1], true); } }],
          rowActions: function (r) { return r.status === 'computed' ? '<button type="button" class="btn xs pri" data-act="vat-liq" data-m="' + r.month + '"' + App.dis('post') + '>Liquider</button>' : (r.status === 'liquidated' ? '<button type="button" class="btn xs" data-act="vat-pay" data-m="' + r.month + '"' + App.dis('bank') + '>Payer</button>' : ''); },
          foot: function (rs) { return '<tr class="tot"><td>Total</td>' + ['taxable', 'collected', 'deductible', 'priorCredit', 'due', 'credit'].map(function (k) { return '<td class="num">' + U.fmt(U.sum(rs, function (r) { return r[k]; })) + '</td>'; }).join('') + '<td colspan="3"></td></tr>'; } }) + '</div>';
      }
      if (tab === 'echeancier') {
        var dl = deadlines(y), t = App.today(), f = App.v('ecF', 'open');
        var list = dl.filter(function (x) { return f === 'all' || !x.done; });
        h += '<div class="actions">' + App.filters('ecF', [['open', 'À venir et en retard'], ['all', 'Toutes les échéances']], f) + '</div><div class="card flush"><div class="list" style="padding:4px 16px">' + list.map(function (x) {
          var days = U.daysBetween(t, x.date), late = !x.done && days < 0;
          return '<div><span class="date-tile' + (!x.done && days <= 10 ? ' hot' : '') + '">' + x.date.slice(8, 10) + '<br>' + U.MONTHS[U.month(x.date) - 1].slice(0, 4) + '</span><span class="grow"><b style="font-size:13.5px">' + esc(x.label) + '</b><br><span class="muted" style="font-size:12.5px">' + App.chip(x.kind, x.kind === 'TVA' ? 'info' : (x.kind === 'DSF' ? 'warn' : '')) + ' ' + (x.done ? 'Réglé' : (late ? '<b class="neg">En retard de ' + (-days) + ' j</b>' : 'Dans ' + days + ' j')) + '</span></span><span class="num" style="font-weight:800">' + (x.amount !== null && x.amount !== undefined ? U.fmt(x.amount) : '') + '</span>' + App.chip(x.done ? 'Fait' : 'À faire', x.done ? 'ok' : (late ? 'bad' : 'warn'), true) + '</div>';
        }).join('') + '</div></div><div class="callout">' + App.ic('cal') + '<span>Calendrier indicatif (Cameroun, régime du réel) : échéances au 15 du mois suivant pour la TVA, les acomptes d’IS et les retenues sur salaires ; DSF au 15 mars. À adapter selon votre centre des impôts.</span></div>';
      }
      if (tab === 'is') {
        var it = Y.incomeTax(S(), cid(), y), cs = Y.closingState(S(), cid(), y);
        var line = function (k, x) { return '<div><span class="grow"><b style="font-size:13px">' + esc(x.label) + '</b>' + (x.note ? '<br><span class="muted" style="font-size:12px">' + esc(x.note) + '</span>' : '') + '</span><span class="num">' + U.fmt(x.amount) + '</span><button type="button" class="btn xs ghost" data-act="is-del" data-k="' + k + '" data-id="' + x.id + '"' + App.dis('close') + ' aria-label="Supprimer">' + App.ic('trash') + '</button></div>'; };
        h += '<div class="row"><div class="card grow" style="display:flex;flex-direction:column;gap:12px"><h2 style="font-size:16px">Détermination du résultat fiscal ' + y + '</h2><table class="t"><tbody><tr><td>Résultat comptable avant impôt</td><td class="num">' + U.fmt(it.before) + '</td></tr><tr><td>+ Réintégrations</td><td class="num">' + U.fmt(it.reint) + '</td></tr><tr><td>− Déductions</td><td class="num">' + U.fmt(it.deduct) + '</td></tr><tr class="sub"><td>Résultat fiscal</td><td class="num">' + U.fmt(it.fiscal) + '</td></tr><tr><td>IS au taux de ' + String(it.rate).replace('.', ',') + ' %</td><td class="num">' + U.fmt(it.is) + '</td></tr><tr><td>Minimum de perception (' + String(d.settings.minTaxRate).replace('.', ',') + ' % × CA ' + U.fmt(it.ca) + ')</td><td class="num">' + U.fmt(it.min) + '</td></tr><tr class="sub"><td>Impôt dû (le plus élevé)</td><td class="num">' + U.fmt(it.due) + '</td></tr><tr><td>− Acomptes versés (441)</td><td class="num">' + U.fmt(it.acomptes) + '</td></tr><tr class="tot"><td>' + (it.balance >= 0 ? 'Solde à payer au 15 mars' : 'Excédent d’acomptes') + '</td><td class="num">' + U.fmt(Math.abs(it.balance)) + '</td></tr></tbody></table>' +
          '<div class="actions">' + (cs.isNum ? App.chip('Comptabilisé · ' + cs.isNum, 'ok', true) : '<button type="button" class="btn acc" data-act="is-post"' + App.dis('close') + '>Comptabiliser l’IS (891 / 441)</button>') + '<span class="muted" style="font-size:12.5px">Résultat net après impôt estimé : <b>' + U.fmt(it.net) + '</b></span></div></div>';
        h += '<div class="side" style="display:flex;flex-direction:column;gap:14px;flex:1 1 340px;min-width:0"><div class="card flush"><div class="card-h"><h2>Réintégrations</h2><button type="button" class="btn xs" style="margin-left:auto" data-act="is-line" data-k="reint"' + App.dis('close') + '>' + App.ic('plus') + 'Ajouter</button></div><div class="list" style="padding:0 14px 10px">' + (cs.reint.length ? cs.reint.map(function (x) { return line('reint', x); }).join('') : '<div class="muted" style="font-size:13px">Aucune réintégration.</div>') + '</div></div><div class="card flush"><div class="card-h"><h2>Déductions</h2><button type="button" class="btn xs" style="margin-left:auto" data-act="is-line" data-k="deduct"' + App.dis('close') + '>' + App.ic('plus') + 'Ajouter</button></div><div class="list" style="padding:0 14px 10px">' + (cs.deduct.length ? cs.deduct.map(function (x) { return line('deduct', x); }).join('') : '<div class="muted" style="font-size:13px">Aucune déduction.</div>') + '</div></div></div></div>';
        h += '<div class="callout warn">' + App.ic('shield') + '<span>Taux paramétrables dans Paramètres › Fiscalité (IS ' + String(d.settings.isRate).replace('.', ',') + ' % CAC inclus, minimum ' + String(d.settings.minTaxRate).replace('.', ',') + ' %, IRCM ' + String(d.settings.ircmRate).replace('.', ',') + ' %). Les taux réduits (PME, zones économiques, entreprises nouvelles) sont à paramétrer avec votre conseil.</span></div>';
      }
      if (tab === 'retenues') {
        var rl = []; Y.eachLine(S(), cid(), function (l, e) { rl.push({ id: e.id, date: e.date, num: e.num, label: l.label || e.label, debit: l.debit, credit: l.credit, journal: e.journal }); }, { account: '447', from: y + '-01-01', to: y + '-12-31' });
        var bal = U.sum(rl, function (r) { return r.credit - r.debit; });
        h += '<div class="grid g3"><div class="kpi"><span class="lbl">Retenues de l’exercice</span><span class="val">' + U.fmt(U.sum(rl, function (r) { return r.credit; })) + '</span></div><div class="kpi"><span class="lbl">Reversées au Trésor</span><span class="val">' + U.fmt(U.sum(rl, function (r) { return r.debit; })) + '</span></div><div class="kpi"><span class="lbl">Reste à reverser (447)</span><span class="val' + (bal > 0 ? ' neg' : '') + '">' + U.fmt(bal) + '</span></div></div>';
        h += '<div class="card flush">' + App.table('ret', { exportName: 'retenues_source_447', rows: rl, rowAct: 'entry-open', cols: [{ k: 'date', label: 'Date', fmt: App.date }, { k: 'journal', label: 'Jnl' }, { k: 'num', label: 'Pièce', fmt: function (v) { return '<span class="mono">' + esc(v) + '</span>'; } }, { k: 'label', label: 'Libellé' }, { k: 'credit', label: 'Retenu', num: true, fmt: App.m0 }, { k: 'debit', label: 'Reversé', num: true, fmt: App.m0 }] }) + '</div>';
        h += '<div class="callout">' + App.ic('eye') + '<span>Compte 447 : IRPP et taxes sur salaires, précompte sur achats (AIR), retenues sur loyers et honoraires versés. Le reversement se fait au 15 du mois suivant.</span></div>';
      }
      if (tab === 'paie') {
        var pr = Y.validated(S(), cid()).filter(function (e) { return e.source === 'payroll' && U.year(e.date) === y; }).map(function (e) { var g = function (a) { var x = e.lines.find(function (l) { return l.account === a; }); return x ? x.debit + x.credit : 0; }; return { id: e.id, date: e.date, num: e.num, label: e.label, gross: g('661'), employer: g('664'), cnps: g('431'), irpp: g('447'), net: g('422') }; });
        var b431 = -Y.net(S(), cid(), '431', { to: App.today() });
        h += '<div class="actions"><button type="button" class="btn acc" data-act="pay-new"' + App.dis('post') + '>' + App.ic('plus') + 'Centraliser une paie</button><button type="button" class="btn" data-act="pay-rates"' + App.dis('settings') + '>Taux sociaux</button><span class="muted" style="margin-left:auto;font-size:12.5px">CNPS restant dû (431) : <b>' + U.fmt(b431) + ' XAF</b></span></div>';
        h += '<div class="card flush">' + App.table('pay', { exportName: 'centralisations_paie_' + y, rows: pr, rowAct: 'entry-open', cols: [{ k: 'date', label: 'Date', fmt: App.date }, { k: 'num', label: 'Pièce', fmt: function (v) { return '<span class="mono">' + esc(v) + '</span>'; } }, { k: 'label', label: 'Libellé' }, { k: 'gross', label: 'Brut (661)', num: true, fmt: App.m0 }, { k: 'employer', label: 'Patronal (664)', num: true, fmt: App.m0 }, { k: 'cnps', label: 'CNPS (431)', num: true, fmt: App.m0 }, { k: 'irpp', label: 'Retenues (447)', num: true, fmt: App.m0 }, { k: 'net', label: 'Net (422)', num: true, fmt: App.m0 }],
          foot: function (rs) { return '<tr class="tot"><td colspan="3">Cumul ' + y + '</td>' + ['gross', 'employer', 'cnps', 'irpp', 'net'].map(function (k) { return '<td class="num">' + U.fmt(U.sum(rs, function (r) { return r[k]; })) + '</td>'; }).join('') + '</tr>'; } }) + '</div>';
      }
      if (tab === 'fec') {
        var ff = App.v('fecFrom', y + '-01-01'), ft = App.v('fecTo', y + '-12-31'), chk = Y.fecChecks(S(), cid(), ff, ft), fr = Y.fecRows(S(), cid(), ff, ft);
        h += '<div class="card"><div class="form-grid" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr))"><label class="fld"><span>Du</span><input class="in" type="date" id="fec_from" value="' + ff + '" data-change="fec-from"></label><label class="fld"><span>Au</span><input class="in" type="date" id="fec_to" value="' + ft + '" data-change="fec-to"></label><div class="fld"><span>Séparateur</span>' + App.seg('fecSep', [['tab', 'Tabulation'], ['pipe', 'Barre verticale |']], App.v('fecSep', 'tab')) + '</div></div></div>';
        h += '<div class="row"><div class="card flush grow"><div class="card-h"><h2>Contrôles de conformité</h2><span class="sub">' + fr.length + ' lignes · ' + Y.FEC_COLUMNS.length + ' colonnes</span></div><div class="list" style="padding:0 16px 8px">' + chk.map(function (c) { return '<div><span style="width:26px;height:26px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:var(--' + (c.ok ? 'ok' : 'bad') + '-bg);color:var(--' + (c.ok ? 'ok' : 'bad') + ')">' + App.ic(c.ok ? 'check' : 'x') + '</span><span class="grow"><b style="font-size:13.5px">' + esc(c.label) + '</b><br><span class="muted" style="font-size:12.5px">' + esc(c.detail) + '</span></span></div>'; }).join('') + '</div></div>';
        h += '<div class="card side" style="display:flex;flex-direction:column;gap:12px"><h2 style="font-size:15.5px">Fichier des écritures comptables</h2><p class="muted" style="font-size:13px;margin:0">Une ligne par ligne d’écriture validée, triée par date et numéro, 18 colonnes normalisées (JournalCode … Idevise), encodage UTF-8. Remis à l’administration en cas de contrôle.</p><button type="button" class="btn acc" data-act="fec-gen"' + App.dis('export') + '>' + App.ic('download') + 'Générer le FEC (.txt)</button></div></div>';
        h += '<div class="card flush"><div class="card-h"><h2>Aperçu</h2><span class="sub">10 premières lignes</span></div><div class="tbl-wrap"><table class="t" style="font-size:11.5px"><thead><tr>' + Y.FEC_COLUMNS.map(function (c) { return '<th>' + c + '</th>'; }).join('') + '</tr></thead><tbody>' + fr.slice(0, 10).map(function (r) { return '<tr>' + r.map(function (v) { return '<td class="mono" style="white-space:nowrap">' + esc(v) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div></div>';
      }
      return h + '</div>';
    }
  };
})();

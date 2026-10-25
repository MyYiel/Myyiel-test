/* Comptabilité analytique (classe 9 tenue hors comptabilité générale) : résultat par section avant et après répartition, ventilation, sections, clés de répartition, budgets. */
(function () {
  'use strict';
  var Y = window.Yiel, U = Y.util, App = window.App, esc = App.esc, A = App.actions;
  function S() { return App.S; } function cid() { return App.cid(); }
  function period() {
    var y = App.year(), p = App.v('anPer', 'ytd'), t = App.today();
    var end = U.year(t) === y ? t : y + '-12-31';
    if (p === 'month') { var m = U.year(t) === y ? U.month(t) : 12; return { from: y + '-' + U.pad(m, 2) + '-01', to: U.monthEnd(y, m), label: U.MONTHS[m - 1] + ' ' + y }; }
    if (p === 'q') { var mm = U.year(t) === y ? U.month(t) : 12, q = Math.ceil(mm / 3); return { from: y + '-' + U.pad(q * 3 - 2, 2) + '-01', to: U.monthEnd(y, q * 3), label: 'T' + q + ' ' + y }; }
    return { from: y + '-01-01', to: end, label: 'Cumul ' + y + ' au ' + U.frDate(end) };
  }
  function budgets() { var d = App.D(); return d.budgets || (d.budgets = {}); }

  /* ----------------------------------------------------------- sections */
  function secFields(s) {
    return [{ k: 'code', label: 'Code', req: true, val: s ? s.code : '', mono: true, ro: !!s, ph: 'EXP' }, { k: 'label', label: 'Intitulé', req: true, val: s ? s.label : '' },
      { k: 'axis', label: 'Axe', type: 'select', val: s ? s.axis : 'ACT', opts: [['ACT', 'Activité / centre de profit'], ['SIT', 'Site géographique'], ['PRJ', 'Projet / affaire']] },
      { k: 'type', label: 'Type', type: 'select', val: s ? s.type : 'principale', opts: [['principale', 'Principale (porte un résultat)'], ['auxiliaire', 'Auxiliaire (à répartir)']] },
      { k: 'owner', label: 'Responsable', val: s ? s.owner : '' }, { k: 'active', label: 'Section active', type: 'check', val: s ? s.active : true }];
  }
  A['sec-new'] = function () { if (!App.guard('settings')) return; App.form({ title: 'Nouvelle section analytique', fields: secFields(null), submit: 'Créer', done: 'Section créée.', onSubmit: function (v) { var d = App.D(); v.code = v.code.toUpperCase(); if (!/^[A-Z0-9]{2,8}$/.test(v.code)) throw new Y.BizError('Code : 2 à 8 lettres ou chiffres.'); if (d.sections.some(function (x) { return x.code === v.code; })) throw new Y.BizError('Le code ' + v.code + ' existe déjà.'); d.sections.push(v); Y.audit(S(), cid(), 'Création', 'Section ' + v.code, v.label); } }); };
  A['sec-edit'] = function (el) { var s = App.D().sections.find(function (x) { return x.code === el.dataset.id; }); App.form({ title: 'Section ' + s.code, fields: secFields(s), submit: 'Enregistrer', done: 'Section mise à jour.', onSubmit: function (v) { ['label', 'axis', 'type', 'owner', 'active'].forEach(function (k) { s[k] = v[k]; }); Y.audit(S(), cid(), 'Modification', 'Section ' + s.code, s.label); } }); };

  /* ----------------------------------------------------------------- clés */
  function keyFields(k) {
    var d = App.D(), prin = d.sections.filter(function (s) { return s.axis === 'ACT' && s.type === 'principale'; });
    var f = [{ k: 'label', label: 'Nom de la clé', req: true, val: k ? k.label : '', span: true }, { k: 'from', label: 'Section à répartir', type: 'select', req: true, val: k ? k.from : 'STR', opts: d.sections.filter(function (s) { return s.axis === 'ACT'; }).map(function (s) { return [s.code, s.code + ' · ' + s.label]; }) },
      { k: 'base', label: 'Unité d’œuvre / base', val: k ? k.base : '', ph: 'Effectifs, m², temps passé…' }, { type: 'sep', label: 'Répartition (%)' }];
    prin.forEach(function (s) { var a = k ? k.alloc.find(function (x) { return x.section === s.code; }) : null; f.push({ k: 'p_' + s.code, label: s.code + ' · ' + s.label, type: 'number', val: a ? a.pct : '' }); });
    return f;
  }
  function saveKey(k, v) {
    var alloc = Object.keys(v).filter(function (x) { return /^p_/.test(x) && +v[x] > 0; }).map(function (x) { return { section: x.slice(2), pct: +v[x] }; });
    var tot = U.sum(alloc, function (a) { return a.pct; });
    if (Math.abs(tot - 100) > 0.001) throw new Y.BizError('La répartition doit totaliser 100 % (actuellement ' + String(tot).replace('.', ',') + ' %).');
    if (alloc.some(function (a) { return a.section === v.from; })) throw new Y.BizError('Une section ne peut pas se répartir sur elle-même.');
    Object.assign(k, { label: v.label, from: v.from, base: v.base, alloc: alloc }); return k;
  }
  function keyLive(v) { var t = Object.keys(v).filter(function (x) { return /^p_/.test(x); }).reduce(function (s, x) { return s + (+v[x] || 0); }, 0); return '<div class="balance-bar ' + (Math.abs(t - 100) < 0.001 ? 'ok' : 'bad') + '">' + App.ic(Math.abs(t - 100) < 0.001 ? 'check' : 'x') + 'Total : ' + String(Math.round(t * 100) / 100).replace('.', ',') + ' %</div>'; }
  A['key-new'] = function () { if (!App.guard('settings')) return; App.form({ title: 'Nouvelle clé de répartition', fields: keyFields(null), live: keyLive, submit: 'Créer la clé', done: 'Clé créée.', onSubmit: function (v) { var k = saveKey({ id: U.uid('K') }, v); App.D().keys.push(k); Y.audit(S(), cid(), 'Création', 'Clé ' + k.label, k.alloc.map(function (a) { return a.section + ' ' + a.pct + '%'; }).join(', ')); } }); };
  A['key-edit'] = function (el) { var k = App.D().keys.find(function (x) { return x.id === el.dataset.id; }); App.form({ title: 'Clé · ' + k.label, fields: keyFields(k), live: keyLive, submit: 'Enregistrer', done: 'Clé mise à jour.', extraFoot: '<button type="button" class="btn danger" data-act="key-del" data-id="' + k.id + '">Supprimer</button>', onSubmit: function (v) { saveKey(k, v); Y.audit(S(), cid(), 'Modification', 'Clé ' + k.label, ''); } }); };
  A['key-del'] = function (el) { var d = App.D(); App.closeDrawer(true); App._form = null; App.run(function () { d.keys = d.keys.filter(function (x) { return x.id !== el.dataset.id; }); }, 'Clé supprimée.'); };

  /* --------------------------------------------------------- ventilation */
  A['vent-set'] = function (el) {
    if (!App.guard('post')) return;
    var p = el.dataset.id.split('|'), e = Y.entry(S(), cid(), p[0]), l = e.lines[+p[1]];
    var old = l.section; l.section = el.value;
    Y.audit(S(), cid(), 'Ventilation analytique', e.num + ' · ligne ' + (+p[1] + 1), (old || '—') + ' → ' + (el.value || '—'));
    App.commit();
  };
  A['vent-bulk'] = function () {
    if (!App.guard('post')) return;
    var ids = App.selected('vent'); if (!ids.length) return App.toast('Sélectionnez des lignes.', 'bad');
    App.confirm({ title: 'Ventiler ' + ids.length + ' ligne(s)', body: 'La section choisie est appliquée à toutes les lignes sélectionnées. Chaque changement est tracé dans la piste d’audit.', fields: [{ k: 'sec', label: 'Section', type: 'select', req: true, opts: App.D().sections.filter(function (s) { return s.active; }).map(function (s) { return [s.code, s.code + ' · ' + s.label]; }) }], ok: 'Ventiler' }).then(function (v) {
      if (!v) return;
      ids.forEach(function (id) { var p = id.split('|'), e = Y.entry(S(), cid(), p[0]); if (e) { e.lines[+p[1]].section = v.sec; Y.audit(S(), cid(), 'Ventilation analytique', e.num, '→ ' + v.sec); } });
      App.clearSel('vent'); App.toast(ids.length + ' ligne(s) ventilée(s) sur ' + v.sec + '.', 'ok'); App.commit();
    });
  };
  /* --------------------------------------------------------------- budgets */
  A['bud-set'] = function (el) { if (!App.guard('settings')) return; var b = budgets(), y = App.year(); b[y] = b[y] || {}; b[y][el.dataset.id] = b[y][el.dataset.id] || { prod: 0, charges: 0 }; b[y][el.dataset.id][el.dataset.k] = U.parseAmount(el.value); App.persist(); App.render(); };

  App.pages.analytique = {
    render: function () {
      var d = App.D(), y = App.year(), tab = App.tab('analytique', 'resultat'), p = period();
      var h = '<div class="page">' + App.head('Comptabilité · Analytique', 'Analytique <span class="serif">par activité</span>', 'Chaque ligne de charge ou de produit porte une section ; les frais de structure sont répartis par clés. La classe 9 reste hors comptabilité générale, comme le prévoit le SYSCOHADA révisé.', '');
      h += App.tabs('analytique', [['resultat', 'Résultat par section'], ['ventilation', 'À ventiler'], ['budgets', 'Budget vs réalisé'], ['sections', 'Sections', d.sections.length], ['cles', 'Clés de répartition', d.keys.length]], 'resultat');
      if (tab !== 'sections' && tab !== 'cles') h += '<div class="actions">' + App.seg('anPer', [['month', 'Mois en cours'], ['q', 'Trimestre'], ['ytd', 'Cumul exercice']], App.v('anPer', 'ytd')) + '<span class="muted" style="font-size:12.5px">' + esc(p.label) + '</span></div>';

      if (tab === 'resultat') {
        var keys = App.v('anKeys', true), rows = Y.analytic(S(), cid(), p.from, p.to, keys);
        h += '<div class="actions">' + App.seg('anKeys', [[false, 'Avant répartition'], [true, 'Après répartition des clés']], keys) + '</div>';
        var prin = rows.filter(function (r) { return r.code !== '—'; });
        h += '<div class="grid g' + Math.min(4, Math.max(2, prin.length)) + '">' + prin.map(function (r) { var marg = r.prod ? Math.round(r.result / r.prod * 100) : null; return '<div class="kpi"><span class="lbl">' + esc(r.code + ' · ' + r.label) + '</span><span class="val' + (r.result < 0 ? ' neg' : '') + '">' + U.fmt(r.result) + '</span><span class="delta">' + (marg !== null ? 'Marge ' + marg + ' % · ' : '') + (r.type === 'auxiliaire' ? 'section auxiliaire' : 'CA ' + U.fmt(r.prod)) + '</span></div>'; }).join('') + '</div>';
        h += '<div class="card"><div class="card-h" style="padding:0 0 10px"><h2>Produits, charges et résultat par section</h2></div>' + App.barChart([{ name: 'Produits', color: 'var(--c1)', values: prin.map(function (r) { return r.prod; }) }, { name: 'Charges' + (keys ? ' + quote-part' : ''), color: 'var(--c2)', values: prin.map(function (r) { return r.charges + Math.max(r.alloc, 0); }) }, { name: 'Résultat', color: 'var(--c4)', values: prin.map(function (r) { return r.result; }), line: true }], prin.map(function (r) { return r.code; }), { label: 'Résultat analytique' }) + '</div>';
        h += '<div class="card flush">' + App.table('anRes', { exportName: 'resultat_analytique', pdf: true, title: 'Résultat analytique · ' + p.label, rows: rows, rowId: function (r) { return r.code; },
          cols: [{ k: 'code', label: 'Section', fmt: function (v, r) { return '<b>' + esc(v) + '</b> ' + esc(r.label); } }, { k: 'type', label: 'Type' }, { k: 'prod', label: 'Produits (7)', num: true, fmt: App.m0 }, { k: 'charges', label: 'Charges directes (6)', num: true, fmt: App.m0 }, { k: 'alloc', label: 'Répartition reçue (+) / cédée (−)', num: true, fmt: function (v) { return v ? U.fmt(v) : ''; } }, { k: 'result', label: 'Résultat', num: true, fmt: function (v) { return '<b class="' + (v < 0 ? 'neg' : 'pos') + '">' + U.fmt(v) + '</b>'; } }],
          foot: function (rs) { return '<tr class="tot"><td colspan="2">Total = résultat d’exploitation analysé</td><td class="num">' + U.fmt(U.sum(rs, function (r) { return r.prod; })) + '</td><td class="num">' + U.fmt(U.sum(rs, function (r) { return r.charges; })) + '</td><td class="num">' + U.fmt(U.sum(rs, function (r) { return r.alloc; })) + '</td><td class="num">' + U.fmt(U.sum(rs, function (r) { return r.result; })) + '</td></tr>'; } }) + '</div>';
        h += '<div class="callout info">' + App.ic('shield') + '<span>Contrôle de concordance : la somme des résultats analytiques égale le solde des classes 6 et 7 de la période (hors HAO, classe 8). La répartition déplace des charges entre sections sans modifier le total.</span></div>';
      }
      if (tab === 'ventilation') {
        var lines = []; Y.eachLine(S(), cid(), function (l, e, idx) { if (/^[67]/.test(l.account) && !l.section) lines.push({ id: e.id + '|' + idx, date: e.date, num: e.num, account: l.account, label: l.label || e.label, amount: l.debit - l.credit }); }, { from: p.from, to: p.to, excludeJournal: 'AN' });
        var secOpts = d.sections.filter(function (s) { return s.active; });
        h += '<div class="card flush">' + App.table('vent', { exportName: 'lignes_a_ventiler', rows: lines, select: true, toolbar: '<button type="button" class="btn sm acc" data-act="vent-bulk"' + App.dis('post') + '>Ventiler la sélection</button>', emptyTitle: 'Tout est ventilé', empty: 'Toutes les charges et tous les produits de la période portent une section.',
          cols: [{ k: 'date', label: 'Date', fmt: App.date }, { k: 'num', label: 'Pièce', fmt: function (v) { return '<span class="mono">' + esc(v) + '</span>'; } }, { k: 'account', label: 'Compte', fmt: function (v) { return '<span class="ac">' + esc(v) + '</span> ' + esc(Y.accountLabel(S(), cid(), v)); } }, { k: 'label', label: 'Libellé' }, { k: 'amount', label: 'Montant', num: true, fmt: function (v) { return U.fmt(v); } },
            { k: 'sec', label: 'Section', nosort: true, noexport: true, fmt: function (v, r) { return '<select class="in" style="min-width:150px;height:32px" data-change="vent-set" data-id="' + r.id + '" aria-label="Section"' + App.dis('post') + '><option value="">— choisir —</option>' + secOpts.map(function (s) { return '<option value="' + s.code + '">' + esc(s.code + ' · ' + s.label) + '</option>'; }).join('') + '</select>'; } }] }) + '</div>';
      }
      if (tab === 'budgets') {
        var real = Y.analytic(S(), cid(), y + '-01-01', y + '-12-31', true).filter(function (r) { return r.code !== '—'; }), b = (budgets()[y] || {});
        var frac = U.year(App.today()) === y ? U.month(App.today()) / 12 : 1;
        h += '<div class="card flush"><div class="card-h"><h2>Budget ' + y + ' par section</h2><span class="sub">Saisissez les montants annuels ; le prorata ' + Math.round(frac * 100) + ' % sert de référence à date.</span></div><div class="tbl-wrap"><table class="t"><thead><tr><th>Section</th><th class="num">Budget produits</th><th class="num">Réalisé produits</th><th class="num">Atteinte</th><th class="num">Budget charges</th><th class="num">Réalisé charges</th><th class="num">Consommation</th><th class="num">Résultat budgété</th><th class="num">Résultat réalisé</th></tr></thead><tbody>' +
          real.map(function (r) { var x = b[r.code] || { prod: 0, charges: 0 }, ch = r.charges + Math.max(r.alloc, 0), pa = x.prod ? Math.round(r.prod / x.prod * 100) : null, pc = x.charges ? Math.round(ch / x.charges * 100) : null;
            var inp = function (k, v) { return '<input class="in num" style="height:32px;min-width:120px" value="' + (v ? U.fmt(v) : '') + '" data-change="bud-set" data-id="' + r.code + '" data-k="' + k + '" aria-label="Budget"' + App.dis('settings') + '>'; };
            return '<tr><td><b>' + esc(r.code) + '</b> ' + esc(r.label) + '</td><td class="num">' + inp('prod', x.prod) + '</td><td class="num">' + U.fmt(r.prod) + '</td><td class="num">' + (pa === null ? '' : App.chip(pa + ' %', pa >= frac * 100 ? 'ok' : 'warn')) + '</td><td class="num">' + inp('charges', x.charges) + '</td><td class="num">' + U.fmt(ch) + '</td><td class="num">' + (pc === null ? '' : App.chip(pc + ' %', pc <= frac * 100 + 5 ? 'ok' : 'bad')) + '</td><td class="num">' + U.fmt(x.prod - x.charges) + '</td><td class="num"><b>' + U.fmt(r.result) + '</b></td></tr>'; }).join('') + '</tbody></table></div></div>';
      }
      if (tab === 'sections') {
        h += '<div class="card flush">' + App.table('sections', { exportName: 'sections_analytiques', rows: d.sections, rowId: function (s) { return s.code; }, rowAct: 'sec-edit', toolbar: '<button type="button" class="btn sm acc" data-act="sec-new"' + App.dis('settings') + '>' + App.ic('plus') + 'Section</button>',
          cols: [{ k: 'code', label: 'Code', fmt: function (v) { return '<span class="mono"><b>' + esc(v) + '</b></span>'; } }, { k: 'label', label: 'Intitulé' }, { k: 'axis', label: 'Axe', fmt: function (v) { return { ACT: 'Activité', SIT: 'Site', PRJ: 'Projet' }[v] || v; } }, { k: 'type', label: 'Type' }, { k: 'owner', label: 'Responsable' }, { k: 'active', label: 'État', fmt: function (v) { return App.chip(v ? 'Active' : 'Inactive', v ? 'ok' : '', true); } }] }) + '</div>';
      }
      if (tab === 'cles') {
        h += '<div class="actions"><button type="button" class="btn sm acc" data-act="key-new"' + App.dis('settings') + '>' + App.ic('plus') + 'Clé de répartition</button></div><div class="grid g2">' + d.keys.map(function (k) {
          return '<button type="button" class="card" style="text-align:left;cursor:pointer;display:flex;flex-direction:column;gap:10px" data-act="key-edit" data-id="' + k.id + '"><span style="display:flex;justify-content:space-between;gap:8px"><b>' + esc(k.label) + '</b>' + App.chip('Depuis ' + k.from, 'info') + '</span><span class="muted" style="font-size:12.5px">Base : ' + esc(k.base || '—') + '</span><span style="display:flex;height:12px;border-radius:6px;overflow:hidden">' + k.alloc.map(function (a, i) { return '<span title="' + esc(a.section + ' ' + a.pct + ' %') + '" style="width:' + a.pct + '%;background:' + ['#2B3A8C', '#F25C2A', '#1F9D6B', '#E8B53A', '#7A5AF8'][i % 5] + '"></span>'; }).join('') + '</span><span style="display:flex;gap:12px;flex-wrap:wrap;font-size:12.5px">' + k.alloc.map(function (a) { return '<span><b>' + esc(a.section) + '</b> ' + String(a.pct).replace('.', ',') + ' %</span>'; }).join('') + '</span></button>';
        }).join('') + '</div>';
      }
      return h + '</div>';
    }
  };
})();

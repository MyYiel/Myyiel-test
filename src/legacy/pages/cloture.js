/* Clôture de l'exercice et à-nouveaux : assistant en 6 étapes (contrôles, inventaire, impôt, verrouillage, à-nouveaux, affectation), avec mode simulation. */
(function () {
  'use strict';
  var Y = window.Yiel, U = Y.util, App = window.App, esc = App.esc, A = App.actions;
  function S() { return App.S; } function cid() { return App.cid(); }
  var STEPS = [['checks', 'Contrôles'], ['inventaire', 'Inventaire'], ['impot', 'Impôt'], ['verrou', 'Verrouillage'], ['an', 'À-nouveaux'], ['affectation', 'Affectation']];
  function state(y) {
    var fy = Y.fiscalYear(S(), cid(), y) || {}, cs = Y.closingState(S(), cid(), y), ch = Y.closingChecks(S(), cid(), y);
    return { fy: fy, cs: cs, checks: ch, blockers: ch.filter(function (c) { return c.level === 'block'; }).length,
      done: { checks: !ch.some(function (c) { return c.level === 'block'; }), inventaire: Y.validated(S(), cid()).some(function (e) { return e.source === 'inventory' && U.year(e.date) === y; }), impot: !!cs.isNum, verrou: fy.status === 'closed', an: !!cs.anNum, affectation: !!cs.affNum } };
  }

  A['cl-step'] = function (el) { App.ui.v.clStep = el.dataset.s; App.render(); };
  A['inv-new'] = function (el) {
    if (!App.guard('close')) return;
    var y = App.year(), type = el.dataset.t || 'CCA', T = Y.INVENTORY_TYPES;
    var accs = Y.postableAccounts(S(), cid());
    App.form({ title: 'Écriture d’inventaire au 31/12/' + y, sub: 'Journal OD · passée même si les périodes sont verrouillées (travaux de clôture)',
      fields: [{ k: 'type', label: 'Nature', type: 'select', val: type, opts: Object.keys(T).map(function (k) { return [k, k + ' · ' + T[k].label]; }) },
        { k: 'account', label: 'Compte de contrepartie (charge ou produit)', type: 'select', empty: '— choisir —', opts: accs.filter(function (a) { return /^[67]/.test(a.num); }).map(function (a) { return [a.num, a.num + ' · ' + a.label]; }), help: 'Inutile pour DEPC (6594 / 491) et PROV (691 / 191).' },
        { k: 'amount', label: 'Montant (XAF)', type: 'money', req: true }, { k: 'label', label: 'Libellé', req: true, span: true, ph: 'Ex. Loyer janvier payé d’avance' },
        { k: 'tiersId', label: 'Tiers (créance douteuse)', type: 'select', empty: '—', opts: App.D().tiers.filter(function (t) { return t.type === 'client'; }).map(function (t) { return [t.id, t.code + ' · ' + t.name]; }) },
        { k: 'section', label: 'Section analytique', type: 'select', empty: '—', opts: App.D().sections.filter(function (s) { return s.axis === 'ACT'; }).map(function (s) { return [s.code, s.code + ' · ' + s.label]; }) }],
      live: function (v) { var t = T[v.type]; if (!t) return ''; var deb = t.debit || v.account || '?', cre = t.credit || v.account || '?'; return '<div class="mini-entry">' + deb + ' ' + esc(Y.accountLabel(S(), cid(), deb)) + '   D ' + U.fmt(v.amount || 0) + '\n' + cre + ' ' + esc(Y.accountLabel(S(), cid(), cre)) + '   C ' + U.fmt(v.amount || 0) + '</div><div class="muted" style="font-size:12.5px">' + (t.reverse ? 'Extournée automatiquement au 1er janvier ' + (y + 1) + ' si l’option est retenue à la génération des à-nouveaux.' : 'Non extournée : reprise à constater quand le risque disparaît.') + '</div>'; },
      submit: 'Passer l’écriture', onSubmit: function (v) { return Y.postInventory(S(), cid(), y, { type: v.type, account: v.account, amount: v.amount, label: v.label, tiersId: v.type === 'DEPC' ? v.tiersId : '', section: v.section }); }, done: function (e) { return 'Écriture d’inventaire ' + e.num + ' passée.'; } });
  };
  A['cl-lock'] = function () {
    if (!App.guard('close')) return;
    var y = App.year();
    App.confirm({ title: 'Verrouiller définitivement l’exercice ' + y, body: 'Les 12 périodes seront fermées : plus aucune écriture ne pourra être passée sur ' + y + '. Une réouverture exigera un motif tracé et sera impossible après génération des à-nouveaux.', requireText: 'CLÔTURER ' + y, danger: true, ok: 'Verrouiller l’exercice' }).then(function (ok) { if (ok) App.run(function () { return Y.lockYear(S(), cid(), y); }, 'Exercice ' + y + ' verrouillé.'); });
  };
  A['cl-reopen'] = function () {
    if (!App.guard('reopen')) return;
    var y = App.year();
    App.confirm({ title: 'Rouvrir l’exercice ' + y, body: 'Action exceptionnelle, enregistrée dans la piste d’audit.', fields: [{ k: 'reason', label: 'Motif de la réouverture', type: 'textarea', req: true }], danger: true, ok: 'Rouvrir' }).then(function (v) { if (v) App.run(function () { return Y.reopenYear(S(), cid(), y, v.reason); }, 'Exercice ' + y + ' rouvert.'); });
  };
  A['cl-an'] = function () {
    if (!App.guard('close')) return;
    var y = App.year(), o = { detailTiers: App.v('anDetail', true), reverseAccruals: App.v('anRev', true) };
    App.confirm({ title: 'Générer les à-nouveaux ' + (y + 1), body: 'Une écriture unique dans le journal AN au 01/01/' + (y + 1) + ', équilibrée, reprend les soldes des classes 1 à 5' + (o.detailTiers ? ' détaillés par tiers' : '') + '. Le résultat est porté en 131 / 139 en attente d’affectation.' + (o.reverseAccruals ? ' Les écritures d’inventaire (CCA, PCA, FNP, FAE) sont extournées.' : ''), ok: 'Générer' }).then(function (ok) {
      if (ok) App.run(function () { return Y.generateAN(S(), cid(), y, o); }, function (r) { return 'À-nouveaux ' + r.entry.num + ' générés' + (r.reversals ? ' · ' + r.reversals + ' extourne(s)' : '') + '.'; });
    });
  };
  A['cl-aff'] = function () {
    if (!App.guard('close')) return;
    var y = App.year(), res = -Y.net(S(), cid(), '13', { from: (y + 1) + '-01-01', to: (y + 1) + '-01-01', journal: 'AN' }), st = App.D().settings, co = App.co();
    var legalNow = -Y.net(S(), cid(), '111', { to: (y + 1) + '-01-01' }), cap = Math.round(co.capital * st.legalReserveCap / 100), legal = Math.max(0, Math.min(Math.round(res * st.legalReserveRate / 100), cap - legalNow));
    App.form({ title: 'Affectation du résultat ' + y, sub: 'Décision de l’assemblée générale ordinaire', intro: 'Bénéfice à affecter : <b>' + U.fmt(res) + ' XAF</b>. Réserve légale : ' + st.legalReserveRate + ' % du bénéfice tant qu’elle n’atteint pas ' + st.legalReserveCap + ' % du capital (' + U.fmt(cap) + ' ; déjà constituée : ' + U.fmt(legalNow) + ').',
      fields: [{ k: 'date', label: 'Date de l’AGO', type: 'date', val: App.today() >= (y + 1) + '-01-01' ? App.today() : (y + 1) + '-06-30', req: true, help: 'Date comprise dans l\u2019exercice ' + (y + 1) + ' (journal OD).' }, { k: 'legal', label: 'Réserve légale (111)', type: 'money', val: legal }, { k: 'otherReserves', label: 'Autres réserves (118)', type: 'money', val: 0 }, { k: 'dividends', label: 'Dividendes (465)', type: 'money', val: 0 }, { k: 'ran', label: 'Report à nouveau (121)', type: 'money', val: res - legal }],
      live: function (v) { var t = (v.legal || 0) + (v.otherReserves || 0) + (v.dividends || 0) + (v.ran || 0), ir = Math.round((v.dividends || 0) * st.ircmRate / 100); return '<div class="balance-bar ' + (t === res ? 'ok' : 'bad') + '">' + App.ic(t === res ? 'check' : 'x') + 'Réparti ' + U.fmt(t) + ' / ' + U.fmt(res) + (t === res ? '' : ' · écart ' + U.fmt(res - t)) + '</div>' + (v.dividends ? '<div class="muted" style="font-size:12.5px">IRCM à retenir sur les dividendes (' + String(st.ircmRate).replace('.', ',') + ' %) : ' + U.fmt(ir) + ' XAF, à reverser au Trésor lors de la mise en paiement.</div>' : '') + (v.legal < legal ? '<div class="muted" style="font-size:12.5px;color:var(--warn)">Dotation inférieure au minimum légal (' + U.fmt(legal) + ').</div>' : ''); },
      submit: 'Comptabiliser l’affectation', onSubmit: function (v) { return Y.postAffectation(S(), cid(), y, v); }, done: function (e) { return 'Affectation passée : ' + e.num + '.'; } });
  };
  A['an-pdf'] = function () {
    var y = App.year(), pv = Y.previewAN(S(), cid(), y, { detailTiers: App.v('anDetail', true) });
    var doc = App.pdfDoc('À-nouveaux ' + (y + 1), 'Reprise des soldes au 31/12/' + y); if (!doc) return;
    App.pdfAuto(doc, ['Compte', 'Intitulé', 'Libellé', 'Débit', 'Crédit'], pv.lines.map(function (l) { return [l.account, Y.accountLabel(S(), cid(), l.account), l.label, U.fmt(l.debit, { zero: false }), U.fmt(l.credit, { zero: false })]; }).concat([['', '', 'Totaux', U.fmt(pv.totals.debit), U.fmt(pv.totals.credit)]]), { numCols: [3, 4], boldRow: function (r) { return r[2] === 'Totaux'; } });
    App.pdfFinish(doc, 'a-nouveaux_' + (y + 1) + '.pdf');
  };

  App.pages.cloture = {
    render: function () {
      var y = App.year(), st = state(y), cur = App.v('clStep', null);
      if (!cur) { cur = (STEPS.find(function (s) { return !st.done[s[0]]; }) || STEPS[5])[0]; }
      var nDone = STEPS.filter(function (s) { return st.done[s[0]]; }).length;
      var h = '<div class="page">' + App.head('Comptabilité · Clôture', 'Clôture <span class="serif">&amp; à-nouveaux</span> ' + y, 'Un assistant guidé, dans l’ordre qu’applique un expert-comptable : rien n’est irréversible tant que l’exercice n’est pas verrouillé, et vous pouvez tout répéter en simulation.',
        App.sim ? '' : '<button type="button" class="btn" data-act="sim-start">' + App.ic('layers') + 'Simuler la clôture</button>');
      h += '<div class="card" style="display:flex;flex-direction:column;gap:12px"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><b>Avancement : ' + nDone + ' / 6 étapes</b><span class="muted" style="font-size:12.5px">Exercice ' + y + ' · ' + (st.fy.status === 'closed' ? 'verrouillé' : 'ouvert') + (st.cs.anNum ? ' · à-nouveaux ' + esc(st.cs.anNum) : '') + '</span></div><div style="height:8px;border-radius:6px;background:var(--surface-3);overflow:hidden"><span style="display:block;height:100%;width:' + Math.round(nDone / 6 * 100) + '%;background:linear-gradient(90deg,var(--brand),#FF9A73)"></span></div>' +
        '<div class="steps">' + STEPS.map(function (s, i) { return '<button type="button" class="' + (cur === s[0] ? 'on ' : '') + (st.done[s[0]] ? 'done' : '') + '" data-act="cl-step" data-s="' + s[0] + '"><small>' + (st.done[s[0]] ? '✓ Étape ' + (i + 1) : 'Étape ' + (i + 1)) + '</small><b>' + s[1] + '</b></button>'; }).join('') + '</div></div>';

      if (cur === 'checks') {
        var hl = Y.health(S(), cid(), y);
        h += '<div class="row"><div class="card flush grow"><div class="card-h"><h2>Contrôles préalables</h2><span class="sub">' + st.blockers + ' bloquant(s)</span></div><div class="list" style="padding:0 16px 8px">' + st.checks.map(function (c) { var tone = c.level === 'ok' ? 'ok' : (c.level === 'warn' ? 'warn' : 'bad'); return '<div><span style="width:28px;height:28px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:var(--' + tone + '-bg);color:var(--' + tone + ')">' + App.ic(c.level === 'ok' ? 'check' : (c.level === 'warn' ? 'bell' : 'x')) + '</span><span class="grow"><b style="font-size:13.5px">' + esc(c.label) + '</b><br><span class="muted" style="font-size:12.5px">' + esc(c.detail) + '</span></span>' + (c.level !== 'ok' ? '<button type="button" class="btn xs" data-act="go" data-page="' + c.go + '">Corriger</button>' : '') + '</div>'; }).join('') + '</div></div>' +
          '<div class="card side" style="display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center">' + App.ring(hl.score) + '<b>Score de préparation</b><span class="muted" style="font-size:13px">Les points bloquants empêchent le verrouillage ; les alertes sont à justifier dans le dossier de révision.</span><button type="button" class="btn pri" data-act="cl-step" data-s="inventaire">Étape suivante</button></div></div>';
      }
      if (cur === 'inventaire') {
        var inv = Y.validated(S(), cid()).filter(function (e) { return e.source === 'inventory' && U.year(e.date) === y; });
        if (Y.Stock) { var vp = Y.Stock.variationPreview(S(), cid(), y + '-12-31'), stkDone = inv.some(function (e) { return e.ref === 'STK-VAR-' + y + '-12-31'; }); if (vp.length) h += '<div class="callout ' + (stkDone ? 'ok' : 'warn') + '">' + App.ic('stocks') + '<span><b>Stocks : </b>' + (stkDone ? 'variation de stocks comptabilisée au 31/12/' + y + '.' : 'stock physique ' + U.fmt(U.sum(vp, function (r) { return r.physical; })) + ' XAF ↔ stock comptable ' + U.fmt(U.sum(vp, function (r) { return r.book; })) + ' XAF : variation à comptabiliser après l’inventaire physique.') + '</span><button type="button" class="btn sm" style="margin-left:auto" data-act="go" data-page="stocks" data-tab="valorisation">Stocks & inventaires</button></div>'; }
        h += '<div class="type-cards">' + Object.keys(Y.INVENTORY_TYPES).map(function (k) { var t = Y.INVENTORY_TYPES[k]; return '<button type="button" data-act="inv-new" data-t="' + k + '"' + App.dis('close') + '><b>' + k + ' · ' + esc(t.label) + '</b><small>' + (t.debit || '6/7…') + ' / ' + (t.credit || '6/7…') + (t.reverse ? ' · extournée au 1er janvier' : '') + '</small></button>'; }).join('') + '</div>';
        h += '<div class="card flush">' + App.table('inv', { exportName: 'ecritures_inventaire_' + y, rows: inv, rowAct: 'entry-open', emptyTitle: 'Aucune écriture d’inventaire', empty: 'Charges et produits constatés d’avance, factures non parvenues ou à établir, dépréciations et provisions.',
          cols: [{ k: 'num', label: 'Pièce', fmt: function (v) { return '<span class="mono">' + esc(v) + '</span>'; } }, { k: 'ref', label: 'Type' }, { k: 'label', label: 'Libellé' }, { k: 'amt', label: 'Montant', num: true, val: function (e) { return Y.entryTotals(e).debit; }, fmt: function (v) { return U.fmt(v); } }, { k: 'inventory', label: 'Extourne', fmt: function (v) { return v ? App.chip('Au 01/01/' + (y + 1), 'info') : ''; } }, { k: 'rev', label: 'État', val: function (e) { return e.reversedBy ? 'Contre-passée' : 'Active'; } }] }) + '</div>';
        h += '<div class="callout">' + App.ic('immos') + '<span>Pensez aussi aux dotations aux amortissements (module Immobilisations), à la liquidation de la TVA de décembre et au rapprochement des comptes Mobile Money. <button type="button" class="btn xs" data-act="go" data-page="immos" data-tab="dotations">Dotations</button></span></div>';
      }
      if (cur === 'impot') {
        var it = Y.incomeTax(S(), cid(), y);
        h += '<div class="grid g4"><div class="kpi"><span class="lbl">Résultat avant impôt</span><span class="val">' + U.fmt(it.before) + '</span></div><div class="kpi"><span class="lbl">Résultat fiscal</span><span class="val">' + U.fmt(it.fiscal) + '</span><span class="delta">+ ' + U.fmt(it.reint) + ' / − ' + U.fmt(it.deduct) + '</span></div><div class="kpi"><span class="lbl">Impôt dû</span><span class="val">' + U.fmt(it.due) + '</span><span class="delta">' + (it.due === it.min && it.min > it.is ? 'minimum de perception' : 'IS ' + String(it.rate).replace('.', ',') + ' %') + '</span></div><div class="kpi"><span class="lbl">Résultat net estimé</span><span class="val">' + U.fmt(it.net) + '</span></div></div>';
        h += '<div class="actions">' + (st.cs.isNum ? App.chip('IS comptabilisé · ' + st.cs.isNum, 'ok', true) : '<button type="button" class="btn acc" data-act="is-post"' + App.dis('close') + '>Comptabiliser l’IS</button>') + '<button type="button" class="btn" data-act="go" data-page="fiscalite" data-tab="is">Réintégrations et déductions</button></div>';
      }
      if (cur === 'verrou') {
        h += '<div class="card" style="display:flex;flex-direction:column;gap:12px"><h2 style="font-size:16px">' + (st.fy.status === 'closed' ? 'Exercice ' + y + ' verrouillé' : 'Verrouiller l’exercice ' + y) + '</h2><p class="muted" style="margin:0;font-size:13.5px">' + (st.fy.status === 'closed' ? 'Verrouillé le ' + App.date((st.fy.closedAt || '').slice(0, 10)) + '. Plus aucune écriture n’est acceptée sur ' + y + '.' : (st.blockers ? st.blockers + ' contrôle(s) bloquant(s) à lever avant le verrouillage.' : 'Tous les contrôles bloquants sont levés. Le verrouillage est la dernière étape réversible (avec motif).')) + '</p>' +
          '<div class="actions">' + (st.fy.status === 'closed' ? (st.cs.anNum ? App.chip('Réouverture impossible : à-nouveaux générés', '') : '<button type="button" class="btn" data-act="cl-reopen"' + App.dis('reopen') + '>' + App.ic('unlockI') + 'Rouvrir (motif obligatoire)</button>') : '<button type="button" class="btn acc" data-act="cl-lock"' + (st.blockers ? ' disabled' : App.dis('close')) + '>' + App.ic('lock') + 'Verrouiller l’exercice</button>') + '</div></div>';
      }
      if (cur === 'an') {
        var o = { detailTiers: App.v('anDetail', true) }, pv = Y.previewAN(S(), cid(), y, o);
        h += '<div class="actions">' + App.filters('anDetail', [[true, 'Détail par tiers (lettrage conservé)'], [false, 'Solde global par compte']], o.detailTiers) + App.filters('anRev', [[true, 'Extourner les écritures d’inventaire'], [false, 'Ne pas extourner']], App.v('anRev', true)) + '</div>';
        h += '<div class="balance-bar ' + (pv.totals.diff === 0 ? 'ok' : 'bad') + '">' + App.ic(pv.totals.diff === 0 ? 'check' : 'x') + 'Écriture AN équilibrée : ' + U.fmt(pv.totals.debit) + ' = ' + U.fmt(pv.totals.credit) + ' · ' + pv.lines.length + ' lignes · résultat ' + U.fmt(pv.result) + ' en ' + (pv.result >= 0 ? '131' : '139') + '</div>';
        h += '<div class="card flush">' + App.table('anPrev', { exportName: 'apercu_a_nouveaux_' + (y + 1), rows: pv.lines.map(function (l, i) { l.id = i; return l; }), pageSize: 40, toolbar: '<button type="button" class="btn sm" data-act="an-pdf">' + App.ic('pdf') + 'PDF</button>',
          cols: [{ k: 'account', label: 'Compte', fmt: function (v) { return '<span class="ac">' + esc(v) + '</span>'; } }, { k: 'accl', label: 'Intitulé', val: function (l) { return Y.accountLabel(S(), cid(), l.account); } }, { k: 'label', label: 'Libellé' }, { k: 'debit', label: 'Débit', num: true, fmt: App.m0 }, { k: 'credit', label: 'Crédit', num: true, fmt: App.m0 }] }) + '</div>';
        h += '<div class="actions">' + (st.cs.anNum ? App.chip('Générés · ' + st.cs.anNum, 'ok', true) : '<button type="button" class="btn acc" data-act="cl-an"' + (st.fy.status === 'closed' ? App.dis('close') : ' disabled title="Verrouillez d’abord l’exercice"') + '>' + App.ic('bolt') + 'Générer les à-nouveaux ' + (y + 1) + '</button>') + '</div>';
      }
      if (cur === 'affectation') {
        h += '<div class="card" style="display:flex;flex-direction:column;gap:12px"><h2 style="font-size:16px">Affectation du résultat ' + y + '</h2><p class="muted" style="margin:0;font-size:13.5px">Après l’AGO : solde du 131 vers la réserve légale (111), les autres réserves (118), les dividendes à payer (465, IRCM à retenir) et le report à nouveau (121). Une perte reste en 139 puis est reportée en 129.</p><div class="actions">' + (st.cs.affNum ? App.chip('Affectation passée · ' + st.cs.affNum, 'ok', true) : '<button type="button" class="btn acc" data-act="cl-aff"' + (st.cs.anNum ? App.dis('close') : ' disabled title="Générez d’abord les à-nouveaux"') + '>Saisir la décision d’AGO</button>') + '<button type="button" class="btn" data-act="go" data-page="etats" data-tab="dsf">DSF ' + y + '</button></div></div>';
      }
      if (App.sim) h += '<div class="callout info">' + App.ic('layers') + '<span>Vous êtes en simulation : enchaînez librement verrouillage, à-nouveaux et affectation, puis abandonnez ou conservez le résultat depuis le bandeau en haut.</span></div>';
      return h + '</div>';
    }
  };
})();

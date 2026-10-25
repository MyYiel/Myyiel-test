/* Imports et exports : assistant d'import (CSV, Excel) avec correspondance des colonnes et contrôle à blanc, modèles, centre d'export, historique. */
(function () {
  'use strict';
  var Y = window.Yiel, U = Y.util, App = window.App, esc = App.esc, A = App.actions;
  function S() { return App.S; } function cid() { return App.cid(); }
  var ICONS = { accounts: 'plan', tiers: 'user', items: 'ventes', entries: 'saisie', bank: 'banque', assets: 'immos', opening: 'layers' };
  var HINT = { accounts: 'Sous-comptes personnalisés (création ou mise à jour)', tiers: 'Fichier clients, fournisseurs, salariés', items: 'Catalogue de prestations et produits', entries: 'Reprise d’historique ou export d’un autre logiciel (FEC accepté)', bank: 'Relevé CSV/Excel de banque, MTN MoMo ou Orange Money', assets: 'Registre existant, amortissements antérieurs reconstitués', opening: 'Balance de reprise au 1er janvier (journal AN)' };
  function imp() { var v = App.ui.v; if (!v.imp || v.imp.cid !== cid()) v.imp = { cid: cid(), step: 1, type: v.impType || 'tiers', bankId: v.impBank || '' }; if (v.impType) { v.imp.type = v.impType; v.imp.step = v.impStep || 1; v.imp.bankId = v.impBank || v.imp.bankId; delete v.impType; delete v.impStep; delete v.impBank; } return v.imp; }
  function log() { var d = App.D(); return d.importLog || (d.importLog = []); }

  A['imp-type'] = function (el) { App.ui.tabs.imports = 'import'; var s = imp(); s.type = el.dataset.t; s.step = 2; s.rows = null; s.dry = null; s.result = null; App.render(); };
  A['imp-step'] = function (el) { imp().step = +el.dataset.s; App.render(); };
  A['imp-pick'] = function () { var f = document.getElementById('imp_file'); if (f) f.click(); };
  A['imp-file'] = function (el) { if (el.files && el.files[0]) loadFile(el.files[0]); };
  A['imp-sample'] = function () { var s = imp(); var t = Y.importTemplate(s.type); setRows('exemple_' + Y.IMPORTS[s.type].file + '.csv', t); };
  function loadFile(f) {
    if (!App.guard('import')) return;
    if (f.size > 15 * 1024 * 1024) return App.toast('Fichier trop volumineux (15 Mo maximum).', 'bad');
    App.readFile(f).then(function (r) {
      if (r.kind !== 'rows') return App.toast('Format non reconnu : CSV, TXT (FEC) ou Excel attendu.', 'bad');
      var rows = r.rows.filter(function (x) { return x.some(function (c) { return String(c).trim() !== ''; }); });
      if (rows.length < 2) return App.toast('Le fichier ne contient pas de lignes de données.', 'bad');
      setRows(f.name, rows, r.sheet);
    }, function (e) { App.toast(e.message, 'bad'); });
  }
  function setRows(name, rows, sheet) {
    var s = imp();
    var header = rows[0].map(function (h) { return String(h); });
    if (s.type === 'entries' && header.indexOf('JournalCode') > -1) s.fec = true;
    s.file = name; s.sheet = sheet; s.header = header; s.rows = rows.slice(1); s.map = Y.mapColumns(s.type, header);
    if (s.fec) { var fm = { journal: 'JournalCode', date: 'EcritureDate', piece: 'EcritureNum', reference: 'PieceRef', libelle: 'EcritureLib', compte: 'CompteNum', tiers: 'CompAuxNum', libelleligne: 'EcritureLib', debit: 'Debit', credit: 'Credit' }; Object.keys(fm).forEach(function (k) { var i = header.indexOf(fm[k]); if (i > -1) s.map[k] = i; }); }
    s.step = 3; s.dry = null; s.result = null; App.render();
  }
  A['imp-map'] = function (el) { var s = imp(); s.map[el.dataset.k] = +el.value; s.dry = null; App.render(); };
  A['imp-opt'] = function (el) { var s = imp(); s[el.dataset.k] = el.type === 'checkbox' ? el.checked : el.value; s.dry = null; App.render(); };
  function runOpts(s) { return { bankId: s.bankId, asDraft: !!s.asDraft, year: +s.year || App.year(), fromYear: U.year(App.today()) }; }
  A['imp-dry'] = function () {
    var s = imp(), def = Y.IMPORTS[s.type];
    var miss = def.columns.filter(function (c) { return c[2] && !(s.type === 'bank' && c[0] === 'montant') && !(s.map[c[0]] >= 0); });
    if (miss.length) return App.toast('Associez les colonnes obligatoires : ' + miss.map(function (c) { return c[1]; }).join(', ') + '.', 'bad');
    if (def.bank && !s.bankId) return App.toast('Choisissez le compte de trésorerie.', 'bad');
    var t0 = performance.now();
    try { s.dry = Y.dryRunImport(S(), cid(), s.type, s.rows, s.map, runOpts(s)); s.dry.ms = Math.round(performance.now() - t0); } catch (e) { s.dry = { ok: 0, total: s.rows.length, errors: [e.message] }; }
    s.step = 4; App.render();
  };
  A['imp-run'] = function () {
    if (!App.guard('import')) return;
    var s = imp();
    var go = function () {
      var r = Y.runImport(S(), cid(), s.type, s.rows, s.map, runOpts(s));
      s.result = r; s.step = 5;
      log().unshift({ ts: new Date().toISOString(), user: App.user().name, type: s.type, file: s.file, total: r.total, ok: r.ok, errors: r.errors.length, skipped: r.skipped || 0 });
      Y.audit(S(), cid(), 'Import', Y.IMPORTS[s.type].label, s.file + ' · ' + r.ok + ' / ' + r.total + ' importé(s)');
      App._accList = null; App.toast(r.ok + ' élément(s) importé(s)' + (r.errors.length ? ' · ' + r.errors.length + ' rejet(s)' : '') + '.', r.errors.length && !r.ok ? 'bad' : 'ok'); App.commit();
    };
    if (s.dry && s.dry.errors.length) App.confirm({ title: 'Importer malgré les rejets ?', body: s.dry.ok + ' élément(s) valides seront importés ; ' + s.dry.errors.length + ' ligne(s) en erreur seront ignorées. Vous pourrez télécharger le rapport des rejets.', ok: 'Importer les lignes valides' }).then(function (ok) { if (ok) go(); }); else go();
  };
  A['imp-reset'] = function () { var s = imp(); s.step = 1; s.rows = null; s.dry = null; s.result = null; s.file = null; s.fec = false; App.render(); };
  A['imp-errors'] = function () { var s = imp(), r = s.result || s.dry; App.save('rapport_rejets_' + s.type + '_' + App.today() + '.csv', Y.csvStringify([['Rejet']].concat(r.errors.map(function (e) { return [e]; })))); };
  A['tpl-dl'] = function (el) {
    var t = el.dataset.t, def = Y.IMPORTS[t], aoa = Y.importTemplate(t);
    if (el.dataset.f === 'xlsx') App.xlsx(def.file + '.xlsx', [{ name: 'Modèle', rows: aoa }, { name: 'Notice', rows: [['Colonne', 'Obligatoire', 'Exemple']].concat(def.columns.map(function (c) { return [c[1], c[2] ? 'oui' : 'non', c[3]]; })) }]);
    else App.save(def.file + '.csv', '﻿' + Y.csvStringify(aoa, ';'));
  };

  /* ------------------------------------------------------------ centre d'export */
  A['exp-run'] = function (el) {
    if (!App.guard('export')) return;
    var k = el.dataset.k, y = App.year(), d = App.D(), to = U.year(App.today()) === y ? App.today() : y + '-12-31', base = App.co().name.replace(/\W+/g, '-') + '_' + y;
    if (k === 'fec') return A['fec-gen']();
    if (k === 'backup') return A['backup-export']();
    if (k === 'etats') return A['et-xlsx']();
    if (k === 'balance') return App.xlsx('balance_' + base + '.xlsx', [{ name: 'Balance', rows: [['Compte', 'Intitulé', 'AN débit', 'AN crédit', 'Mvt débit', 'Mvt crédit', 'Solde débit', 'Solde crédit']].concat(Y.trialBalance(S(), cid(), y, to).map(function (r) { return [r.account, r.label, r.anD, r.anC, r.mvD, r.mvC, r.fD, r.fC]; })) }]);
    if (k === 'ecritures') { var aoa = [Y.IMPORTS.entries.columns.map(function (c) { return c[1]; })]; Y.validated(S(), cid()).filter(function (e) { return U.year(e.date) === y; }).forEach(function (e) { e.lines.forEach(function (l) { var t = l.tiersId ? Y.tiers(S(), cid(), l.tiersId) : null; aoa.push([e.journal, U.frDate(e.date), e.num, e.ref || '', e.label, l.account, t ? t.code : '', l.label || '', l.debit, l.credit, l.section || '', l.taxCode || '']); }); }); return App.xlsx('ecritures_' + base + '.xlsx', [{ name: 'Écritures', rows: aoa }]); }
    if (k === 'tiers') return App.xlsx('tiers_' + base + '.xlsx', [{ name: 'Tiers', rows: [Y.IMPORTS.tiers.columns.map(function (c) { return c[1]; })].concat(d.tiers.map(function (t) { return [t.type, t.code, t.name, t.niu, t.rccm, t.regime, t.collective, t.email, t.phone, t.momo, t.momoOp, t.address, t.city, t.terms, t.creditLimit]; })) }]);
    if (k === 'plan') return App.xlsx('plan_comptable_' + base + '.xlsx', [{ name: 'Plan', rows: [['Numéro', 'Intitulé', 'Intitulé anglais', 'Classe', 'Sens', 'Nature', 'Lettrable', 'Actif']].concat(d.accounts.map(function (a) { return [a.num, a.label, a.labelEn, a.cls, a.sens, a.nature, a.lettrable ? 'oui' : 'non', a.active ? 'oui' : 'non']; })) }]);
    if (k === 'factures') return App.xlsx('factures_' + base + '.xlsx', [{ name: 'Documents', rows: [['Type', 'Numéro', 'Date', 'Échéance', 'Client', 'NIU', 'HT', 'TVA', 'TTC', 'Payé', 'Statut']].concat(d.docs.filter(function (x) { return x.num; }).map(function (x) { var t = Y.tiers(S(), cid(), x.tiersId) || {}, tt = Y.docTotals(S(), cid(), x); return [x.type, x.num, x.date, x.due || '', t.name || '', t.niu || '', tt.ht, tt.tva, tt.ttc, Y.docPaid(x), Y.docStatus(S(), cid(), x).label]; })) }]);
    if (k === 'immos') return App.xlsx('immobilisations_' + base + '.xlsx', [{ name: 'Registre', rows: [['Code', 'Désignation', 'Compte', 'Mise en service', 'Valeur', 'Durée', 'Mode', 'Cumul', 'VNC', 'État']].concat(d.assets.map(function (a) { var c = Y.assetCumAt(a, to); return [a.code, a.label, a.account, a.serviceDate, a.value, a.years, a.method, c, a.status === 'active' ? a.value - c : 0, a.status]; })) }]);
    if (k === 'audit') return App.save('piste_audit_' + base + '.csv', Y.csvStringify([['Horodatage', 'Utilisateur', 'Rôle', 'Action', 'Objet', 'Détail', 'Empreinte', 'Précédente']].concat(d.audit.map(function (r) { return [r.ts, r.user, r.role, r.action, r.object, r.detail, r.hash, r.prev]; }))));
  };

  App.pages.imports = {
    render: function () {
      var d = App.D(), tab = App.tab('imports', 'import'), s = imp(), def = Y.IMPORTS[s.type];
      var h = '<div class="page">' + App.head('Administration · Données', 'Imports <span class="serif">&amp; exports</span>', 'Reprenez vos données depuis Excel, Sage, un FEC ou un relevé bancaire ; chaque import est contrôlé à blanc sur une copie avant d’écrire quoi que ce soit.', '');
      h += App.tabs('imports', [['import', 'Importer'], ['modeles', 'Modèles de fichiers'], ['exports', 'Centre d’export'], ['historique', 'Historique', log().length]], 'import');
      if (tab === 'import') {
        var steps = [['Type de données', 1], ['Fichier', 2], ['Correspondance', 3], ['Contrôle à blanc', 4], ['Résultat', 5]];
        h += '<div class="steps">' + steps.map(function (x) { var en = x[1] <= s.step && (x[1] < 3 || s.rows); return '<button type="button" class="' + (s.step === x[1] ? 'on ' : '') + (s.step > x[1] ? 'done' : '') + '" data-act="imp-step" data-s="' + x[1] + '"' + (en && s.step !== 5 ? '' : ' disabled') + '><small>' + (s.step > x[1] ? '✓ ' : '') + 'Étape ' + x[1] + '</small><b>' + x[0] + '</b></button>'; }).join('') + '</div>';
        if (s.step === 1) {
          h += '<div class="type-cards">' + Object.keys(Y.IMPORTS).map(function (k) { return '<button type="button" class="' + (s.type === k ? 'on' : '') + '" data-act="imp-type" data-t="' + k + '"' + App.dis('import') + '><span style="display:flex;gap:8px;align-items:center">' + App.ic(ICONS[k]) + '<b>' + esc(Y.IMPORTS[k].label) + '</b></span><small>' + esc(HINT[k]) + '</small></button>'; }).join('') + '</div>';
        }
        if (s.step === 2) {
          h += '<div class="row"><div class="card grow" style="display:flex;flex-direction:column;gap:14px"><div style="display:flex;gap:10px;align-items:center">' + App.ic(ICONS[s.type]) + '<b>' + esc(def.label) + '</b><button type="button" class="btn xs ghost" style="margin-left:auto" data-act="imp-step" data-s="1">Changer</button></div>' +
            (def.bank ? '<label class="fld"><span>Compte de trésorerie<em>*</em></span><select class="in" data-change="imp-opt" data-k="bankId"><option value="">— choisir —</option>' + d.bankAccounts.filter(function (b) { return b.kind !== 'cash'; }).map(function (b) { return '<option value="' + b.id + '"' + (b.id === s.bankId ? ' selected' : '') + '>' + esc(b.account + ' · ' + b.label) + '</option>'; }).join('') + '</select></label>' : '') +
            '<div class="drop" id="imp_drop"><div style="font-size:28px;line-height:1">' + App.ic('upload') + '</div><b style="display:block;margin:8px 0 4px;color:var(--fg)">Déposez votre fichier ici</b>CSV (séparateur ; , ou tabulation), TXT (FEC) ou Excel .xlsx · 15 Mo max<div class="actions" style="justify-content:center;margin-top:12px"><button type="button" class="btn pri" data-act="imp-pick">Parcourir…</button><button type="button" class="btn" data-act="imp-sample">Essayer avec l’exemple</button></div><input type="file" id="imp_file" class="sr" accept=".csv,.txt,.xlsx,.xls,.ods" data-change="imp-file"></div></div>' +
            '<div class="card side"><b>Colonnes attendues</b><div class="list" style="margin-top:6px">' + def.columns.map(function (c) { return '<div style="padding:7px 0"><span class="grow" style="font-size:13px">' + esc(c[1]) + '</span>' + (c[2] ? App.chip('Obligatoire', 'warn') : '<span class="muted" style="font-size:12px">facultatif</span>') + '</div>'; }).join('') + '</div><div class="actions" style="margin-top:10px"><button type="button" class="btn sm" data-act="tpl-dl" data-t="' + s.type + '" data-f="xlsx">' + App.ic('table') + 'Modèle Excel</button><button type="button" class="btn sm" data-act="tpl-dl" data-t="' + s.type + '" data-f="csv">Modèle CSV</button></div></div></div>';
        }
        if (s.step === 3 && s.rows) {
          h += '<div class="card" style="display:flex;flex-direction:column;gap:12px"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">' + App.ic('file') + '<b>' + esc(s.file) + '</b>' + (s.sheet ? App.chip('Onglet ' + s.sheet) : '') + App.chip(s.rows.length + ' ligne(s)', 'info') + (s.fec ? App.chip('Format FEC détecté', 'ok') : '') + '<button type="button" class="btn xs ghost" style="margin-left:auto" data-act="imp-step" data-s="2">Changer de fichier</button></div>' +
            '<div class="form-grid" style="grid-template-columns:repeat(auto-fit,minmax(230px,1fr))">' + def.columns.map(function (c) { var m = s.map[c[0]]; return '<label class="fld"><span>' + esc(c[1]) + (c[2] ? '<em>*</em>' : '') + '</span><select class="in' + (c[2] && !(m >= 0) && !(s.type === 'bank' && c[0] === 'montant') ? ' err' : '') + '" data-change="imp-map" data-k="' + c[0] + '"><option value="-1">— ignorer —</option>' + s.header.map(function (hd, i) { return '<option value="' + i + '"' + (m === i ? ' selected' : '') + '>' + esc(hd || 'Colonne ' + (i + 1)) + '</option>'; }).join('') + '</select></label>'; }).join('') + '</div>' +
            (s.type === 'entries' ? '<label class="check"><input type="checkbox" data-change="imp-opt" data-k="asDraft"' + (s.asDraft ? ' checked' : '') + '> Importer en brouillons (validation manuelle ensuite)</label>' : '') + (s.type === 'opening' ? '<label class="fld" style="max-width:240px"><span>Exercice de reprise</span><input class="in" type="number" data-change="imp-opt" data-k="year" value="' + (s.year || App.year()) + '"></label>' : '') + '</div>';
          h += '<div class="card flush"><div class="card-h"><h2>Aperçu après correspondance</h2><span class="sub">8 premières lignes</span></div><div class="tbl-wrap"><table class="t"><thead><tr>' + def.columns.map(function (c) { return '<th>' + esc(c[1]) + '</th>'; }).join('') + '</tr></thead><tbody>' + s.rows.slice(0, 8).map(function (r) { return '<tr>' + def.columns.map(function (c) { var i = s.map[c[0]]; var v = i >= 0 ? r[i] : ''; return '<td' + (c[2] && (v === '' || v == null) && !(s.type === 'bank' && /montant|debit|credit/.test(c[0])) ? ' style="background:var(--bad-bg)"' : '') + '>' + esc(v) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div></div>';
          h += '<div class="actions" style="justify-content:flex-end"><button type="button" class="btn acc" data-act="imp-dry">' + App.ic('shield') + 'Lancer le contrôle à blanc</button></div>';
        }
        if (s.step === 4 && s.dry) {
          var r = s.dry;
          h += '<div class="grid g4"><div class="kpi"><span class="lbl">' + (def.grouped ? 'Pièces analysées' : 'Lignes analysées') + '</span><span class="val">' + r.total + '</span></div><div class="kpi"><span class="lbl">Valides</span><span class="val" style="color:var(--ok)">' + r.ok + '</span></div><div class="kpi"><span class="lbl">Rejets</span><span class="val' + (r.errors.length ? ' neg' : '') + '">' + r.errors.length + '</span>' + (r.skipped ? '<span class="delta">' + r.skipped + ' doublon(s) ignoré(s)</span>' : '') + '</div><div class="kpi"><span class="lbl">Durée du contrôle</span><span class="val">' + (r.ms || 0) + ' ms</span><span class="delta">sur une copie de vos données</span></div></div>';
          if (r.errors.length) h += '<div class="card flush"><div class="card-h"><h2>Rejets</h2><span class="sub">Corrigez le fichier ou importez seulement les lignes valides</span></div><div class="list" style="padding:0 16px 10px;max-height:320px;overflow:auto">' + r.errors.slice(0, 200).map(function (e) { return '<div style="font-size:13px"><span style="color:var(--bad)">' + App.ic('x') + '</span><span class="grow">' + esc(e) + '</span></div>'; }).join('') + '</div></div>';
          else h += '<div class="balance-bar ok">' + App.ic('check') + 'Aucun rejet : toutes les règles de gestion sont respectées (partie double, comptes existants, tiers obligatoires, périodes ouvertes, doublons).</div>';
          h += '<div class="actions" style="justify-content:flex-end"><button type="button" class="btn" data-act="imp-step" data-s="3">Revoir la correspondance</button>' + (r.errors.length ? '<button type="button" class="btn" data-act="imp-errors">' + App.ic('download') + 'Rapport des rejets</button>' : '') + '<button type="button" class="btn acc" data-act="imp-run"' + (r.ok ? App.dis('import') : ' disabled') + '>' + App.ic('upload') + 'Importer ' + r.ok + ' élément(s)</button></div>';
        }
        if (s.step === 5 && s.result) {
          var x = s.result;
          h += '<div class="hero"><div style="flex:1;min-width:240px;position:relative"><div class="eyebrow" style="color:#C7CAE0">' + esc(def.label) + ' · ' + esc(s.file) + '</div><h1>' + x.ok + ' élément(s) <span class="serif">importé(s)</span></h1><div class="proof"><span>Total <b>' + x.total + '</b></span>' + (x.created ? '<span>Créés <b>' + x.created + '</b></span>' : '') + (x.updated ? '<span>Mis à jour <b>' + x.updated + '</b></span>' : '') + (x.skipped ? '<span>Doublons ignorés <b>' + x.skipped + '</b></span>' : '') + '<span class="' + (x.errors.length ? '' : 'okc') + '">Rejets <b>' + x.errors.length + '</b></span></div></div><div class="actions" style="position:relative">' + (x.errors.length ? '<button type="button" class="btn" data-act="imp-errors">Rapport des rejets</button>' : '') + '<button type="button" class="btn acc" data-act="imp-reset">Nouvel import</button></div></div>';
          var dest = { accounts: ['plan', 'comptes'], tiers: ['plan', 'tiers'], items: ['ventes', 'articles'], entries: ['saisie', s.asDraft ? 'drafts' : 'list'], bank: ['banque', 'rappro'], assets: ['immos', 'registre'], opening: ['livres', 'balance'] }[s.type];
          h += '<div class="actions"><button type="button" class="btn" data-act="go" data-page="' + dest[0] + '" data-tab="' + dest[1] + '">Voir les données importées ' + App.ic('next') + '</button></div>';
        }
      }
      if (tab === 'modeles') {
        h += '<div class="grid g2">' + Object.keys(Y.IMPORTS).map(function (k) { var df = Y.IMPORTS[k]; return '<div class="card" style="display:flex;flex-direction:column;gap:10px"><span style="display:flex;gap:8px;align-items:center">' + App.ic(ICONS[k]) + '<b>' + esc(df.label) + '</b></span><span class="muted" style="font-size:13px">' + esc(HINT[k]) + ' · ' + df.columns.length + ' colonnes dont ' + df.columns.filter(function (c) { return c[2]; }).length + ' obligatoires</span><div class="actions"><button type="button" class="btn sm" data-act="tpl-dl" data-t="' + k + '" data-f="xlsx">' + App.ic('table') + 'Excel</button><button type="button" class="btn sm" data-act="tpl-dl" data-t="' + k + '" data-f="csv">CSV</button><button type="button" class="btn sm ghost" data-act="imp-type" data-t="' + k + '" style="margin-left:auto">Importer</button></div></div>'; }).join('') + '</div>';
        h += '<div class="callout">' + App.ic('eye') + '<span>Dates acceptées : JJ/MM/AAAA, AAAA-MM-JJ, AAAAMMJJ (FEC) ou date Excel. Montants : espaces et virgules acceptés, sans décimales en XAF. Les en-têtes sont reconnus même s’ils diffèrent (synonymes, accents, casse).</span></div>';
      }
      if (tab === 'exports') {
        var EX = [['fec', 'fiscalite', 'FEC (fichier des écritures comptables)', 'Format normalisé 18 colonnes, .txt'], ['etats', 'etats', 'États financiers + balance', 'Excel 5 onglets : bilan actif/passif, CR, TFT, balance'], ['balance', 'livres', 'Balance générale', 'Excel 6 colonnes'], ['ecritures', 'saisie', 'Écritures de l’exercice', 'Excel, réimportable (même format que le modèle)'], ['factures', 'ventes', 'Factures, devis et avoirs', 'Excel avec HT, TVA, TTC, encaissé, statut'], ['tiers', 'user', 'Fichier des tiers', 'Excel, réimportable'], ['plan', 'plan', 'Plan comptable', 'Excel FR/EN'], ['immos', 'immos', 'Registre des immobilisations', 'Excel avec cumul et VNC'], ['audit', 'shield', 'Piste d’audit', 'CSV avec chaîne d’empreintes'], ['backup', 'download', 'Sauvegarde complète', 'JSON, toutes sociétés']];
        h += '<div class="grid g2">' + EX.map(function (x) { return '<div class="card" style="display:flex;gap:14px;align-items:center"><span style="width:40px;height:40px;flex:0 0 40px;border-radius:12px;background:var(--surface-3);display:inline-flex;align-items:center;justify-content:center">' + App.ic(x[1]) + '</span><span style="flex:1;min-width:0"><b style="font-size:14px">' + esc(x[2]) + '</b><br><span class="muted" style="font-size:12.5px">' + esc(x[3]) + '</span></span><button type="button" class="btn sm pri" data-act="exp-run" data-k="' + x[0] + '"' + App.dis('export') + '>' + App.ic('download') + 'Exporter</button></div>'; }).join('') + '</div>';
        h += '<div class="callout info">' + App.ic('table') + '<span>Chaque tableau de l’application dispose aussi de ses boutons Excel, CSV et souvent PDF : l’export reprend les filtres, la recherche et le tri affichés. Exercice exporté : ' + App.year() + '.</span></div>';
      }
      if (tab === 'historique') {
        h += '<div class="card flush">' + App.table('implog', { exportName: 'historique_imports', rows: log().map(function (r, i) { r.id = i; return r; }), emptyTitle: 'Aucun import', empty: 'Les imports réalisés apparaîtront ici avec leur bilan.',
          cols: [{ k: 'ts', label: 'Date', fmt: function (v) { return new Date(v).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }); } }, { k: 'user', label: 'Par' }, { k: 'type', label: 'Type', fmt: function (v) { return esc(Y.IMPORTS[v] ? Y.IMPORTS[v].label : v); } }, { k: 'file', label: 'Fichier' }, { k: 'total', label: 'Total', num: true }, { k: 'ok', label: 'Importés', num: true }, { k: 'skipped', label: 'Doublons', num: true }, { k: 'errors', label: 'Rejets', num: true, fmt: function (v) { return v ? '<b class="neg">' + v + '</b>' : '0'; } }] }) + '</div>';
      }
      return h + '</div>';
    },
    after: function () {
      var z = document.getElementById('imp_drop'); if (!z) return;
      z.addEventListener('dragover', function (e) { e.preventDefault(); z.classList.add('over'); });
      z.addEventListener('dragleave', function () { z.classList.remove('over'); });
      z.addEventListener('drop', function (e) { e.preventDefault(); z.classList.remove('over'); var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) loadFile(f); });
    }
  };
})();

/* États financiers SYSCOHADA révisé en direct : bilan, compte de résultat, tableau des flux de trésorerie, notes annexes, DSF / liasse ; FR/EN, comparatif N-1, exports PDF et Excel. */
(function () {
  'use strict';
  var Y = window.Yiel, U = Y.util, App = window.App, esc = App.esc, A = App.actions;
  function S() { return App.S; } function cid() { return App.cid(); }
  function opts() {
    var y = App.year(), t = App.today(), defM = U.year(t) === y ? U.month(t) : 12;
    var m = +App.v('etM', defM); if (U.year(t) === y && m > U.month(t)) m = U.month(t);
    return { y: y, m: m, to: U.monthEnd(y, m) > t && U.year(t) === y ? t : U.monthEnd(y, m), en: App.v('etLang', 'fr') === 'en', n1: App.v('etN1', true) };
  }
  function L(r, en) { return en ? r.labelEn : r.label; }
  function hasYear(y) { return Y.validated(S(), cid()).some(function (e) { return U.year(e.date) === y && e.journal !== 'AN'; }); }
  function crPrev(o) { return hasYear(o.y - 1) ? Y.compteResultat(S(), cid(), (o.y - 1) + '-01-01', (o.y - 1) + '-12-31') : null; }
  var T = { fr: { ref: 'Réf.', actif: 'ACTIF', passif: 'PASSIF', brut: 'Brut', amort: 'Amort./dépr.', net: 'Net', n1: 'Net N-1', mont: 'Montant', ex: 'Exercice' }, en: { ref: 'Ref.', actif: 'ASSETS', passif: 'EQUITY AND LIABILITIES', brut: 'Gross', amort: 'Depr. & impairment', net: 'Net', n1: 'Net N-1', mont: 'Amount', ex: 'Year' } };

  A['et-m'] = function (el) { App.ui.v.etM = el.value; App.render(); };
  function sheets(o) {
    var b = Y.bilan(S(), cid(), o.y, o.to), cr = Y.compteResultat(S(), cid(), o.y + '-01-01', o.to), p = crPrev(o), tf = Y.tft(S(), cid(), o.y, o.to), tb = Y.trialBalance(S(), cid(), o.y, o.to);
    return [
      { name: o.en ? 'Balance sheet - assets' : 'Bilan actif', rows: [['Réf', 'Libellé', 'Brut', 'Amort./dépréc.', 'Net N', 'Net N-1']].concat(b.actif.map(function (r) { return [r.ref, L(r, o.en), r.brut, r.amort, r.net, r.prev]; })) },
      { name: o.en ? 'Balance sheet - liabilities' : 'Bilan passif', rows: [['Réf', 'Libellé', 'Net N', 'Net N-1']].concat(b.passif.map(function (r) { return [r.ref, L(r, o.en), r.net, r.prev]; })) },
      { name: o.en ? 'Income statement' : 'Compte de résultat', rows: [['Réf', 'Libellé', 'Exercice N', 'Exercice N-1']].concat(cr.map(function (r, i) { return [r.ref, L(r, o.en), r.value, p ? p[i].value : '']; })) },
      { name: o.en ? 'Cash flow statement' : 'Flux de trésorerie', rows: [['Réf', 'Libellé', 'Exercice N']].concat(tf.rows.map(function (r) { return [r.ref, L(r, o.en), r.value]; })) },
      { name: o.en ? 'Trial balance' : 'Balance', rows: [['Compte', 'Intitulé', 'AN débit', 'AN crédit', 'Mvt débit', 'Mvt crédit', 'Solde débit', 'Solde crédit']].concat(tb.map(function (r) { return [r.account, r.label, r.anD, r.anC, r.mvD, r.mvC, r.fD, r.fC]; })) }
    ];
  }
  A['et-xlsx'] = function () { if (!App.guard('export')) return; var o = opts(); App.xlsx('etats_financiers_' + App.co().name.replace(/\W+/g, '-') + '_' + o.to + (o.en ? '_EN' : '') + '.xlsx', sheets(o)); };
  A['et-pdf'] = function (el) {
    var o = opts(), what = el.dataset.w || 'all', t = T[o.en ? 'en' : 'fr'];
    var doc = App.pdfDoc(o.en ? 'Financial statements' : 'États financiers', (o.en ? 'SYSCOHADA revised · as at ' : 'SYSCOHADA révisé · arrêtés au ') + App.date(o.to)); if (!doc) return;
    var b = Y.bilan(S(), cid(), o.y, o.to), bold = function (r) { return /^(TOTAL|MARGE|CHIFFRE|VALEUR|EXCÉDENT|RÉSULTAT|VARIATION|Trésorerie nette|Flux|NET|GROSS|REVENUE|EBITDA|OPERATING|PROFIT|NON-ORDINARY|Net cash)/.test(r[1]); };
    if (what === 'all' || what === 'bilan') {
      doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.text(t.actif, 40, doc._y); doc._y += 8;
      App.pdfAuto(doc, [t.ref, '', t.brut, t.amort, t.net, t.n1], b.actif.map(function (r) { return [r.ref, L(r, o.en), U.fmt(r.brut, { zero: false }), U.fmt(r.amort, { zero: false }), U.fmt(r.net), o.n1 ? U.fmt(r.prev) : '']; }), { numCols: [2, 3, 4, 5], boldRow: bold });
      doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.text(t.passif, 40, doc._y); doc._y += 8;
      App.pdfAuto(doc, [t.ref, '', t.net, t.n1], b.passif.map(function (r) { return [r.ref, L(r, o.en), U.fmt(r.net), o.n1 ? U.fmt(r.prev) : '']; }), { numCols: [2, 3], boldRow: bold });
    }
    if (what === 'all' || what === 'cr') { if (what === 'all') { doc.addPage(); doc._y = 50; } var cr = Y.compteResultat(S(), cid(), o.y + '-01-01', o.to), p = crPrev(o); App.pdfAuto(doc, [t.ref, o.en ? 'INCOME STATEMENT' : 'COMPTE DE RÉSULTAT', 'N', 'N-1'], cr.map(function (r, i) { return [r.ref, L(r, o.en), U.fmt(r.value), o.n1 && p ? U.fmt(p[i].value) : '']; }), { numCols: [2, 3], boldRow: bold }); }
    if (what === 'all' || what === 'tft') { if (what === 'all') { doc.addPage(); doc._y = 50; } var tf = Y.tft(S(), cid(), o.y, o.to); App.pdfAuto(doc, [t.ref, o.en ? 'CASH FLOW STATEMENT' : 'TABLEAU DES FLUX DE TRÉSORERIE', t.mont], tf.rows.map(function (r) { return [r.ref, L(r, o.en), U.fmt(r.value)]; }), { numCols: [2], boldRow: bold }); }
    App.pdfFinish(doc, (what === 'all' ? 'etats_financiers' : what) + '_' + o.to + (o.en ? '_EN' : '') + '.pdf');
  };
  A['dsf-done'] = function () {
    if (!App.guard('close')) return;
    var y = App.year(), cs = Y.closingState(S(), cid(), y);
    App.confirm({ title: 'Marquer la DSF ' + y + ' comme déposée', body: 'Indiquez la référence de l’accusé de réception de la télédéclaration.', fields: [{ k: 'ref', label: 'N° d’accusé de dépôt', req: true }, { k: 'date', label: 'Date de dépôt', type: 'date', val: App.today(), req: true }], ok: 'Enregistrer' }).then(function (v) {
      if (!v) return; cs.dsf = { ref: v.ref, date: v.date, by: App.user().name }; Y.audit(S(), cid(), 'Dépôt DSF', 'Exercice ' + y, v.ref); App.toast('DSF ' + y + ' enregistrée comme déposée.', 'ok'); App.commit();
    });
  };

  function bilanHtml(o) {
    var b = Y.bilan(S(), cid(), o.y, o.to), t = T[o.en ? 'en' : 'fr'];
    var row = function (r, cols) { var cls = r.level === 2 ? 'tot' : (r.level === 1 ? 'sub' : ''); return '<tr class="' + cls + '"><td class="mono" style="width:44px">' + r.ref + '</td><td>' + esc(L(r, o.en)) + '</td>' + cols.map(function (v) { return '<td class="num">' + (v === null ? '' : U.fmt(v)) + '</td>'; }).join('') + '</tr>'; };
    var h = '<div class="balance-bar ' + (b.balanced ? 'ok' : 'bad') + '">' + App.ic(b.balanced ? 'check' : 'x') + (o.en ? 'Total assets ' : 'Total actif ') + U.fmt(b.totalActif) + (b.balanced ? ' = ' : ' ≠ ') + (o.en ? 'total liabilities ' : 'total passif ') + U.fmt(b.totalPassif) + ' · ' + (o.en ? 'net income ' : 'résultat ') + U.fmt(b.result) + '</div>';
    h += '<div class="row"><div class="card flush grow" style="flex-basis:520px"><div class="card-h"><h2>' + t.actif + '</h2></div><div class="tbl-wrap"><table class="t"><thead><tr><th>' + t.ref + '</th><th></th><th class="num">' + t.brut + '</th><th class="num">' + t.amort + '</th><th class="num">' + t.net + '</th>' + (o.n1 ? '<th class="num">' + t.n1 + '</th>' : '') + '</tr></thead><tbody>' + b.actif.map(function (r) { return row(r, [r.brut, r.amort, r.net].concat(o.n1 ? [r.prev] : [])); }).join('') + '</tbody></table></div></div>';
    h += '<div class="card flush grow" style="flex-basis:440px"><div class="card-h"><h2>' + t.passif + '</h2></div><div class="tbl-wrap"><table class="t"><thead><tr><th>' + t.ref + '</th><th></th><th class="num">' + t.net + '</th>' + (o.n1 ? '<th class="num">' + t.n1 + '</th>' : '') + '</tr></thead><tbody>' + b.passif.map(function (r) { return row(r, [r.net].concat(o.n1 ? [r.prev] : [])); }).join('') + '</tbody></table></div></div></div>';
    return h;
  }
  function crHtml(o) {
    var cr = Y.compteResultat(S(), cid(), o.y + '-01-01', o.to), p = o.n1 ? crPrev(o) : null, t = T[o.en ? 'en' : 'fr'];
    var xb = cr.find(function (r) { return r.ref === 'XB'; }).value || 1;
    return '<div class="card flush"><div class="card-h"><h2>' + (o.en ? 'Income statement' : 'Compte de résultat') + '</h2><span class="sub">' + (o.en ? 'From 1 January to ' : 'Du 1er janvier au ') + App.date(o.to) + '</span></div><div class="tbl-wrap"><table class="t"><thead><tr><th>' + t.ref + '</th><th></th><th class="num">' + t.ex + ' N</th><th class="num">% CA</th>' + (o.n1 ? '<th class="num">' + t.ex + ' N-1</th><th class="num">Var.</th>' : '') + '</tr></thead><tbody>' +
      cr.map(function (r, i) { var pv = p ? p[i].value : null, varr = pv ? Math.round((r.value - pv) / Math.abs(pv) * 100) : null; return '<tr class="' + (r.ref === 'XI' ? 'tot' : (r.total ? 'sub' : '')) + '"><td class="mono">' + r.ref + '</td><td>' + esc(L(r, o.en)) + '</td><td class="num">' + U.fmt(r.value) + '</td><td class="num muted">' + (r.value ? Math.round(r.value / xb * 1000) / 10 + ' %' : '') + '</td>' + (o.n1 ? '<td class="num">' + (pv === null ? '—' : U.fmt(pv)) + '</td><td class="num">' + (varr === null ? '' : '<span class="' + (varr < 0 ? 'neg' : 'pos') + '">' + (varr > 0 ? '+' : '') + varr + ' %</span>') + '</td>' : '') + '</tr>'; }).join('') + '</tbody></table></div></div>' +
      (o.n1 && !p ? '<div class="callout">' + App.ic('eye') + '<span>' + (o.en ? 'No N-1 entries in myyiel: comparatives start next year (N-1 balance sheet comes from opening balances).' : 'Pas d’écritures N-1 dans myyiel : le comparatif du compte de résultat démarrera l’an prochain (le bilan N-1 provient des à-nouveaux).') + '</span></div>' : '');
  }
  function tftHtml(o) {
    var tf = Y.tft(S(), cid(), o.y, o.to);
    return '<div class="balance-bar ' + (tf.check ? 'ok' : 'bad') + '">' + App.ic(tf.check ? 'check' : 'x') + (o.en ? 'Check: opening cash + flows = closing cash (ZA + ZG = ZH)' : 'Contrôle : trésorerie d’ouverture + variation = trésorerie de clôture (ZA + ZG = ZH)') + '</div><div class="card flush"><div class="card-h"><h2>' + (o.en ? 'Cash flow statement' : 'Tableau des flux de trésorerie') + '</h2><span class="sub">' + (o.en ? 'Indirect method' : 'Méthode indirecte (à partir de la CAFG)') + '</span></div><div class="tbl-wrap"><table class="t"><tbody>' +
      tf.rows.map(function (r) { return '<tr class="' + (r.level === 2 ? 'tot' : (r.level === 1 ? 'sub' : '')) + '"><td class="mono" style="width:44px">' + r.ref + '</td><td>' + esc(L(r, o.en)) + '</td><td class="num">' + U.fmt(r.value) + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
  }
  function notesHtml(o) {
    var d = App.D(), to = o.to, b = Y.balances(S(), cid(), { to: to, from: o.y + '-01-01' });
    var sum = function (pref) { var t = 0; Object.keys(b).forEach(function (k) { if (k.indexOf(pref) === 0) t += b[k].d - b[k].c; }); return t; };
    var note = function (num, title, body, auto) { return '<div class="card"><div class="card-h" style="padding:0 0 10px"><h2>Note ' + num + ' · ' + esc(title) + '</h2>' + App.chip(auto ? 'Générée automatiquement' : 'À compléter', auto ? 'ok' : 'warn', true) + '</div>' + body + '</div>'; };
    var tbl = function (head, rows) { return '<div class="tbl-wrap"><table class="t"><thead><tr>' + head.map(function (x, i) { return '<th' + (i ? ' class="num"' : '') + '>' + esc(x) + '</th>'; }).join('') + '</tr></thead><tbody>' + rows.map(function (r) { return '<tr' + (r.tot ? ' class="tot"' : '') + '>' + r.c.map(function (x, i) { return '<td' + (i ? ' class="num"' : '') + '>' + (typeof x === 'number' ? U.fmt(x) : esc(x)) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>'; };
    var groups = {}; d.assets.forEach(function (a) { if (a.status !== 'active' || a.serviceDate > to) return; var k = a.account.slice(0, 3), g = groups[k] || (groups[k] = { v: 0, c: 0 }); g.v += a.value; g.c += Y.assetCumAt(a, to); });
    var h = note('3A', 'Immobilisations brutes et amortissements', tbl(['Compte', 'Valeur brute', 'Amortissements', 'VNC'], Object.keys(groups).sort().map(function (k) { return { c: [k + ' · ' + Y.accountLabel(S(), cid(), k), groups[k].v, groups[k].c, groups[k].v - groups[k].c] }; })), true);
    var ag = Y.agedBalance(S(), cid(), '411', to), B = [0, 1, 2, 3, 4].map(function (i) { return U.sum(ag, function (r) { return r.b[i]; }); });
    h += note('7', 'Clients', tbl(['Échéance', 'Montant'], [{ c: ['Non échues', B[0]] }, { c: ['Échues de moins de 3 mois', B[1] + B[2] + B[3]] }, { c: ['Échues de plus de 3 mois', B[4]] }, { tot: 1, c: ['Total créances clients (411)', U.sum(B)] }]), true);
    h += note('16', 'Dettes fiscales et sociales', tbl(['Nature', 'Montant'], [{ c: ['État, TVA due (4441)', -sum('4441')] }, { c: ['État, impôts retenus à la source (447)', -sum('447')] }, { c: ['État, impôt sur les bénéfices (441)', -sum('441')] }, { c: ['Organismes sociaux, CNPS (431)', -sum('431')] }, { c: ['Personnel, rémunérations dues (422)', -sum('422')] }]), true);
    var ca = {}; Y.eachLine(S(), cid(), function (l) { if (/^70/.test(l.account)) { var k = l.section || '—'; ca[k] = (ca[k] || 0) + l.credit - l.debit; } }, { from: o.y + '-01-01', to: to, excludeJournal: 'AN' });
    h += note('21', 'Chiffre d’affaires par activité', tbl(['Section', 'Montant HT'], Object.keys(ca).map(function (k) { var s = d.sections.find(function (x) { return x.code === k; }); return { c: [k + (s ? ' · ' + s.label : ''), ca[k]] }; }).concat([{ tot: 1, c: ['Total (70)', U.sum(Object.keys(ca), function (k) { return ca[k]; })] }])), true);
    h += note('27A', 'Charges de personnel', tbl(['Nature', 'Montant'], [{ c: ['Rémunérations directes (661)', sum('661')] }, { c: ['Indemnités et avantages (663)', sum('663')] }, { c: ['Charges sociales (664)', sum('664')] }, { tot: 1, c: ['Total (66)', sum('66')] }]), true);
    h += note('27B', 'Effectifs, masse salariale et personnel extérieur', '<p class="muted" style="font-size:13px">Effectifs par catégorie (cadres, agents de maîtrise, employés) et par nationalité : à renseigner depuis le module RH & Paie de myyiel.</p>', false);
    h += note('36', 'Table des codes (activité, forme juridique, régime)', '<dl class="kv"><dt>Forme juridique</dt><dd>' + esc(App.co().legalForm) + '</dd><dt>Régime fiscal</dt><dd>' + esc(App.co().taxRegime) + '</dd><dt>Centre des impôts</dt><dd>' + esc(App.co().taxCenter || '—') + '</dd><dt>Système comptable</dt><dd>' + (App.co().system === 'smt' ? 'Système minimal de trésorerie' : 'Système normal') + '</dd></dl>', true);
    return h;
  }
  function dsfHtml(o) {
    var y = o.y, co = App.co(), cs = Y.closingState(S(), cid(), y), fy = Y.fiscalYear(S(), cid(), y) || {}, b = Y.bilan(S(), cid(), y, y + '-12-31'), tf = Y.tft(S(), cid(), y, y + '-12-31');
    var idOk = co.niu && co.rccm && co.address && co.taxCenter;
    var items = [
      ['Fiche d’identification (R1 à R4)', idOk ? 'ok' : 'warn', idOk ? 'NIU, RCCM, adresse et centre des impôts renseignés' : 'Complétez la fiche société dans Paramètres', 'parametres'],
      ['Bilan (actif / passif)', b.balanced ? 'ok' : 'bad', b.balanced ? 'Équilibré : ' + U.fmt(b.totalActif) : 'Déséquilibre à analyser', 'etats'],
      ['Compte de résultat', 'ok', 'Résultat net ' + U.fmt(b.result), 'etats'],
      ['Tableau des flux de trésorerie', tf.check ? 'ok' : 'bad', tf.check ? 'Concordant avec la trésorerie du bilan' : 'Écart de trésorerie', 'etats'],
      ['Notes annexes (1 à 36)', 'warn', '6 notes générées automatiquement · notes qualitatives à compléter', 'etats'],
      ['Tableau de détermination du résultat fiscal', cs.isNum ? 'ok' : 'warn', cs.isNum ? 'IS comptabilisé (' + cs.isNum + ')' : 'Réintégrations / déductions et IS à finaliser dans la clôture', 'cloture'],
      ['Balance générale de clôture', 'ok', 'Balance 6 colonnes exportable', 'livres'],
      ['Exercice clôturé et verrouillé', fy.status === 'closed' ? 'ok' : 'warn', fy.status === 'closed' ? 'Verrouillé le ' + App.date((fy.closedAt || '').slice(0, 10)) : 'Exercice encore ouvert', 'cloture']
    ];
    var ok = items.filter(function (i) { return i[1] === 'ok'; }).length, deadline = (y + 1) + '-03-15', days = U.daysBetween(App.today(), deadline);
    var h = '<div class="hero"><div style="flex:1;min-width:240px;position:relative"><div class="eyebrow" style="color:#C7CAE0">Déclaration statistique et fiscale · exercice ' + y + '</div><h1>DSF ' + y + ' <span class="serif">' + (cs.dsf ? 'déposée' : (days >= 0 ? 'J−' + days : 'en retard')) + '</span></h1><div class="proof"><span>Échéance <b>15 mars ' + (y + 1) + '</b></span><span>Format <b>' + (co.system === 'smt' ? 'SMT' : 'système normal') + '</b></span><span>Télédéclaration <b>impots.cm</b></span><span>' + ok + ' / ' + items.length + ' composantes prêtes</span>' + (cs.dsf ? '<span class="okc">Accusé ' + esc(cs.dsf.ref) + ' du ' + App.date(cs.dsf.date) + '</span>' : '') + '</div></div><div class="actions" style="position:relative"><button type="button" class="btn" data-act="et-xlsx">' + App.ic('table') + 'Liasse Excel</button><button type="button" class="btn" data-act="et-pdf" data-w="all">' + App.ic('pdf') + 'États PDF</button><button type="button" class="btn acc" data-act="dsf-done"' + App.dis('close') + '>' + App.ic('check') + 'Marquer déposée</button></div></div>';
    h += '<div class="card flush"><div class="card-h"><h2>Composantes de la liasse</h2><span class="sub">Système normal : bilan, compte de résultat, TFT, notes annexes, fiche d’identification et tableaux fiscaux</span></div><div class="list" style="padding:0 16px 8px">' + items.map(function (i) { return '<div><span style="width:28px;height:28px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:var(--' + i[1] + '-bg);color:var(--' + i[1] + ')">' + App.ic(i[1] === 'ok' ? 'check' : (i[1] === 'bad' ? 'x' : 'bell')) + '</span><span class="grow"><b style="font-size:13.5px">' + esc(i[0]) + '</b><br><span class="muted" style="font-size:12.5px">' + esc(i[2]) + '</span></span><button type="button" class="btn xs" data-act="go" data-page="' + i[3] + '">Ouvrir</button></div>'; }).join('') + '</div></div>';
    h += '<div class="grid g3"><div class="card"><b>Système normal</b><p class="muted" style="font-size:13px;margin:6px 0 0">Entités dont le chiffre d’affaires dépasse le seuil du SMT : liasse complète (bilan, CR, TFT, 36 notes).</p></div><div class="card"><b>Système minimal de trésorerie (SMT)</b><p class="muted" style="font-size:13px;margin:6px 0 0">Très petites entités : état des recettes et dépenses, situation de trésorerie, bilan simplifié. Activez-le dans Paramètres › Société.</p></div><div class="card"><b>Établissements COBAC / CIMA</b><p class="muted" style="font-size:13px;margin:6px 0 0">Banques, microfinance et assurances relèvent de plans sectoriels : modèles de liasse spécifiques non couverts par ce module.</p></div></div>';
    h += '<div class="callout warn">' + App.ic('shield') + '<span>Les seuils, formats et pièces annexes de la DSF évoluent chaque année (loi de finances). Faites valider la liasse par votre expert-comptable avant le dépôt sur impots.cm.</span></div>';
    return h;
  }

  App.pages.etats = {
    render: function () {
      var o = opts(), tab = App.tab('etats', 'bilan'), co = App.co();
      var h = '<div class="page">' + App.head('Comptabilité · Synthèse', 'États financiers <span class="serif">en direct</span>', 'Calculés à l’instant depuis le grand livre : bilan, compte de résultat et flux de trésorerie au format SYSCOHADA révisé, en français ou en anglais.',
        '<button type="button" class="btn" data-act="et-xlsx">' + App.ic('table') + 'Excel (5 onglets)</button><button type="button" class="btn pri" data-act="et-pdf" data-w="' + (tab === 'cr' ? 'cr' : (tab === 'tft' ? 'tft' : (tab === 'bilan' ? 'bilan' : 'all'))) + '">' + App.ic('pdf') + 'PDF</button>');
      h += App.tabs('etats', [['bilan', 'Bilan'], ['cr', 'Compte de résultat'], ['tft', 'Flux de trésorerie'], ['notes', 'Notes annexes'], ['dsf', 'DSF & liasse fiscale']], 'bilan');
      if (tab !== 'dsf') {
        var maxM = U.year(App.today()) === o.y ? U.month(App.today()) : 12;
        h += '<div class="actions"><label class="fld" style="flex-direction:row;align-items:center;gap:8px"><span>Arrêté à fin</span><select class="in" style="width:auto" data-change="et-m">' + U.MONTHS.slice(0, maxM).map(function (m, i) { return '<option value="' + (i + 1) + '"' + (i + 1 === o.m ? ' selected' : '') + '>' + m + ' ' + o.y + '</option>'; }).join('') + '</select></label>' + App.seg('etLang', [['fr', 'Français'], ['en', 'English']], o.en ? 'en' : 'fr') + App.filters('etN1', [[true, 'Avec comparatif N-1'], [false, 'Sans comparatif']], o.n1) + '<span class="muted" style="font-size:12.5px;margin-left:auto">Situation au ' + App.date(o.to) + ' · ' + esc(co.framework) + ' · XAF</span></div>';
        if (co.system === 'smt') h += '<div class="callout info">' + App.ic('eye') + '<span>Société au système minimal de trésorerie : le dépôt se fait sur les états SMT ; les états complets restent disponibles pour le pilotage.</span></div>';
      }
      if (tab === 'bilan') h += bilanHtml(o);
      if (tab === 'cr') h += crHtml(o);
      if (tab === 'tft') h += tftHtml(o);
      if (tab === 'notes') h += notesHtml(o);
      if (tab === 'dsf') h += dsfHtml(o);
      return h + '</div>';
    }
  };
})();

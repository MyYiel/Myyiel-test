/* Saisie et journaux : éditeur en grille avec contrôles en direct, brouillons, écritures validées, contre-passation, modèles. */
(function () {
  'use strict';
  var Y = window.Yiel, U = Y.util, App = window.App, esc = App.esc, A = App.actions;

  function blankEditor(journal) {
    var j = Y.journal(App.S, App.cid(), journal || 'OD');
    var lines = [{ account: j && j.type === 'bank' ? j.counterpart : '', label: '', tiersId: '', section: '', taxCode: '', debit: 0, credit: 0 }, { account: '', label: '', tiersId: '', section: '', taxCode: '', debit: 0, credit: 0 }];
    return { id: null, journal: j ? j.code : 'OD', date: App.today(), pieceDate: App.today(), ref: '', label: '', lines: lines, attachments: [], tried: false };
  }
  function ed() { if (!App.ui.v.ed || App.ui.v.ed.company !== App.cid()) { App.ui.v.ed = blankEditor(); App.ui.v.ed.company = App.cid(); } return App.ui.v.ed; }
  App.loadEditor = function (e, asNew) {
    var x = { id: asNew ? null : e.id, journal: e.journal === 'AN' ? 'OD' : e.journal, date: asNew ? App.today() : e.date, pieceDate: e.pieceDate || e.date, ref: e.ref || '', label: e.label, lines: e.lines.map(function (l) { return { account: l.account, label: l.label, tiersId: l.tiersId, section: l.section, taxCode: l.taxCode, debit: l.debit, credit: l.credit }; }), attachments: (e.attachments || []).slice(), tried: false, company: App.cid() };
    App.ui.v.ed = x; App.ui.tabs.saisie = 'new';
  };
  function accOptions() {
    if (App._accList && App._accList.cid === App.cid() && App._accList.n === App.D().accounts.length) return App._accList.html;
    var html = '<datalist id="acc_list">' + Y.postableAccounts(App.S, App.cid()).map(function (a) { return '<option value="' + a.num + '">' + esc(a.num + ' · ' + a.label) + '</option>'; }).join('') + '</datalist>';
    App._accList = { cid: App.cid(), n: App.D().accounts.length, html: html };
    return html;
  }
  App.accDatalist = accOptions;
  function tiersOpts(acc, cur) {
    var d = App.D(), a = Y.account(App.S, App.cid(), acc);
    var type = /^40|^481/.test(acc) ? 'fournisseur' : (/^41|^485/.test(acc) ? 'client' : (/^42/.test(acc) ? 'personnel' : null));
    var list = d.tiers.filter(function (t) { return t.active !== false && (!type || t.type === type || t.collective === acc); });
    return '<option value="">' + (a && a.nature === 'tiers' ? 'Tiers obligatoire…' : '—') + '</option>' + list.map(function (t) { return '<option value="' + t.id + '"' + (t.id === cur ? ' selected' : '') + '>' + esc(t.code + ' · ' + t.name) + '</option>'; }).join('');
  }
  function secOpts(cur) { return '<option value="">—</option>' + App.D().sections.filter(function (s) { return s.active; }).map(function (s) { return '<option value="' + s.code + '"' + (s.code === cur ? ' selected' : '') + '>' + esc(s.code + ' · ' + s.label) + '</option>'; }).join(''); }
  function taxOpts(cur) { return '<option value="">—</option>' + App.D().taxCodes.filter(function (t) { return t.active; }).map(function (t) { return '<option value="' + t.code + '"' + (t.code === cur ? ' selected' : '') + '>' + esc(t.code) + '</option>'; }).join(''); }

  function checks(e) {
    var errs = Y.checkEntry(App.S, App.cid(), { journal: e.journal, date: e.date, label: e.label, lines: e.lines.filter(function (l) { return l.account || l.debit || l.credit; }) });
    var t = Y.entryTotals(e);
    return { errs: errs, t: t };
  }
  function editorHtml() {
    var e = ed(), d = App.D(), c = checks(e), ok = !c.errs.length;
    var jl = d.journals.filter(function (j) { return j.active && j.type !== 'opening'; });
    var nextNum = Y.nextNumber(App.S, App.cid(), e.journal, U.year(e.date || App.today()), true);
    var h = accOptions();
    h += '<div class="card"><div class="card-h"><h2>' + (e.id ? 'Brouillon en cours' : 'Nouvelle écriture') + '</h2><span class="sub">Ctrl + Entrée pour valider</span><div class="actions"><button type="button" class="btn sm" data-act="ed-reset">' + App.ic('x') + 'Vider</button><button type="button" class="btn sm" data-act="tpl-from-editor">' + App.ic('copy') + 'Enregistrer comme modèle</button></div></div>';
    h += '<div class="filters" style="margin-bottom:14px" role="group" aria-label="Journal">' + jl.map(function (j) { return '<button type="button" class="' + (e.journal === j.code ? 'on' : '') + '" data-act="ed-journal" data-j="' + j.code + '" title="' + esc(j.label) + '"><span class="mono">' + esc(j.code) + '</span> · ' + esc(j.label) + '</button>'; }).join('') + '</div>';
    h += '<div class="form-grid" style="margin-bottom:14px">' +
      '<label class="fld"><span>N° de pièce (attribué à la validation)</span><input class="in mono" value="' + esc(nextNum) + '" readonly id="ed_num"></label>' +
      '<label class="fld"><span>Date comptable<em>*</em></span><input class="in" type="date" id="ed_date" data-input="ed-head" data-f="date" value="' + esc(e.date) + '"></label>' +
      '<label class="fld"><span>Date de la pièce</span><input class="in" type="date" id="ed_pdate" data-input="ed-head" data-f="pieceDate" value="' + esc(e.pieceDate) + '"></label>' +
      '<label class="fld"><span>Référence externe</span><input class="in" id="ed_ref" data-input="ed-head" data-f="ref" value="' + esc(e.ref) + '" placeholder="N° facture, reçu, transaction…"></label>' +
      '<label class="fld span2"><span>Libellé de l’écriture<em>*</em></span><input class="in" id="ed_label" data-input="ed-head" data-f="label" value="' + esc(e.label) + '" placeholder="Ex. Facture d’électricité · septembre"></label></div>';
    h += '<div class="tbl-wrap" style="border:1px solid var(--line);border-radius:12px"><table class="t grid-entry" style="min-width:1080px"><thead><tr><th style="width:120px">Compte</th><th>Intitulé</th><th style="width:200px">Tiers</th><th>Libellé de ligne</th><th style="width:130px">Section</th><th style="width:96px">TVA</th><th class="num" style="width:140px">Débit</th><th class="num" style="width:140px">Crédit</th><th style="width:40px"></th></tr></thead><tbody>';
    e.lines.forEach(function (l, i) {
      var a = Y.account(App.S, App.cid(), l.account);
      var needT = a && a.nature === 'tiers';
      h += '<tr><td><input class="cell mono' + (l.account && !a ? ' err' : '') + '" list="acc_list" id="ed_a' + i + '" aria-label="Compte ligne ' + (i + 1) + '" data-input="ed-cell" data-change="ed-acc" data-i="' + i + '" data-f="account" value="' + esc(l.account) + '" placeholder="Compte"></td>' +
        '<td id="ed_nm' + i + '" style="font-size:12.5px;color:var(--muted)">' + (a ? esc(a.label) : (l.account ? '<span class="neg">Compte inconnu</span>' : '')) + '</td>' +
        '<td>' + (needT || l.tiersId ? '<select class="cell' + (needT && !l.tiersId ? ' err' : '') + '" id="ed_t' + i + '" aria-label="Tiers" data-change="ed-sel" data-i="' + i + '" data-f="tiersId">' + tiersOpts(l.account, l.tiersId) + '</select>' : '<span class="faint" style="font-size:12px">—</span>') + '</td>' +
        '<td><input class="cell" id="ed_l' + i + '" aria-label="Libellé" data-input="ed-cell" data-i="' + i + '" data-f="label" value="' + esc(l.label) + '" placeholder="' + esc(e.label) + '"></td>' +
        '<td><select class="cell" id="ed_s' + i + '" aria-label="Section" data-change="ed-sel" data-i="' + i + '" data-f="section">' + secOpts(l.section) + '</select></td>' +
        '<td><select class="cell" id="ed_x' + i + '" aria-label="Code TVA" data-change="ed-sel" data-i="' + i + '" data-f="taxCode">' + taxOpts(l.taxCode) + '</select></td>' +
        '<td><input class="cell num" id="ed_d' + i + '" inputmode="numeric" aria-label="Débit" data-input="ed-cell" data-i="' + i + '" data-f="debit" value="' + (l.debit ? U.fmt(l.debit) : '') + '"></td>' +
        '<td><input class="cell num" id="ed_c' + i + '" inputmode="numeric" aria-label="Crédit" data-input="ed-cell" data-i="' + i + '" data-f="credit" value="' + (l.credit ? U.fmt(l.credit) : '') + '"></td>' +
        '<td><button type="button" class="btn xs icon ghost" aria-label="Supprimer la ligne" data-act="ed-del" data-i="' + i + '">' + App.ic('x') + '</button></td></tr>';
    });
    h += '<tr class="sub"><td colspan="6"><div class="actions"><button type="button" class="btn sm" data-act="ed-add">' + App.ic('plus') + 'Ligne</button><button type="button" class="btn sm" data-act="ed-vat">Calculer la TVA</button><button type="button" class="btn sm" data-act="ed-balance">' + App.ic('wand') + 'Équilibrer la dernière ligne</button><button type="button" class="btn sm" data-act="ed-counter">Contrepartie du journal</button></div></td><td class="num" id="ed_td" style="font-weight:800">' + U.fmt(c.t.debit) + '</td><td class="num" id="ed_tc" style="font-weight:800">' + U.fmt(c.t.credit) + '</td><td></td></tr></tbody></table></div>';
    h += '<div id="ed_bal" style="margin-top:12px">' + balanceBar(c) + '</div>';
    h += '<div class="row" style="margin-top:12px;align-items:center"><div class="grow"><label class="btn sm" style="cursor:pointer">' + App.ic('link') + 'Joindre une pièce justificative<input type="file" id="ed_file" data-change="ed-file" accept=".pdf,.jpg,.jpeg,.png,.heic" style="display:none"></label> ' + e.attachments.map(function (f, i) { return '<span class="chip info" style="margin-left:6px">' + App.ic('file') + esc(f.name) + ' · ' + Math.round(f.size / 1024) + ' Ko <button type="button" class="btn xs ghost icon" aria-label="Retirer" data-act="ed-unattach" data-i="' + i + '">' + App.ic('x') + '</button></span>'; }).join('') + '</div>' +
      '<div class="actions"><button type="button" class="btn" data-act="ed-draft"' + App.dis('draft') + '>Enregistrer en brouillon</button><button type="button" class="btn acc" data-act="ed-post" id="ed_post"' + (ok ? '' : ' aria-disabled="true"') + App.dis('post') + '>' + App.ic('check') + 'Valider l’écriture</button></div></div></div>';
    return h;
  }
  function balanceBar(c) {
    var diff = c.t.diff, h;
    if (!c.t.debit && !c.t.credit) h = '<div class="balance-bar neu">' + App.ic('bolt') + 'Saisissez au moins deux lignes. Le contrôle d’équilibre se fait en direct.</div>';
    else if (diff) h = '<div class="balance-bar bad">' + App.ic('x') + 'Écriture déséquilibrée : écart de ' + U.fmt(Math.abs(diff)) + ' XAF (' + (diff > 0 ? 'débit' : 'crédit') + ' en excès). La validation est bloquée.</div>';
    else if (c.errs.length) h = '<div class="balance-bar bad">' + App.ic('x') + 'Équilibrée, mais ' + c.errs.length + ' point(s) bloquent la validation.</div>';
    else h = '<div class="balance-bar ok">' + App.ic('check') + 'Équilibrée : ' + U.fmt(c.t.debit) + ' XAF au débit et au crédit. Prête à être validée.</div>';
    if (c.errs.length && (c.t.debit || c.t.credit)) h += '<ul style="margin:8px 0 0;padding-left:18px;color:var(--bad);font-size:12.5px">' + c.errs.filter(function (m) { return m.indexOf('déséquilibrée') < 0; }).slice(0, 6).map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>';
    return h;
  }
  App.edRefresh = function () {
    var e = ed(), c = checks(e);
    var td = document.getElementById('ed_td'); if (td) td.textContent = U.fmt(c.t.debit);
    var tc = document.getElementById('ed_tc'); if (tc) tc.textContent = U.fmt(c.t.credit);
    var b = document.getElementById('ed_bal'); if (b) b.innerHTML = balanceBar(c);
    var p = document.getElementById('ed_post'); if (p) { if (c.errs.length) p.setAttribute('aria-disabled', 'true'); else p.removeAttribute('aria-disabled'); }
    e.lines.forEach(function (l, i) { var nm = document.getElementById('ed_nm' + i); if (nm) { var a = Y.account(App.S, App.cid(), l.account); nm.innerHTML = a ? esc(a.label) : (l.account ? '<span class="neg">Compte inconnu</span>' : ''); } });
  };

  /* -------------------------------------------------------- détail d'une écriture */
  A['entry-open'] = function (el) {
    var e = Y.entry(App.S, App.cid(), el.dataset.id); if (!e) return;
    var t = Y.entryTotals(e), j = Y.journal(App.S, App.cid(), e.journal);
    var body = '<div class="actions">' + App.chip(e.status === 'validated' ? 'Validée' : 'Brouillon', e.status === 'validated' ? 'ok' : 'warn', true) + (e.reversedBy ? App.chip('Contre-passée par ' + e.reversedBy, 'warn') : '') + (e.reversalOf ? App.chip('Contre-passation de ' + e.reversalOf, 'info') : '') + App.chip('Source : ' + (SRC[e.source] || e.source || 'saisie'), '') + '</div>' +
      '<dl class="kv"><dt>Journal</dt><dd>' + esc(e.journal + ' · ' + (j ? j.label : '')) + '</dd><dt>Date comptable</dt><dd>' + App.date(e.date) + '</dd><dt>Date de pièce</dt><dd>' + App.date(e.pieceDate || e.date) + '</dd><dt>Référence</dt><dd>' + esc(e.ref || '—') + '</dd><dt>Saisie par</dt><dd>' + esc(e.createdBy || '—') + '</dd><dt>Validée par</dt><dd>' + esc((e.validatedBy || '—') + (e.validatedAt ? ' · ' + new Date(e.validatedAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '')) + '</dd></dl>' +
      '<div class="tbl-wrap" style="border:1px solid var(--line);border-radius:12px"><table class="t"><thead><tr><th>Compte</th><th>Libellé</th><th>Tiers</th><th>Section</th><th>Lettre</th><th class="num">Débit</th><th class="num">Crédit</th></tr></thead><tbody>' +
      e.lines.map(function (l) { var tt = l.tiersId ? Y.tiers(App.S, App.cid(), l.tiersId) : null; return '<tr><td><span class="ac">' + esc(l.account) + '</span><br><span class="muted" style="font-size:11.5px">' + esc(Y.accountLabel(App.S, App.cid(), l.account)) + '</span></td><td>' + esc(l.label || e.label) + '</td><td>' + esc(tt ? tt.code : '') + '</td><td>' + esc(l.section || '') + '</td><td class="mono">' + esc(l.letter || '') + '</td><td class="num">' + App.m0(l.debit) + '</td><td class="num">' + App.m0(l.credit) + '</td></tr>'; }).join('') +
      '<tr class="tot"><td colspan="5">Totaux</td><td class="num">' + U.fmt(t.debit) + '</td><td class="num">' + U.fmt(t.credit) + '</td></tr></tbody></table></div>' +
      (e.attachments && e.attachments.length ? '<div>' + e.attachments.map(function (f) { return App.chip(f.name + ' · ' + Math.round(f.size / 1024) + ' Ko', 'info'); }).join(' ') + '</div>' : '<div class="callout">' + App.ic('file') + '<span>Aucune pièce justificative jointe.</span></div>');
    var foot = '<button type="button" class="btn" data-act="entry-pdf" data-id="' + e.id + '">' + App.ic('pdf') + 'PDF de la pièce</button><button type="button" class="btn" data-act="entry-dup" data-id="' + e.id + '"' + App.dis('draft') + '>' + App.ic('copy') + 'Dupliquer</button>' + (e.status === 'validated' ? '<button type="button" class="btn acc" data-act="entry-reverse" data-id="' + e.id + '"' + (e.reversedBy || e.reversalOf ? ' disabled' : App.dis('reverse')) + '>' + App.ic('undo') + 'Contre-passer</button>' : '<button type="button" class="btn acc" data-act="draft-resume" data-id="' + e.id + '">Reprendre</button>');
    App.drawer({ title: (e.num || 'Brouillon') + ' · ' + e.label, sub: U.fmt(t.debit) + ' XAF', body: body, foot: foot, wide: true, noFocus: true });
  };
  var SRC = { manual: 'saisie', invoice: 'facture', 'credit-note': 'avoir', payment: 'encaissement', purchase: 'achat', 'supplier-payment': 'règlement fournisseur', payroll: 'paie', vat: 'TVA', 'vat-payment': 'paiement TVA', depreciation: 'amortissements', bank: 'relevé bancaire', opening: 'à-nouveaux', reversal: 'contre-passation', import: 'import', inventory: 'inventaire', 'income-tax': 'impôt', affectation: 'affectation', transfer: 'virement interne', loan: 'emprunt', social: 'charges sociales', tax: 'impôts', asset: 'immobilisation', disposal: 'cession', dividends: 'dividendes', investment: 'investissement', extourne: 'extourne', 'payroll-payment': 'paie' };
  App.SRC = SRC;
  A['entry-reverse'] = function (el) {
    if (!App.guard('reverse')) return;
    var e = Y.entry(App.S, App.cid(), el.dataset.id);
    App.confirm({ title: 'Contre-passer ' + e.num, body: 'Une écriture inverse sera créée et liée à ' + esc(e.num) + '. Les deux restent visibles dans les journaux : la piste d’audit est conservée.', ok: 'Contre-passer', danger: true,
      fields: [{ k: 'date', label: 'Date de la contre-passation', type: 'date', val: App.today(), req: true }, { k: 'reason', label: 'Motif', req: true, ph: 'Ex. saisie en double, erreur de compte…', span: true }] })
      .then(function (v) { if (!v) return; var r = App.run(function () { return Y.reverseEntry(App.S, App.cid(), e.id, v.date, v.reason); }, function (r) { return e.num + ' contre-passée par ' + r.num + '.'; }); if (r) App.closeDrawer(); });
  };
  A['entry-dup'] = function (el) { var e = Y.entry(App.S, App.cid(), el.dataset.id); App.loadEditor(e, true); App.closeDrawer(true); App.go('saisie', 'new'); App.toast('Copie chargée dans l’éditeur : vérifiez la date puis validez.', 'ok'); };
  A['entry-pdf'] = function (el) {
    var e = Y.entry(App.S, App.cid(), el.dataset.id), t = Y.entryTotals(e);
    var doc = App.pdfDoc('Pièce comptable ' + (e.num || 'brouillon'), e.journal + ' · ' + U.frDate(e.date) + ' · ' + e.label); if (!doc) return;
    App.pdfAuto(doc, ['Compte', 'Intitulé', 'Libellé', 'Tiers', 'Débit', 'Crédit'], e.lines.map(function (l) { var tt = l.tiersId ? Y.tiers(App.S, App.cid(), l.tiersId) : null; return [l.account, Y.accountLabel(App.S, App.cid(), l.account), l.label || e.label, tt ? tt.code : '', l.debit ? U.fmt(l.debit) : '', l.credit ? U.fmt(l.credit) : '']; }).concat([['', '', 'Totaux', '', U.fmt(t.debit), U.fmt(t.credit)]]), { numCols: [4, 5], boldRow: function (r) { return r[2] === 'Totaux'; } });
    doc.setFontSize(8.5); doc.setTextColor(87, 93, 121); doc.text('Validée par ' + (e.validatedBy || '—') + ' le ' + (e.validatedAt ? new Date(e.validatedAt).toLocaleString('fr-FR') : '—') + (e.reversedBy ? ' · contre-passée par ' + e.reversedBy : ''), 40, doc._y);
    App.pdfFinish(doc, 'piece_' + (e.num || 'brouillon') + '.pdf');
  };
  A['draft-resume'] = function (el) { var e = Y.entry(App.S, App.cid(), el.dataset.id); App.loadEditor(e); App.closeDrawer(true); App.go('saisie', 'new'); };
  A['draft-post'] = function (el) { if (!App.guard('post')) return; var e = Y.entry(App.S, App.cid(), el.dataset.id); App.run(function () { return Y.postEntry(App.S, App.cid(), e); }, function (r) { return 'Brouillon validé : ' + r.num + '.'; }); };
  A['draft-del'] = function (el) {
    var e = Y.entry(App.S, App.cid(), el.dataset.id);
    App.confirm({ title: 'Supprimer ce brouillon ?', body: 'Un brouillon n’est pas une écriture comptable : il peut être supprimé sans laisser de trou dans la numérotation.', ok: 'Supprimer', danger: true }).then(function (v) { if (v) App.run(function () { Y.deleteDraft(App.S, App.cid(), e.id); if (App.ui.v.ed && App.ui.v.ed.id === e.id) App.ui.v.ed = null; }, 'Brouillon supprimé.'); });
  };

  /* --------------------------------------------------------------- éditeur */
  A['ed-journal'] = function (el) { var e = ed(); var j = Y.journal(App.S, App.cid(), el.dataset.j); e.journal = j.code; if (j.type === 'bank' && !e.lines.some(function (l) { return l.account === j.counterpart; })) { var empty = e.lines.find(function (l) { return !l.account; }); if (empty) empty.account = j.counterpart; } App.render(); };
  A['ed-head'] = function (el) { ed()[el.dataset.f] = el.value; if (el.dataset.f === 'date') { var n = document.getElementById('ed_num'); try { n.value = Y.nextNumber(App.S, App.cid(), ed().journal, U.year(el.value || App.today()), true); } catch (x) { /* rien */ } } App.edRefresh(); };
  A['ed-cell'] = function (el) {
    var e = ed(), l = e.lines[+el.dataset.i], f = el.dataset.f;
    if (f === 'debit' || f === 'credit') { l[f] = U.parseAmount(el.value); if (l[f] && f === 'debit') { l.credit = 0; var o = document.getElementById('ed_c' + el.dataset.i); if (o) o.value = ''; } if (l[f] && f === 'credit') { l.debit = 0; var o2 = document.getElementById('ed_d' + el.dataset.i); if (o2) o2.value = ''; } }
    else l[f] = el.value.trim();
    App.edRefresh();
  };
  A['ed-acc'] = function (el) { var l = ed().lines[+el.dataset.i]; l.account = el.value.trim(); var a = Y.account(App.S, App.cid(), l.account); if (a && a.taxCode && !l.taxCode) l.taxCode = a.taxCode; if (a && a.nature !== 'tiers' && !/^4/.test(l.account)) l.tiersId = ''; App.render(); };
  A['ed-sel'] = function (el) { ed().lines[+el.dataset.i][el.dataset.f] = el.value; App.edRefresh(); };
  A['ed-add'] = function () { ed().lines.push({ account: '', label: '', tiersId: '', section: '', taxCode: '', debit: 0, credit: 0 }); App.render(); var i = ed().lines.length - 1; var x = document.getElementById('ed_a' + i); if (x) x.focus(); };
  A['ed-del'] = function (el) { var e = ed(); if (e.lines.length <= 1) return; e.lines.splice(+el.dataset.i, 1); App.render(); };
  A['ed-reset'] = function () { var j = ed().journal; App.ui.v.ed = blankEditor(j); App.ui.v.ed.company = App.cid(); App.render(); };
  A['ed-balance'] = function () { var e = ed(); var last = e.lines[e.lines.length - 1], rest = e.lines.slice(0, -1); var dd = U.sum(rest, function (l) { return l.debit; }) - U.sum(rest, function (l) { return l.credit; }); if (dd >= 0) { last.credit = dd; last.debit = 0; } else { last.debit = -dd; last.credit = 0; } App.render(); };
  A['ed-counter'] = function () { var e = ed(), j = Y.journal(App.S, App.cid(), e.journal); if (!j.counterpart) { App.toast('Le journal ' + j.code + ' n’a pas de compte de contrepartie.', 'bad'); return; } var dd = U.sum(e.lines, function (l) { return l.debit - l.credit; }); var line = { account: j.counterpart, label: e.label, tiersId: '', section: '', taxCode: '', debit: dd < 0 ? -dd : 0, credit: dd > 0 ? dd : 0 }; var empty = e.lines.findIndex(function (l) { return !l.account && !l.debit && !l.credit; }); if (empty > -1) e.lines[empty] = line; else e.lines.push(line); App.render(); };
  A['ed-vat'] = function () {
    var e = ed(), base = e.lines.find(function (l) { return /^[67]/.test(l.account) || /^2[1-4]/.test(l.account); });
    if (!base) { App.toast('Ajoutez d’abord une ligne de charge, de produit ou d’immobilisation.', 'bad'); return; }
    var tc = Y.taxCode(App.S, App.cid(), base.taxCode || 'TVA19'); if (!tc || !tc.rate) { App.toast('Le code TVA de la ligne de base n’est pas taxable.', 'bad'); return; }
    var vente = /^7/.test(base.account), amt = U.round((vente ? base.credit : base.debit) * tc.rate / 100), acc = vente ? tc.collect : (/^2/.test(base.account) ? tc.deductAssets : tc.deductGoods);
    e.lines = e.lines.filter(function (l) { return !/^44[35]/.test(l.account); });
    var idx = e.lines.indexOf(base) + 1;
    e.lines.splice(idx, 0, { account: acc, label: 'TVA ' + String(tc.rate).replace('.', ',') + ' %', tiersId: '', section: '', taxCode: tc.code, debit: vente ? 0 : amt, credit: vente ? amt : 0 });
    App.toast('TVA calculée : ' + U.fmt(amt) + ' XAF au compte ' + acc + '.', 'ok'); App.render();
  };
  A['ed-file'] = function (el) { var f = el.files && el.files[0]; if (!f) return; if (f.size > 10 * 1024 * 1024) { App.toast('Fichier trop lourd (10 Mo maximum).', 'bad'); return; } ed().attachments.push({ name: f.name, size: f.size, type: f.type, addedAt: new Date().toISOString() }); App.render(); };
  A['ed-unattach'] = function (el) { ed().attachments.splice(+el.dataset.i, 1); App.render(); };
  function payload() { var e = ed(); return { id: e.id || undefined, journal: e.journal, date: e.date, pieceDate: e.pieceDate, ref: e.ref, label: e.label, attachments: e.attachments, lines: e.lines.filter(function (l) { return l.account || l.debit || l.credit; }).map(function (l) { return Object.assign({}, l, { label: l.label || e.label }); }) }; }
  A['ed-draft'] = function () { if (!App.guard('draft')) return; var r = App.run(function () { return Y.saveDraft(App.S, App.cid(), payload()); }, 'Brouillon enregistré : il ne reçoit pas encore de numéro.'); if (r) { App.ui.v.ed = blankEditor(ed().journal); App.ui.v.ed.company = App.cid(); App.render(); } };
  A['ed-post'] = function () {
    if (!App.guard('post')) return;
    var c = checks(ed()); if (c.errs.length) { App.toast(c.errs[0], 'bad'); return; }
    var r = App.run(function () { var e = Y.postEntry(App.S, App.cid(), payload()); return e; }, function (e) { return 'Écriture ' + e.num + ' validée. Elle ne peut plus être supprimée.'; });
    if (r) { App.ui.v.lastPosted = r.num; App.ui.v.ed = blankEditor(ed().journal); App.ui.v.ed.company = App.cid(); App.render(); }
  };

  /* ---------------------------------------------------------------- modèles */
  function templates() {
    var d = App.D();
    if (!d.templates) d.templates = [
      { id: 'tp1', label: 'Loyer du siège', journal: 'ACH', freq: 'Mensuel · le 1er', lines: [{ account: '622', label: 'Loyer', debit: 1500000, credit: 0, section: 'STR', taxCode: 'TVA19' }, { account: '4452', label: 'TVA récupérable', debit: 288750, credit: 0 }, { account: '4011', label: 'Bailleur', debit: 0, credit: 1788750 }] },
      { id: 'tp2', label: 'Frais Mobile Money', journal: 'MTN', freq: 'À la demande', lines: [{ account: '631', label: 'Frais opérateur', debit: 0, credit: 0, section: 'STR' }, { account: '5521', label: 'MTN Mobile Money', debit: 0, credit: 0 }] },
      { id: 'tp3', label: 'Virement interne banque → caisse', journal: 'OD', freq: 'Mensuel', lines: [{ account: '585', label: 'Virement de fonds', debit: 300000, credit: 0 }, { account: '5211', label: 'Banque principale', debit: 0, credit: 300000 }] },
      { id: 'tp4', label: 'Charge constatée d’avance (inventaire)', journal: 'OD', freq: 'Clôture', lines: [{ account: '476', label: 'Charge constatée d’avance', debit: 0, credit: 0 }, { account: '622', label: 'Loyer de l’exercice suivant', debit: 0, credit: 0, section: 'STR' }] }
    ];
    return d.templates;
  }
  A['tpl-use'] = function (el) { var t = templates().find(function (x) { return x.id === el.dataset.id; }); App.loadEditor({ journal: t.journal, date: App.today(), label: t.label, lines: t.lines, attachments: [] }, true); App.ui.v.ed.label = t.label; App.go('saisie', 'new'); App.toast('Modèle « ' + t.label + ' » chargé : vérifiez les montants puis validez.', 'ok'); };
  A['tpl-del'] = function (el) { var d = App.D(); App.confirm({ title: 'Supprimer ce modèle ?', ok: 'Supprimer', danger: true }).then(function (v) { if (v) App.run(function () { d.templates = templates().filter(function (x) { return x.id !== el.dataset.id; }); }, 'Modèle supprimé.'); }); };
  A['tpl-from-editor'] = function () {
    var e = ed(); if (!e.lines.some(function (l) { return l.account; })) { App.toast('L’éditeur est vide.', 'bad'); return; }
    App.form({ title: 'Enregistrer comme modèle', sub: 'Réutilisez cette écriture en un clic (loyers, abonnements, régularisations).', fields: [{ k: 'label', label: 'Nom du modèle', req: true, val: e.label, span: true }, { k: 'freq', label: 'Périodicité', type: 'select', opts: ['Mensuel', 'Trimestriel', 'Annuel', 'Clôture', 'À la demande'], val: 'Mensuel' }, { k: 'keep', label: 'Conserver les montants', type: 'check', val: true }],
      submit: 'Enregistrer le modèle', done: 'Modèle enregistré.',
      onSubmit: function (v) { templates().push({ id: U.uid('tp'), label: v.label, journal: e.journal, freq: v.freq, lines: e.lines.filter(function (l) { return l.account; }).map(function (l) { return Object.assign({}, l, v.keep ? {} : { debit: 0, credit: 0 }); }) }); } });
  };

  /* ------------------------------------------------------------------ page */
  App.pages.saisie = {
    onSubmitKey: function () { if (App.tab('saisie', 'new') === 'new') A['ed-post'](); },
    render: function () {
      var d = App.D(), S = App.S, cid = App.cid();
      var drafts = d.entries.filter(function (e) { return e.status === 'draft'; });
      var tab = App.tab('saisie', 'new');
      var h = '<div class="page">' + App.head('Comptabilité · Quotidien', 'Saisie <span class="serif">&amp; journaux</span>', 'Une écriture déséquilibrée ne peut pas être validée ; une écriture validée ne peut pas être effacée, elle se contre-passe.',
        '<button type="button" class="btn" data-act="go" data-page="imports" data-tab="import">' + App.ic('upload') + 'Importer des écritures</button><button type="button" class="btn acc" data-act="tab" data-page="saisie" data-tab="new"' + App.dis('draft') + '>' + App.ic('plus') + 'Nouvelle écriture</button>');
      h += App.tabs('saisie', [['new', 'Nouvelle écriture'], ['drafts', 'Brouillons', drafts.length], ['list', 'Écritures validées', Y.validated(S, cid).length], ['tpl', 'Modèles et abonnements', templates().length]], 'new');
      if (tab === 'new') { h += editorHtml(); if (App.ui.v.lastPosted) { h += '<div class="callout ok">' + App.ic('check') + '<span>Dernière écriture validée : <b class="mono">' + esc(App.ui.v.lastPosted) + '</b>. <button type="button" class="btn xs" data-act="entry-open" data-id="' + esc(App.ui.v.lastPosted) + '">Voir</button></span></div>'; } }
      if (tab === 'drafts') {
        h += '<div class="card flush">' + App.table('drafts', { exportName: 'brouillons', rows: drafts, rowAct: 'entry-open', emptyTitle: 'Aucun brouillon', empty: 'Les écritures enregistrées en brouillon apparaissent ici.',
          cols: [{ k: 'date', label: 'Date', fmt: App.date }, { k: 'journal', label: 'Journal', fmt: function (v) { return '<span class="ac">' + esc(v) + '</span>'; } }, { k: 'label', label: 'Libellé' }, { k: 'createdBy', label: 'Saisi par' },
            { k: 'amt', label: 'Montant', num: true, val: function (r) { return Y.entryTotals(r).debit; }, fmt: function (v) { return U.fmt(v); } },
            { k: 'ctrl', label: 'Contrôle', val: function (r) { return Y.checkEntry(S, cid, r).length; }, fmt: function (v, r) { var t = Y.entryTotals(r); return t.diff ? App.chip('Écart ' + U.fmt(Math.abs(t.diff)), 'bad') : (v ? App.chip(v + ' anomalie(s)', 'warn') : App.chip('Prêt', 'ok')); } }],
          rowActions: function (r) { return '<button type="button" class="btn xs" data-act="draft-resume" data-id="' + r.id + '">Reprendre</button> <button type="button" class="btn xs" data-act="draft-post" data-id="' + r.id + '"' + (Y.checkEntry(S, cid, r).length ? ' disabled' : App.dis('post')) + '>Valider</button> <button type="button" class="btn xs danger" data-act="draft-del" data-id="' + r.id + '">Supprimer</button>'; } }) + '</div>';
      }
      if (tab === 'list') {
        var jf = App.v('lstJ', ''), from = App.v('lstFrom', App.year() + '-01-01'), to = App.v('lstTo', App.year() + '-12-31');
        var rows = Y.validated(S, cid).filter(function (e) { return (!jf || e.journal === jf) && e.date >= from && e.date <= to; }).sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : (a.num < b.num ? 1 : -1); });
        var tb = '<select class="in" style="width:auto;height:38px" id="lst_j" data-change="lst-filter" data-k="lstJ" aria-label="Journal"><option value="">Tous les journaux</option>' + d.journals.map(function (j) { return '<option value="' + j.code + '"' + (j.code === jf ? ' selected' : '') + '>' + esc(j.code + ' · ' + j.label) + '</option>'; }).join('') + '</select>' +
          '<input class="in" type="date" style="width:auto;height:38px" id="lst_from" aria-label="Du" data-change="lst-filter" data-k="lstFrom" value="' + from + '"><input class="in" type="date" style="width:auto;height:38px" id="lst_to" aria-label="Au" data-change="lst-filter" data-k="lstTo" value="' + to + '">';
        h += '<div class="card flush">' + App.table('entries', { exportName: 'journal_ecritures', title: 'Journal des écritures', pdf: true, rows: rows, rowAct: 'entry-open', toolbar: tb, placeholder: 'N° de pièce, libellé, référence…',
          searchText: function (r) { return r.ref + ' ' + r.lines.map(function (l) { return l.account; }).join(' '); },
          cols: [{ k: 'num', label: 'N° pièce', fmt: function (v) { return '<span class="ac">' + esc(v) + '</span>'; } }, { k: 'date', label: 'Date', fmt: App.date }, { k: 'journal', label: 'Jnl' }, { k: 'label', label: 'Libellé' }, { k: 'ref', label: 'Référence' },
            { k: 'accs', label: 'Comptes', val: function (r) { return r.lines.map(function (l) { return l.account; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).join(' · '); }, fmt: function (v) { return '<span class="ac muted">' + esc(v) + '</span>'; } },
            { k: 'amt', label: 'Montant', num: true, val: function (r) { return Y.entryTotals(r).debit; }, fmt: function (v) { return U.fmt(v); } },
            { k: 'st', label: 'Statut', val: function (r) { return r.reversedBy ? 'Contre-passée' : (r.reversalOf ? 'Contre-passation' : 'Validée'); }, fmt: function (v) { return App.chip(v, v === 'Validée' ? 'ok' : (v === 'Contre-passée' ? 'warn' : 'info')); } },
            { k: 'source', label: 'Origine', fmt: function (v) { return '<span class="muted" style="font-size:12px">' + esc(SRC[v] || v || '') + '</span>'; } }] }) + '</div>';
      }
      if (tab === 'tpl') {
        h += '<div class="grid g3">' + templates().map(function (t) {
          return '<div class="card" style="display:flex;flex-direction:column;gap:10px"><div class="actions"><span class="ac">' + esc(t.journal) + '</span>' + App.chip(t.freq, 'info') + '</div><b style="font-size:15px">' + esc(t.label) + '</b><div class="mini-entry">' + t.lines.map(function (l) { return U.pad(l.account, 6).replace(/^0+/, function (z) { return z.replace(/0/g, ' '); }) + ' ' + (l.debit ? 'D ' + U.fmt(l.debit) : (l.credit ? 'C ' + U.fmt(l.credit) : '  à saisir')) + '  ' + esc(l.label); }).join('\n') + '</div><div class="actions" style="margin-top:auto"><button type="button" class="btn sm pri" data-act="tpl-use" data-id="' + t.id + '">Utiliser</button><button type="button" class="btn sm danger" data-act="tpl-del" data-id="' + t.id + '">Supprimer</button></div></div>';
        }).join('') + '<div class="card" style="display:flex;flex-direction:column;gap:10px;justify-content:center;align-items:flex-start"><b>Créer un modèle</b><span class="muted">Préparez l’écriture dans l’éditeur puis choisissez « Enregistrer comme modèle ».</span><button type="button" class="btn sm" data-act="tab" data-page="saisie" data-tab="new">Ouvrir l’éditeur</button></div></div>';
      }
      return h + '</div>';
    }
  };
  A['lst-filter'] = function (el) { App.ui.v[el.dataset.k] = el.value; App.render(); };
})();

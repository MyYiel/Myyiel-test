/* Ventes : devis, factures, avoirs, encaissements (dont Mobile Money), relances, articles. Chaque facture émise génère son écriture VTE. */
(function () {
  'use strict';
  var Y = window.Yiel, U = Y.util, App = window.App, esc = App.esc, A = App.actions;

  App.words = function (n) {
    var u = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize'];
    var t = ['', 'dix', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];
    function lt100(x) { if (x < 17) return u[x]; if (x < 20) return 'dix-' + u[x - 10]; var d = Math.floor(x / 10), r = x % 10; if (d === 7 || d === 9) return t[d] + (d === 7 && r === 1 ? '-et-' : '-') + lt100(10 + r); if (r === 0) return d === 8 ? 'quatre-vingts' : t[d]; if (r === 1 && d !== 8) return t[d] + '-et-un'; return t[d] + '-' + u[r]; }
    function lt1000(x) { var c = Math.floor(x / 100), r = x % 100, s = ''; if (c) s = c > 1 ? u[c] + ' cent' + (r === 0 ? 's' : '') : 'cent'; if (r) s += (s ? ' ' : '') + lt100(r); return s; }
    n = Math.round(n); if (!n) return 'zéro';
    var b = Math.floor(n / 1e9), m = Math.floor((n % 1e9) / 1e6), k = Math.floor((n % 1e6) / 1000), r = n % 1000, s = [];
    if (b) s.push(lt1000(b) + (b > 1 ? ' milliards' : ' milliard')); if (m) s.push(m === 1 ? 'un million' : lt1000(m) + ' millions'); if (k) s.push(k === 1 ? 'mille' : lt1000(k).replace(/s$/, '') + ' mille'); if (r) s.push(lt1000(r));
    return s.join(' ');
  };
  var KIND = { FA: 'Facture', DV: 'Devis', AV: 'Avoir' };
  function S() { return App.S; } function cid() { return App.cid(); }
  function tname(id) { var t = Y.tiers(S(), cid(), id); return t ? t.name : '—'; }
  function salesAccounts() { return App.D().accounts.filter(function (a) { return /^70/.test(a.num) && a.active && Y.isLeaf(S(), cid(), a.num); }).map(function (a) { return [a.num, a.num + ' · ' + a.label]; }); }

  /* --------------------------------------------------------- éditeur de document */
  function newDoc(type) { var c = App.D().tiers.find(function (t) { return t.type === 'client'; }); return { id: null, type: type, status: 'draft', date: App.today(), terms: c ? c.terms : 30, tiersId: c ? c.id : '', ref: '', section: '', notes: type === 'DV' ? 'Devis valable 30 jours.' : 'Merci pour votre confiance.', pay: { momo: true, om: true, bank: true, cash: false }, lines: [{ itemCode: '', label: '', qty: 1, unit: 'unité', price: 0, discount: 0, taxCode: 'TVA19', account: '7068', section: '' }], payments: [] }; }
  A['doc-new'] = function (el) { if (!App.guard('invoice')) return; App.ui.v.docEd = newDoc(el.dataset.type || 'FA'); if (el.dataset.tiers) { var tt = Y.tiers(S(), cid(), el.dataset.tiers); if (tt) { App.ui.v.docEd.tiersId = tt.id; App.ui.v.docEd.terms = tt.terms; } } App.ui.v.docId = 'edit'; App.ui.tabs.ventes = el.dataset.type === 'DV' ? 'devis' : (el.dataset.type === 'AV' ? 'avoirs' : 'factures'); App.render(); };
  A['doc-open'] = function (el) { var x = Y.doc(S(), cid(), el.dataset.id); if (!x) return; if (x.status === 'draft') { App.ui.v.docEd = U.clone(x); App.ui.v.docId = 'edit'; } else { App.ui.v.docId = x.id; } App.render(); window.scrollTo(0, 0); };
  A['doc-close'] = function () { App.ui.v.docId = null; App.ui.v.docEd = null; App.render(); };
  function de() { return App.ui.v.docEd; }
  A['doc-head'] = function (el) { var d = de(); d[el.dataset.f] = el.dataset.f === 'terms' ? +el.value : el.value; if (el.dataset.f === 'tiersId') { var t = Y.tiers(S(), cid(), el.value); if (t) d.terms = t.terms; App.render(); return; } docRefresh(); };
  A['doc-cell'] = function (el) { var l = de().lines[+el.dataset.i], f = el.dataset.f; l[f] = (f === 'qty' || f === 'discount') ? (parseFloat(String(el.value).replace(',', '.')) || 0) : (f === 'price' ? U.parseAmount(el.value) : el.value); docRefresh(); };
  A['doc-item'] = function (el) { var it = App.D().items.find(function (x) { return x.code === el.value; }); var l = de().lines[+el.dataset.i]; if (it) Object.assign(l, { itemCode: it.code, label: it.label, unit: it.unit, price: it.price, taxCode: it.taxCode, account: it.account, section: it.section }); else l.itemCode = ''; App.render(); };
  A['doc-add'] = function () { de().lines.push({ itemCode: '', label: '', qty: 1, unit: 'unité', price: 0, discount: 0, taxCode: 'TVA19', account: '7068', section: de().section || '' }); App.render(); };
  A['doc-del'] = function (el) { if (de().lines.length > 1) de().lines.splice(+el.dataset.i, 1); App.render(); };
  A['doc-pay'] = function (el) { var d = de(); d.pay[el.dataset.k] = el.checked; docRefresh(); };
  A['doc-save'] = function () { if (!App.guard('invoice')) return; var d = de(); var r = App.run(function () { var x = Y.saveDoc(S(), cid(), Object.assign({}, d, { id: d.id || undefined })); d.id = x.id; return x; }, 'Brouillon enregistré.'); };
  A['doc-emit'] = function () {
    if (!App.guard('invoice')) return;
    var d = de(), t = Y.docTotals(S(), cid(), d);
    App.confirm({ title: (d.type === 'DV' ? 'Envoyer le devis' : 'Émettre ' + (d.type === 'AV' ? 'l’avoir' : 'la facture')) + ' · ' + U.fmt(t.ttc) + ' XAF', body: d.type === 'DV' ? 'Le devis reçoit son numéro définitif. Il ne génère aucune écriture.' : 'Le document reçoit un numéro chronologique définitif et l’écriture de vente est passée au journal VTE. Il ne pourra plus être modifié : seul un avoir l’annulera.', ok: d.type === 'DV' ? 'Envoyer' : 'Émettre' })
      .then(function (v) { if (!v) return; var r = App.run(function () { var x = Y.saveDoc(S(), cid(), Object.assign({}, d, { id: d.id || undefined })); return Y.emitDoc(S(), cid(), x.id); }, function (x) { return x.num + ' émis' + (x.entryNum ? ' · écriture ' + x.entryNum : '') + '.'; }); if (r) { App.ui.v.docId = r.id; App.ui.v.docEd = null; App.render(); } });
  };
  function docTotalsHtml(d) {
    var t = Y.docTotals(S(), cid(), d);
    return '<div style="display:flex;flex-direction:column;gap:6px;font-size:13.5px"><div style="display:flex;justify-content:space-between"><span>Total HT brut</span><span class="num">' + U.fmt(t.brut) + '</span></div><div style="display:flex;justify-content:space-between"><span>Remises</span><span class="num">' + (t.remise ? '− ' + U.fmt(t.remise) : '0') + '</span></div><div style="display:flex;justify-content:space-between;font-weight:750"><span>Total HT net</span><span class="num">' + U.fmt(t.ht) + '</span></div>' +
      Object.keys(t.byTax).map(function (k) { var tc = Y.taxCode(S(), cid(), k); return tc && tc.rate ? '<div style="display:flex;justify-content:space-between"><span>TVA ' + String(tc.rate).replace('.', ',') + ' % (dont CAC) sur ' + U.fmt(t.byTax[k].base) + '</span><span class="num">' + U.fmt(t.byTax[k].tax) + '</span></div>' : ''; }).join('') +
      '<div style="display:flex;justify-content:space-between;font-size:19px;font-weight:800;padding-top:8px;border-top:1px solid var(--line)"><span>Total TTC</span><span class="num">' + U.fmt(t.ttc) + ' XAF</span></div><div class="muted" style="font-size:12px">Arrêté à la somme de ' + esc(App.words(t.ttc)) + ' francs CFA.</div></div>';
  }
  function entryPreview(d) {
    if (d.type === 'DV') return '<div class="callout">' + App.ic('file') + '<span>Un devis ne génère aucune écriture comptable.</span></div>';
    var t = Y.docTotals(S(), cid(), d), av = d.type === 'AV', tt = Y.tiers(S(), cid(), d.tiersId), rows = [[(tt && tt.collective) || '4111', (tt ? tt.code + ' ' : '') + 'Clients', av ? 0 : t.ttc, av ? t.ttc : 0]], acc = {};
    d.lines.forEach(function (l) { var b = U.round((+l.qty || 0) * (+l.price || 0)); acc[l.account || '7068'] = (acc[l.account || '7068'] || 0) + b - U.round(b * (+l.discount || 0) / 100); });
    Object.keys(acc).forEach(function (k) { if (acc[k]) rows.push([k, Y.accountLabel(S(), cid(), k), av ? acc[k] : 0, av ? 0 : acc[k]]); });
    if (t.tva) rows.push(['4431', 'TVA facturée sur ventes', av ? t.tva : 0, av ? 0 : t.tva]);
    return '<table class="t"><thead><tr><th>Compte</th><th>Intitulé</th><th class="num">Débit</th><th class="num">Crédit</th></tr></thead><tbody>' + rows.map(function (r) { return '<tr><td class="ac">' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td><td class="num">' + App.m0(r[2]) + '</td><td class="num">' + App.m0(r[3]) + '</td></tr>'; }).join('') + '<tr class="sub"><td colspan="2">Équilibre</td><td class="num">' + U.fmt(t.ttc) + '</td><td class="num">' + U.fmt(t.ttc) + '</td></tr></tbody></table>';
  }
  function paper(d) {
    var co = App.co(), tt = Y.tiers(S(), cid(), d.tiersId) || {}, t = Y.docTotals(S(), cid(), d);
    var due = d.due || U.addDays(d.date, +d.terms || 0);
    var pay = []; if (d.pay.momo) pay.push('MTN MoMo ' + co.momoMerchant); if (d.pay.om) pay.push('Orange Money ' + co.omMerchant); if (d.pay.bank) pay.push('Virement ' + co.iban); if (d.pay.cash) pay.push('Espèces contre reçu');
    return '<div class="paper">' + (window.YIEL_MARK ? '<img class="wm" src="' + window.YIEL_MARK + '" alt="">' : '') +
      '<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start"><img src="' + (window.YIEL_LOGO_LIGHT || '') + '" alt="Yiel" style="height:34px"><div style="text-align:right"><div style="font-size:16px;font-weight:800;letter-spacing:.05em">' + esc(KIND[d.type].toUpperCase()) + '</div><div style="font-family:var(--f-mono)">' + esc(d.num || 'Brouillon') + '</div><div>' + App.date(d.date) + '</div></div></div>' +
      '<div style="display:flex;justify-content:space-between;gap:16px;margin-top:16px"><div><b>' + esc(co.name) + '</b><br>' + esc(co.address) + ' · ' + esc(co.city) + '<br>NIU ' + esc(co.niu) + '<br>RCCM ' + esc(co.rccm) + '</div><div style="text-align:right"><b>' + esc(tt.name || '') + '</b><br>' + esc(tt.address || '') + ' ' + esc(tt.city || '') + '<br>NIU ' + esc(tt.niu || '—') + '</div></div>' +
      '<table style="margin-top:14px"><thead><tr><th>Désignation</th><th style="text-align:right">Qté</th><th style="text-align:right">PU HT</th><th style="text-align:right">Total HT</th></tr></thead><tbody>' + d.lines.map(function (l) { var b = U.round((+l.qty || 0) * (+l.price || 0)), h2 = b - U.round(b * (+l.discount || 0) / 100); return '<tr><td>' + esc(l.label || '—') + (l.discount ? ' <span style="color:#575D79">(remise ' + l.discount + ' %)</span>' : '') + '</td><td style="text-align:right">' + esc(String(l.qty).replace('.', ',')) + '</td><td style="text-align:right">' + U.fmt(l.price) + '</td><td style="text-align:right">' + U.fmt(h2) + '</td></tr>'; }).join('') + '</tbody></table>' +
      '<div style="margin:10px 0 0 auto;width:230px;display:flex;flex-direction:column;gap:3px"><div style="display:flex;justify-content:space-between"><span>Total HT</span><span>' + U.fmt(t.ht) + '</span></div><div style="display:flex;justify-content:space-between"><span>TVA 19,25 %</span><span>' + U.fmt(t.tva) + '</span></div><div style="display:flex;justify-content:space-between;font-weight:800;font-size:14px;border-top:1px solid #12162E;padding-top:4px"><span>Net à payer</span><span>' + U.fmt(t.ttc) + ' XAF</span></div></div>' +
      (d.type !== 'AV' ? '<div style="margin-top:12px;padding:10px;border-radius:8px;background:#FFF4EC;font-size:11px"><b>Échéance : ' + App.date(due) + '</b><br>' + esc(pay.join(' · ') || 'Aucun moyen de paiement sélectionné') + '</div>' : '') +
      '<p style="margin:10px 0 0;font-size:10px;color:#575D79">Arrêté à la somme de ' + esc(App.words(t.ttc)) + ' francs CFA. ' + esc(d.notes || '') + '</p></div>';
  }
  function docRefresh() { var d = de(); if (!d) return; var a = document.getElementById('doc_tot'); if (a) a.innerHTML = docTotalsHtml(d); var b = document.getElementById('doc_prev'); if (b) b.innerHTML = paper(d); var c = document.getElementById('doc_entry'); if (c) c.innerHTML = entryPreview(d); d.lines.forEach(function (l, i) { var x = document.getElementById('dl_ht' + i); if (x) { var bb = U.round((+l.qty || 0) * (+l.price || 0)); x.textContent = U.fmt(bb - U.round(bb * (+l.discount || 0) / 100)); } }); }
  function editorHtml() {
    var d = de(), dd = App.D();
    var clients = dd.tiers.filter(function (t) { return t.type === 'client' && t.active !== false; });
    var h = '<div class="actions"><button type="button" class="btn sm" data-act="doc-close">' + App.ic('back') + 'Retour à la liste</button><span class="chip">Brouillon</span></div>';
    h += '<div class="row"><div class="card grow"><div class="card-h"><h2>' + (d.id ? 'Modifier le brouillon' : 'Nouveau ' + KIND[d.type].toLowerCase()) + '</h2><div class="actions">' + App.seg('dtype', [['FA', 'Facture'], ['DV', 'Devis'], ['AV', 'Avoir']], d.type, 'doc-type') + '</div></div>';
    h += '<div class="form-grid">' +
      '<label class="fld span2"><span>Client<em>*</em></span><select class="in" id="dh_t" data-change="doc-head" data-f="tiersId"><option value="">Choisir un client…</option>' + clients.map(function (t) { return '<option value="' + t.id + '"' + (t.id === d.tiersId ? ' selected' : '') + '>' + esc(t.code + ' · ' + t.name) + '</option>'; }).join('') + '</select></label>' +
      '<label class="fld"><span>Date d’émission<em>*</em></span><input class="in" type="date" id="dh_d" data-input="doc-head" data-f="date" value="' + esc(d.date) + '"></label>' +
      '<label class="fld"><span>Conditions de paiement</span><select class="in" id="dh_terms" data-change="doc-head" data-f="terms">' + [[0, 'À réception'], [15, '15 jours'], [30, '30 jours'], [45, '45 jours'], [60, '60 jours']].map(function (o) { return '<option value="' + o[0] + '"' + (+d.terms === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label>' +
      '<label class="fld"><span>Échéance</span><input class="in" readonly value="' + App.date(U.addDays(d.date, +d.terms || 0)) + '" id="dh_due"></label>' +
      '<label class="fld"><span>Bon de commande / référence</span><input class="in" id="dh_ref" data-input="doc-head" data-f="ref" value="' + esc(d.ref) + '"></label>' +
      '<label class="fld"><span>Devise</span><input class="in" readonly value="XAF · franc CFA" id="dh_cur"></label>' +
      '</div>';
    h += '<div class="tbl-wrap" style="margin-top:14px;border:1px solid var(--line);border-radius:12px"><table class="t grid-entry" style="min-width:1000px"><thead><tr><th style="width:150px">Article</th><th>Désignation</th><th class="num" style="width:76px">Qté</th><th style="width:90px">Unité</th><th class="num" style="width:120px">PU HT</th><th class="num" style="width:76px">Remise %</th><th style="width:90px">TVA</th><th style="width:130px">Compte</th><th class="num" style="width:120px">Total HT</th><th style="width:40px"></th></tr></thead><tbody>';
    d.lines.forEach(function (l, i) {
      var b = U.round((+l.qty || 0) * (+l.price || 0));
      h += '<tr><td><select class="cell" id="dl_it' + i + '" aria-label="Article" data-change="doc-item" data-i="' + i + '"><option value="">Libre</option>' + dd.items.map(function (it) { return '<option value="' + esc(it.code) + '"' + (it.code === l.itemCode ? ' selected' : '') + '>' + esc(it.code) + '</option>'; }).join('') + '</select></td>' +
        '<td><input class="cell" id="dl_l' + i + '" aria-label="Désignation" data-input="doc-cell" data-i="' + i + '" data-f="label" value="' + esc(l.label) + '"></td>' +
        '<td><input class="cell num" id="dl_q' + i + '" aria-label="Quantité" inputmode="decimal" data-input="doc-cell" data-i="' + i + '" data-f="qty" value="' + esc(String(l.qty).replace('.', ',')) + '"></td>' +
        '<td><input class="cell" id="dl_u' + i + '" aria-label="Unité" data-input="doc-cell" data-i="' + i + '" data-f="unit" value="' + esc(l.unit) + '"></td>' +
        '<td><input class="cell num" id="dl_p' + i + '" aria-label="Prix unitaire" inputmode="numeric" data-input="doc-cell" data-i="' + i + '" data-f="price" value="' + U.fmt(l.price) + '"></td>' +
        '<td><input class="cell num" id="dl_r' + i + '" aria-label="Remise" inputmode="decimal" data-input="doc-cell" data-i="' + i + '" data-f="discount" value="' + esc(l.discount || 0) + '"></td>' +
        '<td><select class="cell" id="dl_x' + i + '" aria-label="TVA" data-change="doc-cellc" data-i="' + i + '" data-f="taxCode">' + dd.taxCodes.filter(function (t) { return t.active; }).map(function (t) { return '<option value="' + t.code + '"' + (t.code === l.taxCode ? ' selected' : '') + '>' + esc(t.code) + '</option>'; }).join('') + '</select></td>' +
        '<td><select class="cell mono" id="dl_a' + i + '" aria-label="Compte de produit" data-change="doc-cellc" data-i="' + i + '" data-f="account">' + salesAccounts().map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === l.account ? ' selected' : '') + ' title="' + esc(o[1]) + '">' + esc(o[0]) + '</option>'; }).join('') + '</select></td>' +
        '<td class="num" id="dl_ht' + i + '" style="font-weight:700">' + U.fmt(b - U.round(b * (+l.discount || 0) / 100)) + '</td><td><button type="button" class="btn xs icon ghost" aria-label="Supprimer la ligne" data-act="doc-del" data-i="' + i + '">' + App.ic('x') + '</button></td></tr>';
    });
    h += '<tr class="sub"><td colspan="10"><button type="button" class="btn sm" data-act="doc-add">' + App.ic('plus') + 'Ligne</button></td></tr></tbody></table></div>';
    h += '<div class="row" style="margin-top:14px"><div class="grow" style="display:flex;flex-direction:column;gap:6px;flex-basis:300px"><div class="eyebrow">Moyens de paiement proposés</div>' +
      [['momo', 'Lien de paiement MTN Mobile Money'], ['om', 'Lien de paiement Orange Money'], ['bank', 'Virement bancaire (RIB en pied de facture)'], ['cash', 'Espèces contre reçu']].map(function (p) { return '<label class="check"><input type="checkbox" id="dp_' + p[0] + '" data-change="doc-pay" data-k="' + p[0] + '"' + (d.pay[p[0]] ? ' checked' : '') + '>' + p[1] + '</label>'; }).join('') +
      '<label class="fld" style="margin-top:6px"><span>Note et conditions</span><textarea class="in" id="dh_notes" data-input="doc-head" data-f="notes">' + esc(d.notes) + '</textarea></label></div><div class="side card" style="background:var(--surface-2)" id="doc_tot">' + docTotalsHtml(d) + '</div></div>';
    h += '<div class="actions" style="justify-content:flex-end;margin-top:14px"><button type="button" class="btn" data-act="doc-close">Annuler</button><button type="button" class="btn" data-act="doc-save">Enregistrer le brouillon</button><button type="button" class="btn" data-act="doc-pdf-draft">' + App.ic('pdf') + 'Aperçu PDF</button><button type="button" class="btn acc" data-act="doc-emit"' + App.dis('invoice') + '>' + App.ic('send') + (d.type === 'DV' ? 'Envoyer le devis' : 'Émettre et comptabiliser') + '</button></div></div>';
    h += '<div class="side" style="display:flex;flex-direction:column;gap:12px;flex-basis:380px"><div class="eyebrow">Aperçu client</div><div id="doc_prev">' + paper(d) + '</div><div class="card flush"><div class="card-h"><h2>Écriture générée · journal VTE</h2></div><div id="doc_entry">' + entryPreview(d) + '</div></div></div></div>';
    return h;
  }
  A['doc-cellc'] = function (el) { de().lines[+el.dataset.i][el.dataset.f] = el.value; docRefresh(); };
  A['doc-type'] = function (el) { de().type = el.dataset.val; App.render(); };

  /* ------------------------------------------------------ vue d'un document émis */
  function viewHtml(x) {
    var t = Y.docTotals(S(), cid(), x), st = Y.docStatus(S(), cid(), x), paid = Y.docPaid(x), tt = Y.tiers(S(), cid(), x.tiersId);
    var h = '<div class="actions"><button type="button" class="btn sm" data-act="doc-close">' + App.ic('back') + 'Retour à la liste</button>' + App.chip(st.label, st.tone, true) + (x.entryNum ? App.chip('Écriture ' + x.entryNum, 'info') : '') + '</div>';
    h += '<div class="row"><div class="grow" style="display:flex;flex-direction:column;gap:14px">';
    h += '<div class="card"><div class="card-h"><h2>' + esc(KIND[x.type] + ' ' + x.num) + '</h2><span class="sub">' + esc(tt ? tt.name : '') + '</span><div class="actions">' +
      '<button type="button" class="btn sm" data-act="doc-pdf" data-id="' + x.id + '">' + App.ic('pdf') + 'PDF</button><button type="button" class="btn sm" data-act="doc-send" data-id="' + x.id + '">' + App.ic('send') + 'Envoyer</button>' +
      (x.type === 'FA' && paid < t.ttc ? '<button type="button" class="btn sm acc" data-act="pay-new" data-id="' + x.id + '"' + App.dis('invoice') + '>' + App.ic('money') + 'Enregistrer un paiement</button>' : '') +
      (x.type === 'FA' ? '<button type="button" class="btn sm" data-act="doc-credit" data-id="' + x.id + '"' + App.dis('invoice') + '>Créer un avoir</button>' : '') +
      (x.type === 'DV' && x.status !== 'invoiced' ? '<button type="button" class="btn sm" data-act="dv-status" data-id="' + x.id + '" data-s="accepted">Accepté</button><button type="button" class="btn sm" data-act="dv-status" data-id="' + x.id + '" data-s="refused">Refusé</button><button type="button" class="btn sm acc" data-act="dv-convert" data-id="' + x.id + '">Convertir en facture</button>' : '') + '</div></div>';
    h += '<div class="grid g4"><div class="kpi"><span class="lbl">Total TTC</span><span class="val">' + U.fmt(t.ttc) + '</span></div><div class="kpi"><span class="lbl">Encaissé</span><span class="val pos">' + U.fmt(paid) + '</span></div><div class="kpi"><span class="lbl">Reste dû</span><span class="val' + (t.ttc - paid ? ' neg' : '') + '">' + U.fmt(Math.max(0, t.ttc - paid)) + '</span></div><div class="kpi"><span class="lbl">Échéance</span><span class="val" style="font-size:18px">' + App.date(x.due) + '</span></div></div></div>';
    if (x.type === 'FA') h += '<div class="card flush"><div class="card-h"><h2>Règlements</h2></div>' + (x.payments.length ? '<div class="tbl-wrap"><table class="t"><thead><tr><th>Date</th><th>Moyen</th><th>Référence</th><th class="num">Frais</th><th class="num">Montant</th><th>Écriture</th></tr></thead><tbody>' + x.payments.map(function (p) { var e = Y.entry(S(), cid(), p.entryId); return '<tr><td>' + App.date(p.date) + '</td><td>' + esc((Y.PAY_METHODS[p.method] || { label: p.method === 'avoir' ? 'Avoir' : p.method }).label) + '</td><td class="mono">' + esc(p.extRef || p.ref || '') + '</td><td class="num">' + App.m0(p.fees) + '</td><td class="num">' + U.fmt(p.amount) + '</td><td>' + (e ? '<button type="button" class="btn xs" data-act="entry-open" data-id="' + e.id + '">' + esc(e.num) + '</button>' : '') + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<div class="empty"><b>Aucun règlement</b>Enregistrez un virement, un paiement MTN MoMo ou Orange Money : l’écriture et le lettrage sont automatiques.</div>') + '</div>';
    h += '<div class="card flush"><div class="card-h"><h2>Écriture comptable</h2>' + (x.entryId ? '<div class="actions"><button type="button" class="btn xs" data-act="entry-open" data-id="' + x.entryId + '">Ouvrir ' + esc(x.entryNum) + '</button></div>' : '') + '</div>' + entryPreview(x) + '</div>';
    h += '</div><div class="side" style="flex-basis:380px">' + paper(x) + '</div></div>';
    return h;
  }
  A['dv-status'] = function (el) { var x = Y.doc(S(), cid(), el.dataset.id); App.run(function () { x.status = el.dataset.s; Y.audit(S(), cid(), 'Statut devis', x.num, el.dataset.s === 'accepted' ? 'Accepté' : 'Refusé'); }, 'Statut du devis mis à jour.'); };
  A['dv-convert'] = function (el) { if (!App.guard('invoice')) return; var r = App.run(function () { return Y.convertQuote(S(), cid(), el.dataset.id); }, 'Facture brouillon créée depuis le devis.'); if (r) { App.ui.v.docEd = U.clone(r); App.ui.v.docId = 'edit'; App.ui.tabs.ventes = 'factures'; App.render(); } };
  A['doc-credit'] = function (el) { if (!App.guard('invoice')) return; var r = App.run(function () { return Y.creditNoteFrom(S(), cid(), el.dataset.id); }, 'Avoir préparé : ajustez les lignes à annuler puis émettez-le.'); if (r) { App.ui.v.docEd = U.clone(r); App.ui.v.docId = 'edit'; App.ui.tabs.ventes = 'avoirs'; App.render(); } };
  A['pay-new'] = function (el) {
    if (!App.guard('invoice')) return;
    var x = Y.doc(S(), cid(), el.dataset.id), t = Y.docTotals(S(), cid(), x), rest = t.ttc - Y.docPaid(x), tt = Y.tiers(S(), cid(), x.tiersId);
    var pref = tt.payPref || 'bank';
    App.form({ title: 'Enregistrer un paiement · ' + x.num, sub: 'Reste dû : ' + U.fmt(rest) + ' XAF · ' + tt.name,
      fields: [{ k: 'date', label: 'Date d’encaissement', type: 'date', val: App.today(), req: true }, { k: 'amount', label: 'Montant reçu (XAF)', type: 'money', val: rest, req: true },
        { k: 'method', label: 'Moyen de paiement', type: 'select', val: pref, opts: Object.keys(Y.PAY_METHODS).map(function (k) { return [k, Y.PAY_METHODS[k].label + ' · ' + Y.PAY_METHODS[k].account]; }), req: true },
        { k: 'fees', label: 'Frais retenus par l’opérateur (XAF)', type: 'money', val: '', help: 'Laissez vide pour le calcul automatique (1 % sur Mobile Money).' },
        { k: 'extRef', label: 'Référence (n° de transaction, de virement)', ph: 'TX-88213', span: true }],
      submit: 'Enregistrer le paiement', live: function (v) { var m = Y.PAY_METHODS[v.method] || Y.PAY_METHODS.bank; var fees = v.fees === '' ? U.round((v.amount || 0) * m.feeRate / 100) : v.fees; return '<div class="mini-entry">' + m.account + '  D ' + U.fmt((v.amount || 0) - fees) + '   ' + m.label + (fees ? '\n631   D ' + U.fmt(fees) + '   Frais' : '') + '\n' + (tt.collective || '4111') + ' C ' + U.fmt(v.amount || 0) + '   ' + tt.code + ' · règlement ' + x.num + '</div>'; },
      onSubmit: function (v) { return Y.registerPayment(S(), cid(), x.id, { date: v.date, amount: v.amount, method: v.method, fees: v.fees === '' ? undefined : v.fees, extRef: v.extRef }); },
      done: function (e) { return 'Paiement enregistré · ' + e.num + (Y.docStatus(S(), cid(), x).key === 'paid' ? ' · facture soldée et lettrée.' : '.'); } });
  };
  A['doc-send'] = function (el) {
    var x = Y.doc(S(), cid(), el.dataset.id), t = Y.docTotals(S(), cid(), x), tt = Y.tiers(S(), cid(), x.tiersId), co = App.co();
    var msg = 'Bonjour,\n\nVeuillez trouver ci-joint ' + (x.type === 'DV' ? 'notre devis ' : (x.type === 'AV' ? 'notre avoir ' : 'notre facture ')) + x.num + ' du ' + App.date(x.date) + ' d’un montant de ' + U.fmt(t.ttc) + ' XAF TTC' + (x.type === 'FA' ? ', payable au plus tard le ' + App.date(x.due) : '') + '.\n\n' +
      (x.type === 'FA' ? 'Moyens de paiement :\n' + (x.pay.momo ? '• MTN Mobile Money : ' + co.momoMerchant + '\n' : '') + (x.pay.om ? '• Orange Money : ' + co.omMerchant + '\n' : '') + (x.pay.bank ? '• Virement : ' + co.iban + '\n' : '') + 'Merci d’indiquer la référence ' + x.num + ' lors du paiement.\n\n' : '') + 'Cordialement,\n' + co.name;
    App.drawer({ title: 'Envoyer ' + x.num, sub: 'À ' + tt.name + (tt.email ? ' · ' + tt.email : '') + (tt.phone ? ' · ' + tt.phone : ''), body: '<div class="callout info">' + App.ic('chat') + '<span>Copiez le message pour l’e-mail ou WhatsApp, puis joignez le PDF. En production, myyiel l’envoie directement et suit l’ouverture.</span></div><label class="fld"><span>Message</span><textarea class="in" id="send_msg" style="min-height:280px">' + esc(msg) + '</textarea></label><dl class="kv"><dt>E-mail du client</dt><dd class="mono">' + esc(tt.email || '—') + '</dd><dt>Téléphone / WhatsApp</dt><dd class="mono">' + esc(tt.phone || '—') + '</dd></dl>',
      foot: '<button type="button" class="btn" data-act="doc-pdf" data-id="' + x.id + '">' + App.ic('pdf') + 'Télécharger le PDF</button><button type="button" class="btn acc" data-act="send-copy" data-id="' + x.id + '">' + App.ic('copy') + 'Copier le message</button>' });
  };
  A['send-copy'] = function (el) { var x = Y.doc(S(), cid(), el.dataset.id); App.copy(document.getElementById('send_msg').value, 'Message copié. Collez-le dans votre e-mail ou WhatsApp.'); x.sentAt = new Date().toISOString(); App.persist(); };
  App.docPdf = function (x) {
    var co = App.co(), tt = Y.tiers(S(), cid(), x.tiersId) || {}, t = Y.docTotals(S(), cid(), x);
    var doc = App.pdfDoc(KIND[x.type].toUpperCase() + ' ' + (x.num || 'BROUILLON'), 'Émis le ' + App.date(x.date) + (x.type === 'FA' ? ' · échéance ' + App.date(x.due || U.addDays(x.date, x.terms)) : '')); if (!doc) return;
    doc.setFontSize(9.5); doc.setTextColor(18, 22, 46); doc.setFont('helvetica', 'bold'); doc.text(co.name, 40, doc._y); doc.text(tt.name || '', 330, doc._y);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(87, 93, 121);
    [co.address + ' · ' + co.city, 'NIU ' + co.niu, 'RCCM ' + co.rccm, 'Régime ' + co.taxRegime].forEach(function (s, i) { doc.text(s, 40, doc._y + 13 + i * 11); });
    [(tt.address || '') + ' ' + (tt.city || ''), 'NIU ' + (tt.niu || '—'), tt.email || '', tt.phone || ''].forEach(function (s, i) { doc.text(s, 330, doc._y + 13 + i * 11); });
    doc._y += 66;
    App.pdfAuto(doc, ['Désignation', 'Qté', 'Unité', 'PU HT', 'Remise', 'TVA', 'Total HT'], x.lines.map(function (l) { var b = U.round(l.qty * l.price), h2 = b - U.round(b * (l.discount || 0) / 100); return [l.label, String(l.qty).replace('.', ','), l.unit, U.fmt(l.price), l.discount ? l.discount + ' %' : '', l.taxCode, U.fmt(h2)]; }), { numCols: [1, 3, 6] });
    var W = doc.internal.pageSize.getWidth(), y = doc._y;
    [['Total HT', U.fmt(t.ht)], ['TVA 19,25 % (dont CAC)', U.fmt(t.tva)], ['NET À PAYER (XAF)', U.fmt(t.ttc)]].forEach(function (r, i) { doc.setFont('helvetica', i === 2 ? 'bold' : 'normal'); doc.setFontSize(i === 2 ? 11 : 9); doc.setTextColor(18, 22, 46); doc.text(r[0], W - 220, y + i * 15); doc.text(r[1], W - 40, y + i * 15, { align: 'right' }); });
    y += 56; doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(87, 93, 121);
    doc.text(doc.splitTextToSize('Arrêté à la somme de ' + App.words(t.ttc) + ' francs CFA.', W - 80), 40, y); y += 22;
    if (x.type === 'FA') { doc.setFillColor(255, 237, 229); doc.roundedRect(40, y, W - 80, 54, 6, 6, 'F'); doc.setTextColor(180, 56, 15); doc.setFont('helvetica', 'bold'); doc.text('Règlement', 52, y + 16); doc.setFont('helvetica', 'normal'); doc.setTextColor(18, 22, 46); var pay = []; if (x.pay.momo) pay.push('MTN Mobile Money ' + co.momoMerchant); if (x.pay.om) pay.push('Orange Money ' + co.omMerchant); if (x.pay.bank) pay.push('Virement ' + co.iban); if (x.pay.cash) pay.push('Espèces contre reçu'); doc.text(doc.splitTextToSize(pay.join(' · ') + ' · Référence à rappeler : ' + x.num, W - 110), 52, y + 31); y += 68; }
    if (x.notes) { doc.setTextColor(87, 93, 121); doc.text(doc.splitTextToSize(x.notes, W - 80), 40, y); }
    App.pdfFinish(doc, (x.num || 'brouillon') + '.pdf');
  };
  A['doc-pdf'] = function (el) { App.docPdf(Y.doc(S(), cid(), el.dataset.id)); };
  A['doc-pdf-draft'] = function () { App.docPdf(de()); };
  A['remind-copy'] = function (el) {
    var x = Y.doc(S(), cid(), el.dataset.id), t = Y.docTotals(S(), cid(), x), rest = t.ttc - Y.docPaid(x), days = U.daysBetween(x.due, App.today()), co = App.co();
    var lvl = days > 45 ? 3 : (days > 15 ? 2 : 1);
    var txt = (lvl === 3 ? 'Objet : mise en demeure de payer · ' : (lvl === 2 ? 'Objet : deuxième relance · ' : 'Objet : rappel amical · ')) + x.num + '\n\nBonjour,\n\nSauf erreur de notre part, la facture ' + x.num + ' du ' + App.date(x.date) + ' reste due pour ' + U.fmt(rest) + ' XAF, échue depuis ' + days + ' jours.\n' +
      (lvl === 3 ? 'Sans règlement sous 8 jours, nous engagerons la procédure de recouvrement prévue par nos conditions générales.\n' : 'Vous pouvez la régler dès maintenant :\n• MTN Mobile Money : ' + co.momoMerchant + '\n• Orange Money : ' + co.omMerchant + '\n• Virement : ' + co.iban + '\n') + '\nCordialement,\n' + co.name;
    App.copy(txt, 'Relance de niveau ' + lvl + ' copiée.');
  };
  A['remind-done'] = function (el) { var x = Y.doc(S(), cid(), el.dataset.id); App.run(function () { x.reminders = x.reminders || []; x.reminders.push({ date: App.today(), by: App.user().name }); Y.audit(S(), cid(), 'Relance', x.num, 'Niveau ' + x.reminders.length); }, 'Relance enregistrée dans l’historique du client.'); };
  A['remind-bulk'] = function () { var ids = App.selected('relances'); if (!ids.length) { App.toast('Cochez au moins une facture.', 'bad'); return; } App.run(function () { ids.forEach(function (id) { var x = Y.doc(S(), cid(), id); x.reminders = x.reminders || []; x.reminders.push({ date: App.today(), by: App.user().name }); }); App.clearSel('relances'); }, ids.length + ' relance(s) enregistrée(s).'); };

  /* ------------------------------------------------------------------ articles */
  function itemFields(it) {
    var dd = App.D();
    return [{ k: 'code', label: 'Code article', req: true, val: it ? it.code : '', ro: !!it, mono: true }, { k: 'unit', label: 'Unité', val: it ? it.unit : 'unité', type: 'select', opts: ['unité', 'jour', 'heure', 'mois', 'forfait', 'pack', 'licence'] },
      { k: 'label', label: 'Désignation', req: true, val: it ? it.label : '', span: true }, { k: 'price', label: 'Prix unitaire HT (XAF)', type: 'money', req: true, val: it ? it.price : '' },
      { k: 'taxCode', label: 'Code TVA', type: 'select', val: it ? it.taxCode : 'TVA19', opts: dd.taxCodes.map(function (t) { return [t.code, t.code + ' · ' + t.label]; }) },
      { k: 'account', label: 'Compte de produit', type: 'select', req: true, val: it ? it.account : '7068', opts: salesAccounts() },
      { k: 'section', label: 'Section analytique', type: 'select', empty: '—', val: it ? it.section : '', opts: dd.sections.map(function (s) { return [s.code, s.code + ' · ' + s.label]; }) }];
  }
  A['item-new'] = function () { if (!App.guard('invoice')) return; App.form({ title: 'Nouvel article', sub: 'Utilisé dans les devis et factures ; le compte et la section passent dans l’écriture.', fields: itemFields(null), submit: 'Créer l’article', done: 'Article créé.', onSubmit: function (v) { Y.createItem(S(), cid(), v); } }); };
  A['item-edit'] = function (el) { var it = App.D().items.find(function (x) { return x.code === el.dataset.id; }); App.form({ title: 'Article ' + it.code, fields: itemFields(it), submit: 'Enregistrer', done: 'Article mis à jour.', onSubmit: function (v) { Object.assign(it, { label: v.label, unit: v.unit, price: v.price, taxCode: v.taxCode, account: v.account, section: v.section }); Y.audit(S(), cid(), 'Modification', 'Article ' + it.code, it.label); } }); };

  /* ----------------------------------------------------------------- page */
  function docTable(type) {
    var dd = App.D(), f = App.v('docSt_' + type, 'all');
    var rows = dd.docs.filter(function (x) { return x.type === type; }).sort(function (a, b) { return (b.num || 'ZZZ') < (a.num || 'ZZZ') ? -1 : 1; });
    var counts = {}; rows.forEach(function (x) { var k = Y.docStatus(S(), cid(), x).key; counts[k] = (counts[k] || 0) + 1; });
    var opts = type === 'FA' ? [['all', 'Toutes'], ['draft', 'Brouillons'], ['emitted', 'Émises'], ['partial', 'Partielles'], ['late', 'En retard'], ['paid', 'Payées']] : (type === 'DV' ? [['all', 'Tous'], ['draft', 'Brouillons'], ['sent', 'Envoyés'], ['accepted', 'Acceptés'], ['invoiced', 'Facturés'], ['expired', 'Expirés'], ['refused', 'Refusés']] : [['all', 'Tous'], ['draft', 'Brouillons'], ['emitted', 'Émis']]);
    if (f !== 'all') rows = rows.filter(function (x) { return Y.docStatus(S(), cid(), x).key === f; });
    return '<div class="card flush">' + App.table('docs_' + type, { exportName: { FA: 'factures', DV: 'devis', AV: 'avoirs' }[type], title: KIND[type] + 's', pdf: true, rows: rows, rowAct: 'doc-open', toolbar: App.filters('docSt_' + type, opts.map(function (o) { return [o[0], o[1] + (o[0] !== 'all' && counts[o[0]] ? ' · ' + counts[o[0]] : '')]; }), f), placeholder: 'N°, client, montant…',
      emptyTitle: 'Aucun document', empty: 'Créez votre premier ' + KIND[type].toLowerCase() + ' avec le bouton en haut de page.',
      cols: [{ k: 'num', label: 'Numéro', fmt: function (v) { return v ? '<span class="ac">' + esc(v) + '</span>' : '<span class="muted">Brouillon</span>'; } }, { k: 'client', label: 'Client', val: function (r) { return tname(r.tiersId); } }, { k: 'date', label: 'Date', fmt: App.date }, { k: 'due', label: 'Échéance', fmt: function (v, r) { return r.type === 'AV' ? '—' : App.date(v); } },
        { k: 'ttc', label: 'Total TTC', num: true, val: function (r) { return Y.docTotals(S(), cid(), r).ttc; }, fmt: function (v) { return U.fmt(v); } },
        { k: 'rest', label: 'Reste dû', num: true, val: function (r) { return r.type === 'FA' && r.status !== 'draft' ? Y.docTotals(S(), cid(), r).ttc - Y.docPaid(r) : 0; }, fmt: function (v) { return v ? '<b>' + U.fmt(v) + '</b>' : '—'; } },
        { k: 'st', label: 'Statut', val: function (r) { return Y.docStatus(S(), cid(), r).label; }, fmt: function (v, r) { var s = Y.docStatus(S(), cid(), r); return App.chip(s.label, s.tone, true); } },
        { k: 'entryNum', label: 'Écriture', fmt: function (v) { return v ? '<span class="ac muted">' + esc(v) + '</span>' : ''; } }] }) + '</div>';
  }
  App.pages.ventes = {
    render: function () {
      var dd = App.D(), id = App.v('docId', null);
      var h = '<div class="page">' + App.head('Comptabilité · Ventes', 'Ventes <span class="serif">&amp; factures</span>', 'Numérotation chronologique sans rupture, mentions légales, paiement par MTN MoMo ou Orange Money, écriture 411 / 70 / 443 générée à l’émission.',
        '<button type="button" class="btn" data-act="doc-new" data-type="DV"' + App.dis('invoice') + '>' + App.ic('plus') + 'Devis</button><button type="button" class="btn acc" data-act="doc-new" data-type="FA"' + App.dis('invoice') + '>' + App.ic('plus') + 'Facture</button>');
      if (id === 'edit' && App.ui.v.docEd) return h + editorHtml() + '</div>' + '';
      if (id && id !== 'edit') { var x = Y.doc(S(), cid(), id); if (x) return h + viewHtml(x) + '</div>'; }
      var fa = dd.docs.filter(function (x) { return x.type === 'FA' && x.status !== 'draft'; });
      var y = U.year(App.today()), mm = U.month(App.today());
      var mFa = fa.filter(function (x) { return U.year(x.date) === y && U.month(x.date) === mm; });
      var late = fa.filter(function (x) { return Y.docStatus(S(), cid(), x).key === 'late'; });
      var pays = []; fa.forEach(function (x) { x.payments.forEach(function (p) { if (U.year(p.date) === y && U.month(p.date) === mm) pays.push(p); }); });
      var mm_ = U.sum(pays.filter(function (p) { return p.method === 'momo' || p.method === 'om'; }), function (p) { return p.amount; }), enc = U.sum(pays, function (p) { return p.amount; });
      h += '<div class="grid g4"><div class="card kpi"><span class="lbl">Facturé · ' + U.MONTHS[mm - 1] + ' (TTC)</span><span class="val"><span data-count="' + U.sum(mFa, function (x) { return Y.docTotals(S(), cid(), x).ttc; }) + '">0</span></span><span class="delta">' + mFa.length + ' facture(s)</span></div>' +
        '<div class="card kpi"><span class="lbl">Encaissé · ' + U.MONTHS[mm - 1] + '</span><span class="val"><span data-count="' + enc + '">0</span></span><span class="delta">dont ' + (enc ? Math.round(mm_ / enc * 100) : 0) + ' % par Mobile Money</span></div>' +
        '<div class="card kpi"><span class="lbl">En retard</span><span class="val neg"><span data-count="' + U.sum(late, function (x) { return Y.docTotals(S(), cid(), x).ttc - Y.docPaid(x); }) + '">0</span></span><span class="delta">' + late.length + ' facture(s) à relancer</span></div>' +
        '<div class="card kpi"><span class="lbl">Devis en attente</span><span class="val"><span data-count="' + U.sum(dd.docs.filter(function (x) { return x.type === 'DV' && x.status === 'sent'; }), function (x) { return Y.docTotals(S(), cid(), x).ttc; }) + '">0</span></span><span class="delta">' + dd.docs.filter(function (x) { return x.type === 'DV' && x.status === 'sent'; }).length + ' devis envoyés</span></div></div>';
      var tab = App.tab('ventes', 'factures');
      h += App.tabs('ventes', [['factures', 'Factures', fa.length], ['devis', 'Devis', dd.docs.filter(function (x) { return x.type === 'DV'; }).length], ['avoirs', 'Avoirs', dd.docs.filter(function (x) { return x.type === 'AV'; }).length], ['encaissements', 'Encaissements'], ['relances', 'Relances', late.length], ['articles', 'Articles et tarifs', dd.items.length]], 'factures');
      if (tab === 'factures') h += docTable('FA');
      if (tab === 'devis') h += docTable('DV');
      if (tab === 'avoirs') h += '<div class="callout info">' + App.ic('undo') + '<span>Un avoir annule tout ou partie d’une facture émise : il génère l’écriture inverse (70 et 443 au débit, 411 au crédit) et s’impute sur la facture d’origine. Créez-le depuis la facture concernée.</span></div>' + docTable('AV');
      if (tab === 'encaissements') {
        var rows = []; fa.forEach(function (x) { x.payments.forEach(function (p) { rows.push(Object.assign({ doc: x.num, docId: x.id, client: tname(x.tiersId) }, p)); }); });
        rows.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
        h += '<div class="card flush">' + App.table('pays', { exportName: 'encaissements', rows: rows, rowAct: 'doc-open', rowId: function (r) { return r.docId; },
          cols: [{ k: 'date', label: 'Date', fmt: App.date }, { k: 'client', label: 'Client' }, { k: 'doc', label: 'Facture', fmt: function (v) { return '<span class="ac">' + esc(v) + '</span>'; } }, { k: 'method', label: 'Moyen', val: function (r) { return (Y.PAY_METHODS[r.method] || { label: r.method === 'avoir' ? 'Avoir' : r.method }).label; }, fmt: function (v, r) { return App.chip(v, r.method === 'momo' ? 'warn' : (r.method === 'om' ? 'brand' : 'info')); } },
            { k: 'extRef', label: 'Référence', fmt: function (v, r) { return '<span class="mono">' + esc(v || r.ref || '') + '</span>'; } }, { k: 'fees', label: 'Frais', num: true, fmt: App.m0 }, { k: 'amount', label: 'Montant', num: true, fmt: function (v) { return U.fmt(v); } }] }) + '</div>';
      }
      if (tab === 'relances') {
        var lr = late.map(function (x) { var t = Y.docTotals(S(), cid(), x); return { id: x.id, num: x.num, client: tname(x.tiersId), due: x.due, days: U.daysBetween(x.due, App.today()), rest: t.ttc - Y.docPaid(x), n: (x.reminders || []).length, last: (x.reminders || []).slice(-1)[0] }; }).sort(function (a, b) { return b.days - a.days; });
        h += '<div class="card flush">' + App.table('relances', { exportName: 'relances', rows: lr, select: true, toolbar: '<button type="button" class="btn sm acc" data-act="remind-bulk">Marquer la sélection comme relancée</button>',
          cols: [{ k: 'num', label: 'Facture', fmt: function (v) { return '<span class="ac">' + esc(v) + '</span>'; } }, { k: 'client', label: 'Client' }, { k: 'due', label: 'Échéance', fmt: App.date }, { k: 'days', label: 'Retard', num: true, fmt: function (v) { return v + ' j'; } }, { k: 'rest', label: 'Reste dû', num: true, fmt: function (v) { return '<b>' + U.fmt(v) + '</b>'; } },
            { k: 'lvl', label: 'Niveau', val: function (r) { return r.days > 45 ? 3 : (r.days > 15 ? 2 : 1); }, fmt: function (v) { return App.chip(v === 3 ? 'Mise en demeure' : (v === 2 ? 'Relance 2' : 'Rappel amical'), v === 3 ? 'bad' : (v === 2 ? 'warn' : '')); } },
            { k: 'n', label: 'Relances', num: true, fmt: function (v, r) { return v ? v + ' · ' + App.date(r.last.date) : '0'; } }],
          rowActions: function (r) { return '<button type="button" class="btn xs" data-act="remind-copy" data-id="' + r.id + '">' + App.ic('copy') + 'Copier</button> <button type="button" class="btn xs" data-act="remind-done" data-id="' + r.id + '">Relancée</button> <button type="button" class="btn xs" data-act="doc-open" data-id="' + r.id + '">Ouvrir</button>'; } }) + '</div>';
      }
      if (tab === 'articles') h += '<div class="card flush">' + App.table('items', { exportName: 'articles', rows: dd.items, rowAct: 'item-edit', rowId: function (r) { return r.code; }, toolbar: '<button type="button" class="btn sm acc" data-act="item-new"' + App.dis('invoice') + '>' + App.ic('plus') + 'Article</button>',
        cols: [{ k: 'code', label: 'Code', fmt: function (v) { return '<span class="ac">' + esc(v) + '</span>'; } }, { k: 'label', label: 'Désignation' }, { k: 'unit', label: 'Unité' }, { k: 'price', label: 'Prix HT', num: true, fmt: function (v) { return U.fmt(v); } }, { k: 'taxCode', label: 'TVA' }, { k: 'account', label: 'Compte', fmt: function (v) { return '<span class="ac">' + esc(v) + '</span>'; } }, { k: 'section', label: 'Section' }] }) + '</div>';
      return h + '</div>';
    }
  };
})();

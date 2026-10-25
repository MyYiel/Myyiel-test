/* Module 4 · composants partagés : icônes, avatars de tiers, listes de contrôles, aperçu de facture en 8 zones, page de paiement client simulée, tiroir facture (cycle de vie). */
(function () {
  'use strict';
  var Y = window.Yiel, U = Y.util, App = window.App, esc = App.esc, A = App.actions;
  var F = Y.Fin;
  function S() { return App.S; } function cid() { return App.cid(); }
  Object.assign(App.ICONS, {
    inbox: 'M3 13h5l1.5 3h5L16 13h5M5 5h14l2 8v6H3v-6z', wallet: 'M4 7h15v12H4zM4 7l12-3v3M15 13h2', scan: 'M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M7 12h10',
    receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3', forecast: 'M3 20h18M5 16l4-5 4 3 6-8M15 6h4v4', fraud: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4',
    flag: 'M5 21V4M5 4h11l-2 4 2 4H5', call: 'M6 3h3l2 5-2 1a11 11 0 006 6l1-2 5 2v3a2 2 0 01-2 2A17 17 0 014 5a2 2 0 012-2z', bc: 'M6 3h9l4 4v14H6zM9 9h6M9 13h6M9 17h4',
    tresor: 'M3 20h18M5 16l4-5 4 3 6-8', 'fin-factu': 'M6 3h9l4 4v14H6zM9 12h6M9 16h6M9 8h3', 'fin-encaiss': 'M4 7h15v12H4zM4 7l12-3v3M15 13h2', 'fin-inbox': 'M3 13h5l1.5 3h5L16 13h5M5 5h14l2 8v6H3v-6z',
    'fin-pay': 'M3 7h18v10H3zM3 11h18M7 15h3', 'fin-tiers': 'M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2 20c.8-3.5 3.5-5 7-5s6.2 1.5 7 5M16 4.5a3.5 3.5 0 010 6.5M18 15c2 .6 3.4 2.2 4 5',
    'fin-rappro': 'M4 8h13l-3-3M20 16H7l3 3', 'fin-fraude': 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM12 8v5M12 16h.01', 'fin-param': 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4', 'fin-relances': 'M12 3a6 6 0 016 6v4l2 3H4l2-3V9a6 6 0 016-6zM10 19a2 2 0 004 0'
  });
  App.F = F;
  App.fkpi = function (l, v, d, tone) { return '<div class="kpi ' + (tone ? 'k-' + tone : '') + '"><span class="lbl">' + esc(l) + '</span><span class="val">' + v + '</span><span class="delta">' + esc(d || '') + '</span></div>'; };
  App.tAva = function (t, big) { var n = (F.profile(t).tradeName || t.name || '?').replace(/\b(SARL|SA|SAS|SCS|GIE|ETS|Ets)\b/g, '').trim(), ini = n.split(/\s+/).filter(function (w) { return w.length > 1; }).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase(), hue = parseInt(U.fnv(t.code || t.name).slice(0, 3), 16) % 360; return '<span class="t-ava' + (big ? ' big' : '') + '" style="--h:' + hue + '" aria-hidden="true">' + esc(ini || '?') + '</span>'; };
  App.stars = function (r) { if (r == null) return '<span class="muted" style="font-size:12px">Non évalué</span>'; var h = '<span class="stars" aria-label="' + r + ' sur 5">'; for (var i = 1; i <= 5; i++) h += '<i class="' + (r >= i - 0.25 ? 'on' : (r >= i - 0.75 ? 'half' : '')) + '">★</i>'; return h + ' <b>' + String(r).replace('.', ',') + '</b></span>'; };
  App.checks = function (list) { return '<ul class="ck-list">' + (list || []).map(function (c) { return '<li class="' + c.level + '">' + App.ic(c.level === 'ok' ? 'check' : (c.level === 'bad' ? 'x' : 'alert')) + '<span>' + esc(c.text) + '</span></li>'; }).join('') + '</ul>'; };
  App.riskChip = function (s) { var tone = s >= 70 ? 'bad' : (s >= 40 ? 'warn' : 'ok'); return '<span class="risk ' + tone + '" title="Score de risque sur 100">' + s + '</span>'; };
  App.masked = function (v) { v = String(v || ''); var dg = v.replace(/\D/g, ''); if (!dg) return esc(v); return '••• ' + esc(dg.slice(-4)); };
  App.canSee = function () { return App.can('fin.vendor') || App.can('fin.verify'); };
  App.provStatus = { sandbox: ['Bac à sable · démonstration', 'info'], production: ['Connecté (production)', 'ok'], import: ['Import contrôlé de relevés', 'warn'], indisponible: ['Indisponible · non proposé', ''] };
  App.qrFill = function () { document.querySelectorAll('[data-qr]').forEach(function (b) { if (b.dataset.done) return; b.dataset.done = 1; if (window.QRCode) { try { new window.QRCode(b, { text: b.dataset.qr, width: +b.dataset.size || 84, height: +b.dataset.size || 84, correctLevel: window.QRCode.CorrectLevel.M }); return; } catch (e) { /* repli */ } } b.innerHTML = '<span class="qr-ph" title="' + esc(b.dataset.qr) + '">' + App.ic('qr') + '<small>QR</small></span>'; }); };
  App.fxLater = function () { setTimeout(App.qrFill, 40); };

  /* ------------------------------------------------- aperçu de facture en 8 zones */
  App.invPaper = function (doc, o) {
    o = o || {}; var co = Y.company(S(), cid()) || {}, t = Y.tiers(S(), cid(), doc.tiersId) || { name: 'Client', city: '' }, tot = Y.docTotals(S(), cid(), doc), paid = Y.docPaid(doc), tpls = F.templates(S(), cid());
    var tpl = o.tpl || tpls.find(function (x) { return x.id === F.meta(S(), cid(), doc.id).template; }) || tpls.find(function (x) { return x.default; }) || tpls[0];
    var link = doc.id ? F.linkFor(S(), cid(), doc.id) : null, z = function (k, inner, cls) { var zz = F.ZONES.find(function (x) { return x.k === k; }); return '<div class="iz iz-' + k + (cls ? ' ' + cls : '') + '">' + (o.zones ? '<span class="iz-n" title="' + esc(zz.label + (zz.locked ? ' · zone fiscale verrouillée' : ' · zone personnalisable')) + '">' + zz.n + (zz.locked ? App.ic('lock') : '') + '</span>' : '') + inner + '</div>'; };
    var real = function (v, ph) { return v && !/\[.*\]/.test(v) ? esc(v) : '<span class="iz-miss">' + esc(ph) + '</span>'; };
    var title = { FA: 'FACTURE', AV: 'AVOIR', DV: 'DEVIS' }[doc.type] || 'FACTURE';
    var h = '<div class="paper-inv st-' + esc(tpl.style || 'classique') + '" style="--ic:' + esc(tpl.color || '#141A3A') + ';--ia:' + esc(tpl.accent || '#F25C2A') + '">';
    h += '<div class="iv-top">' + z('issuer', '<div class="iv-logo">' + esc((co.name || 'Y')[0]) + '</div><div><b>' + esc(co.name || '') + '</b><small>' + esc(co.legalForm || '') + (co.capital ? ' · capital ' + U.fmt(co.capital) + ' XAF' : '') + '<br>NIU ' + real(co.niu, 'NIU à renseigner') + ' · RCCM ' + real(co.rccm, 'RCCM à renseigner') + '<br>' + real(co.address, 'Adresse à renseigner') + (co.city ? ', ' + esc(co.city) : '') + (co.phone ? ' · ' + esc(co.phone) : '') + '</small></div>') +
      z('ref', '<div class="iv-title">' + title + '</div><div class="kv sm"><span>N°</span><b class="mono">' + esc(doc.num || 'BROUILLON') + '</b><span>Date</span><b>' + App.date(doc.date) + '</b><span>Échéance</span><b>' + App.date(doc.due) + '</b>' + (doc.ref ? '<span>Réf. client</span><b>' + esc(doc.ref) + '</b>' : '') + '</div>') + '</div>';
    h += z('client', '<small class="muted">Facturé à</small><b>' + esc(t.name) + '</b><small>' + esc([t.address, t.city].filter(Boolean).join(', ')) + (t.niu ? '<br>NIU ' + esc(t.niu) : '') + '</small>');
    var groups = !!(tpl.zones && tpl.zones.groups);
    h += z('lines', '<table class="iv-t"><thead><tr><th>Désignation</th><th class="num">Qté</th><th class="num">PU HT</th><th class="num">Rem.</th><th class="num">TVA</th><th class="num">Montant HT</th></tr></thead><tbody>' + (o.zones || groups ? '<tr class="iv-g' + (groups ? '' : ' off') + '"><td colspan="6">' + (o.zones ? '<span class="iz-n s">5</span>' : '') + 'Lot 1 · Prestations' + (groups ? '' : ' <small>(zone facultative désactivée)</small>') + '</td></tr>' : '') +
      (doc.lines || []).map(function (l) { var b = U.round((+l.qty || 0) * (+l.price || 0)), r = U.round(b * (+l.discount || 0) / 100); return '<tr><td>' + esc(l.label) + '</td><td class="num">' + esc(String(l.qty).replace('.', ',')) + '</td><td class="num">' + U.fmt(l.price) + '</td><td class="num">' + (l.discount ? l.discount + ' %' : '') + '</td><td class="num">' + esc(l.taxCode === 'TVA19' ? '19,25 %' : (l.taxCode || '')) + '</td><td class="num">' + U.fmt(b - r) + '</td></tr>'; }).join('') + '</tbody></table>');
    h += '<div class="iv-bottom">' + z('pay', '<div class="iv-pay"><div><b>Paiement</b><small>' + [doc.pay && doc.pay.momo ? 'MTN MoMo' : '', doc.pay && doc.pay.om ? 'Orange Money' : '', doc.pay && doc.pay.bank ? 'Virement' : ''].filter(Boolean).join(' · ') + (link ? '<br><span class="mono">' + esc(link.url.replace('https://', '')) + '</span><br>Code ' + esc(link.code) : '<br>Lien créé à l’envoi') + '</small></div>' + (tpl.showQr !== false && link ? '<span class="iv-qr" data-qr="' + esc(link.url) + '" data-size="64"></span>' : '') + '</div>') +
      z('totals', '<div class="kv sm iv-tot"><span>Total HT</span><b class="num">' + U.fmt(tot.ht) + '</b>' + Object.keys(tot.byTax).filter(function (k) { return tot.byTax[k].tax; }).map(function (k) { return '<span>' + esc(k === 'TVA19' ? 'TVA 19,25 % (dont CAC)' : k) + '</span><b class="num">' + U.fmt(tot.byTax[k].tax) + '</b>'; }).join('') + '<span>Total TTC</span><b class="num">' + U.fmt(tot.ttc) + '</b>' + (paid ? '<span>Déjà réglé</span><b class="num">− ' + U.fmt(paid) + '</b>' : '') + '<span class="iv-net">Net à payer</span><b class="num iv-net">' + U.fmt(tot.ttc - paid) + ' XAF</b></div>') + '</div>';
    var set = F.D(S(), cid()).settings.compliance;
    h += z('legal', '<small>' + esc(tpl.footer || '') + ' ' + (set.mode === 'fiscale' && set.homologation ? 'Facture émise par une solution certifiée · n° ' + esc(set.homologation) + '.' : 'Facture commerciale · certification fiscale électronique non activée (homologation de la solution à confirmer).') + (F.meta(S(), cid(), doc.id || 'x').hash ? ' Empreinte ' + esc(F.meta(S(), cid(), doc.id).hash.slice(0, 12)) + '…' : '') + '</small>');
    return h + '</div>';
  };

  /* --------------------------------------------- page de paiement client (simulée) */
  App.payPage = function (doc, link) {
    var st = App.ui.v.paySim || {}, co = Y.company(S(), cid()), rest = Y.docTotals(S(), cid(), doc).ttc - Y.docPaid(doc), tx = st.txId ? F.D(S(), cid()).txs.find(function (x) { return x.id === st.txId; }) : null;
    var mlist = link.methods, method = st.method || mlist[0], prov = F.D(S(), cid()).settings.providers;
    var h = '<div class="pp"><div class="pp-head"><span class="iv-logo sm">' + esc((co.name || 'Y')[0]) + '</span><span><b>' + esc(co.name) + '</b><small>pay.myyiel.com · lien vérifié ' + App.ic('lock') + '</small></span></div>';
    h += '<div class="pp-card"><small>Facture ' + esc(doc.num) + ' · échéance ' + App.date(doc.due) + '</small><div class="pp-amt">' + U.fmt(tx ? tx.amount : (st.amount || rest)) + ' <small>XAF</small></div><small>Reste dû ' + U.fmt(rest) + ' XAF · code de vérification <b class="mono">' + esc(link.code) + '</b></small></div>';
    if (!tx || tx.status === 'echouee' || tx.status === 'rejetee') {
      if (tx && tx.status === 'echouee') h += '<div class="callout sm" style="background:var(--bad-bg);color:var(--bad)">Paiement refusé par l’opérateur. Vous pouvez réessayer.</div>';
      h += '<div class="pp-lbl">Moyen de paiement</div><div class="pp-methods">' + Object.keys(F.METHODS).map(function (k) { var on = mlist.indexOf(k) > -1, p = prov[F.METHODS[k].provider]; return '<button type="button" class="pp-m' + (method === k ? ' on' : '') + '"' + (on ? ' data-act="pp-method" data-m="' + k + '"' : ' disabled') + '><span class="pp-mi m-' + k + '">' + esc({ momo: 'MoMo', om: 'OM', bank: 'VIR', card: 'CB' }[k]) + '</span><span>' + esc(F.METHODS[k].label) + '<small>' + esc(on ? (p.status === 'import' ? 'confirmation par relevé' : 'confirmation instantanée') : (p && p.status === 'indisponible' ? 'bientôt disponible' : 'non proposé')) + '</small></span></button>'; }).join('') + '</div>';
      if (method === 'momo' || method === 'om') h += '<label class="fld"><span>Numéro ' + esc(F.METHODS[method].label) + '</span><input class="in mono" id="pp_phone" value="' + esc(st.phone || '+237 6 ') + '" inputmode="tel"></label>';
      else h += '<div class="callout sm info">Virement : utilisez la référence <b class="mono">' + esc(doc.num) + '</b>. La facture passe « payée » quand le virement apparaît sur le relevé importé, jamais sur la base d’une capture.</div>';
      if (F.D(S(), cid()).settings.allowPartial) h += '<label class="fld"><span>Montant (paiement partiel possible)</span><input class="in num" id="pp_amount" value="' + U.fmt(st.amount || rest) + '" inputmode="decimal"></label>';
      h += '<button type="button" class="btn acc pp-go" data-act="pp-init" data-doc="' + doc.id + '">' + App.ic('lock') + 'Initier le paiement</button><small class="pp-safe">Vous recevrez une demande de validation sur votre téléphone (code secret). ' + esc(co.name) + ' ne vous demandera jamais de payer sur un numéro personnel.</small>';
    } else if (tx.status === 'en_attente') {
      h += '<div class="pp-wait"><span class="spin"></span><b>Validez la demande sur votre téléphone</b><small>' + esc(F.METHODS[tx.method].label) + ' · ' + esc(tx.phone) + ' · réf. ' + esc(tx.providerRef) + '</small><small>La facture ne sera marquée payée qu’à réception de la confirmation signée de l’opérateur.</small></div>';
    } else if (tx.status === 'confirmee') {
      h += '<div class="pp-ok">' + App.ic('check') + '<b>Paiement confirmé</b><small>Reçu ' + esc(tx.ref) + ' · ' + U.fmt(tx.amount) + ' XAF · réf. opérateur ' + esc(tx.providerRef) + '</small><small>Écriture ' + esc(tx.entry) + ' générée automatiquement.</small></div>';
    } else h += '<div class="callout sm warn">' + esc(F.TX_STATUS[tx.status][0]) + '</div>';
    return h + '</div>';
  };
  A['pp-method'] = function (el) { var v = App.ui.v.paySim; v.method = el.dataset.m; A['pay-sim-draw'](); };
  A['pp-init'] = function (el) {
    var v = App.ui.v.paySim, doc = Y.doc(S(), cid(), el.dataset.doc), l = F.linkFor(S(), cid(), doc.id), ph = document.getElementById('pp_phone'), am = document.getElementById('pp_amount');
    v.phone = ph ? ph.value : ''; v.amount = am ? U.parseAmount(am.value) : 0; v.method = v.method || l.methods[0];
    var r = App.run(function () { return F.initiate(S(), cid(), l.token, { method: v.method, phone: v.phone, amount: v.amount }); });
    if (r) { v.txId = r.id; A['pay-sim-draw'](); }
  };
  A['pay-sim'] = function (el) {
    var doc = Y.doc(S(), cid(), el.dataset.id); if (!doc) return;
    var l = F.linkFor(S(), cid(), doc.id); if (!l) { App.toast('Envoyez d’abord la facture : le lien de paiement est créé à l’envoi.', 'bad'); return; }
    App.run(function () { F.view(S(), cid(), l.token); });
    App.ui.v.paySim = { docId: doc.id, method: l.methods[0] }; A['pay-sim-draw']();
  };
  A['pay-sim-draw'] = function () {
    var v = App.ui.v.paySim, doc = Y.doc(S(), cid(), v.docId), l = F.linkFor(S(), cid(), doc.id) || F.D(S(), cid()).links.find(function (x) { return x.docId === doc.id; }), tx = v.txId ? F.D(S(), cid()).txs.find(function (x) { return x.id === v.txId; }) : null;
    var t = Y.tiers(S(), cid(), doc.tiersId), msg = F.message(S(), cid(), doc, l);
    var phone = App.phone(Y.company(S(), cid()).name, 'Compte professionnel vérifié', App.bubble(esc(msg).replace(/\n/g, '<br>'), '09:12') + '<div class="ph-page">' + App.payPage(doc, l) + '</div>');
    var side = '<div class="card"><b>Côté prestataire (démonstration)</b><p class="muted" style="font-size:12.5px;margin:6px 0 10px">En production, l’opérateur appelle myyiel avec une notification signée. Ici, vous jouez le rôle de l’opérateur pour voir les trois cas.</p>' +
      (tx && tx.status === 'en_attente' ? '<div class="actions" style="flex-direction:column;align-items:stretch"><button type="button" class="btn acc" data-act="pp-provider" data-o="ok">' + App.ic('check') + 'Confirmation signée</button><button type="button" class="btn" data-act="pp-provider" data-o="fail">' + App.ic('x') + 'Échec (solde insuffisant)</button><button type="button" class="btn danger" data-act="pp-provider" data-o="forged">' + App.ic('fraud') + 'Fausse notification (signature invalide)</button></div>' : '<p class="muted" style="font-size:12.5px">Initiez un paiement sur le téléphone pour activer ces boutons.</p>') +
      (tx ? '<h3 class="h3" style="margin-top:14px">Journal de la transaction ' + esc(tx.ref) + '</h3><ul class="timeline">' + [{ at: tx.at, text: 'Initiée · ' + U.fmt(tx.amount) + ' XAF' }].concat(tx.events).map(function (e) { return '<li class="' + (/rejet|Échec|falsif/i.test(e.text) ? 'alert' : 'done') + '"><b>' + esc(e.text) + '</b><span>' + App.timeLabel(e.at) + '</span></li>'; }).join('') + '</ul>' : '') + '</div>' +
      '<div class="card tip">' + App.ic('shield') + '<div><b>Pourquoi une capture d’écran ne suffit pas</b><span>Les faux SMS « Vous avez reçu… » se fabriquent en une minute. Seule la confirmation signée de l’opérateur ou la ligne du relevé fait passer la facture à « payée ».</span></div></div>';
    App.drawer({ title: 'Page de paiement · ' + doc.num, sub: 'Ce que voit ' + t.name + ' après avoir ouvert le lien WhatsApp', wide: true, noFocus: true, body: '<div class="pp-sim">' + phone + '<div class="pp-side">' + side + '</div></div>', foot: '<button type="button" class="btn" data-act="fx-doc" data-id="' + doc.id + '">Retour à la facture</button><button type="button" class="btn" data-act="close-drawer">Fermer</button>' });
  };
  A['pp-provider'] = function (el) {
    var v = App.ui.v.paySim; try { F.simulateProvider(S(), cid(), v.txId, el.dataset.o); App.toast(el.dataset.o === 'ok' ? 'Notification signée reçue : paiement enregistré et écriture générée.' : 'Paiement refusé par l’opérateur.', el.dataset.o === 'ok' ? 'ok' : 'bad'); }
    catch (e) { if (e instanceof Y.BizError) App.toast(e.messages[0] + ' Aucun encaissement enregistré.', 'bad'); else throw e; }
    App.persist(); App.render(); A['pay-sim-draw']();
  };

  /* ------------------------------------------------------ tiroir facture : cycle de vie */
  A['fx-doc'] = function (el) {
    var doc = Y.doc(S(), cid(), el.dataset.id); if (!doc) return;
    var t = Y.tiers(S(), cid(), doc.tiersId), m = F.meta(S(), cid(), doc.id), mc = F.checkMentions(S(), cid(), doc), st = Y.docStatus(S(), cid(), doc), stage = F.stage(S(), cid(), doc), l = F.linkFor(S(), cid(), doc.id), rest = Y.docTotals(S(), cid(), doc).ttc - Y.docPaid(doc), seal = F.verifySeal(S(), cid(), doc);
    var si = F.STAGES.map(function (s) { return s[0]; }).indexOf(stage);
    var flow = '<div class="flow">' + F.STAGES.map(function (s, i) { return '<span class="' + (i < si || stage === 'payee' ? 'done' : (i === si ? 'here' : '')) + '"><i>' + (i + 1) + '</i>' + esc(s[1]) + '</span>'; }).join('') + '</div>';
    var ev = [{ type: 'emise', text: 'Facture émise · ' + (doc.entryId ? 'écriture de vente générée' : ''), at: doc.emittedAt || doc.createdAt }].concat(m.events).concat((doc.payments || []).map(function (p) { return { type: 'payee', text: 'Règlement ' + U.fmt(p.amount) + ' (' + ((Y.PAY_METHODS[p.method] || {}).label || p.method) + ') · ' + (p.ref || ''), at: p.date + 'T12:00:00' }; })).sort(function (a, b) { return (a.at || '') < (b.at || '') ? -1 : 1; });
    var txs = F.D(S(), cid()).txs.filter(function (x) { return x.docId === doc.id; }), proofs = F.D(S(), cid()).proofs.filter(function (x) { return x.docId === doc.id; });
    var body = flow + '<div class="row" style="margin-top:12px"><div class="grow">' + App.invPaper(doc) + '</div><div class="side">' +
      '<div class="card"><div class="kv sm"><span>Statut</span><b>' + App.chip(st.label, st.tone, true) + '</b><span>Niveau</span><b>' + App.chip(F.LEVELS[mc.level][0], F.LEVELS[mc.level][1]) + '</b><span>Reste dû</span><b class="num">' + U.fmt(rest) + '</b><span>Archivage</span><b>' + (seal === null ? '<span class="muted">Scellée à l’envoi</span>' : (seal ? App.chip('Empreinte intacte', 'ok') : App.chip('Document modifié après envoi', 'bad'))) + '</b>' + (l ? '<span>Lien</span><b class="mono" style="font-size:11.5px;word-break:break-all">' + esc(l.url.replace('https://', '')) + '</b><span>Consultations</span><b>' + l.views + '</b>' : '') + '</div></div>' +
      (mc.missing.length ? '<div class="card"><b>Mentions</b>' + App.checks(mc.missing.map(function (x) { return { level: x.blocking ? 'bad' : 'warn', text: x.label + ' · ' + x.detail }; })) + (mc.missing.some(function (x) { return /issuer_/.test(x.k); }) && App.can('settings') ? '<button type="button" class="btn sm" data-act="fx-company" style="margin-top:8px">Compléter NIU et RCCM</button>' : '') + '</div>' : '') +
      '<div class="card"><b>Chronologie</b><ul class="timeline" style="margin-top:10px">' + ev.map(function (e) { return '<li class="' + (/echec|justificatif/.test(e.type) && /rejet|Faux|Suspect|échou/i.test(e.text) ? 'alert' : 'done') + '"><b>' + esc(e.text) + '</b><span>' + App.timeLabel(e.at) + (e.by ? ' · ' + esc(e.by) : '') + '</span></li>'; }).join('') + '</ul></div>' +
      (txs.length ? '<div class="card"><b>Paiements en ligne</b><div class="list">' + txs.map(function (x) { return '<div><span class="grow"><b class="mono" style="font-size:12px">' + esc(x.ref) + '</b> <small class="muted">' + esc(F.METHODS[x.method].label) + '</small></span><span class="num">' + U.fmt(x.amount) + '</span>' + App.statusChip(F.TX_STATUS, x.status) + '</div>'; }).join('') + '</div></div>' : '') +
      (proofs.length ? '<div class="card"><b>Justificatifs déclarés</b><div class="list">' + proofs.map(function (x) { return '<div><span class="grow mono" style="font-size:12px">' + esc(x.ref || '—') + '</span><span class="num">' + U.fmt(x.amount) + '</span>' + App.statusChip(F.PROOF_STATUS, x.status) + '</div>'; }).join('') + '</div></div>' : '') + '</div></div>';
    var can = App.can('invoice'), canC = App.can('fin.collect'), foot = '';
    if (doc.type === 'FA' && st.key !== 'paid') {
      if (can) foot += '<button type="button" class="btn acc" data-act="fx-send" data-id="' + doc.id + '">' + App.ic('chat') + (m.sent.length ? 'Renvoyer' : 'Envoyer par WhatsApp / e-mail') + '</button>';
      if (l) foot += '<button type="button" class="btn" data-act="pay-sim" data-id="' + doc.id + '">' + App.ic('phone') + 'Voir la page de paiement</button>';
      if (canC) foot += '<button type="button" class="btn" data-act="fx-proof" data-id="' + doc.id + '">' + App.ic('receipt') + 'Le client dit avoir payé</button><button type="button" class="btn" data-act="fx-promise" data-id="' + doc.id + '">Promesse</button>';
    }
    if (doc.type === 'FA' && can) foot += '<button type="button" class="btn" data-act="fx-cancel" data-id="' + doc.id + '">Annuler par avoir</button>';
    foot += '<button type="button" class="btn" data-act="doc-pdf" data-id="' + doc.id + '">' + App.ic('pdf') + 'PDF</button><button type="button" class="btn" data-act="close-drawer">Fermer</button>';
    App.drawer({ title: (doc.type === 'AV' ? 'Avoir ' : 'Facture ') + (doc.num || ''), sub: t.name + ' · ' + U.fmt(Y.docTotals(S(), cid(), doc).ttc) + ' XAF TTC', wide: true, noFocus: true, body: body, foot: foot });
    App.fxLater();
  };
  A['fx-company'] = function () {
    var co = Y.company(S(), cid());
    App.form({ title: 'Mentions de l’émetteur', intro: 'Ces mentions apparaissent dans la zone 3 (verrouillée) de chaque facture. Sans elles, l’envoi est bloqué.', fields: [{ k: 'niu', label: 'NIU (numéro d’identifiant unique)', req: true, val: /\[/.test(co.niu || '') ? '' : co.niu, mono: true, ph: 'M0XXXXXXXXXXXX' }, { k: 'rccm', label: 'RCCM', req: true, val: /\[/.test(co.rccm || '') ? '' : co.rccm, mono: true, ph: 'RC/DLA/2020/B/0000' }, { k: 'legalForm', label: 'Forme juridique', val: co.legalForm }, { k: 'address', label: 'Adresse', val: co.address }],
      onSubmit: function (v) { if (!/^[A-Z0-9]{8,20}$/i.test(v.niu)) throw new Y.BizError('NIU invalide : 8 à 20 caractères alphanumériques.'); Object.assign(co, { niu: v.niu.toUpperCase(), rccm: v.rccm, legalForm: v.legalForm || co.legalForm, address: v.address || co.address }); Y.audit(S(), cid(), 'Société · mentions légales', co.name, 'NIU / RCCM'); }, done: 'Mentions enregistrées : les factures peuvent être envoyées.' });
  };
  A['fx-send'] = function (el) {
    var doc = Y.doc(S(), cid(), el.dataset.id), t = Y.tiers(S(), cid(), doc.tiersId), c = F.profile(t).contacts[0] || {};
    App.confirm({ title: 'Envoyer ' + doc.num, body: '<p style="font-size:13px">Le client reçoit un message court avec le lien sécurisé : il consulte la facture, choisit MoMo, Orange Money ou virement et obtient son reçu. La facture est scellée (empreinte) à l’envoi.</p>', fields: [{ k: 'wa', label: 'WhatsApp · ' + (c.whatsapp || t.phone || 'numéro absent'), type: 'check', val: true }, { k: 'mail', label: 'E-mail · ' + (c.email || t.email || 'adresse absente'), type: 'check', val: !!(c.email || t.email) }], ok: 'Envoyer' }).then(function (v) {
      if (!v) return; var ch = []; if (v.wa) ch.push('whatsapp'); if (v.mail) ch.push('email'); if (!ch.length) { App.toast('Choisissez au moins un canal.', 'bad'); return; }
      var r = App.run(function () { return F.send(S(), cid(), doc.id, ch); }, 'Facture envoyée avec son lien de paiement.');
      if (r) App.drawer({ title: 'Message envoyé', sub: doc.num + ' · ' + t.name, noFocus: true, body: App.phone(t.name, c.whatsapp || t.phone || '', App.bubble(esc(r.message).replace(/\n/g, '<br>'), new Date().toTimeString().slice(0, 5), true)) + '<div class="callout sm info" style="margin-top:12px">Simulation : en production, le message part depuis le compte WhatsApp Business connecté (API officielle) ou par e-mail. Sans connexion WhatsApp, myyiel prépare le message à copier.</div>', foot: '<button type="button" class="btn" data-act="fx-copy" data-t="' + esc(r.message) + '">' + App.ic('copy') + 'Copier le message</button><button type="button" class="btn acc" data-act="pay-sim" data-id="' + doc.id + '">Ouvrir comme le client</button>' });
    });
  };
  A['fx-copy'] = function (el) { App.copy(el.dataset.t, 'Copié.'); };
  A['fx-cancel'] = function (el) {
    var doc = Y.doc(S(), cid(), el.dataset.id);
    App.confirm({ title: 'Annuler ' + doc.num + ' par un avoir', body: '<p style="font-size:13px">Une facture émise ne se supprime jamais : l’annulation crée un avoir lié (brouillon à émettre), et l’historique reste consultable. Pour une annulation partielle, modifiez les lignes de l’avoir avant de l’émettre.</p>', ok: 'Créer l’avoir' }).then(function (v) {
      if (!v) return; var av = App.run(function () { var a = Y.creditNoteFrom(S(), cid(), doc.id); F.event(S(), cid(), doc.id, 'avoir', 'Avoir ' + (a.num || 'brouillon') + ' créé pour annulation'); return a; }, 'Avoir créé en brouillon dans Ventes › Avoirs.');
      if (av) { App.closeDrawer(true); App.ui.v.docEd = U.clone(av); App.ui.v.docId = 'edit'; App.go('ventes', 'avoirs'); }
    });
  };
  A['fx-proof'] = function (el) {
    var doc = Y.doc(S(), cid(), el.dataset.id), rest = Y.docTotals(S(), cid(), doc).ttc - Y.docPaid(doc);
    App.form({ title: 'Justificatif déclaré · ' + doc.num, intro: 'Saisissez ce que le client a envoyé (capture, SMS, avis de virement). myyiel le contrôle mais <b>ne marque jamais la facture payée sur cette seule base</b> : il faut la confirmation de l’opérateur ou la ligne du relevé.', fields: [{ k: 'method', label: 'Moyen', type: 'select', val: 'momo', opts: [['momo', 'MTN Mobile Money'], ['om', 'Orange Money'], ['bank', 'Virement']] }, { k: 'amount', label: 'Montant', type: 'money', req: true, val: rest }, { k: 'ref', label: 'Référence de transaction', mono: true }, { k: 'date', label: 'Date', type: 'date', val: App.today() }, { k: 'payer', label: 'Numéro du payeur', mono: true }, { k: 'payee', label: 'Bénéficiaire indiqué sur la capture' }, { k: 'source', label: 'Reçu par', type: 'select', opts: ['WhatsApp', 'E-mail', 'Appel', 'Au guichet'] }, { k: 'text', label: 'Texte du SMS (copier-coller)', type: 'textarea', span: true }],
      onSubmit: function (v) { return F.declareProof(S(), cid(), Object.assign({ docId: doc.id }, v)); }, done: function (r) { return 'Justificatif analysé : ' + F.PROOF_STATUS[r.status][0] + '.'; } });
  };
  A['fx-promise'] = function (el) {
    var doc = Y.doc(S(), cid(), el.dataset.id), rest = Y.docTotals(S(), cid(), doc).ttc - Y.docPaid(doc);
    App.form({ title: 'Promesse de paiement · ' + doc.num, fields: [{ k: 'date', label: 'Date promise', type: 'date', req: true, val: U.addDays(App.today(), 7) }, { k: 'amount', label: 'Montant promis', type: 'money', val: rest }, { k: 'contact', label: 'Interlocuteur' }, { k: 'channel', label: 'Obtenue par', type: 'select', opts: [['appel', 'Appel'], ['whatsapp', 'WhatsApp'], ['email', 'E-mail'], ['visite', 'Visite']] }],
      onSubmit: function (v) { return F.promise(S(), cid(), doc.id, v); }, done: 'Promesse enregistrée : les relances sont suspendues jusqu’à la date promise.' });
  };

  /* --------------------------------------------------------------- notifications */
  var prevExtra = App.extraNotifs;
  App.extraNotifs = function () { var l = prevExtra ? prevExtra() : []; try { if (App.can('fin.read')) l = l.concat(F.notifications(S(), cid())); } catch (e) { /* module 4 absent */ } return l; };
})();

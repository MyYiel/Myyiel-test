/* Paie · bulletins (liste, vue, PDF unitaire et par lot, envoi) et espace DRH / DAF (validation, signature électronique et cachet, ordres de virement, avances, contrôle comptable). */
(function () {
  'use strict';
  var Y = window.Yiel, U = Y.util, P = Y.Paie, App = window.App, esc = App.esc, A = App.actions;
  function S() { return App.S; } function cid() { return App.cid(); }

  /* ------------------------------------------------------------- bulletins */
  A['bl-pdf'] = function () {
    var key = App.pk(), p = App.pPeriod(), sel = App.selected('bulls'), ids = sel.length ? sel : Object.keys(p.slips);
    if (!ids.length) return App.toast('Aucun bulletin.', 'bad');
    App.slipsPdf(key, ids, 'bulletins_' + key + (sel.length ? '_selection' : '_tous') + '.pdf', App.v('slipLang', 'fr'));
  };
  A['bl-send'] = function (el) {
    var key = App.pk(), p = App.pPeriod(), c = el.dataset.c, sel = App.selected('bulls'), ids = (sel.length ? sel : Object.keys(p.slips)).filter(function (id) { return p.slips[id].signed; });
    if (!ids.length) return App.toast('Aucun bulletin signé à envoyer.', 'bad');
    App.confirm({ title: 'Envoyer ' + ids.length + ' bulletin(s) par ' + (c === 'whatsapp' ? 'WhatsApp' : 'e-mail'), body: 'Chaque salarié reçoit un lien sécurisé et son code personnel. Les bulletins non signés ne sont jamais envoyés.', ok: 'Envoyer' }).then(function (ok) { if (ok) App.run(function () { App.clearSel('bulls'); return P.markSent(S(), cid(), key, ids, c); }, function (n) { return n + ' bulletin(s) envoyé(s).'; }); });
  };
  App.pages['paie-bulletins'] = {
    render: function () {
      var d = P.D(S(), cid()), key = App.pk(), p = App.pPeriod(), frozen = P.isFrozen(p), f = App.v('blF', 'tous'), lang = App.v('slipLang', d.settings.bulletinLang || 'fr');
      var ids = Object.keys(p.slips), signed = ids.filter(function (id) { return p.slips[id].signed; }).length, sent = ids.filter(function (id) { return p.slips[id].sent; }).length;
      var h = '<div class="page">' + App.head('Paie · Bulletins', 'Bulletins <span class="serif">de paie</span>', 'Modèle conforme (rubriques, bases, taux, part salariale et patronale, cumuls, congés), bilingue français / anglais, signé électroniquement par la DRH avec son cachet, puis diffusé en PDF, par e-mail ou WhatsApp.',
        App.pickPeriod() + App.seg('slipLang', [['fr', 'FR'], ['en', 'EN']], lang) + '<button type="button" class="btn" data-act="bl-pdf"' + (ids.length ? '' : ' disabled') + '>' + App.ic('pdf') + 'PDF (sélection ou tous)</button>');
      h += '<div class="grid g4"><div class="kpi"><span class="lbl">Bulletins</span><span class="val">' + ids.length + '</span><span class="delta">' + (frozen ? 'validés par la DRH' : 'provisoires') + '</span></div><div class="kpi"><span class="lbl">Signés</span><span class="val">' + signed + '</span><span class="delta">' + (ids.length - signed) + ' à signer par la DRH</span></div><div class="kpi"><span class="lbl">Envoyés</span><span class="val">' + sent + '</span></div><div class="kpi"><span class="lbl">Net total</span><span class="val">' + App.sensMoney(P.totals(S(), cid(), key).net) + '</span></div></div>';
      if (!frozen) h += '<div class="callout warn">' + App.ic('bell') + '<span>Bulletins provisoires (filigrane « PROVISOIRE ») : ils deviennent définitifs après la validation DRH, puis sont signés avant diffusion.</span></div>';
      var rows = ids.map(function (id) { return p.slips[id]; }).filter(function (s) { return f === 'tous' || (f === 'asigner' ? !s.signed : (f === 'signes' ? s.signed : s.sent)); });
      h += '<div class="card flush">' + App.table('bulls', { exportName: 'bulletins_' + key, rows: rows, rowId: function (s) { return s.empId; }, rowAct: 'slip-open', select: true, rowClass: function (s) { return s.signed ? 'signed' : ''; }, pageSize: 40,
        toolbar: App.filters('blF', [['tous', 'Tous'], ['asigner', 'À signer'], ['signes', 'Signés'], ['envoyes', 'Envoyés']], f) + '<button type="button" class="btn sm" data-act="bl-send" data-c="email"' + (signed ? App.dis('pay.prepare') : ' disabled') + '>' + App.ic('mail') + 'E-mail</button><button type="button" class="btn sm" data-act="bl-send" data-c="whatsapp"' + (signed ? App.dis('pay.prepare') : ' disabled') + '>' + App.ic('chat') + 'WhatsApp</button>',
        cols: [{ k: 'matricule', label: 'Matricule', fmt: function (v) { return '<span class="mono">' + esc(v) + '</span>'; } }, { k: 'name', label: 'Salarié', val: function (s) { return App.ename(P.emp(S(), cid(), s.empId)); } }, { k: 'poste', label: 'Poste', val: function (s) { return s.ctx.poste; } }, { k: 'net', label: 'Net', num: true, val: function (s) { return s.totals.net; }, fmt: App.sensMoney },
          { k: 'sig', label: 'Signature', val: function (s) { return s.signed ? 'Signé' : (frozen ? 'À signer par la DRH' : 'Provisoire'); }, fmt: function (v, s) { return s.signed ? App.chip('Signé · ' + App.date(s.signed.at.slice(0, 10)), 'ok', true) : App.chip(v, frozen ? 'warn' : '', true); } },
          { k: 'sent', label: 'Envoi', val: function (s) { return s.sent ? Object.keys(s.sent).join(', ') : ''; }, fmt: function (v) { return v ? App.chip(v, 'info') : '<span class="muted">—</span>'; } }],
        rowActions: function (s) { return '<button type="button" class="btn xs" data-act="slip-pdf" data-k="' + key + '" data-id="' + s.empId + '">' + App.ic('pdf') + '</button>'; } }) + '</div>';
      return h + '</div>';
    }
  };

  /* ---------------------------------------------------------- espace DRH / DAF */
  App.processStamp = function (file) {
    return new Promise(function (res, rej) {
      var fr = new FileReader(); fr.onerror = function () { rej(new Error('Lecture impossible')); };
      fr.onload = function () {
        var img = new Image(); img.onerror = function () { rej(new Error('Image illisible')); };
        img.onload = function () {
          var k = Math.min(1, 380 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
          var x = c.getContext('2d'); x.drawImage(img, 0, 0, c.width, c.height);
          var px = x.getImageData(0, 0, c.width, c.height), a = px.data;
          for (var i = 0; i < a.length; i += 4) { var l = 0.299 * a[i] + 0.587 * a[i + 1] + 0.114 * a[i + 2]; if (l > 205) a[i + 3] = 0; else a[i + 3] = Math.min(255, Math.round((235 - l) * 1.6)); }
          x.putImageData(px, 0, 0); res(c.toDataURL('image/png'));
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  };
  A['sig-clear'] = function () { var c = document.getElementById('sig_pad'); if (c) { c.getContext('2d').clearRect(0, 0, c.width, c.height); c.dataset.ink = ''; } };
  A['sig-import'] = function () { var f = document.getElementById('sig_file'); if (f) f.click(); };
  A['sig-file'] = function (el) { var f = el.files && el.files[0]; if (!f) return; App.processStamp(f).then(function (url) { var c = document.getElementById('sig_pad'), img = new Image(); img.onload = function () { var x = c.getContext('2d'); x.clearRect(0, 0, c.width, c.height); var k = Math.min(c.width / img.width, c.height / img.height); x.drawImage(img, (c.width - img.width * k) / 2, (c.height - img.height * k) / 2, img.width * k, img.height * k); c.dataset.ink = '1'; }; img.src = url; }, function (e) { App.toast(e.message, 'bad'); }); };
  A['stamp-pick'] = function () { var f = document.getElementById('stamp_file'); if (f) f.click(); };
  A['stamp-file'] = function (el) { var f = el.files && el.files[0]; if (!f) return; App.processStamp(f).then(function (url) { App.ui.v.stamp = url; var im = document.getElementById('stamp_prev'); if (im) { im.src = url; im.hidden = false; } App.toast('Cachet détouré : fond blanc supprimé.', 'ok'); }, function (e) { App.toast(e.message, 'bad'); }); };
  A['sig-save'] = function () {
    var c = document.getElementById('sig_pad'); if (!c || !c.dataset.ink) return App.toast('Dessinez ou importez votre signature.', 'bad');
    App.run(function () { return P.setSignature(S(), cid(), { signature: c.toDataURL('image/png'), cachet: App.ui.v.stamp || (P.D(S(), cid()).signature || {}).cachet || null, title: (document.getElementById('sig_title') || {}).value }); }, 'Spécimen de signature et cachet enregistrés.');
    App.ui.v.sigEdit = false;
  };
  A['sig-edit'] = function () { App.ui.v.sigEdit = true; App.render(); };
  A['sig-sign'] = function () {
    var key = App.pk(), p = App.pPeriod(), sel = App.selected('tosign'), ids = sel.length ? sel : null, n = Object.keys(p.slips).filter(function (id) { return !p.slips[id].signed && (!ids || ids.indexOf(id) > -1); }).length;
    if (!n) return App.toast('Tous les bulletins sélectionnés sont déjà signés.', 'bad');
    App.confirm({ title: 'Signer électroniquement ' + n + ' bulletin(s)', body: 'Votre signature et votre cachet seront apposés sur chaque bulletin de ' + P.monthLabel(key) + '. Chaque signature est horodatée et liée à l’empreinte du bulletin : toute modification ultérieure serait détectée. Les bulletins déjà signés sont ignorés.', requireText: 'SIGNER', ok: 'Signer' }).then(function (ok) { if (ok) App.run(function () { App.clearSel('tosign'); return P.signSlips(S(), cid(), key, ids); }, function (r) { return r.signed + ' bulletin(s) signé(s)' + (r.skipped ? ', ' + r.skipped + ' déjà signé(s) ignoré(s)' : '') + '.'; }); });
  };
  App.pages['paie-drh'] = {
    render: function () {
      var d = P.D(S(), cid()), r = App.user().role, key = App.pk(), p = App.pPeriod(), tab = App.tab('paie-drh', r === 'cfo' ? 'daf' : (r === 'hr' ? 'validation' : 'signature'));
      var subm = Object.keys(d.periods).filter(function (k) { return d.periods[k].status === 'soumise'; });
      var unsigned = Object.keys(p.slips).filter(function (id) { return P.isFrozen(p) && !p.slips[id].signed; }).length;
      var ordersPending = d.bankOrders.filter(function (o) { return o.status === 'soumis'; }), advPending = d.advances.filter(function (a) { return a.status === 'demandee'; });
      var h = '<div class="page">' + App.head('Paie · Espace de validation', 'Espace <span class="serif">DRH &amp; DAF</span>', 'Chacun son rôle : le gestionnaire prépare, la DRH valide, signe et approuve les virements et avances, la DAF vérifie les écritures, télédéclare et clôture. Connecté en tant que <b>' + esc(App.user().name) + '</b> (' + esc(Y.ROLES[r].label) + ').', App.pickPeriod());
      h += App.tabs('paie-drh', [['validation', 'Validation de la paie', subm.length], ['signature', 'Signature des bulletins', unsigned], ['approbations', 'Virements & avances', ordersPending.length + advPending.length], ['daf', 'Contrôle DAF']], 'validation');
      if (tab === 'validation') {
        if (!subm.length) h += '<div class="empty card"><b>Aucune paie en attente de validation</b>La paie de ' + P.monthLabel(key) + ' est au statut « ' + P.STATUS[p.status][0] + ' ».</div>';
        subm.forEach(function (k) {
          var pp = d.periods[k], t = P.totals(S(), cid(), k), prev = P.totals(S(), cid(), P.prevKey(k)), last = pp.history.slice().reverse().find(function (x) { return /soumise/.test(x.action); }) || {};
          var dv = function (a, b) { return b ? (a >= b ? '+' : '') + Math.round((a - b) / b * 1000) / 10 + ' %' : '—'; };
          h += '<div class="card" style="display:flex;flex-direction:column;gap:12px"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><h2 style="font-size:17px">Paie de ' + P.monthLabel(k) + '</h2>' + App.pChip(pp) + '<span class="muted" style="font-size:12.5px">Soumise par ' + esc(last.by || '—') + (last.comment ? ' · « ' + esc(last.comment) + ' »' : '') + '</span></div>' +
            '<div class="grid g4"><div class="kpi"><span class="lbl">Bulletins</span><span class="val">' + t.count + '</span><span class="delta">M-1 : ' + prev.count + '</span></div><div class="kpi"><span class="lbl">Brut</span><span class="val">' + App.sensMoney(t.brut) + '</span><span class="delta">' + dv(t.brut, prev.brut) + ' vs M-1</span></div><div class="kpi"><span class="lbl">Net à payer</span><span class="val">' + App.sensMoney(t.net) + '</span><span class="delta">' + dv(t.net, prev.net) + ' vs M-1</span></div><div class="kpi"><span class="lbl">Coût employeur</span><span class="val">' + App.sensMoney(t.cost) + '</span><span class="delta">' + dv(t.cost, prev.cost) + ' vs M-1</span></div></div>' +
            '<div class="list">' + (pp.anomalies || []).filter(function (a) { return a.level !== 'bloquante'; }).slice(0, 8).map(function (a) { return '<div style="font-size:12.5px"><span class="mono" style="color:var(--warn);font-weight:800;width:36px">' + a.code + '</span><span class="grow"><b>' + esc(a.label) + '</b> · ' + esc(a.matricule + ' ' + a.name) + ' · ' + esc(a.detail) + '</span></div>'; }).join('') + '</div>' +
            '<div class="actions"><button type="button" class="btn" data-act="go" data-page="paie-periode" data-tab="controle">Examiner les bulletins</button><button type="button" class="btn" data-act="pp-reject-k" data-k="' + k + '"' + App.dis('pay.approve') + '>Rejeter</button><button type="button" class="btn acc" data-act="pp-approve-k" data-k="' + k + '"' + App.dis('pay.approve') + '>' + App.ic('check') + 'Valider la paie</button></div></div>';
        });
      }
      if (tab === 'signature') {
        var sg = d.signature, canSign = App.can('pay.sign'), edit = App.v('sigEdit', false) || !sg;
        h += '<div class="row"><div class="card side" style="display:flex;flex-direction:column;gap:12px"><h2 style="font-size:15.5px">Spécimen de signature et cachet</h2>';
        if (!canSign) h += '<div class="callout warn">' + App.ic('lock') + '<span>Réservé à la DRH. Le gestionnaire de paie voit le statut « à signer par la DRH » mais ne peut pas signer, même avec son accord.</span></div>';
        if (sg && !edit) h += '<div class="specimen">' + (sg.cachet ? '<img src="' + sg.cachet + '" alt="Cachet" class="c">' : '') + '<img src="' + sg.signature + '" alt="Signature" class="s"></div><span class="muted" style="font-size:12.5px">' + esc(sg.signer) + ' · ' + esc(sg.title) + ' · enregistré le ' + new Date(sg.at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) + ' · réf. ' + esc(sg.id) + '</span><button type="button" class="btn sm" data-act="sig-edit"' + App.dis('pay.sign') + '>Modifier le spécimen</button>';
        else if (canSign) h += '<span class="muted" style="font-size:12.5px">Signez dans le cadre (souris, doigt ou stylet) ou importez une photo de votre signature.</span><canvas id="sig_pad" class="sigpad" width="520" height="180" aria-label="Zone de signature"></canvas><div class="actions"><button type="button" class="btn sm" data-act="sig-clear">Effacer</button><button type="button" class="btn sm" data-act="sig-import">Importer une image</button><input type="file" id="sig_file" class="sr" accept="image/*" data-change="sig-file"></div>' +
          '<div class="form-sep">Cachet de l’entreprise</div><span class="muted" style="font-size:12.5px">Apposez le cachet sur une feuille blanche, prenez-la en photo : myyiel supprime le fond blanc automatiquement.</span><div class="actions"><button type="button" class="btn sm" data-act="stamp-pick">' + App.ic('upload') + 'Photo du cachet</button><input type="file" id="stamp_file" class="sr" accept="image/*" data-change="stamp-file"><img id="stamp_prev" class="stamp-prev" alt="Aperçu du cachet" src="' + esc(App.ui.v.stamp || (sg && sg.cachet) || '') + '"' + (App.ui.v.stamp || (sg && sg.cachet) ? '' : ' hidden') + '></div>' +
          '<label class="fld"><span>Fonction affichée</span><input class="in" id="sig_title" value="' + esc(sg ? sg.title : 'Directrice des ressources humaines') + '"></label><button type="button" class="btn acc" data-act="sig-save">Enregistrer le spécimen</button>';
        h += '</div>';
        var rows = Object.keys(p.slips).map(function (id) { return p.slips[id]; });
        var nUns = rows.filter(function (s) { return !s.signed; }).length;
        h += '<div class="card flush grow"><div class="card-h"><h2>Bulletins de ' + P.monthLabel(key) + '</h2><span class="sub">' + (P.isFrozen(p) ? nUns + ' à signer · ' + (rows.length - nUns) + ' signé(s) (grisés)' : 'Paie non validée par la DRH : signature indisponible') + '</span><button type="button" class="btn acc" style="margin-left:auto" data-act="sig-sign"' + (P.isFrozen(p) && nUns && canSign && sg ? '' : ' disabled') + '>' + App.ic('pen') + 'Signer électroniquement' + (nUns ? ' (' + nUns + ')' : '') + '</button></div>' +
          App.table('tosign', { exportName: false, rows: rows, rowId: function (s) { return s.empId; }, select: P.isFrozen(p) && canSign, selectable: function (s) { return !s.signed; }, rowClass: function (s) { return s.signed ? 'signed' : ''; }, rowAct: 'slip-open', pageSize: 50, search: true,
            cols: [{ k: 'matricule', label: 'Matricule', fmt: function (v) { return '<span class="mono">' + esc(v) + '</span>'; } }, { k: 'name', label: 'Salarié', val: function (s) { return App.ename(P.emp(S(), cid(), s.empId)); } }, { k: 'net', label: 'Net', num: true, val: function (s) { return s.totals.net; }, fmt: App.sensMoney }, { k: 'st', label: 'Statut', val: function (s) { return s.signed ? 'Signé' : 'À signer par la DRH'; }, fmt: function (v, s) { return s.signed ? App.chip('Signé · ' + new Date(s.signed.at).toLocaleDateString('fr-FR'), 'ok', true) : App.chip(P.isFrozen(p) ? 'À signer par la DRH uniquement' : 'Provisoire', P.isFrozen(p) ? 'warn' : '', true); } }, { k: 'h', label: 'Empreinte', val: function (s) { return s.signed ? s.signed.hash : (s.hash || ''); }, fmt: function (v) { return '<span class="mono muted">' + esc(v) + '</span>'; } }] }) + '</div></div>';
        h += '<div class="callout info">' + App.ic('shield') + '<span>Anti-doublon : un bulletin ne peut être signé qu’une fois ; un bulletin modifié après validation est refusé. Chaque signature est tracée dans la piste d’audit (qui, quand, empreinte).</span></div>';
      }
      if (tab === 'approbations') {
        h += '<div class="card flush"><div class="card-h"><h2>Ordres de virement à valider</h2></div>' + App.table('ordAppr', { exportName: false, search: false, rows: ordersPending, emptyTitle: 'Aucun ordre en attente', rowAct: 'ov-open', cols: [{ k: 'ref', label: 'Référence', fmt: function (v) { return '<span class="mono">' + esc(v) + '</span>'; } }, { k: 'motif', label: 'Motif' }, { k: 'count', label: 'Bénéficiaires', num: true, val: function (o) { return o.totals.count; } }, { k: 'all', label: 'Montant', num: true, val: function (o) { return o.totals.all; }, fmt: App.sensMoney }, { k: 'exec', label: 'Exécution', val: function (o) { return o.executionDate; }, fmt: App.date }],
          rowActions: function (o) { return '<button type="button" class="btn xs" data-act="ov-do" data-id="' + o.id + '" data-a="rejeter"' + App.dis('pay.approve') + '>Rejeter</button> <button type="button" class="btn xs acc" data-act="ov-do" data-id="' + o.id + '" data-a="valider"' + App.dis('pay.approve') + '>Valider</button>'; } }) + '</div>';
        h += '<div class="card flush"><div class="card-h"><h2>Demandes d’avance sur salaire</h2></div>' + App.table('advAppr', { exportName: false, search: false, rows: advPending, emptyTitle: 'Aucune demande en attente', cols: [{ k: 'ref', label: 'Référence' }, { k: 'emp', label: 'Salarié', val: function (a) { return App.ename(P.emp(S(), cid(), a.empId)); } }, { k: 'amount', label: 'Montant', num: true, fmt: App.sensMoney }, { k: 'date', label: 'Demandée le', fmt: App.date }, { k: 'reason', label: 'Motif' }, { k: 'retain', label: 'Retenue sur', val: function (a) { return P.monthLabel(a.retainPeriod) + (a.late ? ' (après date butoir)' : ''); } }],
          rowActions: function (a) { return '<button type="button" class="btn xs" data-act="adv-do" data-id="' + a.id + '" data-a="refuser"' + App.dis('pay.approve') + '>Refuser</button> <button type="button" class="btn xs acc" data-act="adv-do" data-id="' + a.id + '" data-a="approuver"' + App.dis('pay.approve') + '>Approuver</button>'; } }) + '</div>';
      }
      if (tab === 'daf') {
        var frozen = Object.keys(d.periods).sort().reverse().filter(function (k) { return P.isFrozen(d.periods[k]); }).slice(0, 6);
        h += '<div class="card flush"><div class="card-h"><h2>Écritures de paie reçues en comptabilité</h2><span class="sub">Vérification puis clôture de la période ; télédéclaration CNPS ensuite</span></div><div class="tbl-wrap"><table class="t"><thead><tr><th>Période</th><th>Statut</th><th>Écriture</th><th class="num">Montant</th><th>Déclarations</th><th></th></tr></thead><tbody>' +
          frozen.map(function (k) { var pp = d.periods[k], dc = P.declarations(S(), cid(), k); return '<tr><td><b>' + P.monthLabel(k) + '</b></td><td>' + App.pChip(pp) + '</td><td>' + (pp.journal && pp.journal.status === 'integre' ? '<button type="button" class="btn xs ghost" data-act="entry-open" data-id="' + esc(pp.journal.entries[0]) + '"><span class="mono">' + esc(pp.journal.entries.join(', ')) + '</span></button>' : App.chip('Rejetée', 'bad')) + '</td><td class="num">' + App.sensMoney(pp.journal ? pp.journal.total : 0) + '</td><td>' + dc.map(function (x) { return App.chip(x.code + ' · ' + { a_declarer: 'à déclarer', transmise: 'transmise', payee: 'payée' }[x.status.status], x.status.status === 'payee' ? 'ok' : (x.status.status === 'transmise' ? 'info' : 'warn')); }).join(' ') + '</td><td style="text-align:right">' + (pp.status === 'validee' ? '<button type="button" class="btn xs acc" data-act="pp-close-k" data-k="' + k + '"' + App.dis('pay.post') + '>Vérifié · clôturer</button>' : '<button type="button" class="btn xs" data-act="go" data-page="paie-declarations">Déclarations</button>') + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
        h += '<div class="callout">' + App.ic('shield') + '<span>Les écritures arrivent automatiquement dans le journal PAIE à la validation de la DRH (lot ' + esc(Y.BATCH_FORMAT) + ', contrôlé et intégré en tout ou rien). La télédéclaration CNPS n’est possible qu’après leur intégration, et uniquement par la DAF.</span></div>';
      }
      return h + '</div>';
    },
    after: function () {
      var c = document.getElementById('sig_pad'); if (!c) return;
      var x = c.getContext('2d'), down = false, last = null;
      x.lineWidth = 2.6; x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = '#1C2A78';
      function pos(e) { var r = c.getBoundingClientRect(); return [(e.clientX - r.left) * c.width / r.width, (e.clientY - r.top) * c.height / r.height]; }
      c.addEventListener('pointerdown', function (e) { down = true; last = pos(e); c.setPointerCapture(e.pointerId); });
      c.addEventListener('pointermove', function (e) { if (!down) return; var p = pos(e); x.beginPath(); x.moveTo(last[0], last[1]); x.lineTo(p[0], p[1]); x.stroke(); last = p; c.dataset.ink = '1'; });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (t) { c.addEventListener(t, function () { down = false; }); });
    }
  };
  A['pp-approve-k'] = function (el) { App.ui.v['pKey_' + cid()] = el.dataset.k; A['pp-approve'](); };
  A['pp-reject-k'] = function (el) { App.ui.v['pKey_' + cid()] = el.dataset.k; A['pp-reject'](); };
  A['pp-close-k'] = function (el) { App.ui.v['pKey_' + cid()] = el.dataset.k; A['pp-close'](); };
})();

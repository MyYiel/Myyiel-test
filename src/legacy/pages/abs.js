/* Congés & absences : planning d'équipe avec visuels des motifs, demandes, file de validation (N+1, DRH, gestionnaire), soldes, paramétrage (motifs, circuits, jours fériés, règles). */
(function () {
  'use strict';
  var Y = window.Yiel, U = Y.util, App = window.App, esc = App.esc, A = App.actions;
  var AB = Y.Abs, P = Y.Paie, G = Y.GTA;
  function S() { return App.S; } function cid() { return App.cid(); }
  function run(fn, msg) { return App.run(fn, msg); }
  function today() { return App.today(); }

  /* ---------------------------------------------------------------- formulaire de demande */
  App.absForm = function (o) {
    o = o || {}; var me = App.me(), forOther = !!o.forOther, d = AB.D(S(), cid());
    var types = d.types.filter(function (t) { return t.active !== false && (forOther || t.self); });
    var emps = AB.scope(S(), cid());
    var fields = [];
    if (forOther) fields.push({ k: 'empId', label: 'Salarié', type: 'select', req: true, val: o.empId || '', empty: '— choisir —', opts: emps.map(function (e) { return [e.id, P.fullName(e) + ' · ' + e.service]; }) });
    fields.push({ type: 'html', html: '<div class="fld"><span>Motif <em>*</em></span><div class="type-pick">' + types.map(function (t, i) { return '<label class="tp"><input type="radio" name="abs_t" value="' + t.code + '"' + ((o.type ? o.type === t.code : i === 0) ? ' checked' : '') + '>' + App.absIcon(t) + '<span>' + esc(t.label) + '</span></label>'; }).join('') + '</div></div>' });
    fields.push({ k: 'start', label: 'Du', type: 'date', req: true, val: o.start || U.addDays(today(), 7) }, { k: 'startHalf', label: 'À partir de', type: 'select', val: '', opts: [['', 'Journée entière'], ['pm', 'L’après-midi']] },
      { k: 'end', label: 'Au', type: 'date', req: true, val: o.end || o.start || U.addDays(today(), 7) }, { k: 'endHalf', label: 'Jusqu’à', type: 'select', val: '', opts: [['', 'Journée entière'], ['am', 'Le matin inclus']] },
      { k: 'reason', label: 'Commentaire', type: 'textarea', span: true, ph: 'Facultatif · visible par votre N+1 et les RH' }, { k: 'proof', label: 'Justificatif', type: 'file', accept: '.pdf,.jpg,.jpeg,.png', span: true, help: 'Certificat médical, acte d’état civil… (photo acceptée)' });
    App.form({ title: forOther ? 'Saisir une absence' : 'Demander une absence', sub: forOther ? 'Saisie pour un salarié : le circuit de validation s’applique' : (me ? P.fullName(me) + ' · ' + me.service : ''), wide: true, fields: fields, live: function (v) {
      var t = (document.querySelector('input[name=abs_t]:checked') || {}).value, empId = forOther ? v.empId : (me && me.id); if (!empId || !t) return '';
      var c = AB.check(S(), cid(), { empId: empId, type: t, start: v.start, end: v.end, startHalf: v.startHalf, endHalf: v.endHalf, proof: v.proof ? v.proof.name : '' });
      var ty = AB.type(S(), cid(), t), e = App.emp(empId), bal = ty && ty.counter && e ? AB.balances(S(), cid(), e)[ty.counter] : null;
      return '<div class="live-box">' + App.absIcon(ty, true) + '<div><b>' + App.days(c.days || 0) + '</b> <span class="muted">' + esc(AB.UNITS[ty.unit] || '') + '</span>' + (bal ? '<div class="muted" style="font-size:12.5px">' + esc(bal.label) + ' : ' + App.days(bal.disponible) + ' disponibles → <b>' + App.days(bal.disponible - (c.days || 0)) + '</b> après la demande</div>' : '') + '<div class="muted" style="font-size:12.5px">' + esc(ty.paid ? 'Rémunérée' : 'Non rémunérée') + ' · ' + esc(AB.PAYCODES[ty.payCode || '']) + '</div></div></div>' +
        (c.errors.length ? '<div class="errors">' + c.errors.map(esc).join('<br>') + '</div>' : '') + (c.warnings.length ? '<div class="callout warn">' + App.ic('alert') + '<span>' + c.warnings.map(esc).join('<br>') + '</span></div>' : '');
    }, submit: forOther ? 'Enregistrer' : 'Envoyer la demande', onSubmit: function (v) {
      var t = (document.querySelector('input[name=abs_t]:checked') || {}).value;
      return AB.request(S(), cid(), { empId: forOther ? v.empId : (me && me.id), type: t, start: v.start, end: v.end, startHalf: v.startHalf, endHalf: v.endHalf, reason: v.reason, proof: v.proof ? v.proof.name : '' });
    }, done: function (r) { return r.ref + ' · ' + AB.STATUS[r.status][0].toLowerCase() + '.'; } });
    setTimeout(function () { document.querySelectorAll('input[name=abs_t]').forEach(function (x) { x.addEventListener('change', App.formLive); }); }, 40);
  };
  A['abs-new'] = function (el) { App.absForm({ forOther: el.dataset.other === '1', empId: el.dataset.emp, start: el.dataset.date, end: el.dataset.date }); };

  /* ---------------------------------------------------------------- détail d'une demande */
  A['abs-open'] = function (el) {
    var r = AB.D(S(), cid()).requests.find(function (x) { return x.id === el.dataset.id; }); if (!r) return;
    var e = App.emp(r.empId), t = App.absType(r.type), why = AB.canAct(S(), cid(), r), step = r.steps[r.step], me = App.me();
    var bal = t.counter ? AB.balances(S(), cid(), e)[t.counter] : null;
    var cov = ['TT', 'FORM'].indexOf(t.code) < 0 ? AB.dayList(S(), cid(), t.unit, r.start, r.end).map(function (x) { return Object.assign({ date: x.date }, AB.coverage(S(), cid(), e.service, x.date, r.id)); }).sort(function (a, b) { return b.pct - a.pct; })[0] : null;
    var acts = '';
    if (!why && step === 'notify') acts += '<button type="button" class="btn acc" data-act="abs-notify" data-id="' + r.id + '">' + App.ic('send') + 'Enregistrer et notifier</button>';
    else if (!why) acts += '<button type="button" class="btn acc" data-act="abs-decide" data-id="' + r.id + '" data-d="approve">' + App.ic('check') + 'Approuver</button>';
    if (!why) acts += '<button type="button" class="btn" data-act="abs-decide" data-id="' + r.id + '" data-d="refuse">' + App.ic('x') + 'Refuser</button>';
    if (['refusee', 'annulee'].indexOf(r.status) < 0 && ((me && me.id === r.empId) || App.can('abs.manage'))) acts += '<button type="button" class="btn ghost" data-act="abs-cancel" data-id="' + r.id + '">Annuler la demande</button>';
    if (t.proof && !r.proof && ((me && me.id === r.empId) || App.can('abs.manage'))) acts += '<button type="button" class="btn" data-act="abs-proof" data-id="' + r.id + '">' + App.ic('upload') + 'Ajouter le justificatif</button>';
    App.drawer({ title: t.label + ' · ' + P.fullName(e), sub: r.ref + ' · ' + e.service + ' · ' + e.poste, noFocus: true,
      body: '<div class="row" style="align-items:center;gap:12px">' + App.absIcon(t, true) + '<div style="display:flex;flex-direction:column;gap:4px">' + App.absChip(r) + '<b style="font-size:18px">' + App.days(r.days) + '</b><span class="muted">du ' + App.date(r.start) + (r.startHalf === 'pm' ? ' après-midi' : '') + ' au ' + App.date(r.end) + (r.endHalf === 'am' ? ' matin' : '') + '</span></div></div>' +
        (why && ['approuvee', 'refusee', 'annulee'].indexOf(r.status) < 0 ? '<div class="callout">' + App.ic('lock') + '<span>' + esc(A.STEP_WHO(r)) + '</span></div>' : '') +
        '<div class="kv"><span>Circuit</span><b>' + r.steps.map(function (s, i) { return (i < r.step ? '✓ ' : (i === r.step && r.status !== 'approuvee' ? '→ ' : '')) + AB.STEP_LABEL[s]; }).join(' · ') + (r.steps.length ? '' : 'Enregistrement direct') + '</b><span>Rémunération</span><b>' + esc(AB.PAYCODES[t.payCode || '']) + '</b>' + (bal ? '<span>' + esc(bal.label) + '</span><b>' + App.days(bal.disponible) + ' disponibles (' + App.days(bal.acquis) + ' acquis, ' + App.days(bal.attente) + ' en attente)</b>' : '') +
        (cov ? '<span>Couverture du service</span><b>' + cov.absent + ' / ' + cov.total + ' absent(s) le ' + App.date(cov.date) + (cov.names.length ? ' : ' + esc(cov.names.join(', ')) : '') + '</b>' : '') + '<span>Justificatif</span><b>' + (r.proof ? App.ic('file') + ' ' + esc(r.proof) : (t.proof ? '<span class="chip warn">À fournir</span>' : 'Non requis')) + '</b>' + (r.payKeys.length ? '<span>Transmis à la paie</span><b>' + r.payKeys.map(function (k) { return esc(P.monthLabel(k)); }).join(', ') + '</b>' : '') + '</div>' +
        (r.warnings && r.warnings.length ? '<div class="callout warn">' + App.ic('alert') + '<span>' + r.warnings.map(esc).join('<br>') + '</span></div>' : '') + (r.reason ? '<blockquote class="quote">' + esc(r.reason) + '</blockquote>' : '') +
        '<h3 class="h3">Historique</h3><ol class="timeline">' + r.history.map(function (x) { return '<li class="done"><b>' + esc(x.action) + '</b><span>' + esc(x.by) + ' · ' + App.timeLabel(x.at.slice(0, 16)) + (x.comment ? ' · « ' + esc(x.comment) + ' »' : '') + '</span></li>'; }).join('') + '</ol>',
      foot: acts + '<button type="button" class="btn" data-act="close-drawer">Fermer</button>' });
  };
  A.STEP_WHO = function (r) { var s = r.steps[r.step]; if (s === 'n1') { var m = App.emp(r.approver); return 'En attente de la validation du N+1 : ' + (m ? P.fullName(m) : r.approver) + '.'; } if (s === 'rh') return 'En attente de la validation de la DRH.'; if (s === 'notify') return 'Validée : le gestionnaire enregistre l’absence et notifie le salarié.'; return ''; };
  A['abs-decide'] = function (el) {
    var d = el.dataset.d;
    App.confirm({ title: d === 'approve' ? 'Approuver la demande' : 'Refuser la demande', fields: [{ k: 'c', label: d === 'approve' ? 'Commentaire (facultatif)' : 'Motif du refus', type: 'textarea', req: d !== 'approve', ph: d === 'approve' ? 'Ex. : passation organisée avec l’équipe' : 'Ex. : couverture du service insuffisante, proposez une autre date' }], ok: d === 'approve' ? 'Approuver' : 'Refuser', danger: d !== 'approve' })
      .then(function (v) { if (v && run(function () { return AB.decide(S(), cid(), el.dataset.id, d, v.c); }, function (r) { return r.ref + ' : ' + AB.STATUS[r.status][0].toLowerCase() + '.'; })) App.closeDrawer(); });
  };
  A['abs-notify'] = function (el) {
    var r = AB.D(S(), cid()).requests.find(function (x) { return x.id === el.dataset.id; }), e = App.emp(r.empId), st = AB.D(S(), cid()).settings.notify, t = App.absType(r.type);
    var msg = AB.message(S(), cid(), Object.assign({}, r, { status: 'approuvee' }));
    App.drawer({ title: 'Enregistrer et notifier', sub: P.fullName(e) + ' · ' + (e.whatsapp || e.telephone || '') + ' · ' + (e.email || ''), noFocus: true,
      body: '<div class="callout info">' + App.ic('check') + '<span>L’absence devient définitive : elle apparaît au planning, met à jour les soldes et partira à la paie de ' + esc(P.monthLabel(r.start.slice(0, 7))) + '.</span></div>' +
        '<div class="fld"><span>Canaux</span><div class="chk-grid"><label class="check"><input type="checkbox" id="nt_w"' + (st.whatsapp ? ' checked' : '') + '> WhatsApp</label><label class="check"><input type="checkbox" id="nt_m"' + (st.email ? ' checked' : '') + '> E-mail</label><label class="check"><input type="checkbox" id="nt_a" checked> Espace myyiel</label></div></div>' +
        '<label class="fld"><span>Message</span><textarea class="in" id="nt_msg" style="min-height:150px">' + esc(msg) + '</textarea></label>' + (t.proof && !r.proof ? '<label class="fld"><span>Justificatif reçu</span><input class="in" type="file" id="nt_proof" style="padding-top:8px"><small>Facultatif à cette étape : le salarié peut le déposer ensuite.</small></label>' : '') +
        App.phone('myyiel RH', 'Aperçu WhatsApp', App.bubble(esc(msg).replace(/\n/g, '<br>'), App.gtaClock ? G.now(S(), cid()).slice(11, 16) : '')),
      foot: '<button type="button" class="btn" data-act="close-drawer">Annuler</button><button type="button" class="btn acc" data-act="abs-notify-go" data-id="' + r.id + '">' + App.ic('send') + 'Enregistrer et envoyer</button>' });
  };
  A['abs-notify-go'] = function (el) {
    var ch = []; if (document.getElementById('nt_a').checked) ch.push('myyiel'); if (document.getElementById('nt_w').checked) ch.push('WhatsApp'); if (document.getElementById('nt_m').checked) ch.push('e-mail');
    var pf = document.getElementById('nt_proof'), proof = pf && pf.files && pf.files[0] ? pf.files[0].name : '';
    if (run(function () { return AB.decide(S(), cid(), el.dataset.id, 'approve', '', { channels: ch, message: document.getElementById('nt_msg').value, proof: proof }); }, 'Absence enregistrée · salarié notifié (' + ch.join(', ') + ').')) App.closeDrawer();
  };
  A['abs-cancel'] = function (el) { App.confirm({ title: 'Annuler la demande', fields: [{ k: 'c', label: 'Motif', type: 'textarea' }], ok: 'Annuler la demande', danger: true }).then(function (v) { if (v && run(function () { return AB.cancel(S(), cid(), el.dataset.id, v.c); }, 'Demande annulée.')) App.closeDrawer(); }); };
  A['abs-proof'] = function (el) { App.confirm({ title: 'Ajouter le justificatif', fields: [{ k: 'f', label: 'Fichier (PDF ou photo)', type: 'file', req: true }], ok: 'Ajouter' }).then(function (v) { if (!v || !v.f) return; run(function () { var r = AB.D(S(), cid()).requests.find(function (x) { return x.id === el.dataset.id; }); r.proof = v.f.name; r.history.push({ action: 'Justificatif déposé', comment: v.f.name, by: App.user().name, at: new Date().toISOString() }); Y.audit(S(), cid(), 'Absences · justificatif', r.ref, v.f.name); return r; }, 'Justificatif ajouté.'); App.closeDrawer(); }); };

  /* ---------------------------------------------------------------- planning */
  function monthKey() { return App.v('absKey', today().slice(0, 7)); }
  A['abs-month'] = function (el) { App.ui.v.absKey = el.dataset.d === '0' ? today().slice(0, 7) : (+el.dataset.d > 0 ? P.nextKey(monthKey()) : P.prevKey(monthKey())); App.render(); };
  A['abs-svc'] = function (el) { App.ui.v.absSvc = el.value; App.render(); };
  A['abs-cell'] = function (el) { if (el.dataset.req) return A['abs-open']({ dataset: { id: el.dataset.req } }); var me = App.me(); if (App.can('abs.manage')) App.absForm({ forOther: true, empId: el.dataset.emp, start: el.dataset.date, end: el.dataset.date }); else if (me && me.id === el.dataset.emp) App.absForm({ start: el.dataset.date, end: el.dataset.date }); };
  App.absPlanning = function (emps, key, opts) {
    opts = opts || {}; var b = P.periodBounds(key), cells = AB.cells(S(), cid(), b.start, b.end), d = AB.D(S(), cid()), dates = [];
    for (var dt = b.start; dt <= b.end; dt = U.addDays(dt, 1)) dates.push(dt);
    var missions = G ? G.D(S(), cid()).missions.filter(function (m) { return m.status !== 'annulee'; }) : [];
    var h = '<div class="plan-wrap"><table class="plan"><thead><tr><th class="who">Salarié</th>' + dates.map(function (x) { var w = AB.dow(x), hol = AB.isHoliday(S(), cid(), x); return '<th class="' + (w === 0 || w === 6 ? 'we ' : '') + (hol ? 'hol ' : '') + (x === today() ? 'tod' : '') + '" title="' + esc(hol || '') + '"><small>' + AB.DOW[w].slice(0, 2) + '</small>' + (+x.slice(8)) + '</th>'; }).join('') + '</tr></thead><tbody>';
    var lastSvc = null, count = {};
    emps.forEach(function (e) {
      if (opts.group !== false && e.service !== lastSvc) { lastSvc = e.service; h += '<tr class="svc"><td colspan="' + (dates.length + 1) + '">' + esc(e.service) + (d.managers[e.service] ? ' <small>· N+1 ' + esc(P.fullName(App.emp(d.managers[e.service]) || {})) + '</small>' : '') + '</td></tr>'; }
      h += '<tr><td class="who">' + App.empCell(e, e.poste) + '</td>';
      dates.forEach(function (x) {
        var c = (cells[e.id] || {})[x], w = AB.dow(x), hol = AB.isHoliday(S(), cid(), x), ms = missions.find(function (m) { return m.empIds.indexOf(e.id) > -1 && m.plannedStart.slice(0, 10) <= x && m.plannedEnd >= x; });
        var cls = (w === 0 || w === 6 ? 'we ' : '') + (hol ? 'hol ' : '') + (x === today() ? 'tod ' : ''), inner = '', attrs = ' data-act="abs-cell" data-emp="' + e.id + '" data-date="' + x + '"', title = hol || '';
        if (c) { var t = AB.type(S(), cid(), c.code); var pend = c.status !== 'approuvee'; cls += 'ab' + (pend ? ' pend' : '') + (c.half ? ' half-' + c.half : ''); inner = '<span class="cell" style="--c:' + t.color + '">' + App.ic(t.icon) + '</span>'; attrs += ' data-req="' + c.id + '"'; title = t.label + (pend ? ' · ' + AB.STATUS[c.status][0] : ''); if (['TT', 'FORM'].indexOf(c.code) < 0 && c.status === 'approuvee') count[x] = (count[x] || 0) + 1; }
        else if (ms) { cls += 'ms'; inner = '<span class="cell ms" title="' + esc(ms.ref) + '">' + App.ic('briefcase') + '</span>'; title = 'Mission ' + ms.ref + ' · ' + ms.label; }
        h += '<td class="' + cls + '"' + attrs + ' title="' + esc(title) + '">' + inner + '</td>';
      });
      h += '</tr>';
    });
    var thr = d.settings.coverage;
    h += '<tr class="cov"><td class="who"><b>Absents</b><small>seuil de couverture ' + thr + ' %</small></td>' + dates.map(function (x) { var n = count[x] || 0, pct = emps.length ? n * 100 / emps.length : 0; return '<td class="' + (pct > thr ? 'over' : '') + '">' + (n || '') + '</td>'; }).join('') + '</tr>';
    return h + '</tbody></table></div>';
  };
  function legend() { return '<div class="abs-legend">' + AB.D(S(), cid()).types.filter(function (t) { return t.active !== false; }).map(function (t) { return '<span>' + App.absIcon(t) + esc(t.label) + '</span>'; }).join('') + '<span><span class="abs-ic pendk"></span>En attente</span><span><span class="abs-ic msk">' + App.ic('briefcase') + '</span>Mission</span><span><span class="abs-ic holk"></span>Férié</span></div>'; }

  App.pages.abs = {
    render: function () {
      var d = AB.D(S(), cid()), tab = App.tab('abs', 'planning'), scope = AB.scope(S(), cid()), ids = scope.map(function (e) { return e.id; }), me = App.me();
      var queue = d.requests.filter(function (r) { return ['en_attente_n1', 'en_attente_rh', 'a_notifier'].indexOf(r.status) > -1 && !AB.canAct(S(), cid(), r); });
      var h = '<div class="page">' + App.head('Congés & absences', 'Planning <span class="serif">d’équipe</span>', 'Le salarié demande depuis son espace, le N+1 de son service valide, le gestionnaire enregistre et notifie. Les absences approuvées alimentent la paie et la GTA.', (App.can('abs.manage') ? '<button type="button" class="btn" data-act="abs-new" data-other="1">' + App.ic('plus') + 'Saisir pour un salarié</button>' : '') + (me && App.can('abs.request') ? '<button type="button" class="btn acc" data-act="abs-new">' + App.ic('plus') + 'Ma demande</button>' : ''));
      h += App.tabs('abs', [['planning', 'Planning d’équipe'], ['demandes', 'Demandes', d.requests.filter(function (r) { return ids.indexOf(r.empId) > -1; }).length], ['validations', 'Validations', queue.length || null], ['soldes', 'Soldes & compteurs']], 'planning');
      if (tab === 'planning') {
        var key = monthKey(), svc = App.v('absSvc', ''), services = scope.map(function (e) { return e.service; }).filter(function (x, i, a) { return a.indexOf(x) === i; }).sort();
        var list = scope.filter(function (e) { return !svc || e.service === svc; }).sort(function (a, b) { return (a.service + a.nom).localeCompare(b.service + b.nom); });
        var b = P.periodBounds(key), month = d.requests.filter(function (r) { return ids.indexOf(r.empId) > -1 && ['refusee', 'annulee'].indexOf(r.status) < 0 && r.start <= b.end && r.end >= b.start; });
        h += '<div class="actions"><div class="seg"><button type="button" data-act="abs-month" data-d="-1" aria-label="Mois précédent">' + App.ic('back') + '</button><button type="button" class="on" data-act="abs-month" data-d="0">' + esc(P.monthLabel(key)) + '</button><button type="button" data-act="abs-month" data-d="1" aria-label="Mois suivant">' + App.ic('next') + '</button></div>' + (services.length > 1 ? '<select class="sel" data-change="abs-svc" aria-label="Service"><option value="">Tous les services</option>' + services.map(function (s) { return '<option' + (s === svc ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') + '</select>' : '') + '<span class="muted" style="margin-left:auto;font-size:12.5px">' + month.length + ' absence(s) ce mois · ' + month.filter(function (r) { return r.status !== 'approuvee'; }).length + ' en attente</span></div>';
        h += legend() + '<div class="card flush">' + App.absPlanning(list, key) + '</div>';
        h += '<p class="muted" style="font-size:12.5px">Cliquez sur une case vide pour saisir une absence à cette date, sur une absence pour l’ouvrir. Les cases hachurées sont en attente de validation.</p>';
      }
      if (tab === 'demandes') {
        var f = App.v('absF', 'en_cours'), ft = App.v('absT', '');
        var rows = d.requests.filter(function (r) { return ids.indexOf(r.empId) > -1 && (f === 'tous' || (f === 'en_cours' ? ['en_attente_n1', 'en_attente_rh', 'a_notifier'].indexOf(r.status) > -1 : r.status === f)) && (!ft || r.type === ft); });
        h += '<div class="actions">' + App.filters('absF', [['en_cours', 'En cours'], ['approuvee', 'Approuvées'], ['refusee', 'Refusées'], ['annulee', 'Annulées'], ['tous', 'Toutes']], f) + '<select class="sel" data-change="abs-tf" aria-label="Motif"><option value="">Tous les motifs</option>' + d.types.map(function (t) { return '<option value="' + t.code + '"' + (t.code === ft ? ' selected' : '') + '>' + esc(t.label) + '</option>'; }).join('') + '</select></div>';
        h += '<div class="card flush">' + App.table('abs_req', { exportName: 'demandes_absence', rows: rows.map(function (r) { return Object.assign({ name: P.fullName(App.emp(r.empId)), svc: App.emp(r.empId).service, tl: App.absType(r.type).label }, r); }), rowAct: 'abs-open', pageSize: 30, emptyTitle: 'Aucune demande',
          cols: [{ k: 'ref', label: 'Réf.', fmt: function (v) { return '<span class="mono">' + esc(v) + '</span>'; } }, { k: 'name', label: 'Salarié', fmt: function (v, r) { return App.empCell(App.emp(r.empId), r.svc); } }, { k: 'tl', label: 'Motif', fmt: function (v, r) { return App.absIcon(App.absType(r.type)) + ' ' + esc(v); } },
            { k: 'start', label: 'Du', fmt: function (v, r) { return App.date(v) + (r.startHalf === 'pm' ? ' <small class="muted">ap.-midi</small>' : ''); } }, { k: 'end', label: 'Au', fmt: function (v, r) { return App.date(v) + (r.endHalf === 'am' ? ' <small class="muted">matin</small>' : ''); } }, { k: 'days', label: 'Jours', num: true, fmt: function (v) { return App.days(v); } },
            { k: 'status', label: 'Statut', fmt: function (v, r) { return App.absChip(r); }, exp: function (r) { return AB.STATUS[r.status][0]; } }, { k: 'proof', label: 'Justificatif', fmt: function (v, r) { return v ? App.ic('file') : (App.absType(r.type).proof ? '<span class="chip warn">Manquant</span>' : ''); } }, { k: 'createdAt', label: 'Déposée le', fmt: function (v) { return App.date(v.slice(0, 10)); } }] }) + '</div>';
      }
      if (tab === 'validations') {
        if (!queue.length) h += '<div class="card"><div class="empty"><b>Rien à valider</b>Les demandes de votre périmètre ont toutes été traitées.</div></div>';
        else h += '<div class="vq">' + queue.map(function (r) {
          var e = App.emp(r.empId), t = App.absType(r.type), bal = t.counter ? AB.balances(S(), cid(), e)[t.counter] : null, step = r.steps[r.step];
          var cov = ['TT', 'FORM'].indexOf(t.code) < 0 ? AB.dayList(S(), cid(), t.unit, r.start, r.end).map(function (x) { return Object.assign({ date: x.date }, AB.coverage(S(), cid(), e.service, x.date, r.id)); }).sort(function (a, b) { return b.pct - a.pct; })[0] : null;
          return '<article class="vq-card"><header>' + App.absIcon(t, true) + '<div><b>' + esc(P.fullName(e)) + '</b><small>' + esc(e.poste + ' · ' + e.service) + '</small></div>' + App.chip(AB.STEP_LABEL[step], step === 'notify' ? 'info' : 'warn') + '</header>' +
            '<div class="vq-main"><span class="big">' + App.days(r.days) + '</span><span>' + esc(t.label) + '<br><small class="muted">du ' + App.date(r.start) + ' au ' + App.date(r.end) + '</small></span></div>' +
            '<div class="kv sm">' + (bal ? '<span>' + esc(bal.label) + '</span><b>' + App.days(bal.disponible) + ' dispo.</b>' : '') + (cov ? '<span>Équipe absente</span><b class="' + (cov.total > 1 && (cov.absent + 1) * 100 / cov.total > AB.D(S(), cid()).settings.coverage ? 'bad-t' : '') + '">' + (cov.absent + 1) + ' / ' + cov.total + ' le ' + App.date(cov.date) + '</b>' : '') + '<span>Déposée</span><b>' + App.date(r.createdAt.slice(0, 10)) + '</b></div>' +
            (r.reason ? '<blockquote class="quote">' + esc(r.reason) + '</blockquote>' : '') + (r.warnings.length ? '<div class="callout warn sm">' + App.ic('alert') + '<span>' + r.warnings.map(esc).join('<br>') + '</span></div>' : '') +
            '<footer>' + (step === 'notify' ? '<button type="button" class="btn acc sm" data-act="abs-notify" data-id="' + r.id + '">' + App.ic('send') + 'Enregistrer et notifier</button>' : '<button type="button" class="btn acc sm" data-act="abs-decide" data-id="' + r.id + '" data-d="approve">' + App.ic('check') + 'Approuver</button>') + '<button type="button" class="btn sm" data-act="abs-decide" data-id="' + r.id + '" data-d="refuse">Refuser</button><button type="button" class="btn sm ghost" data-act="abs-open" data-id="' + r.id + '">Détail</button></footer></article>';
        }).join('') + '</div>';
        var others = d.requests.filter(function (r) { return ['en_attente_n1', 'en_attente_rh', 'a_notifier'].indexOf(r.status) > -1 && ids.indexOf(r.empId) > -1 && AB.canAct(S(), cid(), r); });
        if (others.length) h += '<div class="card flush"><div class="card-h"><h2>En attente chez quelqu’un d’autre</h2></div>' + App.table('abs_oth', { exportName: false, search: false, rows: others.map(function (r) { return Object.assign({ name: P.fullName(App.emp(r.empId)), who: A.STEP_WHO(r) }, r); }), rowAct: 'abs-open', cols: [{ k: 'ref', label: 'Réf.' }, { k: 'name', label: 'Salarié' }, { k: 'type', label: 'Motif', fmt: function (v) { return App.absIcon(App.absType(v)) + ' ' + esc(App.absType(v).label); } }, { k: 'days', label: 'Jours', num: true, fmt: App.days }, { k: 'who', label: 'Étape' }] }) + '</div>';
      }
      if (tab === 'soldes') {
        var rows2 = scope.map(function (e) { var bb = AB.balances(S(), cid(), e); return { id: e.id, e: e, name: P.fullName(e), svc: e.service, cp: bb.CP, perm: bb.PERM, rec: bb.REC }; });
        h += '<div class="callout info">' + App.ic('shield') + '<span>Le solde de congés payés vient de la paie (dernier bulletin validé : acquisition de 1,5 jour ouvrable par mois et majorations d’ancienneté). Les congés approuvés depuis sont déduits ici, puis par la paie du mois concerné : une seule source de vérité.</span></div>';
        h += '<div class="card flush">' + App.table('abs_bal', { exportName: 'soldes_conges', rows: rows2, pageSize: 40, groupBy: function (r) { return esc(r.svc); },
          cols: [{ k: 'name', label: 'Salarié', fmt: function (v, r) { return App.empCell(r.e); } }, { k: 'cpa', label: 'CP acquis', num: true, val: function (r) { return r.cp.acquis; }, fmt: App.days }, { k: 'cpp', label: 'CP pris (non encore payés)', num: true, val: function (r) { return r.cp.pris; }, fmt: App.days }, { k: 'cpw', label: 'CP en attente', num: true, val: function (r) { return r.cp.attente; }, fmt: function (v) { return v ? App.days(v) : ''; } },
            { k: 'cpd', label: 'CP disponibles', num: true, val: function (r) { return r.cp.disponible; }, fmt: function (v) { return '<b class="' + (v < 0 ? 'bad-t' : '') + '">' + App.days(v) + '</b>'; } }, { k: 'pd', label: 'Permissions', num: true, val: function (r) { return r.perm.disponible; }, fmt: function (v, r) { return App.days(v) + ' / ' + r.perm.acquis; } }, { k: 'rd', label: 'Récupération', num: true, val: function (r) { return r.rec.disponible; }, fmt: function (v) { return v ? App.days(v) : ''; } }],
          rowActions: App.can('abs.manage') ? function (r) { return '<button type="button" class="btn xs ghost" data-act="rec-credit" data-id="' + r.id + '">+ Récup.</button>'; } : null }) + '</div>';
      }
      return h + '</div>';
    }
  };
  A['abs-tf'] = function (el) { App.ui.v.absT = el.value; App.render(); };
  A['rec-credit'] = function (el) { var e = App.emp(el.dataset.id); App.confirm({ title: 'Créditer des jours de récupération', body: P.fullName(e), fields: [{ k: 'n', label: 'Jours', type: 'number', req: true, val: 1 }, { k: 'c', label: 'Motif', req: true, ph: 'Ex. : 8 h supplémentaires du 14/10 converties en repos' }], ok: 'Créditer' }).then(function (v) { if (v) run(function () { return AB.creditRecup(S(), cid(), e.id, v.n, v.c); }, 'Compteur de récupération mis à jour.'); }); };

  /* ================================================================== paramétrage */
  App.pages['abs-param'] = {
    render: function () {
      var d = AB.D(S(), cid()), tab = App.tab('abs-param', 'motifs'), can = App.can('abs.settings');
      var h = '<div class="page">' + App.head('Congés & absences · paramétrage', 'Motifs, circuits <span class="serif">et calendrier</span>', 'Chaque motif a son visuel, son impact paie, son compteur et son circuit. Les jours fériés du Cameroun sont calculés chaque année.', '');
      h += App.tabs('abs-param', [['motifs', 'Motifs d’absence', d.types.length], ['circuits', 'Circuits de validation'], ['feries', 'Jours fériés'], ['regles', 'Règles']], 'motifs');
      if (tab === 'motifs') {
        h += (can ? '<div class="actions"><button type="button" class="btn acc" data-act="type-edit">' + App.ic('plus') + 'Nouveau motif</button></div>' : '') + '<div class="type-cards2">' + d.types.map(function (t) {
          return '<article class="tcard' + (t.active === false ? ' off' : '') + '"><header>' + App.absIcon(t, true) + '<div><b>' + esc(t.label) + '</b><small>' + esc(t.code + ' · ' + t.category) + '</small></div>' + (can ? '<button type="button" class="btn xs ghost" data-act="type-edit" data-code="' + t.code + '">Modifier</button>' : '') + '</header>' +
            '<div class="tags">' + App.chip(t.paid ? 'Rémunéré' : 'Non rémunéré', t.paid ? 'ok' : 'bad') + App.chip(AB.UNITS[t.unit].split(' (')[0]) + (t.counter ? App.chip('Compteur ' + t.counter, 'info') : '') + (t.proof ? App.chip('Justificatif', 'warn') : '') + App.chip(t.approval === 'declaration' ? 'Déclaration' : 'Circuit complet') + (t.self ? App.chip('Demande en libre-service') : App.chip('Saisie gestionnaire')) + (t.halfDay ? App.chip('Demi-journée') : '') + '</div>' +
            '<small class="muted">Paie : ' + esc(AB.PAYCODES[t.payCode || '']) + (t.notice ? ' · prévenance ' + t.notice + ' j' : '') + (t.maxDays ? ' · ' + t.maxDays + ' j max.' : '') + '</small><small class="faint">' + esc(t.ref || '') + '</small></article>';
        }).join('') + '</div>';
      }
      if (tab === 'circuits') {
        var wf = d.settings.workflow, svcs = P.D(S(), cid()).employees.filter(function (e) { return e.statut !== 'sorti'; }).map(function (e) { return e.service; }).filter(function (x, i, a) { return a.indexOf(x) === i; }).sort();
        h += '<div class="grid g2">' + [['salarie', 'Le salarié demande', ['Salarié · demande depuis son espace ou WhatsApp', 'N+1 du service · valide ou refuse', 'Gestionnaire · enregistre et notifie le salarié']], ['gestionnaire', 'Le gestionnaire saisit', ['Gestionnaire · enregistre la demande (formulaire papier, appel)', 'DRH · valide ou refuse', 'Salarié · notifié automatiquement']]].map(function (x) {
          return '<button type="button" class="wf-card' + (wf === x[0] ? ' on' : '') + '" data-act="wf-set" data-v="' + x[0] + '"' + (can ? '' : ' disabled') + '><b>' + esc(x[1]) + '</b><ol>' + x[2].map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>' + (wf === x[0] ? App.chip('Circuit actif', 'ok', true) : '<span class="muted" style="font-size:12px">Choisir ce circuit</span>') + '</button>';
        }).join('') + '</div><p class="muted" style="font-size:12.5px">Toujours vrai, quel que soit le circuit : un N+1 ne valide pas sa propre demande (escalade DRH), la personne qui saisit ne valide pas, les déclarations (maladie, accident du travail) sont contrôlées par le gestionnaire sur justificatif.</p>';
        h += '<div class="card flush"><div class="card-h"><h2>N+1 par service</h2></div><div class="tbl-wrap"><table class="t"><thead><tr><th>Service</th><th>N+1 (valideur)</th><th>Effectif</th></tr></thead><tbody>' + svcs.map(function (s) { var n = P.D(S(), cid()).employees.filter(function (e) { return e.service === s && e.statut !== 'sorti'; }); return '<tr><td><b>' + esc(s) + '</b></td><td><select class="sel" data-change="mgr-set" data-svc="' + esc(s) + '"' + (can ? '' : ' disabled') + '><option value="">— DRH (pas de N+1) —</option>' + P.D(S(), cid()).employees.filter(function (e) { return e.statut !== 'sorti'; }).map(function (e) { return '<option value="' + e.matricule + '"' + (d.managers[s] === e.matricule ? ' selected' : '') + '>' + esc(P.fullName(e) + ' · ' + e.poste) + '</option>'; }).join('') + '</select></td><td class="num">' + n.length + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
        h += '<div class="card flush"><div class="card-h"><h2>Délégations</h2><span class="sub">Quand un N+1 est absent, son délégué valide à sa place</span>' + (can || App.can('abs.approve') ? '<button type="button" class="btn sm" style="margin-left:auto" data-act="dlg-new">' + App.ic('plus') + 'Délégation</button>' : '') + '</div>' + App.table('abs_dlg', { exportName: false, search: false, rows: d.delegations.map(function (x, i) { return Object.assign({ id: 'd' + i }, x); }), emptyTitle: 'Aucune délégation', cols: [{ k: 'from', label: 'N+1', fmt: function (v) { return esc(P.fullName(App.emp(v))); } }, { k: 'to', label: 'Délégué', fmt: function (v) { return esc(P.fullName(App.emp(v))); } }, { k: 'start', label: 'Du', fmt: App.date }, { k: 'end', label: 'Au', fmt: App.date }] }) + '</div>';
      }
      if (tab === 'feries') {
        var y = +App.v('holY', U.year(today())), hol = AB.holidays(S(), cid(), y);
        h += '<div class="actions"><div class="seg">' + [y - 1, y, y + 1].map(function (x) { return '<button type="button" class="' + (x === y ? 'on' : '') + '" data-act="setv" data-k="holY" data-val="' + x + '">' + x + '</button>'; }).join('') + '</div>' + (can ? '<button type="button" class="btn sm" data-act="hol-new">' + App.ic('plus') + 'Jour chômé de l’entreprise</button>' : '') + '<label class="check" style="margin-left:auto"><input type="checkbox" data-change="hol-report"' + (d.settings.reportSunday ? ' checked' : '') + (can ? '' : ' disabled') + '> Report au lundi d’un férié tombant un dimanche</label></div>';
        h += '<div class="card flush">' + App.table('abs_hol', { exportName: 'jours_feries_' + y, search: false, noPaging: true, rows: hol.map(function (x, i) { return Object.assign({ id: x.id || 'h' + i }, x); }), cols: [{ k: 'date', label: 'Date', fmt: function (v) { return '<b>' + App.date(v) + '</b> <small class="muted">' + AB.DOW[AB.dow(v)] + '</small>'; } }, { k: 'label', label: 'Jour férié' }, { k: 'kind', label: 'Type' }, { k: 'toConfirm', label: '', fmt: function (v) { return v ? App.chip('Date à confirmer par arrêté', 'warn') : ''; } }],
          rowActions: can ? function (r) { return r.custom ? '<button type="button" class="btn xs ghost" data-act="hol-del" data-id="' + r.id + '">Supprimer</button>' : ''; } : null }) + '</div>';
      }
      if (tab === 'regles') {
        var st = d.settings;
        h += '<div class="card"><div class="card-h"><h2>Règles générales</h2>' + (can ? '<button type="button" class="btn sm" style="margin-left:auto" data-act="abs-settings">Modifier</button>' : '') + '</div><div class="kv"><span>Seuil de couverture d’un service</span><b>alerte au-delà de ' + st.coverage + ' % d’absents</b><span>Solde de congés négatif</span><b>' + (st.allowNegative ? 'autorisé (avertissement)' : 'interdit') + '</b><span>Délai de dépôt des justificatifs</span><b>' + st.proofDelayH + ' h</b><span>Permissions exceptionnelles</span><b>' + st.permDays + ' jours par an</b><span>Notifications</span><b>' + ['inApp', 'whatsapp', 'email'].filter(function (k) { return st.notify[k]; }).map(function (k) { return { inApp: 'myyiel', whatsapp: 'WhatsApp', email: 'e-mail' }[k]; }).join(', ') + '</b></div></div>';
      }
      return h + '</div>';
    }
  };
  A['wf-set'] = function (el) { run(function () { if (!App.can('abs.settings')) throw new Y.BizError('Paramétrage réservé.'); AB.D(S(), cid()).settings.workflow = el.dataset.v; Y.audit(S(), cid(), 'Absences · circuit', el.dataset.v, ''); }, 'Circuit de validation mis à jour.'); };
  A['mgr-set'] = function (el) { run(function () { if (!App.can('abs.settings')) throw new Y.BizError('Paramétrage réservé.'); var m = AB.D(S(), cid()).managers; if (el.value) m[el.dataset.svc] = el.value; else delete m[el.dataset.svc]; Y.audit(S(), cid(), 'Absences · N+1', el.dataset.svc, el.value || 'DRH'); }, 'N+1 du service mis à jour.'); };
  A['hol-report'] = function (el) { run(function () { AB.D(S(), cid()).settings.reportSunday = el.checked; }); };
  A['hol-new'] = function () { App.form({ title: 'Jour chômé de l’entreprise', fields: [{ k: 'date', label: 'Date', type: 'date', req: true }, { k: 'label', label: 'Libellé', req: true, ph: 'Ex. : Fête de l’entreprise, pont du 20 mai' }, { k: 'kind', label: 'Type', type: 'select', opts: [['Entreprise', 'Entreprise'], ['Légal', 'Légal (décret exceptionnel)'], ['Local', 'Fête locale']] }], onSubmit: function (v) { return AB.addHoliday(S(), cid(), v); }, done: 'Jour ajouté au calendrier.' }); };
  A['hol-del'] = function (el) { run(function () { AB.removeHoliday(S(), cid(), el.dataset.id); }, 'Jour retiré.'); };
  A['dlg-new'] = function () { var emps = P.D(S(), cid()).employees.filter(function (e) { return e.statut !== 'sorti'; }); App.form({ title: 'Nouvelle délégation', fields: [{ k: 'from', label: 'N+1 absent', type: 'select', req: true, opts: Object.keys(AB.D(S(), cid()).managers).map(function (s) { var m = AB.D(S(), cid()).managers[s]; return [m, P.fullName(App.emp(m)) + ' · ' + s]; }) }, { k: 'to', label: 'Délégué', type: 'select', req: true, opts: emps.map(function (e) { return [e.matricule, P.fullName(e) + ' · ' + e.poste]; }) }, { k: 'start', label: 'Du', type: 'date', req: true }, { k: 'end', label: 'Au', type: 'date', req: true }], onSubmit: function (v) { if (v.from === v.to) throw new Y.BizError('Le délégué doit être une autre personne.'); if (v.end < v.start) throw new Y.BizError('Dates incohérentes.'); AB.D(S(), cid()).delegations.push({ from: v.from, to: v.to, start: v.start, end: v.end, by: App.user().name }); Y.audit(S(), cid(), 'Absences · délégation', v.from + ' → ' + v.to, v.start + ' / ' + v.end); return v; }, done: 'Délégation enregistrée.' }); };
  A['abs-settings'] = function () { var st = AB.D(S(), cid()).settings; App.form({ title: 'Règles des absences', fields: [{ k: 'coverage', label: 'Seuil de couverture (%)', type: 'number', val: st.coverage }, { k: 'permDays', label: 'Permissions exceptionnelles (jours par an)', type: 'number', val: st.permDays }, { k: 'proofDelayH', label: 'Délai de dépôt des justificatifs (heures)', type: 'number', val: st.proofDelayH }, { k: 'allowNegative', label: 'Autoriser un solde de congés négatif (avance sur congés)', type: 'check', val: st.allowNegative, span: true }, { k: 'w', label: 'Notifier par WhatsApp', type: 'check', val: st.notify.whatsapp }, { k: 'm', label: 'Notifier par e-mail', type: 'check', val: st.notify.email }], onSubmit: function (v) { Object.assign(st, { coverage: +v.coverage, permDays: +v.permDays, proofDelayH: +v.proofDelayH, allowNegative: !!v.allowNegative }); st.notify.whatsapp = !!v.w; st.notify.email = !!v.m; Y.audit(S(), cid(), 'Absences · règles', 'Paramètres', ''); return st; }, done: 'Règles enregistrées.' }); };
  A['type-edit'] = function (el) {
    var d = AB.D(S(), cid()), t = el.dataset.code ? AB.type(S(), cid(), el.dataset.code) : { color: '#4F46E5', icon: 'star', unit: 'ouvrable', approval: 'workflow', self: true, paid: true, halfDay: true, category: 'Autres' };
    App.form({ title: t.code ? 'Motif · ' + t.label : 'Nouveau motif', wide: true, fields: [
      { k: 'code', label: 'Code', req: true, val: t.code, ro: !!t.code, mono: true }, { k: 'label', label: 'Libellé', req: true, val: t.label }, { k: 'category', label: 'Catégorie', val: t.category },
      { type: 'html', html: '<div class="fld"><span>Icône</span><div class="icon-pick">' + AB.ICONS.map(function (ic) { return '<label><input type="radio" name="tp_icon" value="' + ic + '"' + (ic === t.icon ? ' checked' : '') + '><span class="abs-ic big" style="--c:' + esc(t.color) + '">' + App.ic(ic) + '</span></label>'; }).join('') + '</div></div>' },
      { k: 'color', label: 'Couleur', type: 'color', val: t.color }, { k: 'unit', label: 'Décompte', type: 'select', val: t.unit, opts: Object.keys(AB.UNITS).map(function (k) { return [k, AB.UNITS[k]]; }) },
      { k: 'payCode', label: 'Impact paie', type: 'select', val: t.payCode || '', opts: Object.keys(AB.PAYCODES).map(function (k) { return [k, AB.PAYCODES[k]]; }) }, { k: 'counter', label: 'Compteur', type: 'select', val: t.counter || '', opts: [['', 'Aucun'], ['CP', 'Congés payés'], ['PERM', 'Permissions exceptionnelles'], ['REC', 'Récupération']] },
      { k: 'approval', label: 'Traitement', type: 'select', val: t.approval, opts: [['workflow', 'Circuit de validation complet'], ['declaration', 'Déclaration contrôlée par le gestionnaire']] }, { k: 'notice', label: 'Délai de prévenance (jours)', type: 'number', val: t.notice || 0 }, { k: 'maxDays', label: 'Durée maximale (jours)', type: 'number', val: t.maxDays || '' },
      { k: 'paid', label: 'Rémunéré', type: 'check', val: t.paid }, { k: 'proof', label: 'Justificatif obligatoire', type: 'check', val: t.proof }, { k: 'halfDay', label: 'Demi-journées possibles', type: 'check', val: t.halfDay }, { k: 'self', label: 'Demandable par le salarié', type: 'check', val: t.self }, { k: 'active', label: 'Actif', type: 'check', val: t.active !== false },
      { k: 'ref', label: 'Référence (texte, convention)', val: t.ref, span: true }],
      onSubmit: function (v) {
        if (!App.can('abs.settings')) throw new Y.BizError('Paramétrage réservé.');
        var ic = (document.querySelector('input[name=tp_icon]:checked') || {}).value || 'star';
        if (!t.code && d.types.some(function (x) { return x.code === v.code; })) throw new Y.BizError('Code déjà utilisé.');
        var rec = Object.assign(t.code ? t : {}, { code: v.code, label: v.label, category: v.category || 'Autres', icon: ic, color: v.color, unit: v.unit, payCode: v.payCode || null, counter: v.counter || null, approval: v.approval, notice: +v.notice || 0, maxDays: +v.maxDays || 0, paid: !!v.paid, proof: !!v.proof, halfDay: !!v.halfDay, self: !!v.self, active: !!v.active, ref: v.ref || '' });
        if (!t.code) d.types.push(rec); Y.audit(S(), cid(), 'Absences · motif', rec.code, rec.label); return rec;
      }, done: 'Motif enregistré.' });
  };
})();

/* Mon espace (salarié) : pointage par lien WhatsApp (simulation fidèle du parcours), absences et soldes, missions, bulletins signés, informations et notice. */
(function () {
  'use strict';
  var Y = window.Yiel, U = Y.util, App = window.App, esc = App.esc, A = App.actions;
  var G = Y.GTA, AB = Y.Abs, P = Y.Paie;
  function S() { return App.S; } function cid() { return App.cid(); }
  function now() { return G.now(S(), cid()); }
  function run(fn, msg) { return App.run(fn, msg); }
  function ph() { return App.ui.v.phone || (App.ui.v.phone = { step: 'chat' }); }

  var SCEN = [
    ['site', 'Je suis au bureau', 'Position GPS dans la géozone, téléphone enregistré'],
    ['qr', 'Je scanne le QR code du site', 'Position + QR code affiché à l’accueil'],
    ['loin', 'Je suis à 1,5 km du site', 'Par exemple encore dans le taxi'],
    ['autre', 'Avec le téléphone d’un collègue', 'Tentative de pointage pour un absent'],
    ['fake', 'Avec une application de fausse localisation', 'Tentative de contournement']
  ];
  A['ph-link'] = function (el) { var me = App.me(); run(function () { var l = G.issueLink(S(), cid(), me.id, el.dataset.kind); var p = ph(); p.token = l.token; p.step = 'chat'; return l; }, 'Lien reçu sur WhatsApp.'); };
  A['ph-open'] = function (el) { var p = ph(); p.token = el.dataset.token; p.step = 'open'; p.scen = p.scen || 'site'; App.render(); };
  A['ph-scen'] = function (el) { ph().scen = el.dataset.v; App.render(); };
  A['ph-back'] = function () { var p = ph(); p.step = 'chat'; p.result = null; App.render(); };
  A['ph-consent'] = function () { var me = App.me(); run(function () { return G.consent(S(), cid(), me.id); }, 'Notice acceptée.'); };
  A['ph-send'] = function () {
    var me = App.me(), p = ph(), a = G.assign(S(), cid(), me.id), l = G.D(S(), cid()).links.find(function (x) { return x.token === p.token; });
    var tt = ((AB.cells(S(), cid(), now().slice(0, 10), now().slice(0, 10))[me.id] || {})[now().slice(0, 10)]) || null;
    var site = (tt && tt.code === 'TT' && a.home) ? { lat: a.home.lat, lng: a.home.lng, qr: '' } : (G.site(S(), cid(), a.sites[0]) || G.D(S(), cid()).sites[0]);
    var off = { site: 0.0004, qr: 0.0003, loin: 0.0135, autre: 0.0005, fake: 0.0002 }[p.scen] || 0;
    var o = { token: p.token, lat: site.lat + off, lng: site.lng + off / 3, accuracy: p.scen === 'loin' ? 35 : 12, deviceId: p.scen === 'autre' ? 'tel-collegue-' + Date.now() : (a.device && a.device.id), qr: p.scen === 'qr' ? site.qr : '', wifi: p.scen === 'site' && site.wifi ? site.wifi[0] : '', mock: p.scen === 'fake' };
    try { var r = G.punch(S(), cid(), o); p.result = r.id; p.step = 'result'; App.commit(); void l; }
    catch (e) { if (e instanceof Y.BizError) { p.error = e.message; p.step = 'result'; p.result = null; App.render(); } else throw e; }
  };

  function phoneView(me) {
    var p = ph(), d = G.D(S(), cid()), n = now(), date = n.slice(0, 10), a = G.assign(S(), cid(), me.id);
    var links = d.links.filter(function (l) { return l.empId === me.id && l.createdAt.slice(0, 10) === date; }).slice(-4);
    var body = '', foot = '';
    if (p.step === 'chat') {
      body = '<div class="ph-day">Aujourd’hui</div>' + (links.length ? links.map(function (l) { var used = !!l.usedAt, exp = !used && n > l.expiresAt; return App.bubble(esc(G.linkMessage(S(), cid(), l).split('\n')[0]).replace(/https:\S+/, '') + '<br><button type="button" class="ph-link" data-act="ph-open" data-token="' + l.token + '"' + (used || exp ? ' disabled' : '') + '>' + App.ic('link') + (used ? 'Lien utilisé à ' + l.usedAt.slice(11) : (exp ? 'Lien expiré' : 'Pointer maintenant')) + '</button>', l.createdAt.slice(11)); }).join('') : App.bubble('Aucun lien reçu aujourd’hui. Les liens arrivent automatiquement à l’heure de prise de poste.', '07:30'));
      foot = '<button type="button" class="btn sm" data-act="ph-link" data-kind="in">Demander un lien d’arrivée</button><button type="button" class="btn sm" data-act="ph-link" data-kind="out">Lien de départ</button>';
    } else if (p.step === 'open') {
      var site = G.site(S(), cid(), a.sites[0]) || {};
      body = '<div class="ph-page"><img src="' + (window.YIEL_LOGO_LIGHT || '') + '" alt="" style="height:20px"><b>Pointage de présence</b><small>' + esc(site.label || '') + ' · ' + n.slice(11) + '</small>';
      if (!a.consent) body += '<div class="ph-consent"><b>Avant votre premier pointage</b><ul>' + G.PRIVACY.slice(0, 3).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul><button type="button" class="btn acc sm" data-act="ph-consent">J’ai lu et j’accepte</button></div>';
      else body += '<span class="muted" style="font-size:11.5px">Simulation : choisissez la situation du salarié</span><div class="ph-scen">' + SCEN.map(function (s) { return '<button type="button" class="' + (p.scen === s[0] ? 'on' : '') + '" data-act="ph-scen" data-v="' + s[0] + '"><b>' + esc(s[1]) + '</b><small>' + esc(s[2]) + '</small></button>'; }).join('') + '</div><button type="button" class="btn acc" data-act="ph-send">' + App.ic('pin') + 'Envoyer ma position</button>';
      body += '</div>';
      foot = '<button type="button" class="btn sm ghost" data-act="ph-back">' + App.ic('back') + 'Retour</button>';
    } else {
      var r = p.result && d.punches.find(function (x) { return x.id === p.result; });
      body = '<div class="ph-page">' + (r ? App.ring(r.score) + App.statusChip(G.PUNCH_STATUS, r.status) + '<b>' + esc(G.PUNCH_KIND[r.kind]) + ' à ' + r.time + '</b><small>' + esc(r.siteLabel) + '</small>' + App.signals(r.details) + '<small class="muted">' + (r.status === 'valide' ? 'Votre présence est enregistrée.' : (r.status === 'a_verifier' ? 'Votre N+1 va vérifier ce pointage.' : 'Pointage refusé. Contactez votre responsable.')) + '</small>' : '<div class="errors">' + esc(p.error || 'Erreur') + '</div>') + '</div>';
      foot = '<button type="button" class="btn sm" data-act="ph-back">Terminer</button>';
    }
    return App.phone('myyiel Présence', 'Compte professionnel vérifié', body, foot);
  }

  App.pages.moi = {
    render: function () {
      var me = App.me(), tab = App.tab('moi', 'pointage');
      if (!me) {
        var demo = (S().users || []).filter(function (u) { return u.employee && u.companies.indexOf(cid()) > -1; });
        return '<div class="page">' + App.head('Mon espace', 'Mon <span class="serif">espace</span>', '', '') + '<div class="card"><div class="empty"><b>Ce compte n’est rattaché à aucun dossier salarié</b>Pour découvrir l’espace salarié, connectez-vous avec un profil rattaché :<div class="actions" style="justify-content:center;margin-top:12px">' + demo.map(function (u) { return '<button type="button" class="btn sm" data-act="as-user" data-id="' + u.id + '">' + esc(u.name) + '</button>'; }).join('') + '</div></div></div></div>';
      }
      var a = G.assign(S(), cid(), me.id), n = now(), date = n.slice(0, 10), day = G.day(S(), cid(), me, date);
      var h = '<div class="page">' + App.head('Mon espace · ' + me.matricule, 'Bonjour <span class="serif">' + esc(me.prenoms) + '</span>', esc(me.poste + ' · ' + me.service + ' · ' + ((P.est(S(), cid(), me.site) || {}).label || me.site)), App.gtaClock());
      h += App.tabs('moi', [['pointage', 'Pointage'], ['absences', 'Mes absences'], ['missions', 'Mes missions', G.D(S(), cid()).missions.filter(function (m) { return m.empIds.indexOf(me.id) > -1 && ['planifiee', 'en_route', 'sur_site'].indexOf(m.status) > -1; }).length || null], ['bulletins', 'Mes bulletins'], ['infos', 'Mes informations']], 'pointage');
      if (tab === 'pointage') {
        var lab = G.DAY_STATUS[day.status] || [day.status, ''], h0 = G.schedule(S(), cid(), a.schedule);
        var ctl = G.D(S(), cid()).controls.filter(function (c) { return c.empId === me.id && c.date === date; });
        h += '<div class="row"><div class="grow" style="display:flex;flex-direction:column;gap:14px"><div class="card"><div class="card-h"><h2>Ma journée</h2>' + App.chip(lab[0], lab[1], true) + '</div><div class="grid g3 kpis-tight"><div class="kpi"><span class="lbl">Arrivée</span><span class="val">' + (day.in || '—') + '</span><span class="delta">' + (day.lateMin ? 'retard ' + G.dur(day.lateMin) : 'horaire ' + h0.start + ' (tolérance ' + h0.tolerance + ' min)') + '</span></div><div class="kpi"><span class="lbl">Départ</span><span class="val">' + (day.out || '—') + '</span><span class="delta">fin prévue ' + h0.end + '</span></div><div class="kpi"><span class="lbl">Téléphone</span><span class="val" style="font-size:16px">' + esc(a.device ? a.device.label : 'non enregistré') + '</span><span class="delta">seul appareil accepté</span></div></div>' +
          (day.punches.length ? '<div class="list" style="margin-top:10px">' + day.punches.map(function (p) { return '<div><span class="mono">' + p.time + '</span><span style="flex:1">' + esc(G.PUNCH_KIND[p.kind]) + ' · ' + esc(p.siteLabel || '') + '</span>' + App.scoreChip(p.score) + App.statusChip(G.PUNCH_STATUS, p.status) + '</div>'; }).join('') + '</div>' : '') + '</div>' +
          (ctl.length ? '<div class="card"><div class="card-h"><h2>Contrôles de présence</h2></div><div class="list">' + ctl.map(function (c) { return '<div><span style="flex:1">Reçu à ' + c.sentAt.slice(11) + ' · réponse avant ' + c.deadline.slice(11) + '</span>' + App.statusChip(G.CONTROL_RESULT, c.result) + (c.result === 'en_attente' ? '<button type="button" class="btn xs acc" data-act="ph-open" data-token="' + c.token + '">Répondre</button>' : '') + '</div>'; }).join('') + '</div></div>' : '') +
          '<div class="card tip">' + App.ic('shield') + '<div><b>Comment pointer</b><span>À votre arrivée, vous recevez un lien personnel sur WhatsApp. Ouvrez-le sur le site : votre position est vérifiée une seule fois, à cet instant. Pas d’application à installer, pas de suivi en dehors du pointage.</span></div></div></div>';
        h += '<div class="side">' + phoneView(me) + '</div></div>';
      }
      if (tab === 'absences') {
        var bal = AB.balances(S(), cid(), me), mine = AB.D(S(), cid()).requests.filter(function (r) { return r.empId === me.id; });
        h += '<div class="grid g3">' + ['CP', 'PERM', 'REC'].map(function (k) { var b = bal[k], pct = b.acquis > 0 ? Math.max(0, Math.min(100, b.disponible * 100 / b.acquis)) : 0, t = AB.D(S(), cid()).types.find(function (x) { return x.counter === k; }); return '<div class="card bal">' + App.absIcon(t, true) + '<div><span class="lbl">' + esc(b.label) + '</span><span class="val">' + App.days(b.disponible) + '</span><div class="prog"><i style="width:' + pct + '%;background:' + (t ? t.color : 'var(--brand)') + '"></i></div><small class="muted">' + App.days(b.acquis) + ' acquis · ' + App.days(b.pris) + ' pris · ' + App.days(b.attente) + ' en attente</small></div></div>'; }).join('') + '</div>';
        h += '<div class="actions"><button type="button" class="btn acc" data-act="abs-new">' + App.ic('plus') + 'Nouvelle demande</button><span class="muted" style="font-size:12.5px">Votre N+1 : <b>' + esc(((AB.managerOf(S(), cid(), me)) ? P.fullName(AB.managerOf(S(), cid(), me)) : 'la DRH')) + '</b></span></div>';
        h += '<div class="card flush">' + App.table('moi_abs', { exportName: false, rows: mine.map(function (r) { return Object.assign({ tl: App.absType(r.type).label }, r); }), rowAct: 'abs-open', emptyTitle: 'Aucune demande', search: false,
          cols: [{ k: 'tl', label: 'Motif', fmt: function (v, r) { return App.absIcon(App.absType(r.type)) + ' ' + esc(v); } }, { k: 'start', label: 'Du', fmt: App.date }, { k: 'end', label: 'Au', fmt: App.date }, { k: 'days', label: 'Jours', num: true, fmt: App.days }, { k: 'status', label: 'Statut', fmt: function (v, r) { return App.absChip(r); } }, { k: 'who', label: 'Où en est-elle ?', val: function (r) { return ['approuvee', 'refusee', 'annulee'].indexOf(r.status) > -1 ? (r.notified ? 'Notifiée le ' + App.date(r.notified.at.slice(0, 10)) : '') : A.STEP_WHO(r); } }] }) + '</div>';
      }
      if (tab === 'missions') {
        var ms = G.D(S(), cid()).missions.filter(function (m) { return m.empIds.indexOf(me.id) > -1; });
        h += ms.length ? '<div class="vq">' + ms.map(function (m) { var v = G.missionView(S(), cid(), m, n); return '<article class="vq-card"><header><span class="abs-ic big" style="--c:var(--info)">' + App.ic('route') + '</span><div><b>' + esc(m.label) + '</b><small>' + esc(m.ref + ' · ' + m.from.label + ' → ' + m.to.label) + '</small></div>' + App.chip(v.label, v.tone, true) + '</header><div class="prog"><i style="width:' + v.progress + '%"></i></div><div class="kv sm"><span>Départ prévu</span><b>' + App.timeLabel(m.plannedStart) + '</b><span>Arrivée prévue</span><b>' + App.timeLabel(m.plannedArrival) + '</b>' + (m.status === 'en_route' ? '<span>Arrivée estimée</span><b>' + v.eta.slice(11) + ' · ' + v.remainingKm + ' km</b>' : '') + '</div>' +
          (m.arrivalPrompt ? '<div class="callout ok">' + App.ic('pin') + '<span>Vous semblez être arrivé sur le site ' + esc(m.to.label) + '.</span></div>' : '') + '<footer>' + (m.status === 'planifiee' ? '<button type="button" class="btn acc sm" data-act="ms-do" data-id="' + m.id + '" data-do="start">' + App.ic('play') + 'Démarrer ma mission</button>' : '') + (m.status === 'en_route' ? '<button type="button" class="btn acc sm" data-act="ms-do" data-id="' + m.id + '" data-do="arrive">Confirmer mon arrivée</button>' : '') + (m.status === 'en_route' || m.status === 'sur_site' ? '<button type="button" class="btn sm" data-act="ms-do" data-id="' + m.id + '" data-do="end">Terminer ma mission</button>' : '') + '<button type="button" class="btn sm ghost" data-act="ms-open" data-id="' + m.id + '">Détail</button></footer></article>'; }).join('') + '</div>' : '<div class="card"><div class="empty"><b>Aucune mission</b>Vos ordres de mission apparaîtront ici et sur WhatsApp.</div></div>';
        h += '<div class="callout">' + App.ic('shield') + '<span>Votre position n’est suivie qu’entre « Démarrer ma mission » et « Terminer ma mission ». À la fin, le suivi s’arrête automatiquement.</span></div>';
      }
      if (tab === 'bulletins') {
        var pd = P.D(S(), cid()), keys = Object.keys(pd.periods).filter(function (k) { return P.isFrozen(pd.periods[k]) && pd.periods[k].slips[me.id]; }).sort().reverse();
        h += '<div class="card flush">' + App.table('moi_slips', { exportName: false, search: false, rows: keys.map(function (k) { var s = pd.periods[k].slips[me.id]; return { id: k, k: k, net: s.totals.net, brut: s.totals.brut, signed: !!s.signed }; }), emptyTitle: 'Aucun bulletin validé',
          cols: [{ k: 'k', label: 'Période', fmt: function (v) { return '<b>' + esc(P.monthLabel(v)) + '</b>'; } }, { k: 'brut', label: 'Brut', num: true, fmt: function (v) { return U.fmt(v); } }, { k: 'net', label: 'Net payé', num: true, fmt: function (v) { return '<b>' + U.fmt(v) + '</b>'; } }, { k: 'signed', label: 'Signature DRH', fmt: function (v) { return v ? App.chip('Signé', 'ok', true) : App.chip('En cours de signature', 'warn', true); } }],
          rowActions: function (r) { return '<button type="button" class="btn xs" data-act="slip-view" data-k="' + r.k + '" data-id="' + me.id + '">Voir</button> <button type="button" class="btn xs ghost" data-act="slip-pdf" data-k="' + r.k + '" data-id="' + me.id + '">' + App.ic('pdf') + 'PDF</button>'; } }) + '</div>';
      }
      if (tab === 'infos') {
        h += '<div class="grid g2"><div class="card"><div class="card-h"><h2>Mon dossier</h2></div><div class="kv"><span>Matricule</span><b>' + esc(me.matricule) + '</b><span>Poste</span><b>' + esc(me.poste) + '</b><span>Service</span><b>' + esc(me.service) + '</b><span>Contrat</span><b>' + esc(me.contrat) + ' depuis le ' + App.date(me.embauche) + '</b><span>Horaire</span><b>' + esc(G.schedule(S(), cid(), a.schedule).label) + '</b><span>Sites de pointage</span><b>' + esc(a.sites.map(function (c) { return (G.site(S(), cid(), c) || {}).label || c; }).join(', ')) + '</b></div><p class="muted" style="font-size:12.5px">Une information à corriger ? Signalez-la aux RH : toute modification est tracée.</p></div>' +
          '<div class="card"><div class="card-h"><h2>Géolocalisation : vos droits</h2><span class="sub">' + (a.consent ? 'Acceptée le ' + App.date(a.consent.at.slice(0, 10)) : 'Non acceptée') + '</span></div><ol class="privacy">' + G.PRIVACY.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ol></div></div>';
      }
      return h + '</div>';
    }
  };
  A['as-user'] = function (el) { var u = S().users.find(function (x) { return x.id === el.dataset.id; }); S().meta.currentUser = { id: u.id, name: u.name, role: u.role }; App.toast('Connecté en tant que ' + u.name, 'ok'); App.commit(); };
})();

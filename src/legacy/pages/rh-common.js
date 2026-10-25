/* Temps, absences, stocks · composants partagés : icônes et visuels des motifs, carte schématique du Cameroun, téléphone WhatsApp simulé, badges de score. */
(function () {
  'use strict';
  var Y = window.Yiel, U = Y.util, App = window.App, esc = App.esc;
  Object.assign(App.ICONS, {
    menu: 'M4 6h16M4 12h16M4 18h16', stocks: 'M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10', gta: 'M12 21s-7-6.2-7-11a7 7 0 0114 0c0 4.8-7 11-7 11zM12 6.5V10l2.5 1.5',
    abs: 'M4 6h16v14H4zM4 10h16M9 3v4M15 3v4M10 14l4 4M14 14l-4 4', moi: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c1-4 4-6 8-6s7 2 8 6',
    'gta-missions': 'M6 19a2 2 0 100-4 2 2 0 000 4zM18 9a2 2 0 100-4 2 2 0 000 4zM6 15V9a4 4 0 014-4h2M18 9v6a4 4 0 01-4 4h-6', 'gta-feuilles': 'M6 3h9l4 4v14H6zM9 12h6M9 16h6M9 8h3',
    'gta-param': 'M12 21s-7-6.2-7-11a7 7 0 0114 0c0 4.8-7 11-7 11zM12 7a3 3 0 100 6 3 3 0 000-6z', 'abs-param': 'M4 6h16v14H4zM4 10h16M9 3v4M15 3v4',
    sun: 'M12 8a4 4 0 100 8 4 4 0 000-8zM12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5', heart: 'M12 20s-7-4.4-9-9a5 5 0 019-3 5 5 0 019 3c-2 4.6-9 9-9 9z',
    baby: 'M12 4a3 3 0 100 6 3 3 0 000-6zM7 21v-5a5 5 0 0110 0v5M9 21h6', leaf: 'M5 19c0-8 6-14 15-14 0 9-6 15-14 15M5 19l7-7', thermo: 'M10 4a2 2 0 014 0v10a4 4 0 11-4 0zM12 9v7',
    stroller: 'M5 5h6v7H4M4 12h15a6 6 0 01-6 6H9M7 21a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM16 21a1.5 1.5 0 100-3 1.5 1.5 0 000 3z', book: 'M4 5a2 2 0 012-2h12v15H6a2 2 0 00-2 2zM4 5v15a2 2 0 002 2h12v-4',
    home: 'M3 11l9-7 9 7M5 10v10h14V10M10 20v-6h4v6', pause: 'M12 3a9 9 0 100 18 9 9 0 000-18zM10 9v6M14 9v6', alert: 'M12 3l10 18H2zM12 10v5M12 18h.01',
    star: 'M12 3l2.8 5.8 6.2.9-4.5 4.4 1 6.2L12 17.4 6.5 20.3l1-6.2L3 9.7l6.2-.9z', plane: 'M10.5 13.5L3 11l18-7-7 18-2.5-7.5', briefcase: 'M4 8h16v11H4zM9 8V5h6v3M4 13h16',
    cross: 'M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6z', pin: 'M12 21s-7-6.2-7-11a7 7 0 0114 0c0 4.8-7 11-7 11zM12 7a3 3 0 100 6 3 3 0 000-6z',
    route: 'M6 19a2 2 0 100-4 2 2 0 000 4zM18 9a2 2 0 100-4 2 2 0 000 4zM6 15V9a4 4 0 014-4h2M18 9v6a4 4 0 01-4 4h-6', qr: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2',
    wifi: 'M2 9a15 15 0 0120 0M5 12.5a10 10 0 0114 0M8.5 16a5 5 0 017 0M12 20h.01', gps: 'M12 8a4 4 0 100 8 4 4 0 000-8zM12 2v3M12 19v3M2 12h3M19 12h3',
    clock: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3 2', map: 'M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15', truck: 'M3 6h11v10H3zM14 10h4l3 3v3h-7M7 19a2 2 0 100-4 2 2 0 000 4zM17 19a2 2 0 100-4 2 2 0 000 4z',
    'in': 'M12 3v10M8 9l4 4 4-4M4 15v5h16v-5', out: 'M12 13V3M8 7l4-4 4 4M4 15v5h16v-5', swap: 'M4 8h13l-3-3M20 16H7l3 3', clip: 'M9 4h6v3H9zM7 5H5v16h14V5h-2M8 12l2 2 4-4',
    fwd: 'M5 12h14M13 6l6 6-6 6', team: 'M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2 20c.8-3.5 3.5-5 7-5s6.2 1.5 7 5M16 4.5a3.5 3.5 0 010 6.5M18 15c2 .6 3.4 2.2 4 5'
  });

  /* ------------------------------------------------------------------ motifs */
  App.absIcon = function (t, big) { if (!t) return ''; return '<span class="abs-ic' + (big ? ' big' : '') + '" style="--c:' + esc(t.color) + '" title="' + esc(t.label) + '">' + App.ic(t.icon || 'cal') + '</span>'; };
  App.absType = function (code) { return Y.Abs.type(App.S, App.cid(), code); };
  App.absChip = function (r) { var s = Y.Abs.STATUS[r.status] || ['?', '']; return App.chip(s[0], s[1], true); };
  App.days = function (n) { return String(Math.round(n * 100) / 100).replace('.', ',') + ' j'; };
  App.emp = function (id) { return Y.Paie.emp(App.S, App.cid(), id); };
  App.empCell = function (e, sub) { if (!e) return '—'; var ini = ((e.prenoms || '')[0] || '') + ((e.nom || '')[0] || ''); return '<span class="who-cell"><span class="ava" aria-hidden="true">' + esc(ini.toUpperCase()) + '</span><span><b>' + esc(Y.Paie.fullName(e)) + '</b><small>' + esc(sub !== undefined ? sub : e.matricule + ' · ' + e.poste) + '</small></span></span>'; };
  App.scoreChip = function (score) { if (score == null) return '<span class="chip">Saisie</span>'; var tone = score >= 70 ? 'ok' : (score >= 40 ? 'warn' : 'bad'); return '<span class="score ' + tone + '" title="Score de confiance">' + score + '</span>'; };
  App.statusChip = function (map, k) { var s = map[k] || [k, '']; return App.chip(s[0], s[1], true); };
  App.timeLabel = function (iso) { return iso ? U.frDate(iso.slice(0, 10)) + ' ' + iso.slice(11, 16) : ''; };
  App.me = function () { try { return Y.Abs.me(App.S, App.cid()); } catch (e) { return null; } };

  /* ------------------------------------------------------------- carte schématique */
  // Contour simplifié du Cameroun (longitude, latitude) : carte schématique, sans fond cartographique externe.
  var CM = [[8.50, 4.52], [8.62, 4.90], [8.85, 5.40], [9.20, 6.00], [9.75, 6.45], [10.15, 6.90], [10.60, 6.95], [11.10, 6.45], [11.55, 6.85], [11.85, 7.30], [12.05, 7.65], [12.25, 8.30], [12.75, 8.75], [12.90, 9.40], [13.25, 10.10], [13.60, 10.80], [13.85, 11.10], [14.15, 11.60], [14.10, 12.20], [14.20, 12.70], [14.45, 13.05],
    [14.65, 12.85], [14.85, 12.50], [15.05, 12.10], [15.05, 11.55], [15.10, 10.90], [15.45, 10.15], [14.95, 9.95], [14.20, 9.90], [13.95, 9.60], [14.40, 9.00], [15.20, 8.50], [15.50, 7.55], [15.15, 6.95], [14.75, 6.25], [14.60, 5.40], [14.55, 4.60], [15.10, 3.90], [15.75, 3.10], [16.05, 2.75], [16.20, 2.20],
    [15.90, 1.85], [15.00, 2.00], [14.00, 2.25], [13.20, 2.25], [12.00, 2.30], [11.35, 2.20], [10.00, 2.17], [9.81, 2.35], [9.86, 2.90], [9.75, 3.55], [9.62, 3.85], [9.40, 3.95], [9.20, 3.98], [8.95, 4.15], [8.70, 4.38]];
  var LABEL_CITIES = ['Douala', 'Yaoundé', 'Edéa', 'Kribi', 'Bertoua', 'Bafoussam', 'Limbé', 'Ebolowa', 'Ayos', 'Garoua', 'Ngaoundéré', 'Maroua', 'Bamenda', 'Nkongsamba'];
  App.cmMap = function (o) {
    o = o || {}; var G = Y.GTA, W = o.w || 640, H = o.h || 420, pad = 0.35;
    var pts = [];
    (o.sites || []).forEach(function (s) { pts.push([s.lng, s.lat]); });
    (o.views || []).forEach(function (v) { v.m.route.forEach(function (r) { pts.push([r.lng, r.lat]); }); });
    if (!pts.length) pts = [[9.7, 4.05], [11.5, 3.85]];
    var minX = Math.min.apply(null, pts.map(function (p) { return p[0]; })) - pad, maxX = Math.max.apply(null, pts.map(function (p) { return p[0]; })) + pad;
    var minY = Math.min.apply(null, pts.map(function (p) { return p[1]; })) - pad, maxY = Math.max.apply(null, pts.map(function (p) { return p[1]; })) + pad;
    var k = Math.cos(((minY + maxY) / 2) * Math.PI / 180), sx = (maxX - minX) * k, sy = maxY - minY, sc = Math.min(W / sx, H / sy);
    var ox = (W - sx * sc) / 2, oy = (H - sy * sc) / 2;
    function X(lng) { return (ox + (lng - minX) * k * sc).toFixed(1); } function Yy(lat) { return (oy + (maxY - lat) * sc).toFixed(1); }
    var h = '<svg class="cmmap" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.label || 'Carte schématique des missions') + '"><defs><clipPath id="mapclip"><rect width="' + W + '" height="' + H + '" rx="12"></rect></clipPath></defs><g clip-path="url(#mapclip)"><rect width="' + W + '" height="' + H + '" class="sea"></rect>';
    h += '<path class="land" d="M' + CM.map(function (p) { return X(p[0]) + ' ' + Yy(p[1]); }).join('L') + 'Z"></path>';
    Object.keys(G.CITIES).forEach(function (c) { var p = G.CITIES[c], x = +X(p[1]), y = +Yy(p[0]); if (x < -20 || y < -20 || x > W + 20 || y > H + 20) return; h += '<circle class="city" cx="' + x + '" cy="' + y + '" r="2.4"></circle>' + (LABEL_CITIES.indexOf(c) > -1 ? '<text class="cityl" x="' + (x + 5) + '" y="' + (y - 4) + '">' + esc(c) + '</text>' : ''); });
    (o.sites || []).forEach(function (s) { var x = X(s.lng), y = Yy(s.lat); h += '<g class="site"><rect x="' + (x - 4) + '" y="' + (y - 4) + '" width="8" height="8" rx="2"></rect></g>'; });
    (o.views || []).forEach(function (v, i) {
      var m = v.m, col = { bad: 'var(--bad)', warn: '#D97706', ok: 'var(--ok)', info: 'var(--info)' }[v.tone] || '#6B7280';
      h += '<polyline class="plan" points="' + m.route.map(function (r) { return X(r.lng) + ',' + Yy(r.lat); }).join(' ') + '"></polyline>';
      if (m.track.length > 1) h += '<polyline class="trk" style="stroke:' + col + '" points="' + m.track.map(function (r) { return X(r.lng) + ',' + Yy(r.lat); }).join(' ') + '"></polyline>';
      var p = v.last || { lat: m.from.lat, lng: m.from.lng }, x = +X(p.lng), y = +Yy(p.lat), live = m.status === 'en_route';
      var ini = (m.empIds.map(function (id) { var e = Y.Paie.emp(App.S, App.cid(), id); return e ? (e.prenoms[0] + e.nom[0]).toUpperCase() : ''; }).join('+'));
      h += '<g class="dot' + (live ? ' live' : '') + '" data-act="ms-open" data-id="' + m.id + '" style="--c:' + col + '"><circle class="halo" cx="' + x + '" cy="' + y + '" r="11"></circle><circle cx="' + x + '" cy="' + y + '" r="6.5"></circle><text x="' + (x + 10) + '" y="' + (y + 4) + '" class="dotl">' + esc(ini) + '</text></g>';
      var end = m.route[m.route.length - 1]; h += '<g class="dest"><circle cx="' + X(end.lng) + '" cy="' + Yy(end.lat) + '" r="4.5"></circle></g>';
      void i;
    });
    h += '</g></svg>';
    return h;
  };
  /** Mini-carte d'un pointage : géozone (cercle) et position déclarée. */
  App.punchMap = function (p) {
    var s = Y.GTA.site(App.S, App.cid(), p.siteCode); if (!s || p.lat == null) return '';
    var W = 260, H = 160, R = Math.max(s.radius * 4, (p.distance || 0) * 1.3, 300), sc = (H / 2 - 10) / R, k = 111320;
    var dx = (p.lng - s.lng) * k * Math.cos(s.lat * Math.PI / 180) * sc, dy = -(p.lat - s.lat) * k * sc;
    return '<svg class="pmap" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Position par rapport à la géozone"><rect width="' + W + '" height="' + H + '" rx="10" class="sea"></rect><circle cx="' + W / 2 + '" cy="' + H / 2 + '" r="' + (s.radius * sc).toFixed(1) + '" class="zone"></circle><rect x="' + (W / 2 - 4) + '" y="' + (H / 2 - 4) + '" width="8" height="8" rx="2" class="sitept"></rect>' +
      (p.accuracy ? '<circle cx="' + (W / 2 + dx).toFixed(1) + '" cy="' + (H / 2 + dy).toFixed(1) + '" r="' + Math.max(3, p.accuracy * sc).toFixed(1) + '" class="acc"></circle>' : '') + '<circle cx="' + (W / 2 + dx).toFixed(1) + '" cy="' + (H / 2 + dy).toFixed(1) + '" r="5" class="me ' + (p.status === 'valide' ? 'ok' : (p.status === 'rejete' ? 'bad' : 'warn')) + '"></circle><text x="10" y="' + (H - 10) + '" class="scale">Rayon ' + s.radius + ' m · ' + esc(s.label) + '</text></svg>';
  };
  /** Détail des signaux d'un score. */
  App.signals = function (details) {
    return '<ul class="sig-list">' + (details || []).map(function (d) { return '<li class="' + (d.pts > 0 ? 'ok' : (d.pts < 0 ? 'bad' : 'neu')) + '"><span class="pts">' + (d.pts > 0 ? '+' : '') + d.pts + '</span><span><b>' + esc(d.label) + '</b><small>' + esc(d.text || '') + '</small></span></li>'; }).join('') + '</ul>';
  };

  /* -------------------------------------------------------- téléphone WhatsApp simulé */
  App.phone = function (title, sub, body, foot) {
    return '<div class="phone" aria-label="Simulation du téléphone du salarié"><div class="ph-notch"></div><div class="ph-head"><span class="ph-ava">' + App.ic('chat') + '</span><span><b>' + esc(title) + '</b><small>' + esc(sub || '') + '</small></span></div><div class="ph-body">' + body + '</div>' + (foot ? '<div class="ph-foot">' + foot + '</div>' : '') + '</div>';
  };
  App.bubble = function (text, time, mine) { return '<div class="bub' + (mine ? ' me' : '') + '">' + text + '<small>' + esc(time || '') + '</small></div>'; };

  /* ------------------------------------------------------------- notifications */
  App.extraNotifs = function () {
    var l = [];
    try { l = l.concat(Y.GTA.notifications(App.S, App.cid())); } catch (e) { /* rien */ }
    try { l = l.concat(Y.Abs.notifications(App.S, App.cid())); } catch (e) { /* rien */ }
    try { if (App.can('stock')) l = l.concat(Y.Stock.alerts(App.S, App.cid())); } catch (e) { /* rien */ }
    return l;
  };
})();

/*
 * myyiel Temps & présence (GTA) · moteur (pur JavaScript, sans DOM, exécutable sous Node).
 * Conçu pour l'Afrique, sans pointeuse physique :
 * - pointage par lien WhatsApp personnel à usage unique (10 min), géolocalisé, contrôlé par géozone ;
 * - score de confiance multi-signaux (géozone, précision GPS, téléphone enregistré, QR code du site, Wi-Fi, détection de position fictive, vitesse impossible) ;
 * - contrôles de présence aléatoires dans la journée ;
 * - missions terrain : suivi de position UNIQUEMENT entre « Démarrer » et « Terminer », écart d'itinéraire, ETA, arrivée détectée ;
 * - feuilles de temps calculées (retards, absences injustifiées, heures supplémentaires par semaine HS1/HS2/HS3/HSN), validées par le N+1 ;
 * - transmission à la paie au format myyiel.time-events/1 : les pointages ont une incidence réelle sur le salaire.
 * Spécifications : docs/rh/01-gta-presence.md
 */
import { Y } from './registry.js';

var U = Y.util;
var G = Y.GTA = {};
function fail(m) { throw new Y.BizError(m); }
function role(S) { return (S.meta.currentUser || {}).role || 'reader'; }
G.can = function (S, right) { return Y.can(role(S), right); };
function need(S, right) { if (G._bypass) return; if (!G.can(S, right)) fail('Action réservée : ' + (Y.RIGHTS[right] || right).toLowerCase() + ' (rôle actuel : ' + ((Y.ROLES[role(S)] || {}).label || role(S)) + ').'); }
function who(S) { var u = S.meta.currentUser || {}; return { by: u.name || 'Système', role: role(S), at: new Date().toISOString() }; }
function P() { return Y.Paie; }
function A() { return Y.Abs; }
function hm(t) { var p = String(t).split(':'); return (+p[0]) * 60 + (+p[1] || 0); }
function fmtHM(min) { min = Math.round(min); return U.pad(Math.floor(min / 60), 2) + ':' + U.pad(min % 60, 2); }
G.hm = hm; G.fmtHM = fmtHM;
G.dur = function (min) { min = Math.round(min || 0); var h = Math.floor(Math.abs(min) / 60), m = Math.abs(min) % 60; return (min < 0 ? '−' : '') + (h ? h + ' h' + (m ? ' ' + U.pad(m, 2) : '') : m + ' min'); };

/* ======================================================================= géographie */
G.dist = function (a, b, c, d) { // haversine, mètres
  var R = 6371000, t = Math.PI / 180, dLat = (c - a) * t, dLng = (d - b) * t;
  var x = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a * t) * Math.cos(c * t) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
};
G.CITIES = {
  Douala: [4.0511, 9.7679], 'Yaoundé': [3.8480, 11.5021], 'Edéa': [3.8000, 10.1333], Kribi: [2.9373, 9.9077], Bipaga: [3.2050, 9.9650], Lolabé: [2.6500, 9.8500],
  Bertoua: [4.5770, 13.6846], Ayos: [3.9036, 12.5242], 'Abong-Mbang': [3.9833, 13.1833], Bafoussam: [5.4781, 10.4176], 'Limbé': [4.0242, 9.2149], Buea: [4.1527, 9.2410],
  Mbalmayo: [3.5180, 11.5000], Pouma: [3.8500, 10.5300], 'Boumnyébel': [3.8833, 10.8500], Ebolowa: [2.9000, 11.1500], Nkongsamba: [4.9547, 9.9404], Bamenda: [5.9597, 10.1460],
  Dschang: [5.4500, 10.0500], 'Ngaoundéré': [7.3277, 13.5847], Garoua: [9.3000, 13.4000], Maroua: [10.5956, 14.3247], 'Mbanga': [4.5014, 9.5672], 'Loum': [4.7182, 9.7351], Bafang: [5.1580, 10.1820]
};
G.ROUTES = {
  'Yaoundé>Douala': ['Yaoundé', 'Boumnyébel', 'Pouma', 'Edéa', 'Douala'], 'Douala>Kribi': ['Douala', 'Edéa', 'Bipaga', 'Kribi'], 'Yaoundé>Bertoua': ['Yaoundé', 'Ayos', 'Abong-Mbang', 'Bertoua'],
  'Douala>Bafoussam': ['Douala', 'Mbanga', 'Loum', 'Nkongsamba', 'Bafang', 'Bafoussam'], 'Douala>Limbé': ['Douala', 'Limbé'], 'Douala>Buea': ['Douala', 'Buea'], 'Yaoundé>Ebolowa': ['Yaoundé', 'Mbalmayo', 'Ebolowa'],
  'Yaoundé>Kribi': ['Yaoundé', 'Edéa', 'Bipaga', 'Kribi'], 'Douala>Yaoundé': ['Douala', 'Edéa', 'Pouma', 'Boumnyébel', 'Yaoundé']
};
G.route = function (fromCity, toCity) {
  var r = G.ROUTES[fromCity + '>' + toCity] || (G.ROUTES[toCity + '>' + fromCity] || []).slice().reverse();
  if (!r.length) r = [fromCity, toCity];
  return r.filter(function (c) { return G.CITIES[c]; }).map(function (c) { return { label: c, lat: G.CITIES[c][0], lng: G.CITIES[c][1] }; });
};
function polyLen(pts) { var t = 0; for (var i = 1; i < pts.length; i++) t += G.dist(pts[i - 1].lat, pts[i - 1].lng, pts[i].lat, pts[i].lng); return t; }
G.polyLen = polyLen;
/** Point situé à `m` mètres le long d'un itinéraire. */
G.along = function (pts, m) {
  for (var i = 1; i < pts.length; i++) {
    var seg = G.dist(pts[i - 1].lat, pts[i - 1].lng, pts[i].lat, pts[i].lng);
    if (m <= seg) { var f = seg ? m / seg : 0; return { lat: pts[i - 1].lat + (pts[i].lat - pts[i - 1].lat) * f, lng: pts[i - 1].lng + (pts[i].lng - pts[i - 1].lng) * f }; }
    m -= seg;
  }
  var l = pts[pts.length - 1]; return { lat: l.lat, lng: l.lng };
};
/** Distance d'un point à l'itinéraire (mètres) et distance parcourue le long de celui-ci (projection). */
G.project = function (pts, lat, lng) {
  var best = { d: Infinity, along: 0 }, acc = 0, k = Math.cos(lat * Math.PI / 180) * 111320, ky = 110540;
  for (var i = 1; i < pts.length; i++) {
    var ax = pts[i - 1].lng * k, ay = pts[i - 1].lat * ky, bx = pts[i].lng * k, by = pts[i].lat * ky, px = lng * k, py = lat * ky;
    var vx = bx - ax, vy = by - ay, L2 = vx * vx + vy * vy, f = L2 ? Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / L2)) : 0;
    var qx = ax + f * vx, qy = ay + f * vy, dd = Math.sqrt((px - qx) * (px - qx) + (py - qy) * (py - qy)), seg = Math.sqrt(L2);
    if (dd < best.d) best = { d: dd, along: acc + f * seg };
    acc += seg;
  }
  return best;
};
G.nearestCity = function (lat, lng) { var best = null, bd = Infinity; Object.keys(G.CITIES).forEach(function (c) { var dd = G.dist(lat, lng, G.CITIES[c][0], G.CITIES[c][1]); if (dd < bd) { bd = dd; best = c; } }); return bd < 15000 ? best : (best ? 'vers ' + best : ''); };

/* ======================================================================= données */
G.DEFAULT_SCHEDULES = [
  { code: 'ADM', label: 'Administratif · lun. → ven. 08:00-17:00', days: [1, 2, 3, 4, 5], start: '08:00', end: '17:00', breakMin: 60, tolerance: 10 },
  { code: 'TER', label: 'Terrain · lun. → ven. 07:30-16:30', days: [1, 2, 3, 4, 5], start: '07:30', end: '16:30', breakMin: 60, tolerance: 15 },
  { code: 'SIX', label: 'Six jours · lun. → sam. 07:30-14:10', days: [1, 2, 3, 4, 5, 6], start: '07:30', end: '14:10', breakMin: 0, tolerance: 10 }
];
G.SITE_TYPES = { siege: 'Siège', agence: 'Agence', client: 'Site client', chantier: 'Chantier / dépôt', domicile: 'Domicile (télétravail)' };
G.D = function (S, cid) {
  var d = Y.D(S, cid);
  if (!d.gta) d.gta = { sites: [], schedules: U.clone(G.DEFAULT_SCHEDULES), assign: {}, punches: [], links: [], controls: [], missions: [], sheets: {}, exports: [], seq: { mission: 0 },
    settings: { scoreAuto: 70, scoreReject: 40, linkMinutes: 10, otMinMin: 30, controls: { enabled: true, perDay: 3, answerMin: 15, from: '09:30', to: '16:00' }, retentionDays: 90, deviationKm: 5, departureGraceMin: 30, delayAlertMin: 15, speedKmh: 65, maxSpeedKmh: 150, requireConsent: true, privacyVersion: '2026-10', demoNow: null } };
  return d.gta;
};
G.site = function (S, cid, code) { return G.D(S, cid).sites.find(function (s) { return s.code === code || s.id === code; }); };
G.schedule = function (S, cid, code) { var d = G.D(S, cid); return d.schedules.find(function (s) { return s.code === code; }) || d.schedules[0]; };
G.assign = function (S, cid, empId) { var d = G.D(S, cid); return d.assign[empId] || (d.assign[empId] = { schedule: d.schedules[0].code, sites: [], mode: 'site', device: null, consent: null }); };
/** Horloge : réelle en production ; horloge de démonstration figée dans le jeu d'essai (avançable). */
G.now = function (S, cid) { var s = G.D(S, cid).settings; if (s.demoNow) return s.demoNow; var d = new Date(); return S.meta.today + 'T' + U.pad(d.getHours(), 2) + ':' + U.pad(d.getMinutes(), 2); };
function addMin(iso, n) { var d = new Date(iso + ':00'); d.setMinutes(d.getMinutes() + n); return U.ymd(d) + 'T' + U.pad(d.getHours(), 2) + ':' + U.pad(d.getMinutes(), 2); }
G.addMin = addMin;
function minBetween(a, b) { return Math.round((new Date(b + ':00') - new Date(a + ':00')) / 60000); }
G.minBetween = minBetween;
G.scope = function (S, cid) { return A().scope(S, cid); };

/* ======================================================================= paramétrage */
G.saveSite = function (S, cid, s) {
  need(S, 'gta.manage'); var d = G.D(S, cid), errs = [];
  if (!s.code) errs.push('Code obligatoire.'); if (!s.label) errs.push('Libellé obligatoire.');
  var lat = Number(s.lat), lng = Number(s.lng);
  if (!(lat >= 1.5 && lat <= 13.2 && lng >= 8.3 && lng <= 16.3)) errs.push('Coordonnées hors du Cameroun (latitude 1,5 à 13,2 ; longitude 8,3 à 16,3).');
  var r = Number(s.radius); if (!(r >= 30 && r <= 2000)) errs.push('Rayon de géozone entre 30 et 2 000 m.');
  if (d.sites.some(function (x) { return x.code === s.code && x.id !== s.id; })) errs.push('Code déjà utilisé.');
  if (errs.length) fail(errs);
  var ex = s.id && d.sites.find(function (x) { return x.id === s.id; });
  var rec = Object.assign(ex || { id: U.uid('site'), qr: 'YQ-' + U.fnv(s.code + Date.now()).toUpperCase(), active: true }, { code: s.code, label: s.label, type: s.type || 'agence', city: s.city || '', address: s.address || '', lat: lat, lng: lng, radius: r, wifi: (s.wifi ? String(s.wifi).split(/[,;]\s*/).filter(Boolean) : (ex && ex.wifi) || []), client: s.client || '', active: s.active !== false });
  if (!ex) d.sites.push(rec);
  Y.audit(S, cid, 'GTA · site', rec.code, rec.label + ' · rayon ' + r + ' m'); return rec;
};
G.renewQr = function (S, cid, id) { need(S, 'gta.manage'); var s = G.site(S, cid, id); s.qr = 'YQ-' + U.fnv(s.code + Date.now() + Math.random()).toUpperCase(); Y.audit(S, cid, 'GTA · QR code renouvelé', s.code, ''); return s; };
G.saveSchedule = function (S, cid, h) {
  need(S, 'gta.manage'); var d = G.D(S, cid);
  if (!h.code || !h.label) fail('Code et libellé obligatoires.');
  if (!/^\d{2}:\d{2}$/.test(h.start || '') || !/^\d{2}:\d{2}$/.test(h.end || '') || hm(h.end) <= hm(h.start)) fail('Heures de début et de fin invalides.');
  var ex = d.schedules.find(function (x) { return x.code === h.code; });
  var rec = Object.assign(ex || {}, { code: h.code, label: h.label, days: (h.days || []).map(Number).filter(function (x) { return x >= 0 && x <= 6; }), start: h.start, end: h.end, breakMin: +h.breakMin || 0, tolerance: +h.tolerance || 0 });
  if (!rec.days.length) fail('Choisissez au moins un jour travaillé.');
  if (!ex) d.schedules.push(rec);
  Y.audit(S, cid, 'GTA · horaire', rec.code, rec.label); return rec;
};
G.dayMinutes = function (h) { return hm(h.end) - hm(h.start) - (h.breakMin || 0); };
G.setAssign = function (S, cid, empId, a) {
  need(S, 'gta.manage'); var x = G.assign(S, cid, empId);
  if (a.schedule) x.schedule = a.schedule; if (a.sites) x.sites = a.sites; if (a.mode) x.mode = a.mode; if (a.home !== undefined) x.home = a.home && a.home.lat ? { lat: +a.home.lat, lng: +a.home.lng, radius: +a.home.radius || 200 } : null;
  Y.audit(S, cid, 'GTA · affectation', P().emp(S, cid, empId).matricule, x.schedule + ' · ' + x.sites.join(', ') + ' · ' + x.mode); return x;
};
G.registerDevice = function (S, cid, empId, dev) {
  need(S, 'gta.manage'); var x = G.assign(S, cid, empId), old = x.device;
  if (!dev || !dev.id) fail('Identifiant d’appareil obligatoire.');
  x.device = { id: dev.id, label: dev.label || 'Téléphone', at: new Date().toISOString(), by: who(S).by }; x.pendingDevice = null;
  Y.audit(S, cid, 'GTA · appareil enregistré', P().emp(S, cid, empId).matricule, (old ? old.label + ' → ' : '') + x.device.label); return x;
};
G.consent = function (S, cid, empId) {
  var x = G.assign(S, cid, empId), me = A().me(S, cid);
  if (!G._bypass && !(me && me.id === empId) && !G.can(S, 'gta.manage')) fail('Seul le salarié peut accepter la notice d’information.');
  x.consent = { at: new Date().toISOString(), version: G.D(S, cid).settings.privacyVersion }; Y.audit(S, cid, 'GTA · notice d’information acceptée', P().emp(S, cid, empId).matricule, x.consent.version); return x;
};
G.PRIVACY = [
  'Finalité : contrôler la présence au poste et le temps de travail, établir la paie, sécuriser les missions terrain.',
  'La position n’est lue qu’au moment où vous pointez (lien personnel) et, pendant une mission, entre « Démarrer » et « Terminer ». Aucun suivi hors temps de travail.',
  'Données conservées : résultat du pointage pendant la durée légale ; positions GPS supprimées après le délai de conservation paramétré.',
  'Accès : votre N+1, les RH et la paie, pour votre seul périmètre. Toute consultation est tracée.',
  'Droits : accès, rectification et opposition auprès de la DRH (loi n° 2024/017 relative à la protection des données à caractère personnel).'
];

/* ======================================================================= liens WhatsApp */
G.issueLink = function (S, cid, empId, kind, opts) {
  opts = opts || {}; var d = G.D(S, cid), e = P().emp(S, cid, empId); if (!e) fail('Salarié introuvable.');
  var at = opts.at || G.now(S, cid);
  var l = { token: 'L' + U.fnv(empId + kind + at + Math.random() + d.links.length).toUpperCase(), empId: e.id, kind: kind || 'in', createdAt: at, expiresAt: addMin(at, d.settings.linkMinutes), usedAt: null, phone: e.whatsapp || e.telephone || '', controlId: opts.controlId || '', missionId: opts.missionId || '' };
  d.links.push(l); if (d.links.length > 600) d.links = d.links.slice(-600);
  return l;
};
G.linkMessage = function (S, cid, l) {
  var e = P().emp(S, cid, l.empId), lab = { in: 'votre arrivée', out: 'votre départ', control: 'votre présence (contrôle aléatoire)', mission: 'votre arrivée sur le site de mission' }[l.kind];
  return 'Bonjour ' + e.prenoms + ', pointez ' + lab + ' : https://app.myyiel.com/p/' + l.token + '\nLien personnel valable ' + G.D(S, cid).settings.linkMinutes + ' min, utilisable une seule fois depuis votre téléphone enregistré.';
};

/* ======================================================================= score de confiance */
G.SIGNALS = { link: 'Lien personnel valide', zone: 'Géozone du site', accuracy: 'Précision GPS', device: 'Téléphone enregistré', qr: 'QR code du site', wifi: 'Wi-Fi de l’entreprise', mock: 'Position fictive', speed: 'Vitesse de déplacement' };
G.score = function (sig) {
  var det = [], s = 0;
  function add(k, pts, ok, txt) { det.push({ k: k, label: G.SIGNALS[k], pts: pts, ok: ok, text: txt }); s += pts; }
  add('link', 10, true, 'Envoyé au numéro WhatsApp du dossier');
  if (sig.distance == null) add('zone', 0, false, 'Position indisponible');
  else if (sig.distance <= sig.radius) add('zone', 40, true, 'Dans la zone (' + Math.round(sig.distance) + ' m du centre, rayon ' + sig.radius + ' m)');
  else if (sig.distance <= sig.radius * 3) add('zone', 15, false, 'Proche du site (' + Math.round(sig.distance) + ' m)');
  else add('zone', 0, false, 'Hors zone : ' + (sig.distance >= 1000 ? (Math.round(sig.distance / 100) / 10).toString().replace('.', ',') + ' km' : Math.round(sig.distance) + ' m') + ' du site');
  if (sig.accuracy != null) { if (sig.accuracy <= 30) add('accuracy', 10, true, '± ' + Math.round(sig.accuracy) + ' m'); else if (sig.accuracy <= 100) add('accuracy', 5, true, '± ' + Math.round(sig.accuracy) + ' m'); else if (sig.accuracy > 300) add('accuracy', -10, false, 'Imprécise (± ' + Math.round(sig.accuracy) + ' m)'); else add('accuracy', 0, false, '± ' + Math.round(sig.accuracy) + ' m'); }
  if (sig.device === 'ok') add('device', 20, true, 'Appareil reconnu'); else if (sig.device === 'new') add('device', -10, false, 'Appareil inconnu (validation du changement requise)'); else add('device', 0, false, 'Aucun appareil enregistré');
  if (sig.qr === 'ok') add('qr', 20, true, 'QR code affiché sur site scanné'); else if (sig.qr === 'bad') add('qr', -20, false, 'QR code invalide ou d’un autre site');
  if (sig.wifi) add('wifi', 10, true, 'Réseau ' + sig.wifi);
  if (sig.mock) add('mock', -60, false, 'Application de fausse localisation ou émulateur détecté');
  if (sig.speedKmh != null && sig.speedKmh > sig.maxSpeed) add('speed', -40, false, 'Déplacement impossible depuis le pointage précédent (' + Math.round(sig.speedKmh) + ' km/h)');
  return { score: Math.max(0, Math.min(100, s)), details: det };
};

/* ======================================================================= pointage */
G.PUNCH_KIND = { in: 'Arrivée', out: 'Départ', control: 'Contrôle', mission: 'Arrivée mission' };
G.PUNCH_STATUS = { valide: ['Validé', 'ok'], a_verifier: ['À vérifier', 'warn'], rejete: ['Rejeté', 'bad'] };
/**
 * Pointage par lien. p = { token, lat, lng, accuracy, deviceId, qr, wifi, mock, at }
 * at = horodatage local AAAA-MM-JJTHH:MM (serveur en production).
 */
G.punch = function (S, cid, p) {
  var d = G.D(S, cid), st = d.settings, l = d.links.find(function (x) { return x.token === p.token; });
  if (!l) fail('Lien inconnu.');
  var at = p.at || G.now(S, cid);
  if (l.usedAt) fail('Lien déjà utilisé le ' + l.usedAt.replace('T', ' à ') + ' : demandez un nouveau lien.');
  if (at > l.expiresAt) fail('Lien expiré (valable ' + st.linkMinutes + ' min) : demandez un nouveau lien.');
  var e = P().emp(S, cid, l.empId), a = G.assign(S, cid, e.id);
  if (st.requireConsent && !a.consent) fail('La notice d’information sur la géolocalisation doit d’abord être acceptée.');
  var mission = l.missionId && d.missions.find(function (m) { return m.id === l.missionId; });
  var tt = ((A().cells(S, cid, at.slice(0, 10), at.slice(0, 10))[e.id] || {})[at.slice(0, 10)]) || null, isTT = tt && tt.code === 'TT' && tt.status === 'approuvee' && a.home;
  var candidates = mission ? [mission.to] : (isTT ? [{ code: 'DOMICILE', label: 'Domicile déclaré (télétravail)', lat: a.home.lat, lng: a.home.lng, radius: a.home.radius || 200, wifi: [] }] : a.sites.map(function (c) { return G.site(S, cid, c); }).filter(Boolean));
  if (!candidates.length) candidates = d.sites.filter(function (s) { return s.active; });
  var site = null, dist = null;
  if (p.lat != null && p.lng != null) candidates.forEach(function (s) { var dd = G.dist(p.lat, p.lng, s.lat, s.lng); if (dist === null || dd < dist) { dist = dd; site = s; } });
  var qr = '';
  if (p.qr) { var qs = d.sites.find(function (s) { return s.qr === p.qr; }); qr = qs && (!site || qs.code === site.code) ? 'ok' : 'bad'; if (qs && !site) site = qs; if (qr === 'ok' && dist === null) dist = 0; }
  var device = !a.device ? 'none' : (p.deviceId && p.deviceId === a.device.id ? 'ok' : 'new');
  var wifi = p.wifi && site && (site.wifi || []).indexOf(p.wifi) > -1 ? p.wifi : '';
  var date = at.slice(0, 10), prev = d.punches.filter(function (x) { return x.empId === e.id && x.date === date && x.lat != null; }).pop(), speed = null;
  if (prev && p.lat != null) { var mins = Math.max(1, minBetween(prev.date + 'T' + prev.time, at)); speed = G.dist(prev.lat, prev.lng, p.lat, p.lng) / 1000 / (mins / 60); }
  var sc = G.score({ distance: dist, radius: site ? site.radius : 150, accuracy: p.accuracy, device: device, qr: qr, wifi: wifi, mock: !!p.mock, speedKmh: speed, maxSpeed: st.maxSpeedKmh });
  var status = p.mock ? 'rejete' : (sc.score >= st.scoreAuto ? 'valide' : (sc.score >= st.scoreReject ? 'a_verifier' : 'rejete'));
  if (device === 'new' && status === 'valide') status = 'a_verifier';
  var rec = { id: U.uid('pt'), empId: e.id, matricule: e.matricule, date: date, time: at.slice(11, 16), kind: l.kind === 'mission' ? 'in' : l.kind, viaMission: mission ? mission.id : '', siteCode: site ? site.code : '', siteLabel: site ? site.label : '', lat: p.lat == null ? null : p.lat, lng: p.lng == null ? null : p.lng,
    accuracy: p.accuracy == null ? null : p.accuracy, distance: dist == null ? null : Math.round(dist), score: sc.score, details: sc.details, status: status, channel: 'whatsapp', token: l.token, deviceId: p.deviceId || '', reviewed: null, controlId: l.controlId || '' };
  l.usedAt = at;
  if (device === 'new') a.pendingDevice = { id: p.deviceId, at: at };
  d.punches.push(rec);
  if (l.controlId) { var c = d.controls.find(function (x) { return x.id === l.controlId; }); if (c) { c.answeredAt = at; c.punchId = rec.id; c.result = status === 'valide' ? 'present' : (rec.distance != null && site && rec.distance > site.radius ? 'hors_zone' : 'a_verifier'); } }
  return rec;
};
G.review = function (S, cid, id, decision, comment) {
  need(S, 'gta.validate'); var d = G.D(S, cid), p = d.punches.find(function (x) { return x.id === id; }); if (!p) fail('Pointage introuvable.');
  if (!G._bypass && !G.scope(S, cid).some(function (e) { return e.id === p.empId; })) fail('Salarié hors de votre périmètre.');
  if (decision === 'rejeter' && !comment) fail('Motif du rejet obligatoire.');
  var me = A().me(S, cid); if (me && me.id === p.empId) fail('Vous ne pouvez pas valider vos propres pointages.');
  p.status = decision === 'valider' ? 'valide' : 'rejete'; p.reviewed = Object.assign({ decision: decision, comment: comment || '' }, who(S));
  if (p.controlId) { var c = d.controls.find(function (x) { return x.id === p.controlId; }); if (c) c.result = p.status === 'valide' ? 'present' : 'hors_zone'; }
  Y.audit(S, cid, 'GTA · revue de pointage', p.matricule + ' ' + p.date + ' ' + p.time, decision + (comment ? ' · ' + comment : '')); return p;
};
G.manualPunch = function (S, cid, m) {
  need(S, 'gta.validate'); var d = G.D(S, cid), e = P().emp(S, cid, m.empId); if (!e) fail('Salarié introuvable.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(m.date || '') || !/^\d{2}:\d{2}$/.test(m.time || '')) fail('Date et heure obligatoires.');
  if (!m.comment) fail('Motif obligatoire (oubli, panne de téléphone, réseau…).');
  var me = A().me(S, cid); if (me && me.id === e.id) fail('Vous ne pouvez pas saisir vos propres pointages.');
  var rec = { id: U.uid('pt'), empId: e.id, matricule: e.matricule, date: m.date, time: m.time, kind: m.kind || 'in', siteCode: m.siteCode || '', siteLabel: (G.site(S, cid, m.siteCode) || {}).label || '', lat: null, lng: null, accuracy: null, distance: null, score: null, details: [], status: 'valide', channel: 'manager', reviewed: Object.assign({ decision: 'saisie', comment: m.comment }, who(S)) };
  d.punches.push(rec); Y.audit(S, cid, 'GTA · pointage saisi', e.matricule + ' ' + m.date + ' ' + m.time, m.comment); return rec;
};
G.punchesOf = function (S, cid, empId, date) { return G.D(S, cid).punches.filter(function (p) { return p.empId === empId && p.date === date; }).sort(function (a, b) { return a.time < b.time ? -1 : 1; }); };

/* ======================================================================= contrôles aléatoires */
function prng(seed) { var x = 0; for (var i = 0; i < seed.length; i++) x = (x * 31 + seed.charCodeAt(i)) >>> 0; return function () { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; }; }
G.planControls = function (S, cid, date, opts) {
  opts = opts || {}; if (!opts.system) need(S, 'gta.manage');
  var d = G.D(S, cid), cs = d.settings.controls, R = prng(cid + date + (opts.salt || ''));
  var present = P().D(S, cid).employees.filter(function (e) { return e.statut !== 'sorti' && G.punchesOf(S, cid, e.id, date).some(function (p) { return p.kind === 'in' && p.status === 'valide'; }) && !d.controls.some(function (c) { return c.empId === e.id && c.date === date; }); });
  var n = Math.min(opts.n || cs.perDay, present.length), out = [];
  for (var i = 0; i < n; i++) {
    var k = Math.floor(R() * present.length), e = present.splice(k, 1)[0];
    var t = fmtHM(hm(cs.from) + Math.floor(R() * Math.max(1, hm(cs.to) - hm(cs.from))));
    var c = { id: U.uid('ctl'), empId: e.id, matricule: e.matricule, date: date, sentAt: date + 'T' + t, deadline: addMin(date + 'T' + t, cs.answerMin), answeredAt: null, punchId: '', result: 'en_attente' };
    var l = G.issueLink(S, cid, e.id, 'control', { at: c.sentAt, controlId: c.id }); l.expiresAt = c.deadline; c.token = l.token;
    d.controls.push(c); out.push(c);
  }
  if (out.length) Y.audit(S, cid, 'GTA · contrôles aléatoires', date, out.length + ' salarié(s)');
  return out;
};
G.CONTROL_RESULT = { en_attente: ['En attente de réponse', 'info'], present: ['Présent', 'ok'], hors_zone: ['Hors zone', 'bad'], a_verifier: ['À vérifier', 'warn'], sans_reponse: ['Sans réponse', 'bad'] };
G.expireControls = function (S, cid, now) { var n = 0; G.D(S, cid).controls.forEach(function (c) { if (c.result === 'en_attente' && c.deadline < now) { c.result = 'sans_reponse'; n++; } }); return n; };

/* ======================================================================= journée & feuille de temps */
G.DAY_STATUS = {
  present: ['Présent', 'ok'], retard: ['Retard', 'warn'], absent: ['Absence injustifiée', 'bad'], absence: ['Absence', 'info'], mission: ['En mission', 'info'], teletravail: ['Télétravail', 'ok'],
  formation: ['Formation', 'info'], ferie: ['Jour férié', ''], repos: ['Repos', ''], incomplet: ['Pointage incomplet', 'warn'], a_verifier: ['À vérifier', 'warn'], a_venir: ['À venir', ''], en_cours: ['En poste', 'ok'], non_pointe: ['Non pointé', 'warn']
};
G.missionOn = function (S, cid, empId, date) {
  return G.D(S, cid).missions.find(function (m) { return m.empIds.indexOf(empId) > -1 && m.status !== 'annulee' && (m.plannedStart || '').slice(0, 10) <= date && (m.plannedEnd || m.plannedStart.slice(0, 10)) >= date; });
};
G.day = function (S, cid, emp, date, opts) {
  opts = opts || {};
  var d = G.D(S, cid), a = G.assign(S, cid, emp.id), h = G.schedule(S, cid, a.schedule), w = A().dow(date), now = opts.now || G.now(S, cid), today = now.slice(0, 10);
  var expected = h.days.indexOf(w) > -1, hol = A().isHoliday(S, cid, date), dayMin = G.dayMinutes(h);
  var cell = ((opts.cells || A().cells(S, cid, date, date))[emp.id] || {})[date];
  var r = { date: date, empId: emp.id, expected: expected && !hol, holiday: hol, schedule: h.code, dayMin: dayMin, punches: [], in: '', out: '', workedMin: 0, lateMin: 0, earlyMin: 0, otMin: 0, sunday: w === 0, status: 'repos', flags: [], absence: null, mission: null };
  if (emp.embauche && date < emp.embauche) { r.status = 'repos'; r.expected = false; return r; }
  var ps = G.punchesOf(S, cid, emp.id, date); r.punches = ps;
  var valid = ps.filter(function (p) { return p.status === 'valide'; }), pend = ps.filter(function (p) { return p.status === 'a_verifier'; });
  var ins = valid.filter(function (p) { return p.kind === 'in'; }), outs = valid.filter(function (p) { return p.kind === 'out'; });
  if (ins.length) r.in = ins[0].time; if (outs.length) r.out = outs[outs.length - 1].time;
  var ms = G.missionOn(S, cid, emp.id, date);
  if (cell && cell.status === 'approuvee') r.absence = cell;
  if (ms) r.mission = { id: ms.id, ref: ms.ref, label: ms.label, status: ms.status };
  var span = r.in && r.out ? hm(r.out) - hm(r.in) : 0;
  if (span > 0) r.workedMin = span - (span > 360 ? h.breakMin : 0);
  if (hol || !expected) {
    if (r.workedMin > 0) { r.otMin = r.workedMin; r.status = 'present'; r.flags.push(hol ? 'Travail un jour férié' : (w === 0 ? 'Travail le dimanche' : 'Travail hors horaire')); }
    else r.status = hol ? 'ferie' : 'repos';
    return r;
  }
  if (r.absence && ['TT', 'FORM'].indexOf(r.absence.code) < 0 && r.absence.w >= 1) { r.status = 'absence'; return r; }
  if (r.absence && r.absence.code === 'FORM') { r.status = 'formation'; r.workedMin = dayMin; return r; }
  if (ms && ms.status !== 'planifiee') { r.status = 'mission'; if (!r.workedMin) r.workedMin = date < today || ms.status === 'terminee' ? dayMin : 0; r.otMin = 0; return r; }
  if (ms && date < today && !r.in) { r.status = 'mission'; r.workedMin = 0; r.flags.push('Mission non démarrée'); return r; }
  if (date > today) { r.status = 'a_venir'; return r; }
  var startM = hm(h.start), endM = hm(h.end);
  if (r.in && hm(r.in) > startM + h.tolerance) r.lateMin = hm(r.in) - startM;
  if (r.out && hm(r.out) < endM - h.tolerance) r.earlyMin = endM - hm(r.out);
  var half = r.absence && r.absence.w < 1 ? dayMin / 2 : 0;
  if (r.workedMin > dayMin - half) r.otMin = r.workedMin - (dayMin - half);
  if (r.otMin < d.settings.otMinMin) r.otMin = 0;
  if (!r.in) {
    if (pend.length) r.status = 'a_verifier';
    else if (date === today) r.status = hm(now.slice(11, 16)) > startM + h.tolerance ? 'non_pointe' : 'a_venir';
    else if (half) { r.status = 'absence'; }
    else r.status = 'absent';
    if (r.absence && r.absence.code === 'TT') r.status = r.status === 'absent' ? 'incomplet' : r.status;
    return r;
  }
  if (!r.out) { r.status = date === today ? 'en_cours' : 'incomplet'; if (date < today) r.flags.push('Départ non pointé'); return r; }
  r.status = r.absence && r.absence.code === 'TT' ? 'teletravail' : (r.lateMin ? 'retard' : 'present');
  if (pend.length) r.flags.push(pend.length + ' pointage(s) à vérifier');
  return r;
};
function sheetState(S, cid, key, empId) { var d = G.D(S, cid); d.sheets[key] = d.sheets[key] || {}; return d.sheets[key][empId] || (d.sheets[key][empId] = { status: 'ouverte', ot: {}, abs: {}, history: [] }); }
G.SHEET_STATUS = { ouverte: ['À valider', 'warn'], validee: ['Validée N+1', 'ok'], transmise: ['Transmise à la paie', 'info'] };
G.sheet = function (S, cid, emp, key, opts) {
  opts = opts || {};
  var b = P().periodBounds(key), st = sheetState(S, cid, key, emp.id), days = [], now = opts.now || G.now(S, cid), cells = opts.cells || A().cells(S, cid, b.start, b.end);
  for (var dt = b.start; dt <= b.end; dt = U.addDays(dt, 1)) days.push(G.day(S, cid, emp, dt, { now: now, cells: cells }));
  var t = { expected: 0, present: 0, workedMin: 0, late: 0, lateMin: 0, absent: 0, absences: {}, mission: 0, tt: 0, incomplete: 0, review: 0, otProposed: 0, otApproved: 0, hs: { HS1: 0, HS2: 0, HS3: 0, HSN: 0 } };
  var weeks = {};
  days.forEach(function (x) {
    if (x.expected) t.expected++;
    if (['present', 'retard', 'teletravail', 'en_cours', 'formation'].indexOf(x.status) > -1) t.present++;
    if (x.status === 'retard') { t.late++; t.lateMin += x.lateMin; }
    if (x.status === 'absent' && st.abs[x.date] !== 'justifie') t.absent++;
    if (x.status === 'absence' && x.absence) t.absences[x.absence.code] = (t.absences[x.absence.code] || 0) + x.absence.w;
    if (x.status === 'mission') t.mission++;
    if (x.status === 'teletravail') t.tt++;
    if (x.status === 'incomplet') t.incomplete++;
    if (x.status === 'a_verifier' || x.punches.some(function (p) { return p.status === 'a_verifier'; })) t.review++;
    t.workedMin += x.workedMin;
    if (x.otMin) {
      t.otProposed += x.otMin; var dec = st.ot[x.date];
      if (dec === 'approuve') {
        t.otApproved += x.otMin;
        if (x.sunday || x.holiday) t.hs.HSN += x.otMin;
        else { var monday = U.addDays(x.date, -((A().dow(x.date) + 6) % 7)); (weeks[monday] = weeks[monday] || []).push(x); }
      }
    }
  });
  var weekEnds = [];
  Object.keys(weeks).sort().forEach(function (wk) {
    var acc = 0, part = { HS1: 0, HS2: 0, HS3: 0 };
    weeks[wk].forEach(function (x) { var m = x.otMin; while (m > 0) { var tier = acc < 480 ? 'HS1' : (acc < 960 ? 'HS2' : 'HS3'), cap = tier === 'HS1' ? 480 - acc : (tier === 'HS2' ? 960 - acc : m), take = Math.min(m, cap); part[tier] += take; acc += take; m -= take; } });
    Object.keys(part).forEach(function (k) { t.hs[k] += part[k]; });
    var last = weeks[wk][weeks[wk].length - 1].date; weekEnds.push({ week: wk, date: last, part: part });
  });
  return { emp: emp, key: key, days: days, totals: t, state: st, weeks: weekEnds };
};
G.decideOt = function (S, cid, key, empId, date, decision) {
  need(S, 'gta.validate'); var st = sheetState(S, cid, key, empId); if (st.status !== 'ouverte') fail('Feuille déjà validée.');
  var me = A().me(S, cid); if (me && me.id === empId) fail('Vous ne pouvez pas valider vos propres heures.');
  st.ot[date] = decision; st.history.push(Object.assign({ action: 'Heures sup. ' + date + ' : ' + decision }, who(S))); return st;
};
G.decideAbsence = function (S, cid, key, empId, date, decision, comment) {
  need(S, 'gta.validate'); var st = sheetState(S, cid, key, empId); if (st.status !== 'ouverte') fail('Feuille déjà validée.');
  if (decision === 'justifie' && !comment) fail('Précisez le justificatif.');
  st.abs[date] = decision; st.history.push(Object.assign({ action: 'Absence du ' + date + ' : ' + (decision === 'justifie' ? 'justifiée' : 'confirmée injustifiée'), comment: comment || '' }, who(S))); return st;
};
G.validateSheet = function (S, cid, key, empId, comment) {
  need(S, 'gta.validate');
  var emp = P().emp(S, cid, empId); if (!G._bypass && !G.scope(S, cid).some(function (e) { return e.id === empId; })) fail('Salarié hors de votre périmètre.');
  var me = A().me(S, cid); if (me && me.id === empId) fail('Votre feuille de temps est validée par votre N+1 ou la DRH.');
  var sh = G.sheet(S, cid, emp, key), st = sh.state;
  if (st.status !== 'ouverte') fail('Feuille déjà ' + G.SHEET_STATUS[st.status][0].toLowerCase() + '.');
  var errs = [];
  if (sh.totals.review) errs.push(sh.totals.review + ' journée(s) avec un pointage à vérifier.');
  if (sh.totals.incomplete) errs.push(sh.totals.incomplete + ' journée(s) au pointage incomplet : saisissez le pointage manquant.');
  if (errs.length) fail(errs);
  sh.days.forEach(function (x) { if (x.status === 'absent' && !st.abs[x.date]) st.abs[x.date] = 'confirme'; if (x.otMin && !st.ot[x.date]) st.ot[x.date] = 'refuse'; });
  st.status = 'validee'; st.validated = Object.assign({ comment: comment || '' }, who(S)); st.history.push(Object.assign({ action: 'Feuille validée', comment: comment || '' }, who(S)));
  Y.audit(S, cid, 'GTA · feuille de temps validée', emp.matricule + ' · ' + key, sh.totals.absent + ' abs. injustifiée(s) · HS ' + G.dur(sh.totals.otApproved));
  return st;
};
G.reopenSheet = function (S, cid, key, empId, comment) {
  need(S, 'gta.export'); var st = sheetState(S, cid, key, empId);
  if (st.status === 'transmise') { var p = P().D(S, cid).periods[key]; if (p && P().isFrozen(p)) fail('Paie validée : régularisez sur la période suivante.'); }
  if (!comment) fail('Motif obligatoire.'); st.status = 'ouverte'; st.history.push(Object.assign({ action: 'Feuille rouverte', comment: comment }, who(S))); return st;
};

/* ======================================================================= transmission à la paie */
function r2(n) { return Math.round(n * 100) / 100; }
/** Événements myyiel.time-events/1 d'une feuille validée (temps) ; les absences approuvées viennent de Y.Abs. */
G.sheetEvents = function (S, cid, sh) {
  var out = [], e = sh.emp;
  sh.weeks.forEach(function (w) { ['HS1', 'HS2', 'HS3'].forEach(function (k) { if (w.part[k] > 0) out.push({ matricule: e.matricule, date: w.date, type: k, quantite: r2(w.part[k] / 60), commentaire: 'Semaine du ' + U.frDate(w.week) }); }); });
  sh.days.forEach(function (x) {
    if (x.otMin && (x.sunday || x.holiday) && sh.state.ot[x.date] === 'approuve') out.push({ matricule: e.matricule, date: x.date, type: 'HSN', quantite: r2(x.otMin / 60), commentaire: x.holiday || 'Dimanche' });
    if (x.status === 'absent' && sh.state.abs[x.date] !== 'justifie') out.push({ matricule: e.matricule, date: x.date, type: 'ABS_NP', quantite: 1, commentaire: 'Absence injustifiée (GTA)' });
    if (x.lateMin) out.push({ matricule: e.matricule, date: x.date, type: 'RETARD', quantite: x.lateMin, commentaire: 'Arrivée ' + x.in });
  });
  return out;
};
G.payPreview = function (S, cid, key) {
  var emps = P().D(S, cid).employees.filter(function (e) { return e.statut !== 'sorti'; }), b = P().periodBounds(key), cells = A().cells(S, cid, b.start, b.end), now = G.now(S, cid);
  var rows = emps.map(function (e) { var sh = G.sheet(S, cid, e, key, { cells: cells, now: now }); return { emp: e, sheet: sh, status: sh.state.status, events: sh.state.status === 'ouverte' ? [] : G.sheetEvents(S, cid, sh) }; });
  var absEv = A().payEvents(S, cid, key);
  return { rows: rows, absEvents: absEv, ready: rows.filter(function (r) { return r.status !== 'ouverte'; }).length, pending: rows.filter(function (r) { return r.status === 'ouverte'; }) };
};
G.payExport = function (S, cid, key, opts) {
  opts = opts || {}; need(S, 'gta.export'); if (!G._bypass && !P().can(S, 'pay.prepare')) fail('La transmission alimente la paie : droit de préparation de la paie requis.');
  var pd = P().D(S, cid), p = P().period(S, cid, key, true); if (P().isFrozen(p)) fail('Paie de ' + P().monthLabel(key) + ' déjà validée : les éléments iront sur la période suivante.');
  var pv = G.payPreview(S, cid, key);
  if (opts.strict && pv.pending.length) fail(pv.pending.length + ' feuille(s) de temps non validée(s) : ' + pv.pending.slice(0, 5).map(function (r) { return P().fullName(r.emp); }).join(', ') + (pv.pending.length > 5 ? '…' : '') + '.');
  var events = [];
  pv.rows.forEach(function (r) { events = events.concat(r.events); });
  events = events.concat(pv.absEvents.map(function (x) { return { matricule: x.matricule, date: x.date, type: x.type, quantite: x.quantite, commentaire: x.commentaire }; }));
  // remplace les éléments GTA précédemment transmis pour la période (pas de doublon en cas de nouvelle transmission)
  Object.keys(p.vars || {}).forEach(function (eid) { p.vars[eid] = p.vars[eid].filter(function (v) { return v.source !== 'GTA'; }); });
  pd.timeEvents = pd.timeEvents.filter(function (x) { return !(x.key === key && x.source === 'GTA'); });
  var res = events.length ? P().importTimeEvents(S, cid, key, events, { source: 'GTA' }) : { ok: 0, errors: [], info: 0 };
  A().markExported(S, cid, key, pv.absEvents);
  pv.rows.forEach(function (r) { if (r.status === 'validee') { r.sheet.state.status = 'transmise'; r.sheet.state.history.push(Object.assign({ action: 'Transmise à la paie' }, who(S))); } });
  var d = G.D(S, cid), rec = Object.assign({ key: key, events: events.length, sheets: pv.ready, pending: pv.pending.length, absences: pv.absEvents.length, errors: res.errors }, who(S));
  d.exports.unshift(rec);
  Y.audit(S, cid, 'GTA · transmission à la paie', key, events.length + ' événement(s) · ' + pv.ready + ' feuille(s) · ' + pv.absEvents.length + ' jour(s) d’absence');
  return Object.assign({ result: res }, rec);
};

/* ======================================================================= missions terrain */
G.MISSION_STATUS = { planifiee: ['Planifiée', ''], en_route: ['En route', 'info'], sur_site: ['Sur site', 'ok'], terminee: ['Terminée', 'ok'], annulee: ['Annulée', ''] };
G.TRANSPORTS = { vehicule: 'Véhicule de service', personnel: 'Véhicule personnel', bus: 'Car interurbain', moto: 'Moto-taxi', avion: 'Avion', train: 'Train (Camrail)' };
G.createMission = function (S, cid, m) {
  need(S, 'gta.mission'); var d = G.D(S, cid), errs = [];
  var emps = (m.empIds || []).map(function (x) { return P().emp(S, cid, x); }).filter(Boolean);
  if (!emps.length) errs.push('Au moins un salarié.');
  if (!m.label) errs.push('Objet de la mission obligatoire.');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(m.plannedStart || '')) errs.push('Départ prévu (date et heure) obligatoire.');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(m.plannedArrival || '')) errs.push('Arrivée prévue (date et heure) obligatoire.');
  if (!errs.length && m.plannedArrival <= m.plannedStart) errs.push('L’arrivée prévue doit suivre le départ.');
  var to = m.toSite ? G.site(S, cid, m.toSite) : null, from = m.fromSite ? G.site(S, cid, m.fromSite) : null;
  if (!to && !(m.toCity && G.CITIES[m.toCity])) errs.push('Destination : site ou ville connue.');
  if (!from && !(m.fromCity && G.CITIES[m.fromCity])) errs.push('Lieu de départ : site ou ville connue.');
  if (errs.length) fail(errs);
  emps.forEach(function (e) { var o = d.missions.find(function (x) { return x.status !== 'annulee' && x.status !== 'terminee' && x.empIds.indexOf(e.id) > -1 && x.plannedStart.slice(0, 10) <= (m.plannedEnd || m.plannedArrival.slice(0, 10)) && (x.plannedEnd || x.plannedArrival.slice(0, 10)) >= m.plannedStart.slice(0, 10); }); if (o) errs.push(P().fullName(e) + ' : déjà en mission (' + o.ref + ').'); });
  if (errs.length) fail(errs);
  function pt(site, city) { return site ? { code: site.code, label: site.label, city: site.city, lat: site.lat, lng: site.lng, radius: site.radius } : { code: '', label: city, city: city, lat: G.CITIES[city][0], lng: G.CITIES[city][1], radius: 1500 }; }
  var f = pt(from, m.fromCity), t = pt(to, m.toCity);
  var route = G.route(f.city || m.fromCity, t.city || m.toCity);
  if (route.length < 2) route = [{ label: f.label, lat: f.lat, lng: f.lng }, { label: t.label, lat: t.lat, lng: t.lng }];
  route[0] = { label: f.label, lat: f.lat, lng: f.lng }; route[route.length - 1] = { label: t.label, lat: t.lat, lng: t.lng };
  d.seq.mission++;
  var rec = { id: U.uid('ms'), ref: 'OM-' + m.plannedStart.slice(0, 4) + '-' + U.pad(d.seq.mission, 4), empIds: emps.map(function (e) { return e.id; }), label: m.label, client: m.client || '', purpose: m.purpose || '',
    from: f, to: t, route: route, distanceKm: Math.round(polyLen(route) / 100) / 10, plannedStart: m.plannedStart, plannedArrival: m.plannedArrival, plannedEnd: m.plannedEnd || m.plannedArrival.slice(0, 10),
    transport: m.transport || 'vehicule', perDiem: U.round(m.perDiem || 0), status: 'planifiee', startedAt: null, arrivedAt: null, endedAt: null, arrivalPrompt: false, track: [], alerts: [], createdBy: who(S).by, createdAt: new Date().toISOString(), sim: m.sim || null };
  d.missions.unshift(rec);
  Y.audit(S, cid, 'GTA · ordre de mission', rec.ref, emps.map(function (e) { return e.matricule; }).join(', ') + ' · ' + rec.from.label + ' → ' + rec.to.label);
  return rec;
};
function mission(S, cid, id) { var m = G.D(S, cid).missions.find(function (x) { return x.id === id || x.ref === id; }); if (!m) fail('Mission introuvable.'); return m; }
function selfOrManager(S, cid, m) {
  if (G._bypass) return; var me = A().me(S, cid);
  if (me && m.empIds.indexOf(me.id) > -1) { if (!G.can(S, 'self')) fail('Droit d’espace salarié requis.'); return; }
  need(S, 'gta.mission');
}
G.startMission = function (S, cid, id, pos) {
  var m = mission(S, cid, id); selfOrManager(S, cid, m);
  if (m.status !== 'planifiee') fail('Mission déjà ' + G.MISSION_STATUS[m.status][0].toLowerCase() + '.');
  var at = (pos && pos.at) || G.now(S, cid);
  m.empIds.forEach(function (eid) { var a = G.assign(S, cid, eid); if (G.D(S, cid).settings.requireConsent && !a.consent) fail('Notice d’information non acceptée par ' + P().fullName(P().emp(S, cid, eid)) + '.'); });
  m.status = 'en_route'; m.startedAt = at; m.consentAt = at;
  var p0 = pos && pos.lat != null ? { t: at, lat: pos.lat, lng: pos.lng, acc: pos.accuracy || 20 } : { t: at, lat: m.from.lat, lng: m.from.lng, acc: 25 };
  m.track.push(p0);
  Y.audit(S, cid, 'GTA · mission démarrée', m.ref, 'Suivi de position activé jusqu’à la fin de la mission'); return m;
};
/** Point de suivi : refusé hors mission active (règle de protection : fin de mission = fin du suivi). */
G.track = function (S, cid, id, pt) {
  var m = mission(S, cid, id), st = G.D(S, cid).settings;
  if (m.status !== 'en_route' && m.status !== 'sur_site') fail('Suivi inactif : aucune position n’est enregistrée hors d’une mission en cours.');
  var t = pt.t || G.now(S, cid); if (m.endedAt && t > m.endedAt) fail('Position postérieure à la fin de mission refusée.');
  m.track.push({ t: t, lat: pt.lat, lng: pt.lng, acc: pt.acc || 30 });
  var pr = G.project(m.route, pt.lat, pt.lng), off = pr.d / 1000 > st.deviationKm;
  var lastAlert = m.alerts.filter(function (a) { return a.code === 'ECART'; }).pop();
  if (off && (!lastAlert || lastAlert.closed)) m.alerts.push({ t: t, code: 'ECART', text: 'Écart significatif par rapport à l’itinéraire (' + Math.round(pr.d / 1000) + ' km)', closed: false });
  if (!off && lastAlert && !lastAlert.closed) { lastAlert.closed = t; }
  if (m.status === 'en_route' && G.dist(pt.lat, pt.lng, m.to.lat, m.to.lng) <= (m.to.radius || 300)) m.arrivalPrompt = true;
  return m;
};
G.confirmArrival = function (S, cid, id, opts) {
  opts = opts || {}; var m = mission(S, cid, id); selfOrManager(S, cid, m);
  if (m.status !== 'en_route') fail('La mission n’est pas en route.');
  var last = m.track[m.track.length - 1], at = opts.at || G.now(S, cid);
  if (!opts.force && (!last || G.dist(last.lat, last.lng, m.to.lat, m.to.lng) > (m.to.radius || 300) * 3)) fail('Arrivée non détectée : vous êtes à ' + Math.round(G.dist(last.lat, last.lng, m.to.lat, m.to.lng) / 1000) + ' km de la destination.');
  m.status = 'sur_site'; m.arrivedAt = at; m.arrivalPrompt = false;
  var d = G.D(S, cid);
  m.empIds.forEach(function (eid) {
    var e = P().emp(S, cid, eid), a = G.assign(S, cid, eid);
    var sc = G.score({ distance: G.dist(last.lat, last.lng, m.to.lat, m.to.lng), radius: m.to.radius || 300, accuracy: last.acc, device: a.device ? 'ok' : 'none', qr: '', wifi: '', mock: false, speedKmh: null, maxSpeed: 999 });
    d.punches.push({ id: U.uid('pt'), empId: eid, matricule: e.matricule, date: at.slice(0, 10), time: at.slice(11, 16), kind: 'in', viaMission: m.id, siteCode: m.to.code, siteLabel: m.to.label, lat: last.lat, lng: last.lng, accuracy: last.acc, distance: Math.round(G.dist(last.lat, last.lng, m.to.lat, m.to.lng)), score: sc.score, details: sc.details, status: sc.score >= d.settings.scoreReject ? 'valide' : 'a_verifier', channel: 'mission', reviewed: null });
  });
  Y.audit(S, cid, 'GTA · arrivée sur site de mission', m.ref, m.to.label); return m;
};
G.endMission = function (S, cid, id, opts) {
  opts = opts || {}; var m = mission(S, cid, id); selfOrManager(S, cid, m);
  if (['en_route', 'sur_site'].indexOf(m.status) < 0) fail('Mission non démarrée ou déjà terminée.');
  var at = opts.at || G.now(S, cid); m.status = 'terminee'; m.endedAt = at; m.arrivalPrompt = false; m.alerts.forEach(function (a) { if (!a.closed) a.closed = at; });
  Y.audit(S, cid, 'GTA · mission terminée', m.ref, 'Suivi de position arrêté automatiquement'); return m;
};
G.cancelMission = function (S, cid, id, comment) { need(S, 'gta.mission'); var m = mission(S, cid, id); if (m.status !== 'planifiee') fail('Seule une mission non démarrée peut être annulée.'); if (!comment) fail('Motif obligatoire.'); m.status = 'annulee'; m.cancel = Object.assign({ comment: comment }, who(S)); return m; };
/** Vue calculée d'une mission à l'instant `now` : statut affiché, dernière position, progression, ETA. */
G.missionView = function (S, cid, m, now) {
  var st = G.D(S, cid).settings; now = now || G.now(S, cid);
  var total = polyLen(m.route), last = m.track[m.track.length - 1] || null, v = { m: m, status: m.status, label: G.MISSION_STATUS[m.status][0], tone: G.MISSION_STATUS[m.status][1], totalKm: Math.round(total / 1000), progress: 0, remainingKm: null, eta: '', delayMin: 0, last: last, lastLabel: '', alerts: m.alerts.filter(function (a) { return !a.closed; }) };
  if (m.status === 'planifiee') {
    if (now > addMin(m.plannedStart, st.departureGraceMin) && now.slice(0, 10) <= m.plannedEnd) { v.label = 'Départ non détecté'; v.tone = 'bad'; v.code = 'NO_DEP'; }
    v.lastLabel = m.from.label;
    return v;
  }
  if (last) { var pr = G.project(m.route, last.lat, last.lng); v.progress = Math.max(0, Math.min(100, Math.round(pr.along * 100 / (total || 1)))); v.remainingKm = Math.max(0, Math.round((total - pr.along) / 1000)); v.lastLabel = G.nearestCity(last.lat, last.lng); v.offKm = Math.round(pr.d / 1000); }
  if (m.status === 'en_route') {
    var speed = st.speedKmh, mins = Math.round((v.remainingKm || 0) / speed * 60);
    v.eta = addMin(now, mins); v.etaMin = mins; v.delayMin = Math.max(0, minBetween(m.plannedArrival, v.eta));
    if (v.delayMin > st.delayAlertMin) { v.label = 'Retard probable'; v.tone = 'warn'; v.code = 'LATE'; }
    if (v.alerts.length) { v.tone = 'bad'; v.code = 'ECART'; v.label = 'Écart d’itinéraire'; }
    if (m.arrivalPrompt) { v.label = 'Arrivée détectée · à confirmer'; v.tone = 'ok'; }
  }
  if (m.status === 'sur_site' || m.status === 'terminee') v.progress = 100;
  return v;
};
/** Démonstration : fait progresser les missions simulées jusqu'à `now` (en production, les points viennent des téléphones). */
G.simulate = function (S, cid, now) {
  var d = G.D(S, cid);
  d.missions.forEach(function (m) {
    if (!m.sim) return;
    if (m.status === 'planifiee' && m.sim.departAt && m.sim.departAt <= now) { G._bypass = true; try { G.startMission(S, cid, m.id, { at: m.sim.departAt }); } finally { G._bypass = false; } }
    if (m.status !== 'en_route') return;
    var total = polyLen(m.route), lastT = m.track[m.track.length - 1].t;
    for (var t = addMin(lastT, 10); t <= now; t = addMin(t, 10)) {
      var mins = minBetween(m.startedAt, t) - (m.sim.pauseMin || 0), km = Math.max(0, mins) / 60 * (m.sim.speedKmh || d.settings.speedKmh), pos = G.along(m.route, Math.min(total, km * 1000));
      if (m.sim.detour && km * 1000 > m.sim.detour.atKm * 1000 && km * 1000 < (m.sim.detour.atKm + m.sim.detour.lenKm) * 1000) pos = { lat: pos.lat + m.sim.detour.dLat, lng: pos.lng + m.sim.detour.dLng };
      G.track(S, cid, m.id, { t: t, lat: pos.lat, lng: pos.lng, acc: 18 });
      if (m.status !== 'en_route' || m.arrivalPrompt) break;
    }
  });
};
G.advanceClock = function (S, cid, minutes) {
  var s = G.D(S, cid).settings; if (!s.demoNow) fail('Horloge réelle : rien à avancer.');
  s.demoNow = addMin(s.demoNow, minutes); G.simulate(S, cid, s.demoNow); G.expireControls(S, cid, s.demoNow); return s.demoNow;
};
/** Conservation : positions effacées après le délai (seul le résultat du pointage reste). */
G.purge = function (S, cid, today) {
  var d = G.D(S, cid), lim = U.addDays(today || S.meta.today, -d.settings.retentionDays), n = 0;
  d.punches.forEach(function (p) { if (p.date < lim && p.lat != null) { p.lat = null; p.lng = null; p.purged = true; n++; } });
  d.missions.forEach(function (m) { if (m.endedAt && m.endedAt.slice(0, 10) < lim && m.track.length) { n += m.track.length; m.track = []; m.purged = true; } });
  return n;
};

/* ======================================================================= tableau de bord & alertes */
G.today = function (S, cid, date) {
  var now = G.now(S, cid); date = date || now.slice(0, 10);
  var cells = A().cells(S, cid, date, date);
  return G.scope(S, cid).map(function (e) { return G.day(S, cid, e, date, { now: now, cells: cells }); });
};
G.notifications = function (S, cid) {
  var d = G.D(S, cid), out = [], now = G.now(S, cid), scope = G.scope(S, cid), ids = scope.map(function (e) { return e.id; });
  function push(level, title, text, page, tab) { out.push({ level: level, title: title, text: text, page: page, tab: tab, module: 'gta' }); }
  if (G.can(S, 'gta.validate') || G.can(S, 'gta.manage')) {
    var rv = d.punches.filter(function (p) { return p.status === 'a_verifier' && ids.indexOf(p.empId) > -1; });
    if (rv.length) push('warn', rv.length + ' pointage(s) à vérifier', 'Score de confiance intermédiaire, appareil inconnu ou hors zone.', 'gta', 'pointages');
    var nr = d.controls.filter(function (c) { return c.result === 'sans_reponse' && ids.indexOf(c.empId) > -1 && c.date >= U.addDays(now.slice(0, 10), -7); });
    if (nr.length) push('bad', nr.length + ' contrôle(s) de présence sans réponse', 'Sur les 7 derniers jours.', 'gta', 'controles');
  }
  if (G.can(S, 'gta.track')) d.missions.forEach(function (m) {
    if (!m.empIds.some(function (x) { return ids.indexOf(x) > -1; })) return;
    var v = G.missionView(S, cid, m, now);
    if (v.code === 'NO_DEP') push('bad', m.ref + ' · départ non détecté', m.label + ' · départ prévu ' + m.plannedStart.slice(11), 'gta-missions', 'live');
    if (v.code === 'LATE') push('warn', m.ref + ' · retard probable de ' + G.dur(v.delayMin), m.label + ' · arrivée estimée ' + v.eta.slice(11), 'gta-missions', 'live');
    if (v.code === 'ECART') push('bad', m.ref + ' · écart d’itinéraire', v.alerts[0].text, 'gta-missions', 'live');
  });
  if (G.can(S, 'gta.manage')) { var dev = Object.keys(d.assign).filter(function (k) { return d.assign[k].pendingDevice && ids.indexOf(k) > -1; }); if (dev.length) push('info', dev.length + ' changement(s) de téléphone à approuver', 'Un pointage depuis un nouvel appareil reste « à vérifier ».', 'gta-param', 'affectations'); }
  var me = A().me(S, cid);
  if (me && G.can(S, 'self')) {
    var day = G.day(S, cid, me, now.slice(0, 10), { now: now });
    if (day.status === 'non_pointe') push('warn', 'Vous n’avez pas pointé votre arrivée', 'Utilisez le lien WhatsApp reçu ce matin.', 'moi', 'pointage');
    d.controls.filter(function (c) { return c.empId === me.id && c.result === 'en_attente' && c.deadline >= now; }).forEach(function (c) { push('bad', 'Contrôle de présence : répondez avant ' + c.deadline.slice(11), 'Lien personnel reçu sur WhatsApp.', 'moi', 'pointage'); });
  }
  return out;
};

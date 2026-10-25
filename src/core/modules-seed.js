/*
 * Jeu de démonstration · Temps & présence, Congés & absences, Stocks & inventaires.
 * Démarrage de la GTA au 1er octobre 2026 (notice acceptée le 28/09), horloge de démonstration figée au 21/10/2026 à 10:31.
 */
import { Y } from './registry.js';

var U = Y.util, P = Y.Paie, G = Y.GTA, A = Y.Abs, K = Y.Stock;
function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
var PHONES = ['Tecno Spark 20', 'Samsung Galaxy A15', 'Infinix Hot 40', 'iPhone 12', 'Itel A70', 'Xiaomi Redmi 13C', 'Samsung Galaxy A05', 'Tecno Camon 30'];
function as(S, id, name, roleName) { S.meta.currentUser = { id: id, name: name, role: roleName }; }

Y.seedModules = function (S, cid, profile, today) {
  if (!G || !A) return;
  var save = S.meta.currentUser; G._bypass = A._bypass = true; if (K) K._bypass = true; P._bypass = true;
  try { if (profile === 'deygo') seedDeygo(S, cid, today); else seedHolding(S, cid, today); }
  finally { G._bypass = A._bypass = false; if (K) K._bypass = false; P._bypass = false; S.meta.currentUser = save; }
};

function emp(S, cid, m) { return P.emp(S, cid, m); }
function at(lat, lng, meters, R) { var a = R() * Math.PI * 2, r = meters * (0.3 + R() * 0.7); return { lat: lat + Math.sin(a) * r / 111320, lng: lng + Math.cos(a) * r / (111320 * Math.cos(lat * Math.PI / 180)) }; }

function seedHolding(S, cid, today) {
  var R = rng(4021), g = G.D(S, cid), a = A.D(S, cid);
  as(S, 'u5', 'Gestionnaire paie · B. Ngono', 'payroll');
  /* ---------------------------------------------------------------- sites & horaires */
  [['SIEGE-DLA', 'Siège Yiel Group · Bonapriso', 'siege', 'Douala', 4.0263, 9.6957, 150, 'YIEL-STAFF'], ['AG-YDE', 'Agence Yaoundé · Bastos', 'agence', 'Yaoundé', 3.8890, 11.5080, 150, 'YIEL-YDE'],
   ['CL-TEL-YDE', 'Client opérateur télécom · Yaoundé', 'client', 'Yaoundé', 3.8667, 11.5167, 200, ''], ['CL-BQ-AKWA', 'Client banque · Akwa, Douala', 'client', 'Douala', 4.0500, 9.7000, 120, ''],
   ['CL-KRIBI', 'Site client · zone portuaire de Kribi', 'client', 'Kribi', 2.9400, 9.9100, 300, ''], ['CL-BERTOUA', 'Site client · Bertoua', 'client', 'Bertoua', 4.5770, 13.6846, 300, ''],
   ['CL-LIMBE', 'Site client · Limbé', 'client', 'Limbé', 4.0242, 9.2149, 250, '']
  ].forEach(function (s) { G.saveSite(S, cid, { code: s[0], label: s[1], type: s[2], city: s[3], lat: s[4], lng: s[5], radius: s[6], wifi: s[7] }); });
  var siteOf = { DLA: 'SIEGE-DLA', YDE: 'AG-YDE' };
  var list = P.D(S, cid).employees.filter(function (e) { return e.statut !== 'sorti'; });
  list.forEach(function (e, i) {
    var sched = e.service === 'Moyens généraux' ? (e.poste === 'Chauffeur' ? 'TER' : 'SIX') : (e.service === 'Conseil' || e.service === 'Commercial' ? 'TER' : 'ADM');
    var sites = [siteOf[e.site] || 'SIEGE-DLA']; if (e.service === 'Conseil') sites = sites.concat(['CL-TEL-YDE', 'CL-BQ-AKWA']);
    G.setAssign(S, cid, e.id, { schedule: sched, sites: sites, mode: e.service === 'Conseil' || e.poste === 'Chauffeur' ? 'mixte' : 'site' });
    G.registerDevice(S, cid, e.id, { id: 'dev-' + e.matricule.toLowerCase(), label: PHONES[i % PHONES.length] });
    var x = G.assign(S, cid, e.id); x.consent = { at: '2026-09-28T09:00:00.000Z', version: '2026-10' };
    if (x.device) x.device.at = '2026-09-28T09:15:00.000Z';
  });
  G.setAssign(S, cid, emp(S, cid, 'YG0013').id, { home: { lat: 4.0612, lng: 9.7301, radius: 200 } });
  g.settings.demoNow = today + 'T10:31';

  /* ---------------------------------------------------------------- absences */
  a.managers = { 'Direction financière': 'YG0001', 'Ressources humaines': 'YG0002', 'Conseil': 'YG0005', 'Produit': 'YG0009', 'Commercial': 'YG0017', 'Moyens généraux': 'YG0001' };
  var MGR = { YG0001: ['u7', 'DAF · P. Tchoumi', 'cfo'], YG0002: ['u6', 'DRH · E. Fouda', 'hr'], YG0005: ['u10', 'Manager · J-P. Essomba', 'manager'], YG0009: ['u8', 'Manager · R. Nana', 'manager'], YG0017: ['u11', 'Manager · S. Manga', 'manager'] };
  function req(m, type, start, end, steps, extra) {
    extra = extra || {}; var e = emp(S, cid, m), tmp = null;
    if (extra.self) { tmp = { id: 'tmp-seed', name: P.fullName(e), role: 'employee', companies: [cid], employee: {} }; tmp.employee[cid] = e.matricule; S.users.push(tmp); as(S, 'tmp-seed', P.fullName(e), 'employee'); }
    else as(S, 'u5', 'Gestionnaire paie · B. Ngono', 'payroll');
    var r;
    try { r = A.request(S, cid, Object.assign({ empId: e.id, type: type, start: start, end: end, reason: extra.reason || '', proof: extra.proof || '' }, extra.half || {})); }
    finally { if (tmp) S.users.splice(S.users.indexOf(tmp), 1); }
    var ts = (extra.created || U.addDays(start, -20)) + 'T09:12:00.000Z'; r.createdAt = ts; r.history[0].at = ts;
    (steps || []).forEach(function (s, i) {
      var step = r.steps[r.step]; if (!step) return;
      if (s === 'refuse') { var mg = MGR[r.approver] || ['u6', 'DRH · E. Fouda', 'hr']; as(S, mg[0], mg[1], mg[2]); A.decide(S, cid, r.id, 'refuse', extra.refuse || 'Couverture du service insuffisante sur la période.'); return; }
      if (step === 'n1') { var m2 = MGR[r.approver] || ['u6', 'DRH · E. Fouda', 'hr']; as(S, m2[0], m2[1], m2[2]); }
      else if (step === 'rh') as(S, 'u6', 'DRH · E. Fouda', 'hr');
      else as(S, 'u5', 'Gestionnaire paie · B. Ngono', 'payroll');
      A.decide(S, cid, r.id, 'approve', s === true ? '' : s);
      var h = r.history[r.history.length - 1]; h.at = U.addDays(ts.slice(0, 10), i + 1) + 'T1' + (i + 1) + ':05:00.000Z';
      if (r.notified && !r.notified.at.startsWith('2026-10-2')) r.notified.at = h.at;
    });
    return r;
  }
  req('YG0006', 'CP', '2026-10-06', '2026-10-10', [true, true], { self: true, reason: 'Congés annuels', created: '2026-09-10' });
  req('YG0013', 'MAL', '2026-10-20', '2026-10-21', [true], { self: true, proof: 'certificat-medical-20102026.pdf', reason: 'Paludisme', created: '2026-10-20' });
  req('YG0008', 'CSS', '2026-10-16', '2026-10-16', [true, true], { self: true, reason: 'Démarches administratives à Bafoussam', created: '2026-10-01' });
  ['2026-10-02', '2026-10-09', '2026-10-23', '2026-10-30'].forEach(function (dt) { req('YG0013', 'TT', dt, dt, [true, true], { self: true, reason: 'Télétravail du vendredi', created: '2026-09-25' }); });
  req('YG0007', 'NAIS', '2026-09-23', '2026-09-25', [true, true], { self: true, proof: 'acte-de-naissance.pdf', reason: 'Naissance de ma fille', created: '2026-09-22' });
  req('YG0017', 'CP', '2026-12-14', '2026-12-24', [true, true], { self: true, reason: 'Fêtes de fin d’année', created: '2026-10-05' });
  req('YG0001', 'CP', '2026-12-28', '2027-01-02', ['Validé par la DRH (N+1 absent du référentiel)', true], { self: true, reason: 'Fêtes de fin d’année', created: '2026-10-08' });
  req('YG0014', 'CP', '2026-10-26', '2026-10-30', ['refuse'], { self: true, reason: 'Voyage familial', created: '2026-10-12', refuse: 'Clôture du sprint de déploiement myyiel : merci de reporter en novembre.' });
  // en cours de circuit
  req('YG0010', 'CP', '2026-11-02', '2026-11-13', [], { self: true, reason: 'Congés annuels', created: '2026-10-19'});
  req('YG0012', 'CP', '2026-11-05', '2026-11-06', [], { self: true, reason: 'Mariage d’un ami à Dschang', created: '2026-10-20' });
  req('YG0006', 'CP', '2026-11-23', '2026-11-28', ['Bon pour moi, penser à la passation du dossier banque.'], { self: true, reason: 'Congés', created: '2026-10-15' });
  req('YG0009', 'CP', '2026-12-21', '2026-12-31', [], { self: true, reason: 'Fêtes de fin d’année', created: '2026-10-18'});
  req('YG0016', 'CSS', '2026-11-16', '2026-11-17', [], { self: true, reason: 'Obsèques au village', created: '2026-10-20' });
  req('YG0011', 'MAL', '2026-10-19', '2026-10-19', [], { self: true, reason: 'Consultation médicale', created: '2026-10-19' });
  a.delegations.push({ from: 'YG0009', to: 'YG0010', start: '2026-12-21', end: '2026-12-31', by: 'R. Nana' });
  A.D(S, cid).counters[2026] = { }; A.D(S, cid).counters[2026][emp(S, cid, 'YG0010').id] = { REC: 1.5 }; A.D(S, cid).counters[2026][emp(S, cid, 'YG0016').id] = { REC: 2 };

  /* ---------------------------------------------------------------- pointages du 01/10 au 21/10 */
  var key = today.slice(0, 7), first = key + '-01', cells = A.cells(S, cid, first, today);
  var lateBias = { YG0007: 0.25, YG0016: 0.15, YG0014: 0.2, YG0012: 0.15 };
  var extra = { 'YG0010|2026-10-07': 240, 'YG0010|2026-10-14': 240, 'YG0010|2026-10-15': 180, 'YG0011|2026-10-09': 360, 'YG0012|2026-10-15': 120, 'YG0005|2026-10-08': 90 };
  var sunday = { 'YG0016|2026-10-04': ['07:00', '15:00'], 'YG0016|2026-10-11': ['08:00', '14:00'] };
  function punchAt(e, date, time, kind, o) {
    o = o || {}; var x = G.assign(S, cid, e.id), site = G.site(S, cid, o.site || x.sites[0]);
    var pos = o.pos || at(site.lat, site.lng, o.off != null ? o.off : site.radius * 0.6, R);
    var l = G.issueLink(S, cid, e.id, kind, { at: date + 'T' + time });
    return G.punch(S, cid, { token: l.token, lat: pos.lat, lng: pos.lng, accuracy: o.acc || 8 + Math.round(R() * 20), deviceId: o.device || (x.device && x.device.id), wifi: o.wifi === false ? '' : (R() < 0.6 && site.wifi && site.wifi[0]) || '', mock: o.mock, qr: o.qr, at: date + 'T' + time });
  }
  var missionDays = { 'YG0005|2026-10-07': 1, 'YG0016|2026-10-13': 1, 'YG0016|2026-10-14': 1, 'YG0017|2026-10-13': 1, 'YG0017|2026-10-14': 1 };
  for (var dt = first; dt <= today; dt = U.addDays(dt, 1)) {
    list.forEach(function (e) {
      if (e.embauche > dt) return;
      var k = e.matricule + '|' + dt, x = G.assign(S, cid, e.id), h = G.schedule(S, cid, x.schedule), w = A.dow(dt);
      if (sunday[k]) { punchAt(e, dt, sunday[k][0], 'in', { site: 'SIEGE-DLA' }); punchAt(e, dt, sunday[k][1], 'out', { site: 'SIEGE-DLA' }); return; }
      if (h.days.indexOf(w) < 0 || A.isHoliday(S, cid, dt)) return;
      var c = (cells[e.id] || {})[dt]; if (c && c.status === 'approuvee' && c.code !== 'TT') return;
      if (missionDays[k]) return;
      if (e.matricule === 'YG0018' && dt === '2026-10-12') return; // absence injustifiée
      if (e.matricule === 'YG0011' && dt === '2026-10-19') return; // déclaration maladie en attente
      var isToday = dt === today;
      var lateP = lateBias[e.matricule] || 0.06, late = R() < lateP;
      var inM = G.hm(h.start) - 18 + Math.round(R() * 24) + (late ? 15 + Math.round(R() * 40) : 0);
      if (isToday && ['YG0015', 'YG0009', 'YG0005', 'YG0006', 'YG0007', 'YG0008', 'YG0016', 'YG0014', 'YG0013'].indexOf(e.matricule) > -1) return; // non pointés / en mission / absents ce matin
      var siteCode = c && c.code === 'TT' ? null : x.sites[0];
      if (c && c.code === 'TT') { punchAt(e, dt, G.fmtHM(inM), 'in', { site: x.sites[0], pos: { lat: 4.0612, lng: 9.7301 }, wifi: false }); if (!isToday) punchAt(e, dt, G.fmtHM(G.hm(h.end) + Math.round(R() * 20)), 'out', { site: x.sites[0], pos: { lat: 4.0612, lng: 9.7301 }, wifi: false }); return; }
      // incidents
      if (e.matricule === 'YG0007' && dt === '2026-10-14') { punchAt(e, dt, '07:52', 'in', { mock: true, off: 30 }); punchAt(e, dt, '08:41', 'in', { qr: G.site(S, cid, 'AG-YDE').qr, off: 20 }); punchAt(e, dt, '16:35', 'out'); return; }
      if (e.matricule === 'YG0014' && dt === '2026-10-19') { punchAt(e, dt, '07:58', 'in', { off: 2400, wifi: false }); punchAt(e, dt, '17:04', 'out'); return; }
      if (e.matricule === 'YG0012' && dt === '2026-10-20') { punchAt(e, dt, '07:55', 'in', { device: 'dev-nouveau-yg0012' }); punchAt(e, dt, '19:12', 'out', { device: 'dev-nouveau-yg0012' }); return; }
      punchAt(e, dt, G.fmtHM(inM), 'in', { site: siteCode });
      if (isToday) return;
      if (e.matricule === 'YG0016' && dt === '2026-10-16') return; // oubli de pointage de sortie
      var outM = G.hm(h.end) + Math.round(R() * 25) + (extra[k] || 0) - (R() < 0.03 ? 45 : 0);
      punchAt(e, dt, G.fmtHM(outM), 'out', { site: siteCode });
    });
  }
  // heures supplémentaires déjà acceptées au fil de l'eau par les N+1
  var st = g.sheets[key] = g.sheets[key] || {};
  [['YG0010', ['2026-10-07', '2026-10-14', '2026-10-15']], ['YG0011', ['2026-10-09']], ['YG0016', ['2026-10-04', '2026-10-11']], ['YG0005', ['2026-10-08']]].forEach(function (x) {
    var e = emp(S, cid, x[0]); st[e.id] = st[e.id] || { status: 'ouverte', ot: {}, abs: {}, history: [] }; x[1].forEach(function (dd) { st[e.id].ot[dd] = 'approuve'; });
  });

  /* ---------------------------------------------------------------- missions */
  as(S, 'u6', 'DRH · E. Fouda', 'hr');
  function mis(o, run) { var m = G.createMission(S, cid, o); m.createdAt = (o.created || o.plannedStart.slice(0, 10)) + 'T08:00:00.000Z'; if (run) run(m); return m; }
  mis({ empIds: [emp(S, cid, 'YG0005').id], label: 'Atelier de cadrage SIRH', client: 'Client industriel · Limbé', fromSite: 'SIEGE-DLA', toSite: 'CL-LIMBE', plannedStart: '2026-10-07T07:00', plannedArrival: '2026-10-07T08:45', transport: 'vehicule', perDiem: 15000, created: '2026-10-02' }, function (m) {
    G.startMission(S, cid, m.id, { at: '2026-10-07T07:04' }); G.simulateMission(S, cid, m, '2026-10-07T08:40'); G.confirmArrival(S, cid, m.id, { at: '2026-10-07T08:43', force: true }); G.endMission(S, cid, m.id, { at: '2026-10-07T17:40' }); });
  mis({ empIds: [emp(S, cid, 'YG0017').id, emp(S, cid, 'YG0016').id], label: 'Tournée commerciale Ouest', client: 'Prospects PME · Bafoussam', fromSite: 'SIEGE-DLA', toCity: 'Bafoussam', plannedStart: '2026-10-13T06:30', plannedArrival: '2026-10-13T10:30', plannedEnd: '2026-10-14', transport: 'vehicule', perDiem: 25000, created: '2026-10-08' }, function (m) {
    G.startMission(S, cid, m.id, { at: '2026-10-13T06:41' }); G.simulateMission(S, cid, m, '2026-10-13T10:20'); G.confirmArrival(S, cid, m.id, { at: '2026-10-13T10:24', force: true }); G.endMission(S, cid, m.id, { at: '2026-10-14T18:30' }); });
  // missions du jour (suivi en direct à 10:31)
  mis({ empIds: [emp(S, cid, 'YG0006').id], label: 'Recette du module RH', client: 'Client opérateur télécom', fromSite: 'AG-YDE', toSite: 'CL-TEL-YDE', plannedStart: today + 'T08:00', plannedArrival: today + 'T08:45', transport: 'personnel', perDiem: 0, created: '2026-10-17' }, function (m) {
    G.startMission(S, cid, m.id, { at: today + 'T08:06' }); G.simulateMission(S, cid, m, today + 'T08:38'); G.confirmArrival(S, cid, m.id, { at: today + 'T08:39', force: true }); });
  mis({ empIds: [emp(S, cid, 'YG0007').id], label: 'Paramétrage paie · client bancaire', client: 'Client banque · Akwa', fromSite: 'AG-YDE', toSite: 'CL-BQ-AKWA', plannedStart: today + 'T07:30', plannedArrival: today + 'T11:30', transport: 'bus', perDiem: 20000, created: '2026-10-16', sim: { departAt: today + 'T07:41', speedKmh: 55, pauseMin: 20 } });
  mis({ empIds: [emp(S, cid, 'YG0008').id], label: 'Audit organisationnel', client: 'Client logistique portuaire', fromSite: 'SIEGE-DLA', toSite: 'CL-KRIBI', plannedStart: today + 'T07:00', plannedArrival: today + 'T10:15', transport: 'vehicule', perDiem: 20000, created: '2026-10-15', sim: { departAt: today + 'T07:25', speedKmh: 45, pauseMin: 15 } });
  mis({ empIds: [emp(S, cid, 'YG0014').id], label: 'Installation des terminaux de pointage', client: 'Site client · Bertoua', fromSite: 'AG-YDE', toSite: 'CL-BERTOUA', plannedStart: today + 'T08:00', plannedArrival: today + 'T13:30', plannedEnd: U.addDays(today, 1), transport: 'bus', perDiem: 20000, created: '2026-10-14' });
  mis({ empIds: [emp(S, cid, 'YG0016').id, emp(S, cid, 'YG0009').id], label: 'Livraison de matériel · agence Yaoundé', client: 'Interne', fromSite: 'SIEGE-DLA', toSite: 'AG-YDE', plannedStart: today + 'T08:00', plannedArrival: today + 'T12:30', transport: 'vehicule', perDiem: 10000, created: '2026-10-19', sim: { departAt: today + 'T08:10', speedKmh: 62, pauseMin: 0, detour: { atKm: 110, lenKm: 45, dLat: 0.11, dLng: 0.05 } } });
  mis({ empIds: [emp(S, cid, 'YG0005').id], label: 'Kick-off projet myyiel', client: 'Site client · Kribi', fromSite: 'SIEGE-DLA', toSite: 'CL-KRIBI', plannedStart: U.addDays(today, 1) + 'T06:30', plannedArrival: U.addDays(today, 1) + 'T09:30', plannedEnd: U.addDays(today, 2), transport: 'vehicule', perDiem: 20000, created: '2026-10-20' });
  G.simulate(S, cid, g.settings.demoNow);

  /* ---------------------------------------------------------------- contrôles aléatoires du jour */
  var ctl = G.planControls(S, cid, today, { system: true, n: 3, salt: 'demo' });
  ctl.forEach(function (c, i) {
    var times = ['09:34', '09:58', '10:22'];
    c.sentAt = today + 'T' + times[i]; c.deadline = G.addMin(c.sentAt, g.settings.controls.answerMin);
    var l = g.links.find(function (x) { return x.token === c.token; }); l.createdAt = c.sentAt; l.expiresAt = c.deadline;
    if (i === 0) { var e = P.emp(S, cid, c.empId), x = G.assign(S, cid, e.id), s = G.site(S, cid, x.sites[0]), pos = at(s.lat, s.lng, 40, R); G.punch(S, cid, { token: c.token, lat: pos.lat, lng: pos.lng, accuracy: 12, deviceId: x.device && x.device.id, at: today + 'T09:37' }); }
  });
  G.expireControls(S, cid, g.settings.demoNow);
  // contrôles passés
  ['2026-10-06', '2026-10-13', '2026-10-19'].forEach(function (dd, j) { G.planControls(S, cid, dd, { system: true, n: 2, salt: 'p' + j }).forEach(function (c, i) { if (i === 0 || j !== 1) { var e = P.emp(S, cid, c.empId), x = G.assign(S, cid, e.id), s = G.site(S, cid, x.sites[0]), pos = at(s.lat, s.lng, 50, R); try { G.punch(S, cid, { token: c.token, lat: pos.lat, lng: pos.lng, accuracy: 15, deviceId: x.device && x.device.id, at: G.addMin(c.sentAt, 4) }); } catch (er) { /* rien */ } } }); G.expireControls(S, cid, dd + 'T23:59'); });

  /* ---------------------------------------------------------------- stocks */
  if (K) seedStock(S, cid, R, 'holding');
}

/** Démonstration : fait progresser une mission terminée dans le passé. */
G.simulateMission = function (S, cid, m, until) {
  var total = G.polyLen(m.route);
  for (var t = G.addMin(m.startedAt, 10); t <= until; t = G.addMin(t, 10)) { var mins = G.minBetween(m.startedAt, t), pos = G.along(m.route, Math.min(total, mins / 60 * 60 * 1000)); G.track(S, cid, m.id, { t: t, lat: pos.lat, lng: pos.lng, acc: 15 }); }
  var end = m.route[m.route.length - 1]; G.track(S, cid, m.id, { t: until, lat: end.lat, lng: end.lng, acc: 12 });
};

function seedStock(S, cid, R, profile) {
  as(S, 'u2', 'A. Mbarga', 'accountant');
  if (profile === 'deygo') {
    K.saveWarehouse(S, cid, { code: 'DEP-BON', label: 'Dépôt Bonamoussadi', site: 'Douala' });
    [['GAZOLE', 'Gazole (litres)', 'fourniture', 'litre', 828, 300], ['CASQUE', 'Casque moto homologué', 'fourniture', 'unité', 18500, 4], ['SAC-ISO', 'Sac isotherme de livraison', 'fourniture', 'unité', 12000, 6], ['PNEU-MOTO', 'Pneu moto 2.75-18', 'fourniture', 'unité', 14500, 4]].forEach(function (x) { K.saveArticle(S, cid, { code: x[0], label: x[1], family: x[2], unit: x[3], cost: x[4], minQty: x[5], wh: 'DEP-BON' }, { create: true }); });
    K.addMove(S, cid, { type: 'entree', article: 'GAZOLE', wh: 'DEP-BON', qty: 1200, unitCost: 828, date: '2026-09-01', motif: 'Stock initial', ref: 'SI-2026' }, { system: true, silent: true });
    K.addMove(S, cid, { type: 'sortie', article: 'GAZOLE', wh: 'DEP-BON', qty: 940, date: '2026-09-30', motif: 'Consommation interne', ref: 'Tournées septembre' }, { system: true, silent: true });
    K.addMove(S, cid, { type: 'entree', article: 'GAZOLE', wh: 'DEP-BON', qty: 1000, unitCost: 840, date: '2026-10-02', motif: 'Réception fournisseur', ref: 'BL station' }, { system: true, silent: true });
    K.addMove(S, cid, { type: 'sortie', article: 'GAZOLE', wh: 'DEP-BON', qty: 610, date: '2026-10-20', motif: 'Consommation interne', ref: 'Tournées octobre' }, { system: true, silent: true });
    ['CASQUE', 'SAC-ISO', 'PNEU-MOTO'].forEach(function (c, i) { K.addMove(S, cid, { type: 'entree', article: c, wh: 'DEP-BON', qty: [10, 12, 8][i], date: '2026-09-01', motif: 'Stock initial', ref: 'SI-2026' }, { system: true, silent: true }); K.addMove(S, cid, { type: 'sortie', article: c, wh: 'DEP-BON', qty: [7, 4, 5][i], date: '2026-10-10', motif: 'Consommation interne' }, { system: true, silent: true }); });
    return;
  }
  K.saveWarehouse(S, cid, { code: 'MAG-DLA', label: 'Magasin du siège · Douala', site: 'SIEGE-DLA', keeper: 'G. Tabi' });
  K.saveWarehouse(S, cid, { code: 'STK-YDE', label: 'Stock de l’agence · Yaoundé', site: 'AG-YDE', keeper: 'I. Moussa' });
  Y.createItem(S, cid, { code: 'TAB-10', label: 'Tablette 10" de pointage et de caisse (revente)', unit: 'unité', price: 145000, account: '701', section: 'LOG', taxCode: 'TVA19' });
  Y.createItem(S, cid, { code: 'LEC-QR', label: 'Lecteur QR / NFC USB (revente)', unit: 'unité', price: 32000, account: '701', section: 'LOG', taxCode: 'TVA19' });
  [['TAB-10', 'Tablette 10" de pointage et de caisse', 'marchandise', 'unité', 95000, 145000, 5, 'TAB-10', 'MAG-DLA'], ['LEC-QR', 'Lecteur QR / NFC USB', 'marchandise', 'unité', 18000, 32000, 10, 'LEC-QR', 'MAG-DLA'],
   ['ROUT-4G', 'Routeur 4G de secours', 'marchandise', 'unité', 42000, 69000, 4, '', 'MAG-DLA'], ['RAM-A4', 'Ramette papier A4 80 g', 'fourniture', 'ramette', 2900, 0, 20, '', 'MAG-DLA'],
   ['TON-26A', 'Toner imprimante laser 26A', 'fourniture', 'unité', 38000, 0, 2, '', 'MAG-DLA'], ['BAD-PVC', 'Badge PVC personnalisé (QR de site)', 'fourniture', 'unité', 650, 0, 100, '', 'MAG-DLA'],
   ['KIT-BIENV', 'Kit de bienvenue client (brochures, clé USB)', 'fourniture', 'kit', 7500, 0, 20, '', 'MAG-DLA'], ['SAC-ORDI', 'Sacoche ordinateur logotée', 'fourniture', 'unité', 9800, 0, 5, '', 'MAG-DLA']
  ].forEach(function (x) { K.saveArticle(S, cid, { code: x[0], label: x[1], family: x[2], unit: x[3], cost: x[4], price: x[5], minQty: x[6], itemCode: x[7], wh: x[8] }, { create: true }); });
  function mv(o) { return K.addMove(S, cid, o, { system: true, silent: true }); }
  [['TAB-10', 24, 92000], ['LEC-QR', 40, 17500], ['ROUT-4G', 6, 41000], ['RAM-A4', 120, 2850], ['TON-26A', 6, 37500], ['BAD-PVC', 600, 600], ['KIT-BIENV', 60, 7200], ['SAC-ORDI', 14, 9800]].forEach(function (x) { mv({ type: 'entree', article: x[0], wh: 'MAG-DLA', qty: x[1], unitCost: x[2], date: '2026-01-05', motif: 'Stock initial', ref: 'SI-2026' }); });
  mv({ type: 'transfert', article: 'TAB-10', wh: 'MAG-DLA', whTo: 'STK-YDE', qty: 6, date: '2026-02-10', ref: 'TR-YDE-01', motif: 'Dotation agence' });
  mv({ type: 'transfert', article: 'LEC-QR', wh: 'MAG-DLA', whTo: 'STK-YDE', qty: 10, date: '2026-02-10', ref: 'TR-YDE-01', motif: 'Dotation agence' });
  mv({ type: 'transfert', article: 'RAM-A4', wh: 'MAG-DLA', whTo: 'STK-YDE', qty: 30, date: '2026-02-10', ref: 'TR-YDE-01', motif: 'Dotation agence' });
  var outs = [['2026-02-18', 'TAB-10', 4, 'Projet client · déploiement myyiel'], ['2026-03-12', 'LEC-QR', 8, 'Projet client · déploiement myyiel'], ['2026-03-30', 'RAM-A4', 25, 'Consommation interne'], ['2026-04-22', 'BAD-PVC', 180, 'Projet client · badges de site'],
    ['2026-05-06', 'TAB-10', 5, 'Vente · client banque'], ['2026-05-20', 'KIT-BIENV', 14, 'Consommation interne'], ['2026-06-15', 'TON-26A', 2, 'Consommation interne'], ['2026-07-08', 'LEC-QR', 6, 'Vente · client télécom'], ['2026-08-26', 'RAM-A4', 30, 'Consommation interne'],
    ['2026-09-09', 'TAB-10', 3, 'Projet client · Kribi'], ['2026-09-30', 'BAD-PVC', 210, 'Projet client · badges de site'], ['2026-10-05', 'KIT-BIENV', 12, 'Consommation interne'], ['2026-10-12', 'RAM-A4', 24, 'Consommation interne']];
  outs.forEach(function (o) { mv({ type: 'sortie', article: o[1], wh: 'MAG-DLA', qty: o[2], date: o[0], motif: o[3], ref: o[3].indexOf('Vente') === 0 ? 'FA client' : '' }); });
  [['2026-04-02', 'TAB-10', 10, 96000], ['2026-06-03', 'LEC-QR', 20, 18200], ['2026-07-15', 'RAM-A4', 60, 3000], ['2026-09-18', 'TAB-10', 6, 98500], ['2026-10-02', 'BAD-PVC', 400, 640]].forEach(function (x) { mv({ type: 'entree', article: x[1], wh: 'MAG-DLA', qty: x[2], unitCost: x[3], date: x[0], motif: 'Réception fournisseur', ref: 'BL-' + x[0].slice(5, 7) + x[0].slice(8) }); });
  mv({ type: 'sortie', article: 'TAB-10', wh: 'STK-YDE', qty: 2, date: '2026-05-14', motif: 'Projet client · Yaoundé' });
  // inventaire semestriel au 30/06 : ouvert et compté par le magasinier, validé par le comptable
  as(S, 'u7', 'DAF · P. Tchoumi', 'cfo');
  var c = K.openCount(S, cid, { date: '2026-06-30', wh: 'MAG-DLA', label: 'Inventaire semestriel du magasin', blind: true });
  c.lines.forEach(function (l) { var q = l.theo; if (l.article === 'TAB-10') q = l.theo - 1; if (l.article === 'BAD-PVC') q = l.theo - 15; if (l.article === 'RAM-A4') q = l.theo + 2; K.setCounted(S, cid, c.id, l.article, q, l.article === 'TAB-10' ? 'Tablette introuvable : enquête en cours' : (l.article === 'BAD-PVC' ? 'Badges abîmés jetés' : (l.article === 'RAM-A4' ? 'Ramettes non enregistrées en sortie' : ''))); });
  K.closeCount(S, cid, c.id);
  as(S, 'u2', 'A. Mbarga', 'accountant'); K.validateCount(S, cid, c.id, 'Écarts justifiés par le magasinier ; tablette déclarée perdue.');
  c.openedBy.at = '2026-06-30T08:00:00.000Z'; c.validatedBy.at = '2026-07-02T10:00:00.000Z';
  // inventaire d'octobre en cours à Yaoundé
  as(S, 'u7', 'DAF · P. Tchoumi', 'cfo');
  var c2 = K.openCount(S, cid, { date: '2026-10-20', wh: 'STK-YDE', label: 'Inventaire tournant · agence Yaoundé', blind: true });
  c2.lines.forEach(function (l, i) { if (i < 4) K.setCounted(S, cid, c2.id, l.article, l.article === 'LEC-QR' ? l.theo - 1 : l.theo); });
}

function seedDeygo(S, cid, today) {
  var R = rng(77), a = A.D(S, cid);
  as(S, 'u5', 'Gestionnaire paie · B. Ngono', 'payroll');
  G.saveSite(S, cid, { code: 'DEP-BON', label: 'DeyGo · dépôt Bonamoussadi', type: 'chantier', city: 'Douala', lat: 4.0920, lng: 9.7420, radius: 120, wifi: 'DEYGO' });
  P.D(S, cid).employees.forEach(function (e, i) {
    G.setAssign(S, cid, e.id, { schedule: e.poste === 'Coursier' || e.poste === 'Chauffeur-livreur' ? 'SIX' : 'ADM', sites: ['DEP-BON'], mode: e.poste === 'Coursier' || e.poste === 'Chauffeur-livreur' ? 'mixte' : 'site' });
    G.registerDevice(S, cid, e.id, { id: 'dev-' + e.matricule.toLowerCase(), label: PHONES[(i + 3) % PHONES.length] });
    G.assign(S, cid, e.id).consent = { at: '2026-09-28T09:00:00.000Z', version: '2026-10' };
  });
  G.D(S, cid).settings.demoNow = today + 'T10:31';
  a.managers = { Exploitation: 'DG0001', Commercial: 'DG0001' };
  var e0 = P.emp(S, cid, 'DG0004'); var r = A.request(S, cid, { empId: e0.id, type: 'CP', start: '2026-11-09', end: '2026-11-14', reason: 'Congés' }); r.history[0].action = 'Demande déposée';
  var key = today.slice(0, 7);
  for (var dt = key + '-01'; dt <= today; dt = U.addDays(dt, 1)) P.D(S, cid).employees.forEach(function (e) {
    var x = G.assign(S, cid, e.id), h = G.schedule(S, cid, x.schedule), w = A.dow(dt); if (h.days.indexOf(w) < 0 || A.isHoliday(S, cid, dt) || e.embauche > dt) return;
    var s = G.site(S, cid, 'DEP-BON'), inM = G.hm(h.start) - 12 + Math.round(R() * 30);
    [['in', inM], ['out', G.hm(h.end) + Math.round(R() * 30)]].forEach(function (p) { if (p[0] === 'out' && dt === today) return; var pos = at(s.lat, s.lng, 80, R); var l = G.issueLink(S, cid, e.id, p[0], { at: dt + 'T' + G.fmtHM(p[1]) }); G.punch(S, cid, { token: l.token, lat: pos.lat, lng: pos.lng, accuracy: 15, deviceId: x.device.id, at: dt + 'T' + G.fmtHM(p[1]) }); });
  });
  if (K) seedStock(S, cid, R, 'deygo');
}

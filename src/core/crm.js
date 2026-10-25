/*
 * Yiel CRM · prospection et développement commercial (pur JavaScript, sans DOM, exécutable sous Node).
 * Gouvernance : la direction autorise une VERSION précise de campagne (périmètre, modèles, règles, calendrier, plafonds) ;
 * le moteur exécute ensuite automatiquement, mais revérifie 9 règles avant CHAQUE envoi.
 * - Accès : authentification (MFA pour les comptes sensibles), isolation par organisation, rôles + périmètre (portefeuille, équipe).
 * - Base : entreprises, contacts, provenance et fiabilité de chaque donnée, import contrôlé (sans création partielle), carte de visite.
 * - Recherche : annuaire avec sources, filtres, qualification assistée, rejet motivé, listes de prospection.
 * - Ventes : pipeline configurable historisé, activités, agenda (Google Calendar), objectifs ; le gain alimente la comptabilité (tiers client).
 * - Communication : modèles versionnés à variables, contrôle des variables vides et des exclusions, réponses classées (positive, absence, opposition).
 * - Moteur : file d'attente, clés d'idempotence, plafonds, horaires, reprises limitées, arrêt d'urgence et suspension globale.
 * Spécifications : docs/crm/
 */
import { Y } from './registry.js';

var U = Y.util;
var C = Y.CRM = {};
function fail(m) { throw new Y.BizError(m); }
function me(S) { return S.meta.currentUser || {}; }
function user(S, id) { return (S.users || []).find(function (u) { return u.id === id; }) || null; }
function role(S) { return me(S).role || 'reader'; }
C.can = function (S, right) { return Y.can(role(S), right); };
/** Accès à l'espace (organisation) puis au droit demandé. */
function guard(S, cid) { if (C._bypass) return; var u = user(S, me(S).id); if (u && u.companies && u.companies.indexOf(cid) < 0) fail('Espace non autorisé : vous n’êtes pas membre de cette organisation.'); }
function need(S, cid, right) { guard(S, cid); if (C._bypass) return; if (!C.can(S, right)) fail('Action réservée : ' + (Y.RIGHTS[right] || right).toLowerCase() + ' (rôle actuel : ' + ((Y.ROLES[role(S)] || {}).label || role(S)) + ').'); }
function who(S) { var u = me(S); return { by: u.name || 'Système', byId: u.id || '', at: C.now(S) }; }
function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9@.+]+/g, ' ').trim(); }
function digits(s) { return String(s || '').replace(/\D/g, ''); }
function phoneKey(s) { var d = digits(s); return d.length > 9 ? d.slice(-9) : d; }
function emailOk(e) { return /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(e || ''); }
C.norm = norm;
/* --------------------------------------------------------------- horloge du moteur */
C.now = function (S) { return (S.meta.crmNow || (S.meta.today + 'T09:30')).slice(0, 16); };
C.setNow = function (S, iso) { S.meta.crmNow = iso.slice(0, 16); };
function addMin(iso, m) { return new Date(new Date(iso.slice(0, 16) + ':00Z').getTime() + m * 60000).toISOString().slice(0, 16); }
function dow(iso) { return new Date(iso.slice(0, 10) + 'T12:00:00Z').getUTCDay(); }
C.addMin = addMin;
function weekKey(iso) { var d = new Date(iso.slice(0, 10) + 'T12:00:00Z'), k = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - k); return d.toISOString().slice(0, 10); }

/* ======================================================================= données */
C.STAGES = [['a_qualifier', 'À qualifier', 5], ['qualifie', 'Qualifié', 10], ['a_preparer', 'Contact à préparer', 15], ['contacte', 'Contacté', 20], ['echange', 'Échange engagé', 30], ['rdv', 'Rendez-vous', 40], ['proposition', 'Proposition commerciale', 60], ['negociation', 'Négociation ou décision', 75], ['gagne', 'Gagné', 100], ['perdu', 'Perdu', 0]];
C.OFFERS = ['myyiel RH & Paie', 'myyiel Comptabilité', 'myyiel Gestion de projets', 'Conseil en organisation', 'Accompagnement au changement', 'Pilotage & tableaux de bord'];
C.D = function (S, cid) {
  var d = Y.D(S, cid);
  if (!d.crm) d.crm = {
    companies: [], contacts: [], opps: [], activities: [], templates: [], campaigns: [], queue: [], replies: [], exclusions: [], lists: [], searches: [], directory: [], discarded: {}, objectives: [], events: [], waLog: [], runLog: [], sentKeys: {}, imports: [],
    seq: { co: 0, ct: 0, opp: 0, act: 0, tpl: 0, cmp: 0, q: 0, ev: 0 },
    integrations: {
      mailbox: { label: 'Boîte professionnelle', provider: 'Google Workspace (bac à sable)', account: 'commercial@yielgroup.com', status: 'actif', limitDay: 400, tokenRef: 'vault://crm/mailbox' },
      gcal: { label: 'Google Calendar', provider: 'Google', account: 'agenda commercial', status: 'actif', tokenRef: 'vault://crm/gcal' },
      whatsapp: { label: 'WhatsApp Business (alertes direction)', provider: 'Meta Cloud API', account: '', status: 'autorisation_requise' },
      sms: { label: 'SMS', provider: '—', status: 'non_disponible' }, linkedin: { label: 'LinkedIn', provider: '—', status: 'non_disponible' },
      web: { label: 'Recherche d’entreprises', provider: 'Annuaire de démonstration', status: 'demo' }, ocr: { label: 'Lecture des cartes de visite', provider: 'Assistant IA de l’application', status: 'actif' }
    },
    settings: {
      stages: C.STAGES.map(function (s) { return { k: s[0], label: s[1], prob: s[2] }; }), lostReasons: ['Prix', 'Concurrent retenu', 'Pas de budget', 'Projet reporté', 'Pas de réponse', 'Besoin non avéré'],
      hours: { from: '08:00', to: '17:30', days: [1, 2, 3, 4, 5] }, caps: { mailboxDay: 150, campaignDay: 60, campaignWeek: 250, recipientWeek: 2 }, retry: { max: 3, delayMin: 30 },
      globalStop: null, delegations: [], inactivityDays: 14, waAlerts: { to: '', events: ['campagne_attente', 'reponse', 'objectif', 'integration', 'arret'] }, currency: 'XAF'
    }
  };
  return d.crm;
};
function nextRef(d, k, p, n) { d.seq[k]++; return p + U.pad(d.seq[k], n || 4); }

/* ======================================================================= accès, rôles, périmètre */
C.SENSITIVE = ['owner', 'crm_admin', 'sales_manager', 'cfo'];
/** Écran 01 : connexion à l'espace (démonstration : mot de passe « demo », code MFA « 123456 »). */
C.authenticate = function (S, cid, cred) {
  var log = S.meta.crmAuth = S.meta.crmAuth || [], u = (S.users || []).find(function (x) { return x.email === String(cred.email || '').toLowerCase(); }), at = C.now(S);
  var deny = function (why) { log.unshift({ at: at, email: cred.email, ok: false, reason: why }); fail('Accès refusé : ' + why + '.'); };
  if (!u || u.disabled) deny('identifiants invalides');
  if (cred.password !== 'demo') deny('identifiants invalides');
  if (u.companies && u.companies.indexOf(cid) < 0) deny('vous n’êtes pas membre de cet espace');
  if (!Y.can(u.role, 'crm.read') && !Y.can(u.role, 'crm.admin')) deny('aucun droit sur le CRM');
  if (C.SENSITIVE.indexOf(u.role) > -1 && cred.mfa !== '123456') deny('code de second facteur requis ou invalide');
  log.unshift({ at: at, email: u.email, ok: true, reason: 'Connexion' + (C.SENSITIVE.indexOf(u.role) > -1 ? ' avec MFA' : '') });
  return { user: u, org: (Y.company(S, cid) || {}).name, role: (Y.ROLES[u.role] || {}).label };
};
/** Le rôle donne les actions ; le périmètre limite les données (propres, équipe, toutes). */
C.scope = function (S) { return C.can(S, 'crm.all') ? 'all' : (C.can(S, 'crm.team') ? 'team' : (C.can(S, 'crm.read') ? 'own' : 'none')); };
C.visible = function (S, rec) {
  if (C._bypass) return true; var sc = C.scope(S), u = user(S, me(S).id) || {};
  if (sc === 'all') return true; if (sc === 'none') return false; if (rec.ownerId === me(S).id) return true;
  return sc === 'team' && !!rec.team && rec.team === u.crmTeam;
};
C.list = function (S, cid, kind) { guard(S, cid); return C.D(S, cid)[kind].filter(function (r) { return !r.deleted && C.visible(S, r); }); };
C.canApprove = function (S, cid) { if (C._bypass) return true; if (C.can(S, 'crm.approve')) return true; return C.D(S, cid).settings.delegations.some(function (x) { return x.userId === me(S).id && (!x.until || x.until >= S.meta.today); }); };
function canEdit(S, rec) { return C._bypass || (C.can(S, 'crm.write') && C.visible(S, rec)); }

/* ======================================================================= provenance */
C.SOURCE = { public: ['Donnée publique', 'info'], utilisateur: ['Fournie par l’utilisateur', ''], verifie: ['Vérifiée par un service externe', 'ok'], import: ['Import de fichier', ''], carte: ['Carte de visite', ''], deduit: ['Déduite · non confirmée', 'warn'] };
function src(type, label, url, at) { return { type: type, label: label || '', url: url || '', collectedAt: at || '', verified: type === 'verifie' }; }

/* ======================================================================= entreprises et contacts */
C.findDuplicates = function (S, cid, c) {
  var d = C.D(S, cid), out = [];
  d.contacts.forEach(function (x) { if (x.deleted || x.id === c.id) return;
    if (c.email && x.email && norm(c.email) === norm(x.email)) out.push({ c: x, why: 'même e-mail' });
    else if (c.phone && x.phone && phoneKey(c.phone) === phoneKey(x.phone)) out.push({ c: x, why: 'même téléphone' });
    else if (c.lastName && x.lastName && norm(c.lastName + ' ' + c.firstName) === norm(x.lastName + ' ' + x.firstName) && (!c.companyId || c.companyId === x.companyId)) out.push({ c: x, why: 'même nom' + (c.companyId ? ' dans la même entreprise' : '') }); });
  return out;
};
C.findCompany = function (S, cid, name, website) { var dom = (website || '').replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase(); return C.D(S, cid).companies.find(function (x) { return !x.deleted && ((dom && x.website && x.website.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase() === dom) || norm(x.name) === norm(name)); }) || null; };
C.saveCompany = function (S, cid, v, opts) {
  opts = opts || {}; need(S, cid, 'crm.write'); var d = C.D(S, cid), ex = v.id ? d.companies.find(function (x) { return x.id === v.id; }) : null;
  if (!v.name) fail('Nom légal obligatoire.'); if (ex && !canEdit(S, ex)) fail('Entreprise hors de votre périmètre.');
  if (!ex) { var dup = C.findCompany(S, cid, v.name, v.website); if (dup && !opts.force) fail('Doublon probable : ' + dup.name + ' existe déjà.'); }
  var rec = ex || { id: U.uid('cco'), ref: nextRef(d, 'co', 'E'), createdAt: C.now(S), history: [], notes: [], status: 'prospect', ownerId: me(S).id, team: (user(S, me(S).id) || {}).crmTeam || '' };
  ['name', 'tradeName', 'country', 'city', 'website', 'sector', 'subSector', 'size', 'orgType', 'priority', 'ownerId', 'team', 'status', 'offers'].forEach(function (k) { if (v[k] !== undefined) rec[k] = v[k]; });
  rec.source = v.source || rec.source || src('utilisateur', 'Saisie ' + me(S).name, '', C.now(S)); rec.verifiedAt = v.verifiedAt || rec.verifiedAt || '';
  if (!ex) d.companies.push(rec); else rec.history.push(Object.assign({ text: 'Fiche modifiée' }, who(S)));
  if (!opts.silent) Y.audit(S, cid, ex ? 'CRM · entreprise modifiée' : 'CRM · entreprise créée', rec.ref, rec.name); return rec;
};
/** Création d'un contact : doublons signalés AVANT création ; provenance et confiance par champ. */
C.saveContact = function (S, cid, v, opts) {
  opts = opts || {}; need(S, cid, 'crm.write'); var d = C.D(S, cid), ex = v.id ? d.contacts.find(function (x) { return x.id === v.id; }) : null;
  if (ex && !canEdit(S, ex)) fail('Contact hors de votre périmètre.');
  if (!v.lastName && !(ex && ex.lastName)) fail('Nom du contact obligatoire.');
  if (v.email && !emailOk(v.email)) fail('E-mail invalide.');
  if (!ex) { var dup = C.findDuplicates(S, cid, v); if (dup.length && !opts.force) fail('Doublon potentiel : ' + dup.map(function (x) { return x.c.firstName + ' ' + x.c.lastName + ' (' + x.why + ')'; }).join(' ; ') + '. Confirmez pour créer quand même.'); }
  var rec = ex || { id: U.uid('cct'), ref: nextRef(d, 'ct', 'P'), createdAt: C.now(S), history: [], prefs: { channel: 'email', lang: 'fr' }, status: 'nouveau', consent: { status: 'non_renseigne', at: '' }, fields: {}, ownerId: me(S).id, team: (user(S, me(S).id) || {}).crmTeam || '' };
  var changes = [];
  ['civility', 'firstName', 'lastName', 'function', 'companyId', 'email', 'phone', 'mobile', 'linkedin', 'country', 'city', 'ownerId', 'team', 'status', 'tags'].forEach(function (k) { if (v[k] !== undefined && v[k] !== rec[k]) { if (ex) changes.push(k + ' : ' + (rec[k] || '—') + ' → ' + (v[k] || '—')); rec[k] = v[k]; } });
  var s = v.source || (ex ? null : src('utilisateur', 'Saisie ' + me(S).name, '', C.now(S)));
  ['email', 'phone', 'function'].forEach(function (k) { if (v[k] !== undefined && (s || !rec.fields[k])) rec.fields[k] = { source: (v.fieldSources && v.fieldSources[k]) || s || rec.fields[k] && rec.fields[k].source, confidence: (v.confidence && v.confidence[k]) != null ? v.confidence[k] : (s && s.type === 'verifie' ? 95 : (s && s.type === 'deduit' ? 40 : 80)) }; });
  if (s) rec.source = s;
  if (!ex) { d.contacts.push(rec); rec.history.push(Object.assign({ text: 'Contact créé · ' + (s ? C.SOURCE[s.type][0] : '') }, who(S))); }
  else if (changes.length) rec.history.push(Object.assign({ text: 'Coordonnées modifiées : ' + changes.join(' ; ') }, who(S)));
  if (!opts.silent) Y.audit(S, cid, ex ? 'CRM · contact modifié' : 'CRM · contact créé', rec.ref, (rec.firstName || '') + ' ' + rec.lastName);
  return rec;
};
C.contactName = function (c) { return c ? ((c.civility ? c.civility + ' ' : '') + (c.firstName ? c.firstName + ' ' : '') + (c.lastName || '')).trim() : '—'; };
C.company = function (S, cid, id) { return C.D(S, cid).companies.find(function (x) { return x.id === id; }) || null; };
C.contact = function (S, cid, id) { return C.D(S, cid).contacts.find(function (x) { return x.id === id; }) || null; };
/** Fiche 360° : historique commercial complet, y compris après changement de coordonnées (tout est lié par l'identifiant). */
C.timeline = function (S, cid, ref) {
  var d = C.D(S, cid), isCo = ref.kind === 'company', ids = isCo ? d.contacts.filter(function (c) { return c.companyId === ref.id; }).map(function (c) { return c.id; }) : [ref.id], out = [];
  d.queue.forEach(function (q) { if (ids.indexOf(q.contactId) > -1 && ['envoye', 'echec'].indexOf(q.status) > -1) out.push({ at: q.sentAt || q.dueAt, type: 'email', text: (q.status === 'envoye' ? 'E-mail envoyé · ' : 'Échec d’envoi · ') + q.subject + ' (' + q.to + ')', ref: q.campaignRef }); });
  d.replies.forEach(function (r) { if (ids.indexOf(r.contactId) > -1) out.push({ at: r.at, type: 'reponse', text: 'Réponse ' + (C.REPLY[r.kind] || [r.kind])[0].toLowerCase() + ' : « ' + r.text.slice(0, 90) + ' »' }); });
  d.activities.forEach(function (a) { if (ids.indexOf(a.contactId) > -1 || (isCo && a.companyId === ref.id)) out.push({ at: a.at, type: a.type, text: C.ACT[a.type][0] + ' · ' + a.title + ' · ' + C.ACT_STATUS[a.status][0] }); });
  d.opps.forEach(function (o) { if ((isCo && o.companyId === ref.id) || o.contactIds.indexOf(ref.id) > -1) o.history.forEach(function (h) { out.push({ at: h.at, type: 'opp', text: o.ref + ' · ' + (h.from ? C.stageLabel(S, cid, h.from) + ' → ' : '') + C.stageLabel(S, cid, h.to) + (h.note ? ' · ' + h.note : '') }); }); });
  if (!isCo) { var c = C.contact(S, cid, ref.id); (c.history || []).forEach(function (h) { out.push({ at: h.at, type: 'fiche', text: h.text }); }); }
  return out.sort(function (a, b) { return (a.at || '') < (b.at || '') ? 1 : -1; });
};
C.nextAction = function (S, cid, f) { return C.D(S, cid).activities.filter(function (a) { return a.status === 'a_faire' && f(a); }).sort(function (a, b) { return a.at < b.at ? -1 : 1; })[0] || null; };

/* --- import Excel / CSV : aucune création partielle incontrôlée --- */
C.IMPORT_FIELDS = [['civility', 'Civilité'], ['firstName', 'Prénom'], ['lastName', 'Nom', true], ['function', 'Fonction'], ['company', 'Entreprise', true], ['email', 'E-mail'], ['phone', 'Téléphone'], ['country', 'Pays'], ['city', 'Ville'], ['sector', 'Secteur'], ['website', 'Site web'], ['source', 'Source']];
var SYN = { lastName: ['nom', 'nom de famille', 'last name', 'name'], firstName: ['prenom', 'first name'], company: ['entreprise', 'societe', 'organisation', 'raison sociale', 'company'], email: ['email', 'e mail', 'mail', 'courriel'], phone: ['telephone', 'tel', 'mobile', 'portable'], function: ['fonction', 'poste', 'titre', 'job title'], country: ['pays'], city: ['ville'], sector: ['secteur', 'activite'], website: ['site', 'site web', 'web'], civility: ['civilite', 'titre de civilite'] };
C.mapColumns = function (header) { var keys = header.map(function (h) { return norm(h); }), map = {}, used = {}; C.IMPORT_FIELDS.forEach(function (f) { var c = [norm(f[0]), norm(f[1])].concat(SYN[f[0]] || []); var i = keys.findIndex(function (k, j) { return !used[j] && c.indexOf(k) > -1; }); map[f[0]] = i; if (i > -1) used[i] = 1; }); return map; };
C.analyzeImport = function (S, cid, rows, map) {
  guard(S, cid); var out = { rows: [], ok: 0, errors: 0, duplicates: 0 }, seen = {};
  rows.slice(1).forEach(function (r, i) {
    if (!r.some(function (x) { return String(x).trim(); })) return;
    var v = {}; Object.keys(map).forEach(function (k) { if (map[k] > -1) v[k] = String(r[map[k]] == null ? '' : r[map[k]]).trim(); });
    var errs = [], warns = [], line = i + 2;
    if (!v.lastName) errs.push('Nom manquant.'); if (!v.company) errs.push('Entreprise manquante.');
    if (v.email && !emailOk(v.email)) errs.push('E-mail invalide.');
    var k1 = v.email ? 'e:' + norm(v.email) : '', k2 = v.phone ? 'p:' + phoneKey(v.phone) : '';
    [k1, k2].forEach(function (k) { if (k && seen[k]) errs.push('Doublon dans le fichier (ligne ' + seen[k] + ').'); });
    if (k1) seen[k1] = seen[k1] || line; if (k2) seen[k2] = seen[k2] || line;
    var co = v.company ? C.findCompany(S, cid, v.company, v.website) : null, dup = v.lastName ? C.findDuplicates(S, cid, { email: v.email, phone: v.phone, lastName: v.lastName, firstName: v.firstName, companyId: co && co.id }) : [];
    if (dup.length) { errs.push('Déjà dans le CRM : ' + C.contactName(dup[0].c) + ' (' + dup[0].why + ').'); out.duplicates++; }
    var ex = v.email && C.isExcluded(S, cid, { email: v.email }); if (ex) errs.push('Adresse en opposition : ne pas réimporter.');
    if (!v.email) warns.push('Sans e-mail : non utilisable en campagne e-mail.');
    if (!co) warns.push('Entreprise « ' + v.company + ' » créée à l’import.');
    if (errs.length) out.errors++; else out.ok++;
    out.rows.push({ line: line, v: v, errors: errs, warnings: warns, companyId: co ? co.id : '' });
  });
  return out;
};
C.importContacts = function (S, cid, an, opts) {
  opts = opts || {}; need(S, cid, 'crm.write');
  if (an.errors && !opts.skipErrors) fail(an.errors + ' ligne(s) en erreur : corrigez le fichier ou confirmez l’import des seules lignes valides. Rien n’a été créé.');
  var d = C.D(S, cid), snap = JSON.stringify({ c: d.contacts.length, o: d.companies.length }), made = [], cos = [];
  try {
    an.rows.forEach(function (r) {
      if (r.errors.length) return; var v = r.v, co = r.companyId ? C.company(S, cid, r.companyId) : C.findCompany(S, cid, v.company, v.website);
      if (!co) { co = C.saveCompany(S, cid, { name: v.company, country: v.country || 'Cameroun', city: v.city, sector: v.sector, website: v.website, source: src('import', opts.file || 'fichier', '', C.now(S)) }, { silent: true }); cos.push(co); }
      made.push(C.saveContact(S, cid, { civility: v.civility, firstName: v.firstName, lastName: v.lastName, function: v.function, companyId: co.id, email: v.email, phone: v.phone, country: v.country || co.country, city: v.city || co.city, source: src('import', (opts.file || 'fichier') + (v.source ? ' · ' + v.source : ''), '', C.now(S)) }, { silent: true }));
    });
  } catch (e) { d.contacts = d.contacts.filter(function (x) { return made.indexOf(x) < 0; }); d.companies = d.companies.filter(function (x) { return cos.indexOf(x) < 0; }); void snap; throw e; }
  var rep = { id: U.uid('imp'), file: opts.file || 'fichier', at: C.now(S), by: me(S).name, created: made.length, companies: cos.length, ignored: an.rows.length - made.length, errors: an.rows.filter(function (r) { return r.errors.length; }).map(function (r) { return { line: r.line, errors: r.errors }; }) };
  d.imports.unshift(rep); Y.audit(S, cid, 'CRM · import', rep.file, made.length + ' contact(s), ' + cos.length + ' entreprise(s), ' + rep.ignored + ' ignorée(s)'); return rep;
};
/** Carte de visite : champs extraits proposés, champs incertains signalés (jamais complétés au hasard). */
C.cardDraft = function (S, cid, ex) {
  guard(S, cid); var conf = ex.confidence || {}, out = { fields: {}, uncertain: [], missing: [] };
  ['civility', 'firstName', 'lastName', 'function', 'company', 'email', 'phone', 'website', 'city', 'country'].forEach(function (k) { var v = (ex[k] || '').trim(), c = conf[k] == null ? (v ? 75 : 0) : conf[k]; out.fields[k] = { value: v, confidence: c }; if (!v) out.missing.push(k); else if (c < 70) out.uncertain.push(k); });
  if (out.fields.email.value && !emailOk(out.fields.email.value)) out.uncertain.push('email');
  var dup = C.findDuplicates(S, cid, { email: out.fields.email.value, phone: out.fields.phone.value, lastName: out.fields.lastName.value, firstName: out.fields.firstName.value });
  out.duplicates = dup.map(function (x) { return C.contactName(x.c) + ' (' + x.why + ')'; }); return out;
};
C.createFromCard = function (S, cid, v, opts) {
  opts = opts || {}; if (!opts.confirmed) fail('Validez les champs extraits avant la création.');
  var co = C.findCompany(S, cid, v.company, v.website) || (v.company ? C.saveCompany(S, cid, { name: v.company, website: v.website, city: v.city, country: v.country || 'Cameroun', source: src('carte', 'Carte de visite', '', C.now(S)) }, { silent: true }) : null);
  return C.saveContact(S, cid, { civility: v.civility, firstName: v.firstName, lastName: v.lastName, function: v.function, companyId: co ? co.id : '', email: v.email, phone: v.phone, city: v.city, country: v.country, source: src('carte', 'Carte de visite · ' + (v.event || 'rencontre'), '', C.now(S)), confidence: v.confidence }, { force: opts.force });
};
/* --- données personnelles --- */
C.export = function (S, cid) {
  need(S, cid, 'crm.export'); var rows = [['Réf.', 'Civilité', 'Prénom', 'Nom', 'Fonction', 'Entreprise', 'E-mail', 'Téléphone', 'Pays', 'Statut', 'Source', 'Propriétaire']];
  var list = C.list(S, cid, 'contacts'); list.forEach(function (c) { var co = C.company(S, cid, c.companyId) || {}; rows.push([c.ref, c.civility || '', c.firstName || '', c.lastName, c.function || '', co.name || '', c.email || '', c.phone || '', c.country || '', c.status, c.source ? C.SOURCE[c.source.type][0] : '', (user(S, c.ownerId) || {}).name || '']); });
  Y.audit(S, cid, 'CRM · export', 'contacts', list.length + ' contact(s) · périmètre ' + C.scope(S)); return rows;
};
C.personalRequest = function (S, cid, contactId, type, note) {
  need(S, cid, 'crm.personal'); var c = C.contact(S, cid, contactId); if (!c) fail('Contact introuvable.');
  if (type === 'suppression') { if (c.email) C.exclude(S, cid, { contactId: c.id, email: c.email, channel: 'tous', reason: 'Demande de suppression', source: 'Demande de la personne' }, true); c.history.push(Object.assign({ text: 'Données supprimées à la demande de la personne (anonymisation)' }, who(S))); Object.assign(c, { firstName: '', lastName: 'Contact supprimé', email: '', phone: '', mobile: '', linkedin: '', deleted: true, fields: {} }); }
  else if (type === 'opposition') C.exclude(S, cid, { contactId: c.id, email: c.email, channel: 'tous', reason: note || 'Opposition', source: 'Demande de la personne' });
  Y.audit(S, cid, 'CRM · données personnelles', c.ref, type + (note ? ' · ' + note : '')); return c;
};

/* ======================================================================= exclusions et consentement */
C.exclude = function (S, cid, x, silent) {
  var d = C.D(S, cid), key = (x.email ? norm(x.email) : '') + '|' + (x.channel || 'tous');
  if (d.exclusions.some(function (e) { return e.key === key && e.active; })) return null;
  var rec = Object.assign({ id: U.uid('exc'), key: key, emailHash: x.email ? U.fnv(norm(x.email)) : '', contactId: x.contactId || '', email: x.email || '', channel: x.channel || 'tous', purpose: x.purpose || 'prospection', reason: x.reason || '', source: x.source || '', active: true }, who(S));
  d.exclusions.unshift(rec);
  if (x.contactId) { var c = C.contact(S, cid, x.contactId); if (c) { c.consent = { status: 'opposition', at: rec.at, source: rec.source }; c.status = 'exclu'; c.history.push(Object.assign({ text: 'Opposition enregistrée (' + rec.channel + ') : ' + rec.reason }, who(S))); } }
  // arrêt immédiat de toutes les actions planifiées pour ce contact, indépendamment des campagnes
  d.queue.forEach(function (q) { if ((q.contactId === x.contactId || (x.email && norm(q.to) === norm(x.email))) && ['planifie', 'reessai', 'reporte', 'attente_canal'].indexOf(q.status) > -1) { q.status = 'annule'; q.reason = 'Opposition du destinataire'; } });
  if (!silent) Y.audit(S, cid, 'CRM · exclusion', x.email || x.contactId, rec.reason);
  return rec;
};
C.isExcluded = function (S, cid, c, channel) { var d = C.D(S, cid), e = c.email ? norm(c.email) : ''; return d.exclusions.find(function (x) { return x.active && (x.channel === 'tous' || x.channel === (channel || 'email')) && ((c.id && x.contactId === c.id) || (e && (norm(x.email) === e || x.emailHash === U.fnv(e)))); }) || null; };

/* ======================================================================= recherche d'entreprises */
C.FIT = { 'myyiel RH & Paie': { sizes: ['20-49', '50-249', '250+'], sectors: ['Santé', 'Éducation', 'Industrie', 'Distribution', 'Services', 'BTP', 'Transport & logistique', 'Hôtellerie'] }, 'myyiel Comptabilité': { sizes: ['1-9', '10-19', '20-49', '50-249'], sectors: [] }, 'myyiel Gestion de projets': { sizes: ['20-49', '50-249', '250+'], sectors: ['BTP', 'Services', 'ONG', 'Télécoms'] }, 'Conseil en organisation': { sizes: ['50-249', '250+'], sectors: [] }, 'Accompagnement au changement': { sizes: ['50-249', '250+'], sectors: ['Administration', 'Banque', 'Industrie', 'Télécoms'] }, 'Pilotage & tableaux de bord': { sizes: ['20-49', '50-249', '250+'], sectors: [] } };
C.search = function (S, cid, q) {
  need(S, cid, 'crm.read'); var d = C.D(S, cid), t = norm(q.text || '');
  return d.directory.filter(function (e) {
    if (d.discarded[e.id] && !q.showDiscarded) return false;
    if (q.country && e.country !== q.country) return false; if (q.city && norm(e.city) !== norm(q.city)) return false; if (q.sector && e.sector !== q.sector) return false;
    if (q.size && e.size !== q.size) return false; if (q.orgType && e.orgType !== q.orgType) return false;
    if (q.role && !e.contacts.some(function (c) { return norm(c.role).indexOf(norm(q.role)) > -1; })) return false;
    if (q.reliability === 'verifie' && !e.contacts.some(function (c) { return c.emailStatus === 'verifie'; })) return false;
    if (q.reliability === 'email' && !e.contacts.some(function (c) { return c.email; })) return false;
    if (t && norm(e.name + ' ' + e.activity + ' ' + e.subSector).indexOf(t) < 0) return false; return true;
  }).map(function (e) { var f = C.fit(e, q.offer); return Object.assign({ fit: f, imported: !!C.findCompany(S, cid, e.name, e.website), discarded: d.discarded[e.id] || null }, e); }).sort(function (a, b) { return b.fit.score - a.fit.score; });
};
C.fit = function (e, offer) { var r = [], s = 40, F = C.FIT[offer]; if (F) { if (F.sizes.indexOf(e.size) > -1) { s += 25; r.push('Taille adaptée (' + e.size + ' salariés)'); } else r.push('Taille moins adaptée à l’offre'); if (!F.sectors.length || F.sectors.indexOf(e.sector) > -1) { s += 15; r.push('Secteur cible'); } }
  if (e.contacts.some(function (c) { return /DRH|ressources humaines|RH/i.test(c.role); }) && /RH/.test(offer || '')) { s += 10; r.push('Décideur RH identifié'); }
  if (e.contacts.some(function (c) { return /DAF|financ|comptab/i.test(c.role); }) && /Compta|Pilotage/.test(offer || '')) { s += 10; r.push('Décideur finance identifié'); }
  if (e.contacts.some(function (c) { return c.emailStatus === 'verifie'; })) { s += 10; r.push('Coordonnée vérifiée'); } else r.push('Aucune coordonnée vérifiée');
  return { score: Math.min(100, s), reasons: r, level: s >= 75 ? 'forte' : (s >= 55 ? 'moyenne' : 'faible') }; };
C.saveSearch = function (S, cid, name, q) { need(S, cid, 'crm.read'); var d = C.D(S, cid); var r = Object.assign({ id: U.uid('srch'), name: name, q: q }, who(S)); d.searches.unshift(r); return r; };
C.discard = function (S, cid, id, reason) { need(S, cid, 'crm.write'); if (!reason) fail('Motif obligatoire pour écarter une cible.'); C.D(S, cid).discarded[id] = Object.assign({ reason: reason }, who(S)); };
/** Import de résultats : provenance, date de collecte et statut de vérification conservés ; une adresse déduite reste « déduite ». */
C.importResults = function (S, cid, ids, listName) {
  need(S, cid, 'crm.write'); var d = C.D(S, cid), list = listName ? (d.lists.find(function (l) { return l.name === listName; }) || (d.lists.push({ id: U.uid('lst'), name: listName, contactIds: [], createdAt: C.now(S), by: me(S).name }), d.lists[d.lists.length - 1])) : null, made = { companies: 0, contacts: 0, skipped: 0 };
  ids.forEach(function (id) {
    var e = d.directory.find(function (x) { return x.id === id; }); if (!e) return;
    var co = C.findCompany(S, cid, e.name, e.website);
    if (!co) { co = C.saveCompany(S, cid, { name: e.name, tradeName: e.tradeName, country: e.country, city: e.city, website: e.website, sector: e.sector, subSector: e.subSector, size: e.size, orgType: e.orgType, source: src(e.source.type, e.source.label, e.source.url, e.source.collectedAt), verifiedAt: e.source.type === 'verifie' ? e.source.collectedAt : '' }, { silent: true }); made.companies++; } else made.skipped++;
    e.contacts.forEach(function (x) {
      if (!x.name) return; var parts = x.name.split(' '), ln = parts.pop(), fn = parts.join(' ');
      var dup = C.findDuplicates(S, cid, { email: x.email, lastName: ln, firstName: fn, companyId: co.id }); if (dup.length) { if (list && list.contactIds.indexOf(dup[0].c.id) < 0) list.contactIds.push(dup[0].c.id); return; }
      var fsrc = x.emailStatus === 'verifie' ? src('verifie', x.verifiedBy || 'Service de vérification', '', e.source.collectedAt) : (x.emailStatus === 'deduit' ? src('deduit', 'Format d’adresse déduit · non confirmé', '', e.source.collectedAt) : src(e.source.type, e.source.label, e.source.url, e.source.collectedAt));
      var c = C.saveContact(S, cid, { civility: x.civility, firstName: fn, lastName: ln, function: x.role, companyId: co.id, email: x.email || '', phone: x.phone || '', country: e.country, city: e.city, source: src(e.source.type, e.source.label, e.source.url, e.source.collectedAt), fieldSources: { email: fsrc }, confidence: { email: x.emailStatus === 'verifie' ? 95 : (x.emailStatus === 'deduit' ? 35 : 60) } }, { silent: true, force: true });
      if (x.emailStatus === 'deduit') c.emailUnconfirmed = true;
      made.contacts++; if (list) list.contactIds.push(c.id);
    });
  });
  Y.audit(S, cid, 'CRM · import de recherche', listName || '—', made.companies + ' entreprise(s), ' + made.contacts + ' contact(s)'); return made;
};

/* ======================================================================= pipeline */
C.stageLabel = function (S, cid, k) { var s = C.D(S, cid).settings.stages.find(function (x) { return x.k === k; }); return s ? s.label : k; };
C.saveOpp = function (S, cid, v) {
  need(S, cid, 'crm.write'); var d = C.D(S, cid), ex = v.id ? d.opps.find(function (x) { return x.id === v.id; }) : null;
  if (ex && !canEdit(S, ex)) fail('Opportunité hors de votre périmètre.');
  var co = C.company(S, cid, v.companyId || (ex && ex.companyId)); if (!co) fail('Entreprise obligatoire.');
  if (!(v.offer || (ex && ex.offer))) fail('Offre obligatoire.');
  var stage = v.stage || (ex ? ex.stage : 'a_qualifier'), st = d.settings.stages.find(function (s) { return s.k === stage; });
  var rec = ex || { id: U.uid('opp'), ref: nextRef(d, 'opp', 'OPP-'), history: [], createdAt: C.now(S), ownerId: me(S).id, team: (user(S, me(S).id) || {}).crmTeam || '', currency: d.settings.currency, contactIds: [] };
  ['name', 'offer', 'amount', 'currency', 'closeDate', 'probability', 'ownerId', 'team', 'contactIds', 'campaignId', 'country'].forEach(function (k) { if (v[k] !== undefined) rec[k] = k === 'amount' ? U.round(+v[k] || 0) : v[k]; });
  rec.companyId = co.id; rec.country = rec.country || co.country; if (rec.probability == null || v.stage) rec.probability = v.probability != null ? +v.probability : st.prob;
  if (!ex) { rec.stage = stage; rec.history.push(Object.assign({ from: '', to: stage, note: 'Création' }, who(S))); d.opps.push(rec); Y.audit(S, cid, 'CRM · opportunité créée', rec.ref, co.name + ' · ' + rec.offer + ' · ' + U.fmt(rec.amount || 0)); }
  else if (v.stage && v.stage !== ex.stage) C.moveStage(S, cid, rec.id, v.stage, v);
  return rec;
};
/** Changement d'étape historisé ; « Gagné » et « Perdu » exigent les informations définies par la direction. */
C.moveStage = function (S, cid, id, stage, info) {
  need(S, cid, 'crm.write'); info = info || {}; var d = C.D(S, cid), o = d.opps.find(function (x) { return x.id === id; }); if (!o) fail('Opportunité introuvable.'); if (!canEdit(S, o)) fail('Opportunité hors de votre périmètre.');
  var st = d.settings.stages.find(function (s) { return s.k === stage; }); if (!st) fail('Étape inconnue.'); if (o.stage === stage) return o;
  if (stage === 'gagne') { var amt = info.amount != null ? U.round(+info.amount) : o.amount; if (!(amt > 0)) fail('Montant signé obligatoire pour passer en « Gagné ».'); if (!(info.signedAt || o.closeDate)) fail('Date de signature obligatoire.'); o.amount = amt; o.signedAt = info.signedAt || S.meta.today; o.wonAt = C.now(S); }
  if (stage === 'perdu') { if (!info.lostReason) fail('Motif de perte obligatoire.'); if (d.settings.lostReasons.indexOf(info.lostReason) < 0) fail('Motif de perte non prévu par la direction.'); o.lostReason = info.lostReason; o.lostNote = info.note || ''; }
  o.history.push(Object.assign({ from: o.stage, to: stage, note: info.note || (stage === 'perdu' ? info.lostReason : '') }, who(S)));
  o.stage = stage; o.probability = st.prob; Y.audit(S, cid, 'CRM · étape', o.ref, C.stageLabel(S, cid, o.history[o.history.length - 1].from) + ' → ' + st.label);
  if (stage === 'gagne') { var co = C.company(S, cid, o.companyId); co.status = 'client'; }
  return o;
};
/** Saisie unique : un prospect gagné devient client comptable (tiers) sans ressaisie. */
C.convertToClient = function (S, cid, companyId) {
  need(S, cid, 'crm.write'); var co = C.company(S, cid, companyId); if (co.tiersId) return Y.tiers(S, cid, co.tiersId);
  var main = C.D(S, cid).contacts.find(function (c) { return c.companyId === co.id && !c.deleted; }) || {};
  var t = Y.createTiers(S, cid, { type: 'client', name: co.name, city: co.city || '', email: main.email || '', phone: main.phone || '', country: co.country || 'Cameroun' });
  co.tiersId = t.id; Y.audit(S, cid, 'CRM · client créé en comptabilité', t.code, co.name); return t;
};

/* ======================================================================= activités et agenda */
C.ACT = { appel: ['Appel', 'call'], email: ['E-mail', 'mail'], tache: ['Tâche', 'check'], rdv: ['Rendez-vous', 'cal'], note: ['Note', 'file'] };
C.ACT_STATUS = { a_faire: ['À faire', 'warn'], fait: ['Fait', 'ok'], reporte: ['Reporté', 'info'], annule: ['Annulé', ''] };
C.saveActivity = function (S, cid, v) {
  need(S, cid, 'crm.write'); var d = C.D(S, cid); if (!C.ACT[v.type]) fail('Type d’activité inconnu.'); if (!v.title) fail('Intitulé obligatoire.'); if (!v.at) fail('Date obligatoire.');
  if (!v.companyId && !v.contactId && !v.oppId) fail('Rattachez l’activité à une entreprise, un contact ou une opportunité.');
  var c = v.contactId ? C.contact(S, cid, v.contactId) : null, o = v.oppId ? d.opps.find(function (x) { return x.id === v.oppId; }) : null;
  var a = { id: U.uid('act'), ref: nextRef(d, 'act', 'A-', 5), type: v.type, title: v.title, at: v.at.slice(0, 16), duration: +v.duration || (v.type === 'rdv' ? 60 : 0), place: v.place || '', companyId: v.companyId || (c && c.companyId) || (o && o.companyId) || '', contactId: v.contactId || '', oppId: v.oppId || '', ownerId: v.ownerId || me(S).id, team: (user(S, v.ownerId || me(S).id) || {}).crmTeam || '', status: 'a_faire', reminder: v.reminder != null ? +v.reminder : (v.type === 'rdv' ? 60 : 0), history: [Object.assign({ text: 'Créée' }, who(S))], origin: v.origin || '' };
  if (a.type === 'rdv') { var g = d.integrations.gcal; a.gcal = g.status === 'actif' ? { sync: 'ok', at: C.now(S), eventId: 'gcal_' + a.ref } : { sync: 'indisponible', reason: 'Google Calendar ' + C.INTEG_STATUS[g.status][0].toLowerCase() }; if (g.status !== 'actif') C.pushEvent(S, cid, 'integration', 'gcal_' + g.status, 'Google Calendar indisponible : rendez-vous ' + a.ref + ' non synchronisé', 'haute', { page: 'crm-admin', tab: 'integrations' }); }
  d.activities.push(a);
  if (a.type === 'rdv' && o && ['a_qualifier', 'qualifie', 'a_preparer', 'contacte', 'echange'].indexOf(o.stage) > -1) C.moveStage(S, cid, o.id, 'rdv', { note: 'Rendez-vous ' + a.ref + ' planifié' });
  return a;
};
/** Terminer ou reporter : la prochaine action est recalculée, l'historique est conservé. */
C.completeActivity = function (S, cid, id, v) {
  need(S, cid, 'crm.write'); v = v || {}; var a = C.D(S, cid).activities.find(function (x) { return x.id === id; }); if (!a) fail('Activité introuvable.'); if (!canEdit(S, a)) fail('Activité hors de votre périmètre.');
  if (v.postpone) { if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v.postpone)) fail('Nouvelle date obligatoire.'); a.history.push(Object.assign({ text: 'Reportée du ' + a.at.replace('T', ' ') + ' au ' + v.postpone.replace('T', ' ') + (v.note ? ' · ' + v.note : '') }, who(S))); a.at = v.postpone.slice(0, 16); a.status = 'a_faire'; a.postponed = (a.postponed || 0) + 1; if (a.gcal && a.gcal.sync === 'ok') a.gcal.at = C.now(S); }
  else { a.status = v.cancel ? 'annule' : 'fait'; a.result = v.note || ''; a.history.push(Object.assign({ text: (v.cancel ? 'Annulée' : 'Terminée') + (v.note ? ' · ' + v.note : '') }, who(S))); if (v.next) C.saveActivity(S, cid, Object.assign({ companyId: a.companyId, contactId: a.contactId, oppId: a.oppId, origin: a.ref }, v.next)); }
  return a;
};
C.dueReminders = function (S, cid) { var now = C.now(S); return C.list(S, cid, 'activities').filter(function (a) { return a.status === 'a_faire' && a.reminder && a.at > now && addMin(a.at, -a.reminder) <= now; }); };

/* ======================================================================= modèles et messages */
C.VARS = { 'contact.civilite': function (c) { return c.civility; }, 'contact.prenom': function (c) { return c.firstName; }, 'contact.nom': function (c) { return c.lastName; }, 'contact.fonction': function (c) { return c.function; }, 'entreprise.nom': function (c, co) { return co && (co.tradeName || co.name); }, 'entreprise.ville': function (c, co) { return co && co.city; }, 'entreprise.secteur': function (c, co) { return co && co.sector; }, 'expediteur.nom': function (c, co, s) { return s.name; }, 'expediteur.fonction': function (c, co, s) { return s.fn; } };
C.saveTemplate = function (S, cid, v) {
  need(S, cid, 'crm.campaign'); var d = C.D(S, cid), ex = v.id ? d.templates.find(function (x) { return x.id === v.id; }) : null;
  if (!v.name || !v.subject || !v.body) fail('Nom, objet et contenu obligatoires.');
  var used = (v.subject + ' ' + v.body).match(/\{\{\s*[a-z.]+\s*\}\}/gi) || [], unknown = used.map(function (x) { return x.replace(/[{}\s]/g, ''); }).filter(function (k) { return !C.VARS[k]; }); if (unknown.length) fail('Variable inconnue : ' + unknown.join(', ') + '.');
  var rec = ex || { id: U.uid('tpl'), ref: nextRef(d, 'tpl', 'M-', 3), version: 0, versions: [], createdAt: C.now(S) };
  var changed = !ex || ex.subject !== v.subject || ex.body !== v.body;
  ['name', 'offer', 'segment', 'stage', 'persona', 'tone', 'channel', 'required', 'signature'].forEach(function (k) { if (v[k] !== undefined) rec[k] = v[k]; });
  if (changed) { rec.version++; rec.subject = v.subject; rec.body = v.body; rec.versions.push(Object.assign({ v: rec.version, subject: v.subject, body: v.body }, who(S))); }
  rec.required = rec.required || ['contact.nom', 'entreprise.nom'];
  if (!ex) d.templates.push(rec);
  else if (changed) d.campaigns.forEach(function (cp) { if (cp.approval && cp.steps.some(function (s) { return s.templateId === rec.id; }) && ['autorisee', 'programmee', 'en_cours', 'suspendue'].indexOf(cp.status) > -1) requireReapproval(S, cid, cp, 'Modèle ' + rec.ref + ' modifié (v' + rec.version + ')'); });
  Y.audit(S, cid, 'CRM · modèle', rec.ref, rec.name + ' v' + rec.version); return rec;
};
C.template = function (S, cid, id) { return C.D(S, cid).templates.find(function (x) { return x.id === id; }) || null; };
function sender(S, cid, c) { var u = user(S, c && c.ownerId) || user(S, me(S).id) || {}; return { name: (u.name || '').replace(/^[^·]*·\s*/, ''), fn: u.crmTitle || (Y.ROLES[u.role] || {}).label || '' }; }
/** Rendu : variables remplacées ; les obligatoires vides sont signalées, jamais inventées. */
C.render = function (S, cid, tpl, c, version) {
  var co = c ? C.company(S, cid, c.companyId) : null, s = sender(S, cid, c), missing = [], ver = version ? tpl.versions.find(function (x) { return x.v === version; }) : tpl;
  var rep = function (txt) { return String(txt || '').replace(/\{\{\s*([a-z.]+)\s*\}\}/gi, function (m, k) { var v = C.VARS[k] ? C.VARS[k](c || {}, co, s) : ''; if (!v) { if ((tpl.required || []).indexOf(k) > -1 && missing.indexOf(k) < 0) missing.push(k); return ''; } return v; }).replace(/ +([,.])/g, '$1').replace(/  +/g, ' '); };
  return { subject: rep(ver.subject), body: rep(ver.body) + (tpl.signature ? '\n\n' + rep(tpl.signature) : ''), missing: missing };
};
/** Reformulation locale (sans IA) : utilisée quand l'assistant n'est pas disponible. */
C.rewrite = function (text, o) {
  o = o || {}; var t = String(text || '');
  if (o.tone === 'formel') t = t.replace(/^Bonjour\b/m, 'Madame, Monsieur,').replace(/\bMerci\b/g, 'Je vous remercie').replace(/\bBien à vous\b/g, 'Je vous prie d’agréer mes salutations distinguées');
  if (o.tone === 'cordial') t = t.replace(/^Madame, Monsieur,/m, 'Bonjour,').replace(/Je vous prie d’agréer[^.]*\./g, 'Belle journée,');
  if (o.length === 'court') t = t.split(/\n\n/).filter(function (p, i, a) { return i === 0 || i === a.length - 1 || i === 1; }).join('\n\n');
  if (o.emoji) t = t.replace(/^(Bonjour[^\n]*)/m, '$1 👋').replace(/\n\n([^\n]*)$/, '\n\n$1 🙂');
  return t;
};
/** Message individuel : bloqué si variable obligatoire vide ou destinataire exclu. */
C.sendMessage = function (S, cid, v) {
  need(S, cid, 'crm.write'); var d = C.D(S, cid), c = C.contact(S, cid, v.contactId); if (!c || c.deleted) fail('Destinataire introuvable.'); if (!C.visible(S, c)) fail('Contact hors de votre périmètre.');
  var ex = C.isExcluded(S, cid, c); if (ex) fail('Destinataire exclu (' + ex.reason + ') : aucun envoi possible.');
  if (!emailOk(c.email) || c.emailInvalid) fail('Adresse e-mail absente ou invalide.');
  if (d.integrations.mailbox.status !== 'actif') fail('Boîte d’envoi non connectée.');
  if (S.meta.crmGlobalStop || d.settings.globalStop) fail('Envois sortants suspendus par la direction.');
  var subject = v.subject, body = v.body;
  if (v.templateId) { var r = C.render(S, cid, C.template(S, cid, v.templateId), c); if (r.missing.length) fail('Variables obligatoires vides : ' + r.missing.join(', ') + '.'); subject = subject || r.subject; body = body || r.body; }
  if (/\{\{/.test(subject + body)) fail('Variables non remplacées dans le message.');
  if (!subject || !body) fail('Objet et message obligatoires.');
  var q = { id: U.uid('q'), key: 'manuel|' + c.id + '|' + U.fnv(subject + body + C.now(S)), campaignId: '', campaignRef: 'Message individuel', contactId: c.id, to: c.email, subject: subject, body: body, attachments: v.attachments || [], dueAt: v.at || C.now(S), status: 'planifie', attempts: 0, manual: true, by: me(S).name, ownerId: c.ownerId };
  d.queue.push(q); if (!v.at || v.at <= C.now(S)) process(S, cid, q, C.now(S));
  return q;
};

/* ======================================================================= campagnes */
C.CAMP_STATUS = { brouillon: ['Brouillon', ''], prevalidation: ['Prévalidation', 'info'], attente_pdg: ['En attente de validation PDG', 'warn'], autorisee: ['Autorisée', 'ok'], programmee: ['Programmée', 'info'], en_cours: ['En cours', 'ok'], suspendue: ['Suspendue', 'bad'], terminee: ['Terminée', ''], annulee: ['Annulée', ''] };
C.Q_STATUS = { planifie: ['Planifié', 'info'], envoye: ['Envoyé', 'ok'], bloque: ['Bloqué', 'bad'], echec: ['Échec définitif', 'bad'], reessai: ['Nouvelle tentative', 'warn'], reporte: ['Reporté (plafond / horaire)', 'warn'], annule: ['Annulé', ''], attente_canal: ['En attente du canal', 'warn'] };
C.saveCampaign = function (S, cid, v) {
  need(S, cid, 'crm.campaign'); var d = C.D(S, cid), ex = v.id ? d.campaigns.find(function (x) { return x.id === v.id; }) : null;
  if (!v.name && !ex) fail('Nom de la campagne obligatoire.');
  var rec = ex || { id: U.uid('cmp'), ref: nextRef(d, 'cmp', 'CMP-', 3), status: 'brouillon', version: 1, createdAt: C.now(S), createdBy: me(S).name, createdById: me(S).id, history: [], steps: [], segment: { listIds: [], criteria: {} }, schedule: {}, caps: {}, stop: { onReply: true, onBounceRate: 10, onOptOutRate: 3 }, channel: 'email', extraIds: [], removedIds: [] };
  ['name', 'objective', 'offer', 'channel', 'segment', 'steps', 'schedule', 'caps', 'stop', 'extraIds', 'removedIds', 'team'].forEach(function (k) { if (v[k] !== undefined) rec[k] = U.clone(v[k]); });
  if (!ex) { d.campaigns.push(rec); rec.history.push(Object.assign({ text: 'Brouillon créé' }, who(S))); }
  else if (rec.approval) { var fp = fingerprint(S, cid, rec); if (fp !== rec.approval.fp) requireReapproval(S, cid, rec, describeDrift(S, cid, rec)); }
  else if (['prevalidation', 'attente_pdg'].indexOf(rec.status) > -1) { rec.status = 'brouillon'; rec.history.push(Object.assign({ text: 'Modifiée : retour en brouillon' }, who(S))); }
  Y.audit(S, cid, 'CRM · campagne', rec.ref, (ex ? 'modifiée' : 'créée') + ' v' + rec.version); return rec;
};
C.campaign = function (S, cid, id) { return C.D(S, cid).campaigns.find(function (x) { return x.id === id || x.ref === id; }) || null; };
/** Destinataires du segment (listes + critères + ajouts − retraits), exclusions comprises. */
C.resolveSegment = function (S, cid, cp) {
  var d = C.D(S, cid), q = cp.segment.criteria || {}, ids = {};
  (cp.segment.listIds || []).forEach(function (l) { var L = d.lists.find(function (x) { return x.id === l; }); (L ? L.contactIds : []).forEach(function (i) { ids[i] = 1; }); });
  if (Object.keys(q).some(function (k) { return q[k]; })) d.contacts.forEach(function (c) { if (c.deleted) return; var co = C.company(S, cid, c.companyId) || {}; if (q.country && co.country !== q.country) return; if (q.sector && co.sector !== q.sector) return; if (q.size && co.size !== q.size) return; if (q.role && norm(c.function).indexOf(norm(q.role)) < 0) return; if (q.status && c.status !== q.status) return; ids[c.id] = 1; });
  (cp.extraIds || []).forEach(function (i) { ids[i] = 1; }); (cp.removedIds || []).forEach(function (i) { delete ids[i]; });
  var inc = [], exc = [];
  Object.keys(ids).forEach(function (id) { var c = C.contact(S, cid, id); if (!c || c.deleted) return; var why = C.isExcluded(S, cid, c, cp.channel) ? 'Opposition / exclusion' : (!c.email ? 'Pas d’e-mail' : (c.emailInvalid ? 'Adresse invalide' : (c.emailUnconfirmed ? 'Adresse déduite, non confirmée' : ''))); if (!why) { var m = [].concat.apply([], cp.steps.map(function (s) { var t = C.template(S, cid, s.templateId); return t ? C.render(S, cid, t, c).missing : []; })); if (m.length) why = 'Variable obligatoire vide (' + m.filter(function (x, i, a) { return a.indexOf(x) === i; }).join(', ') + ')'; } if (why) exc.push({ c: c, reason: why }); else inc.push(c); });
  return { included: inc, excluded: exc };
};
function effCaps(S, cid, cp) { var g = C.D(S, cid).settings.caps, c = cp.caps || {}; return { day: Math.min(c.day || g.campaignDay, g.campaignDay), week: Math.min(c.week || g.campaignWeek, g.campaignWeek), recipientWeek: Math.min(c.recipientWeek || g.recipientWeek, g.recipientWeek), mailboxDay: Math.min(g.mailboxDay, C.D(S, cid).integrations.mailbox.limitDay || 1e9) }; }
function fingerprint(S, cid, cp) {
  var seg = C.resolveSegment(S, cid, cp);
  return U.fnv(JSON.stringify({ seg: cp.segment, rec: seg.included.map(function (c) { return c.id; }).sort(), steps: cp.steps.map(function (s) { var t = C.template(S, cid, s.templateId); return [s.templateId, t ? t.version : 0, s.delayDays]; }), schedule: cp.schedule, caps: cp.caps, stop: cp.stop, channel: cp.channel }));
}
function describeDrift(S, cid, cp) {
  var a = cp.approval, seg = C.resolveSegment(S, cid, cp), now = seg.included.map(function (c) { return c.id; }), add = now.filter(function (i) { return a.recipients.indexOf(i) < 0; }), rem = a.recipients.filter(function (i) { return now.indexOf(i) < 0; }), out = [];
  if (add.length) out.push(add.length + ' destinataire(s) hors du périmètre autorisé');
  if (rem.length) out.push(rem.length + ' destinataire(s) retiré(s)');
  cp.steps.forEach(function (s, i) { var t = C.template(S, cid, s.templateId), ap = a.steps[i]; if (!ap || ap.templateId !== s.templateId || ap.version !== (t && t.version)) out.push('modèle de l’étape ' + (i + 1) + ' modifié'); else if (ap.delayDays !== s.delayDays) out.push('délai de l’étape ' + (i + 1) + ' modifié'); });
  if (cp.steps.length !== a.steps.length) out.push('nombre d’étapes modifié');
  if (JSON.stringify(cp.schedule) !== JSON.stringify(a.schedule)) out.push('calendrier modifié'); if (JSON.stringify(cp.caps) !== JSON.stringify(a.caps)) out.push('plafonds modifiés'); if (JSON.stringify(cp.stop) !== JSON.stringify(a.stop)) out.push('conditions d’arrêt modifiées');
  return out.join(' ; ') || 'paramètres modifiés';
}
C.drift = function (S, cid, cp) { return cp.approval && fingerprint(S, cid, cp) !== cp.approval.fp ? describeDrift(S, cid, cp) : ''; };
function requireReapproval(S, cid, cp, why) {
  cp.version++; cp.prevStatus = cp.status; cp.status = 'attente_pdg'; cp.reapproval = { reason: why, at: C.now(S) };
  cp.history.push(Object.assign({ text: 'Modification significative après approbation (' + why + ') : nouvelle validation requise, envois suspendus' }, who(S)));
  C.pushEvent(S, cid, 'campagne_attente', 'reapp_' + cp.id + '_' + cp.version, cp.ref + ' « ' + cp.name + ' » modifiée : nouvelle validation PDG requise', 'haute', { page: 'crm-campaigns', id: cp.id });
}
/** Prévalidation : contrôles bloquants et avertissements, volumes, durée estimée sous plafonds. */
C.precheck = function (S, cid, cp) {
  var d = C.D(S, cid), err = [], warn = [], seg = C.resolveSegment(S, cid, cp), caps = effCaps(S, cid, cp), g = d.settings.caps;
  if (!cp.objective) err.push('Objectif de la campagne non renseigné.');
  if (!cp.steps.length) err.push('Aucun modèle : ajoutez au moins le message initial.');
  cp.steps.forEach(function (s, i) { if (!C.template(S, cid, s.templateId)) err.push('Étape ' + (i + 1) + ' : modèle introuvable.'); if (i && !(s.delayDays > 0)) err.push('Étape ' + (i + 1) + ' : délai de relance manquant.'); });
  if (!seg.included.length) err.push('Aucun destinataire valide dans le segment.');
  if (!cp.schedule.start) err.push('Date de lancement manquante.'); if (!cp.schedule.end) err.push('Date de fin manquante.'); else if (cp.schedule.end < (cp.schedule.start || '')) err.push('Date de fin antérieure au lancement.');
  if (cp.caps.day && cp.caps.day > g.campaignDay) err.push('Plafond journalier ' + cp.caps.day + ' supérieur au maximum fixé par la direction (' + g.campaignDay + ').');
  if (g.mailboxDay > (d.integrations.mailbox.limitDay || 1e9)) err.push('Plafond de la boîte supérieur à la limite du fournisseur.');
  if (d.integrations.mailbox.status !== 'actif') warn.push('Boîte d’envoi « ' + C.INTEG_STATUS[d.integrations.mailbox.status][0] + ' » : les envois attendront la reconnexion.');
  if (seg.excluded.length) warn.push(seg.excluded.length + ' contact(s) écarté(s) automatiquement (opposition, adresse absente, invalide ou déduite, variable vide).');
  var vol = seg.included.length * cp.steps.length, days = Math.ceil(seg.included.length / Math.max(1, caps.day));
  if (cp.schedule.start && cp.schedule.end && U.daysBetween(cp.schedule.start, cp.schedule.end) < days) warn.push('Au plafond de ' + caps.day + '/jour, le premier envoi demande ' + days + ' jour(s) ouvré(s) : la période est peut-être trop courte.');
  var invalid = seg.excluded.filter(function (x) { return /invalide|déduite/.test(x.reason); }).length;
  return { errors: err, warnings: warn, recipients: seg.included, excluded: seg.excluded, volume: vol, firstWaveDays: days, caps: caps, expectedErrors: invalid, ok: !err.length };
};
C.submit = function (S, cid, id) {
  need(S, cid, 'crm.campaign'); var cp = C.campaign(S, cid, id); if (['brouillon', 'prevalidation'].indexOf(cp.status) < 0) fail('Campagne déjà soumise.');
  var p = C.precheck(S, cid, cp); cp.status = 'prevalidation'; cp.precheck = { at: C.now(S), errors: p.errors, warnings: p.warnings, volume: p.volume, recipients: p.recipients.length };
  if (!p.ok) { cp.history.push(Object.assign({ text: 'Prévalidation : ' + p.errors.length + ' blocage(s)' }, who(S))); fail('Prévalidation : ' + p.errors.join(' ')); }
  cp.status = 'attente_pdg'; cp.history.push(Object.assign({ text: 'Soumise à la validation PDG · ' + p.recipients.length + ' destinataires · ' + p.volume + ' envois prévus' }, who(S)));
  C.pushEvent(S, cid, 'campagne_attente', 'submit_' + cp.id + '_' + cp.version, cp.ref + ' « ' + cp.name + ' » attend votre validation (' + p.recipients.length + ' destinataires)', 'haute', { page: 'crm-campaigns', id: cp.id });
  return cp;
};
/** Approbation explicite d'une VERSION : destinataires, modèles (versions), règles, calendrier figés. */
C.approve = function (S, cid, id, comment) {
  guard(S, cid); if (!C.canApprove(S, cid)) fail('Vous ne disposez pas du droit de valider les campagnes de direction.');
  var cp = C.campaign(S, cid, id); if (cp.status !== 'attente_pdg') fail('La campagne n’est pas en attente de validation.');
  var p = C.precheck(S, cid, cp); if (!p.ok) fail('Contrôles bloquants : ' + p.errors.join(' '));
  cp.approval = { version: cp.version, fp: fingerprint(S, cid, cp), by: me(S).name, byId: me(S).id, at: C.now(S), comment: comment || '', recipients: p.recipients.map(function (c) { return c.id; }), steps: cp.steps.map(function (s) { return { templateId: s.templateId, version: C.template(S, cid, s.templateId).version, delayDays: s.delayDays }; }), schedule: U.clone(cp.schedule), caps: U.clone(cp.caps), stop: U.clone(cp.stop), volume: p.volume };
  (cp.approvals = cp.approvals || []).push(U.clone(cp.approval)); delete cp.reapproval;
  cp.status = cp.schedule.start > C.now(S).slice(0, 10) ? 'programmee' : 'en_cours';
  cp.history.push(Object.assign({ text: 'Version ' + cp.version + ' autorisée par ' + me(S).name + (comment ? ' · ' + comment : '') }, who(S)));
  schedule(S, cid, cp);
  C.pushEvent(S, cid, 'campagne', 'appr_' + cp.id + '_' + cp.version, cp.ref + ' autorisée (v' + cp.version + ') par ' + me(S).name, 'normale', { page: 'crm-campaigns', id: cp.id });
  Y.audit(S, cid, 'CRM · campagne autorisée', cp.ref, 'v' + cp.version + ' · ' + p.recipients.length + ' destinataires · ' + p.volume + ' envois'); return cp;
};
C.reject = function (S, cid, id, comment) { guard(S, cid); if (!C.canApprove(S, cid)) fail('Droit de validation requis.'); if (!comment) fail('Motif obligatoire.'); var cp = C.campaign(S, cid, id); cp.status = 'brouillon'; cp.history.push(Object.assign({ text: 'Refusée : ' + comment }, who(S))); Y.audit(S, cid, 'CRM · campagne refusée', cp.ref, comment); return cp; };
/** Planification des messages initiaux autorisés (les relances sont créées après chaque envoi). */
function schedule(S, cid, cp) {
  var d = C.D(S, cid), today = C.now(S).slice(0, 10), start = (cp.schedule.start > today ? cp.schedule.start : today) + 'T' + (cp.schedule.from || d.settings.hours.from);
  var at = start < C.now(S) ? C.now(S) : start;
  cp.approval.recipients.forEach(function (id) { var key = cp.id + '|0|' + id; if (d.queue.some(function (q) { return q.key === key; })) return; var c = C.contact(S, cid, id); d.queue.push({ id: U.uid('q'), key: key, campaignId: cp.id, campaignRef: cp.ref, step: 0, contactId: id, to: c.email, dueAt: at, status: 'planifie', attempts: 0, version: cp.version, ownerId: c.ownerId }); });
}
C.suspend = function (S, cid, id, reason) { guard(S, cid); if (!(C.canApprove(S, cid) || C.can(S, 'crm.campaign'))) fail('Droit requis.'); if (!reason) fail('Motif obligatoire.'); var cp = C.campaign(S, cid, id); if (['en_cours', 'programmee', 'autorisee'].indexOf(cp.status) < 0) fail('Campagne non active.'); cp.prevStatus = cp.status; cp.status = 'suspendue'; cp.history.push(Object.assign({ text: 'Arrêt d’urgence : ' + reason }, who(S))); C.pushEvent(S, cid, 'arret', 'susp_' + cp.id + '_' + cp.history.length, cp.ref + ' suspendue : ' + reason, 'haute', { page: 'crm-campaigns', id: cp.id }); Y.audit(S, cid, 'CRM · arrêt d’urgence', cp.ref, reason); return cp; };
C.resume = function (S, cid, id) { guard(S, cid); if (!C.canApprove(S, cid)) fail('Seule la direction reprend une campagne suspendue.'); var cp = C.campaign(S, cid, id); if (cp.status !== 'suspendue') fail('Campagne non suspendue.'); if (C.drift(S, cid, cp)) { requireReapproval(S, cid, cp, C.drift(S, cid, cp)); return cp; } cp.status = 'en_cours'; cp.history.push(Object.assign({ text: 'Reprise contrôlée' }, who(S))); return cp; };
C.cancel = function (S, cid, id, reason) { need(S, cid, 'crm.campaign'); var cp = C.campaign(S, cid, id); cp.status = 'annulee'; C.D(S, cid).queue.forEach(function (q) { if (q.campaignId === cp.id && ['planifie', 'reessai', 'reporte', 'attente_canal'].indexOf(q.status) > -1) { q.status = 'annule'; q.reason = 'Campagne annulée'; } }); cp.history.push(Object.assign({ text: 'Annulée : ' + (reason || '') }, who(S))); return cp; };
C.globalStop = function (S, cid, on, reason) { need(S, cid, 'crm.governance'); var st = C.D(S, cid).settings; if (on && !reason) fail('Motif obligatoire.'); st.globalStop = on ? Object.assign({ reason: reason }, who(S)) : null; C.pushEvent(S, cid, 'arret', 'global_' + (on ? 'on' : 'off') + '_' + C.now(S), on ? 'Suspension globale des envois : ' + reason : 'Envois sortants rétablis', 'haute', { page: 'crm-campaigns' }); Y.audit(S, cid, 'CRM · suspension globale', on ? 'activée' : 'levée', reason || ''); return st.globalStop; };

/* ======================================================================= moteur d'exécution */
function inHours(S, cid, cp, iso) { var h = C.D(S, cid).settings.hours, from = (cp && cp.schedule.from) || h.from, to = (cp && cp.schedule.to) || h.to, t = iso.slice(11, 16); return h.days.indexOf(dow(iso)) > -1 && t >= from && t < to; }
function nextWindow(S, cid, cp, iso) { var h = C.D(S, cid).settings.hours, from = (cp && cp.schedule.from) || h.from, d = iso.slice(0, 10), t = iso.slice(11, 16), to = (cp && cp.schedule.to) || h.to; if (h.days.indexOf(dow(iso)) > -1 && t < from) return d + 'T' + from; for (var i = 1; i < 10; i++) { var n = U.addDays(d, i) + 'T' + from; if (h.days.indexOf(dow(n)) > -1) return n; } void to; return U.addDays(d, 1) + 'T' + from; }
function counts(S, cid, q, iso) {
  var d = C.D(S, cid), day = iso.slice(0, 10), wk = weekKey(iso), sent = d.queue.filter(function (x) { return x.status === 'envoye' && x.sentAt; });
  return { mailboxDay: sent.filter(function (x) { return x.sentAt.slice(0, 10) === day; }).length, campDay: sent.filter(function (x) { return x.campaignId === q.campaignId && x.sentAt.slice(0, 10) === day; }).length, campWeek: sent.filter(function (x) { return x.campaignId === q.campaignId && weekKey(x.sentAt) === wk; }).length, recWeek: sent.filter(function (x) { return x.contactId === q.contactId && x.campaignId && weekKey(x.sentAt) === wk; }).length };
}
/** Les 9 règles vérifiées avant CHAQUE envoi. Retourne null si tout est conforme, sinon {code, text, retryAt?}. */
C.preSendCheck = function (S, cid, q, iso) {
  var d = C.D(S, cid), cp = q.campaignId ? C.campaign(S, cid, q.campaignId) : null, c = C.contact(S, cid, q.contactId);
  if (S.meta.crmGlobalStop || d.settings.globalStop) return { code: 'arret_global', text: 'Suspension globale des envois sortants', hold: true };
  if (cp) {
    if (cp.status !== 'en_cours') return { code: 'campagne', text: 'Campagne ' + C.CAMP_STATUS[cp.status][0].toLowerCase(), hold: true };
    if (cp.schedule.end && iso.slice(0, 10) > cp.schedule.end) return { code: 'expiree', text: 'Campagne expirée (fin le ' + U.frDate(cp.schedule.end) + ')' };
    if (!cp.approval || cp.approval.recipients.indexOf(q.contactId) < 0) return { code: 'perimetre', text: 'Destinataire hors du périmètre approuvé' };
    var st = cp.steps[q.step], t = st && C.template(S, cid, st.templateId), ap = cp.approval.steps[q.step];
    if (!t || !ap || ap.templateId !== st.templateId || ap.version !== t.version) return { code: 'modele', text: 'Modèle différent de la version approuvée' };
    var stopped = d.replies.find(function (r) { return r.contactId === q.contactId && ['positive', 'question', 'negative', 'opposition'].indexOf(r.kind) > -1 && (!r.campaignId || r.campaignId === cp.id); });
    if (stopped && cp.stop.onReply) return { code: 'reponse', text: 'Le destinataire a répondu : relances arrêtées' };
  }
  if (!c || c.deleted) return { code: 'contact', text: 'Contact supprimé' };
  var ex = C.isExcluded(S, cid, c, 'email'); if (ex) return { code: 'exclusion', text: 'Opposition / exclusion : ' + ex.reason };
  if (d.integrations.mailbox.status !== 'actif') return { code: 'canal', text: 'Boîte d’envoi ' + C.INTEG_STATUS[d.integrations.mailbox.status][0].toLowerCase(), hold: true };
  if (!emailOk(c.email) || c.emailInvalid) return { code: 'adresse', text: 'Adresse e-mail absente ou invalide' };
  if (cp) {
    if (!inHours(S, cid, cp, iso)) return { code: 'horaire', text: 'Hors des horaires autorisés', retryAt: nextWindow(S, cid, cp, iso) };
    var k = counts(S, cid, q, iso), caps = effCaps(S, cid, cp);
    if (k.mailboxDay >= caps.mailboxDay) return { code: 'plafond', text: 'Plafond de la boîte atteint (' + caps.mailboxDay + '/jour)', retryAt: nextWindow(S, cid, cp, iso.slice(0, 10) + 'T23:59') };
    if (k.campDay >= caps.day) return { code: 'plafond', text: 'Plafond journalier de la campagne atteint (' + caps.day + ')', retryAt: nextWindow(S, cid, cp, iso.slice(0, 10) + 'T23:59') };
    if (k.campWeek >= caps.week) return { code: 'plafond', text: 'Plafond hebdomadaire atteint (' + caps.week + ')', retryAt: nextWindow(S, cid, cp, U.addDays(weekKey(iso), 7) + 'T00:00') };
    if (k.recWeek >= caps.recipientWeek) return { code: 'plafond', text: 'Plafond par destinataire atteint (' + caps.recipientWeek + '/semaine)', retryAt: nextWindow(S, cid, cp, U.addDays(weekKey(iso), 7) + 'T00:00') };
    var r = C.render(S, cid, t, c, ap.version); if (r.missing.length) return { code: 'variables', text: 'Variables obligatoires vides : ' + r.missing.join(', ') };
    q.subject = r.subject; q.body = r.body;
  }
  if (d.sentKeys[q.key]) return { code: 'doublon', text: 'Déjà envoyé pour cet événement (clé d’idempotence)' };
  return null;
};
/** Fournisseur de messagerie simulé : adresse inexistante → rejet définitif ; panne → erreur temporaire. */
function provider(S, cid, q) { var c = C.contact(S, cid, q.contactId) || {}; if (S.meta.crmOutage) return { ok: false, temporary: true, error: 'Fournisseur indisponible (erreur 421)' }; if (/invalide|n-existe-pas/.test(q.to) || c.bounce) return { ok: false, temporary: false, error: 'Adresse inexistante (erreur 550)' }; return { ok: true, id: 'msg_' + U.fnv(q.key) }; }
function process(S, cid, q, iso) {
  var d = C.D(S, cid), chk = C.preSendCheck(S, cid, q, iso), cp = q.campaignId ? C.campaign(S, cid, q.campaignId) : null, log = function (res, text) { d.runLog.unshift({ at: iso, key: q.key, campaign: q.campaignRef, to: q.to, step: q.step, result: res, text: text }); };
  if (chk) {
    if (chk.retryAt) { q.status = 'reporte'; q.dueAt = chk.retryAt; q.reason = chk.text; log('reporte', chk.text + ' → ' + chk.retryAt.replace('T', ' ')); return; }
    if (chk.hold) { q.status = chk.code === 'canal' ? 'attente_canal' : 'planifie'; q.reason = chk.text; q.dueAt = addMin(iso, 60); log('attente', chk.text); if (chk.code === 'canal') C.pushEvent(S, cid, 'integration', 'mailbox_' + d.integrations.mailbox.status, 'Boîte d’envoi déconnectée : envois en attente', 'haute', { page: 'crm-admin', tab: 'integrations' }); return; }
    q.status = 'bloque'; q.reason = chk.text; q.blockCode = chk.code; log('bloque', chk.text); if (['adresse', 'variables', 'perimetre', 'modele'].indexOf(chk.code) > -1 && cp) C.pushEvent(S, cid, 'blocage', 'blk_' + q.key, 'Envoi bloqué (' + cp.ref + ') : ' + chk.text, 'normale', { page: 'crm-campaigns', id: cp.id }); return;
  }
  q.attempts++; var r = provider(S, cid, q);
  if (r.ok) {
    q.status = 'envoye'; q.sentAt = iso; q.providerId = r.id; q.reason = ''; d.sentKeys[q.key] = iso; log('envoye', 'Accepté par le fournisseur');
    var c = C.contact(S, cid, q.contactId); if (c && c.status === 'nouveau') c.status = 'contacte';
    if (cp && cp.steps[q.step + 1]) { var nk = cp.id + '|' + (q.step + 1) + '|' + q.contactId; if (!d.queue.some(function (x) { return x.key === nk; })) d.queue.push({ id: U.uid('q'), key: nk, campaignId: cp.id, campaignRef: cp.ref, step: q.step + 1, contactId: q.contactId, to: q.to, dueAt: U.addDays(iso.slice(0, 10), cp.steps[q.step + 1].delayDays) + iso.slice(10), status: 'planifie', attempts: 0, version: cp.version, ownerId: q.ownerId }); }
    return;
  }
  if (r.temporary && q.attempts < d.settings.retry.max) { q.status = 'reessai'; q.dueAt = addMin(iso, d.settings.retry.delayMin * q.attempts); q.reason = r.error; log('reessai', r.error + ' · tentative ' + q.attempts + '/' + d.settings.retry.max); return; }
  q.status = 'echec'; q.reason = r.error + (r.temporary ? ' · tentatives épuisées' : ''); log('echec', q.reason);
  if (!r.temporary) { var ct = C.contact(S, cid, q.contactId); if (ct) { ct.emailInvalid = true; ct.history.push({ text: 'Adresse ' + q.to + ' rejetée par le fournisseur (invalide)', at: iso, by: 'Moteur' }); } C.pushEvent(S, cid, 'adresse', 'bounce_' + q.to, 'Adresse invalide : ' + q.to, 'normale', { page: 'crm-base', tab: 'contacts', id: q.contactId }); }
  if (cp) { var tot = d.queue.filter(function (x) { return x.campaignId === cp.id && ['envoye', 'echec'].indexOf(x.status) > -1; }), bad = tot.filter(function (x) { return x.status === 'echec' && !/tentatives/.test(x.reason); }).length; if (tot.length >= 10 && bad * 100 / tot.length > (cp.stop.onBounceRate || 100) && cp.status === 'en_cours') { cp.status = 'suspendue'; cp.history.push({ text: 'Arrêt automatique : taux de rejet ' + Math.round(bad * 100 / tot.length) + ' % > ' + cp.stop.onBounceRate + ' %', at: iso, by: 'Moteur' }); C.pushEvent(S, cid, 'arret', 'auto_' + cp.id, cp.ref + ' suspendue automatiquement (taux de rejet)', 'haute', { page: 'crm-campaigns', id: cp.id }); } }
}
/** Fait avancer le moteur jusqu'à `until` : traite les éléments dus dans l'ordre chronologique. */
C.tick = function (S, cid, until) {
  guard(S, cid); var d = C.D(S, cid), n = 0, guardLoop = 0; until = (until || C.now(S)).slice(0, 16);
  d.campaigns.forEach(function (cp) { if (cp.status === 'programmee' && cp.schedule.start <= until.slice(0, 10)) { cp.status = 'en_cours'; cp.history.push({ text: 'Lancement programmé', at: until, by: 'Moteur' }); } if (cp.status === 'en_cours' && cp.schedule.end && until.slice(0, 10) > cp.schedule.end) { cp.status = 'terminee'; cp.history.push({ text: 'Terminée (date de fin atteinte)', at: until, by: 'Moteur' }); } });
  while (guardLoop++ < 5000) {
    var due = d.queue.filter(function (q) { return ['planifie', 'reessai', 'reporte', 'attente_canal'].indexOf(q.status) > -1 && q.dueAt <= until; }).sort(function (a, b) { return a.dueAt < b.dueAt ? -1 : (a.dueAt > b.dueAt ? 1 : (a.key < b.key ? -1 : 1)); })[0];
    if (!due) break; var at = due.dueAt < C.now(S) ? C.now(S) : due.dueAt, before = due.dueAt + due.status; process(S, cid, due, at); n++;
    if (due.dueAt + due.status === before) { due.dueAt = addMin(until, 1); break; }
  }
  C.setNow(S, until > C.now(S) ? until : C.now(S)); return n;
};
C.stats = function (S, cid, cp) { var q = C.D(S, cid).queue.filter(function (x) { return x.campaignId === cp.id; }), rep = C.D(S, cid).replies.filter(function (r) { return r.campaignId === cp.id; }); var by = function (s) { return q.filter(function (x) { return x.status === s; }).length; }; return { total: q.length, sent: by('envoye'), planned: by('planifie') + by('reporte') + by('reessai') + by('attente_canal'), blocked: by('bloque'), failed: by('echec'), cancelled: by('annule'), replies: rep.length, positive: rep.filter(function (r) { return r.kind === 'positive'; }).length, optout: rep.filter(function (r) { return r.kind === 'opposition'; }).length }; };

/* ======================================================================= réponses */
C.REPLY = { positive: ['Positive', 'ok'], question: ['Question', 'info'], negative: ['Négative', ''], absence: ['Absence', 'warn'], opposition: ['Opposition', 'bad'] };
C.classify = function (text) {
  var t = norm(text), m;
  if (/desinscri|desabonn|ne plus (me )?(contacter|ecrire|recevoir)|retirez|supprimez mes|unsubscribe|stop\b|ne m ecrivez plus/.test(t)) return { kind: 'opposition' };
  if (/absent|en conge|hors du bureau|out of office|de retour le|en deplacement jusqu/.test(t)) { m = String(text).match(/(\d{1,2})[\/.](\d{1,2})(?:[\/.](\d{2,4}))?/); return { kind: 'absence', back: m ? ((m[3] ? (m[3].length === 2 ? '20' + m[3] : m[3]) : '2026') + '-' + U.pad(+m[2], 2) + '-' + U.pad(+m[1], 2)) : '' }; }
  if (/pas interesse|non merci|pas pour le moment|aucun besoin|pas de besoin/.test(t)) return { kind: 'negative' };
  if (/rendez vous|rdv|disponible|interess|appeler|demo|demonstration|appelez|rappelez|proposition|devis|tarif|volontiers|avec plaisir|echangeons/.test(t)) return { kind: 'positive' };
  return { kind: 'question' };
};
/** Réponse reçue : relances arrêtées et tâche humaine (positive / question) ; absence → report ; opposition → exclusion immédiate. */
C.receiveReply = function (S, cid, v) {
  guard(S, cid); var d = C.D(S, cid), c = C.contact(S, cid, v.contactId); if (!c) fail('Contact inconnu.');
  var cl = v.kind ? { kind: v.kind, back: v.back } : C.classify(v.text), at = v.at || C.now(S), last = d.queue.filter(function (q) { return q.contactId === c.id && q.status === 'envoye' && q.campaignId; }).sort(function (a, b) { return a.sentAt < b.sentAt ? 1 : -1; })[0];
  var r = { id: U.uid('rep'), contactId: c.id, campaignId: v.campaignId || (last ? last.campaignId : ''), text: v.text, kind: cl.kind, at: at, back: cl.back || '', handled: false };
  d.replies.unshift(r); c.history.push({ text: 'Réponse reçue (' + C.REPLY[r.kind][0].toLowerCase() + ')', at: at, by: 'Messagerie' });
  var pend = d.queue.filter(function (q) { return q.contactId === c.id && q.campaignId && ['planifie', 'reessai', 'reporte'].indexOf(q.status) > -1; });
  if (r.kind === 'opposition') { C.exclude(S, cid, { contactId: c.id, email: c.email, channel: 'tous', reason: 'Opposition exprimée en réponse', source: 'Réponse e-mail' }, true); C.pushEvent(S, cid, 'opposition', 'opp_' + c.id, 'Opposition de ' + C.contactName(c) + ' : communications bloquées', 'normale', { page: 'crm-base', tab: 'contacts', id: c.id }); }
  else if (r.kind === 'absence') { var back = r.back && r.back > at.slice(0, 10) ? r.back : U.addDays(at.slice(0, 10), 7); pend.forEach(function (q) { q.status = 'reporte'; q.dueAt = U.addDays(back, 1) + 'T09:00'; q.reason = 'Absence du destinataire jusqu’au ' + U.frDate(back); }); r.handled = true; }
  else {
    pend.forEach(function (q) { q.status = 'annule'; q.reason = 'Réponse reçue : relance arrêtée'; });
    if (r.kind !== 'negative') { var o = d.opps.find(function (x) { return x.companyId === c.companyId && ['gagne', 'perdu'].indexOf(x.stage) < 0; }); var act = C._bypassed(S, function () { return C.saveActivity(S, cid, { type: 'tache', title: (r.kind === 'positive' ? 'Réponse positive à traiter : ' : 'Question à traiter : ') + C.contactName(c), at: at, contactId: c.id, oppId: o ? o.id : '', ownerId: c.ownerId, origin: 'reponse' }); }); r.taskId = act.id; if (o && ['a_qualifier', 'qualifie', 'a_preparer', 'contacte'].indexOf(o.stage) > -1) C._bypassed(S, function () { C.moveStage(S, cid, o.id, 'echange', { note: 'Réponse ' + r.kind }); }); C.pushEvent(S, cid, 'reponse', 'rep_' + r.id, 'Réponse ' + C.REPLY[r.kind][0].toLowerCase() + ' de ' + C.contactName(c) + ' : intervention requise', 'haute', { page: 'crm-messages', tab: 'inbox', id: r.id }); }
    else { c.status = 'pas_interesse'; r.handled = true; }
  }
  return r;
};
C._bypassed = function (S, fn) { var b = C._bypass; C._bypass = true; try { return fn(); } finally { C._bypass = b; } };

/* ======================================================================= intégrations */
C.INTEG_STATUS = { actif: ['Actif', 'ok'], expire: ['Expiré', 'warn'], erreur: ['Erreur', 'bad'], autorisation_requise: ['Autorisation requise', 'warn'], non_disponible: ['Non disponible', ''], demo: ['Démonstration', 'info'], deconnecte: ['Déconnecté', 'bad'] };
C.setIntegration = function (S, cid, k, status, account) {
  need(S, cid, 'crm.admin'); var d = C.D(S, cid), it = d.integrations[k]; if (!it) fail('Intégration inconnue.'); var before = it.status; it.status = status; if (account !== undefined) it.account = account; it.changedAt = C.now(S);
  if (status !== 'actif') C.pushEvent(S, cid, 'integration', k + '_' + status + '_' + C.now(S), it.label + ' : ' + C.INTEG_STATUS[status][0].toLowerCase() + ' · opérations dépendantes suspendues', 'haute', { page: 'crm-admin', tab: 'integrations' });
  if (k === 'gcal' && status === 'actif' && before !== 'actif') d.activities.forEach(function (a) { if (a.gcal && a.gcal.sync === 'indisponible' && a.status === 'a_faire') a.gcal = { sync: 'ok', at: C.now(S), eventId: 'gcal_' + a.ref, resynced: true }; });
  if (k === 'mailbox' && status === 'actif') d.queue.forEach(function (q) { if (q.status === 'attente_canal') { q.status = 'planifie'; q.dueAt = C.now(S); } });
  Y.audit(S, cid, 'CRM · intégration', it.label, before + ' → ' + status); return it;
};

/* ======================================================================= gouvernance */
C.setCaps = function (S, cid, v) {
  need(S, cid, 'crm.governance'); var d = C.D(S, cid), lim = d.integrations.mailbox.limitDay || 1e9;
  if (+v.mailboxDay > lim) fail('Plafond de la boîte (' + v.mailboxDay + ') supérieur à la limite du fournisseur (' + lim + '/jour).');
  if (+v.campaignDay > +v.mailboxDay) fail('Le plafond d’une campagne ne peut pas dépasser celui de la boîte.');
  if (+v.campaignWeek < +v.campaignDay) fail('Plafond hebdomadaire inférieur au plafond journalier.');
  if (!(+v.recipientWeek >= 1 && +v.recipientWeek <= 5)) fail('1 à 5 messages par destinataire et par semaine.');
  d.settings.caps = { mailboxDay: +v.mailboxDay, campaignDay: +v.campaignDay, campaignWeek: +v.campaignWeek, recipientWeek: +v.recipientWeek };
  if (v.from) d.settings.hours = { from: v.from, to: v.to, days: v.days || d.settings.hours.days };
  Y.audit(S, cid, 'CRM · plafonds', 'gouvernance', JSON.stringify(d.settings.caps)); return d.settings.caps;
};
C.delegate = function (S, cid, userId, until) { need(S, cid, 'crm.approve'); var u = user(S, userId); if (!u || u.role !== 'sales_manager') fail('Délégation possible uniquement à un responsable commercial.'); var d = C.D(S, cid); d.settings.delegations = d.settings.delegations.filter(function (x) { return x.userId !== userId; }); d.settings.delegations.push(Object.assign({ userId: userId, name: u.name, until: until || '' }, who(S))); Y.audit(S, cid, 'CRM · délégation de validation', u.name, until || 'sans limite'); };
C.revoke = function (S, cid, userId) { need(S, cid, 'crm.approve'); var d = C.D(S, cid); d.settings.delegations = d.settings.delegations.filter(function (x) { return x.userId !== userId; }); Y.audit(S, cid, 'CRM · délégation retirée', userId, ''); };

/* ======================================================================= objectifs et cockpit */
C.saveObjective = function (S, cid, v) { need(S, cid, 'crm.governance'); var d = C.D(S, cid); if (!v.period || !(+v.target > 0)) fail('Période et objectif obligatoires.'); var o = d.objectives.find(function (x) { return x.period === v.period && (x.team || '') === (v.team || ''); }); if (o) { o.history = (o.history || []).concat([{ from: o.target, to: +v.target, at: C.now(S), by: me(S).name }]); o.target = +v.target; } else { o = { id: U.uid('obj'), period: v.period, from: v.from, to: v.to, team: v.team || '', target: +v.target, history: [] }; d.objectives.push(o); } Y.audit(S, cid, 'CRM · objectif', v.period, U.fmt(+v.target)); return o; };
/** Tous les indicateurs sont calculés depuis les dossiers sources (CRM et comptabilité), avec la liste des éléments. */
C.cockpit = function (S, cid, f) {
  need(S, cid, 'crm.read'); f = f || {}; var d = C.D(S, cid), from = f.from || S.meta.today.slice(0, 4) + '-01-01', to = f.to || S.meta.today, now = C.now(S);
  var opps = C.list(S, cid, 'opps').filter(function (o) { return (!f.offer || o.offer === f.offer) && (!f.country || o.country === f.country) && (!f.team || o.team === f.team); });
  var won = opps.filter(function (o) { return o.stage === 'gagne' && o.signedAt >= from && o.signedAt <= to; }), open = opps.filter(function (o) { return ['gagne', 'perdu'].indexOf(o.stage) < 0; });
  var cos = C.list(S, cid, 'companies').filter(function (c) { return c.tiersId && (!f.country || c.country === f.country); }), tids = cos.map(function (c) { return c.tiersId; }), docs = Y.D(S, cid).docs.filter(function (x) { return x.type === 'FA' && x.status !== 'draft' && tids.indexOf(x.tiersId) > -1; });
  var inv = docs.filter(function (x) { return x.date >= from && x.date <= to; }), pays = []; docs.forEach(function (x) { (x.payments || []).forEach(function (p) { if (p.date >= from && p.date <= to) pays.push({ doc: x, p: p }); }); });
  var obj = d.objectives.filter(function (o) { return (!f.team || o.team === f.team) && o.from <= to && o.to >= from && (f.team || !o.team); }), target = U.sum(obj, function (o) { return o.target; });
  var signed = U.sum(won, function (o) { return o.amount; }), acts = C.list(S, cid, 'activities');
  var late = acts.filter(function (a) { return a.status === 'a_faire' && a.at < now; }), meet = acts.filter(function (a) { return a.type === 'rdv' && a.at.slice(0, 10) >= from && a.at.slice(0, 10) <= to && a.status !== 'annule'; });
  var newP = C.list(S, cid, 'contacts').filter(function (c) { return c.createdAt && c.createdAt.slice(0, 10) >= from && c.createdAt.slice(0, 10) <= to; });
  var props = opps.filter(function (o) { return o.history.some(function (h) { return h.to === 'proposition' && h.at.slice(0, 10) >= from && h.at.slice(0, 10) <= to; }); });
  var ref = to < S.meta.today ? to : S.meta.today, elapsed = obj.length ? Math.max(0, Math.min(1, U.daysBetween(obj[0].from, ref) / Math.max(1, U.daysBetween(obj[0].from, obj[0].to)))) : 0;
  var prio = open.map(function (o) { return { o: o, w: o.amount * o.probability / 100 }; }).sort(function (a, b) { return b.w - a.w; }).slice(0, 6).map(function (x) { return x.o; });
  return { from: from, to: to, signed: { value: signed, items: won }, invoiced: { value: U.sum(inv, function (x) { return Y.docTotals(S, cid, x).ht; }), items: inv }, collected: { value: U.sum(pays, function (x) { return x.p.amount; }), items: pays },
    target: target, objectives: obj, progress: target ? Math.round(signed * 1000 / target) / 10 : 0, expected: Math.round(elapsed * 1000) / 10, atRisk: target > 0 && signed / target < elapsed - 0.15,
    pipeline: { value: U.sum(open, function (o) { return o.amount; }), items: open }, weighted: { value: Math.round(U.sum(open, function (o) { return o.amount * o.probability / 100; })), items: open },
    newProspects: { value: newP.length, items: newP }, meetings: { value: meet.length, items: meet }, proposals: { value: props.length, items: props }, late: { value: late.length, items: late },
    campaigns: { value: d.campaigns.filter(function (c) { return c.status === 'en_cours'; }).length, items: d.campaigns.filter(function (c) { return ['en_cours', 'attente_pdg', 'suspendue', 'programmee'].indexOf(c.status) > -1; }) }, priorities: prio };
};
C.funnel = function (S, cid) { var opps = C.list(S, cid, 'opps'), st = C.D(S, cid).settings.stages; return st.map(function (s, i) { var reached = opps.filter(function (o) { return o.history.some(function (h) { var j = st.findIndex(function (x) { return x.k === h.to; }); return j >= i && h.to !== 'perdu'; }) || (s.k === 'perdu' && o.stage === 'perdu'); }); return { k: s.k, label: s.label, count: opps.filter(function (o) { return o.stage === s.k; }).length, reached: reached.length, amount: U.sum(opps.filter(function (o) { return o.stage === s.k; }), function (o) { return o.amount; }) }; }); };

/* ======================================================================= notifications */
/** Événement unique par clé (déduplication) ; relais WhatsApp vers la direction pour les seuls types autorisés. */
C.pushEvent = function (S, cid, type, key, text, prio, link) {
  var d = C.D(S, cid); if (d.events.some(function (e) { return e.key === key; })) return null;
  var e = { id: U.uid('ev'), key: key, type: type, text: text, prio: prio || 'normale', link: link || {}, at: C.now(S), read: false };
  d.events.unshift(e);
  var wa = d.settings.waAlerts, it = d.integrations.whatsapp;
  if (wa.events.indexOf(type) > -1 && prio === 'haute') { if (d.waLog.some(function (x) { return x.key === key; })) return e; d.waLog.unshift({ key: key, at: e.at, to: wa.to || '—', text: text, status: it.status === 'actif' && wa.to ? 'envoyee' : 'non_envoyee', reason: it.status === 'actif' && wa.to ? '' : 'Canal WhatsApp professionnel non configuré' }); }
  return e;
};
C.notifications = function (S, cid) {
  var d, out = []; try { guard(S, cid); d = C.D(S, cid); } catch (x) { return out; } if (!C.can(S, 'crm.read') && !C.can(S, 'crm.admin')) return out;
  var push = function (level, title, text, page, tab) { out.push({ level: level, title: title, text: text, page: page, tab: tab, module: 'crm' }); };
  var wait = d.campaigns.filter(function (c) { return c.status === 'attente_pdg'; }); if (wait.length && C.canApprove(S, cid)) push('warn', wait.length + ' campagne(s) à valider', wait.map(function (c) { return c.ref; }).join(', '), 'crm-campaigns', 'validation');
  var rep = d.replies.filter(function (r) { return !r.handled && ['positive', 'question'].indexOf(r.kind) > -1 && C.visible(S, C.contact(S, cid, r.contactId) || {}); }); if (rep.length && C.can(S, 'crm.read')) push('bad', rep.length + ' réponse(s) à traiter', 'Relances arrêtées : intervention humaine requise.', 'crm-messages', 'inbox');
  if (C.can(S, 'crm.read')) { var late = C.list(S, cid, 'activities').filter(function (a) { return a.status === 'a_faire' && a.at < C.now(S); }); if (late.length) push('warn', late.length + ' action(s) en retard', '', 'crm-agenda', 'liste'); }
  Object.keys(d.integrations).forEach(function (k) { var it = d.integrations[k]; if (['erreur', 'expire', 'deconnecte'].indexOf(it.status) > -1) push('bad', it.label + ' : ' + C.INTEG_STATUS[it.status][0].toLowerCase(), 'Les opérations dépendantes sont suspendues.', 'crm-admin', 'integrations'); });
  if (d.settings.globalStop) push('bad', 'Envois sortants suspendus', d.settings.globalStop.reason, 'crm-campaigns', 'liste');
  try { if (C.can(S, 'crm.read')) { var ck = C.cockpit(S, cid, { from: (d.objectives[0] || {}).from, to: S.meta.today }); if (ck.atRisk) push('warn', 'Objectif commercial en risque', ck.progress + ' % réalisé pour ' + ck.expected + ' % du temps écoulé', 'crm-cockpit'); } } catch (x) { /* rien */ }
  return out;
};

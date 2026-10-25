// Parcours navigateur · Yiel CRM (Playwright) : node app/tests/e2e/crm-flows.js [dossier-captures]
const { chromium } = require('playwright'), path = require('path');
(async () => {
  const shots = process.argv[2];
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 920 } });
  const errs = [], log = [];
  p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_|net::/.test(m.text())) errs.push('CONSOLE ' + m.text()); });
  await p.goto((process.env.BASE_URL || 'http://localhost:3000') + '/');
  await p.waitForSelector('.rail');
  const wait = (ms) => p.waitForTimeout(ms || 300);
  const ev = async (label, js) => { try { const r = await p.evaluate(js); log.push(label + ' → ' + (r === undefined ? 'ok' : JSON.stringify(r))); return r; } catch (e) { errs.push(label + ' : ' + e.message); } finally { await wait(); } };
  const bad = async (label) => { const t = await p.$$eval('.callout.warn', cs => cs.map(c => c.textContent).filter(x => /Erreur d’affichage/.test(x))); if (t.length) errs.push(label + ' : ' + t[0]); };
  const shot = async (n) => { if (shots) await p.screenshot({ path: path.join(shots, n + '.png') }); };
  const user = async (id) => ev('utilisateur ' + id, `(function(){ const u = App.S.users.find(x => x.id === '${id}'); App.S.meta.currentUser = { id: u.id, name: u.name, role: u.role }; App.go(App.firstPage()); return u.name + ' → ' + App.ui.page; })()`);
  const toast = async () => (await p.$$eval('#toasts .toast', ts => ts.map(t => t.textContent))).slice(-1)[0] || '';
  const K = (js) => `(function(){ const C = Yiel.CRM, S = App.S, cid = App.cid(), d = C.D(S, cid); return ${js}; })()`;

  await user('u20');
  await ev('section CRM', `[...document.querySelectorAll('.nav .grp')].map(g => g.textContent).join(' | ')`);
  const PAGES = [['crm-cockpit'], ['crm-analyse'], ['crm-search', 'recherche'], ['crm-search', 'sauvegardes'], ['crm-search', 'listes'], ['crm-base', 'contacts'], ['crm-base', 'entreprises'], ['crm-base', 'import'], ['crm-base', 'carte'], ['crm-pipeline', 'colonnes'], ['crm-pipeline', 'liste'], ['crm-agenda', 'semaine'], ['crm-agenda', 'liste'], ['crm-messages', 'inbox'], ['crm-messages', 'modeles'], ['crm-messages', 'envois'], ['crm-campaigns', 'liste'], ['crm-campaigns', 'validation'], ['crm-campaigns', 'moteur'], ['crm-notifs'], ['crm-admin', 'utilisateurs'], ['crm-admin', 'integrations'], ['crm-admin', 'gouvernance'], ['crm-admin', 'securite']];
  for (const [pg, tab] of PAGES) { await p.evaluate(([pg, tab]) => App.go(pg, tab || undefined), [pg, tab]); await wait(200); await bad(pg + '/' + tab); }
  log.push('pages parcourues : ' + PAGES.length);

  // cockpit + drill-down
  await p.evaluate(() => App.go('crm-cockpit')); await wait(); await shot('60-cockpit');
  await ev('ouvrir CA signé', `(function(){ document.querySelector('[data-act="ck-drill"][data-id="signed"]').click(); return document.querySelector('.drawer h2').textContent + ' · ' + document.querySelectorAll('.drawer tbody tr').length + ' dossiers'; })()`);
  await shot('61-drill');
  await ev('pipeline pondéré', `(function(){ document.querySelector('[data-act="ck-drill"][data-id="weighted"]').click(); return document.querySelectorAll('.drawer tbody tr').length; })()`);

  // recherche → qualification → import
  await p.evaluate(() => App.go('crm-search', 'recherche')); await wait();
  await ev('résultats', `document.querySelectorAll('.sr-card').length`);
  await ev('sélection 2 résultats', `(function(){ const cb = [...document.querySelectorAll('.sr-card input[type=checkbox]:not([disabled])')]; cb[0].click(); return true; })()`);
  await ev('2e', `(function(){ const cb = [...document.querySelectorAll('.sr-card input[type=checkbox]:not([disabled])')].filter(x => !x.checked); cb[0].click(); return Object.values(App.ui.v.srSel).filter(Boolean).length; })()`);
  await ev('qualification (repli local)', `(async function(){ document.querySelector('[data-act="sr-qualify"]').click(); await new Promise(r => setTimeout(r, 400)); return document.querySelectorAll('.sr-q').length; })()`);
  await shot('62-recherche');
  await ev('envoyer vers une liste', `(async function(){ document.querySelector('[data-act="sr-import"]').click(); await new Promise(r => setTimeout(r, 120)); App.modalOk(); await new Promise(r => setTimeout(r, 200)); return document.querySelectorAll('.sr-card .chip.ok').length; })()`);
  log.push('toast : ' + await toast());

  // base : fiche entreprise, contact, import, carte
  await p.evaluate(() => App.go('crm-base', 'entreprises')); await wait();
  await ev('fiche entreprise', K(`(function(){ App.actions['cc-company']({ dataset: { id: d.companies.find(c => c.name === 'Polyclinique du Wouri').id } }); return document.querySelectorAll('.drawer .timeline li').length + ' événements'; })()`));
  await shot('63-entreprise');
  await ev('fiche contact', K(`(function(){ App.actions['cc-contact']({ dataset: { id: d.contacts.find(c => c.lastName === 'KOUMA').id } }); return document.querySelectorAll('.drawer .conf-chip').length + ' indicateurs de confiance'; })()`));
  await shot('64-contact');
  await p.evaluate(() => App.go('crm-base', 'import')); await wait();
  await ev('import : exemple', `(function(){ document.querySelector('[data-act="cb-imp-demo"]').click(); document.querySelector('[data-act="cb-imp-check"]').click(); return document.querySelectorAll('#main tbody tr').length + ' lignes'; })()`);
  await shot('65-import');
  await ev('import : lignes valides seulement', `(function(){ document.querySelector('[data-act="cb-imp-go"]').click(); return document.querySelector('.callout.ok b').textContent; })()`);
  await p.evaluate(() => App.go('crm-base', 'carte')); await wait();
  await ev('carte : exemple', `(function(){ document.querySelector('[data-act="cb-card-demo"]').click(); return document.querySelectorAll('.card-fields .fld.unc').length + ' champ(s) à vérifier'; })()`);
  await shot('66-carte');
  await ev('carte : correction et création', `(function(){ document.getElementById('cd_email').value = 'b.mboma@akwa-residence-exemple.cm'; document.querySelector('[data-act="cb-card-ok"]').click(); return document.querySelector('.drawer h2') ? document.querySelector('.drawer h2').textContent : 'pas de fiche'; })()`);

  // pipeline : déplacement + gagné
  await p.evaluate(() => App.go('crm-pipeline', 'colonnes')); await wait(); await shot('67-pipeline');
  await ev('déplacer en proposition', K(`(function(){ const o = d.opps.find(x => x.stage === 'a_preparer'); C.moveStage(S, cid, o.id, 'proposition', { note: 'test' }); App.render(); return o.ref + ' ' + o.history.length; })()`));
  await ev('gagné depuis le tiroir', K(`(async function(){ const o = d.opps.find(x => x.stage === 'proposition' && x.offer === 'myyiel Comptabilité'); App.actions['cc-opp']({ dataset: { id: o.id } }); await new Promise(r => setTimeout(r, 150)); document.querySelector('[data-act="cc-won"]').click(); await new Promise(r => setTimeout(r, 150)); App.modalOk(); await new Promise(r => setTimeout(r, 200)); return o.stage + ' · client comptable ' + !!C.company(S, cid, o.companyId).tiersId; })()`));

  // agenda
  await p.evaluate(() => App.go('crm-agenda', 'semaine')); await wait(); await shot('68-agenda');
  await ev('activité : reporter', K(`(async function(){ const a = d.activities.find(x => x.status === 'a_faire' && x.at < C.now(S)); App.actions['cc-act']({ dataset: { id: a.id } }); await new Promise(r => setTimeout(r, 120)); document.querySelector('[data-act="cc-act-postpone"]').click(); await new Promise(r => setTimeout(r, 120)); App.modalOk(); await new Promise(r => setTimeout(r, 150)); return a.history.length + ' entrées d’historique'; })()`));

  // messagerie : réponse + composer
  await p.evaluate(() => App.go('crm-messages', 'inbox')); await wait(); await shot('69-reponses');
  await ev('composer', K(`(async function(){ App.actions['cm-compose']({ dataset: { id: d.contacts.find(c => c.lastName === 'MOUSSA').id } }); await new Promise(r => setTimeout(r, 150)); document.querySelector('[data-act="cm-ai"]').click(); await new Promise(r => setTimeout(r, 500)); return document.querySelector('.drawer .mail-prev b').textContent; })()`));
  await shot('70-composer');
  await ev('envoyer', `(function(){ document.querySelector('[data-act="cm-send"]').click(); return true; })()`);
  log.push('toast : ' + await toast());

  // campagnes : validation PDG de CMP-002, studio, exécution
  await p.evaluate(() => App.go('crm-campaigns', 'validation')); await wait(); await shot('71-a-valider');
  await ev('ouvrir le studio CMP-002', K(`(function(){ App.actions['cm-open']({ dataset: { id: C.campaign(S, cid, 'CMP-002').id } }); return document.querySelector('.studio-head h2').textContent; })()`));
  await shot('72-studio');
  await ev('autoriser', `(async function(){ document.querySelector('[data-act="cs-approve"]').click(); await new Promise(r => setTimeout(r, 120)); App.modalOk(); await new Promise(r => setTimeout(r, 200)); return Yiel.CRM.campaign(App.S, App.cid(), 'CMP-002').status; })()`);
  await ev('moteur : jusqu’au 26/10', K(`(function(){ C.tick(S, cid, '2026-10-26T12:00'); App.render(); return C.stats(S, cid, C.campaign(S, cid, 'CMP-002')).sent + ' envoyés'; })()`));
  await shot('73-execution');
  await ev('CMP-001 : ajout hors périmètre → revalidation', K(`(function(){ const c = C.campaign(S, cid, 'CMP-001'); App.ui.v.cmpId = c.id; C.saveCampaign(S, cid, { id: c.id, extraIds: [d.contacts.find(x => x.lastName === 'EKWA').id] }); App.render(); return c.status + ' v' + c.version + ' · ' + (document.querySelector('.callout.warn') ? 'bandeau affiché' : 'pas de bandeau'); })()`));
  await shot('74-revalidation');
  await ev('arrêt d’urgence', K(`(async function(){ const c = C.campaign(S, cid, 'CMP-002'); App.ui.v.cmpId = c.id; App.render(); await new Promise(r => setTimeout(r, 100)); const b = document.querySelector('[data-act="cs-suspend"]'); if (!b) return 'pas de bouton'; b.click(); await new Promise(r => setTimeout(r, 120)); document.getElementById('md_r').value = 'Test'; App.modalOk(); await new Promise(r => setTimeout(r, 150)); return c.status; })()`));
  await ev('suspension globale', `(async function(){ document.querySelector('[data-act="cc-gstop"]').click(); await new Promise(r => setTimeout(r, 120)); document.getElementById('md_r').value = 'Test global'; App.modalOk(); await new Promise(r => setTimeout(r, 150)); return !!Yiel.CRM.D(App.S, App.cid()).settings.globalStop; })()`);
  await ev('lever', `(function(){ document.querySelector('[data-act="cc-gstop"][data-on="0"]').click(); return !Yiel.CRM.D(App.S, App.cid()).settings.globalStop; })()`);

  // administration : intégration Google Calendar, test de connexion
  await p.evaluate(() => App.go('crm-admin', 'integrations')); await wait(); await shot('75-integrations');
  await ev('déconnecter Google Calendar', `(function(){ document.querySelector('[data-act="ad-integ"][data-k="gcal"][data-s="deconnecte"]').click(); return Yiel.CRM.D(App.S, App.cid()).integrations.gcal.status; })()`);
  await ev('reconnecter', `(function(){ document.querySelector('[data-act="ad-integ"][data-k="gcal"][data-s="actif"]').click(); return Yiel.CRM.D(App.S, App.cid()).integrations.gcal.status; })()`);
  await p.evaluate(() => App.go('crm-admin', 'securite')); await wait();
  await ev('connexion refusée (salarié)', `(function(){ document.getElementById('au_email').value = 'b.fotso@yielgroup.com'; document.querySelector('[data-act="ad-login"]').click(); return document.getElementById('au_res').textContent; })()`);
  await ev('connexion commerciale', `(function(){ document.getElementById('au_email').value = 'l.mvondo@yielgroup.com'; document.querySelector('[data-act="ad-login"]').click(); return document.getElementById('au_res').textContent; })()`);
  await p.evaluate(() => App.go('crm-notifs')); await wait(); await shot('76-notifications');

  // commerciale : périmètre, pas d'approbation
  await user('u22');
  await p.evaluate(() => App.go('crm-base', 'contacts')); await wait();
  await ev('commerciale : contacts visibles', K(`C.list(S, cid, 'contacts').length + ' / ' + d.contacts.filter(c => !c.deleted).length`));
  await p.evaluate(() => App.go('crm-campaigns', 'liste')); await wait();
  await ev('commerciale : pas de bouton d’autorisation', `!document.querySelector('[data-act="cs-approve"]')`);
  // administrateur technique
  await user('u25');
  await ev('admin CRM : navigation', `[...document.querySelectorAll('.nav .mod span:first-of-type')].map(x => x.textContent).filter(Boolean).join(', ')`);
  await ev('admin CRM : aucun contact', K(`C.list(S, cid, 'contacts').length`));
  // marketing
  await user('u24'); await ev('marketing : page d’accueil', `App.ui.page`);

  // téléphone
  await user('u20'); await p.setViewportSize({ width: 390, height: 844 }); await wait(250);
  for (const [pg, tab] of [['crm-cockpit'], ['crm-search', 'recherche'], ['crm-pipeline', 'colonnes'], ['crm-agenda', 'semaine'], ['crm-campaigns', 'liste'], ['crm-base', 'contacts'], ['crm-admin', 'utilisateurs']]) {
    await p.evaluate(([pg, tab]) => App.go(pg, tab || undefined), [pg, tab]); await wait(220);
    const ov = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    log.push('mobile ' + pg + ' débordement ' + ov + ' px'); if (ov > 2) errs.push('Débordement horizontal ' + pg + ' : ' + ov + ' px');
  }
  await p.evaluate(() => App.go('crm-cockpit')); await wait(); await shot('77-mobile-cockpit');
  await ev('mobile : studio', K(`(function(){ App.actions['cm-open']({ dataset: { id: C.campaign(S, cid, 'CMP-001').id } }); return document.documentElement.scrollWidth - document.documentElement.clientWidth; })()`));
  await shot('78-mobile-studio');

  console.log(log.join('\n'));
  console.log('\n' + (errs.length ? errs.length + ' erreur(s) :\n' + errs.join('\n') : 'Aucune erreur.'));
  await b.close(); process.exit(errs.length ? 1 : 0);
})();

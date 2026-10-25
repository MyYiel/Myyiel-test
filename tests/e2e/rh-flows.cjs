// Parcours navigateur · Temps & présence, Congés & absences, Stocks (Playwright) : node app/tests/e2e/rh-flows.js [dossier-captures]
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
  const ev = async (label, js) => { try { const r = await p.evaluate(js); log.push(label + ' → ' + (r === undefined ? 'ok' : JSON.stringify(r))); } catch (e) { errs.push(label + ' : ' + e.message); } await p.waitForTimeout(120); };
  const bad = async (label) => { const t = await p.$$eval('.callout.warn', cs => cs.map(c => c.textContent).filter(x => /Erreur d’affichage/.test(x))); if (t.length) errs.push(label + ' : ' + t[0]); };
  const shot = async (n) => { if (shots) await p.screenshot({ path: path.join(shots, n + '.png') }); };
  const user = async (id) => ev('utilisateur ' + id, `(function(){ const u = App.S.users.find(x => x.id === '${id}'); App.S.meta.currentUser = { id: u.id, name: u.name, role: u.role }; App.render(); return u.name + ' → ' + App.ui.page; })()`);
  const toasts = async () => p.$$eval('#toasts .toast', ts => ts.map(t => t.textContent).slice(-2));

  // 1. Navigation en accordéon
  await ev('nav modules', `document.querySelectorAll('.nav .mod').length`);
  await ev('ouvrir Achats', `(function(){ document.querySelector('[data-act="nav-toggle"][data-k="achats"]').click(); return !document.getElementById('sub_achats').hidden; })()`);
  await ev('sous-onglet Échéancier', `(function(){ document.querySelector('#sub_achats [data-tab="echeancier"]').click(); return App.ui.page + '/' + App.ui.tabs.achats; })()`);
  await shot('10-nav');

  // 2. GTA en tant que DRH
  await user('u6');
  for (const [pg, tab] of [['gta', 'vue'], ['gta', 'pointages'], ['gta', 'controles'], ['gta-missions', 'live'], ['gta-missions', 'ordres'], ['gta-feuilles', null], ['gta-param', 'sites'], ['gta-param', 'affectations'], ['gta-param', 'regles'], ['gta-param', 'integrations'], ['abs', 'planning'], ['abs', 'demandes'], ['abs', 'validations'], ['abs', 'soldes'], ['abs-param', 'motifs'], ['abs-param', 'circuits'], ['abs-param', 'feries'], ['abs-param', 'regles']]) {
    await p.evaluate(([pg, tab]) => App.go(pg, tab || undefined), [pg, tab]); await p.waitForTimeout(150); await bad(pg + '/' + tab);
    if (pg === 'gta' && tab === 'vue') await shot('11-presences');
    if (pg === 'gta-missions' && tab === 'live') await shot('12-missions');
    if (pg === 'abs' && tab === 'planning') await shot('13-planning');
    if (pg === 'abs' && tab === 'validations') await shot('14-validations');
    if (pg === 'abs-param' && tab === 'motifs') await shot('15-motifs');
  }
  await p.evaluate(() => App.go('gta', 'pointages'));
  await ev('ouvrir un pointage à vérifier', `(function(){ const r = document.querySelector('[data-act="pt-open"]'); r.click(); return document.querySelector('.drawer h2').textContent; })()`);
  await shot('16-pointage');
  await ev('valider le pointage', `(async function(){ document.querySelector('[data-act="pt-review"][data-d="valider"]').click(); await new Promise(r=>setTimeout(r,80)); document.getElementById('md_c').value='Téléphone remplacé'; App.modalOk(); await new Promise(r=>setTimeout(r,120)); return Y_count(); function Y_count(){ return Yiel.GTA.D(App.S, App.cid()).punches.filter(p=>p.status==='a_verifier').length; } })()`);
  await ev('horloge +60 min', `(function(){ document.querySelector('[data-act="gta-adv"][data-min="60"]').click(); return Yiel.GTA.now(App.S, App.cid()); })()`);
  await p.evaluate(() => App.go('gta-missions', 'live'));
  await ev('ouvrir mission', `(function(){ document.querySelector('.cmmap .dot').dispatchEvent(new MouseEvent('click', {bubbles:true})); return document.querySelector('.drawer h2').textContent; })()`);
  await shot('17-mission');
  await ev('nouvel ordre de mission', `(function(){ App.closeDrawer(true); App.actions['ms-new'](); document.querySelector('.ms-emp').checked = true; document.getElementById('ff_label').value = 'Audit test'; document.getElementById('ff_toSite').value = 'CL-KRIBI'; App.formSubmit(); return Yiel.GTA.D(App.S, App.cid()).missions[0].ref; })()`);
  await ev('site + QR', `(function(){ App.go('gta-param','sites'); document.querySelector('[data-act="site-open"]').click(); return !!document.getElementById('qr_box'); })()`);

  // 3. Le salarié pointe et demande un congé
  await user('u9');
  await ev('page salarié', `App.ui.page + ' · modules ' + document.querySelectorAll('.nav .mod').length`);
  await p.evaluate(() => App.go('moi', 'pointage'));
  await ev('lien de départ', `(function(){ document.querySelector('[data-act="ph-link"][data-kind="out"]').click(); return document.querySelectorAll('.bub').length; })()`);
  await ev('ouvrir le lien', `(function(){ const b = [...document.querySelectorAll('.ph-link')].filter(x=>!x.disabled).pop(); b.click(); return App.ui.v.phone.step; })()`);
  await ev('scénario fausse localisation', `(function(){ document.querySelector('[data-act="ph-scen"][data-v="fake"]').click(); document.querySelector('[data-act="ph-send"]').click(); const p = Yiel.GTA.D(App.S, App.cid()).punches.slice(-1)[0]; return p.status + ' ' + p.score; })()`);
  await shot('18-whatsapp');
  await ev('demande de congé', `(function(){ App.go('moi','absences'); App.actions['abs-new']({dataset:{}}); document.querySelector('input[name=abs_t][value="CP"]').checked = true; document.getElementById('ff_start').value='2026-12-01'; document.getElementById('ff_end').value='2026-12-02'; App.formLive(); App.formSubmit(); return Yiel.Abs.D(App.S, App.cid()).requests[0].ref + ' ' + Yiel.Abs.D(App.S, App.cid()).requests[0].status; })()`);
  await shot('19-mes-absences');
  for (const t of ['missions', 'bulletins', 'infos']) { await p.evaluate(t => App.go('moi', t), t); await p.waitForTimeout(120); await bad('moi/' + t); }
  await ev('voir son bulletin', `(function(){ App.go('moi','bulletins'); const b = document.querySelector('[data-act="slip-view"]'); if (!b) return 'aucun'; b.click(); return document.querySelector('.drawer h2') ? document.querySelector('.drawer h2').textContent : 'refusé'; })()`);

  // 4. Le N+1 valide, le gestionnaire notifie
  await user('u8');
  await p.evaluate(() => { App.closeDrawer(true); App.go('abs', 'validations'); });
  await ev('N+1 approuve', `(async function(){ const r = Yiel.Abs.D(App.S, App.cid()).requests[0]; App.actions['abs-decide']({dataset:{id:r.id, d:'approve'}}); await new Promise(x=>setTimeout(x,80)); App.modalOk(); await new Promise(x=>setTimeout(x,120)); return r.status; })()`);
  await ev('manager · feuilles de temps', `(function(){ App.go('gta-feuilles'); return document.querySelectorAll('#main table.t tbody tr').length; })()`);
  await user('u5');
  await ev('gestionnaire notifie', `(async function(){ const r = Yiel.Abs.D(App.S, App.cid()).requests[0]; App.actions['abs-notify']({dataset:{id:r.id}}); await new Promise(x=>setTimeout(x,80)); document.querySelector('[data-act="abs-notify-go"]').click(); await new Promise(x=>setTimeout(x,120)); return r.status + ' · ' + (r.notified && r.notified.channels.join(',')); })()`);

  // 5. Feuilles de temps → paie
  await user('u7');
  await ev('DAF valide la feuille de G. Tabi', `(async function(){ App.go('gta-feuilles'); const e = Yiel.Paie.emp(App.S, App.cid(), 'YG0016'); App.actions['sh-open']({dataset:{id:e.id}}); await new Promise(x=>setTimeout(x,100)); const m = document.querySelector('[data-act="pt-manual"]'); if (m) { m.click(); await new Promise(x=>setTimeout(x,80)); document.getElementById('ff_time').value='16:40'; document.getElementById('ff_comment').value='Oubli de pointage'; App.formSubmit(); } await new Promise(x=>setTimeout(x,100)); App.actions['sh-validate']({dataset:{emp:e.id}}); await new Promise(x=>setTimeout(x,80)); App.modalOk(); await new Promise(x=>setTimeout(x,120)); return Yiel.GTA.sheet(App.S, App.cid(), e, '2026-10').state.status; })()`);
  await shot('20-feuilles');
  await user('u5');
  await ev('transmission à la paie', `(async function(){ App.go('gta-feuilles'); App.actions['gta-export'](); await new Promise(x=>setTimeout(x,80)); App.modalOk(); await new Promise(x=>setTimeout(x,150)); return Yiel.GTA.D(App.S, App.cid()).exports[0].events; })()`);

  // 6. Stocks
  await user('u2');
  for (const t of ['articles', 'mouvements', 'inventaires', 'valorisation', 'depots']) { await p.evaluate(t => App.go('stocks', t), t); await p.waitForTimeout(120); await bad('stocks/' + t); if (t === 'articles') await shot('21-stocks'); if (t === 'valorisation') await shot('22-variation'); }
  await ev('entrée en stock', `(function(){ App.go('stocks','articles'); App.actions['stk-move']({dataset:{type:'entree', art:'TAB-10'}}); document.getElementById('ff_qty').value='5'; document.getElementById('ff_unitCost').value='99000'; App.formSubmit(); return Yiel.Stock.position(App.S, App.cid(), 'TAB-10', 'MAG-DLA', '9999-12-31').qty; })()`);
  await ev('inventaire en cours', `(function(){ App.go('stocks','inventaires'); const c = Yiel.Stock.D(App.S, App.cid()).counts.find(x=>x.status==='en_cours'); App.actions['cnt-open']({dataset:{id:c.id}}); return document.querySelectorAll('.drawer input.num').length; })()`);
  await shot('23-comptage');
  await ev('variation de stocks', `(async function(){ App.closeDrawer(true); App.go('stocks','valorisation'); const b = document.querySelector('[data-act="stk-var"]'); b.click(); await new Promise(x=>setTimeout(x,80)); App.modalOk(); await new Promise(x=>setTimeout(x,120)); return Yiel.net(App.S, App.cid(), '311'); })()`);
  await ev('clôture · étape inventaire', `(function(){ App.go('cloture'); return !!document.querySelector('.page'); })()`);

  // 7. Téléphone
  await p.setViewportSize({ width: 400, height: 860 });
  await user('u9');
  await p.evaluate(() => App.go('moi', 'pointage'));
  const ov = await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  log.push('mobile débordement : ' + ov);
  await ev('menu mobile', `(function(){ document.querySelector('[data-act="nav-mobile"]').click(); return document.querySelector('.rail').classList.contains('open'); })()`);
  await shot('24-mobile-menu');
  for (const pg of ['abs', 'gta', 'gta-missions', 'stocks']) { await user('u6'); await p.evaluate(pg => App.go(pg), pg); await p.waitForTimeout(100); const o = await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1); if (o) errs.push('débordement mobile ' + pg); }
  await user('u6'); await p.evaluate(() => App.go('gta-missions', 'live')); await shot('25-mobile-missions');

  log.push('toasts : ' + JSON.stringify(await toasts()));
  console.log(log.join('\n'));
  console.log('---ERRORS---\n' + (errs.join('\n') || 'none'));
  await b.close();
})();

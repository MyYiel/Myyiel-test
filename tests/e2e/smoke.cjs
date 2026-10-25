// Parcours de bout en bout (Playwright) : npm i -D playwright puis node app/tests/e2e/smoke.js
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_|net::/.test(m.text())) errs.push('CONSOLE ' + m.text()); });
  await p.route(/^https?:\/\/(?!localhost)/, r => r.abort());
  await p.goto((process.env.BASE_URL || 'http://localhost:3000') + '/');
  await p.waitForSelector('.rail');
  const pages = await p.evaluate(() => App.NAV.flatMap(g => g[1].map(n => n[0])));
  // Les routes /[page] (src/lib/pages.ts) doivent couvrir exactement les écrans enregistrés.
  const keys = [...require('fs').readFileSync(require('path').resolve(__dirname, '../../src/lib/pages.ts'), 'utf8').matchAll(/^  '([^']+)',$/gm)].map(m => m[1]);
  const reg = await p.evaluate(() => Object.keys(App.pages));
  if (keys.slice().sort().join() !== reg.slice().sort().join()) errs.push('pages.ts ≠ App.pages : ' + keys.filter(k => !reg.includes(k)).concat(reg.filter(k => !keys.includes(k))).join(', '));
  // Liens directs : chaque route répond et affiche l'écran demandé.
  for (const k of keys) { const r = await p.request.get((process.env.BASE_URL || 'http://localhost:3000') + '/' + k); if (r.status() !== 200) errs.push('GET /' + k + ' → ' + r.status()); }
  const r404 = await p.request.get((process.env.BASE_URL || 'http://localhost:3000') + '/inconnu'); if (r404.status() !== 404) errs.push('/inconnu devrait renvoyer 404 : ' + r404.status());
  for (const pg of pages) {
    await p.evaluate(x => App.go(x), pg);
    const tabs = await p.$$eval('.tabs button', bs => bs.map(b => b.dataset.tab));
    for (const t of (tabs.length ? tabs : [null])) {
      if (t) await p.evaluate(([pg, t]) => { App.ui.tabs[pg] = t; App.render(); }, [pg, t]);
      const bad = await p.$$eval('.callout.warn', cs => cs.map(c => c.textContent).filter(x => /Erreur d’affichage/.test(x)));
      if (bad.length) errs.push(pg + '/' + t + ': ' + bad[0]);
      // sub-variations: segs & filters
      const segs = await p.$$eval('.page [data-act="setv"]', bs => bs.map(b => [b.dataset.k, b.dataset.val]));
      for (const [k, v] of segs.slice(0, 30)) {
        await p.evaluate(([k, v]) => { App.ui.v[k] = v === 'true' ? true : v === 'false' ? false : v; App.render(); }, [k, v]);
        const bad2 = await p.$$eval('.callout.warn', cs => cs.map(c => c.textContent).filter(x => /Erreur d’affichage/.test(x)));
        if (bad2.length) errs.push(pg + '/' + t + ' ' + k + '=' + v + ': ' + bad2[0]);
      }
    }
  }
  console.log(errs.length ? errs.join('\n') : 'AUCUNE ERREUR');
  await b.close();
})();

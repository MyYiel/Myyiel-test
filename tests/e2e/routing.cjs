// Routage Next.js, exports (PDF/Excel via npm), QR : node tests/e2e/routing.cjs   (BASE_URL=http://localhost:3000)
const { chromium } = require('playwright');
(async () => {
  const BASE = process.env.BASE_URL || 'http://localhost:3000';
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const p = await ctx.newPage();
  const errs = [], log = [];
  const check = (label, cond) => { log.push((cond ? '✓ ' : '✗ ') + label); if (!cond) errs.push(label); };
  p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::/.test(m.text())) errs.push('CONSOLE ' + m.text()); });
  const tab = () => p.evaluate(() => App.ui.tabs[App.ui.page]);
  const path = () => p.evaluate(() => location.pathname + location.search);

  // lien direct avec onglet
  await p.goto(BASE + '/ventes?tab=devis'); await p.waitForSelector('.rail .mod');
  check('lien direct /ventes?tab=devis : page', await p.evaluate(() => App.ui.page) === 'ventes');
  check('lien direct : onglet devis actif', (await p.$eval('.tabs button.on', e => e.dataset.tab)) === 'devis');
  // navigation latérale → l'URL suit, sans rechargement
  await p.evaluate(() => { window.__same = true; });
  await p.click('.rail .mod[data-k="achats"]'); await p.click('.rail .sub button[data-page="achats"][data-tab="echeancier"]');
  check('clic menu : URL /achats?tab=echeancier', (await path()) === '/achats?tab=echeancier');
  check('pas de rechargement complet', await p.evaluate(() => window.__same === true));
  await p.click('.tabs button[data-tab="factures"]');
  check('onglet : URL mise à jour', (await path()) === '/achats?tab=factures');
  // retour arrière (un changement d'onglet remplace l'entrée d'historique ; un changement d'écran en ajoute une)
  await p.goBack(); await p.waitForTimeout(300);
  check('retour arrière : /ventes?tab=devis', (await path()) === '/ventes?tab=devis' && await p.evaluate(() => App.ui.page) === 'ventes');
  check('retour arrière : onglet devis affiché', (await p.$eval('.tabs button.on', e => e.dataset.tab)) === 'devis');
  await p.goForward(); await p.waitForTimeout(300);
  check('avance : /achats?tab=factures', (await path()) === '/achats?tab=factures' && await p.evaluate(() => App.ui.page) === 'achats');
  // racine → dernière page consultée (reprise), sinon tableau de bord
  await p.goto(BASE + '/'); await p.waitForSelector('.rail .mod'); await p.waitForTimeout(400);
  check('racine → un écran connu', await p.evaluate(() => !!App.pages[location.pathname.slice(1)]));
  check('titre de l’onglet', /myyiel Finance & Paie/.test(await p.title()));
  // état de démonstration persisté (localStorage) : une écriture créée survit au rechargement
  const n0 = await p.evaluate(() => App.D().entries.length);
  await p.evaluate(() => { const Y = Yiel; const d = App.D(); App.run(() => Y.saveDraft(App.S, App.cid(), { journal: 'OD', date: App.today(), label: 'Brouillon test', lines: [] }), 'ok'); });
  await p.waitForTimeout(500); await p.reload(); await p.waitForSelector('.rail .mod');
  check('persistance locale après rechargement', (await p.evaluate(() => App.D().entries.length)) === n0 + 1);

  // exports : PDF (jsPDF 4 + autotable 5) et Excel (xlsx)
  await p.goto(BASE + '/livres?tab=balance'); await p.waitForSelector('.rail .mod'); await p.waitForTimeout(300);
  const dl = async (sel) => { const [d] = await Promise.all([p.waitForEvent('download', { timeout: 15000 }), p.click(sel)]); const s = await d.createReadStream(); const chunks = []; for await (const c of s) chunks.push(c); return { name: d.suggestedFilename(), buf: Buffer.concat(chunks) }; };
  const pdf = await dl('[data-act="tbl-export"][data-fmt="pdf"]');
  check('export PDF : en-tête %PDF et taille > 5 Ko', pdf.buf.slice(0, 4).toString() === '%PDF' && pdf.buf.length > 5000);
  const xl = await dl('[data-act="tbl-export"][data-fmt="xlsx"]');
  check('export Excel : archive xlsx (PK)', xl.buf.slice(0, 2).toString() === 'PK' && /\.xlsx$/.test(xl.name));
  // PDF métier (bulletin FR/EN, état récapitulatif, facture, pièce, bordereau de virement)
  await p.goto(BASE + '/paie-bulletins'); await p.waitForSelector('.rail .mod'); await p.waitForTimeout(300);
  const res = await p.evaluate(async () => {
    const saved = []; App.save = (n, d) => { saved.push([n, d.size || d.length]); };
    const P = Yiel.Paie, S = App.S, cid = App.cid(), pd = P.D(S, cid), d = App.D();
    const key = Object.keys(pd.periods).find(k => Object.keys(pd.periods[k].slips || {}).length), id = Object.keys(pd.periods[key].slips)[0];
    const A = App.actions, out = [];
    const run = (l, f) => { try { f(); out.push(l); } catch (e) { out.push(l + ' ERREUR ' + e.message); } };
    run('bulletin', () => A['slip-pdf']({ dataset: { id, k: key } }));
    App.ui.v.slipLang = 'en'; run('bulletin EN', () => A['slip-pdf']({ dataset: { id, k: key } }));
    run('état récapitulatif', () => A['pp-livre-pdf']({ dataset: {} }));
    run('facture', () => A['doc-pdf']({ dataset: { id: d.docs.find(x => x.type === 'FA' && x.status === 'emitted').id } }));
    run('pièce', () => A['entry-pdf']({ dataset: { id: d.entries.find(e => e.status === 'validated').id } }));
    run('bordereau', () => A['ov-pdf']({ dataset: { id: pd.bankOrders[0].id } }));
    await new Promise(r => setTimeout(r, 800));
    return { out, saved };
  });
  check('PDF métier : 6 fichiers générés sans erreur', res.out.every(x => !/ERREUR/.test(x)) && res.saved.length === 6 && res.saved.every(s => s[1] > 5000));
  log.push('  ' + res.saved.map(s => s[0] + ' (' + Math.round(s[1] / 1024) + ' Ko)').join(', '));
  // QR (fin-common, qrcode npm)
  await p.goto(BASE + '/fin-factu?tab=cycle'); await p.waitForSelector('.rail .mod'); await p.waitForTimeout(500);
  await p.evaluate(() => { const d = document.createElement('div'); d.setAttribute('data-qr', 'https://example.org/pay/1'); d.setAttribute('data-size', '96'); document.body.appendChild(d); App.qrFill(); });
  await p.waitForTimeout(300);
  check('QR code dessiné (canvas)', await p.evaluate(() => { const c = document.querySelector('[data-qr] canvas'); return !!c && c.width >= 96; }));

  console.log(log.join('\n')); console.log(errs.length ? '---ERREURS---\n' + errs.join('\n') : 'AUCUNE ERREUR');
  await b.close(); process.exit(errs.length ? 1 : 0);
})();

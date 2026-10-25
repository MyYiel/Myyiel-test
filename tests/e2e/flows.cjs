// Parcours de bout en bout (Playwright) : création de chaque objet, imports, clôture simulée, exports, droits. node app/tests/e2e/flows.js
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [], log = [];
  p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::/.test(m.text())) errs.push('CONSOLE ' + m.text()); });
  await p.route(/^https?:\/\/(?!localhost)/, r => r.abort());
  await p.goto((process.env.BASE_URL || 'http://localhost:3000') + '/');
  await p.waitForSelector('.rail');
  await p.evaluate(() => { window.__toasts = []; const o = App.toast; App.toast = (m, t) => { window.__toasts.push((t || '') + ': ' + m); o(m, t); }; });
  const form = async (name, act, ds, vals) => {
    const r = await p.evaluate(async ([act, ds, vals]) => {
      window.__toasts = [];
      App.actions[act]({ dataset: ds || {} });
      await new Promise(r => setTimeout(r, 60));
      if (!App._form) return 'NO FORM';
      for (const k in vals) { const el = document.getElementById('ff_' + k); if (!el) return 'missing field ' + k; if (el.type === 'checkbox') el.checked = !!vals[k]; else el.value = vals[k]; }
      App.formLive();
      App.formSubmit();
      await new Promise(r => setTimeout(r, 80));
      const err = document.getElementById('ff_err');
      return (App._form ? 'FORM ERROR: ' + (err ? err.textContent : '?') : 'OK') + ' | ' + window.__toasts.join(' / ');
    }, [act, ds, vals]);
    log.push(name + ' → ' + r);
  };
  const modal = async (name, fn, vals) => {
    const r = await p.evaluate(async ([fn, vals]) => {
      window.__toasts = [];
      eval(fn);
      await new Promise(r => setTimeout(r, 60));
      if (!App._modal) return 'NO MODAL | ' + window.__toasts.join(' / ');
      for (const k in (vals || {})) { const el = document.getElementById(k); if (el) el.value = vals[k]; }
      App.modalOk();
      await new Promise(r => setTimeout(r, 120));
      return (App._modal ? 'MODAL STILL OPEN: ' + document.getElementById('md_err').textContent : 'OK') + ' | ' + window.__toasts.join(' / ');
    }, [fn, vals]);
    log.push(name + ' → ' + r);
  };
  const act = async (name, fn) => { const r = await p.evaluate(async fn => { window.__toasts = []; eval(fn); await new Promise(r => setTimeout(r, 100)); return window.__toasts.join(' / ') || '(no toast)'; }, fn); log.push(name + ' → ' + r); };

  await form('account-new', 'account-new', {}, { num: '60551', label: 'Fournitures informatiques', labelEn: 'IT supplies' });
  await form('account-new bad', 'account-new', {}, { num: '99', label: 'x' });
  await form('tiers-new', 'tiers-new', { type: 'client' }, { name: 'Boulangerie du Littoral SARL', niu: 'M012345678901A', momo: '+237 677000001', momoOp: 'MTN' });
  await form('tiers-edit', 'tiers-edit', { id: 'C0001' }, { city: 'Yaoundé' });
  await form('asset-new', 'asset-new', {}, { label: 'Serveur NAS', value: '3 500 000', years: '4', serviceDate: '2026-03-01', acqDate: '2026-03-01' });
  await form('bank-new', 'bank-new', {}, { label: 'Ecobank', kind: 'bank', account: '5213', provider: 'Ecobank', syncMode: 'import' });
  await form('transfer-new', 'transfer-new', {}, { amount: '500000', date: '2026-10-21' });
  await form('rule-new', 'rule-new', {}, { label: 'Frais SMS', contains: 'SMS', account: '631' });
  await form('sec-new', 'sec-new', {}, { code: 'EXP', label: 'Export' });
  await form('key-new bad', 'key-new', {}, { label: 'Clé test', from: 'STR', p_CNS: '50', p_LOG: '40' });
  await form('tax-new', 'tax-new', {}, { code: 'TVA10', label: 'Taux réduit', rate: '10', principal: '9', cac: '1' });
  await form('jr-new', 'jr-new', {}, { code: 'VTE2', label: 'Ventes export', type: 'sale', seqFormat: 'VTE2-{YYYY}-{0000}' });
  await form('user-new', 'user-new', {}, { name: 'Test User', email: 'test@exemple.cm' });
  await form('pay-new', 'pay-new', {}, { month: '10', date: '2026-10-31', gross: '11 000 000', irpp: '1 100 000' });
  await form('cash-count', 'cash-count', { id: await p.evaluate(() => App.D().bankAccounts.find(b => b.kind === 'cash').id) }, { n0: '10' });
  await form('item-new', 'item-new', {}, { code: 'AUD-J', label: 'Journée d’audit', price: '600000', account: '7062' });
  await act('dep-run-all', "App.actions['dep-run-all']()");
  await act('rp-auto', "App.ui.v.rpBank=null; App.actions['rp-auto']()");
  await act('let-auto', "App.ui.v.letAcc='4111'; App.actions['let-auto']()");
  await act('audit-verify', "App.actions['audit-verify']()");
  const m = await p.evaluate(() => { for (let m = 1; m <= 10; m++) { const r = Yiel.vatReturn(App.S, App.cid(), 2026, m); if (r.status === 'computed') return m; } return 0; });
  await modal('vat-liq ' + m, "App.actions['vat-liq']({dataset:{m:'" + m + "'}})");
  await act('tiers-open', "App.actions['tiers-open']({dataset:{id:'C0001'}})");
  await act('asset-open', "App.actions['asset-open']({dataset:{id:App.D().assets[0].id}})");
  await act('account-edit', "App.actions['account-edit']({dataset:{id:'5211'}})");
  await act('vat-open', "App.actions['vat-open']({dataset:{m:'3'}})");
  await act('entry-open', "App.actions['entry-open']({dataset:{id:App.D().entries.find(e=>e.status==='validated').id}})");
  await act('close', "App.closeDrawer(true)");
  // imports with samples
  for (const t of ['accounts', 'tiers', 'items', 'entries', 'bank', 'assets']) {
    const r = await p.evaluate(async t => {
      window.__toasts = []; App.go('imports', 'import'); App.ui.v.imp = null; App.actions['imp-type']({ dataset: { t } });
      const s = App.ui.v.imp; if (t === 'bank') s.bankId = App.D().bankAccounts[0].id;
      App.actions['imp-sample'](); App.actions['imp-dry']();
      const dry = JSON.stringify({ ok: s.dry && s.dry.ok, err: s.dry && s.dry.errors.slice(0, 2) });
      if (s.dry && s.dry.ok) { App.actions['imp-run'](); await new Promise(r => setTimeout(r, 50)); if (App._modal) App.modalOk(); }
      return dry + ' | ' + window.__toasts.join(' / ');
    }, t);
    log.push('import ' + t + ' → ' + r);
  }
  // closing simulation
  await act('sim-start', "App.startSim(); App.ui.year=2026");
  await form('inv-new', 'inv-new', { t: 'CCA' }, { account: '622', amount: '1200000', label: 'Loyer janvier payé d’avance' });
  const st = await p.evaluate(() => Yiel.closingChecks(App.S, App.cid(), 2026).filter(c => c.level === 'block').map(c => c.label + ':' + c.detail));
  log.push('blockers: ' + JSON.stringify(st));
  await p.evaluate(() => { App.D().entries = App.D().entries.filter(e => !(e.status === 'draft' && e.date.startsWith('2026'))); });
  await act('is-post', "App.actions['is-post']()"); await p.evaluate(async () => { await new Promise(r => setTimeout(r, 50)); if (App._modal) App.modalOk(); await new Promise(r => setTimeout(r, 50)); });
  await modal('cl-lock', "App.actions['cl-lock']()", { md_req: 'CLÔTURER 2026' });
  await modal('cl-an', "App.actions['cl-an']()");
  await form('cl-aff', 'cl-aff', {}, {});
  const aff = await p.evaluate(() => { const cs = Yiel.closingState(App.S, App.cid(), 2026); return cs; });
  log.push('closing state: ' + JSON.stringify(aff));
  await p.evaluate(() => { App.go('cloture'); App.ui.v.clStep = 'an'; App.render(); });
  await act('sim-end', "App.endSim(false)");
  // exports
  for (const k of ['balance', 'ecritures', 'tiers', 'plan', 'factures', 'immos', 'audit', 'backup', 'fec']) await act('export ' + k, "App.actions['exp-run']({dataset:{k:'" + k + "'}})");
  await act('reader role', "App.actions['switch-user']({value:'u4'})");
  await form('reader account-new', 'account-new', {}, {});
  console.log(log.join('\n'));
  console.log('---ERRORS---\n' + (errs.join('\n') || 'none'));
  await b.close();
})();

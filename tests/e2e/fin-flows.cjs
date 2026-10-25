// Parcours navigateur · Module 4 trésorerie, facturation, paiements, anti-fraude (Playwright) : node app/tests/e2e/fin-flows.js [dossier-captures]
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
  const user = async (id) => ev('utilisateur ' + id, `(function(){ const u = App.S.users.find(x => x.id === '${id}'); App.S.meta.currentUser = { id: u.id, name: u.name, role: u.role }; App.render(); return u.name; })()`);
  const click = (sel) => `(function(){ const e = document.querySelector('${sel}'); if (!e) throw new Error('introuvable ${sel.replace(/'/g, '')}'); e.click(); return true; })()`;
  const toast = async () => (await p.$$eval('#toasts .toast', ts => ts.map(t => t.textContent))).slice(-1)[0] || '';
  const F = (js) => `(function(){ const F = Yiel.Fin, S = App.S, cid = App.cid(), d = F.D(S, cid); return ${js}; })()`;

  // 1. toutes les pages du module 4 (DAF)
  await user('u7');
  await ev('section module 4 dans la navigation', `[...document.querySelectorAll('.nav .grp')].map(g => g.textContent).join(' | ')`);
  const PAGES = [['tresor', 'pilotage'], ['tresor', 'prevision'], ['tresor', 'comptes'], ['fin-factu', 'cycle'], ['fin-factu', 'modeles'], ['fin-factu', 'conformite'], ['fin-encaiss', 'transactions'], ['fin-encaiss', 'liens'], ['fin-encaiss', 'justificatifs'], ['fin-encaiss', 'verifier'], ['fin-relances', 'plan'], ['fin-relances', 'promesses'], ['fin-relances', 'historique'], ['fin-inbox', 'a_traiter'], ['fin-inbox', 'tous'], ['fin-pay', 'echeancier'], ['fin-pay', 'propositions'], ['fin-pay', 'salaires'], ['fin-tiers', 'fournisseur'], ['fin-tiers', 'client'], ['fin-tiers', 'import'], ['fin-rappro', null], ['fin-fraude', 'alertes'], ['fin-fraude', 'coordonnees'], ['fin-fraude', 'vigilance'], ['fin-fraude', 'verifier'], ['fin-fraude', 'journal'], ['fin-param', 'circuits'], ['fin-param', 'prestataires'], ['fin-param', 'relances'], ['fin-param', 'offre']];
  for (const [pg, tab] of PAGES) { await p.evaluate(([pg, tab]) => App.go(pg, tab || undefined), [pg, tab]); await wait(160); await bad(pg + '/' + tab); }
  log.push('pages parcourues : ' + PAGES.length);
  await p.evaluate(() => App.go('tresor', 'pilotage')); await wait(200); await shot('40-tresorerie');

  // 2. répertoire fournisseurs en cartes + fiche
  await p.evaluate(() => App.go('fin-tiers', 'fournisseur')); await wait();
  await ev('cartes fournisseurs', `document.querySelectorAll('.tcard2').length`);
  await ev('tuiles de catégories', `document.querySelectorAll('.cat-tiles .ct').length`);
  await shot('41-repertoire');
  await ev('filtre Suspendus / À valider', `(function(){ document.querySelector('[data-k="tfSt"][data-val="a_valider"]').click(); return document.querySelectorAll('.tcard2').length; })()`);
  await ev('retour Tous', click('[data-k="tfSt"][data-val=""]'));
  await ev('ouvrir la fiche Douala Informatique', `(function(){ const b = [...document.querySelectorAll('.tc-name')].find(x => /Douala Informatique/.test(x.textContent)); b.click(); return document.querySelector('.drawer h2').textContent + ' · ' + document.querySelectorAll('.drawer .tabs button').length + ' onglets'; })()`);
  await shot('42-fiche');
  for (const t of ['info', 'contacts', 'docs', 'eval', 'history', 'bills', 'payments', 'notes', 'overview']) await ev('onglet fiche ' + t, `(function(){ document.querySelector('.drawer [data-act="tf-tab"][data-tab="${t}"]').click(); return document.querySelector('.drawer .tabs .on').textContent; })()`);

  // 3. anti-usurpation : demande CHG-0001 refusée après rappel
  await p.evaluate(() => App.go('fin-fraude', 'coordonnees')); await wait();
  await ev('ouvrir CHG-0001', F(`(function(){ const c = d.changes.find(x => x.ref === 'CHG-0001'); App.actions['ff-chg']({ dataset: { id: c.id } }); return document.querySelectorAll('.drawer .ck-list li.bad').length + ' alertes rouges'; })()`));
  await shot('43-quarantaine');
  await ev('refuser après rappel', `(function(){ const s = document.getElementById('fc_contactId'); s.value = s.options[1].value; document.getElementById('fc_result').value = 'refuse'; document.getElementById('fc_comment').value = 'Rappel de M. NANA au numéro du référentiel : aucune demande de changement.'; document.querySelector('[data-act="ff-chg-ok"]').click(); return Yiel.Fin.D(App.S, App.cid()).changes.find(x => x.ref === 'CHG-0001').status; })()`);
  await ev('numéro frauduleux en liste de vigilance', F(`!!F.checkWatch(S, cid, 'momo', '+237 6 00 11 22 33')`));

  // 4. vérificateur numéro / RIB
  await p.evaluate(() => App.go('fin-fraude', 'verifier')); await wait();
  await ev('vérifier le numéro du faux RIB', `(function(){ document.querySelector('[data-act="fw-check-demo"]').click(); return document.querySelector('.verdict b').textContent; })()`);
  await shot('44-verifier');

  // 5. boîte de réception : fausse facture signalée
  await p.evaluate(() => App.go('fin-inbox', 'a_traiter')); await wait();
  await ev('ouvrir IN-0004', F(`(function(){ const i = d.inbox.find(x => x.ref === 'IN-0004'); App.actions['fi-open']({ dataset: { id: i.id } }); return document.querySelector('.drawer .risk').textContent; })()`));
  await shot('45-fausse-facture');
  await ev('signaler la fraude', `(async function(){ document.querySelector('[data-act="fi-reject"][data-fraud]').click(); await new Promise(r => setTimeout(r, 80)); App.modalOk(); await new Promise(r => setTimeout(r, 120)); return Yiel.Fin.D(App.S, App.cid()).inbox.find(x => x.ref === 'IN-0004').status; })()`);
  await ev('valider IN-0001', F(`(function(){ const i = d.inbox.find(x => x.ref === 'IN-0001'); App.actions['fi-open']({ dataset: { id: i.id } }); document.getElementById('fv_account').value = '6055'; document.querySelector('[data-act="fi-validate"]').click(); return i.status + ' ' + i.entry; })()`));

  // 6. facturation : mentions, envoi WhatsApp, page de paiement, confirmation signée et notification falsifiée
  await p.evaluate(() => App.go('fin-factu', 'cycle')); await wait();
  await ev('bannière NIU/RCCM', `!!document.querySelector('[data-act="fx-company"]')`);
  await ev('compléter NIU et RCCM', `(function(){ document.querySelector('[data-act="fx-company"]').click(); document.getElementById('ff_niu').value = 'M022000012345Y'; document.getElementById('ff_rccm').value = 'RC/DLA/2020/B/1000'; App.formSubmit(); return Yiel.company(App.S, App.cid()).niu; })()`);
  await wait(300);
  await ev('ouvrir FA-2026-0067', `(function(){ const x = Yiel.doc(App.S, App.cid(), 'FA-2026-0067'); App.actions['fx-doc']({ dataset: { id: x.id } }); return document.querySelector('.drawer h2').textContent; })()`);
  await shot('46-facture');
  await ev('envoyer WhatsApp', `(async function(){ document.querySelector('[data-act="fx-send"]').click(); await new Promise(r => setTimeout(r, 80)); App.modalOk(); await new Promise(r => setTimeout(r, 200)); return document.querySelector('.drawer h2').textContent; })()`);
  await ev('ouvrir comme le client', click('.drawer [data-act="pay-sim"]'));
  await shot('47-page-paiement');
  await ev('initier MoMo', `(function(){ document.querySelector('[data-act="pp-method"][data-m="momo"]').click(); document.getElementById('pp_phone').value = '+237 6 99 00 00 02'; document.querySelector('[data-act="pp-init"]').click(); return document.querySelector('.pp-wait b') ? document.querySelector('.pp-wait b').textContent : 'pas en attente'; })()`);
  await ev('notification falsifiée', `(function(){ document.querySelector('[data-act="pp-provider"][data-o="forged"]').click(); const x = Yiel.doc(App.S, App.cid(), 'FA-2026-0067'); return Yiel.docPaid(x); })()`);
  log.push('toast : ' + await toast());
  await ev('confirmation signée', `(function(){ document.querySelector('[data-act="pp-provider"][data-o="ok"]').click(); const x = Yiel.doc(App.S, App.cid(), 'FA-2026-0067'); return Yiel.docStatus(App.S, App.cid(), x).label; })()`);
  await shot('48-paiement-confirme');

  // 7. justificatif : vérificateur de faux SMS
  await p.evaluate(() => App.go('fin-encaiss', 'verifier')); await wait();
  await ev('faux SMS', `(function(){ document.querySelector('[data-act="fe-check-demo"]').click(); return document.querySelector('.verdict b').textContent + ' · ' + document.querySelectorAll('.ck-list li.bad').length + ' alertes'; })()`);
  await shot('49-faux-sms');
  await p.evaluate(() => App.go('fin-encaiss', 'justificatifs')); await wait();
  await ev('confirmer le virement par le relevé', F(`(function(){ const pr = d.proofs.find(x => x.ref === 'VIR 4471'); App.actions['fe-proof']({ dataset: { id: pr.id } }); const r = document.querySelector('input[name=pf_line]:checked') || document.querySelector('input[name=pf_line]'); r.checked = true; document.querySelector('[data-act="fe-proof-ok"]').click(); return pr.status; })()`));

  // 8. modèles de facture : assistant d'import
  await p.evaluate(() => App.go('fin-factu', 'modeles')); await wait();
  await shot('50-modeles');
  await ev('assistant A → D', `(function(){ App.actions['ff-tpl-import'](); document.querySelector('[data-act="ff-tpl-demo"]').click(); document.querySelector('[data-act="ff-tpl-next"]').click(); document.querySelector('[data-act="ff-tpl-next"]').click(); const n = document.querySelectorAll('.drawer .iz-n').length; document.querySelector('[data-act="ff-tpl-save"]').click(); return n + ' zones · ' + Yiel.Fin.templates(App.S, App.cid()).length + ' modèles'; })()`);

  // 9. paiements fournisseurs : séparation des tâches
  await user('u2');
  await p.evaluate(() => App.go('fin-pay', 'echeancier')); await wait();
  await ev('proposer Imprimerie (carence)', `(function(){ const cb = [...document.querySelectorAll('.rowsel')]; if (!cb.length) return 'aucune ligne'; cb[0].click(); return App.selected('fp_due').length; })()`);
  await ev('créer la proposition', `(function(){ document.querySelector('[data-act="fp-propose"]').click(); return App.ui.page + '/' + App.ui.tabs['fin-pay']; })()`);
  log.push('toast : ' + await toast());
  await user('u7');
  await p.evaluate(() => App.go('fin-pay', 'propositions')); await wait();
  await ev('ouvrir PAY Douala Informatique', F(`(function(){ const pr = d.proposals.find(x => x.status === 'a_approuver' && Yiel.tiers(S, cid, x.tiersId).code === 'F0002'); App.actions['fp-open']({ dataset: { id: pr.id } }); return pr.ref + ' risque ' + pr.risk.score; })()`));
  await shot('51-paiement-risque');
  await ev('approuver', `(async function(){ document.querySelector('[data-act="fp-decide"][data-d="approuver"]').click(); await new Promise(r => setTimeout(r, 80)); const c = document.getElementById('md_c'); if (c) c.value = 'Montant conforme au contrat de maintenance'; App.modalOk(); await new Promise(r => setTimeout(r, 150)); return document.querySelector('.drawer .chip') ? document.querySelector('.drawer [class*="chip"]').textContent : ''; })()`);
  await ev('paiement bloqué : approbation refusée', F(`(function(){ const pr = d.proposals.find(x => x.status === 'bloquee'); try { F.approve(S, cid, pr.id, 'approuver', 'test'); return 'approuvé ?!'; } catch (e) { return 'refusé : ' + e.message.slice(0, 60); } })()`));

  // 10. rapprochement intelligent
  await p.evaluate(() => App.go('fin-rappro')); await wait();
  await ev('suggestions', `document.querySelectorAll('.sg').length + ' propositions · ' + document.querySelectorAll('.sg-forte').length + ' fortes'`);
  await shot('52-rapprochement');
  await ev('valider la première correspondance forte', `(function(){ const b = document.querySelector('.sg-forte [data-act="rp-apply"]'); b.click(); return document.querySelectorAll('.sg').length; })()`);
  log.push('toast : ' + await toast());

  // 11. relances
  await p.evaluate(() => App.go('fin-relances', 'plan')); await wait();
  await ev('plan de relance', `document.querySelectorAll('#main tbody tr').length + ' lignes'`);
  await shot('53-relances');

  // 12. import du répertoire
  await p.evaluate(() => App.go('fin-tiers', 'import')); await wait();
  await ev('import : exemple', `(function(){ document.querySelector('[data-act="tf-imp-demo"]').click(); return document.querySelectorAll('.map-grid select').length + ' champs'; })()`);
  await ev('import : contrôle', `(function(){ document.querySelector('[data-act="tf-imp-analyze"]').click(); return document.querySelectorAll('#main tbody tr').length + ' lignes analysées'; })()`);
  await shot('54-import');
  await ev('import : création', `(function(){ document.querySelector('[data-act="tf-imp-go"]').click(); return document.querySelector('.callout.ok') ? document.querySelector('.callout.ok b').textContent : 'échec'; })()`);

  // 13. lecteur : aucune action
  await user('u4');
  await p.evaluate(() => App.go('fin-pay', 'echeancier')); await wait();
  await ev('lecteur : pas de sélection', `document.querySelectorAll('.rowsel').length`);
  await ev('lecteur : numéros masqués', `(function(){ App.go('fin-tiers', 'fournisseur'); const b = [...document.querySelectorAll('.tc-name')].find(x => /Imprimerie/.test(x.textContent)); b.click(); return /•••/.test(document.querySelector('.drawer').textContent); })()`);

  // 14. largeur téléphone : aucun débordement horizontal
  await user('u7');
  await p.setViewportSize({ width: 390, height: 844 }); await wait(200);
  for (const [pg, tab] of [['fin-tiers', 'fournisseur'], ['tresor', 'pilotage'], ['fin-rappro', null], ['fin-fraude', 'alertes'], ['fin-factu', 'cycle']]) {
    await p.evaluate(([pg, tab]) => App.go(pg, tab || undefined), [pg, tab]); await wait(180);
    const ov = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    log.push('mobile ' + pg + ' débordement ' + ov + ' px'); if (ov > 2) errs.push('Débordement horizontal ' + pg + ' : ' + ov + ' px');
  }
  await p.evaluate(() => App.go('fin-tiers', 'fournisseur')); await wait(); await shot('55-mobile-repertoire');
  await ev('mobile : page de paiement', `(function(){ const x = Yiel.doc(App.S, App.cid(), 'FA-2026-0066'); App.actions['pay-sim']({ dataset: { id: x.id } }); return !!document.querySelector('.pp'); })()`);
  await shot('56-mobile-paiement');

  console.log(log.join('\n'));
  console.log('\n' + (errs.length ? errs.length + ' erreur(s) :\n' + errs.join('\n') : 'Aucune erreur.'));
  await b.close(); process.exit(errs.length ? 1 : 0);
})();

/*
 * Yiélina · assistante IA RH & paie de myyiel, et centre de notifications.
 * - Avec le runtime Claude (capacité « sample ») : Yiélina comprend la demande en langage naturel et agit via des outils
 *   qui appellent le moteur de paie (mêmes droits que l'utilisateur connecté).
 * - Sans runtime : compréhension locale des demandes courantes (anomalies, heures sup., primes, absences, simulation, échéances).
 * - Dictée vocale via l'API de reconnaissance vocale du navigateur quand elle est disponible.
 */
(function () {
  'use strict';
  var Y = window.Yiel, U = Y.util, P = Y.Paie, App = window.App, esc = App.esc, A = App.actions;
  function S() { return App.S; } function cid() { return App.cid(); }
  var YL = App.yl = { open: false, msgs: [], busy: false, mode: 'local', sample: undefined, ctl: null };

  /* --------------------------------------------------------------- outils */
  function findEmp(q) {
    var d = P.D(S(), cid()), s = String(q || '').trim(); if (!s) return [];
    var m = s.match(/[A-Z]{2}\d{4}/i); if (m) { var e = P.emp(S(), cid(), m[0].toUpperCase()); return e ? [e] : []; }
    var norm = function (x) { return String(x).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }, t = norm(s).split(/[^a-z0-9]+/).filter(function (w) { return w.length > 2; });
    return d.employees.filter(function (e) { var n = norm(e.nom + ' ' + e.prenoms + ' ' + e.poste); return t.some(function (w) { return norm(e.nom) === w || norm(e.prenoms).split(/[- ]/).indexOf(w) > -1; }) || n.indexOf(norm(s)) > -1; });
  }
  function empInfo(e) { var o = { matricule: e.matricule, nom: P.fullName(e), poste: e.poste, service: e.service, site: e.site, convention: e.convention, categorie: e.categorie, contrat: e.contrat, embauche: e.embauche, paiement: e.modePaiement, statut: e.statut }; if (App.can('pay.sensitive')) o.salaire_base = e.sb; return o; }
  var T = {
    lister_anomalies: function () { var p = App.pPeriod(); return { periode: P.monthLabel(p.key), statut: P.STATUS[p.status][0], anomalies: (p.anomalies || []).map(function (a) { return { code: a.code, niveau: a.level, libelle: a.label, matricule: a.matricule, salarie: a.name, detail: a.detail }; }) }; },
    chercher_salarie: function (i) { return findEmp(i.recherche || i.q).slice(0, 8).map(empInfo); },
    resume_paie: function (i) {
      var d = P.D(S(), cid()), k = i && i.periode && d.periods[i.periode] ? i.periode : App.pk(), p = d.periods[k], t = P.totals(S(), cid(), k), sens = App.can('pay.sensitive');
      return { periode: P.monthLabel(k), statut: P.STATUS[p.status][0], bulletins: t.count, brut: sens ? t.brut : 'confidentiel', net_a_payer: sens ? t.net : 'confidentiel', charges_patronales: sens ? t.pat : 'confidentiel', cout_total: sens ? t.cost : 'confidentiel', anomalies_bloquantes: (p.anomalies || []).filter(function (a) { return a.level === 'bloquante'; }).length, ecritures: p.journal ? p.journal.status + ' ' + (p.journal.entries || []).join(', ') : 'non transmises', bulletins_signes: Object.keys(p.slips).filter(function (x) { return p.slips[x].signed; }).length };
    },
    ajouter_variable: function (i) {
      var e = findEmp(i.matricule || i.salarie)[0]; if (!e) throw new Error('Salarié introuvable : ' + (i.matricule || i.salarie));
      var code = String(i.rubrique || '').toUpperCase(), r = P.D(S(), cid()).rubriques.find(function (x) { return x.code === code; }); if (!r) throw new Error('Rubrique inconnue ' + code + ' (HS1, HS2, HS3, HSN, ABS_NP, CONGE, PRIME_REND, PRIME_EXC, RAPPEL, RET_DIV)');
      var qtxt = r.unit ? Number(i.quantite) + ' ' + r.unit : U.fmt(Number(i.montant)) + ' XAF';
      return App.confirm({ title: 'Yiélina propose une saisie', body: '<p>Ajouter <b>' + esc(r.label) + ' · ' + esc(qtxt) + '</b> pour <b>' + esc(P.fullName(e)) + '</b> (' + esc(e.matricule) + ') sur ' + esc(P.monthLabel(App.pk())) + ' ?</p>', ok: 'Ajouter' }).then(function (okd) {
      if (!okd) throw new Error('Saisie refusée par l’utilisateur : rien n’a été ajouté.');
      var v = P.addVar(S(), cid(), App.pk(), e.id, r.unit ? { code: code, qty: Number(i.quantite), note: (i.note || '') + ' · via Yiélina', source: 'saisie' } : { code: code, amount: Number(i.montant), note: (i.note || '') + ' · via Yiélina', source: 'saisie' });
      App.persist(); YL.dirty = true;
      return 'Ajouté : ' + r.label + ' ' + (v.qty ? v.qty + ' ' + r.unit : U.fmt(v.amount) + ' XAF') + ' pour ' + P.fullName(e) + ' (' + e.matricule + ') sur ' + P.monthLabel(App.pk()) + '. Relancez le calcul pour mettre à jour le bulletin.';
      });
    },
    simuler: function (i) {
      var d = P.D(S(), cid()), o = { convention: i.convention || d.conventions[0].code, site: i.site || (d.establishments[0] || {}).code, embauche: App.today(), fixes: {} };
      if (i.transport) o.fixes.IND_TRANSP = Number(i.transport);
      var r = i.net_cible ? P.netToGross(S(), cid(), o, Number(i.net_cible)) : P.simulate(S(), cid(), Object.assign(o, { sb: Number(i.salaire_base) }));
      var g = function (c) { var l = r.lines.find(function (x) { return x.code === c; }); return l ? (l.gain || l.sal || 0) : 0; };
      return { salaire_base: g('SB'), brut: r.totals.brut, cnps_salarie: g('PVID'), irpp: g('IRPP'), cac: g('CAC'), cfc: g('CFC'), rav: g('RAV'), tdl: g('TDL'), net: r.totals.net, charges_patronales: r.totals.pat, cout_employeur: r.totals.cost };
    },
    expliquer_bulletin: function (i) {
      var e = findEmp(i.matricule || i.salarie)[0]; if (!e) throw new Error('Salarié introuvable.');
      if (!App.can('pay.sensitive')) throw new Error('Données de rémunération confidentielles pour votre rôle.');
      var d = P.D(S(), cid()), k = i.periode && d.periods[i.periode] ? i.periode : App.pk(), s = d.periods[k].slips[e.id]; if (!s) throw new Error('Pas de bulletin pour ' + P.monthLabel(k) + '.');
      return { salarie: P.fullName(e), periode: P.monthLabel(k), jours_payes: s.ctx.jp, anciennete: s.ctx.anc, lignes: s.lines.map(function (l) { return { rubrique: l.label, base: l.base, taux: l.rate, gain: l.gain || 0, retenue: l.sal || 0, patronal: l.pat || 0 }; }), brut: s.totals.brut, net: s.totals.net, cout: s.totals.cost, conges_solde: s.leave.after };
    },
    echeances: function () { return P.notifications(S(), cid()).map(function (n) { return n.title + ' — ' + n.text; }); },
    ouvrir_ecran: function (i) { var pg = String(i.ecran || ''); if (!App.pages[pg]) throw new Error('Écran inconnu. Écrans : ' + Object.keys(App.pages).join(', ')); setTimeout(function () { App.go(pg, i.onglet); }, 50); return 'Écran ' + pg + ' ouvert.'; }
  };
  var TOOL_DEFS = [
    { name: 'lister_anomalies', description: 'Liste les anomalies (bloquantes et non bloquantes) de la période de paie affichée. Renvoie code, niveau, salarié, détail.' },
    { name: 'chercher_salarie', description: 'Cherche des salariés par nom, prénom, poste ou matricule. Renvoie leurs informations (salaire seulement si l’utilisateur est habilité).', inputSchema: { type: 'object', properties: { recherche: { type: 'string' } }, required: ['recherche'] } },
    { name: 'resume_paie', description: 'Résumé de la paie d’une période (AAAA-MM) ou de la période affichée : statut, effectif, brut, net, coût, anomalies, écritures, signatures.', inputSchema: { type: 'object', properties: { periode: { type: 'string' } } } },
    { name: 'ajouter_variable', description: 'Ajoute une variable de paie à un salarié sur la période ouverte. rubrique ∈ HS1 (heures +20 %), HS2 (+30 %), HS3 (+40 %), HSN (nuit/dimanche/férié), ABS_NP (jours d’absence non payés), CONGE (jours de congés), PRIME_REND, PRIME_EXC, RAPPEL, RET_DIV. quantite pour heures/jours, montant en XAF pour les primes et retenues.', inputSchema: { type: 'object', properties: { matricule: { type: 'string', description: 'Matricule ou nom du salarié' }, rubrique: { type: 'string' }, quantite: { type: 'number' }, montant: { type: 'number' }, note: { type: 'string' } }, required: ['matricule', 'rubrique'] } },
    { name: 'simuler', description: 'Simulateur de paie camerounais : du salaire de base vers le net, ou d’un net cible vers le salaire de base. Renvoie brut, cotisations, IRPP, net, coût employeur.', inputSchema: { type: 'object', properties: { salaire_base: { type: 'number' }, net_cible: { type: 'number' }, transport: { type: 'number' }, convention: { type: 'string' } } } },
    { name: 'expliquer_bulletin', description: 'Détail ligne par ligne du bulletin d’un salarié pour une période, pour l’expliquer.', inputSchema: { type: 'object', properties: { matricule: { type: 'string' }, periode: { type: 'string' } }, required: ['matricule'] } },
    { name: 'echeances', description: 'Tâches et échéances en attente pour l’utilisateur connecté (avances, validations, signatures, déclarations).' },
    { name: 'ouvrir_ecran', description: 'Ouvre un écran de myyiel : paie, paie-salaries, paie-periode, paie-bulletins, paie-drh, paie-paiements, paie-declarations, paie-avances, paie-param, dashboard, saisie, livres, etats.', inputSchema: { type: 'object', properties: { ecran: { type: 'string' }, onglet: { type: 'string' } }, required: ['ecran'] } }
  ];

  /* ----------------------------------------------------------- moteur local */
  function num(s) { var m = String(s).match(/(\d[\d\s.,]*)/); return m ? U.parseAmount(m[1].replace(/\s(?=\d{3}\b)/g, '')) : 0; }
  function local(q) { return Promise.resolve().then(function () { return localAnswer(q); }).then(null, function (x) { return 'Je n’ai pas pu le faire : ' + x.message; }); }
  function localAnswer(q) {
    var t = q.toLowerCase(), f;
    try {
      if (/anomal|bloqu|erreur|contr[oô]le/.test(t)) { f = T.lister_anomalies(); var b = f.anomalies.filter(function (a) { return a.niveau === 'bloquante'; }); return 'Paie de **' + f.periode + '** (' + f.statut + ') : **' + b.length + ' anomalie(s) bloquante(s)** et ' + (f.anomalies.length - b.length) + ' point(s) à vérifier.\n' + f.anomalies.slice(0, 8).map(function (a) { return '- ' + a.code + ' · ' + a.libelle + (a.matricule ? ' · ' + a.salarie + ' (' + a.matricule + ')' : '') + ' : ' + a.detail; }).join('\n') + (b.length ? '\nCorrigez les dossiers concernés (bouton « Corriger » dans Calcul & anomalies), puis relancez le calcul.' : ''); }
      var who = (q.match(/(?:à|a|pour|de)\s+([A-ZÉÈ][\w'’-]+(?:\s+[A-ZÉÈ][\w'’-]+)?|[A-Z]{2}\d{4})/) || [])[1];
      if (/heure|hs\b|h sup/.test(t) && who) { var h = num(t); var code = /nuit|dimanche|f[ée]ri/.test(t) ? 'HSN' : (/40\s*%|hs3/.test(t) ? 'HS3' : (/30\s*%|hs2/.test(t) ? 'HS2' : 'HS1')); return T.ajouter_variable({ matricule: who, rubrique: code, quantite: h }); }
      if (/absen/.test(t) && who) return T.ajouter_variable({ matricule: who, rubrique: 'ABS_NP', quantite: num(t) || 1 });
      if (/prime/.test(t) && who) return T.ajouter_variable({ matricule: who, rubrique: /rendement|objectif|commission/.test(t) ? 'PRIME_REND' : 'PRIME_EXC', montant: num(t) });
      if (/simul|net de|net cible|brut pour|combien.*net/.test(t)) { var n = num(t); var r = /net (de|cible)|pour un net|toucher/.test(t) ? T.simuler({ net_cible: n }) : T.simuler({ salaire_base: n }); return 'Simulation (barèmes en vigueur) :\n- Salaire de base : **' + U.fmt(r.salaire_base) + '**\n- Brut : ' + U.fmt(r.brut) + '\n- CNPS salarié : ' + U.fmt(r.cnps_salarie) + ' · IRPP + CAC : ' + U.fmt(r.irpp + r.cac) + ' · CFC, RAV, TDL : ' + U.fmt(r.cfc + r.rav + r.tdl) + '\n- **Net : ' + U.fmt(r.net) + ' XAF**\n- Coût employeur : ' + U.fmt(r.cout_employeur) + ' XAF'; }
      if (/bulletin|explique|d[ée]tail/.test(t) && who) { f = T.expliquer_bulletin({ matricule: who }); return 'Bulletin de **' + f.salarie + '** (' + f.periode + ', ' + f.jours_payes + ' jours payés) :\n' + f.lignes.map(function (l) { return '- ' + l.rubrique + ' : ' + (l.gain ? '+' + U.fmt(l.gain) : '') + (l.retenue ? '−' + U.fmt(l.retenue) : '') + (l.patronal ? ' (patronal ' + U.fmt(l.patronal) + ')' : ''); }).join('\n') + '\n**Net : ' + U.fmt(f.net) + ' XAF** · coût employeur ' + U.fmt(f.cout); }
      if (/[ée]ch[ée]ance|faire|t[aâ]che|attente|notification/.test(t)) { f = T.echeances(); return f.length ? 'Pour vous (' + Y.ROLES[App.user().role].label + ') :\n' + f.map(function (x) { return '- ' + x; }).join('\n') : 'Rien en attente pour votre rôle.'; }
      if (/co[uû]t|masse|total|r[ée]sum|combien/.test(t)) { f = T.resume_paie({}); return 'Paie de **' + f.periode + '** · ' + f.statut + ' : ' + f.bulletins + ' bulletins, brut ' + (typeof f.brut === 'number' ? U.fmt(f.brut) : f.brut) + ', net ' + (typeof f.net_a_payer === 'number' ? U.fmt(f.net_a_payer) : f.net_a_payer) + ', coût total ' + (typeof f.cout_total === 'number' ? U.fmt(f.cout_total) : f.cout_total) + ' XAF. Écritures : ' + f.ecritures + '.'; }
      if (who) { var l = T.chercher_salarie({ recherche: who }); if (l.length) return l.map(function (e) { return '**' + e.nom + '** (' + e.matricule + ') · ' + e.poste + ' · ' + e.service + ' · ' + e.contrat + ' depuis le ' + U.frDate(e.embauche) + (e.salaire_base ? ' · base ' + U.fmt(e.salaire_base) : ''); }).join('\n'); }
    } catch (x) { return 'Je n’ai pas pu le faire : ' + x.message; }
    return 'Je peux par exemple :\n- « Quelles anomalies bloquent la paie ? »\n- « Ajoute 6 heures sup à Fotso »\n- « Prime de rendement de 50 000 pour Essomba »\n- « Simule un net de 400 000 »\n- « Explique le bulletin de Mbarga »\n- « Qu’ai-je à faire ? »';
  }

  /* -------------------------------------------------------------- IA (sample) */
  function rules() {
    var p = App.pPeriod(), d = P.D(S(), cid());
    return 'Tu es Yiélina, l’assistante RH et paie de myyiel (Yiel Group), pour des entreprises du Cameroun (SYSCOHADA, CNPS, IRPP, XAF). Réponds en français, brièvement (5 à 8 lignes), avec des montants en XAF formatés "1 234 567". N’invente aucun chiffre : utilise les outils pour toute donnée. Pour modifier la paie, utilise ajouter_variable puis rappelle de relancer le calcul. Respecte la confidentialité : si un outil répond "confidentiel", ne le contourne pas. Signale clairement toute anomalie ou incohérence que tu remarques (variation anormale, RIB partagé, salaire sous le minimum). Contexte : société ' + App.co().name + ', utilisateur ' + App.user().name + ' (' + Y.ROLES[App.user().role].label + '), période ' + P.monthLabel(p.key) + ' au statut « ' + P.STATUS[p.status][0] + ' », ' + d.employees.filter(function (e) { return e.statut !== 'sorti'; }).length + ' salariés, ' + (p.anomalies || []).length + ' anomalies. Date du jour : ' + U.frDate(App.today()) + '.';
  }
  function getSample() {
    if (YL.sample !== undefined) return Promise.resolve(YL.sample);
    if (!(window.claude && window.claude.use)) { YL.sample = null; return Promise.resolve(null); }
    return window.claude.use('sample').then(function (s) { YL.sample = s || null; YL.mode = s ? 'ia' : 'local'; draw(); return YL.sample; }, function () { YL.sample = null; return null; });
  }
  function ask(q) {
    if (!q || YL.busy) return;
    YL.msgs.push({ role: 'user', text: q }); YL.busy = true; draw();
    getSample().then(function (sample) {
      if (!sample) return local(q).then(done);
      YL.ctl = new AbortController();
      var turns = [{ role: 'user', content: rules() }].concat(YL.msgs.slice(-8).map(function (m) { return { role: m.role === 'user' ? 'user' : 'assistant', content: m.text }; }));
      if (turns[1] && turns[1].role !== 'user') turns.splice(1, 1);
      var merged = []; turns.forEach(function (t) { var last = merged[merged.length - 1]; if (last && last.role === t.role) last.content += '\n\n' + t.content; else merged.push({ role: t.role, content: t.content }); });
      YL.msgs.push({ role: 'assistant', text: '', pending: true }); draw();
      sample(merged, { cache: false, signal: YL.ctl.signal, tools: TOOL_DEFS.map(function (d) { return Object.assign({}, d, { execute: function (inp) { var r = T[d.name](inp || {}); YL.status = 'Yiélina consulte : ' + d.name.replace(/_/g, ' ') + '…'; draw(); return r; } }); }), onText: function (u) { var m = YL.msgs[YL.msgs.length - 1]; m.text = u.text; m.pending = false; draw(); } })
        .then(function (r) { YL.msgs.pop(); done(r.text); }, function (e) {
          YL.msgs.pop();
          if (e && (e.code === 'not_granted' || e.code === 'unavailable')) { YL.sample = null; YL.mode = 'local'; return local(q).then(done); }
          if (e && e.code === 'cancelled') return done(e.text || '(Interrompu)');
          if (e && e.text) return done(e.text); local(q).then(function (t) { done('Yiélina est momentanément indisponible (' + ((e && e.code) || 'erreur') + '). Réponse locale :\n' + t); });
        });
    });
    function done(text) { YL.busy = false; YL.status = ''; YL.msgs.push({ role: 'assistant', text: text }); draw(); if (YL.dirty) { YL.dirty = false; App.render(); } }
  }

  /* ------------------------------------------------------------------- vue */
  function md(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').split('\n').map(function (l) { return /^- /.test(l) ? '<li>' + l.slice(2) + '</li>' : l; }).join('\n').replace(/(<li>.*<\/li>\n?)+/g, function (m) { return '<ul>' + m.replace(/\n/g, '') + '</ul>'; }).replace(/\n/g, '<br>'); }
  var SUG = ['Quelles anomalies bloquent la paie ?', 'Ajoute 6 heures sup à Fotso', 'Simule un net de 400 000', 'Explique le bulletin de Mbarga', 'Qu’ai-je à faire ?', 'Quel est le coût total de la paie ?'];
  function draw() {
    var r = document.getElementById('yroot'); if (!r) return;
    if (!YL.open) { r.innerHTML = '<button type="button" class="yl-fab" data-act="yl-toggle" aria-label="Ouvrir Yiélina, assistante RH et paie"><span class="yl-av">' + App.ic('sparkle') + '</span><span>Yiélina</span></button>'; return; }
    var last = r.querySelector('.yl-msgs'), keep = last ? last.scrollHeight - last.scrollTop - last.clientHeight < 40 : true;
    r.innerHTML = '<section class="yl-panel" role="dialog" aria-label="Yiélina"><header><span class="yl-av big">' + App.ic('sparkle') + '</span><span style="flex:1;min-width:0"><b>Yiélina</b><small>Assistante RH & paie · ' + (YL.mode === 'ia' ? 'IA connectée' : 'mode local') + '</small></span><button type="button" class="btn icon ghost" data-act="yl-toggle" aria-label="Fermer">' + App.ic('x') + '</button></header>' +
      '<div class="yl-msgs" id="yl_msgs">' + (YL.msgs.length ? '' : '<div class="yl-m a">Bonjour ' + esc(App.user().name.split('·').pop().trim()) + ' ! Je connais vos salariés, vos variables et la réglementation camerounaise. Demandez-moi à l’écrit ou à la voix.</div>') + YL.msgs.map(function (m) { return '<div class="yl-m ' + (m.role === 'user' ? 'u' : 'a') + '">' + (m.pending && !m.text ? '<span class="dots"><i></i><i></i><i></i></span>' : md(m.text)) + '</div>'; }).join('') + (YL.busy && !YL.msgs.some(function (m) { return m.pending; }) ? '<div class="yl-m a"><span class="dots"><i></i><i></i><i></i></span></div>' : '') + (YL.status ? '<div class="yl-status">' + esc(YL.status) + '</div>' : '') + '</div>' +
      '<div class="yl-sug">' + SUG.map(function (s) { return '<button type="button" data-act="yl-ask" data-q="' + esc(s) + '">' + esc(s) + '</button>'; }).join('') + '</div>' +
      '<div class="yl-in"><button type="button" class="btn icon ghost' + (YL.listening ? ' rec' : '') + '" data-act="yl-mic" aria-label="Dicter">' + App.ic('mic') + '</button><input class="in" id="yl_q" placeholder="Écrivez ou dictez votre demande…" autocomplete="off"' + (YL.busy ? ' disabled' : '') + '>' + (YL.busy && YL.ctl ? '<button type="button" class="btn" data-act="yl-stop">Stop</button>' : '<button type="button" class="btn acc" data-act="yl-send">' + App.ic('send') + '</button>') + '</div></section>';
    var box = document.getElementById('yl_msgs'); if (box && keep) box.scrollTop = box.scrollHeight;
    var q = document.getElementById('yl_q'); if (q && !YL.busy) q.focus();
  }
  App.ylDraw = draw;
  A['yl-toggle'] = function () { YL.open = !YL.open; if (YL.open) getSample(); draw(); };
  A['yl-open'] = function (el) { YL.open = true; draw(); if (el && el.dataset && el.dataset.q) ask(el.dataset.q); };
  A['yl-ask'] = function (el) { ask(el.dataset.q); };
  A['yl-send'] = function () { var q = document.getElementById('yl_q'); if (q && q.value.trim()) ask(q.value.trim()); };
  A['yl-stop'] = function () { if (YL.ctl) YL.ctl.abort(); };
  A['yl-mic'] = function () {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return App.toast('Dictée vocale non disponible dans ce navigateur : écrivez votre demande (dans l’application myyiel, le micro est activé).', 'bad');
    try {
      var rec = new SR(); rec.lang = 'fr-FR'; rec.interimResults = false; YL.listening = true; draw();
      rec.onresult = function (e) { var t = e.results[0][0].transcript; YL.listening = false; ask(t); };
      rec.onerror = function () { YL.listening = false; draw(); App.toast('Micro indisponible ou refusé ici : écrivez votre demande.', 'bad'); };
      rec.onend = function () { if (YL.listening) { YL.listening = false; draw(); } };
      rec.start();
    } catch (x) { YL.listening = false; draw(); App.toast('Dictée vocale indisponible : ' + x.message, 'bad'); }
  };
  document.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target && e.target.id === 'yl_q') { e.preventDefault(); A['yl-send'](); } });

  /* ------------------------------------------------------- notifications */
  App.notifs = function () {
    var l = [];
    try { l = P.notifications(S(), cid()); } catch (x) { /* paie absente */ }
    if (App.extraNotifs) { try { l = l.concat(App.extraNotifs()); } catch (x) { /* rien */ } }
    if (App.insights && ['owner', 'accountant', 'cfo'].indexOf(App.user().role) > -1) { try { App.insights().slice(0, 4).forEach(function (i) { l.push({ level: i.tone === 'bad' ? 'bad' : 'info', title: i.title, text: i.text, page: i.page || 'dashboard', tab: i.tab || '' }); }); } catch (x) { /* rien */ } }
    return l;
  };
  A['ntf-open'] = function () {
    var l = App.notifs();
    App.drawer({ title: 'Notifications', sub: Y.ROLES[App.user().role].label + ' · ' + l.length + ' élément(s)', noFocus: true, body: '<div class="list">' + (l.length ? l.map(function (n) { return '<div style="display:block"><div style="display:flex;gap:8px;align-items:center;margin-bottom:4px">' + App.chip(n.level === 'bad' ? 'Urgent' : (n.level === 'warn' ? 'À traiter' : 'Info'), n.level === 'bad' ? 'bad' : (n.level === 'warn' ? 'warn' : 'info'), true) + '<button type="button" class="btn xs" style="margin-left:auto" data-act="go" data-page="' + esc(n.page) + '"' + (n.tab ? ' data-tab="' + esc(n.tab) + '"' : '') + '>Ouvrir</button></div><b style="display:block;font-size:13.5px">' + esc(n.title) + '</b><span class="muted" style="font-size:12.5px">' + esc(n.text) + '</span></div>'; }).join('') : '<div class="empty"><b>Aucune notification</b></div>') + '</div><div class="callout">' + App.ic('bell') + '<span>Les mêmes alertes sont envoyées par e-mail et WhatsApp selon Paramétrage paie › Notifications & délais.</span></div>' });
  };
})();

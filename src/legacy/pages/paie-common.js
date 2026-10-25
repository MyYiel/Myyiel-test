/* Paie · éléments communs de l'interface : période active, masquage des données sensibles, fiche et formulaire salarié, bulletin (vue et PDF), bordereau de virement. */
(function () {
  'use strict';
  var Y = window.Yiel, U = Y.util, P = Y.Paie, App = window.App, esc = App.esc, A = App.actions;
  function S() { return App.S; } function cid() { return App.cid(); }

  Object.assign(App.ICONS, {
    paie: 'M3 7h18v12H3zM3 11h18M7 15h3M16 4l-4 3-4-3', 'paie-salaries': 'M9 11a3 3 0 100-6 3 3 0 000 6zM3 20c.7-3.4 3-5 6-5s5.3 1.6 6 5M16 11a3 3 0 100-6M18 15c2 .6 3 2.2 3.4 5',
    'paie-periode': 'M4 6h16v14H4zM4 10h16M9 3v4M15 3v4M8 14h3M8 17h6', 'paie-bulletins': 'M6 3h9l4 4v14H6zM14 3v5h5M9 12h6M9 16h6',
    'paie-drh': 'M4 19c3-1 4-5 6-5s2 3 4 3 3-4 6-6M15 4l5 5-9 9H6v-5z', 'paie-paiements': 'M4 8h13M13 4l4 4-4 4M20 16H7M11 12l-4 4 4 4',
    'paie-declarations': 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4', 'paie-avances': 'M12 3v3M12 18v3M17 7.5c-.8-1.2-2.5-2-5-2-3 0-4.5 1.4-4.5 3 0 4 9.5 2 9.5 6.5 0 1.6-1.7 3-5 3-2.6 0-4.4-.9-5.2-2.3',
    'paie-param': 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4', mic: 'M12 3a3 3 0 00-3 3v6a3 3 0 006 0V6a3 3 0 00-3-3zM5 11a7 7 0 0014 0M12 18v3', pen: 'M4 20h4L19 9l-4-4L4 16z'
  });

  /* ------------------------------------------------------------------ état */
  App.pk = function () { var d = P.D(S(), cid()); var k = App.v('pKey_' + cid(), null); if (!k || !d.periods[k]) k = P.currentKey(S(), cid()); return k; };
  App.pPeriod = function () { return P.period(S(), cid(), App.pk(), true); };
  App.pickPeriod = function () {
    var d = P.D(S(), cid()), ks = Object.keys(d.periods).sort().reverse(), cur = App.pk();
    return '<label class="fld" style="flex-direction:row;align-items:center;gap:8px"><span>Période</span><select class="in" style="width:auto" data-change="p-key">' + ks.map(function (k) { return '<option value="' + k + '"' + (k === cur ? ' selected' : '') + '>' + P.monthLabel(k) + ' · ' + P.STATUS[d.periods[k].status][0].split(' ·')[0] + '</option>'; }).join('') + '</select></label>';
  };
  A['p-key'] = function (el) { App.ui.v['pKey_' + cid()] = el.value; App.render(); };
  App.pChip = function (p) { var s = P.STATUS[p.status]; return App.chip(s[0], s[1], true); };
  App.sens = function (v, mask) { return App.can('pay.sensitive') ? v : (mask || '•••••'); };
  App.sensMoney = function (n) { return App.can('pay.sensitive') ? U.fmt(n) : '•••••'; };
  App.ename = function (e) { return e ? P.fullName(e) : '—'; };
  App.pRun = function (fn, msg) { return App.run(fn, msg); };
  App.FLOW = [['preparation', 'Préparation'], ['controlee', 'Contrôle'], ['soumise', 'Soumise DRH'], ['validee', 'Validée & transmise'], ['signee', 'Bulletins signés'], ['payee', 'Virements exécutés'], ['declaree', 'Déclarations payées'], ['cloturee', 'Clôture DAF']];
  App.flowState = function (key) {
    var d = P.D(S(), cid()), p = d.periods[key]; if (!p) return {};
    var order = ['preparation', 'calculee', 'controlee', 'soumise', 'validee', 'cloturee'], i = order.indexOf(p.status), ids = Object.keys(p.slips);
    var st = { preparation: true, controlee: i >= 2, soumise: i >= 3, validee: i >= 4, cloturee: i >= 5 };
    st.signee = i >= 4 && ids.length > 0 && ids.every(function (x) { return p.slips[x].signed; });
    st.payee = d.bankOrders.some(function (o) { return o.key === key && o.status === 'execute'; });
    st.declaree = i >= 4 && ['CNPS', 'DGI', 'COMMUNE'].every(function (c) { return p.decl && p.decl[c] && p.decl[c].status === 'payee'; });
    return st;
  };
  App.flowBar = function (key) {
    var st = App.flowState(key), cur = App.FLOW.find(function (f) { return !st[f[0]]; });
    return '<div class="flow" role="list">' + App.FLOW.map(function (f, i) { var on = st[f[0]], here = cur && cur[0] === f[0]; return '<span role="listitem" class="' + (on ? 'done' : '') + (here ? ' here' : '') + '"><i>' + (on ? '✓' : i + 1) + '</i>' + esc(f[1]) + '</span>'; }).join('') + '</div>';
  };

  /* ------------------------------------------------------- formulaire salarié */
  App.empFields = function (e) {
    var d = P.D(S(), cid()), sens = App.can('pay.sensitive'), conv = P.conv(S(), cid(), e && e.convention || (d.conventions[0] || {}).code);
    var opt = function (l) { return l.map(function (x) { return [x, x]; }); };
    var f = [{ type: 'sep', label: 'Identité' },
      { k: 'matricule', label: 'Matricule', val: e ? e.matricule : '', mono: true, ph: 'Automatique (YG0020…)', ro: !!e },
      { k: 'civilite', label: 'Civilité', type: 'select', val: e ? e.civilite : 'M.', opts: opt(['M.', 'Mme', 'Mlle']) },
      { k: 'nom', label: 'Nom', req: true, val: e ? e.nom : '' }, { k: 'prenoms', label: 'Prénoms', req: true, val: e ? e.prenoms : '' },
      { k: 'sexe', label: 'Sexe', type: 'select', val: e ? e.sexe : 'M', opts: [['M', 'Masculin'], ['F', 'Féminin']] }, { k: 'naissance', label: 'Date de naissance', type: 'date', val: e ? e.naissance : '' },
      { k: 'lieuNaissance', label: 'Lieu de naissance', val: e ? e.lieuNaissance : '' }, { k: 'nationalite', label: 'Nationalité', val: e ? e.nationalite : 'Camerounaise' },
      { k: 'situation', label: 'Situation familiale', type: 'select', val: e ? e.situation : 'Célibataire', opts: opt(['Célibataire', 'Marié(e)', 'Divorcé(e)', 'Veuf / veuve', 'Union libre']) }, { k: 'enfants', label: 'Enfants à charge', type: 'number', val: e ? e.enfants : 0 },
      { k: 'niu', label: 'NIU', val: e ? e.niu : '', mono: true }, { k: 'cnps', label: 'N° d’immatriculation CNPS', val: e ? e.cnps : '', mono: true, help: 'Obligatoire pour la DIPE.' },
      { type: 'sep', label: 'Coordonnées' }, { k: 'telephone', label: 'Téléphone', val: e ? e.telephone : '' }, { k: 'whatsapp', label: 'WhatsApp (envoi des bulletins)', val: e ? e.whatsapp : '' },
      { k: 'email', label: 'E-mail', type: 'email', val: e ? e.email : '' }, { k: 'adresse', label: 'Quartier / adresse', val: e ? e.adresse : '' }, { k: 'ville', label: 'Ville', val: e ? e.ville : 'Douala' }, { k: 'urgence', label: 'Contact d’urgence', val: e ? e.urgence : '' },
      { type: 'sep', label: 'Poste et contrat' },
      { k: 'site', label: 'Établissement', type: 'select', req: true, val: e ? e.site : (d.establishments[0] || {}).code, opts: d.establishments.map(function (x) { return [x.code, x.code + ' · ' + x.label]; }) },
      { k: 'service', label: 'Service', req: true, val: e ? e.service : '', list: 'svc_list' }, { k: 'poste', label: 'Poste', req: true, val: e ? e.poste : '' },
      { k: 'convention', label: 'Convention collective', type: 'select', req: true, val: e ? e.convention : (d.conventions[0] || {}).code, opts: d.conventions.map(function (c) { return [c.code, c.label]; }) },
      { k: 'categorie', label: 'Catégorie (grille)', type: 'select', val: e ? e.categorie : '', empty: '—', opts: conv ? conv.grid.map(function (g) { return [g[0], g[0] + ' · ' + g[2] + (sens ? ' · min. ' + U.fmt(g[3]) : '')]; }) : [] },
      { k: 'echelon', label: 'Échelon', val: e ? e.echelon : 'A' },
      { k: 'section', label: 'Section analytique', type: 'select', empty: '—', val: e ? e.section : '', opts: App.D().sections.filter(function (s) { return s.axis === 'ACT'; }).map(function (s) { return [s.code, s.code + ' · ' + s.label]; }) },
      { k: 'contrat', label: 'Type de contrat', type: 'select', req: true, val: e ? e.contrat : 'CDI', opts: opt(['CDI', 'CDD', 'Stage', 'Temporaire']) },
      { k: 'embauche', label: 'Date d’embauche', type: 'date', req: true, val: e ? e.embauche : App.today() }, { k: 'anciennete', label: 'Date d’ancienneté (si reprise)', type: 'date', val: e ? e.anciennete : '' },
      { k: 'essaiFin', label: 'Fin de période d’essai', type: 'date', val: e ? e.essaiFin : '' }, { k: 'finContrat', label: 'Fin de contrat (CDD)', type: 'date', val: e ? e.finContrat : '' },
      { k: 'horaire', label: 'Heures mensuelles (vide = 173,33)', type: 'number', val: e && e.horaire ? e.horaire : '' }];
    if (sens) f = f.concat([{ type: 'sep', label: 'Rémunération · données confidentielles' }, { k: 'sb', label: 'Salaire de base mensuel (XAF)', type: 'money', req: true, val: e ? e.sb : '' },
      { k: 'fx_PRIME_RESP', label: 'Prime de responsabilité (fixe)', type: 'money', val: e && e.fixes.PRIME_RESP || '' }, { k: 'fx_IND_LOG', label: 'Indemnité de logement', type: 'money', val: e && e.fixes.IND_LOG || '' },
      { k: 'fx_IND_TRANSP', label: 'Indemnité de transport', type: 'money', val: e && e.fixes.IND_TRANSP || '' }, { k: 'fx_SYND', label: 'Cotisation syndicale', type: 'money', val: e && e.fixes.SYND || '' }, { k: 'fx_MUTUELLE', label: 'Mutuelle (part salariale)', type: 'money', val: e && e.fixes.MUTUELLE || '' },
      { k: 'fx_AN_LOG', label: 'Avantage en nature : logement', type: 'check', val: e && e.fixes.AN_LOG }, { k: 'fx_AN_VEH', label: 'Avantage en nature : véhicule', type: 'check', val: e && e.fixes.AN_VEH },
      { k: 'fx_AN_ELEC', label: 'Avantage en nature : électricité', type: 'check', val: e && e.fixes.AN_ELEC }, { k: 'fx_AN_EAU', label: 'Avantage en nature : eau', type: 'check', val: e && e.fixes.AN_EAU }, { k: 'fx_AN_NOUR', label: 'Avantage en nature : nourriture', type: 'check', val: e && e.fixes.AN_NOUR },
      { type: 'sep', label: 'Paiement · données confidentielles' },
      { k: 'modePaiement', label: 'Mode de paiement', type: 'select', req: true, val: e ? e.modePaiement : 'virement', opts: [['virement', 'Virement bancaire'], ['momo', 'Mobile Money'], ['especes', 'Espèces (contre émargement)']] },
      { k: 'banque', label: 'Banque', val: e ? e.banque : '' }, { k: 'agence', label: 'Agence', val: e ? e.agence : '' }, { k: 'codeBanque', label: 'Code banque', val: e ? e.codeBanque : '', mono: true }, { k: 'guichet', label: 'Code guichet', val: e ? e.guichet : '', mono: true },
      { k: 'compte', label: 'N° de compte', val: e ? e.compte : '', mono: true }, { k: 'cle', label: 'Clé RIB', val: e ? e.cle : '', mono: true },
      { k: 'operateur', label: 'Opérateur Mobile Money', type: 'select', empty: '—', val: e ? e.operateur : '', opts: [['MTN', 'MTN MoMo'], ['Orange', 'Orange Money']] }, { k: 'momo', label: 'N° Mobile Money', val: e ? e.momo : '' },
      { k: 'cni', label: 'N° CNI / passeport', val: e ? e.cni : '', mono: true }]);
    else f.push({ type: 'html', html: '<div class="callout">' + App.ic('lock') + '<span>Rémunération, coordonnées bancaires et pièce d’identité sont réservées aux rôles habilités (gestionnaire de paie, DRH, DAF).</span></div>' });
    return f;
  };
  function collectEmp(v, e) {
    var o = Object.assign({}, v), fx = Object.assign({}, e ? e.fixes : {});
    Object.keys(v).forEach(function (k) { if (k.indexOf('fx_') === 0) { var c = k.slice(3); if (v[k] === true) fx[c] = 1; else if (v[k] === false) delete fx[c]; else if (v[k] === '' || v[k] === 0) delete fx[c]; else fx[c] = v[k]; delete o[k]; } });
    if (!App.can('pay.sensitive') && e) P.SENSITIVE.forEach(function (k) { o[k] = e[k]; });
    if (e) o.id = e.id;
    o.fixes = fx;
    if (!o.matricule) delete o.matricule;
    return o;
  }
  A['emp-new'] = function () {
    if (!App.guard('pay.prepare')) return;
    var dl = '<datalist id="svc_list">' + P.D(S(), cid()).employees.map(function (x) { return x.service; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).map(function (s) { return '<option value="' + esc(s) + '">'; }).join('') + '</datalist>';
    App.form({ title: 'Nouveau salarié', sub: 'Dossier unique : identité, poste, contrat, rémunération, paiement', fields: App.empFields(null), wide: true, after: dl, submit: 'Créer le dossier',
      onSubmit: function (v) { var o = collectEmp(v, null); var fx = o.fixes; delete o.fixes; var r = P.saveEmployee(S(), cid(), o, { source: 'saisie' }); r.fixes = fx; return r; }, done: function (r) { return 'Dossier ' + r.matricule + ' · ' + P.fullName(r) + ' créé.'; } });
  };
  A['emp-edit'] = function (el) {
    var e = P.emp(S(), cid(), el.dataset.id); if (!App.guard('pay.prepare')) return;
    App.form({ title: 'Modifier · ' + P.fullName(e), sub: e.matricule + ' · chaque modification est historisée', fields: App.empFields(e), wide: true, submit: 'Enregistrer',
      onSubmit: function (v) { var o = collectEmp(v, e), fx = o.fixes; delete o.fixes; var before = JSON.stringify(e.fixes); var r = P.saveEmployee(S(), cid(), o); if (JSON.stringify(fx) !== before) { r.fixes = fx; r.history.push({ changes: [{ field: 'éléments fixes', old: '•••', val: '•••' }], by: App.user().name, role: App.user().role, at: new Date().toISOString() }); } return r; }, done: 'Dossier mis à jour (historisé).' });
  };
  A['emp-open'] = function (el) {
    var e = P.emp(S(), cid(), el.dataset.id); if (!e) return;
    var d = P.D(S(), cid()), est = P.est(S(), cid(), e.site) || {}, conv = P.conv(S(), cid(), e.convention) || {}, sens = App.can('pay.sensitive');
    var kv = function (rows) { return '<dl class="kv">' + rows.map(function (r) { return '<dt>' + esc(r[0]) + '</dt><dd>' + (r[2] ? r[1] : esc(r[1] == null || r[1] === '' ? '—' : r[1])) + '</dd>'; }).join('') + '</dl>'; };
    var slips = Object.keys(d.periods).sort().reverse().filter(function (k) { return d.periods[k].slips[e.id]; }).slice(0, 12);
    var fx = Object.keys(e.fixes || {}).map(function (c) { var r = d.rubriques.find(function (x) { return x.code === c; }); return (r ? r.label : c) + (e.fixes[c] === 1 && /^AN_/.test(c) ? '' : ' : ' + App.sensMoney(e.fixes[c])); });
    var body = '<div class="actions">' + App.chip(e.statut === 'sorti' ? 'Sorti' : (e.sortie ? 'Sortie programmée le ' + App.date(e.sortie.date) : 'Actif'), e.statut === 'sorti' ? '' : 'ok', true) + App.chip(e.contrat, 'info') + App.chip(est.label || e.site) + App.chip(conv.label || e.convention) + '</div>' +
      '<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px"><div class="kpi"><span class="lbl">Salaire de base</span><span class="val" style="font-size:19px">' + App.sensMoney(e.sb) + '</span></div><div class="kpi"><span class="lbl">Ancienneté</span><span class="val" style="font-size:19px">' + Math.floor(U.daysBetween(e.anciennete || e.embauche, App.today()) / 365.25) + ' an(s)</span></div><div class="kpi"><span class="lbl">Solde de congés</span><span class="val" style="font-size:19px">' + String(e.conges.solde || 0).replace('.', ',') + ' j</span></div></div>' +
      '<h3 class="h3">Identité</h3>' + kv([['Matricule', e.matricule], ['Nom et prénoms', P.fullName(e)], ['Né(e) le', App.date(e.naissance) + (e.lieuNaissance ? ' à ' + e.lieuNaissance : '')], ['Nationalité', e.nationalite], ['Situation', (e.situation || '') + ' · ' + (e.enfants || 0) + ' enfant(s)'], ['NIU', e.niu], ['N° CNPS', e.cnps], ['Pièce d’identité', App.sens(e.cni)]]) +
      '<h3 class="h3">Coordonnées</h3>' + kv([['Téléphone', e.telephone], ['WhatsApp', e.whatsapp], ['E-mail', e.email], ['Adresse', [e.adresse, e.ville].filter(Boolean).join(', ')], ['Urgence', e.urgence]]) +
      '<h3 class="h3">Poste et contrat</h3>' + kv([['Poste', e.poste], ['Service', e.service], ['Établissement', est.label], ['Convention', conv.label], ['Catégorie / échelon', (e.categorie || '—') + ' / ' + (e.echelon || '—')], ['Section analytique', e.section], ['Contrat', e.contrat + (e.finContrat ? ' jusqu’au ' + App.date(e.finContrat) : '')], ['Embauche', App.date(e.embauche)], ['Fin d’essai', App.date(e.essaiFin)]]) +
      '<h3 class="h3">Rémunération et paiement ' + (sens ? '' : App.chip('Confidentiel', 'warn')) + '</h3>' + kv([['Éléments fixes', fx.length ? fx.join(' · ') : 'Aucun'], ['Mode de paiement', { virement: 'Virement', momo: 'Mobile Money', especes: 'Espèces' }[e.modePaiement]], ['Coordonnées', sens ? (e.modePaiement === 'momo' ? (e.operateur || '') + ' ' + (e.momo || '') : [e.banque, e.codeBanque, e.guichet, e.compte, e.cle].filter(Boolean).join(' · ')) : '•••••']]) +
      (e.sortie ? '<div class="callout warn">' + App.ic('bell') + '<span>Sortie le ' + App.date(e.sortie.date) + ' · ' + esc(e.sortie.motif) + (e.sortie.stc ? ' · solde de tout compte : congés ' + App.sensMoney(e.sortie.stc.ICCP) + ', licenciement ' + App.sensMoney(e.sortie.stc.IND_LIC) + ', préavis ' + App.sensMoney(e.sortie.stc.PREAVIS) : '') + '</span></div>' : '') +
      '<h3 class="h3">Bulletins</h3><div class="list">' + (slips.length ? slips.map(function (k) { var s = d.periods[k].slips[e.id]; return '<div><span class="grow"><b style="font-size:13px">' + P.monthLabel(k) + '</b><br><span class="muted" style="font-size:12px">' + (s.signed ? 'Signé le ' + App.date(s.signed.at.slice(0, 10)) : (P.isFrozen(d.periods[k]) ? 'À signer par la DRH' : 'Provisoire')) + '</span></span><span class="num">' + App.sensMoney(s.totals.net) + '</span><button type="button" class="btn xs" data-act="slip-view" data-k="' + k + '" data-id="' + e.id + '">Voir</button></div>'; }).join('') : '<div class="muted">Aucun bulletin.</div>') + '</div>' +
      '<h3 class="h3">Historique des modifications</h3><div class="list">' + e.history.slice().reverse().slice(0, 15).map(function (h) { return '<div style="font-size:12.5px"><span class="grow">' + h.changes.map(function (c) { return '<b>' + esc(c.field) + '</b>' + (c.old !== '' && c.old != null ? ' : ' + esc(c.old) + ' → ' + esc(c.val) : (c.val ? ' : ' + esc(c.val) : '')); }).join(' · ') + '</span><span class="muted">' + esc(h.by) + ' · ' + new Date(h.at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) + '</span></div>'; }).join('') + '</div>';
    var foot = '<button type="button" class="btn" data-act="emp-cert" data-id="' + e.id + '" data-t="travail">' + App.ic('pdf') + 'Certificat de travail</button><button type="button" class="btn" data-act="emp-cert" data-id="' + e.id + '" data-t="salaire"' + (sens ? '' : ' disabled') + '>' + App.ic('pdf') + 'Attestation de salaire</button>' + (e.statut !== 'sorti' ? '<button type="button" class="btn" data-act="emp-exit" data-id="' + e.id + '"' + App.dis('pay.prepare') + '>Sortie / solde de tout compte</button>' : '') + '<button type="button" class="btn pri" data-act="emp-edit" data-id="' + e.id + '"' + App.dis('pay.prepare') + '>Modifier</button>';
    App.drawer({ title: P.fullName(e), sub: e.matricule + ' · ' + e.poste + ' · ' + e.service, body: body, foot: foot, wide: true, noFocus: true });
  };
  A['emp-exit'] = function (el) {
    var e = P.emp(S(), cid(), el.dataset.id); if (!App.guard('pay.prepare')) return;
    App.form({ title: 'Sortie de ' + P.fullName(e), sub: 'Calcul du solde de tout compte, ajouté aux variables de la paie du mois de sortie',
      fields: [{ k: 'date', label: 'Date de sortie', type: 'date', req: true, val: e.finContrat || App.today() }, { k: 'motif', label: 'Motif', type: 'select', req: true, opts: P.MOTIFS_SORTIE.map(function (m) { return [m, m]; }), val: e.contrat === 'CDD' ? 'Fin de CDD' : 'Démission' },
        { k: 'preavis', label: 'Préavis', type: 'select', val: 'effectue', opts: [['effectue', 'Effectué (travaillé)'], ['paye', 'Non effectué, payé (indemnité compensatrice)'], ['dispense', 'Dispense sans indemnité']] }, { k: 'comment', label: 'Commentaire', type: 'textarea', span: true }],
      live: function (v) { if (!v.date) return ''; var pv; try { pv = P.exitPreview(S(), cid(), e.id, v); } catch (x) { return ''; } return '<div class="mini-entry">Salaire mensuel moyen (12 mois)   ' + App.sensMoney(pv.avg) + '\nAncienneté                      ' + pv.anc + ' an(s)\nCongés non pris                 ' + String(pv.leave).replace('.', ',') + ' j → ' + App.sensMoney(pv.ICCP) + '\nIndemnité de licenciement       ' + App.sensMoney(pv.IND_LIC) + '\nIndemnité de préavis            ' + App.sensMoney(pv.PREAVIS) + '</div><div class="muted" style="font-size:12px">Barèmes de la convention ' + esc(e.convention) + ' (modèles à valider).</div>'; },
      submit: 'Enregistrer la sortie', onSubmit: function (v) { return P.registerExit(S(), cid(), e.id, v); }, done: 'Sortie enregistrée : indemnités ajoutées à la paie du mois de sortie.' });
  };
  A['emp-cert'] = function (el) {
    var e = P.emp(S(), cid(), el.dataset.id), co = App.co(), t = el.dataset.t;
    var doc = App.pdfDoc(t === 'travail' ? 'Certificat de travail' : 'Attestation de salaire', co.name); if (!doc) return;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(18, 22, 46);
    var txt = t === 'travail'
      ? 'Je soussignée, Directrice des ressources humaines de ' + co.name + ', certifie que ' + (e.civilite || '') + ' ' + P.fullName(e) + ', né(e) le ' + App.date(e.naissance) + ', matricule ' + e.matricule + ', a été employé(e) dans notre entreprise du ' + App.date(e.embauche) + (e.sortie ? ' au ' + App.date(e.sortie.date) : ' à ce jour') + ' en qualité de ' + e.poste + ' (catégorie ' + (e.categorie || '—') + ').' + (e.sortie ? ' Il / elle nous quitte libre de tout engagement.' : '') + '\n\nCe certificat est délivré pour servir et valoir ce que de droit.'
      : 'Je soussignée, Directrice des ressources humaines de ' + co.name + ', atteste que ' + (e.civilite || '') + ' ' + P.fullName(e) + ', matricule ' + e.matricule + ', est employé(e) en ' + e.contrat + ' depuis le ' + App.date(e.embauche) + ' en qualité de ' + e.poste + ', et perçoit un salaire de base mensuel brut de ' + U.fmt(e.sb) + ' XAF.\n\nCette attestation est délivrée à la demande de l’intéressé(e) pour servir et valoir ce que de droit.';
    doc.text(doc.splitTextToSize(txt, 500), 50, 140);
    doc.text('Fait à ' + ((P.est(S(), cid(), e.site) || {}).city || 'Douala') + ', le ' + App.date(App.today()), 50, 300);
    var sg = P.D(S(), cid()).signature;
    doc.text('La Directrice des ressources humaines', 330, 330);
    try { if (sg && sg.cachet) doc.addImage(sg.cachet, 'PNG', 330, 340, 90, 90); if (sg && sg.signature) doc.addImage(sg.signature, 'PNG', 360, 350, 140, 56); } catch (x) { /* image facultative */ }
    App.pdfFinish(doc, (t === 'travail' ? 'certificat_travail_' : 'attestation_salaire_') + e.matricule + '.pdf');
  };

  /* --------------------------------------------------------------- bulletin */
  var TXT = {
    fr: { title: 'BULLETIN DE PAIE', period: 'Période du', to: 'au', paid: 'Paiement le', rub: 'Rubriques', base: 'Base', rate: 'Taux / nombre', gain: 'À payer', ded: 'À déduire', pat: 'Charges patronales', patRate: 'Taux', patAmt: 'Montant', gains: 'Rémunération', brut: 'TOTAL BRUT', nature: 'Avantages en nature (non versés)', cnps: 'Cotisations sociales', taxes: 'Impôts et taxes sur salaires', ret: 'Autres retenues', totDed: 'TOTAL DES RETENUES', net: 'NET À PAYER', words: 'Arrêté le présent bulletin à la somme de', leave: 'Congés (jours)', acq: 'Acquis', taken: 'Pris', bal: 'Solde', cum: 'Cumuls de l’année', taxable: 'Brut taxable', cost: 'Coût employeur', keep: 'Pour faire valoir vos droits, conservez ce bulletin sans limitation de durée.', mat: 'Matricule', emp: 'Salarié', job: 'Emploi', cat: 'Catégorie', hire: 'Embauche', anc: 'Ancienneté', cnpsNo: 'N° CNPS', mode: 'Paiement', conv: 'Convention', signed: 'Signé électroniquement par', unsigned: 'En attente de la signature de la DRH', draft: 'PROVISOIRE · non validé', employer: 'Employeur', years: 'an(s)' },
    en: { title: 'PAYSLIP', period: 'Period from', to: 'to', paid: 'Paid on', rub: 'Items', base: 'Base', rate: 'Rate / qty', gain: 'Earnings', ded: 'Deductions', pat: 'Employer contributions', patRate: 'Rate', patAmt: 'Amount', gains: 'Pay', brut: 'GROSS PAY', nature: 'Benefits in kind (not paid)', cnps: 'Social contributions', taxes: 'Payroll taxes', ret: 'Other deductions', totDed: 'TOTAL DEDUCTIONS', net: 'NET PAY', words: 'Amount in words', leave: 'Leave (days)', acq: 'Earned', taken: 'Taken', bal: 'Balance', cum: 'Year to date', taxable: 'Taxable gross', cost: 'Employer cost', keep: 'Keep this payslip with no time limit.', mat: 'Employee ID', emp: 'Employee', job: 'Position', cat: 'Grade', hire: 'Hire date', anc: 'Seniority', cnpsNo: 'Social security no.', mode: 'Payment', conv: 'Collective agreement', signed: 'Electronically signed by', unsigned: 'Awaiting HR director signature', draft: 'DRAFT · not approved', employer: 'Employer', years: 'year(s)' }
  };
  function groups(s) {
    var g = { gains: [], nature: [], cnps: [], taxes: [], ret: [] };
    s.lines.forEach(function (l) { if (l.kind === 'gain') g.gains.push(l); else if (l.kind === 'nature') g.nature.push(l); else if (l.org === 'CNPS') g.cnps.push(l); else if (l.kind === 'retenue') g.ret.push(l); else g.taxes.push(l); });
    return g;
  }
  function fmtRate(l) { if (l.qty !== null && l.qty !== undefined && l.unit) return String(Math.round(l.qty * 100) / 100).replace('.', ',') + ' ' + l.unit + (l.rate ? ' × ' + String(l.rate).replace('.', ',') + ' %' : ''); if (l.code === 'SB') return l.qty + ' j'; if (l.rate !== null && l.rate !== undefined) return String(Math.round(l.rate * 100) / 100).replace('.', ',') + ' %'; return ''; }
  App.slipHtml = function (key, s, lang) {
    lang = lang || 'fr'; var T = TXT[lang], d = P.D(S(), cid()), p = d.periods[key], e = P.emp(S(), cid(), s.empId), est = P.est(S(), cid(), e.site) || {}, co = App.co(), g = groups(s), sg = d.signature, en = lang === 'en';
    var L = function (l) { return esc(en ? l.labelEn : l.label); };
    var row = function (l) { return '<tr><td>' + L(l) + '</td><td class="n">' + (l.base !== null && l.base !== undefined ? U.fmt(l.base) : '') + '</td><td class="n">' + fmtRate(l) + '</td><td class="n">' + (l.gain ? U.fmt(l.gain) : '') + '</td><td class="n">' + (l.sal ? U.fmt(l.sal) : '') + '</td><td class="n">' + (l.patRate ? String(Math.round(l.patRate * 100) / 100).replace('.', ',') + ' %' : '') + '</td><td class="n">' + (l.pat ? U.fmt(l.pat) : '') + '</td></tr>'; };
    var head = function (t) { return '<tr class="g"><td colspan="7">' + t + '</td></tr>'; };
    var totDed = s.totals.cotSal + s.totals.impots + s.totals.retenues;
    var frozen = P.isFrozen(p);
    return '<div class="paper slip' + (frozen ? '' : ' draft') + '">' + (window.YIEL_MARK ? '<img class="wm" src="' + window.YIEL_MARK + '" alt="">' : '') + (!frozen ? '<div class="stamp">' + T.draft + '</div>' : '') +
      '<div class="slip-head"><div class="box"><img src="' + (window.YIEL_LOGO_LIGHT || '') + '" alt="Yiel" style="height:26px"><b>' + esc(co.name) + '</b><span>' + esc(est.label || '') + '</span><span>' + esc(est.address || co.address || '') + '</span><span>NIU ' + esc(co.niu) + ' · CNPS ' + esc(est.cnpsEmployer || '') + '</span></div>' +
      '<div class="title"><h3>' + T.title + '</h3><span>' + T.period + ' ' + App.date(p.start) + ' ' + T.to + ' ' + App.date(p.end) + '</span><span>' + T.paid + ' ' + App.date(key + '-' + U.pad(d.settings.payDay || 28, 2)) + '</span></div>' +
      '<div class="box"><span>' + T.mat + ' <b>' + esc(e.matricule) + '</b></span><b style="font-size:13px">' + esc((e.civilite || '') + ' ' + P.fullName(e)) + '</b><span>' + T.job + ' : ' + esc(s.ctx.poste) + ' · ' + esc(s.ctx.service) + '</span><span>' + T.cat + ' ' + esc((s.ctx.categorie || '—') + (e.echelon || '')) + ' · ' + T.conv + ' ' + esc(s.ctx.convention) + '</span><span>' + T.hire + ' ' + App.date(e.embauche) + ' · ' + T.anc + ' ' + s.ctx.anc + ' ' + T.years + '</span><span>' + T.cnpsNo + ' ' + esc(e.cnps || '—') + ' · NIU ' + esc(e.niu || '—') + '</span></div></div>' +
      '<table class="slip-t"><thead><tr><th rowspan="2">' + T.rub + '</th><th rowspan="2" class="n">' + T.base + '</th><th rowspan="2" class="n">' + T.rate + '</th><th rowspan="2" class="n">' + T.gain + '</th><th rowspan="2" class="n">' + T.ded + '</th><th colspan="2" class="c">' + T.pat + '</th></tr><tr><th class="n">' + T.patRate + '</th><th class="n">' + T.patAmt + '</th></tr></thead><tbody>' +
      head(T.gains) + g.gains.map(row).join('') + (g.nature.length ? head(T.nature) + g.nature.map(row).join('') : '') +
      '<tr class="t"><td colspan="3">' + T.brut + '</td><td class="n">' + U.fmt(s.totals.brut) + '</td><td></td><td></td><td></td></tr>' +
      (g.nature.length ? '<tr><td>' + (en ? 'Benefits in kind deducted' : 'Déduction des avantages en nature') + '</td><td></td><td></td><td></td><td class="n">' + U.fmt(s.totals.nature) + '</td><td></td><td></td></tr>' : '') +
      head(T.cnps) + g.cnps.map(row).join('') + head(T.taxes) + g.taxes.map(row).join('') + (g.ret.length ? head(T.ret) + g.ret.map(row).join('') : '') +
      '<tr class="t"><td colspan="3">' + T.totDed + '</td><td></td><td class="n">' + U.fmt(totDed + s.totals.nature) + '</td><td></td><td class="n">' + U.fmt(s.totals.pat) + '</td></tr>' +
      '</tbody></table><div class="netbar"><span>' + T.net + '</span><b>' + U.fmt(s.totals.net) + ' XAF</b></div>' +
      (!en && App.words ? '<div class="words">' + T.words + ' : ' + esc(App.words(s.totals.net)) + ' francs CFA.</div>' : '') +
      '<div class="slip-foot"><table class="mini"><tr><th>' + T.leave + '</th><th>' + T.acq + '</th><th>' + T.taken + '</th><th>' + T.bal + '</th></tr><tr><td></td><td>' + String(s.leave.acquired).replace('.', ',') + '</td><td>' + s.leave.taken + '</td><td>' + String(s.leave.after).replace('.', ',') + '</td></tr></table>' +
      '<table class="mini"><tr><th colspan="2">' + T.cum + ' ' + p.year + '</th></tr><tr><td>' + T.brut + '</td><td>' + U.fmt(s.cumuls.brut) + '</td></tr><tr><td>' + T.taxable + '</td><td>' + U.fmt(s.cumuls.taxable) + '</td></tr><tr><td>IRPP + CAC</td><td>' + U.fmt(s.cumuls.irpp) + '</td></tr><tr><td>' + T.net + '</td><td>' + U.fmt(s.cumuls.net) + '</td></tr></table>' +
      '<table class="mini"><tr><th colspan="2">' + T.employer + '</th></tr><tr><td>' + T.pat + '</td><td>' + U.fmt(s.totals.pat) + '</td></tr><tr><td>' + T.cost + '</td><td>' + U.fmt(s.totals.cost) + '</td></tr><tr><td>' + T.mode + '</td><td>' + ({ virement: en ? 'Bank transfer' : 'Virement', momo: 'Mobile Money', especes: en ? 'Cash' : 'Espèces' }[e.modePaiement]) + '</td></tr></table>' +
      '<div class="sig">' + (s.signed ? (sg && sg.sigId !== 'historique' && sg.cachet ? '<img class="cachet" src="' + sg.cachet + '" alt="Cachet">' : '') + (sg && sg.signature ? '<img class="sign" src="' + sg.signature + '" alt="Signature">' : '') + '<small>' + T.signed + ' ' + esc(s.signed.by) + '<br>' + new Date(s.signed.at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) + ' · ' + esc(s.signed.hash) + '</small>' : '<small>' + (frozen ? T.unsigned : '') + '</small>') + '</div></div>' +
      '<p class="keep">' + T.keep + '</p></div>';
  };
  A['slip-view'] = function (el) {
    var key = el.dataset.k, d = P.D(S(), cid()), s = d.periods[key].slips[el.dataset.id], lang = App.v('slipLang', d.settings.bulletinLang || 'fr');
    if (!s) return;
    var own = App.me && App.me() && App.me().id === s.empId && P.isFrozen(d.periods[key]);
    if (!own && !App.can('pay.sensitive') && (App.user().role !== 'hr')) { App.toast('Consultation des bulletins réservée aux rôles habilités.', 'bad'); return; }
    App.drawer({ title: 'Bulletin · ' + P.fullName(P.emp(S(), cid(), s.empId)), sub: P.monthLabel(key) + (s.signed ? ' · signé' : ''), wide: true, noFocus: true, body: '<div class="actions">' + App.seg('slipLang', [['fr', 'Français'], ['en', 'English']], lang, 'slip-lang') + '</div><div id="slip_box">' + App.slipHtml(key, s, lang) + '</div>',
      foot: '<button type="button" class="btn" data-act="slip-pdf" data-k="' + key + '" data-id="' + s.empId + '">' + App.ic('pdf') + 'PDF (impression)</button><button type="button" class="btn" data-act="slip-send" data-k="' + key + '" data-id="' + s.empId + '" data-c="email"' + (s.signed ? '' : ' disabled title="Bulletin non signé"') + '>' + App.ic('mail') + 'E-mail</button><button type="button" class="btn pri" data-act="slip-send" data-k="' + key + '" data-id="' + s.empId + '" data-c="whatsapp"' + (s.signed ? '' : ' disabled title="Bulletin non signé"') + '>' + App.ic('chat') + 'WhatsApp</button>' });
    App._slipCtx = { key: key, id: s.empId };
  };
  A['slip-lang'] = function (el) { App.ui.v.slipLang = el.dataset.val; var c = App._slipCtx; if (!c) return; var s = P.D(S(), cid()).periods[c.key].slips[c.id]; document.getElementById('slip_box').innerHTML = App.slipHtml(c.key, s, el.dataset.val); el.parentNode.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b === el); }); };

  /* PDF du bulletin (même structure que la vue) */
  App.slipPdfPage = function (doc, key, s, lang, first) {
    lang = lang || 'fr'; var T = TXT[lang], d = P.D(S(), cid()), p = d.periods[key], e = P.emp(S(), cid(), s.empId), est = P.est(S(), cid(), e.site) || {}, co = App.co(), g = groups(s), sg = d.signature, en = lang === 'en';
    if (!first) doc.addPage();
    var W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
    try { if (window.YIEL_MARK) { doc.saveGraphicsState && doc.saveGraphicsState(); if (doc.GState) doc.setGState(new doc.GState({ opacity: 0.05 })); doc.addImage(window.YIEL_MARK, 'PNG', W - 300, H - 330, 280, 280); if (doc.GState) doc.setGState(new doc.GState({ opacity: 1 })); doc.restoreGraphicsState && doc.restoreGraphicsState(); } } catch (x) { /* filigrane facultatif */ }
    doc.setDrawColor(200, 204, 216); doc.setLineWidth(0.6);
    doc.rect(36, 34, 200, 78); doc.rect(W - 236, 34, 200, 78);
    try { if (window.YIEL_LOGO_LIGHT) doc.addImage(window.YIEL_LOGO_LIGHT, 'PNG', 44, 40, 52, 20); } catch (x) { /* logo */ }
    doc.setTextColor(18, 22, 46); doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text(co.name, 44, 72);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.text([est.label || '', est.address || '', 'NIU ' + co.niu, 'CNPS ' + (est.cnpsEmployer || '')], 44, 82);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.text(T.title, W / 2, 56, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.text(T.period + ' ' + App.date(p.start) + ' ' + T.to + ' ' + App.date(p.end), W / 2, 70, { align: 'center' }); doc.text(T.paid + ' ' + App.date(key + '-' + U.pad(d.settings.payDay || 28, 2)), W / 2, 81, { align: 'center' });
    if (!P.isFrozen(p)) { doc.setTextColor(176, 39, 30); doc.setFont('helvetica', 'bold'); doc.text(T.draft, W / 2, 98, { align: 'center' }); doc.setTextColor(18, 22, 46); }
    doc.setFontSize(7.5); doc.setFont('helvetica', 'normal');
    doc.text([T.mat + ' : ' + e.matricule], W - 228, 46); doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text((e.civilite || '') + ' ' + P.fullName(e), W - 228, 58); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
    doc.text(doc.splitTextToSize(s.ctx.poste + ' · ' + s.ctx.service, 190).concat([T.cat + ' ' + (s.ctx.categorie || '—') + (e.echelon || '') + ' · ' + s.ctx.convention, T.hire + ' ' + App.date(e.embauche) + ' · ' + T.anc + ' ' + s.ctx.anc + ' ' + T.years, T.cnpsNo + ' ' + (e.cnps || '—') + ' · NIU ' + (e.niu || '—')]), W - 228, 69);
    var L = function (l) { return en ? l.labelEn : l.label; };
    var body = [], bold = {};
    var push = function (r, b) { if (b) bold[body.length] = b; body.push(r); };
    var row = function (l) { push([L(l), l.base !== null && l.base !== undefined ? U.fmt(l.base) : '', fmtRate(l), l.gain ? U.fmt(l.gain) : '', l.sal ? U.fmt(l.sal) : '', l.patRate ? String(Math.round(l.patRate * 100) / 100).replace('.', ',') + ' %' : '', l.pat ? U.fmt(l.pat) : '']); };
    var head = function (t) { push([{ content: t, colSpan: 7 }], 'g'); };
    head(T.gains); g.gains.forEach(row); if (g.nature.length) { head(T.nature); g.nature.forEach(row); }
    push([{ content: T.brut, colSpan: 3 }, U.fmt(s.totals.brut), '', '', ''], 't');
    if (g.nature.length) push([en ? 'Benefits in kind deducted' : 'Déduction des avantages en nature', '', '', '', U.fmt(s.totals.nature), '', '']);
    head(T.cnps); g.cnps.forEach(row); head(T.taxes); g.taxes.forEach(row); if (g.ret.length) { head(T.ret); g.ret.forEach(row); }
    push([{ content: T.totDed, colSpan: 3 }, '', U.fmt(s.totals.cotSal + s.totals.impots + s.totals.retenues + s.totals.nature), '', U.fmt(s.totals.pat)], 't');
    doc.autoTable({ startY: 122, margin: { left: 36, right: 36 }, theme: 'grid', head: [[T.rub, T.base, T.rate, T.gain, T.ded, T.patRate, T.patAmt]], body: body,
      styles: { font: 'helvetica', fontSize: 7.4, cellPadding: 2.6, textColor: [18, 22, 46], lineColor: [214, 218, 228], lineWidth: 0.4 },
      headStyles: { fillColor: [20, 26, 58], textColor: 255, fontStyle: 'bold' }, columnStyles: { 0: { cellWidth: 170 }, 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' } },
      didParseCell: function (dd) { if (dd.section !== 'body') return; var b = bold[dd.row.index]; if (b === 'g') { dd.cell.styles.fillColor = [242, 243, 247]; dd.cell.styles.fontStyle = 'bold'; dd.cell.styles.textColor = [87, 93, 121]; } if (b === 't') { dd.cell.styles.fontStyle = 'bold'; dd.cell.styles.fillColor = [232, 234, 242]; } } });
    var y = doc.lastAutoTable.finalY + 8;
    doc.setFillColor(242, 92, 42); doc.rect(36, y, W - 72, 24, 'F'); doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text(T.net, 46, y + 16); doc.text(U.fmt(s.totals.net) + ' XAF', W - 46, y + 16, { align: 'right' });
    y += 34; doc.setTextColor(18, 22, 46); doc.setFont('helvetica', 'italic'); doc.setFontSize(7.5);
    if (!en && App.words) { doc.text(doc.splitTextToSize(T.words + ' : ' + App.words(s.totals.net) + ' francs CFA.', W - 72), 36, y); y += 14; }
    doc.autoTable({ startY: y, margin: { left: 36, right: W / 2 + 10 }, theme: 'grid', styles: { fontSize: 7.2, cellPadding: 2.4, halign: 'right' }, headStyles: { fillColor: [242, 243, 247], textColor: [18, 22, 46] }, head: [[T.leave, T.acq, T.taken, T.bal]], body: [['', String(s.leave.acquired).replace('.', ','), String(s.leave.taken), String(s.leave.after).replace('.', ',')]] });
    var y2 = doc.lastAutoTable.finalY + 6;
    doc.autoTable({ startY: y2, margin: { left: 36, right: W / 2 + 10 }, theme: 'grid', styles: { fontSize: 7.2, cellPadding: 2.4 }, columnStyles: { 1: { halign: 'right' } }, headStyles: { fillColor: [242, 243, 247], textColor: [18, 22, 46] }, head: [[T.cum + ' ' + p.year, '']], body: [[T.brut, U.fmt(s.cumuls.brut)], [T.taxable, U.fmt(s.cumuls.taxable)], ['IRPP + CAC', U.fmt(s.cumuls.irpp)], [T.net, U.fmt(s.cumuls.net)], [T.cost + ' (' + P.monthLabel(key, en) + ')', U.fmt(s.totals.cost)]] });
    var sx = W / 2 + 20;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
    if (s.signed) {
      try { if (sg && sg.cachet && sg.sigId !== 'historique') doc.addImage(sg.cachet, 'PNG', sx + 10, y, 88, 88); if (sg && sg.signature) doc.addImage(sg.signature, 'PNG', sx + 70, y + 18, 150, 60); } catch (x) { /* images facultatives */ }
      doc.text([T.signed + ' ' + s.signed.by, new Date(s.signed.at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) + ' · empreinte ' + s.signed.hash], sx, y + 100);
    } else if (P.isFrozen(p)) { doc.setTextColor(176, 39, 30); doc.text(T.unsigned, sx, y + 40); doc.setTextColor(18, 22, 46); }
    doc.setFontSize(7); doc.setTextColor(138, 143, 168); doc.text(T.keep, W / 2, H - 30, { align: 'center' }); doc.text('myyiel Paie · ' + co.name + ' · ' + e.matricule + ' · ' + key + (s.hash ? ' · ' + s.hash : ''), W / 2, H - 20, { align: 'center' });
  };
  App.slipsPdf = function (key, ids, filename, lang) {
    if (!window.jspdf) { App.toast('Module PDF indisponible.', 'bad'); return; }
    var doc = new window.jspdf.jsPDF({ unit: 'pt', format: 'a4' }), p = P.D(S(), cid()).periods[key];
    ids.forEach(function (id, i) { App.slipPdfPage(doc, key, p.slips[id], lang, i === 0); });
    return App.save(filename, doc.output('blob'));
  };
  A['slip-pdf'] = function (el) { var e = P.emp(S(), cid(), el.dataset.id); App.slipsPdf(el.dataset.k, [el.dataset.id], 'bulletin_' + e.matricule + '_' + el.dataset.k + '.pdf', App.v('slipLang', 'fr')); };
  App.slipMessage = function (key, s, channel) {
    var e = P.emp(S(), cid(), s.empId), co = App.co(), code = s.signed ? s.signed.hash.slice(0, 6).toUpperCase() : '';
    var link = 'https://app.myyiel.com/b/' + U.fnv(s.empId + key).slice(0, 8) + key.replace('-', '');
    return channel === 'whatsapp'
      ? 'Bonjour ' + e.prenoms + ', votre bulletin de paie de ' + P.monthLabel(key) + ' est disponible : ' + link + '\nCode d’accès personnel : ' + code + ' (valable 7 jours).\nNet versé : ' + U.fmt(s.totals.net) + ' XAF.\n' + co.name + ' · Ressources humaines'
      : 'Objet : Votre bulletin de paie · ' + P.monthLabel(key) + '\n\nBonjour ' + (e.civilite || '') + ' ' + P.fullName(e) + ',\n\nVeuillez trouver ci-joint votre bulletin de paie de ' + P.monthLabel(key) + ', signé électroniquement par la Direction des ressources humaines.\nLe fichier PDF est protégé par votre code personnel : ' + code + '.\n\nPour toute question, répondez à ce message ou écrivez à paie@yielgroup.com.\n\nCordialement,\nService paie · ' + co.name;
  };
  A['slip-send'] = function (el) {
    var key = el.dataset.k, s = P.D(S(), cid()).periods[key].slips[el.dataset.id], c = el.dataset.c, e = P.emp(S(), cid(), s.empId);
    if (!s.signed) return App.toast('Bulletin non signé par la DRH : envoi impossible.', 'bad');
    var to = c === 'whatsapp' ? (e.whatsapp || e.telephone) : e.email;
    App.drawer({ title: (c === 'whatsapp' ? 'WhatsApp' : 'E-mail') + ' · ' + P.fullName(e), sub: 'Destinataire : ' + (to || 'non renseigné'), body: '<div class="callout info">' + App.ic('shield') + '<span>Le message contient un lien sécurisé et un code personnel ; le bulletin n’est jamais joint en clair. En production, l’envoi passe par l’API e-mail / WhatsApp Business de myyiel.</span></div><textarea class="in" id="send_ta" style="min-height:230px">' + esc(App.slipMessage(key, s, c)) + '</textarea>',
      foot: '<button type="button" class="btn" data-act="close-drawer">Fermer</button><button type="button" class="btn" data-act="slip-copy">' + App.ic('copy') + 'Copier</button><button type="button" class="btn acc" data-act="slip-mark" data-k="' + key + '" data-id="' + s.empId + '" data-c="' + c + '"' + (to ? '' : ' disabled') + '>Marquer comme envoyé</button>' });
  };
  A['slip-copy'] = function () { var t = document.getElementById('send_ta'); if (t) App.copy(t.value); };
  A['slip-mark'] = function (el) { App.closeDrawer(true); App.run(function () { return P.markSent(S(), cid(), el.dataset.k, [el.dataset.id], el.dataset.c); }, 'Envoi enregistré.'); };

  /* ------------------------------------------------------- bordereau de virement */
  App.orderPdf = function (o) {
    if (!window.jspdf) { App.toast('Module PDF indisponible.', 'bad'); return; }
    var d = P.D(S(), cid()), adv = d.advisors.find(function (a) { return a.id === o.advisorId; }) || {}, co = App.co(), named = o.confidentiality === 'nom';
    var doc = new window.jspdf.jsPDF({ unit: 'pt', format: 'a4' }), W = doc.internal.pageSize.getWidth();
    try { if (window.YIEL_LOGO_LIGHT) doc.addImage(window.YIEL_LOGO_LIGHT, 'PNG', 40, 34, 74, 28); } catch (x) { /* logo */ }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(18, 22, 46);
    doc.text([co.name, co.address || '', 'NIU ' + co.niu], 40, 78);
    doc.setFontSize(10);
    doc.text([((P.est(S(), cid(), 'DLA') || {}).city || 'Douala') + ', le ' + App.date(App.today()), 'À l’attention de ' + (adv.nom || 'M. le conseiller'), adv.bank || 'Banque', adv.agence || ''], W - 40, 60, { align: 'right' });
    doc.setFont('helvetica', 'bold'); doc.text('Objet :', 40, 150); doc.text('Compte N° :', 40, 166); doc.text('Référence :', 40, 182);
    doc.setFont('helvetica', 'normal'); doc.text(o.motif, 110, 150); doc.text(co.iban || (Y.bankAccount(S(), cid(), o.bankAccount) || {}).iban || '[RIB du compte débité]', 110, 166); doc.text(o.ref + ' · exécution souhaitée le ' + App.date(o.executionDate), 110, 182);
    doc.text(doc.splitTextToSize('Madame, Monsieur,\n\nPar le débit du compte cité en objet, nous vous prions de bien vouloir effectuer les virements ci-dessous :', W - 80), 40, 210);
    var items = o.items.filter(function (i) { return i.mode === 'virement'; });
    doc.autoTable({ startY: 252, margin: { left: 40, right: 40 }, theme: 'grid', head: [[named ? 'Nom et prénoms' : 'Matricule', 'Montant (XAF)', 'Numéro du RIB', 'Banque', 'Agence']],
      body: items.map(function (i) { return [named ? i.name : i.matricule, U.fmt(i.amount), [i.codeBanque, i.guichet, i.compte, i.cle].join(' '), i.banque, i.agence]; }).concat([[{ content: 'Total · ' + items.length + ' virement(s)', styles: { fontStyle: 'bold' } }, { content: U.fmt(o.totals.virement), styles: { fontStyle: 'bold', halign: 'right' } }, '', '', '']]),
      styles: { fontSize: 8.5, cellPadding: 3.2, lineColor: [120, 124, 140], lineWidth: 0.4, textColor: [18, 22, 46] }, headStyles: { fillColor: [214, 218, 228], textColor: [18, 22, 46], fontStyle: 'bold', halign: 'center' }, columnStyles: { 1: { halign: 'right' }, 2: { font: 'courier' } } });
    var y = doc.lastAutoTable.finalY + 18;
    if (o.totals.momo) { doc.setFontSize(9); doc.text('Paiements Mobile Money (' + o.items.filter(function (i) { return i.mode === 'momo'; }).length + ') : ' + U.fmt(o.totals.momo) + ' XAF, transmis séparément par lot opérateur.', 40, y); y += 14; }
    if (o.comment) { doc.setFont('helvetica', 'italic'); doc.text(doc.splitTextToSize('Commentaire : ' + o.comment, W - 80), 40, y); y += 20; doc.setFont('helvetica', 'normal'); }
    doc.setFontSize(10); doc.text(doc.splitTextToSize('Vous en remerciant par avance, nous vous prions d’agréer, Madame, Monsieur, l’expression de nos salutations distinguées.', W - 80), 40, y + 8);
    doc.setFont('helvetica', 'bold'); doc.text('La Direction des ressources humaines', W - 40, y + 60, { align: 'right' }); doc.text('La Direction administrative et financière', 40, y + 60);
    var sg = d.signature; try { if (sg && sg.signature && o.status !== 'brouillon' && o.status !== 'soumis') doc.addImage(sg.signature, 'PNG', W - 200, y + 66, 140, 56); if (sg && sg.cachet && o.status !== 'brouillon' && o.status !== 'soumis') doc.addImage(sg.cachet, 'PNG', W - 300, y + 62, 80, 80); } catch (x) { /* images */ }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(138, 143, 168);
    doc.text('Confidentialité : ' + (named ? 'noms des bénéficiaires communiqués' : 'bénéficiaires identifiés par matricule uniquement') + ' · ' + o.ref + ' · myyiel Paie', 40, doc.internal.pageSize.getHeight() - 24);
    return App.save('bordereau_' + o.ref + '.pdf', doc.output('blob'));
  };
})();

/*
 * myyiel Comptabilité · opérations métier qui génèrent des écritures :
 * facturation, achats, paie, trésorerie et rapprochement, immobilisations, TVA, analytique.
 * Schémas d'écritures : docs/03-schemas-d-ecritures.md
 */
import { Y } from './registry.js';

var U = Y.util;
function fail(m) { throw new Y.BizError(m); }

Y.taxCode = function (S, cid, code) { return Y.D(S, cid).taxCodes.find(function (t) { return t.code === code; }); };
function taxOf(S, cid, code, base) { var t = Y.taxCode(S, cid, code); return t && t.rate ? U.round(base * t.rate / 100) : 0; }

/* ------------------------------------------------------------- articles */
Y.createItem = function (S, cid, it) {
  var d = Y.D(S, cid), errs = [];
  if (!it.code) errs.push('Le code article est obligatoire.');
  if (d.items.some(function (x) { return x.code === it.code; })) errs.push('Le code ' + it.code + ' existe déjà.');
  if (!it.label) errs.push('La désignation est obligatoire.');
  if (!/^70/.test(it.account || '')) errs.push('Le compte de produit doit appartenir aux comptes 70.');
  if (errs.length) fail(errs);
  var rec = Object.assign({ unit: 'unité', price: 0, taxCode: 'TVA19', section: '', active: true }, it, { price: U.round(it.price) });
  d.items.push(rec);
  Y.audit(S, cid, 'Création', 'Article ' + rec.code, rec.label);
  return rec;
};

/* ----------------------------------------------------------- facturation */
Y.docTotals = function (S, cid, doc) {
  var brut = 0, rem = 0, ht = 0, tva = 0, byTax = {};
  (doc.lines || []).forEach(function (l) {
    var b = U.round((+l.qty || 0) * (+l.price || 0));
    var r = U.round(b * (+l.discount || 0) / 100);
    var h = b - r, t = taxOf(S, cid, l.taxCode, h);
    brut += b; rem += r; ht += h; tva += t;
    var k = l.taxCode || 'HC'; byTax[k] = byTax[k] || { base: 0, tax: 0 }; byTax[k].base += h; byTax[k].tax += t;
  });
  return { brut: brut, remise: rem, ht: ht, tva: tva, ttc: ht + tva, byTax: byTax };
};
Y.docPaid = function (doc) { return U.sum(doc.payments || [], function (p) { return p.amount; }); };
Y.docStatus = function (S, cid, doc) {
  if (doc.status === 'draft') return { key: 'draft', label: 'Brouillon', tone: 'neu' };
  if (doc.type === 'DV') {
    if (doc.status === 'accepted') return { key: 'accepted', label: 'Accepté', tone: 'ok' };
    if (doc.status === 'refused') return { key: 'refused', label: 'Refusé', tone: 'bad' };
    if (doc.status === 'invoiced') return { key: 'invoiced', label: 'Facturé', tone: 'ok' };
    if (doc.due && doc.due < S.meta.today) return { key: 'expired', label: 'Expiré', tone: 'neu' };
    return { key: 'sent', label: 'Envoyé', tone: 'info' };
  }
  if (doc.type === 'AV') return { key: 'emitted', label: doc.applied ? 'Imputé' : 'Émis', tone: 'ok' };
  var ttc = Y.docTotals(S, cid, doc).ttc, paid = Y.docPaid(doc);
  if (paid >= ttc) return { key: 'paid', label: 'Payée', tone: 'ok' };
  if (doc.due && doc.due < S.meta.today) return { key: 'late', label: paid ? 'En retard · partielle' : 'En retard', tone: 'bad' };
  if (paid) return { key: 'partial', label: 'Partiellement payée', tone: 'warn' };
  return { key: 'emitted', label: 'Émise', tone: 'info' };
};
Y.saveDoc = function (S, cid, doc) {
  var d = Y.D(S, cid);
  var rec = Object.assign({ id: U.uid('doc'), type: 'FA', status: 'draft', num: '', date: S.meta.today, due: '', terms: 30, tiersId: '', ref: '', section: '', lines: [], notes: '', pay: { momo: true, om: true, bank: true, cash: false }, payments: [], createdAt: new Date().toISOString() }, doc);
  var i = d.docs.findIndex(function (x) { return x.id === rec.id; });
  if (i > -1) { if (d.docs[i].status !== 'draft' && d.docs[i].type !== 'DV') fail('Un document émis ne se modifie plus : créez un avoir.'); d.docs[i] = rec; } else d.docs.push(rec);
  return rec;
};
Y.doc = function (S, cid, id) { return Y.D(S, cid).docs.find(function (x) { return x.id === id || x.num === id; }); };
Y.emitDoc = function (S, cid, id, opts) {
  var d = Y.D(S, cid), doc = Y.doc(S, cid, id); opts = opts || {};
  if (!doc) fail('Document introuvable');
  if (doc.status !== 'draft') fail('Document déjà émis.');
  var errs = [];
  if (!doc.tiersId) errs.push('Choisissez un client.');
  if (!doc.lines.length) errs.push('Ajoutez au moins une ligne.');
  doc.lines.forEach(function (l, i) { if (!l.label) errs.push('Ligne ' + (i + 1) + ' : désignation manquante.'); if (!(+l.qty > 0)) errs.push('Ligne ' + (i + 1) + ' : quantité invalide.'); });
  var t = Y.docTotals(S, cid, doc);
  if (t.ttc <= 0) errs.push('Montant total nul.');
  if (errs.length) fail(errs);
  var y = U.year(doc.date), seq = d.settings.docSeq[doc.type];
  seq[y] = (seq[y] || 0) + 1;
  doc.num = doc.type + '-' + y + '-' + U.pad(seq[y], 4);
  if (!doc.due) doc.due = U.addDays(doc.date, +doc.terms || 0);
  if (doc.type === 'DV') { doc.status = 'sent'; Y.audit(S, cid, 'Émission', doc.num, 'Devis ' + U.fmt(t.ttc)); return doc; }
  var av = doc.type === 'AV', tiers = Y.tiers(S, cid, doc.tiersId);
  var lines = [{ account: tiers.collective || '4111', tiersId: tiers.id, label: tiers.name + ' · ' + doc.num, debit: av ? 0 : t.ttc, credit: av ? t.ttc : 0, due: doc.due }];
  var byAcc = {};
  doc.lines.forEach(function (l) {
    var acc = l.account || '7068', k = acc + '|' + (l.section || doc.section || '') + '|' + (l.taxCode || '');
    var b = U.round((+l.qty) * (+l.price)), h = b - U.round(b * (+l.discount || 0) / 100);
    byAcc[k] = (byAcc[k] || 0) + h;
  });
  Object.keys(byAcc).forEach(function (k) {
    var p = k.split('|'); if (!byAcc[k]) return;
    lines.push({ account: p[0], section: p[1], taxCode: p[2], label: doc.num + ' · ' + Y.accountLabel(S, cid, p[0]), debit: av ? byAcc[k] : 0, credit: av ? 0 : byAcc[k] });
  });
  Object.keys(t.byTax).forEach(function (code) {
    var tc = Y.taxCode(S, cid, code); var tax = t.byTax[code].tax;
    if (tax && tc && tc.collect) lines.push({ account: tc.collect, taxCode: code, label: 'TVA ' + String(tc.rate).replace('.', ',') + ' % · ' + doc.num, debit: av ? tax : 0, credit: av ? 0 : tax });
  });
  var e = Y.postEntry(S, cid, { journal: 'VTE', date: doc.date, pieceDate: doc.date, ref: doc.num, label: (av ? 'Avoir ' : 'Facture ') + doc.num + ' · ' + tiers.name, lines: lines, source: av ? 'credit-note' : 'invoice', docId: doc.id }, { silent: true });
  doc.status = 'emitted'; doc.entryId = e.id; doc.entryNum = e.num;
  Y.audit(S, cid, 'Émission', doc.num, (av ? 'Avoir' : 'Facture') + ' ' + U.fmt(t.ttc) + ' · écriture ' + e.num);
  if (av && doc.originId) {
    var orig = Y.doc(S, cid, doc.originId);
    if (orig) { orig.payments = orig.payments || []; orig.payments.push({ date: doc.date, amount: t.ttc, method: 'avoir', entryId: e.id, ref: doc.num }); doc.applied = true; tryLetterDoc(S, cid, orig); }
  }
  return doc;
};
Y.convertQuote = function (S, cid, id) {
  var q = Y.doc(S, cid, id); if (!q || q.type !== 'DV') fail('Devis introuvable');
  var f = Y.saveDoc(S, cid, { type: 'FA', tiersId: q.tiersId, ref: q.num, section: q.section, lines: U.clone(q.lines), notes: q.notes, terms: q.terms, pay: U.clone(q.pay), originId: q.id });
  q.status = 'invoiced';
  Y.audit(S, cid, 'Conversion', q.num, 'Facture brouillon créée');
  return f;
};
Y.creditNoteFrom = function (S, cid, id) {
  var f = Y.doc(S, cid, id); if (!f || f.type !== 'FA' || f.status === 'draft') fail('Facture émise introuvable');
  return Y.saveDoc(S, cid, { type: 'AV', tiersId: f.tiersId, ref: f.num, section: f.section, lines: U.clone(f.lines), notes: 'Avoir sur ' + f.num, originId: f.id, terms: 0 });
};
Y.PAY_METHODS = {
  bank: { journal: 'BQ1', account: '5211', label: 'Virement bancaire', feeRate: 0 },
  bank2: { journal: 'BQ2', account: '5212', label: 'Banque secondaire', feeRate: 0 },
  momo: { journal: 'MTN', account: '5521', label: 'MTN Mobile Money', feeRate: 1 },
  om: { journal: 'OM', account: '5522', label: 'Orange Money', feeRate: 1 },
  cash: { journal: 'CAI', account: '5711', label: 'Espèces', feeRate: 0 }
};
function tryLetterDoc(S, cid, doc) {
  var ttc = Y.docTotals(S, cid, doc).ttc;
  if (Y.docPaid(doc) !== ttc) return;
  var refs = [];
  var e = Y.entry(S, cid, doc.entryId);
  if (!e) return;
  var tiers = Y.tiers(S, cid, doc.tiersId);
  var collective = tiers.collective || '4111';
  e.lines.forEach(function (l, i) { if (l.account === collective && !l.letter) refs.push({ entryId: e.id, idx: i }); });
  doc.payments.forEach(function (p) { var pe = Y.entry(S, cid, p.entryId); if (pe) pe.lines.forEach(function (l, i) { if (l.account === collective && l.tiersId === doc.tiersId && !l.letter) refs.push({ entryId: pe.id, idx: i }); }); });
  try { Y.letterLines(S, cid, refs); } catch (err) { /* lettrage laissé au comptable */ }
}
Y.registerPayment = function (S, cid, docId, p) {
  var doc = Y.doc(S, cid, docId); if (!doc || doc.type !== 'FA' || doc.status === 'draft') fail('Facture émise introuvable');
  var ttc = Y.docTotals(S, cid, doc).ttc, rest = ttc - Y.docPaid(doc);
  var amount = U.round(p.amount || rest);
  if (amount <= 0) fail('Montant invalide.');
  if (amount > rest) fail('Le règlement (' + U.fmt(amount) + ') dépasse le reste dû (' + U.fmt(rest) + ').');
  var m = Y.PAY_METHODS[p.method || 'bank']; if (!m) fail('Moyen de paiement inconnu');
  var fees = p.fees !== undefined ? U.round(p.fees) : U.round(amount * m.feeRate / 100);
  var tiers = Y.tiers(S, cid, doc.tiersId);
  var lines = [{ account: m.account, label: m.label + ' · ' + doc.num, debit: amount - fees, credit: 0 }];
  if (fees) lines.push({ account: '631', label: 'Frais ' + m.label, debit: fees, credit: 0, section: 'STR' });
  lines.push({ account: tiers.collective || '4111', tiersId: tiers.id, label: 'Règlement ' + doc.num, debit: 0, credit: amount });
  var e = Y.postEntry(S, cid, { journal: m.journal, date: p.date || S.meta.today, ref: doc.num, label: 'Encaissement ' + doc.num + ' · ' + tiers.name, lines: lines, source: 'payment', docId: doc.id, extRef: p.extRef || '' }, { silent: true });
  doc.payments = doc.payments || [];
  doc.payments.push({ date: e.date, amount: amount, fees: fees, method: p.method || 'bank', entryId: e.id, ref: e.num, extRef: p.extRef || '' });
  tryLetterDoc(S, cid, doc);
  Y.audit(S, cid, 'Encaissement', doc.num, U.fmt(amount) + ' · ' + m.label + ' · ' + e.num);
  return e;
};

/* -------------------------------------------------------------- achats */
Y.postPurchase = function (S, cid, p) {
  var tiers = Y.tiers(S, cid, p.tiersId); if (!tiers) fail('Fournisseur introuvable');
  var lines = [], tvaG = 0, tvaA = 0, ttc = 0, isImmo = false;
  p.lines.forEach(function (l) {
    var ht = U.round(l.ht), t = taxOf(S, cid, l.taxCode, ht);
    if (/^2/.test(l.account)) { isImmo = true; tvaA += t; } else tvaG += t;
    ttc += ht + t;
    lines.push({ account: l.account, label: l.label || p.label, debit: ht, credit: 0, section: l.section || '', taxCode: l.taxCode || '' });
  });
  if (tvaG) lines.push({ account: '4452', label: 'TVA récupérable · ' + (p.ref || ''), debit: tvaG, credit: 0, taxCode: 'TVA19' });
  if (tvaA) lines.push({ account: '4451', label: 'TVA récupérable immobilisations · ' + (p.ref || ''), debit: tvaA, credit: 0, taxCode: 'TVA19' });
  var col = isImmo ? '481' : (tiers.collective || '4011');
  lines.push({ account: col, tiersId: tiers.id, label: tiers.name + ' · ' + (p.ref || ''), debit: 0, credit: ttc, due: p.due || U.addDays(p.date, +tiers.terms || 30) });
  return Y.postEntry(S, cid, { journal: isImmo ? 'IMMO' : 'ACH', date: p.date, pieceDate: p.pieceDate || p.date, ref: p.ref || '', label: p.label, lines: lines, source: p.source || 'purchase', attachments: p.attachments || [] }, { silent: !!p.silent });
};
Y.paySupplier = function (S, cid, p) {
  var tiers = Y.tiers(S, cid, p.tiersId); if (!tiers) fail('Fournisseur introuvable');
  var m = Y.PAY_METHODS[p.method || 'bank'];
  var e = Y.postEntry(S, cid, { journal: m.journal, date: p.date, ref: p.ref || '', label: 'Règlement ' + tiers.name + (p.ref ? ' · ' + p.ref : ''), lines: [
    { account: p.collective || tiers.collective || '4011', tiersId: tiers.id, label: 'Règlement ' + (p.ref || ''), debit: U.round(p.amount), credit: 0 },
    { account: m.account, label: 'Paiement ' + tiers.name, debit: 0, credit: U.round(p.amount) }
  ], source: 'supplier-payment' }, { silent: !!p.silent });
  if (p.letterRef) {
    var refs = [{ entryId: e.id, idx: 0 }];
    Y.eachLine(S, cid, function (l, en, idx) { if (!l.letter && l.tiersId === tiers.id && en.ref === p.letterRef && l.credit === U.round(p.amount)) refs.push({ entryId: en.id, idx: idx }); }, { account: p.collective || tiers.collective || '4011' });
    if (refs.length === 2) Y.letterLines(S, cid, refs);
  }
  return e;
};

/* ---------------------------------------------------------------- paie */
Y.postPayroll = function (S, cid, p) {
  var d = Y.D(S, cid);
  var staff = d.tiers.find(function (t) { return t.code === 'P0000'; }) || Y.createTiers(S, cid, { type: 'personnel', code: 'P0000', name: 'Personnel · centralisation de la paie', collective: '422' });
  var net = p.gross - p.cnpsEmployee - p.irpp;
  return Y.postEntry(S, cid, { journal: 'PAIE', date: p.date, ref: p.ref, label: p.label || 'Centralisation de la paie', source: 'payroll', lines: [
    { account: '661', label: 'Salaires bruts', debit: p.gross, credit: 0, section: p.section || 'STR' },
    { account: '664', label: 'Charges patronales', debit: p.employer, credit: 0, section: p.section || 'STR' },
    { account: '431', label: 'CNPS · parts salariale et patronale', debit: 0, credit: p.cnpsEmployee + p.employer },
    { account: '447', label: 'IRPP et taxes retenus à la source', debit: 0, credit: p.irpp },
    { account: '422', tiersId: staff.id, label: 'Salaires nets à payer', debit: 0, credit: net }
  ] }, { silent: !!p.silent });
};

/* ---------------------------------------------------------- trésorerie */
Y.createBankAccount = function (S, cid, b) {
  var d = Y.D(S, cid), errs = [];
  if (!b.label) errs.push('Le nom du compte est obligatoire.');
  if (!/^5[257]\d{2,}$/.test(b.account || '')) errs.push('Le compte comptable doit être un sous-compte de 52, 55 ou 57.');
  if (d.bankAccounts.some(function (x) { return x.account === b.account; })) errs.push('Le compte ' + b.account + ' est déjà relié.');
  if (errs.length) fail(errs);
  if (!Y.account(S, cid, b.account)) Y.createAccount(S, cid, { num: b.account, label: b.label });
  var j = b.journal;
  if (!j) {
    j = b.account === '5211' ? 'BQ1' : (b.account === '5212' ? 'BQ2' : null);
    if (!j || !Y.journal(S, cid, j)) {
      j = 'T' + b.account.slice(-3);
      if (!Y.journal(S, cid, j)) d.journals.push({ code: j, label: b.label, type: 'bank', counterpart: b.account, seqFormat: j + '-{YYYY}-{0000}', source: 'Trésorerie', active: true, seq: {} });
    }
  }
  var rec = Object.assign({ id: U.uid('bk'), kind: 'bank', provider: '', iban: '', holder: '', syncMode: 'import', lastSync: '', openingStatement: 0, alertBelow: 0, currency: 'XAF' }, b, { journal: j });
  d.bankAccounts.push(rec);
  Y.audit(S, cid, 'Création', 'Compte de trésorerie ' + rec.account, rec.label);
  return rec;
};
Y.bankAccount = function (S, cid, id) { return Y.D(S, cid).bankAccounts.find(function (b) { return b.id === id || b.account === id; }); };
Y.importStatement = function (S, cid, bankId, rows) {
  var d = Y.D(S, cid), b = Y.bankAccount(S, cid, bankId); if (!b) fail('Compte de trésorerie introuvable');
  var added = 0, skipped = 0, errors = [];
  rows.forEach(function (r, i) {
    var date = r.date, amount = U.round(r.amount);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) { errors.push('Ligne ' + (i + 1) + ' : date invalide (attendu AAAA-MM-JJ ou JJ/MM/AAAA).'); return; }
    if (!amount) { errors.push('Ligne ' + (i + 1) + ' : montant nul ou illisible.'); return; }
    var key = U.fnv(b.id + date + amount + (r.ref || '') + (r.label || ''));
    if (d.bankTx.some(function (t) { return t.key === key; })) { skipped++; return; }
    d.bankTx.push({ id: U.uid('tx'), key: key, bankId: b.id, date: date, label: r.label || '', ref: r.ref || '', amount: amount, status: 'open', entryId: '', idx: -1, importedAt: new Date().toISOString() });
    added++;
  });
  b.lastSync = new Date().toISOString();
  Y.audit(S, cid, 'Import de relevé', b.label, added + ' lignes ajoutées · ' + skipped + ' doublons ignorés');
  return { added: added, skipped: skipped, errors: errors };
};
Y.unreconciledBookLines = function (S, cid, bankId) {
  var b = Y.bankAccount(S, cid, bankId), out = [];
  Y.eachLine(S, cid, function (l, e, idx) { if (!l.rec && e.journal !== 'AN') out.push({ entryId: e.id, num: e.num, idx: idx, date: e.date, label: l.label || e.label, amount: l.debit - l.credit, ref: e.ref }); }, { account: b.account });
  return out;
};
Y.reconcile = function (S, cid, txId, entryId, idx) {
  var d = Y.D(S, cid), tx = d.bankTx.find(function (t) { return t.id === txId; });
  var e = Y.entry(S, cid, entryId), l = e && e.lines[idx];
  if (!tx || !l) fail('Ligne introuvable');
  if (tx.status === 'matched') fail('Ligne de relevé déjà rapprochée.');
  if (l.rec) fail('Ligne comptable déjà rapprochée.');
  if (l.debit - l.credit !== tx.amount) fail('Montants différents : ' + U.fmt(tx.amount) + ' au relevé, ' + U.fmt(l.debit - l.credit) + ' en comptabilité.');
  tx.status = 'matched'; tx.entryId = e.id; tx.idx = idx; l.rec = tx.id;
  Y.audit(S, cid, 'Rapprochement', e.num, (tx.ref || tx.label) + ' · ' + U.fmt(tx.amount));
  return tx;
};
Y.unreconcile = function (S, cid, txId) {
  var d = Y.D(S, cid), tx = d.bankTx.find(function (t) { return t.id === txId; });
  if (!tx || tx.status !== 'matched') fail('Ligne non rapprochée');
  var e = Y.entry(S, cid, tx.entryId); if (e && e.lines[tx.idx]) e.lines[tx.idx].rec = '';
  tx.status = 'open'; tx.entryId = ''; tx.idx = -1;
  Y.audit(S, cid, 'Annulation de rapprochement', tx.ref || tx.label, '');
};
Y.ruleFor = function (S, cid, tx) {
  var b = Y.bankAccount(S, cid, tx.bankId);
  return Y.D(S, cid).bankRules.find(function (r) {
    return r.active && (!r.accounts || !r.accounts.length || r.accounts.indexOf(b.account) > -1) &&
      (tx.label + ' ' + tx.ref).toLowerCase().indexOf(String(r.contains).toLowerCase()) > -1 && (!r.sign || (r.sign === 'in' ? tx.amount > 0 : tx.amount < 0));
  });
};
Y.createFromTx = function (S, cid, txId, p) {
  var d = Y.D(S, cid), tx = d.bankTx.find(function (t) { return t.id === txId; });
  if (!tx) fail('Ligne de relevé introuvable');
  var b = Y.bankAccount(S, cid, tx.bankId), amt = Math.abs(tx.amount), lines = [];
  var tc = p.taxCode && Y.taxCode(S, cid, p.taxCode), ht = amt, tva = 0;
  if (tc && tc.rate && tx.amount < 0) { ht = U.round(amt / (1 + tc.rate / 100)); tva = amt - ht; }
  if (tx.amount > 0) {
    lines.push({ account: b.account, label: tx.label, debit: amt, credit: 0 });
    lines.push({ account: p.account, tiersId: p.tiersId || '', section: p.section || '', label: p.label || tx.label, debit: 0, credit: amt });
  } else {
    lines.push({ account: p.account, tiersId: p.tiersId || '', section: p.section || '', taxCode: p.taxCode || '', label: p.label || tx.label, debit: ht, credit: 0 });
    if (tva) lines.push({ account: tc.deductGoods || '4452', label: 'TVA récupérable', debit: tva, credit: 0, taxCode: tc.code });
    lines.push({ account: b.account, label: tx.label, debit: 0, credit: amt });
  }
  var e = Y.postEntry(S, cid, { journal: b.journal, date: tx.date, ref: tx.ref, label: p.label || tx.label, lines: lines, source: 'bank' });
  var idx = e.lines.findIndex(function (l) { return l.account === b.account; });
  Y.reconcile(S, cid, tx.id, e.id, idx);
  var r = Y.ruleFor(S, cid, tx); if (r) r.uses = (r.uses || 0) + 1;
  return e;
};
Y.autoReconcile = function (S, cid, bankId) {
  var d = Y.D(S, cid), b = Y.bankAccount(S, cid, bankId), n = 0;
  var book = Y.unreconciledBookLines(S, cid, b.id);
  d.bankTx.filter(function (t) { return t.bankId === b.id && t.status === 'open'; }).forEach(function (t) {
    var cands = book.filter(function (x) { return !x.used && x.amount === t.amount && Math.abs(U.daysBetween(x.date, t.date)) <= 10; });
    var best = cands.find(function (x) { return t.ref && (x.ref === t.ref || x.label.indexOf(t.ref) > -1 || t.label.indexOf(x.ref || '#') > -1); }) || (cands.length === 1 ? cands[0] : null);
    if (best) { Y.reconcile(S, cid, t.id, best.entryId, best.idx); best.used = true; n++; }
  });
  return n;
};
Y.reconState = function (S, cid, bankId, date) {
  var d = Y.D(S, cid), b = Y.bankAccount(S, cid, bankId); date = date || S.meta.today;
  var txs = d.bankTx.filter(function (t) { return t.bankId === b.id && t.date <= date; });
  var statement = (b.openingStatement || 0) + U.sum(txs, function (t) { return t.amount; });
  var bookBal = Y.net(S, cid, b.account, { to: date });
  var openTx = txs.filter(function (t) { return t.status === 'open'; });
  var openBook = Y.unreconciledBookLines(S, cid, b.id).filter(function (x) { return x.date <= date && x.date >= (b.reconFrom || '0000'); });
  var bankNotBooked = U.sum(openTx, function (t) { return t.amount; });
  var bookNotBank = U.sum(openBook, function (x) { return x.amount; });
  return { statement: statement, book: bookBal, openTx: openTx, openBook: openBook, bankNotBooked: bankNotBooked, bookNotBank: bookNotBank,
    statementAdj: statement + bookNotBank, bookAdj: bookBal + bankNotBooked, gap: (statement + bookNotBank) - (bookBal + bankNotBooked) };
};

/* ----------------------------------------------------- immobilisations */
Y.assetAccounts = function (num) {
  if (/^21/.test(num)) return { amort: '2813', dot: '6812' };
  if (/^245/.test(num)) return { amort: '2845', dot: '6813' };
  if (/^24/.test(num)) return { amort: '2844', dot: '6813' };
  if (/^23/.test(num)) return { amort: '283', dot: '6813' };
  return { amort: '28' + num.slice(1, 3), dot: '6813' };
};
Y.degCoef = function (years) { return years <= 4 ? 1.5 : (years <= 6 ? 2 : 2.5); };
Y.assetSchedule = function (a) {
  var rows = [], base = (a.value - (a.residual || 0)), vnc = base, cum = 0;
  var y = U.year(a.serviceDate), m = U.month(a.serviceDate), left = a.years * 12;
  while (left > 0 && vnc > 0) {
    var months = Math.min(y === U.year(a.serviceDate) ? 13 - m : 12, left), dot;
    if (a.method === 'D') {
      var rate = Y.degCoef(a.years) / a.years, lin = vnc / (left / 12);
      dot = Math.max(vnc * rate, lin) * months / 12;
    } else dot = base / a.years * months / 12;
    dot = Math.min(U.round(dot), U.round(vnc));
    if (left - months <= 0) dot = U.round(vnc);
    cum += dot; vnc -= dot; left -= months;
    rows.push({ year: y, months: months, base: a.method === 'D' ? vnc + dot : base, dot: dot, cum: cum, vnc: a.value - cum });
    y++;
  }
  return rows;
};
Y.assetMonthDot = function (a, y, m) {
  var r = Y.assetSchedule(a).find(function (x) { return x.year === y; });
  if (!r) return 0;
  var first = y === U.year(a.serviceDate) ? U.month(a.serviceDate) : 1;
  if (m < first || m >= first + r.months) return 0;
  var monthly = Math.floor(r.dot / r.months), idx = m - first;
  return idx === r.months - 1 ? r.dot - monthly * (r.months - 1) : monthly;
};
Y.assetCumAt = function (a, date) {
  var y = U.year(date), m = U.month(date), cum = a.priorDep || 0;
  Y.assetSchedule(a).forEach(function (r) {
    if (r.year < y) cum += r.dot;
    else if (r.year === y) { for (var k = 1; k <= m; k++) cum += Y.assetMonthDot(a, y, k); }
  });
  return Math.min(cum, a.value);
};
Y.createAsset = function (S, cid, a, opts) {
  var d = Y.D(S, cid), errs = [];
  if (!a.label) errs.push('La désignation est obligatoire.');
  if (!/^2[1-5]/.test(a.account || '')) errs.push('Le compte doit être une immobilisation amortissable (21 à 25).');
  if (!(U.round(a.value) > 0)) errs.push('La valeur d’origine doit être positive.');
  if (!(+a.years > 0)) errs.push('La durée d’utilité est obligatoire.');
  if (!a.serviceDate) errs.push('La date de mise en service est obligatoire.');
  if (errs.length) fail(errs);
  var acc = Y.assetAccounts(a.account);
  var rec = Object.assign({ id: U.uid('as'), code: 'IMM-' + U.pad(d.assets.length + 1, 3), method: 'L', residual: 0, acqDate: a.serviceDate, location: '', section: 'STR', supplierId: '', piece: '', status: 'active', posted: {}, priorDep: 0, amortAccount: acc.amort, dotAccount: acc.dot }, a, { value: U.round(a.value), years: +a.years });
  d.assets.push(rec);
  if (opts && opts.withEntry && rec.supplierId) {
    var e = Y.postPurchase(S, cid, { date: rec.acqDate, tiersId: rec.supplierId, ref: rec.piece, label: 'Acquisition ' + rec.label, lines: [{ account: rec.account, ht: rec.value, taxCode: opts.taxCode || 'TVA19', section: rec.section }], source: 'asset', silent: true });
    rec.entryNum = e.num;
  }
  Y.audit(S, cid, 'Création', 'Immobilisation ' + rec.code, rec.label + ' · ' + U.fmt(rec.value));
  return rec;
};
Y.depreciationRun = function (S, cid, y, m, opts) {
  var d = Y.D(S, cid), key = y + '-' + U.pad(m, 2), groups = {}, count = 0;
  d.assets.forEach(function (a) {
    if (a.status !== 'active' || a.posted[key]) return;
    var dot = Y.assetMonthDot(a, y, m);
    if (!dot) return;
    var k = a.dotAccount + '|' + a.amortAccount + '|' + (a.section || '');
    groups[k] = (groups[k] || 0) + dot; a.posted[key] = true; count++;
  });
  if (!count) return null;
  var lines = [];
  Object.keys(groups).forEach(function (k) {
    var p = k.split('|');
    lines.push({ account: p[0], section: p[2], label: 'Dotation ' + key, debit: groups[k], credit: 0 });
    lines.push({ account: p[1], label: 'Amortissement ' + key, debit: 0, credit: groups[k] });
  });
  return Y.postEntry(S, cid, { journal: 'OD', date: U.monthEnd(y, m), ref: 'DOT-' + key, label: 'Dotations aux amortissements · ' + U.MONTHS[m - 1] + ' ' + y, lines: lines, source: 'depreciation' }, { silent: !!(opts && opts.silent) });
};
Y.disposeAsset = function (S, cid, id, p) {
  var d = Y.D(S, cid), a = d.assets.find(function (x) { return x.id === id; });
  if (!a || a.status !== 'active') fail('Immobilisation active introuvable');
  var y = U.year(p.date), m = U.month(p.date);
  for (var k = 1; k <= m; k++) if (!a.posted[y + '-' + U.pad(k, 2)]) { var dot = Y.assetMonthDot(a, y, k); if (dot) { Y.postEntry(S, cid, { journal: 'OD', date: p.date, ref: a.code, label: 'Dotation complémentaire ' + a.code + ' · ' + U.pad(k, 2) + '/' + y, lines: [{ account: a.dotAccount, section: a.section, debit: dot, credit: 0 }, { account: a.amortAccount, debit: 0, credit: dot }], source: 'depreciation' }, { silent: true }); } a.posted[y + '-' + U.pad(k, 2)] = true; }
  var cum = Y.assetCumAt(a, p.date), vnc = a.value - cum, price = U.round(p.price || 0);
  var inc = /^21/.test(a.account);
  var lines = [];
  if (cum) lines.push({ account: a.amortAccount, label: 'Sortie des amortissements ' + a.code, debit: cum, credit: 0 });
  if (vnc) lines.push({ account: inc ? '811' : '812', label: 'Valeur comptable ' + a.code, debit: vnc, credit: 0 });
  lines.push({ account: a.account, label: 'Sortie de l’actif ' + a.code, debit: 0, credit: a.value });
  if (price > 0) {
    var buyer = p.tiersId ? p.tiersId : (d.tiers.find(function (t) { return t.code === 'C9999'; }) || Y.createTiers(S, cid, { type: 'client', code: 'C9999', name: 'Acquéreurs d’immobilisations', collective: '485' })).id;
    lines.push({ account: '485', tiersId: buyer, label: 'Prix de cession ' + a.code, debit: price, credit: 0 });
    lines.push({ account: inc ? '821' : '822', label: 'Produit de cession ' + a.code, debit: 0, credit: price });
  }
  var e = Y.postEntry(S, cid, { journal: 'IMMO', date: p.date, ref: a.code, label: (price ? 'Cession ' : 'Mise au rebut ') + a.label, lines: lines, source: 'disposal' }, { silent: true });
  a.status = 'disposed'; a.disposal = { date: p.date, price: price, kind: price ? 'cession' : 'rebut', entryNum: e.num, vnc: vnc, gain: price - vnc };
  Y.audit(S, cid, price ? 'Cession' : 'Mise au rebut', a.code, 'VNC ' + U.fmt(vnc) + ' · prix ' + U.fmt(price) + ' · ' + e.num);
  return e;
};

/* ---------------------------------------------------------------- TVA */
Y.vatReturn = function (S, cid, y, m) {
  var d = Y.D(S, cid), from = y + '-' + U.pad(m, 2) + '-01', to = U.monthEnd(y, m);
  var coll = 0, dedG = 0, dedA = 0, taxable = 0, exempt = 0, export_ = 0;
  Y.validated(S, cid).forEach(function (e) {
    if (e.date < from || e.date > to || e.source === 'vat' || e.journal === 'AN') return;
    e.lines.forEach(function (l) {
      if (/^443/.test(l.account)) coll += l.credit - l.debit;
      if (/^445[2-4]/.test(l.account)) dedG += l.debit - l.credit;
      if (/^4451/.test(l.account)) dedA += l.debit - l.credit;
      if (/^70/.test(l.account)) {
        var b = l.credit - l.debit;
        if (l.taxCode === 'TVA19') taxable += b; else if (l.taxCode === 'EXP') export_ += b; else exempt += b;
      }
    });
  });
  var prior = Math.max(0, Y.net(S, cid, '4449', { to: U.addDays(from, -1) }));
  var due = coll - dedG - dedA - prior;
  var key = y + '-' + U.pad(m, 2), st = d.vat[key] || { status: 'computed' };
  var split = function (n) { var p = U.round(n * 17.5 / 19.25); return { principal: p, cac: n - p }; };
  return { key: key, year: y, month: m, from: from, to: to, collected: coll, dedGoods: dedG, dedAssets: dedA, deductible: dedG + dedA, priorCredit: prior, due: due > 0 ? due : 0, credit: due < 0 ? -due : 0,
    taxable: taxable, exempt: exempt, export: export_, split: { collected: split(coll), deductible: split(dedG + dedA), due: split(Math.max(due, 0)) }, deadline: U.addDays(U.monthEnd(y, m), 15), status: st.status, entryNum: st.entryNum || '', paymentNum: st.paymentNum || '' };
};
Y.postVatLiquidation = function (S, cid, y, m, opts) {
  var d = Y.D(S, cid), r = Y.vatReturn(S, cid, y, m);
  if (d.vat[r.key] && d.vat[r.key].entryNum) fail('TVA ' + r.key + ' déjà liquidée (' + d.vat[r.key].entryNum + ').');
  var lines = [];
  if (r.collected) lines.push({ account: '4431', label: 'TVA collectée ' + r.key, debit: r.collected, credit: 0 });
  if (r.dedGoods) lines.push({ account: '4452', label: 'TVA déductible ' + r.key, debit: 0, credit: r.dedGoods });
  if (r.dedAssets) lines.push({ account: '4451', label: 'TVA déductible immobilisations ' + r.key, debit: 0, credit: r.dedAssets });
  if (r.priorCredit) lines.push({ account: '4449', label: 'Imputation du crédit antérieur', debit: 0, credit: r.priorCredit });
  if (r.due) lines.push({ account: '4441', label: 'TVA due ' + r.key, debit: 0, credit: r.due });
  if (r.credit) lines.push({ account: '4449', label: 'Crédit de TVA à reporter', debit: r.credit, credit: 0 });
  if (lines.length < 2) fail('Aucune TVA à liquider pour ' + r.key + '.');
  var e = Y.postEntry(S, cid, { journal: 'OD', date: r.to, ref: 'TVA-' + r.key, label: 'Liquidation de la TVA · ' + U.MONTHS[m - 1] + ' ' + y, lines: lines, source: 'vat' }, { silent: !!(opts && opts.silent) });
  d.vat[r.key] = { status: 'liquidated', entryNum: e.num, due: r.due };
  return e;
};
Y.postVatPayment = function (S, cid, y, m, date, opts) {
  var d = Y.D(S, cid), key = y + '-' + U.pad(m, 2), st = d.vat[key];
  if (!st || !st.entryNum) fail('Liquidez d’abord la TVA ' + key + '.');
  if (st.paymentNum) fail('TVA ' + key + ' déjà payée.');
  if (!st.due) { st.status = 'paid'; return null; }
  var e = Y.postEntry(S, cid, { journal: 'BQ1', date: date, ref: 'TVA-' + key, label: 'Paiement de la TVA ' + key + ' · DGI', lines: [{ account: '4441', label: 'TVA ' + key, debit: st.due, credit: 0 }, { account: '5211', label: 'Télépaiement DGI', debit: 0, credit: st.due }], source: 'vat-payment' }, { silent: !!(opts && opts.silent) });
  st.status = 'paid'; st.paymentNum = e.num;
  return e;
};

/* ---------------------------------------------------------- analytique */
Y.analytic = function (S, cid, from, to, applyKeys) {
  var d = Y.D(S, cid), secs = {};
  d.sections.filter(function (s) { return s.axis === 'ACT'; }).forEach(function (s) { secs[s.code] = { code: s.code, label: s.label, type: s.type, prod: 0, charges: 0, alloc: 0 }; });
  secs['—'] = { code: '—', label: 'Non ventilé', type: 'auxiliaire', prod: 0, charges: 0, alloc: 0 };
  Y.eachLine(S, cid, function (l) {
    var c = l.account[0]; if (c !== '6' && c !== '7') return;
    var s = secs[l.section] || secs['—'];
    if (c === '7') s.prod += l.credit - l.debit; else s.charges += l.debit - l.credit;
  }, { from: from, to: to, excludeJournal: 'AN' });
  if (applyKeys) d.keys.forEach(function (k) {
    var src = secs[k.from]; if (!src) return;
    var pool = src.charges - src.prod; var spent = 0;
    k.alloc.forEach(function (a, i) { var v = i === k.alloc.length - 1 ? pool - spent : U.round(pool * a.pct / 100); spent += v; if (secs[a.section]) secs[a.section].alloc += v; });
    src.alloc -= pool;
  });
  return Object.keys(secs).map(function (k) { var s = secs[k]; s.result = s.prod - s.charges - s.alloc; return s; }).filter(function (s) { return s.code !== '—' || s.prod || s.charges; });
};

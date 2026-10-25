/*
 * myyiel Comptabilité · kit d'interface (sans framework) :
 * rendu par chaînes + délégation d'évènements, tableaux triables/exportables, tiroirs de formulaires,
 * modales de confirmation, palette de commandes, graphiques SVG, exports CSV/XLSX/PDF.
 */
(function () {
  'use strict';
  var Y = window.Yiel, U = Y.util;
  var App = window.App = window.App || {};
  App.pages = App.pages || {}; App.actions = App.actions || {};
  App.ui = App.ui || { page: 'dashboard', t: {}, tabs: {}, v: {} };

  /* ------------------------------------------------------------ helpers */
  var esc = App.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };
  App.attr = function (o) { return Object.keys(o).filter(function (k) { return o[k] !== undefined && o[k] !== null && o[k] !== false; }).map(function (k) { return o[k] === true ? k : k + '="' + esc(o[k]) + '"'; }).join(' '); };
  App.money = function (n, o) { return U.fmt(n, o); };
  App.m0 = function (n) { return n ? U.fmt(n) : ''; };
  App.mDC = function (n) { return U.fmtDC(n); };
  App.date = function (s) { return U.frDate(s); };
  App.chip = function (label, tone, dot) { return '<span class="chip ' + (tone || '') + (dot ? ' dot' : '') + '">' + esc(label) + '</span>'; };
  App.v = function (k, def) { return App.ui.v[k] === undefined ? def : App.ui.v[k]; };
  App.setV = function (k, val) { App.ui.v[k] = val; };

  var P = App.ICONS = {
    dashboard: 'M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z', plan: 'M4 5h16M4 10h16M4 15h10M4 20h7', saisie: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4',
    ventes: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6', achats: 'M3 4h3l2 12h11l2-8H7M10 20h.01M17 20h.01', banque: 'M3 10l9-6 9 6M5 10v8M10 10v8M14 10v8M19 10v8M3 20h18',
    immos: 'M4 4h16v12H4zM8 20h8M12 16v4', livres: 'M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2zM4 5v16', analytique: 'M12 3a9 9 0 109 9h-9z M14 3.3A9 9 0 0120.7 10H14z',
    etats: 'M5 20V11M11 20V5M17 20v-7M3 20h18', fiscalite: 'M7 3h10v18H7zM10 8h4M10 12h4M10 16h2', cloture: 'M5 10h14v10H5zM8 10V7a4 4 0 018 0v3',
    parametres: 'M12 9a3 3 0 100 6 3 3 0 000-6zM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2', imports: 'M12 3v12M7 10l5 5 5-5M4 21h16',
    search: 'M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-4.5-4.5', plus: 'M12 5v14M5 12h14', download: 'M12 4v11M7 11l5 5 5-5M4 20h16', upload: 'M12 20V9M7 13l5-5 5 5M4 4h16',
    x: 'M6 6l12 12M18 6L6 18', check: 'M5 12l5 5L20 7', back: 'M15 6l-6 6 6 6', next: 'M9 6l6 6-6 6', down: 'M6 9l6 6 6-6', undo: 'M9 14L4 9l5-5M4 9h11a5 5 0 010 10h-3',
    wand: 'M15 4V2M15 10V8M12 6h-2M20 6h-2M18 3l-1 1M13 9l-9 9 2 2 9-9', copy: 'M8 8h12v12H8zM4 16V4h12', link: 'M10 14a4 4 0 005.6 0l3-3a4 4 0 00-5.6-5.6l-1 1M14 10a4 4 0 00-5.6 0l-3 3a4 4 0 005.6 5.6l1-1',
    unlink: 'M15 9l3-3a4 4 0 00-5.6-5.6M9 15l-3 3a4 4 0 01-5.6-5.6M8 2v3M2 8h3M16 22v-3M22 16h-3', eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 100 6 3 3 0 000-6z',
    mail: 'M4 6h16v12H4zM4 7l8 6 8-6', chat: 'M4 5h16v11H9l-5 4z', file: 'M6 3h9l4 4v14H6zM14 3v5h5', pdf: 'M6 3h9l4 4v14H6zM9 13h6M9 17h4', table: 'M3 5h18v14H3zM3 10h18M9 5v14',
    trash: 'M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3', lock: 'M5 10h14v10H5zM8 10V7a4 4 0 018 0v3', unlockI: 'M5 10h14v10H5zM8 10V7a4 4 0 017.5-2',
    bolt: 'M13 2L4 14h7l-1 8 9-12h-7z', shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z', user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c1-4 4-6 8-6s7 2 8 6', bell: 'M6 16V11a6 6 0 0112 0v5l2 2H4zM10 21h4',
    filter: 'M4 5h16l-6 8v6l-4-2v-4z', cal: 'M4 6h16v14H4zM4 10h16M9 3v4M15 3v4', refresh: 'M20 11a8 8 0 10-2.3 5.7M20 4v7h-7', money: 'M3 6h18v12H3zM12 9a3 3 0 100 6 3 3 0 000-6z',
    phone: 'M7 3h10v18H7zM11 18h2', send: 'M4 12l16-8-6 16-3-6z', layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5', sparkle: 'M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z', play: 'M7 5l12 7-12 7z'
  };
  App.ic = function (name, cls) { return '<svg class="ic ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true"><path d="' + (P[name] || P.file) + '"></path></svg>'; };

  /* ---------------------------------------------------------- persistance */
  var KEY = 'myyiel-compta:v1';
  App.load = function () { try { var s = localStorage.getItem(KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } };
  var saveT;
  App.persist = function () {
    clearTimeout(saveT);
    saveT = setTimeout(function () { try { localStorage.setItem(KEY, JSON.stringify(App.real)); localStorage.setItem(KEY + ':ui', JSON.stringify({ page: App.ui.page, tabs: App.ui.tabs, navOpen: App.ui.navOpen || {} })); } catch (e) { /* stockage indisponible : la session reste en mémoire */ } }, 350);
  };
  App.loadUi = function () { try { return JSON.parse(localStorage.getItem(KEY + ':ui') || 'null'); } catch (e) { return null; } };
  App.clearStore = function () { try { localStorage.removeItem(KEY); localStorage.removeItem(KEY + ':ui'); } catch (e) { /* rien */ } };

  /* --------------------------------------------------------- état courant */
  App.cid = function () { return App.S.meta.currentCompany; };
  App.D = function () { return Y.D(App.S, App.cid()); };
  App.co = function () { return Y.company(App.S); };
  App.year = function () { return App.ui.year || U.year(App.S.meta.today); };
  App.today = function () { return App.S.meta.today; };
  App.user = function () { return App.S.meta.currentUser || { name: '—', role: 'reader' }; };
  App.can = function (right) { return Y.can(App.user().role, right); };
  App.dis = function (right) { return App.can(right) ? '' : ' disabled title="' + esc('Droit requis : ' + Y.RIGHTS[right] + ' (rôle actuel : ' + Y.ROLES[App.user().role].label + ')') + '"'; };
  App.guard = function (right) { if (App.can(right)) return true; App.toast('Action réservée : ' + Y.RIGHTS[right].toLowerCase() + '. Votre rôle : ' + Y.ROLES[App.user().role].label + '.', 'bad'); return false; };

  /* ------------------------------------------------------- exécution sûre */
  App.run = function (fn, okMsg) {
    try { var r = fn(); if (okMsg) App.toast(typeof okMsg === 'function' ? okMsg(r) : okMsg, 'ok'); App.commit(); return r === undefined ? true : r; }
    catch (e) { if (e instanceof Y.BizError) { App.toast(e.messages.join(' · '), 'bad'); } else { console.error(e); App.toast('Erreur inattendue : ' + e.message, 'bad'); } return false; }
  };
  App.commit = function () { App.persist(); App.render(); };

  /* -------------------------------------------------------------- toasts */
  App.toast = function (msg, tone) {
    var host = document.getElementById('toasts');
    var el = document.createElement('div'); el.className = 'toast ' + (tone || ''); el.setAttribute('role', 'status');
    el.innerHTML = App.ic(tone === 'bad' ? 'x' : 'check') + '<span>' + esc(msg) + '</span>';
    host.appendChild(el);
    setTimeout(function () { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; }, tone === 'bad' ? 6500 : 3600);
    setTimeout(function () { el.remove(); }, tone === 'bad' ? 7000 : 4000);
  };

  /* -------------------------------------------------------- onglets, segments */
  App.tab = function (page, def) { return App.ui.tabs[page] || def; };
  App.tabs = function (page, list, def) {
    var cur = App.tab(page, def || list[0][0]);
    return '<nav class="tabs" role="tablist">' + list.map(function (t) {
      return '<button type="button" role="tab" aria-selected="' + (cur === t[0]) + '" class="' + (cur === t[0] ? 'on' : '') + '" data-act="tab" data-page="' + page + '" data-tab="' + t[0] + '">' + esc(t[1]) + (t[2] !== undefined && t[2] !== null ? ' <span class="count">' + esc(t[2]) + '</span>' : '') + '</button>';
    }).join('') + '</nav>';
  };
  App.seg = function (key, list, cur, act) {
    return '<div class="seg" role="group">' + list.map(function (o) { return '<button type="button" class="' + (String(cur) === String(o[0]) ? 'on' : '') + '" data-act="' + (act || 'setv') + '" data-k="' + key + '" data-val="' + esc(o[0]) + '">' + esc(o[1]) + '</button>'; }).join('') + '</div>';
  };
  App.filters = function (key, list, cur) {
    return '<div class="filters" role="group">' + list.map(function (o) { return '<button type="button" class="' + (String(cur) === String(o[0]) ? 'on' : '') + '" data-act="setv" data-k="' + key + '" data-val="' + esc(o[0]) + '">' + esc(o[1]) + '</button>'; }).join('') + '</div>';
  };

  /* ------------------------------------------------------------- tableaux */
  App._tables = {};
  App.table = function (id, cfg) {
    var st = App.ui.t[id] || (App.ui.t[id] = { q: '', sort: null, dir: 1, page: 0, sel: {} });
    var rows = cfg.rows.slice();
    var val = function (c, r) { return c.val ? c.val(r) : r[c.k]; };
    if (st.q && cfg.search !== false) {
      var q = st.q.toLowerCase();
      rows = rows.filter(function (r) { return cfg.cols.some(function (c) { var v = val(c, r); return v != null && String(v).toLowerCase().indexOf(q) > -1; }) || (cfg.searchText && cfg.searchText(r).toLowerCase().indexOf(q) > -1); });
    }
    if (st.sort) {
      var c = cfg.cols.find(function (x) { return x.k === st.sort; });
      if (c) rows.sort(function (a, b) { var x = val(c, a), y = val(c, b); if (x == null) x = ''; if (y == null) y = ''; return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'fr', { numeric: true })) * st.dir; });
    }
    App._tables[id] = { cols: cfg.cols, rows: rows, name: cfg.exportName || id, title: cfg.title || '' };
    var ps = cfg.pageSize || 25, pages = Math.max(1, Math.ceil(rows.length / ps));
    if (st.page >= pages) st.page = pages - 1;
    var slice = cfg.noPaging ? rows : rows.slice(st.page * ps, st.page * ps + ps);
    var h = '';
    if (cfg.bar !== false) {
      h += '<div class="tbl-bar">';
      if (cfg.search !== false) h += '<label class="search"><span class="sr">Rechercher</span>' + App.ic('search') + '<input class="in" id="tq_' + id + '" data-tbl-search="' + id + '" placeholder="' + esc(cfg.placeholder || 'Rechercher…') + '" value="' + esc(st.q) + '"></label>';
      if (cfg.toolbar) h += cfg.toolbar;
      h += '<div class="actions" style="margin-left:auto"><span class="muted" style="font-size:12.5px">' + rows.length + ' ligne' + (rows.length > 1 ? 's' : '') + '</span>';
      if (cfg.exportName !== false) h += '<button type="button" class="btn sm" data-act="tbl-export" data-id="' + id + '" data-fmt="xlsx">' + App.ic('table') + 'Excel</button><button type="button" class="btn sm" data-act="tbl-export" data-id="' + id + '" data-fmt="csv">CSV</button>' + (cfg.pdf ? '<button type="button" class="btn sm" data-act="tbl-export" data-id="' + id + '" data-fmt="pdf">' + App.ic('pdf') + 'PDF</button>' : '');
      h += '</div></div>';
    }
    h += '<div class="tbl-wrap"' + (cfg.maxH ? ' style="max-height:' + cfg.maxH + ';overflow:auto"' : '') + '><table class="t"><thead><tr>';
    if (cfg.select) h += '<th style="width:36px"><span class="sr">Sélection</span></th>';
    cfg.cols.forEach(function (c) {
      var arrow = st.sort === c.k ? (st.dir > 0 ? ' ↑' : ' ↓') : '';
      h += '<th class="' + (c.num ? 'num ' : '') + (c.nosort ? '' : 'sortable') + '"' + (c.w ? ' style="width:' + c.w + '"' : '') + (c.nosort ? '' : ' data-act="tbl-sort" data-id="' + id + '" data-k="' + c.k + '"') + '>' + esc(c.label) + arrow + '</th>';
    });
    if (cfg.rowActions) h += '<th><span class="sr">Actions</span></th>';
    h += '</tr></thead><tbody>';
    if (!slice.length) h += '<tr><td colspan="' + (cfg.cols.length + (cfg.select ? 1 : 0) + (cfg.rowActions ? 1 : 0)) + '"><div class="empty"><b>' + esc(cfg.emptyTitle || 'Aucune donnée') + '</b>' + esc(cfg.empty || (st.q ? 'Aucun résultat pour « ' + st.q + ' ».' : '')) + (cfg.emptyAction || '') + '</div></td></tr>';
    var lastG = null;
    slice.forEach(function (r) {
      if (cfg.groupBy && !st.sort) { var g = cfg.groupBy(r); if (g !== lastG) { lastG = g; h += '<tr class="grp"><td colspan="' + (cfg.cols.length + (cfg.select ? 1 : 0) + (cfg.rowActions ? 1 : 0)) + '">' + g + '</td></tr>'; } }
      var rid = cfg.rowId ? cfg.rowId(r) : r.id;
      var cls = (cfg.rowClass ? cfg.rowClass(r) : '') + (cfg.rowAct ? ' click' : '') + (st.sel[rid] ? ' sel' : '');
      h += '<tr class="' + cls + '"' + (cfg.rowAct ? ' data-act="' + cfg.rowAct + '" data-id="' + esc(rid) + '"' : '') + '>';
      if (cfg.select) h += '<td><input type="checkbox" class="rowsel" aria-label="Sélectionner" data-act="tbl-sel" data-id="' + id + '" data-row="' + esc(rid) + '"' + (st.sel[rid] ? ' checked' : '') + (cfg.selectable && !cfg.selectable(r) ? ' disabled' : '') + '></td>';
      cfg.cols.forEach(function (c) { var v = c.fmt ? c.fmt(val(c, r), r) : esc(val(c, r)); h += '<td class="' + (c.num ? 'num ' : '') + (c.cls || '') + '">' + (v == null ? '' : v) + '</td>'; });
      if (cfg.rowActions) h += '<td style="white-space:nowrap;text-align:right">' + cfg.rowActions(r) + '</td>';
      h += '</tr>';
    });
    if (cfg.foot) h += cfg.foot(rows);
    h += '</tbody></table></div>';
    if (!cfg.noPaging && pages > 1) {
      h += '<div class="pager"><span>Page ' + (st.page + 1) + ' sur ' + pages + '</span><div class="actions"><button type="button" class="btn sm" data-act="tbl-page" data-id="' + id + '" data-d="-1"' + (st.page ? '' : ' disabled') + '>' + App.ic('back') + 'Précédente</button><button type="button" class="btn sm" data-act="tbl-page" data-id="' + id + '" data-d="1"' + (st.page < pages - 1 ? '' : ' disabled') + '>Suivante' + App.ic('next') + '</button></div></div>';
    }
    return h;
  };
  App.selected = function (id) { var st = App.ui.t[id]; return st ? Object.keys(st.sel).filter(function (k) { return st.sel[k]; }) : []; };
  App.clearSel = function (id) { if (App.ui.t[id]) App.ui.t[id].sel = {}; };
  function tableAoa(id) {
    var t = App._tables[id]; if (!t) return null;
    var cols = t.cols.filter(function (c) { return !c.noexport; });
    var aoa = [cols.map(function (c) { return c.label; })];
    t.rows.forEach(function (r) { aoa.push(cols.map(function (c) { var v = c.exp ? c.exp(r) : (c.val ? c.val(r) : r[c.k]); return v == null ? '' : v; })); });
    return { aoa: aoa, name: t.name, title: t.title, cols: cols };
  }
  App.exportTable = function (id, fmt) {
    if (!App.guard('export')) return;
    var x = tableAoa(id); if (!x) return;
    var base = x.name + '_' + App.co().name.replace(/\W+/g, '-') + '_' + App.today();
    if (fmt === 'csv') return App.save(base + '.csv', Y.csvStringify(x.aoa));
    if (fmt === 'pdf') return App.pdfTable(x.title || x.name, x.aoa, base + '.pdf', x.cols);
    return App.xlsx(base + '.xlsx', [{ name: x.name.slice(0, 30), rows: x.aoa }]);
  };

  /* ------------------------------------------------------ fichiers (export) */
  App._dl = undefined;
  App.save = function (filename, data) {
    var go = function (dl) {
      if (dl && dl.save) {
        return dl.save({ filename: filename, data: data }).then(function () { App.toast('Fichier enregistré : ' + filename, 'ok'); }, function (e) { if (e && e.code === 'declined') return; if (e && (e.code === 'unavailable' || e.code === 'not_granted')) return blobSave(); App.toast('Téléchargement impossible : ' + (e && e.message || e), 'bad'); });
      }
      return blobSave();
    };
    function blobSave() {
      try {
        var blob = data instanceof Blob ? data : new Blob([data], { type: 'application/octet-stream' });
        var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
        App.toast('Fichier préparé : ' + filename, 'ok');
      } catch (e) { App.toast('Ce navigateur bloque le téléchargement.', 'bad'); }
    }
    if (App._dl !== undefined) return go(App._dl);
    if (window.claude && window.claude.use) return window.claude.use('downloads').then(function (dl) { App._dl = dl; return go(dl); }, function () { App._dl = null; return go(null); });
    App._dl = null; return go(null);
  };
  App.xlsx = function (filename, sheets) {
    if (!window.XLSX) { App.toast('Module Excel indisponible : export CSV à la place.', 'bad'); return App.save(filename.replace(/\.xlsx$/, '.csv'), Y.csvStringify(sheets[0].rows)); }
    var wb = XLSX.utils.book_new();
    sheets.forEach(function (s) {
      var ws = XLSX.utils.aoa_to_sheet(s.rows);
      ws['!cols'] = s.rows[0].map(function (_, i) { var w = 10; s.rows.slice(0, 200).forEach(function (r) { w = Math.max(w, String(r[i] == null ? '' : r[i]).length + 2); }); return { wch: Math.min(w, 60) }; });
      XLSX.utils.book_append_sheet(wb, ws, s.name.replace(/[\\\/\?\*\[\]:]/g, ' ').slice(0, 31));
    });
    var out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    return App.save(filename, new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  };
  /* PDF : en-tête Yiel, pagination, tableaux */
  App.pdfDoc = function (title, subtitle, landscape) {
    if (!window.jspdf) { App.toast('Module PDF indisponible.', 'bad'); return null; }
    var doc = new window.jspdf.jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'pt', format: 'a4' });
    var co = App.co(), W = doc.internal.pageSize.getWidth();
    try { if (window.YIEL_LOGO_LIGHT) doc.addImage(window.YIEL_LOGO_LIGHT, 'PNG', 40, 30, 74, 28); } catch (e) { /* logo facultatif */ }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(18, 22, 46); doc.text(title, W - 40, 44, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(87, 93, 121);
    doc.text(co.name + ' · NIU ' + co.niu + ' · ' + co.framework + ' · XAF', W - 40, 58, { align: 'right' });
    if (subtitle) doc.text(subtitle, W - 40, 70, { align: 'right' });
    doc.setDrawColor(242, 92, 42); doc.setLineWidth(1.4); doc.line(40, 82, W - 40, 82);
    doc._y = 98;
    return doc;
  };
  App.pdfFinish = function (doc, filename) {
    var n = doc.getNumberOfPages(), W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
    for (var i = 1; i <= n; i++) { doc.setPage(i); doc.setFontSize(8); doc.setTextColor(138, 143, 168); doc.text('myyiel · ' + App.co().name + ' · édité le ' + U.frDate(App.today()) + ' par ' + App.user().name, 40, H - 22); doc.text('Page ' + i + ' / ' + n, W - 40, H - 22, { align: 'right' }); }
    return App.save(filename, doc.output('blob'));
  };
  App.pdfAuto = function (doc, head, body, opts) {
    opts = opts || {};
    doc.autoTable(Object.assign({
      head: [head], body: body, startY: doc._y, margin: { left: 40, right: 40, bottom: 40 }, theme: 'plain',
      styles: { font: 'helvetica', fontSize: 8.2, cellPadding: 4, textColor: [18, 22, 46], lineColor: [226, 228, 236], lineWidth: { bottom: 0.4 } },
      headStyles: { fillColor: [20, 26, 58], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      columnStyles: opts.numCols ? opts.numCols.reduce(function (o, i) { o[i] = { halign: 'right', font: 'courier' }; return o; }, {}) : {},
      didParseCell: function (d) { if (d.section === 'body' && opts.boldRow && opts.boldRow(d.row.raw)) { d.cell.styles.fontStyle = 'bold'; d.cell.styles.fillColor = [242, 243, 247]; } }
    }, opts.extra || {}));
    doc._y = doc.lastAutoTable.finalY + 18;
  };
  App.pdfTable = function (title, aoa, filename, cols) {
    var wide = aoa[0].length > 6;
    var doc = App.pdfDoc(title, 'Arrêté au ' + U.frDate(App.today()), wide); if (!doc) return;
    var numCols = (cols || []).map(function (c, i) { return c.num ? i : -1; }).filter(function (i) { return i > -1; });
    App.pdfAuto(doc, aoa[0], aoa.slice(1).map(function (r) { return r.map(function (v, i) { return typeof v === 'number' && numCols.indexOf(i) > -1 ? U.fmt(v) : v; }); }), { numCols: numCols });
    return App.pdfFinish(doc, filename);
  };

  /* --------------------------------------------------- lecture de fichiers */
  App.readFile = function (file) {
    return new Promise(function (res, rej) {
      var name = file.name.toLowerCase(), fr = new FileReader();
      fr.onerror = function () { rej(new Error('Lecture du fichier impossible.')); };
      if (/\.(xlsx|xls|ods)$/.test(name)) {
        if (!window.XLSX) return rej(new Error('Module Excel indisponible : enregistrez le fichier en CSV.'));
        fr.onload = function () { try { var wb = XLSX.read(new Uint8Array(fr.result), { type: 'array', cellDates: false }); var ws = wb.Sheets[wb.SheetNames[0]]; res({ kind: 'rows', rows: XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' }), sheet: wb.SheetNames[0] }); } catch (e) { rej(e); } };
        fr.readAsArrayBuffer(file);
      } else {
        fr.onload = function () { var t = String(fr.result); if (/\.json$/.test(name)) res({ kind: 'json', text: t }); else res({ kind: 'rows', rows: Y.csvParse(t) }); };
        fr.readAsText(file, 'utf-8');
      }
    });
  };

  /* ------------------------------------------------------ champs de formulaire */
  App.fieldHtml = function (f, pre) {
    pre = pre || 'ff_';
    var id = pre + f.k, v = f.val == null ? '' : f.val, req = f.req ? ' required' : '';
    if (f.type === 'sep') return '<div class="form-sep">' + esc(f.label) + '</div>';
    if (f.type === 'html') return '<div class="span2">' + f.html + '</div>';
    if (f.type === 'check') return '<label class="check' + (f.span ? ' span2' : '') + '"><input type="checkbox" id="' + id + '"' + (v ? ' checked' : '') + (f.ro ? ' disabled' : '') + '> ' + esc(f.label) + (f.help ? ' <small class="muted">' + esc(f.help) + '</small>' : '') + '</label>';
    var lab = '<span>' + esc(f.label) + (f.req ? '<em aria-hidden="true">*</em>' : '') + '</span>';
    var ctrl;
    if (f.type === 'select') {
      ctrl = '<select class="in" id="' + id + '"' + req + (f.ro ? ' disabled' : '') + '>' + (f.empty !== undefined ? '<option value="">' + esc(f.empty) + '</option>' : '') + (f.opts || []).map(function (o) { o = Array.isArray(o) ? o : [o, o]; return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(v) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>';
    } else if (f.type === 'textarea') {
      ctrl = '<textarea class="in" id="' + id + '"' + req + (f.ro ? ' readonly' : '') + ' placeholder="' + esc(f.ph || '') + '">' + esc(v) + '</textarea>';
    } else if (f.type === 'file') {
      ctrl = '<input class="in" type="file" id="' + id + '"' + (f.accept ? ' accept="' + esc(f.accept) + '"' : '') + ' style="padding-top:8px">';
    } else {
      var t = f.type === 'money' || f.type === 'number' ? 'text' : (f.type || 'text');
      var list = f.list ? ' list="' + f.list + '"' : '';
      ctrl = '<input class="in' + (f.type === 'money' || f.type === 'number' ? ' num' : '') + (f.mono ? ' mono' : '') + '" id="' + id + '" type="' + t + '"' + (f.type === 'money' || f.type === 'number' ? ' inputmode="decimal"' : '') + ' value="' + esc(f.type === 'money' && v !== '' ? U.fmt(v) : v) + '"' + req + list + (f.ro ? ' readonly' : '') + ' placeholder="' + esc(f.ph || '') + '"' + (f.pattern ? ' pattern="' + esc(f.pattern) + '"' : '') + ' autocomplete="off">';
    }
    return '<label class="fld' + (f.span ? ' span2' : '') + '">' + lab + ctrl + (f.help ? '<small>' + esc(f.help) + '</small>' : '') + '</label>';
  };
  App.collect = function (fields, pre) {
    pre = pre || 'ff_';
    var vals = {}, missing = [];
    fields.forEach(function (f) {
      if (!f.k || f.type === 'sep' || f.type === 'html') return;
      var el = document.getElementById(pre + f.k); if (!el) return;
      var v;
      if (f.type === 'check') v = el.checked;
      else if (f.type === 'money') v = el.value.trim() === '' ? '' : U.parseAmount(el.value);
      else if (f.type === 'number') v = el.value.trim() === '' ? '' : parseFloat(String(el.value).replace(',', '.'));
      else if (f.type === 'file') v = el.files && el.files[0] ? el.files[0] : null;
      else v = el.value.trim();
      vals[f.k] = v;
      el.classList.remove('err');
      if (f.req && (v === '' || v === null || (typeof v === 'number' && isNaN(v)))) { missing.push(f.label); el.classList.add('err'); }
    });
    return { vals: vals, missing: missing };
  };

  /* ------------------------------------------------------------ tiroirs */
  var overlay = function () { return document.getElementById('overlay'); };
  App.drawer = function (cfg) {
    App.closeDrawer(true);
    var o = overlay();
    o.innerHTML = '<div class="scrim" data-act="close-drawer"></div><aside class="drawer' + (cfg.wide ? ' wide' : '') + '" role="dialog" aria-modal="true" aria-labelledby="dr_t"><header><div style="flex:1;min-width:0"><h2 id="dr_t">' + esc(cfg.title) + '</h2>' + (cfg.sub ? '<p>' + esc(cfg.sub) + '</p>' : '') + '</div><button type="button" class="btn icon ghost" data-act="close-drawer" aria-label="Fermer">' + App.ic('x') + '</button></header><div class="body" id="dr_body">' + cfg.body + '</div>' + (cfg.foot ? '<footer>' + cfg.foot + '</footer>' : '') + '</aside>';
    App._drawer = cfg;
    requestAnimationFrame(function () { o.querySelector('.scrim').classList.add('show'); o.querySelector('.drawer').classList.add('show'); var f = o.querySelector('.drawer input:not([readonly]):not([type=checkbox]), .drawer select, .drawer textarea'); if (f && !cfg.noFocus) f.focus(); });
  };
  App.closeDrawer = function (instant) {
    var o = overlay(); App._form = null; if (!o || !o.firstChild) return;
    App._drawer = null;
    if (instant) { o.innerHTML = ''; return; }
    var d = o.querySelector('.drawer'), s = o.querySelector('.scrim');
    if (d) d.classList.remove('show'); if (s) s.classList.remove('show');
    setTimeout(function () { if (!App._drawer) o.innerHTML = ''; }, 220);
  };
  App.form = function (cfg) {
    var fields = cfg.fields;
    var body = (cfg.intro ? '<div class="callout info">' + cfg.intro + '</div>' : '') + '<div id="ff_err"></div><form id="ff_form" class="form-grid" novalidate>' + fields.map(function (f) { return App.fieldHtml(f); }).join('') + '</form>' + (cfg.live ? '<div id="ff_live"></div>' : '') + (cfg.after || '');
    App.drawer({ title: cfg.title, sub: cfg.sub, wide: cfg.wide, body: body, foot: (cfg.extraFoot || '') + '<button type="button" class="btn" data-act="close-drawer">Annuler</button><button type="button" class="btn acc" data-act="form-submit">' + App.ic('check') + esc(cfg.submit || 'Enregistrer') + '</button>' });
    App._form = cfg;
    if (cfg.live) setTimeout(App.formLive, 30);
  };
  App.formLive = function () { var cfg = App._form; if (!cfg || !cfg.live) return; var el = document.getElementById('ff_live'); if (!el) return; try { el.innerHTML = cfg.live(App.collect(cfg.fields).vals) || ''; } catch (e) { el.innerHTML = ''; } };
  App.formSubmit = function () {
    var cfg = App._form; if (!cfg) return;
    var box = document.getElementById('ff_err'); if (!box) { App._form = null; return; }
    var c = App.collect(cfg.fields);
    if (c.missing.length) { box.innerHTML = '<div class="errors">Champs obligatoires manquants : ' + esc(c.missing.join(', ')) + '.</div>'; return; }
    try {
      var r = cfg.onSubmit(c.vals);
      if (r === false) return;
      App.closeDrawer(); App._form = null;
      if (cfg.done) App.toast(typeof cfg.done === 'function' ? cfg.done(r) : cfg.done, 'ok');
      App.commit();
    } catch (e) {
      if (e instanceof Y.BizError) box.innerHTML = '<div class="errors" role="alert">' + (e.messages.length > 1 ? 'Corrigez les points suivants :<ul>' + e.messages.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>' : esc(e.messages[0])) + '</div>';
      else { console.error(e); box.innerHTML = '<div class="errors">Erreur inattendue : ' + esc(e.message) + '</div>'; }
      box.scrollIntoView({ block: 'nearest' });
    }
  };

  /* ---------------------------------------------------- modale de confirmation */
  App.confirm = function (cfg) {
    return new Promise(function (resolve) {
      var o = document.getElementById('modalroot');
      var fields = cfg.fields || [];
      o.innerHTML = '<div class="scrim show" data-act="modal-cancel"></div><div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="md_t"><h2 id="md_t">' + esc(cfg.title) + '</h2>' + (cfg.body ? '<div style="color:var(--fg-2)">' + cfg.body + '</div>' : '') +
        (fields.length ? '<div class="form-grid">' + fields.map(function (f) { return App.fieldHtml(f, 'md_'); }).join('') + '</div>' : '') +
        (cfg.requireText ? '<label class="fld"><span>Pour confirmer, saisissez : ' + esc(cfg.requireText) + '</span><input class="in" id="md_req" autocomplete="off"></label>' : '') +
        '<div id="md_err"></div><div class="actions" style="justify-content:flex-end"><button type="button" class="btn" data-act="modal-cancel">Annuler</button><button type="button" class="btn ' + (cfg.danger ? 'acc' : 'pri') + '" data-act="modal-ok">' + esc(cfg.ok || 'Confirmer') + '</button></div></div>';
      requestAnimationFrame(function () { var m = o.querySelector('.modal'); m.classList.add('show'); var f = m.querySelector('input,select,textarea') || m.querySelector('[data-act=modal-ok]'); if (f) f.focus(); });
      App._modal = { resolve: function (v) { o.innerHTML = ''; App._modal = null; resolve(v); }, cfg: cfg, fields: fields };
    });
  };
  App.modalOk = function () {
    var m = App._modal; if (!m) return;
    if (m.cfg.requireText) { var t = document.getElementById('md_req').value.trim().toUpperCase(); if (t !== m.cfg.requireText.toUpperCase()) { document.getElementById('md_err').innerHTML = '<div class="errors">Le texte saisi ne correspond pas.</div>'; return; } }
    var c = App.collect(m.fields, 'md_');
    if (c.missing.length) { document.getElementById('md_err').innerHTML = '<div class="errors">Champs obligatoires : ' + esc(c.missing.join(', ')) + '.</div>'; return; }
    m.resolve(c.vals);
  };

  /* -------------------------------------------------------------- graphiques */
  App.spark = function (vals, color) {
    if (!vals.length) return '';
    var w = 200, h = 38, max = Math.max.apply(null, vals), min = Math.min.apply(null, vals.concat([0])), rg = (max - min) || 1;
    var pts = vals.map(function (v, i) { return [i * (w / (vals.length - 1 || 1)), h - 4 - (v - min) / rg * (h - 8)]; });
    var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
    var last = pts[pts.length - 1];
    return '<svg class="spark" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" aria-hidden="true"><path d="' + d + ' L' + w + ' ' + h + ' L0 ' + h + 'Z" fill="' + color + '" fill-opacity=".1"></path><path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="2" vector-effect="non-scaling-stroke"></path><circle cx="' + last[0] + '" cy="' + last[1] + '" r="3" fill="' + color + '"></circle></svg>';
  };
  App.ring = function (score) {
    var r = 40, c = 2 * Math.PI * r, col = score >= 80 ? 'var(--ok)' : (score >= 55 ? 'var(--warn)' : 'var(--bad)');
    return '<svg class="ring" viewBox="0 0 100 100" role="img" aria-label="Score ' + score + ' sur 100"><circle cx="50" cy="50" r="' + r + '" fill="none" stroke="var(--surface-3)" stroke-width="10"></circle><circle cx="50" cy="50" r="' + r + '" fill="none" stroke="' + col + '" stroke-width="10" stroke-linecap="round" stroke-dasharray="' + (c * score / 100).toFixed(1) + ' ' + c.toFixed(1) + '" transform="rotate(-90 50 50)"></circle><text x="50" y="56" text-anchor="middle" style="font:800 22px var(--f-mono);fill:var(--fg)">' + score + '</text></svg>';
  };
  App.barChart = function (series, labels, opts) {
    opts = opts || {};
    var W = 640, H = 220, padL = 52, padB = 26, padT = 10, n = labels.length;
    var all = []; series.forEach(function (s) { all = all.concat(s.values); });
    var max = Math.max.apply(null, all.concat([1])), min = Math.min.apply(null, all.concat([0]));
    var step = Math.pow(10, Math.floor(Math.log10(max - min || 1))); var top = Math.ceil(max / step) * step, bot = min < 0 ? Math.floor(min / step) * step : 0;
    var y = function (v) { return padT + (H - padT - padB) * (1 - (v - bot) / ((top - bot) || 1)); };
    var bw = (W - padL - 10) / n, gw = bw * 0.7 / series.length;
    var g = '';
    for (var i = 0; i <= 4; i++) { var v = bot + (top - bot) * i / 4; g += '<line class="grid-l" x1="' + padL + '" x2="' + W + '" y1="' + y(v) + '" y2="' + y(v) + '"></line><text x="' + (padL - 6) + '" y="' + (y(v) + 3) + '" text-anchor="end">' + (Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(0) + ' M' : U.fmt(v)) + '</text>'; }
    labels.forEach(function (l, i) { g += '<text x="' + (padL + bw * i + bw / 2) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(l) + '</text>'; });
    series.forEach(function (s, k) {
      if (s.line) { var d = s.values.map(function (v, i) { return (i ? 'L' : 'M') + (padL + bw * i + bw / 2).toFixed(1) + ' ' + y(v).toFixed(1); }).join(' '); g += '<path d="' + d + '" fill="none" stroke="' + s.color + '" stroke-width="2.4"></path>' + s.values.map(function (v, i) { return '<circle cx="' + (padL + bw * i + bw / 2).toFixed(1) + '" cy="' + y(v).toFixed(1) + '" r="3" fill="' + s.color + '"><title>' + esc(labels[i] + ' · ' + s.name + ' : ' + U.fmt(v)) + '</title></circle>'; }).join(''); return; }
      s.values.forEach(function (v, i) { var x = padL + bw * i + bw * 0.15 + gw * k, y0 = y(Math.max(v, 0)), y1 = y(Math.min(v, 0)); g += '<rect x="' + x.toFixed(1) + '" y="' + y0.toFixed(1) + '" width="' + (gw - 2).toFixed(1) + '" height="' + Math.max(0.5, y1 - y0).toFixed(1) + '" rx="3" fill="' + s.color + '"' + (opts.dimFrom !== undefined && i >= opts.dimFrom ? ' fill-opacity=".25"' : '') + '><title>' + esc(labels[i] + ' · ' + s.name + ' : ' + U.fmt(v)) + '</title></rect>'; });
    });
    return '<div class="tbl-wrap"><svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;min-width:520px;max-height:320px;height:auto" role="img" aria-label="' + esc(opts.label || 'Graphique') + '">' + g + '</svg></div>';
  };
  App.countUp = function (root) {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    root.querySelectorAll('[data-count]').forEach(function (el) {
      var target = +el.getAttribute('data-count'); var t0 = performance.now(), dur = 700;
      (function f(t) { var p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3); el.textContent = U.fmt(target * e); if (p < 1) requestAnimationFrame(f); else el.textContent = U.fmt(target); })(t0);
    });
  };
  App.copy = function (text, ok) {
    var done = function () { App.toast(ok || 'Copié dans le presse-papiers.', 'ok'); };
    try { navigator.clipboard.writeText(text).then(done, function () { App.showCopy(text); }); } catch (e) { App.showCopy(text); }
  };
  App.showCopy = function (text) {
    App.drawer({ title: 'Texte à copier', sub: 'Sélectionnez puis copiez le texte ci-dessous.', body: '<textarea class="in" id="copy_ta" style="min-height:260px">' + esc(text) + '</textarea>', foot: '<button type="button" class="btn" data-act="close-drawer">Fermer</button>' });
    setTimeout(function () { var t = document.getElementById('copy_ta'); if (t) t.select(); }, 60);
  };
})();

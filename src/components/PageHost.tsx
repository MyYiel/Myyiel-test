'use client';
/*
 * Hôte de l'écran courant. Les écrans hérités produisent du HTML (App.pageHtml) : il est inséré à chaque rendu React,
 * exactement comme l'ancien App.render() (mêmes règles de focus, même crochet « après rendu » des écrans).
 * Aucun enfant React n'est déclaré ici : React ne touche jamais au contenu injecté.
 */
import { useLayoutEffect, useRef } from 'react';
import { beginCommit, endCommit } from '@/lib/store';
import { urlFor } from '@/lib/runtime';

export default function PageHost() {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const host = ref.current;
    if (!host) return;
    const App = window.App;
    beginCommit();
    try {
      // Mémorise le champ actif de l'écran (id + sélection) pour le restituer après remplacement du HTML.
      const ae = document.activeElement as HTMLInputElement | null;
      const fid = ae && host.contains(ae) ? ae.id : '';
      let ss: number | null = null;
      let se: number | null = null;
      try {
        if (fid && ae && ae.selectionStart !== undefined) {
          ss = ae.selectionStart;
          se = ae.selectionEnd;
        }
      } catch {
        /* champ sans sélection */
      }

      host.innerHTML = App.pageHtml();
      App.pageAfter(host);

      if (fid) {
        const el = document.getElementById(fid) as HTMLInputElement | null;
        if (el && el !== document.body && !el.closest('.drawer')) {
          el.focus();
          try {
            if (ss !== null && se !== null) el.setSelectionRange(ss, se);
          } catch {
            /* rien */
          }
        }
      }

      // Titre de l'onglet et URL (/ventes?tab=devis) suivent l'écran affiché.
      const page: string = App.ui.page;
      const t: string = App.title(page);
      document.title = (t ? t + ' · ' : '') + 'myyiel Finance & Paie';
      const want = urlFor(page, App.ui.tabs[page]);
      if (location.pathname + location.search !== want) history.replaceState(null, '', want);
    } finally {
      endCommit();
    }
  });

  return <div ref={ref} style={{ display: 'contents' }} />;
}

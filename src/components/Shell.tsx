'use client';
/* Coque de l'application : démarre le moteur + les écrans, puis rend barre latérale, barre supérieure et écran courant. */
import { useEffect, useState, useSyncExternalStore } from 'react';
import { startRuntime } from '@/lib/runtime';
import { getVersion, subscribe } from '@/lib/store';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import PageHost from './PageHost';

function Splash({ error }: { error?: string }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', font: '600 14px system-ui', color: '#575D79' }}>
      {error ? 'Erreur de chargement : ' + error : 'Chargement de myyiel…'}
    </div>
  );
}

function Frame() {
  useSyncExternalStore(subscribe, getVersion, getVersion);
  const App = window.App;
  if (!App.canPage(App.ui.page)) App.ui.page = App.firstPage(); // droit insuffisant : première page autorisée
  return (
    <div className="app">
      <Sidebar />
      <main className="main" id="main">
        <Topbar />
        <PageHost />
      </main>
    </div>
  );
}

export default function Shell() {
  const [state, setState] = useState<'loading' | 'ready' | string>('loading');
  useEffect(() => {
    startRuntime().then(
      () => setState('ready'),
      (e) => {
        console.error(e);
        setState(String(e && e.message ? e.message : e));
      },
    );
  }, []);
  if (state === 'loading') return <Splash />;
  if (state !== 'ready') return <Splash error={state} />;
  return <Frame />;
}

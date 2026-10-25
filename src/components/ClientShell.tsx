'use client';
/* Le moteur lit window/localStorage au chargement : la coque n'est jamais évaluée côté serveur. */
import dynamic from 'next/dynamic';

const Shell = dynamic(() => import('./Shell'), {
  ssr: false,
  loading: () => (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', font: '600 14px system-ui', color: '#575D79' }}>
      Chargement de myyiel…
    </div>
  ),
});

export default function ClientShell() {
  return <Shell />;
}

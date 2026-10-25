import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/plus-jakarta-sans/wght.css';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/700.css';
import '@fontsource/jetbrains-mono/800.css';
import '@/legacy/styles.css';
import ClientShell from '@/components/ClientShell';

export const metadata: Metadata = {
  title: 'myyiel Finance & Paie',
  description: 'myyiel (Yiel Group) : comptabilité SYSCOHADA révisé et paie camerounaise interconnectées.',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

/*
 * La coque (barre latérale, barre supérieure, écran courant) vit dans le layout : elle reste montée quand on change
 * d'écran. Les routes /[page] n'existent que pour l'URL (liens directs, retour arrière, 404) ; leur contenu est vide.
 * Les conteneurs ci-dessous sont remplis par le kit hérité (tiroirs, modales, palette, notifications, assistante).
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <ClientShell />
        {children}
        <div id="overlay" />
        <div id="modalroot" />
        <div id="palroot" />
        <div id="toasts" className="toasts" aria-live="polite" />
        <div id="yroot" />
      </body>
    </html>
  );
}

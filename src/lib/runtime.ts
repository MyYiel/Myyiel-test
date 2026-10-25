/*
 * Démarrage côté navigateur : charge le moteur + les écrans hérités, les bibliothèques d'export (PDF, Excel, QR)
 * puis initialise l'état de démonstration (jeu de données mock, conservé dans le localStorage).
 */
import { renderNow } from './store';

let started: Promise<void> | null = null;

async function loadLibs() {
  const [{ jsPDF }, autoTable, xlsx, qr] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
    import('xlsx'),
    import('qrcode'),
  ]);
  autoTable.applyPlugin(jsPDF); // restaure doc.autoTable(...) utilisé par les exports PDF
  window.jspdf = { jsPDF };
  window.XLSX = (xlsx as any).default ?? xlsx;

  // Même interface que qrcodejs (new QRCode(element, { text, width, height })) pour les écrans hérités.
  const QR = (qr as any).default ?? qr;
  function QRCodeShim(this: unknown, el: HTMLElement, o: { text: string; width?: number }) {
    const canvas = document.createElement('canvas');
    el.appendChild(canvas);
    QR.toCanvas(canvas, o.text, { width: o.width || 128, margin: 1, errorCorrectionLevel: 'M' });
  }
  (QRCodeShim as any).CorrectLevel = { L: 'L', M: 'M', Q: 'Q', H: 'H' };
  window.QRCode = QRCodeShim;
}

export function startRuntime(): Promise<void> {
  if (!started) {
    started = (async () => {
      await import('@/legacy');
      await loadLibs();
      const App = window.App;
      App._renderHook = renderNow;
      App.navigate = (page: string, tab?: string) => {
        const want = urlFor(page, tab || App.ui.tabs[page]);
        if (location.pathname + location.search !== want) history.pushState(null, '', want);
      };
      App.boot();
    })();
  }
  return started;
}

export function urlFor(page: string, tab?: string | null) {
  return '/' + page + (tab ? '?tab=' + encodeURIComponent(tab) : '');
}

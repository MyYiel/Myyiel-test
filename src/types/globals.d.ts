/* Les écrans hérités (src/legacy) s'appuient sur deux objets globaux : le moteur (Yiel) et l'application (App). */
/* eslint-disable @typescript-eslint/no-explicit-any */
export {};

declare global {
  interface Window {
    Yiel: any;
    App: any;
    jspdf: any;
    XLSX: any;
    QRCode: any;
    YIEL_LOGO_DARK?: string;
    YIEL_LOGO_LIGHT?: string;
    YIEL_MARK?: string;
  }
}

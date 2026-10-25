/* Registre partagé du moteur : tous les modules attachent leurs fonctions à cet objet unique (Y).
 * Exposé aussi sur globalThis.Yiel pour les écrans hérités (src/legacy) qui lisent window.Yiel. */
export const Y = (globalThis.Yiel = globalThis.Yiel || {});

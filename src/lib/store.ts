/*
 * Petit magasin externe qui relie l'état de l'application (window.App.S / App.ui, hérité) à React.
 * App.render() (appelé partout par les écrans hérités) déclenche un rendu React SYNCHRONE : au retour de
 * l'appel, le DOM est à jour (les écrans y comptent : ils donnent le focus à un champ juste après).
 */
import { flushSync } from 'react-dom';

let version = 0;
let inCommit = false;
let pending = false;
const listeners = new Set<() => void>();

export function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
export const getVersion = () => version;

function bump() {
  version += 1;
  listeners.forEach((l) => l());
}

/** Rendu immédiat ; pendant un commit React (effets de PageHost), le rendu est différé à la fin du commit. */
export function renderNow() {
  if (inCommit) {
    pending = true;
    return;
  }
  flushSync(bump);
}

export function beginCommit() {
  inCommit = true;
}
export function endCommit() {
  inCommit = false;
  if (pending) {
    pending = false;
    queueMicrotask(bump);
  }
}

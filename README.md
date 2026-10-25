# myyiel Finance & Paie · Next.js

Migration de `myyiel-comptabilite` (SPA vanilla JS assemblée en un seul fichier) vers **Next.js 16 (App Router) + React 19 + TypeScript**.
Comptabilité SYSCOHADA révisé, paie Cameroun, temps & présence, congés, stocks, trésorerie/facturation, Yiel CRM.
**Les données restent des mock data** : le jeu de démonstration est généré par `Y.seed()` et conservé dans le `localStorage` du navigateur (aucun backend).

## Démarrage

```bash
npm install
npm run dev          # http://localhost:3000
npm run build && npm start

npm test             # 5 suites du moteur (Vitest) : comptabilité, paie, RH, trésorerie, CRM
npx playwright install chromium
npm run test:e2e     # parcours navigateur ; lancer `npm start` avant (BASE_URL=http://localhost:3000 par défaut)
```

## Architecture

```
src/
  app/
    layout.tsx          polices (@fontsource), CSS global, conteneurs des tiroirs/modales/toasts, coque
    page.tsx            « / » → reprise de la dernière page, sinon première page autorisée
    [page]/page.tsx     51 routes pré-générées (/ventes?tab=devis, /paie-periode…), 404 sinon
  components/
    ClientShell, Shell  coque chargée côté client uniquement (le moteur lit window/localStorage)
    Sidebar.tsx         navigation en accordéon filtrée par rôle, pastilles de tâches
    Topbar.tsx          société, exercice, recherche Ctrl K, contrôle D = C, notifications, utilisateur
    PageHost.tsx        insère le HTML de l'écran courant (+ focus, titre, URL)
  core/                 moteur métier en modules ES (ex app/src/core) : partie double, paie CM, GTA, absences, stocks, Fin, CRM, seeds
  legacy/               écrans (ex app/src/ui) : rendu par chaînes HTML + délégation d'évènements via data-act
  lib/
    store.ts            App.render() → rendu React synchrone
    runtime.ts          démarrage : moteur, écrans, jsPDF/autoTable, SheetJS, QR (paquets npm au lieu de cdnjs)
    pages.ts            clés des écrans (routes)
tests/                  Vitest (moteur) + tests/e2e/*.cjs (Playwright)
docs/                   dossier technique d'origine (inchangé)
```

### Ce qui a changé
- **Moteur** : les IIFE `window.Yiel` deviennent des modules ES (`src/core/*.js`, registre partagé `registry.js`, ordre d'évaluation dans `index.js`). Logique inchangée.
- **Coque** : barre latérale et barre supérieure réécrites en composants React ; routage par URL (liens directs, retour arrière, onglet dans `?tab=`) ; polices et bibliothèques d'export installées via npm.
- **Tests** : les 5 suites du moteur tournent sous Vitest ; les parcours Playwright d'origine ciblent le serveur Next ; un test de routage/exports/QR s'ajoute.

### Ce qui n'est pas (encore) réécrit en composants React
Les 40 écrans métier de `src/legacy/pages` produisent toujours du HTML par chaînes et leurs actions passent par `App.actions` : même code que l'original, comportement identique (vérifié par les parcours e2e). `PageHost` les monte dans la coque React. Pour en convertir un : créer le composant, le brancher dans la route `/[page]` correspondante, retirer l'écran de `App.pages`.

### Points d'attention
- `xlsx` (SheetJS) est la version npm 0.18.5, identique à celle chargée depuis cdnjs auparavant : elle a des avis de sécurité connus pour l'import de fichiers non fiables ; les versions récentes ne sont publiées que sur cdn.sheetjs.com.
- Taux de paie et paramètres fiscaux à faire valider par un expert (`docs/12-points-a-valider.md`).

# 11 · Architecture cible

## Stack recommandée

| Couche | Choix | Pourquoi |
|---|---|---|
| Langage | **TypeScript** partout | Typage des montants et des règles ; partage des schémas front / back. |
| Front-end | React 18 + Vite, TanStack Query, TanStack Table (virtualisation), React Hook Form + Zod | Grilles de saisie rapides, formulaires validés par les mêmes schémas que l'API. Le design system reprend les jetons de `app/src/ui/styles.css` (bleu nuit `#141A3A`, orange Yiel `#F25C2A`, Plus Jakarta Sans, Instrument Serif, JetBrains Mono). |
| Back-end | Node.js 20 + NestJS (ou Fastify modulaire) | Modules par domaine, injection, validation, OpenAPI généré. |
| Domaine | Package `@myyiel/compta-core` porté depuis `app/src/core/` | Logique pure, testable sans base ; même code pour les aperçus côté client et le serveur. |
| Base | **PostgreSQL 16** | Transactions, contraintes, triggers, RLS (voir `schema.sql`). |
| Files / jobs | Redis + BullMQ (ou RabbitMQ) | Imports, exports, synchronisations, webhooks, e-mails. |
| Fichiers | Stockage objet compatible S3, chiffré | Pièces justificatives, exports, PDF. |
| PDF | Génération serveur (Playwright/Chromium sur gabarits HTML, ou PDFKit) | Rendu identique à l'écran, polices embarquées. |
| Excel | ExcelJS côté serveur | Styles, formats de nombre, plusieurs onglets. |
| Observabilité | OpenTelemetry, logs structurés, Sentry | Traçage des requêtes jusqu'à l'écriture. |

## Découpage en modules (monolithe modulaire)

```
compta/
  core/            # règles pures : écritures, lettrage, TVA, amortissements, états, clôture
  ledger/          # comptes, journaux, exercices, écritures, numérotation
  parties/         # tiers
  sales/           # devis, factures, avoirs, règlements, relances
  purchases/
  treasury/        # comptes, relevés, rapprochement, règles, Mobile Money, caisse
  assets/
  analytics/
  tax/             # TVA, IS, FEC, DSF
  closing/
  io/              # imports, exports, sauvegardes
  admin/           # sociétés, membres, paramètres, audit
  integrations/    # banques, MTN, Orange, DGI, CNPS, bus myyiel
```

Règle d'or : **seul le module `ledger` écrit dans `entry` / `entry_line`**, via une méthode unique `postEntry(command)` qui applique toutes les règles RG-E et l'audit. Les autres modules construisent des commandes d'écriture.

## Transaction de validation (séquence)

1. `BEGIN` ; `SET LOCAL app.company_id`.
2. Vérifier droits et période (lecture `fiscal_year`, `period` avec `FOR SHARE`).
3. Contrôles métier (`core`) ; si erreur → 422 avec les RG violées.
4. `next_entry_number()` (verrou de ligne sur la séquence).
5. `UPDATE entry SET status='validated', number=…` ; lignes déjà insérées en brouillon.
6. Mise à jour des cumuls mensuels, des liens (facture, rapprochement, lettrage).
7. Événement d'audit.
8. `COMMIT` (trigger différé d'équilibre) ; publication de l'événement `entry.validated` après commit (outbox).

## Multi-tenant et multi-société

- Un **tenant** (groupe, cabinet) possède N sociétés ; un utilisateur a un rôle par société.
- RLS sur `company_id` ; index composites préfixés par `company_id`.
- Consolidation de groupe (phase 2) : lecture multi-sociétés par un rôle dédié, éliminations intra-groupe.

## Performance

- Cumuls `account_balance_month` maintenus à la validation : balance, bilan, CR = somme des cumuls + mois courant.
- Grand livre paginé par curseur `(date, number, line_no)`.
- Tableaux virtualisés côté client ; exports > 10 000 lignes en jobs.

## Hors ligne et réseau instable

Contexte : délestages et connexions mobiles. Le client conserve les brouillons localement (IndexedDB) et les synchronise ; toutes les créations sont idempotentes ; l'interface signale l'état de connexion. La validation définitive reste serveur (numérotation).

## Déploiement

- Conteneurs (Docker), orchestrés (Kubernetes managé ou équivalent), environnements dev / recette / production.
- Hébergement : choisir une région compatible avec les exigences de localisation des données (voir [12](12-points-a-valider.md)) ; latence vers l'Afrique centrale à mesurer.
- CI : lint, tests du cœur, tests SQL, tests e2e, analyse de dépendances ; migrations versionnées (aucune modification manuelle en production).
- Sauvegardes PITR PostgreSQL, restauration testée chaque trimestre.

## Feuille de route suggérée

| Phase | Contenu |
|---|---|
| 1 · Socle (8-10 semaines) | Port du cœur en TypeScript, schéma, API ledger / parties / journaux, saisie, livres, balance, imports, droits, audit. |
| 2 · Opérations | Ventes, achats, trésorerie (imports de relevés, rapprochement), immobilisations, TVA. |
| 3 · Synthèse | États financiers, FEC, clôture et à-nouveaux, analytique, exports serveur. |
| 4 · Intégrations | Mobile Money (collecte + relevés), banques, paie myyiel, CRM, envoi e-mail/WhatsApp. |
| 5 · Conformité | DSF au format DGI, SMT, facturation électronique selon la réglementation, consolidation. |

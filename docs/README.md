# Dossier développeurs · myyiel Comptabilité

Ce dossier décrit **ce que fait le module, pourquoi, et comment le reconstruire en production**. Le prototype (`app/`) sert de spécification exécutable : en cas de doute, le comportement du moteur `app/src/core/` et ses tests font foi.

| N° | Document | Pour qui |
|---|---|---|
| 01 | [Périmètre fonctionnel](01-perimetre-fonctionnel.md) : écrans, onglets, champs, actions | Produit, front-end, QA |
| 02 | [Règles de gestion](02-regles-de-gestion.md) : invariants comptables et métier | Back-end, QA |
| 03 | [Schémas d'écritures](03-schemas-ecritures.md) : chaque opération et son écriture | Back-end, expert-comptable |
| 04 | [Modèle de données](04-modele-de-donnees.md) + [`schema.sql`](schema.sql) (PostgreSQL) | Back-end, DBA |
| 05 | [API REST](05-api-openapi.yaml) (OpenAPI 3.1) | Back-end, front-end, intégrateurs |
| 06 | [Imports et exports](06-imports-exports.md) + [`modeles-import/`](modeles-import/) | Back-end, support |
| 07 | [États financiers](07-etats-financiers.md) : tables de correspondance comptes → lignes | Back-end, expert-comptable |
| 08 | [Sécurité, rôles et piste d'audit](08-securite-roles-audit.md) + [`matrice-des-droits.csv`](matrice-des-droits.csv) | Back-end, sécurité |
| 09 | [Intégrations](09-integrations.md) : banques, MTN MoMo, Orange Money, DGI, CNPS, modules myyiel | Back-end, intégrateurs |
| 10 | [Plan de tests](10-plan-de-tests.md) | QA, back-end |
| 11 | [Architecture cible](11-architecture-cible.md) : stack, multi-tenant, déploiement, performance | Tech lead, DevOps |
| 12 | [Points à valider](12-points-a-valider.md) avec l'expert-comptable et le juridique | Direction, produit |
| R | [**Temps & présence, Congés & absences, Stocks**](rh/README.md) : 7 documents et schéma SQL testé | Tous |
| F | [**Module 4 · Trésorerie, facturation, paiements, anti-fraude**](fin/README.md) : 7 documents et schéma SQL testé | Tous |
| C | [**Yiel CRM · spécification technique**](crm/README.md) : 7 documents, schéma SQL testé, recette REC-01 à REC-20 | Tous |
| P | [**Module Paie**](paie/README.md) : dossier complet (9 documents, schéma SQL, formats d'échange JSON) | Tous |
| — | [`plan-comptable-syscohada.csv`](plan-comptable-syscohada.csv) : plan livré (FR/EN) | Tous |

## Conventions

- **Montants** : entiers en francs CFA (XAF ou XOF, 0 décimale). Jamais de flottants en base : `BIGINT`.
- **Dates** : `AAAA-MM-JJ` (ISO 8601), fuseau `Africa/Douala` pour l'horodatage métier.
- **Langue** : libellés métier en français, intitulés de comptes bilingues (FR/EN) pour le Cameroun.
- **Vocabulaire** : écriture (pièce) = en-tête + lignes ; « valider » = rendre définitive et numéroter ; « contre-passer » = annuler par écriture inverse ; « lettrer » = rapprocher débit et crédit d'un même tiers ; « rapprocher » = associer une ligne de relevé à une ligne comptable.

## Correspondance prototype → production

| Prototype | Production |
|---|---|
| `Yiel.*` (moteur JS, état en mémoire) | Services de domaine TypeScript + PostgreSQL (transactions, contraintes, triggers) |
| `localStorage` | Base PostgreSQL multi-tenant, sauvegardes chiffrées |
| Changement d'utilisateur dans la barre | Authentification (OIDC), 2FA, rôles par société côté API |
| Empreinte FNV-1a de la piste d'audit | SHA-256 chaîné + horodatage serveur, table en ajout seul |
| Exports générés dans le navigateur | Exports générés côté serveur (jobs asynchrones), fichiers signés |

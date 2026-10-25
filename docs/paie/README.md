# myyiel Paie · dossier développeurs

Module de paie camerounais intégré à myyiel Comptabilité. Il a été conçu en s’inspirant d’ADP Paie (moteur paramétrable, rubriques, séparation préparation / contrôle / validation) et de Lucca (expérience salarié, workflows, signature, notifications), puis adapté au contexte camerounais et OHADA : CNPS, DGI, SYSCOHADA révisé, Mobile Money, multi-sites et plusieurs conventions collectives.

> **Statut réglementaire.** Le pack Cameroun livre des valeurs par défaut sourcées. Toutes sont **datées et versionnées**, et aucune n’est écrite en dur dans le moteur. Les lignes marquées « À valider » (voir `09-points-a-valider.md`) doivent être confirmées par l’expert-comptable avant la mise en production.

## Lire dans cet ordre

| # | Document | Contenu |
|---|---|---|
| 01 | [`01-perimetre-et-fonctionnalites.md`](01-perimetre-et-fonctionnalites.md) | Périmètre fonctionnel, parcours des 4 étapes, **plan des fonctionnalités additionnelles : à quoi elles servent, pourquoi elles sont utiles** |
| 02 | [`02-moteur-et-formules.md`](02-moteur-et-formules.md) | Moteur de calcul, langage d’expression, packs pays, versions datées, rubriques du pack Cameroun, ordre de calcul |
| 03 | [`03-interface-comptable.md`](03-interface-comptable.md) | Format `myyiel.journal-batch/1` (paie → comptabilité), schéma d’écritures, format `myyiel.time-events/1` (GTA → paie) |
| 04 | [`04-workflow-roles-signature.md`](04-workflow-roles-signature.md) | Statuts, séparation des tâches, rôles et droits, signature DRH et cachet, virements, télétransmission DAF |
| 05 | [`05-anomalies-controles.md`](05-anomalies-controles.md) | 9 anomalies bloquantes, 13 non bloquantes, règles de gestion RG-P |
| 06 | [`06-schema-paie.sql`](06-schema-paie.sql) + [`06-schema-paie-test.sql`](06-schema-paie-test.sql) | Schéma PostgreSQL (vérifié sur PostgreSQL 16), contraintes métier en base, RLS des données sensibles |
| 07 | [`07-api-paie.md`](07-api-paie.md) | API REST cible, correspondance avec les fonctions du moteur `Yiel.Paie` |
| 08 | [`08-plan-de-tests.md`](08-plan-de-tests.md) | Plan de tests : 83 tests unitaires, parcours de bout en bout, 10 scénarios SQL |
| 09 | [`09-points-a-valider.md`](09-points-a-valider.md) | Valeurs et choix à faire confirmer (fiscal, social, conventions, banque) |

Fichiers d’échange : `journal-batch.schema.json`, `time-events.schema.json` et `exemple-journal-batch.json` (lot réel produit par le moteur pour septembre 2026).

## Où est le code

| Fichier | Rôle |
|---|---|
| `app/src/core/paie.js` | Moteur `Yiel.Paie` : langage d’expression, réglementation versionnée, salariés, import, calcul, contrôles, workflow, signature, virements, déclarations, avances et prêts, sorties, simulateur, notifications |
| `app/src/core/paie-cm.js` | Pack pays Cameroun : paramètres datés, barèmes, rubriques à formules, schéma comptable, déclarations, conventions modèles |
| `app/src/core/interfaces.js` | Contrats inter-modules : `Y.makeBatch`, `Y.acceptBatch` (tout ou rien, idempotent, empreinte), `Y.validateBatchShape` |
| `app/src/core/paie-seed.js` | Jeu de démonstration : 10 mois de paie clôturés, octobre en cours avec anomalies réalistes |
| `app/src/ui/pages/paie-*.js` | Écrans : tableau de bord, salariés et import, période, bulletins, espace DRH et DAF, virements, déclarations, avances, paramétrage |
| `app/src/ui/yielina.js` | Assistante IA Yiélina (texte et voix) et centre de notifications |
| `app/tests/paie.test.js` | 83 vérifications du moteur (`node app/tests/paie.test.js`) |
| `app/tests/e2e/paie-flows.js` | Parcours navigateur complet, de la saisie à la clôture (Playwright) |

## Lancer

```bash
python3 tools/build.py              # → dist/index.html (application autonome)
node app/tests/engine.test.js       # comptabilité : 53 vérifications
node app/tests/paie.test.js         # paie : 83 vérifications
cd app/tests/e2e && node paie-flows.js /tmp/shots   # parcours complet + captures
psql -v ON_ERROR_STOP=1 -f docs/schema.sql -f docs/paie/06-schema-paie.sql -f docs/paie/06-schema-paie-test.sql
```

## Comptes de démonstration (sélecteur de rôle en haut à droite)

| Utilisateur | Rôle | Peut |
|---|---|---|
| B. Ngono | Gestionnaire de paie | Importer, saisir, calculer, soumettre, préparer les ordres de virement. Ne valide pas, ne signe pas. |
| E. Fouda | DRH | Valider ou rejeter la paie, valider les ordres de virement, signer et apposer le cachet. |
| P. Tchoumi | DAF | Vérifier les écritures, télétransmettre CNPS et DGI, payer les déclarations, clôturer. |
| Propriétaire | Administrateur | Tout le paramétrage. |

# 08 · Plan de tests du module paie

| Niveau | Commande | Couverture | Résultat au 22/10/2026 |
|---|---|---|---|
| Moteur (unitaires) | `node app/tests/paie.test.js` | 10 sections, 83 vérifications | 83 / 83 |
| Comptabilité (non-régression) | `node app/tests/engine.test.js` | 53 vérifications | 53 / 53 |
| Parcours navigateur | `cd app/tests/e2e && node paie-flows.js [captures]` | De l’import à la clôture, rôle par rôle | 0 erreur JS, état final contrôlé |
| Fumée UI | `node smoke.js` | Toutes les pages, onglets et filtres, compta et paie | 0 erreur |
| Base de données | `psql … -f 06-schema-paie.sql -f 06-schema-paie-test.sql` | 10 scénarios de contraintes | OK (PostgreSQL 16) |

## 1. Tests unitaires du moteur (`paie.test.js`)

| Section | Ce qui est vérifié |
|---|---|
| Langage d’expression | Priorité des opérateurs, parenthèses, `si`, ternaire et logique, formule invalide détectée, formule valide acceptée |
| Réglementation datée | SMIG 2023 / 2026 selon la date, barème IRPP 10 % puis progressif, nouvelle version datée sans effet sur le passé, refus d’une date d’effet dans une période validée sans option rétroactive |
| Calcul d’un bulletin | Brut, avantages en nature, plafond CNPS, IRPP au barème annuel, CAC, CFC, RAV, TDL, net = brut − déductions, prorata d’entrée, absences au 1/30, heures supplémentaires |
| Séparation des tâches | Soumission refusée avec anomalie bloquante, DRH sans droit de préparation, gestionnaire sans droit de validation ni de signature, rejet motivé obligatoire |
| Interface comptable | Lot équilibré, empreinte, idempotence (2ᵉ intégration refusée), lot altéré refusé, tout ou rien sur compte inconnu, tiers personnel créé par matricule |
| Virements, déclarations, clôture | Circuit de l’ordre de virement, confidentialité du fichier banque, solde 422 nul après exécution, télétransmission refusée avant intégration, paiement 431 / 447, clôture et ouverture de la période suivante |
| Recalcul et régularisation | Recalcul de contrôle sans écraser la période gelée, rappels générés sur la période ouverte |
| Import des salariés | Correspondance des colonnes, doublons fichier et référentiel, jumeaux probables, matricule manquant, champs obligatoires, rien n’est écrit avant validation |
| Avances, prêts, sorties, simulateur | Date limite et report au mois suivant, plafond, retenue automatique, prêt échéancé, solde de tout compte, brut → net et net → brut cohérents |
| Historique de démonstration | 10 mois clôturés, comptes de paie soldés, audit chaîné intact |

## 2. Parcours de bout en bout (`paie-flows.js`)

Le parcours se déroule rôle par rôle.

1. **Gestionnaire** :
   - import d’un fichier salariés avec erreurs, puis rapport ;
   - création manuelle d’un dossier et correction de l’anomalie B05 ;
   - saisie de variables dans la grille et import GTA ;
   - calcul, revue des anomalies, soumission.
2. **DRH** :
   - rejet motivé, puis nouvelle soumission ;
   - validation, qui gèle la période et intègre le lot comptable ;
   - spécimen de signature et cachet, puis signature en lot : 20 / 20, aucun doublon au second passage.
3. **Gestionnaire** :
   - ordre de virement, soumission ;
   - **DRH** : validation ;
   - envoi au conseiller, puis exécution.
4. **DAF** : vérification, télétransmission CNPS et DGI, paiement, clôture.
5. **Contrôles transverses** :
   - masquage des données sensibles pour le profil lecteur ;
   - demande d’avance ;
   - nouvelle rubrique à formule ;
   - nouvelle version du SMIG ;
   - Yiélina : question, puis ajout d’heures supplémentaires **après confirmation**.
6. **État final attendu** : période `cloturee`, 20 bulletins signés sur 20, ordre `execute`, solde 422 = 0, audit chaîné intègre, aucune erreur JavaScript.

## 3. Scénarios SQL (`06-schema-paie-test.sql`)

1. Paramètre en vigueur selon la date.
2. Surcharge propre à la société prioritaire sur le pack.
3. Version réglementaire non modifiable.
4. CDD sans date de fin refusé.
5. Soumission refusée avec une anomalie bloquante.
6. Validation refusée si le préparateur valide lui-même.
7. Télétransmission refusée avant l’intégration comptable.
8. Bulletin gelé après validation, signature acceptée une seule fois.
9. Période clôturée non réouvrable.
10. Données sensibles invisibles sans `app.pay_sensitive` (rôle applicatif soumis à la RLS).

## 4. Recette métier à mener avant production

| # | Test | Responsable |
|---|---|---|
| R1 | Recalculer 3 bulletins réels de septembre 2026 (un cadre, un employé, un CDD) et comparer au centime avec la paie actuelle | Gestionnaire et expert-comptable |
| R2 | Comparer le DIPE produit avec la dernière déclaration CNPS acceptée | DAF |
| R3 | Faire valider la lettre et le fichier de virement par le conseiller bancaire, et choisir le niveau de confidentialité | DAF et banque |
| R4 | Vérifier les barèmes RAV, TDL et ancienneté, et les grilles des conventions (voir `09`) | Expert-comptable |
| R5 | Tester la signature avec le vrai cachet photographié | DRH |

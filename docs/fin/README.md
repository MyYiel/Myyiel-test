# myyiel Module 4 · Trésorerie, facturation et paiements — dossier développeurs

Le module 4 relie la facture à son encaissement et la facture fournisseur à son paiement, sans ressaisie. Chaque flux finit en écriture dans le module Comptabilité.

Il couvre huit espaces reliés entre eux :

1. Facturation électronique.
2. Encaissements clients.
3. Dépenses et factures fournisseurs.
4. Trésorerie.
5. Répertoire clients et fournisseurs.
6. Relances et échéances.
7. Rapprochement et comptabilisation.
8. Contrôles.

Il ajoute aussi une **détection des faux moyens de paiement et des usurpations d'identité**, qui couvre quatre cas :

- les faux changements de RIB ou de numéro Mobile Money ;
- les faux SMS ou captures « paiement reçu » ;
- les fausses factures qui imitent un vrai fournisseur ;
- les fournisseurs fictifs.

**Principe économique** : la facturation essentielle reste gratuite et illimitée. Cela comprend :

- les factures, avoirs et acomptes ;
- l'envoi par WhatsApp ou e-mail avec un lien de paiement ;
- le suivi des statuts ;
- le contrôle des justificatifs.

Le modèle économique repose sur les fonctions avancées : la boîte de réception avec lecture automatique, le rapprochement intelligent, la prévision, les circuits multi-niveaux et les relances automatiques.

| # | Document | Contenu |
|---|---|---|
| 01 | [`01-perimetre-et-parcours.md`](01-perimetre-et-parcours.md) | Les huit espaces, les écrans, les parcours, les statuts |
| 02 | [`02-innovations.md`](02-innovations.md) | Les six innovations : ce qui est livré, ce qui est simulé, ce qu'il reste à brancher |
| 03 | [`03-anti-fraude.md`](03-anti-fraude.md) | Les schémas de fraude visés, les contrôles, le score de risque, la procédure de rappel |
| 04 | [`04-interconnexion-et-api.md`](04-interconnexion-et-api.md) | Saisie unique, identifiants, notifications des prestataires (signature, idempotence), API REST, droits |
| 05 | [`05-schema-fin.sql`](05-schema-fin.sql) + [`05-schema-fin-test.sql`](05-schema-fin-test.sql) | Schéma PostgreSQL ; règles imposées en base ; 42 scénarios vérifiés sur PostgreSQL 16 |
| 06 | [`06-plan-de-tests.md`](06-plan-de-tests.md) | 88 tests unitaires, parcours navigateur, scénarios SQL |
| 07 | [`07-points-a-valider.md`](07-points-a-valider.md) | Facturation électronique (loi de finances 2026), prestataires, données personnelles, offre |

## Code

| Fichier | Rôle |
|---|---|
| `app/src/core/fin.js` | Moteur `Yiel.Fin`, sans dépendance au navigateur (testable sous Node) |
| `app/src/core/fin-seed.js` | Jeu de démonstration : fournisseurs, fausse facture, usurpation, relevés, transactions |
| `app/src/ui/pages/fin-common.js` | Aperçu de facture en 8 zones, page de paiement client simulée, tiroir facture, notifications |
| `app/src/ui/pages/tresor.js` | Pilotage et prévision sur 13 semaines |
| `app/src/ui/pages/fin-factu.js` | Facturation (cycle de vie, modèles, conformité) et encaissements |
| `app/src/ui/pages/fin-achats.js` | Boîte de réception et paiements fournisseurs |
| `app/src/ui/pages/fin-suivi.js` | Relances, promesses et rapprochement intelligent |
| `app/src/ui/pages/fin-tiers.js` | Répertoire en cartes, fiche à onglets, import et export |
| `app/src/ui/pages/fin-fraude.js` | Anti-fraude, contrôles et paramètres |
| `app/tests/fin.test.js` | 88 vérifications : `node app/tests/fin.test.js` |
| `app/tests/e2e/fin-flows.js` | Parcours navigateur : `node app/tests/e2e/fin-flows.js [dossier-captures]` |

## Ce qui est réel, ce qui est simulé

| Élément | État dans le prototype | En production |
|---|---|---|
| Écritures comptables (ventes, achats, encaissements, frais 631, règlements) | Réelles, équilibrées, lettrées | Identique |
| Notifications MTN MoMo et Orange Money | Simulées : signées avec un secret de bac à sable | API marchandes des opérateurs, contrat et clés |
| Virements | Import contrôlé de relevés, puis rapprochement | Selon les API bancaires disponibles |
| Carte bancaire | **Indisponible**, donc non proposée au client | Après contrat avec un acquéreur |
| Nom du titulaire d'un numéro | Annuaire de démonstration | Service de vérification de l'opérateur, s'il est ouvert |
| Lecture des factures (OCR) | Par l'assistant Claude quand la vue le permet, sinon saisie guidée | Service OCR et validation humaine |
| WhatsApp | Message préparé et téléphone simulé | API WhatsApp Business (compte vérifié) |
| Certification fiscale | **Non revendiquée** : niveau « facture commerciale » | Après homologation (voir 07) |

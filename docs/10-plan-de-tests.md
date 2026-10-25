# 10 · Plan de tests

## Ce qui existe dans le prototype

| Suite | Commande | Couverture |
|---|---|---|
| Moteur (Node, sans dépendance) | `node app/tests/engine.test.js` | 53 vérifications, 10 sections : jeu de démonstration, états financiers, règles de saisie, facturation, TVA, trésorerie, immobilisations, imports, FEC et audit, clôture et à-nouveaux. |
| Schéma SQL | `psql -v ON_ERROR_STOP=1 -f docs/schema.sql -f docs/schema-test.sql` | Validation et numérotation, refus déséquilibre (RG-E02), intangibilité (RG-E12), lettrage autorisé, suppression interdite, compte de regroupement (RG-E05), période verrouillée (RG-E09), audit chaîné et en ajout seul, balance. |
| Moteur de paie | `node app/tests/paie.test.js` | 83 vérifications : voir [`paie/08-plan-de-tests.md`](paie/08-plan-de-tests.md). |
| Moteurs GTA, absences, stocks | `node app/tests/rh.test.js` | 112 vérifications : voir [`rh/05-plan-de-tests.md`](rh/05-plan-de-tests.md). |
| Interface — RH | `node app/tests/e2e/rh-flows.js` | Parcours salarié, N+1, gestionnaire, DAF, comptable ; navigation mobile. |
| Moteur Module 4 | `node app/tests/fin.test.js` | 88 vérifications : voir [`fin/06-plan-de-tests.md`](fin/06-plan-de-tests.md). |
| Interface — Module 4 | `node app/tests/e2e/fin-flows.js` | Facture WhatsApp → paiement confirmé, notification falsifiée, usurpation refusée, fausse facture, approbations, rapprochement, import ; largeur téléphone. |
| Moteur Yiel CRM | `node app/tests/crm.test.js` | 107 vérifications dont REC-01 à REC-20 : voir [`crm/06-recette.md`](crm/06-recette.md). |
| Interface — Yiel CRM | `node app/tests/e2e/crm-flows.js` | Cockpit, recherche, import, carte, pipeline, agenda, messagerie, validation et exécution de campagne, arrêt d'urgence, rôles ; largeur téléphone. |
| Interface — paie | `node app/tests/e2e/paie-flows.js` (Playwright) | Parcours complet gestionnaire → DRH → DAF jusqu'à la clôture. |
| Schéma SQL paie | `psql … -f docs/paie/06-schema-paie.sql -f docs/paie/06-schema-paie-test.sql` | 10 scénarios (gel, séparation des tâches, RG-P30, RLS des données sensibles). |
| Interface — fumée | `node app/tests/e2e/smoke.js` (Playwright) | Ouvre les 14 écrans, chaque onglet et chaque segment / filtre ; échoue sur toute erreur JavaScript ou erreur d'affichage. |
| Interface — parcours | `node app/tests/e2e/flows.js` (Playwright) | Création de compte, tiers, immobilisation, compte de trésorerie, virement, règle, section, clé (refus si ≠ 100 %), code de taxe, journal, utilisateur, paie, arrêté de caisse, article ; dotations, rapprochement et lettrage automatiques ; liquidation de TVA ; imports par type avec contrôle à blanc ; clôture complète en simulation (inventaire, IS, verrouillage, à-nouveaux, affectation) ; exports ; droits du lecteur. |

## Invariants à tester en production (tests de propriété)

Générer aléatoirement des milliers d'opérations (factures, règlements, achats, virements, contre-passations, imports) puis vérifier après chaque lot :

1. Pour toute écriture validée : Σ débits = Σ crédits ; ≥ 2 lignes ; aucune ligne à la fois débit et crédit.
2. Balance : Σ soldes débiteurs = Σ soldes créditeurs ; Σ mouvements D = Σ mouvements C.
3. Bilan : total actif = total passif ; résultat du bilan (CJ) = résultat du compte de résultat (XI).
4. TFT : trésorerie d'ouverture + variation = trésorerie de clôture = BS − DQ − DR.
5. Numérotation : pour chaque (journal, exercice), numéros 1..n sans trou ni doublon, même sous 50 validations concurrentes.
6. Contre-passation : écriture d'origine + contre-passation = soldes inchangés ; impossible deux fois.
7. Lettrage : une lettre majuscule couvre des lignes de même compte et tiers dont la somme est nulle.
8. Rapprochement : écart de l'état de rapprochement = 0 quand tout est rapproché.
9. Clôture : après génération des à-nouveaux, soldes des classes 1-5 au 01/01/N+1 = soldes au 31/12/N ; 131/139 = résultat.
10. Piste d'audit : `verify_audit()` vrai ; toute modification directe en base détectée.
11. Multi-tenant : aucune requête d'un utilisateur de la société A ne renvoie une ligne de la société B (tests sur chaque route).

## Cas métier à couvrir (recette)

| Domaine | Cas |
|---|---|
| Saisie | Écriture déséquilibrée, compte inexistant, compte de regroupement, collectif sans tiers, montant décimal, date hors exercice, période verrouillée, journal de trésorerie sans son compte, journal AN manuel. |
| Ventes | Facture multi-taux, remise, avoir partiel et total, devis → facture, règlement partiel, règlement supérieur au reste dû (refus), frais Mobile Money, facture en retard dans les relances. |
| Achats | Facture avec immobilisation (IMMO, 4451), règlement, échéancier. |
| Trésorerie | Import de relevé avec doublons, rapprochement manuel / automatique / création depuis le relevé, état de rapprochement, virement interne, arrêté de caisse avec écart. |
| Immobilisations | Linéaire et dégressif, mise en service en cours de mois, dotation déjà passée (pas de doublon), cession avec plus-value, mise au rebut. |
| TVA | Crédit reporté sur le mois suivant, double liquidation (refus), paiement sans liquidation (refus), décomposition principal / CAC. |
| Clôture | Brouillon bloquant, inventaire et extourne, IS au minimum de perception, verrouillage, réouverture avant / après à-nouveaux, affectation incomplète (refus), perte. |
| Imports | Fichier Excel avec dates sérielles, FEC d'un autre logiciel, colonnes renommées, rejets partiels, reprise de soldes déséquilibrée (refus). |
| Droits | Chaque action avec chaque rôle ; dernier propriétaire non supprimable. |

## Non fonctionnel

- Performance : balance et états < 1 s pour 500 000 lignes / an (cumuls mensuels) ; import de 50 000 lignes < 60 s en asynchrone.
- Disponibilité : 99,9 % ; délestages et connexions instables : sauvegarde automatique des brouillons côté client, reprise des requêtes idempotentes.
- Accessibilité : navigation clavier complète, contrastes AA, libellés de champs.

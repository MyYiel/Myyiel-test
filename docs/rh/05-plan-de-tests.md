# 05 · Plan de tests

| Niveau | Commande | Résultat au 22/10/2026 |
|---|---|---|
| Moteurs GTA, absences, stocks | `node app/tests/rh.test.js` | 112 / 112 |
| Paie (non-régression) | `node app/tests/paie.test.js` | 83 / 83 |
| Comptabilité (non-régression) | `node app/tests/engine.test.js` | 53 / 53 |
| Parcours navigateur | `node app/tests/e2e/rh-flows.js [captures]` | 0 erreur |
| Fumée UI (toutes pages, onglets, filtres) | `node app/tests/e2e/smoke.js` | 0 erreur |
| Paie et compta e2e | `paie-flows.js`, `flows.js` | 0 erreur |
| SQL | `psql … -f docs/rh/06-schema-rh.sql -f docs/rh/06-schema-rh-test.sql` | 15 scénarios OK (PostgreSQL 16) |

## Couverture de `rh.test.js`

| Section | Points vérifiés |
|---|---|
| **Jours fériés et décompte** | Pâques, Vendredi saint, Ascension, 20 mai exclu, jours ouvrables, ouvrés et calendaires, demi-journées |
| **Circuit salarié → N+1 → gestionnaire** | Le salarié ne valide pas sa propre demande. Un autre manager ne valide pas. Le N+1 ne notifie pas à la place du gestionnaire. Notification par WhatsApp. Refus motivé obligatoire. |
| **Escalade et délégation** | Un N+1 qui demande pour lui-même passe par la DRH. Délégation pendant les congés du N+1. |
| **Contrôles** | Chevauchement, solde insuffisant, durée maximale, week-end sans jour décompté, saisie pour un collègue interdite, justificatif demandé, formule du solde |
| **Circuit gestionnaire → DRH** | La personne qui saisit ne valide pas. Notification automatique. Déclaration directe. Annulation. |
| **Absences → paie** | CP de 5 jours ouvrables, sans solde → ABS_NP, télétravail sans impact |
| **Pointage** | Message WhatsApp, validation sur site (score ≥ 90), lien à usage unique, lien expiré, hors zone, fausse localisation rejetée, téléphone inconnu, plafonds et pénalités du score, revue DRH, télétravail validé au domicile, notice d'information obligatoire |
| **Contrôles aléatoires** | Tirage, résultats présent / sans réponse / en attente |
| **Feuilles de temps** | Absence injustifiée, journée incomplète, congé, mission, dimanche (HSN), HS1 hebdomadaire, saisie manuelle par le N+1, validation, confirmation des absences, blocage tant qu'un pointage reste à vérifier |
| **GTA → paie** | HSN, ABS_NP et CONGE transmis. Feuille non validée exclue. Pas de doublon. Retenue présente sur le bulletin. Droits contrôlés. |
| **Missions** | Départ non détecté, retard probable, écart d'itinéraire, sur site. Aucune position hors mission. Horloge de démonstration. Arrivée détectée puis confirmée (pointage créé). Fin de mission. Itinéraire. Chevauchement refusé. Purge des positions. |
| **Stocks** | Position, CMUP, stock insuffisant, sortie valorisée, transfert, inventaire semestriel, comptage incomplet, séparation des tâches, écart porté en stock, variation = physique − comptable, 311 égal au physique, pas de double variation, visibilité par la clôture, dépréciation 6593/3931, mode permanent, lecteur sans droit |
| **Périmètres et notifications** | Le N+1 voit son équipe, le salarié se voit seul, la DRH voit tout. Notifications du N+1. |

## Recette métier avant la production

1. **Sur un site réel**, à Douala puis à Yaoundé :
   - régler le rayon de la géozone ;
   - vérifier la précision GPS des téléphones d'entrée de gamme ;
   - tester le QR code et le Wi-Fi.
2. **Mission aller-retour Douala ↔ Kribi** avec un vrai téléphone : vérifier la régularité des positions en zone mal couverte et la mise en file d'attente hors réseau.
3. **Paie d'octobre en parallèle** : comparer les heures sup et les retenues issues de la GTA avec la méthode actuelle.
4. **Inventaire physique réel** d'un dépôt : vérifier que l'écriture de variation est cohérente avec la balance.

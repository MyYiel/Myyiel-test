# myyiel RH & stocks · dossier développeurs

Ce dossier couvre trois modules, ajoutés après la comptabilité et la paie :

- **Temps & présence (GTA)**, conçu pour l'Afrique et sans pointeuse physique : pointage par lien WhatsApp géolocalisé, contrôles aléatoires, missions terrain suivies en direct.
- **Congés & absences**, sur le modèle de Lucca, Keeple et SuccessFactors : motifs avec visuels, deux circuits de validation, planning d'équipe.
- **Stocks & inventaires**, côté comptabilité : coût moyen pondéré, inventaire physique, variation de stocks et dépréciations selon le SYSCOHADA.

Les trois modules transmettent leurs effets là où ils comptent. Les temps et absences validés alimentent la **paie** (`myyiel.time-events/1`). Les stocks produisent les **écritures comptables** (variation 31x/603x, dépréciation 6593/39x) que reprend l'assistant de clôture.

| # | Document | Contenu |
|---|---|---|
| 01 | [`01-gta-presence.md`](01-gta-presence.md) | Pointage WhatsApp, score de confiance, anti-contournement, contrôles aléatoires, missions, feuilles de temps, transmission à la paie |
| 02 | [`02-conges-absences.md`](02-conges-absences.md) | Motifs et visuels, décompte, jours fériés du Cameroun, circuits, soldes, planning, impact paie |
| 03 | [`03-stocks-inventaires.md`](03-stocks-inventaires.md) | Articles, mouvements, CMUP, inventaire physique, écritures SYSCOHADA, clôture |
| 04 | [`04-navigation-roles-api.md`](04-navigation-roles-api.md) | Navigation en accordéon, rôles (manager, salarié), droits, API et webhooks |
| 05 | [`05-plan-de-tests.md`](05-plan-de-tests.md) | 112 tests unitaires, parcours navigateur, 15 scénarios SQL |
| 06 | [`06-schema-rh.sql`](06-schema-rh.sql) + [`06-schema-rh-test.sql`](06-schema-rh-test.sql) | Schéma PostgreSQL : règles imposées en base (lien à usage unique, suivi limité à la mission, séparation des tâches, stock jamais négatif) |
| 07 | [`07-points-a-valider.md`](07-points-a-valider.md) | Questions juridiques, sociales et fiscales à trancher avant la production |

## Code

| Fichier | Rôle |
|---|---|
| `app/src/core/gta.js` | Moteur `Yiel.GTA` |
| `app/src/core/absences.js` | Moteur `Yiel.Abs` |
| `app/src/core/stocks.js` | Moteur `Yiel.Stock` |
| `app/src/core/modules-seed.js` | Jeu de démonstration (horloge figée au 21/10/2026 à 10:31, avançable dans l'interface) |
| `app/src/ui/pages/gta.js`, `abs.js`, `moi.js`, `stocks.js`, `rh-common.js` | Écrans, carte schématique, téléphone WhatsApp simulé |
| `app/tests/rh.test.js` | 112 vérifications : `node app/tests/rh.test.js` |
| `app/tests/e2e/rh-flows.js` | Parcours navigateur multi-rôles |

## Comptes de démonstration (sélecteur en haut à droite)

| Utilisateur | Rôle | Pour voir |
|---|---|---|
| Salarié · B. Fotso | Salarié | **Mon espace** seul : pointage par le téléphone simulé, demandes d'absence, missions, bulletins |
| Manager · R. Nana / J-P. Essomba / S. Manga | N+1 | Son équipe seulement : validations, feuilles de temps, missions |
| Gestionnaire paie · B. Ngono | Gestionnaire | Enregistrement et notification des absences, transmission à la paie, paramétrage |
| DRH · E. Fouda | DRH | Escalades, circuit gestionnaire → DRH, tout le périmètre |
| DAF · P. Tchoumi | DAF, N+1 de deux services | Validation de ses équipes, inventaires, variation de stocks |

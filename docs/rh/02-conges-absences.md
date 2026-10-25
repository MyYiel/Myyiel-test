# 02 · Congés & absences

Le module s'inspire de Lucca, Keeple et SuccessFactors : libre-service du salarié, planning visuel, validation hiérarchique, compteurs. Il est adapté au droit camerounais.

## 1. Motifs (assets)

Chaque motif (`A.DEFAULT_TYPES`) porte les attributs suivants :
- une **icône et une couleur**, reprises partout (planning, demandes, espace salarié) ;
- son impact sur la paie ;
- son compteur ;
- son unité de décompte ;
- l'obligation de justificatif ;
- le délai de prévenance et la durée maximale ;
- la possibilité de demi-journée ;
- son traitement : circuit complet ou déclaration.

| Code | Motif | Décompte | Paie | Compteur | Traitement |
|---|---|---|---|---|---|
| CP | Congés payés | ouvrables (lun. → sam.) | CONGE | CP (solde de la paie) | circuit |
| MAR · NAIS · DECES | Événements familiaux | ouvrables | ABS_AUT | PERM (10 j/an) | circuit, justificatif |
| MAL | Maladie | calendaires | ABS_MAL | — | déclaration, certificat |
| MAT | Maternité (14 semaines) | calendaires | ABS_AUT | — | circuit, justificatif |
| AT | Accident du travail | calendaires | ABS_AUT | — | déclaration (gestionnaire) |
| FORM · TT | Formation · Télétravail | ouvrés | aucun (temps de travail) | — | circuit |
| REC | Récupération | ouvrés | aucun | REC | circuit |
| CSS | Congé sans solde | ouvrables | ABS_NP (1/30) | — | circuit |
| INJ | Absence injustifiée | ouvrables | ABS_NP | — | saisie gestionnaire |

Les motifs se créent et se modifient sans développement, dans **Paramétrage › Motifs** (icône, couleur et règles).

## 2. Décompte et jours fériés

**Décompte** (`A.dayList`) : on parcourt les jours de la période, on exclut les week-ends selon l'unité ainsi que les jours fériés (sauf en jours calendaires). Une demi-journée vaut 0,5 jour.

**Jours fériés** (`A.holidays`) :
- fixes : 1ᵉʳ janvier, 11 février, 1ᵉʳ mai, 20 mai, 15 août, 25 décembre ;
- calculés depuis Pâques : Vendredi saint et Ascension ;
- fêtes musulmanes : dates prévisionnelles **à confirmer par arrêté** ;
- report au lundi d'un férié tombant un dimanche (paramétrable) ;
- jours chômés propres à l'entreprise.

## 3. Circuits de validation

| Circuit | Étapes |
|---|---|
| `salarie` (défaut) | Le salarié demande → **le N+1 de son service** valide → **le gestionnaire** enregistre et notifie (WhatsApp, e-mail, espace) |
| `gestionnaire` | Le gestionnaire saisit (formulaire papier, appel) → **la DRH** valide → le salarié est notifié automatiquement |
| Déclarations (maladie, AT) | Contrôle du justificatif et enregistrement par le gestionnaire |

**Règles toujours appliquées**, dans le moteur (`A.canAct`) et en base :
- **Le N+1 est désigné par service** (`managers`). Un N+1 qui fait une demande pour lui-même passe par la DRH.
- **Délégation.** Quand le N+1 est absent, son délégué valide pendant la période de délégation. Sans délégation, la demande va à la DRH.
- **Séparation des tâches.** On ne valide jamais sa propre demande, et la personne qui a saisi une demande ne peut pas la valider.
- **Refus.** Un motif est obligatoire.
- **Annulation** :
  - par le salarié tant que l'absence n'a pas commencé ;
  - par le gestionnaire ensuite ;
  - jamais après paiement sur une paie validée (la régularisation passe par la paie).

## 4. Contrôles d'une demande (`A.check`)

**Bloquants** :
- dates incohérentes ;
- aucun jour décompté ;
- durée maximale dépassée ;
- chevauchement avec une autre demande ;
- solde insuffisant (sauf si le solde négatif est autorisé).

**Avertissements** :
- délai de prévenance non respecté ;
- justificatif à fournir ;
- période de paie déjà validée ;
- **couverture du service** : le nombre d'absents dépasserait le seuil (50 % par défaut). Le N+1 voit le nom des collègues déjà absents.

## 5. Soldes : une seule source de vérité

| Compteur | Calcul |
|---|---|
| **CP** | Solde du **dernier bulletin validé**, calculé par la paie (1,5 jour ouvrable par mois et majorations), moins les CP approuvés depuis, moins les demandes en attente |
| **PERM** | Droit annuel paramétrable, moins les jours pris et en attente |
| **REC** | Jours crédités par le gestionnaire (heures sup converties en repos), moins les jours pris |

## 6. Planning d'équipe

Le planning se présente en grille : les salariés en lignes, groupés par service avec leur N+1, et les jours du mois en colonnes.

| Élément | Affichage |
|---|---|
| Absence | Visuel du motif |
| Demande en attente | Case hachurée |
| Demi-journée | Case coupée en diagonale |
| Mission (issue de la GTA) | Icône de mission |
| Week-ends et fériés | Fond grisé |
| Ligne « Absents » | Nombre d'absents par jour, en rouge au-delà du seuil |

Un clic sur une case vide crée une demande à cette date ; un clic sur une absence l'ouvre.

## 7. Impact paie

`A.payEvents(key)` produit un événement par jour approuvé ayant un code paie. Ces événements sont transmis avec les temps par la GTA (voir 01 § 6), et chaque demande garde la trace des paies concernées (`payKeys`).

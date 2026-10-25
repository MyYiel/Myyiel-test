# 01 · Écrans

L'interface suit un schéma simple :

- une barre latérale par module ;
- une barre supérieure avec la recherche, les notifications et le profil ;
- une zone de travail.

| # | Écran | Page MVP | Sous-onglets |
|---|---|---|---|
| 01 | Connexion et espace | `crm-admin › Sécurité & accès` | Test de connexion, journal |
| 02 | Cockpit du PDG | `crm-cockpit` | — |
| 03 | Recherche d'entreprises | `crm-search` | Recherche, recherches enregistrées, listes |
| 04 | Entreprises et contacts | `crm-base` | Contacts, entreprises, import, carte de visite |
| 05 | Pipeline | `crm-pipeline` | Colonnes, liste |
| 06 | Messagerie et modèles | `crm-messages` | Réponses, modèles, envois |
| 07 | Studio de campagnes | `crm-campaigns` | Campagnes, à valider, journal du moteur |
| 08 | Agenda et activités | `crm-agenda` | Semaine, liste |
| 09 | Notifications | `crm-notifs` | — |
| 10 | Administration | `crm-admin` | Utilisateurs & rôles, intégrations, gouvernance, sécurité |
| + | Analyse | `crm-analyse` | — |

## 01 · Connexion et espace

Le parcours de connexion :

1. L'utilisateur saisit son e-mail et son mot de passe.
2. Un code MFA est demandé pour les rôles sensibles : propriétaire, responsable commercial, administrateur CRM, DAF.
3. L'écran affiche l'organisation et le rôle.

Une connexion est refusée dans quatre cas, tous journalisés :

- identifiants invalides ;
- utilisateur non membre de l'espace ;
- aucun droit CRM ;
- second facteur manquant.

Côté données, l'isolation tient à deux mécanismes :

- chaque requête est filtrée par l'organisation (`app.company_id`, sécurité par ligne) ;
- toute fonction du moteur vérifie d'abord l'appartenance de l'utilisateur à l'espace.

**Recette** : REC-01, REC-02.

## 02 · Cockpit du PDG

**Indicateurs**, tous cliquables vers les dossiers qui les composent, avec la règle de calcul :

| Indicateur | Calcul |
|---|---|
| CA signé | Opportunités « Gagné » dont la date de signature tombe dans la période |
| CA facturé | Factures HT de la comptabilité pour les clients issus du CRM |
| CA encaissé | Règlements comptabilisés sur ces factures |
| Objectif et progression | Objectif de la période et taux de réalisation |
| Pipeline | Montant des opportunités ouvertes |
| Pipeline pondéré | Somme des montants × probabilité |
| Nouveaux prospects, rendez-vous, propositions | Comptés sur la période |
| Actions en retard | Activités dont la date est dépassée |
| Campagnes | Campagnes en cours |

Le cockpit affiche aussi :

- la **progression de l'objectif** : barre de réalisation, repère du temps écoulé, alerte « en risque » si le réalisé est en retard de plus de 15 points sur le temps écoulé ;
- le **pipeline par étape** ;
- les **opportunités prioritaires** (plus fort montant pondéré, avec leur prochaine action) ;
- les **alertes**.

Les filtres portent sur la période (mois, trimestre, année), l'offre, le pays et l'équipe.

**Aucun chiffre n'est saisi dans le tableau de bord.** **Recette** : REC-17.

## 03 · Recherche d'entreprises

**Filtres** :

- pays, ville, secteur ;
- taille, type d'organisation ;
- fonction recherchée ;
- offre ;
- fiabilité des coordonnées.

**Résultats** : chaque résultat affiche

- sa source (donnée publique, fournie par l'utilisateur, vérifiée par un service externe) et sa date de collecte ;
- ses contacts, avec le statut de chaque adresse : vérifiée, **déduite · non confirmée** ou absente ;
- un score d'adéquation à l'offre, avec ses raisons.

**Actions** :

- enregistrer les critères ;
- demander une qualification IA (avec repli sur les règles locales, signalé) ;
- écarter une cible, avec un motif obligatoire ;
- envoyer vers une liste de prospection ;
- depuis une liste, préparer une campagne, qui partira en validation.

À l'import, l'entreprise et ses contacts conservent leur provenance. Une adresse déduite garde ce statut avec une confiance inférieure à 50 %, et elle est **écartée des campagnes** tant qu'elle n'est pas confirmée.

**Recette** : REC-05.

## 04 · Entreprises et contacts

**Fiche entreprise** :

- nom légal et nom commercial, pays, site, secteur, taille ;
- provenance et dernière vérification ;
- contacts et opportunités ;
- historique commercial et communications ;
- offres du groupe pertinentes (score) ;
- notes internes ;
- prochaine action ;
- lien comptable si l'entreprise est cliente.

**Fiche contact** :

- civilité, nom, fonction, entreprise ;
- e-mail et téléphone, chacun **avec sa source et un pourcentage de confiance** ;
- propriétaire et équipe ;
- préférences de communication ;
- consentement ou opposition ;
- historique complet, qui **reste accessible après une modification des coordonnées** (les modifications y figurent elles-mêmes) ;
- demandes relatives aux données personnelles : accès, opposition, suppression.

**Import Excel ou CSV** :

1. Correspondance des colonnes, avec reconnaissance des synonymes.
2. Aperçu des lignes.
3. Contrôles :
   - champs obligatoires ;
   - e-mail ;
   - doublons dans le fichier et avec le CRM ;
   - adresses en opposition.
4. Confirmation. **Si une ligne est en erreur, rien n'est créé** sans confirmation explicite de l'import des seules lignes valides.
5. Rapport : créés, ignorés, motifs.

**Carte de visite** :

1. Photo.
2. Champs extraits, chacun avec sa confiance. Les champs incertains sont signalés, les champs illisibles laissés vides.
3. Correction par l'utilisateur.
4. Détection de doublon.
5. Création seulement après validation.

**Recette** : REC-03, REC-04.

## 05 · Pipeline

Deux vues :

- **colonnes**, avec glisser-déposer ;
- **liste**, exportable.

Une opportunité porte :

- une entreprise et un ou plusieurs interlocuteurs ;
- une offre ;
- un montant et une devise ;
- une date de clôture ;
- une probabilité (par défaut celle de l'étape) ;
- un responsable.

Les étapes et leur probabilité par défaut :

| Étape | Probabilité |
|---|---|
| À qualifier | 5 % |
| Qualifié | 10 % |
| Contact à préparer | 15 % |
| Contacté | 20 % |
| Échange engagé | 30 % |
| Rendez-vous | 40 % |
| Proposition | 60 % |
| Négociation ou décision | 75 % |
| Gagné | 100 % |
| Perdu | 0 % |

Règles de passage :

- « Gagné » exige le montant signé et la date de signature, et propose de **créer le client en comptabilité** (saisie unique) ;
- « Perdu » exige un motif pris dans la liste de la direction ;
- chaque changement est historisé (qui, quand, de quelle étape vers quelle étape, avec un commentaire).

**Recette** : REC-06.

## 06 · Messagerie et modèles

**Réponses reçues** : chaque réponse est classée dans l'une de cinq catégories, avec son effet :

| Classement | Effet |
|---|---|
| Positive | Relances arrêtées, tâche créée pour le responsable du contact |
| Question | Relances arrêtées, tâche créée |
| Négative | Relances arrêtées |
| Absence | Séquence reportée au retour |
| Opposition | Exclusion immédiate |

**Rédaction** :

- destinataire et modèle, avec personnalisation par les champs du contact et de l'entreprise ;
- assistant de reformulation : ton, longueur, objectif, emojis facultatifs ;
- pièce jointe, signature ;
- aperçu final ;
- programmation de l'envoi.

**L'envoi est refusé** dans quatre cas :

- une variable obligatoire est vide ;
- le destinataire est exclu ;
- l'adresse est invalide ;
- la boîte n'est pas connectée.

**Modèles** :

- rattachés à une offre, un segment, une étape et un type d'interlocuteur ;
- variables contrôlées (une variable inconnue est refusée) ;
- **versionnés**.

**Envois et historique** : statut, motif, tentatives, clé d'idempotence, journal d'exécution.

**Recette** : REC-07.

## 07 · Studio de campagnes

Le **cycle de vie** d'une campagne :

1. Brouillon.
2. Prévalidation.
3. En attente de validation PDG.
4. Autorisée.
5. Programmée ou en cours.
6. Suspendue, terminée ou annulée.

Le **studio** comprend :

- objectif et offre ;
- segment : listes, critères, destinataires inclus et **écartés automatiquement avec leur motif** ;
- séquence : message initial et relances avec leur délai, aperçu personnalisé ;
- calendrier, horaires, plafonds (bornés par ceux de la direction) ;
- conditions d'arrêt ;
- prévalidation : blocages, avertissements, volume estimé, durée de la première vague, erreurs prévisibles ;
- approbation : version, auteur, date, périmètre, commentaire, écart avec la version autorisée ;
- exécution et file d'envoi ;
- historique.

**Actions selon les droits** :

- soumettre ;
- autoriser ou refuser (direction, ou délégué explicite) ;
- arrêt d'urgence ;
- reprise (direction) ;
- annulation.

Une barre d'état du moteur affiche l'horloge de démonstration et permet la **suspension globale** de tous les envois.

**Recette** : REC-08, REC-09, REC-10, REC-13, REC-18, REC-19.

## 08 · Agenda et activités

**Vues** :

- semaine ;
- liste filtrée (en retard, aujourd'hui, à venir, toutes).

**Création** depuis une entreprise, un contact ou une opportunité. Un rendez-vous fait passer l'opportunité à l'étape « Rendez-vous ».

**Synchronisation Google Calendar** : si l'agenda est déconnecté, un bandeau s'affiche, le rendez-vous est marqué « non synchronisé » et une alerte est émise. Les rendez-vous sont resynchronisés à la reconnexion.

**Rappels** paramétrables. **Terminer** une activité ou la **reporter** recalcule la prochaine action et conserve l'historique.

**Recette** : REC-15, REC-16.

## 09 · Notifications

Le centre de notifications affiche :

- les alertes en cours ;
- les rappels ;
- le journal des événements avec leur priorité et un lien vers le dossier ;
- la **déduplication** : une seule notification par clé d'événement ;
- les alertes WhatsApp destinées à la direction, pour les seuls types autorisés et avec leur statut réel (« non envoyée » tant que le canal n'est pas configuré).

## 10 · Administration

L'écran d'administration regroupe :

- **utilisateurs** : rôle, équipe, périmètre, droit de validation, MFA ;
- **matrice des rôles** ;
- **délégations datées** de la direction vers un responsable commercial ;
- **intégrations** : état (actif, expiré, erreur, autorisation requise, non disponible) ; **jetons jamais affichés** ;
- **gouvernance** : plafonds (bornés par les limites du fournisseur), horaires, étapes, motifs de perte, rappel des 9 règles ;
- **sécurité** : journal des connexions et test d'accès.

**L'administrateur technique ne valide pas les campagnes et n'accède pas aux contacts.**

## Analyse

L'écran d'analyse présente :

- le taux de transformation, le panier moyen, le cycle de vente ;
- l'entonnoir de conversion par étape ;
- les motifs de perte ;
- l'activité par utilisateur sur 30 jours ;
- la performance des campagnes : envoyés, échecs, réponses, positives, oppositions, taux de réponse ;
- le suivi et l'historique des objectifs.

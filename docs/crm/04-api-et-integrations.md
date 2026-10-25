# 04 · API et intégrations

## 1. Architecture cible

| Composant | Rôle |
|---|---|
| Application web | Écrans du cockpit, de la base, de la recherche, des ventes, des campagnes et de l'administration (le MVP fournit la référence fonctionnelle) |
| API métier | Authentification, permissions (rôle et périmètre), règles, validations. Positionne `app.company_id`, `app.user_id`, `app.crm_scope` et `app.crm_team` pour la sécurité par ligne |
| Base de données | PostgreSQL : schéma `crm` (document 05), relié à `compta` (sociétés, utilisateurs, tiers) |
| Moteur d'automatisation | Ordonnanceur : traite la file chaque minute avec un verrou par organisation. Il applique les 9 règles et gère les tentatives et la reprise |
| Services IA | Qualification, rédaction, classement des réponses, lecture des cartes. Toujours sous validation humaine pour créer ou envoyer |
| Connecteurs | Messagerie, agenda, WhatsApp, SMS, recherche, OCR. Chaque connecteur a un statut et un secret dans un coffre |

## 2. API REST (extraits)

Toutes les écritures acceptent un en-tête `Idempotency-Key`. Les réponses d'erreur métier renvoient `422 {messages:[…]}`, et les refus de droit `403`.

| Méthode | Route | Droit | Effet |
|---|---|---|---|
| `POST` | `/auth/login` | public | `{email, password, mfa?}` → session ; journalisé |
| `GET` | `/cockpit?from&to&offer&country&team` | `crm.read` | Indicateurs **et identifiants des dossiers sources** |
| `GET` | `/search?…` | `crm.read` | Résultats avec source, date de collecte, statut de vérification, score |
| `POST` | `/search/results/{id}/discard` | `crm.write` | `{reason}` obligatoire |
| `POST` | `/search/import` | `crm.write` | `{ids[], list}` → entreprises et contacts avec provenance |
| `POST` | `/contacts` | `crm.write` | 409 si doublon potentiel, sauf `force` |
| `PATCH` | `/contacts/{id}` | `crm.write` + périmètre | Modification historisée |
| `POST` | `/contacts/import/analyze` | `crm.write` | Fichier et correspondance → lignes, erreurs, doublons |
| `POST` | `/contacts/import/commit` | `crm.write` | `{analysisId, skipErrors}` ; refus si des erreurs subsistent sans `skipErrors` |
| `POST` | `/cards/extract` | `crm.write` | Image → champs, confiance, incertitudes, doublons (aucune création) |
| `POST` | `/opportunities/{id}/stage` | `crm.write` | `{stage, amount?, signedAt?, lostReason?, note}` |
| `POST` | `/companies/{id}/convert` | `crm.write` | Création du client comptable (saisie unique) |
| `POST` | `/activities` · `/activities/{id}/complete` | `crm.write` | Création ; terminer ou reporter |
| `POST` | `/templates` | `crm.campaign` | Nouvelle version si le texte change ; les campagnes concernées repassent en validation |
| `POST` | `/messages` | `crm.write` | Envoi individuel contrôlé (variables, exclusions, canal) |
| `POST` | `/campaigns` · `PATCH /campaigns/{id}` | `crm.campaign` | Une modification significative après approbation crée une nouvelle version |
| `POST` | `/campaigns/{id}/submit` | `crm.campaign` | Prévalidation, puis attente de la direction |
| `POST` | `/campaigns/{id}/approve` | `crm.approve` ou délégation | `{version, comment}` ; refus si la version n'est pas la version courante |
| `POST` | `/campaigns/{id}/suspend` · `/resume` · `/cancel` | selon les droits | Arrêt d'urgence, reprise (direction), annulation |
| `POST` | `/outbound/stop` | `crm.governance` | Suspension globale `{on, reason}` |
| `GET` | `/campaigns/{id}/queue` · `/run-log` | `crm.read` | File et journal |
| `POST` | `/webhooks/mail/{provider}` | signé | Réponses, rejets, désinscriptions → classement et automatismes |
| `POST` | `/privacy/{contactId}` | `crm.personal` | `{type: acces\|rectification\|opposition\|suppression, reference}` |
| `GET` | `/export/contacts` | `crm.export` | Limité au périmètre ; journalisé |

## 3. Connecteurs

| Connecteur | Statut dans le MVP | Production | En cas d'indisponibilité |
|---|---|---|---|
| Boîte professionnelle | Bac à sable | OAuth Google Workspace ou Microsoft 365 (envoi et lecture), ou fournisseur d'envoi avec domaine authentifié (SPF, DKIM, DMARC) | Envois « en attente du canal », alerte, reprise automatique à la reconnexion |
| Google Calendar | Simulé | OAuth, API Calendar (création et mise à jour des événements) | Rendez-vous créés et marqués « non synchronisés », alerte, resynchronisation |
| WhatsApp Business (alertes direction) | Autorisation requise | API Cloud de Meta, numéro vérifié, modèles approuvés | Alertes journalisées « non envoyées » |
| SMS | Non disponible | Fournisseur local ou agrégateur | — |
| LinkedIn | Non disponible | Selon les API et les conditions d'utilisation | — |
| Recherche d'entreprises | Annuaire de démonstration | Recherche web, registres publics, service de vérification d'adresses | Saisie et import manuels |
| Lecture des cartes | Assistant IA de l'application | Service OCR ou IA | Saisie manuelle |

**Les secrets ne sont jamais affichés ni stockés en clair.** La base n'accepte qu'une référence de coffre (`vault://…`).

## 4. Événements internes (pour le futur bus d'événements)

`contact.created`, `contact.updated`, `import.completed`, `opportunity.stage_changed`, `opportunity.won`, `activity.created`, `activity.completed`, `campaign.submitted`, `campaign.approved`, `campaign.suspended`, `campaign.reapproval_required`, `send.sent`, `send.blocked`, `send.failed`, `reply.received`, `optout.received`, `integration.status_changed`, `objective.at_risk`.

Chaque événement porte l'organisation, l'acteur, la date, l'identifiant de l'objet et une clé de déduplication.

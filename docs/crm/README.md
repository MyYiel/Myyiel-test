# Yiel CRM — spécification technique de développement

Ce dossier traduit le cahier des charges fonctionnel du 23 octobre 2026 en une spécification que des développeurs peuvent suivre sans réinterpréter les besoins. Un MVP qui fonctionne la met en œuvre dans myyiel (section **Commercial · Yiel CRM**).

Trois principes ne sont pas négociables :

1. **La direction pilote.** Une campagne n'est exécutée qu'une fois sa **version** autorisée : le périmètre, les modèles (dans leur version), les règles, le calendrier et les plafonds sont figés au moment de l'autorisation. Si l'un d'eux change de façon significative, une nouvelle validation est exigée.
2. **L'IA exécute dans un cadre autorisé.** La recherche, la qualification, la rédaction, les envois et les relances sont orchestrés. Le moteur revérifie **9 règles avant chaque envoi**, et chaque refus est journalisé.
3. **Les données sont maîtrisées.** Chaque donnée garde sa provenance, sa date de collecte et son statut de vérification. Les droits combinent le rôle et le périmètre. Les historiques sont conservés et les organisations sont isolées.

| # | Document | Contenu |
|---|---|---|
| 01 | [`01-ecrans.md`](01-ecrans.md) | Les 10 écrans et l'écran d'analyse : contenu, actions, règles d'affichage, critères de recette |
| 02 | [`02-automatisations.md`](02-automatisations.md) | Moteur événementiel, cycle de vie des campagnes, les 9 règles avant envoi, gestion des réponses, plafonds, reprise après incident |
| 03 | [`03-roles-et-donnees.md`](03-roles-et-donnees.md) | Matrice des rôles et du périmètre, modèle de données, historisation, données personnelles |
| 04 | [`04-api-et-integrations.md`](04-api-et-integrations.md) | API REST, événements, connecteurs (messagerie, Google Calendar, WhatsApp, recherche, lecture des cartes) |
| 05 | [`05-schema-crm.sql`](05-schema-crm.sql) + [`05-schema-crm-test.sql`](05-schema-crm-test.sql) | Schéma PostgreSQL multi-organisation ; règles imposées en base ; 40 scénarios vérifiés sur PostgreSQL 16 |
| 06 | [`06-recette.md`](06-recette.md) | Correspondance REC-01 à REC-20 avec les tests automatisés ; performance et fiabilité |
| 07 | [`07-points-a-valider.md`](07-points-a-valider.md) | Règles de prospection par pays, fournisseurs, coûts, décisions de lots |

## Code du MVP

| Fichier | Rôle |
|---|---|
| `app/src/core/crm.js` | Moteur `Yiel.CRM` : accès, base, recherche, pipeline, agenda, modèles, campagnes, moteur d'envoi, réponses, cockpit, notifications. Sans dépendance au navigateur |
| `app/src/core/crm-seed.js` | Jeu de démonstration : 6 utilisateurs CRM, 14 entreprises, 22 contacts, 16 opportunités, 4 campagnes (en cours, à valider, brouillon, suspendue) |
| `app/src/ui/pages/crm-*.js` | Écrans (cockpit, analyse, recherche, base, pipeline, agenda, messagerie, studio, notifications, administration) |
| `app/tests/crm.test.js` | 107 vérifications, dont les 20 critères de recette : `node app/tests/crm.test.js` |
| `app/tests/e2e/crm-flows.js` | Parcours navigateur complets, par rôle, et largeur téléphone |

## Ce qui est réel, ce qui est simulé dans le MVP

| Élément | MVP | Production |
|---|---|---|
| Règles de gouvernance, droits, périmètres, historisation, moteur, plafonds, idempotence | **Réels** | Identiques, côté serveur |
| Envoi d'e-mails | Fournisseur simulé. Une adresse inexistante produit un rejet définitif ; une panne, une erreur temporaire | Boîte Google Workspace ou Microsoft 365 connectée (OAuth), ou fournisseur d'envoi |
| Lecture des réponses | Saisie ou simulation, puis classement automatique | Synchronisation de la boîte (webhook ou relevé périodique) |
| Recherche d'entreprises | Annuaire de démonstration avec sources fictives | Connecteur de recherche, registres et service de vérification d'adresses |
| Carte de visite | Lecture par l'assistant IA de l'application quand la vue le permet, sinon saisie | Service OCR ou IA, validation humaine identique |
| Rédaction IA | Assistant IA de l'application ; sinon reformulation locale, signalée comme telle | Service IA du produit |
| Google Calendar | Statut et synchronisation simulés ; déconnexion testable | API Google Calendar (OAuth) |
| WhatsApp (alertes à la direction) | **Non configuré** : les alertes sont journalisées « non envoyées » | API WhatsApp Business, modèles approuvés |
| SMS, LinkedIn | Prévus dans l'architecture, marqués « non disponibles » | Selon les fournisseurs, les autorisations et les coûts |
| Authentification | Écran de test (mot de passe « demo », code MFA « 123456 ») | Serveur d'identité, MFA, sessions |

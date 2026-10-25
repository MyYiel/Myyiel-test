# 03 · Rôles, périmètres et modèle de données

## 1. Matrice des rôles (configuration initiale, paramétrable)

| Droit | PDG / propriétaire | Responsable commercial | Commercial | Marketing | Administrateur CRM | DAF |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| Consulter (`crm.read`) | ● | ● | ● | ● | | ● |
| Périmètre des données | toutes | son équipe | son portefeuille | son portefeuille | **aucune** | toutes (lecture) |
| Créer et modifier (`crm.write`) | ● | ● | ● | ● | | |
| Préparer modèles et campagnes (`crm.campaign`) | ● | ● | | ● | | |
| **Valider les campagnes** (`crm.approve`) | ● | sur délégation explicite et datée | | | **jamais** | |
| Exporter (`crm.export`) | ● | ● | | | | |
| Gouvernance : plafonds, objectifs, suspension globale (`crm.governance`) | ● | | | | | |
| Données personnelles (`crm.personal`) | ● | | | | | |
| Administration technique (`crm.admin`) | ● | | | | ● | |

**Règle impérative** : la configuration, la supervision et l'approbation sont séparées. L'administrateur technique gère les comptes et les intégrations sans accès automatique aux contacts et sans pouvoir d'approbation. Une délégation ne peut être accordée qu'à un responsable commercial, par la direction. Elle est journalisée et révocable.

Les droits couvrent la consultation, la création, la modification, l'export, la suppression logique et la gestion des données personnelles. Le périmètre s'applique aussi à l'export : **on n'exporte que ce que l'on voit**, et chaque export est journalisé.

## 2. Entités et relations

```
Organisation (compta.company) ─┬─ Membre (rôle, équipe) ── Délégation de validation
                               ├─ Entreprise ─┬─ Contact ─┬─ Exclusion / consentement (contact, empreinte d'adresse, canal)
                               │              │           ├─ Historique des coordonnées
                               │              │           └─ Membre de liste de prospection
                               │              ├─ Opportunité ── contacts (n-n) ── historique des étapes
                               │              └─ Lien comptable → compta.third_party (client)
                               ├─ Activité (entreprise | contact | opportunité) ── historique
                               ├─ Modèle ── versions
                               ├─ Campagne ── étapes ── approbations (version figée) ── destinataires approuvés
                               │                └─ File d'envoi (clé d'idempotence) ── journal d'exécution
                               ├─ Réponse entrante (classement, tâche)
                               ├─ Objectif ── historique
                               ├─ Résultat de recherche (source) ── recherche enregistrée
                               └─ Intégration (statut, référence de secret) ── notification (clé de déduplication) ── alerte WhatsApp
```

Les règles structurantes :

- Une entreprise a plusieurs contacts.
- Un contact participe à plusieurs opportunités et activités.
- Une opportunité appartient à une entreprise et référence plusieurs contacts.
- Une campagne cible un segment et **conserve la version de chaque approbation**.
- Chaque envoi est lié à un destinataire, une campagne, une approbation, un modèle (et sa version) et un résultat.
- Les exclusions s'appliquent au contact, à l'adresse (empreinte, conservée même après suppression de la fiche) et au canal.
- Chaque organisation a un espace isolé : la sécurité par ligne porte sur toutes les tables.

## 3. Provenance et fiabilité

Chaque entreprise et chaque contact portent un ensemble d'informations de provenance :

- `source_type` : `public`, `utilisateur`, `verifie`, `import`, `carte` ou `deduit` ;
- un libellé et une URL ;
- la date de collecte ;
- la date de dernière vérification.

Les champs importants (e-mail, téléphone, fonction) ont **leur propre source et une confiance de 0 à 100**.

Une adresse **déduite** (par exemple un format d'adresse appliqué au nom) :

- a une confiance inférieure à 50, ce que la base impose ;
- est affichée « déduite · non confirmée » ;
- est écartée des campagnes jusqu'à sa confirmation par un humain.

## 4. Données historisées

- Les changements d'étape et de statut.
- Les modifications des coordonnées (champ, ancienne valeur, nouvelle valeur, auteur).
- Les versions des modèles.
- Les campagnes : événements, approbations (auteur, version, date, périmètre), suspensions et motifs.
- Les envois et les réponses du fournisseur, les blocages et leurs motifs.
- Les oppositions.
- Les objectifs et leurs modifications.
- Les droits, les délégations et les intégrations.
- Les connexions, qu'elles aboutissent ou non.

Les journaux sont protégés : approbations et journal d'exécution sont en ajout seul, la piste d'audit est chaînée. Les durées de conservation sont à fixer (document 07). **Le contenu des messages n'est pas conservé indéfiniment** : le journal garde l'objet, le statut et la référence du fournisseur.

## 5. Données personnelles

Quatre demandes sont prises en charge :

| Demande | Traitement |
|---|---|
| Accès | Export de la fiche et de son historique |
| Rectification | Modification historisée |
| Opposition | Exclusion immédiate |
| Suppression | Anonymisation de la fiche. L'**empreinte de l'adresse** est conservée pour empêcher une réimportation. Les statistiques restent |

Chaque demande est journalisée avec sa référence.

# 08 · Sécurité, rôles et piste d'audit

## Rôles (par société)

| Rôle | Usage type | Droits |
|---|---|---|
| **Propriétaire** | Dirigeant, DAF | Tous : consulter, saisir, valider, contre-passer, lettrer, facturer, trésorerie, verrouiller, **rouvrir**, **clôturer**, paramétrer, **gérer les utilisateurs**, exporter, importer. |
| **Comptable** | Comptable interne, cabinet en mission de tenue | Tout sauf rouvrir une période ou un exercice, clôturer, paramétrer, gérer les utilisateurs. |
| **Lecteur** | Expert-comptable en révision, commissaire aux comptes, direction | Consulter et exporter. |

Matrice détaillée : [`matrice-des-droits.csv`](matrice-des-droits.csv) (générée depuis `Y.ROLES`). Les 14 droits : `read, draft, post, reverse, letter, invoice, bank, lock, reopen, close, settings, users, export, import`.

Règles :
- Un utilisateur peut avoir des rôles différents selon les sociétés (`membership`).
- Il reste toujours au moins un propriétaire par société.
- Le contrôle des droits est fait **côté API** (le prototype le fait côté interface : boutons désactivés et garde `App.guard`). Chaque route de l'OpenAPI porte `x-right`.
- Séparation des tâches recommandée : celui qui saisit les règlements fournisseurs n'est pas celui qui valide les factures fournisseurs (paramétrable plus tard par droits fins).

## Authentification et sessions

- OIDC (fournisseur d'identité myyiel commun à tous les modules), **2FA obligatoire** pour propriétaires et comptables (TOTP ou SMS selon disponibilité ; préférer TOTP).
- Jetons d'accès courts (15 min), rafraîchissement rotatif, révocation à la désactivation de l'utilisateur.
- Journalisation des connexions (succès, échecs, IP, appareil) ; verrouillage progressif après échecs.

## Isolation des données

- `company_id` sur toutes les tables, **Row Level Security** PostgreSQL (`schema.sql`) ; l'API positionne `SET LOCAL app.company_id` dans chaque transaction après vérification du membership.
- Le rôle de base de données de l'application n'est **pas** propriétaire des tables (sinon la RLS est contournée) ; migrations exécutées par un rôle distinct.
- Tests automatisés d'étanchéité inter-sociétés (voir [10](10-plan-de-tests.md)).

## Piste d'audit

- Événement pour toute action métier : horodatage serveur, utilisateur, rôle, action, objet, détail, IP.
- **Chaînage** : `hash = SHA-256(prev_hash | ts | user | action | objet | détail)` (le prototype utilise FNV-1a, suffisant pour la démonstration, à remplacer). Calculé en base par trigger, sous verrou consultatif par société.
- Table **en ajout seul** (trigger refusant UPDATE/DELETE) ; fonction `verify_audit()` qui signale le premier maillon altéré.
- Ancrage externe recommandé : publier chaque jour l'empreinte du dernier événement (par exemple dans un journal horodaté tiers ou un e-mail au propriétaire) pour rendre détectable une réécriture complète de la chaîne.
- Durée de conservation : **10 ans** minimum pour les pièces et livres (Acte uniforme OHADA relatif au droit comptable) ; à confirmer pour chaque pays.

## Protection des données

- Chiffrement au repos (disque + sauvegardes) et en transit (TLS 1.2+).
- Pièces justificatives en stockage objet chiffré, accès par URL signée de courte durée, empreinte SHA-256 conservée.
- Sauvegardes quotidiennes chiffrées, rétention 35 jours + mensuelles 10 ans ; restauration testée chaque trimestre.
- Données personnelles (salariés, tiers personnes physiques) : conformité à la loi camerounaise n° 2024/017 du 23 décembre 2024 relative à la protection des données à caractère personnel, en vigueur depuis le 23 juin 2026, et aux textes équivalents des autres pays (à valider par le juridique) ; registre des traitements, droit d'accès.

## Contrôles applicatifs

- Validation stricte des entrées (schémas OpenAPI), montants entiers, dates ISO.
- Idempotence des créations (`Idempotency-Key`) et des webhooks (n° de transaction opérateur unique).
- Limitation de débit par utilisateur et par société ; quotas d'import.
- Imports : analyse du fichier côté serveur dans un processus isolé, taille limitée, aucune formule Excel évaluée ; neutralisation des cellules commençant par `= + - @` à l'export CSV (injection de formules).
- En-têtes de sécurité (CSP, HSTS), cookies `Secure; HttpOnly; SameSite`.

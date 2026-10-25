# 09 · Intégrations

Dans le prototype, les intégrations sont simulées (bouton « Connecter » sans appel externe). Ce document décrit les contrats à implémenter. **Les API des opérateurs et des banques exigent un contrat commercial et des identifiants : vérifiez leur documentation officielle à jour avant développement.**

## Principes communs

1. Chaque intégration alimente une **source** (relevé `bank_transaction` ou document) ; elle ne passe jamais d'écriture validée sans règle explicite.
2. **Idempotence** : clé naturelle de l'opérateur (n° de transaction) unique par compte ; rejouer un webhook ne crée pas de doublon.
3. **Rapprochement** : toute transaction importée passe par le moteur de rapprochement (règles, suggestions, création d'écriture), puis lettrage.
4. **Traçabilité** : charge utile brute conservée 90 jours (chiffrée), événement d'audit à l'import.
5. Reprise sur erreur : file de messages avec réessais exponentiels, file des messages en échec visible par l'administrateur.

## Mobile Money (MTN MoMo, Orange Money)

Traitement comptable retenu (SYSCOHADA révisé) : les avoirs sur compte marchand sont des **instruments de monnaie électronique, compte 55** (5521 MTN, 5522 Orange), avec un journal dédié par compte.

| Flux | Source | Écriture |
|---|---|---|
| Encaissement client (paiement d'une facture via lien / QR) | Webhook de l'opérateur avec référence de facture | 5521 D (net) + 631 D (frais) / 4111 C (brut), lettrage avec la facture |
| Paiement fournisseur / salarié par Mobile Money | Décaissement initié ou constaté | 4011 / 422 D / 5521 C ; frais en 631 |
| Frais et commissions | Ligne de relevé | 631 D / 5521 C (règle « Frais ») |
| Retrait vers la banque | Ligne de relevé | Virement interne : 585 puis 5211 |

Implémentation :
- Collecte : demande de paiement (request-to-pay) associée à la facture ; statut final reçu par webhook signé ; contrôle du montant et de la devise ; `payment.ext_ref` unique.
- Relevé : récupération périodique de l'historique des transactions du compte marchand pour rapprocher l'intégralité (y compris les frais), le webhook ne suffisant pas.
- Frais : taux paramétrable par opérateur (1 % par défaut dans le prototype, **à remplacer par la grille contractuelle**).

## Banques

- Connexion selon la banque : API propriétaire, EBICS, SFTP de relevés (CAMT.053 / MT940) ou import manuel CSV/Excel (disponible dès maintenant dans l'assistant d'import).
- Profils de correspondance enregistrés par banque (colonnes, format de date, signe des montants).
- Synchronisation quotidienne ; solde de relevé contrôlé contre la somme des lignes (alerte en cas d'écart).

## Administration fiscale et sociale

| Organisme | Intégration |
|---|---|
| DGI Cameroun (impots.cm) | Préparation des déclarations (TVA mensuelle, acomptes, DSF) ; export au format de téléversement si publié ; le dépôt et le paiement restent faits par le contribuable sur le portail. Enregistrement de l'accusé (n°, date) dans myyiel. |
| CNPS | Export des éléments de la déclaration (DIPE) depuis la paie ; enregistrement du paiement. |
| Facturation électronique | Suivre les évolutions réglementaires (factures normalisées / certifiées) : prévoir dans le modèle un identifiant de certification et un QR de vérification sur la facture. |

## Modules myyiel

| Module | Flux vers la comptabilité |
|---|---|
| RH & Paie | À chaque clôture de paie : centralisation (661, 664 / 431, 447, 422) par section, avec détail par salarié en option (tiers P…). |
| Commercial (CRM) | Devis accepté → facture brouillon dans Ventes ; statut de paiement renvoyé au CRM. |
| Gestion de projets | Section analytique par projet (axe PRJ) ; temps passés → clés de répartition. |
| Tableau de bord groupe | Lecture des indicateurs (CA, résultat, trésorerie) par API de reporting. |

Format d'échange interne : événements (`payroll.closed`, `quote.accepted`, `invoice.paid`) publiés sur le bus myyiel, consommés par le service comptable de façon idempotente.

## Messagerie

Envoi des factures et relances par e-mail (PDF joint) et WhatsApp (lien de consultation et de paiement Mobile Money). Le prototype prépare le texte à copier ; en production : fournisseur d'e-mail transactionnel et API WhatsApp Business, avec suivi d'ouverture et désinscription.

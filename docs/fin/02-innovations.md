# 02 · Les six innovations

L'objectif n'est pas de mettre de l'intelligence artificielle partout. Il s'agit de répondre à des problèmes concrets :

- des encaissements dispersés entre la banque, MTN et Orange ;
- des paiements partiels ;
- des justificatifs reçus sur WhatsApp ;
- des connexions bancaires hétérogènes ;
- un suivi manuel.

Ce sont des pistes de différenciation. L'intérêt tient à leur combinaison, pas à l'idée que personne d'autre ne les propose.

| # | Innovation | Livré dans le prototype | À brancher pour la production |
|---|---|---|---|
| 1 | **Facture WhatsApp avec paiement intégré** | Message court avec lien sécurisé et code, page de paiement mobile (montant, moyens disponibles, numéro, « Initier le paiement »), reçu, statuts synchronisés par la notification signée | Compte WhatsApp Business vérifié (API officielle), API marchandes MTN MoMo et Orange Money, hébergement de `pay.myyiel.com` |
| 2 | **Boîte de réception financière** | Dépôt de fichier ; lecture automatique par l'assistant quand la vue le permet, sinon saisie guidée ; comparaison au référentiel et à la comptabilité ; validation ou rejet | Adresse e-mail entrante par société, numéro WhatsApp Business, service OCR |
| 3 | **Rapprochement intelligent** | Frais d'opérateur, paiements fractionnés, références imparfaites, encaissements groupés, écritures existantes ; score expliqué ; jamais d'association forcée | Imports de relevés par banque (CSV, Excel, MT940), API bancaires disponibles |
| 4 | **Prévision prudente** | 13 semaines ; scénarios central et prudent ; seuil d'alerte ; prise en compte des promesses, de la paie et des échéances récurrentes | Ventes et dépenses prévisionnelles saisies, budgets |
| 5 | **Détection d'anomalies avant paiement** | Score de risque sur chaque paiement : doublon, coordonnées modifiées ou non vérifiées, carence, montant inhabituel, fournisseur non validé, liste de vigilance, compte partagé avec un salarié ; blocage et contrôle humain | Vérification du nom du titulaire par l'opérateur ou la banque, si le service est ouvert |
| 6 | **Connexions instables** | Brouillons et préparation sans serveur dans l'application monopage ; les transactions et les opérations fiscales ne sont finalisées qu'après confirmation du serveur (prestataire ou rapprochement) | File d'attente hors ligne côté client, synchronisation au retour du réseau, numérotation définitive attribuée par le serveur |

## Détail de l'innovation 6 · fonctionnement hors connexion

Ce qui peut être préparé hors connexion :

- les brouillons de facture et de devis ;
- les justificatifs photographiés ;
- les notes et les relances à envoyer ;
- les fiches tiers non sensibles.

Ce qui exige le serveur :

- la numérotation définitive ;
- l'émission et le scellement ;
- l'envoi ;
- l'encaissement ;
- l'approbation et l'exécution d'un paiement ;
- toute modification de coordonnées bancaires ;
- la certification fiscale.

Dans l'API, chaque action « finale » porte une **clé d'idempotence** générée côté client (voir le document 04). Un renvoi après une coupure ne produit donc jamais deux factures, deux paiements ou deux écritures.

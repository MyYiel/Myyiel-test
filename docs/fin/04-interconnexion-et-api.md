# 04 · Interconnexion, notifications des prestataires et API

## 1. Saisie unique

| Événement | Saisi dans | Produit automatiquement |
|---|---|---|
| Facture émise | Ventes / Facturation | Écriture de vente (VTE), échéance client, lien de paiement à l'envoi, ligne de prévision |
| Paiement en ligne confirmé | Notification du prestataire | Encaissement (MTN / OM / BQ1), frais en 631, lettrage, statut « payée », lien soldé |
| Justificatif confirmé | Ligne de relevé | Encaissement et rapprochement de la ligne |
| Facture fournisseur validée | Boîte de réception | Écriture d'achat (ACH), échéance fournisseur, ligne de prévision |
| Paiement fournisseur exécuté | Proposition approuvée | Règlement, lettrage de la facture fournisseur |
| Salaires validés | Paie | Écriture de paie, ordres de virement, lignes de prévision (nets le 28, charges le 15) |
| Ligne de relevé importée | Import / API bancaire | Proposition de rapprochement ; encaissement groupé en une seule écriture |

Chaque opération porte :

- un **identifiant unique** ;
- un **statut** ;
- une **date de validation** ;
- un **historique**, à la fois sur l'objet (`meta.events`, `tx.events`, approbations…) et dans la piste d'audit chaînée de la société.

## 2. Notifications des prestataires (webhooks)

```
POST /webhooks/payments/{provider}        provider ∈ mtn | orange
Content-Type: application/json
X-Signature: hex(HMAC-SHA256(secret, providerRef|amount|status))

{ "providerRef": "7712345678", "amount": 1000000, "status": "SUCCESSFUL", "at": "2026-10-21T09:14:03Z" }
```

Traitement, dans l'ordre (`F.callback`, à reproduire côté serveur) :

1. **Journaliser** la notification brute dans `fin.provider_event`, même invalide.
2. **Retrouver** la transaction par (prestataire, `providerRef`). Si elle est inconnue : `404` et incident `webhook_inconnu`.
3. **Vérifier la signature.** Si elle est invalide : `401`, incident `signature`, aucun effet.
4. **Contrôler l'idempotence.** Une référence déjà traitée renvoie `200 {duplicate: true}`, sans nouvelle écriture. En base, deux garde-fous : `UNIQUE (provider, provider_ref, announced, signature_ok)` et `payment.UNIQUE (company, method, ext_ref)`.
5. **Traiter le statut.** Statut ≠ `SUCCESSFUL` : transaction `echouee`.
6. **Comparer le montant.** Montant ≠ montant demandé : transaction `ecart`, examen manuel.
7. **Enregistrer le paiement** dans une même transaction SQL : paiement, écriture, statut `confirmee`, lien soldé.

En production, le prototype « bac à sable » (`fnv`) est remplacé par HMAC-SHA256. Le secret est stocké dans un coffre ; la base ne garde qu'une référence (`secret_ref`).

## 3. API REST (extraits)

Toutes les requêtes d'écriture portent un en-tête `Idempotency-Key`, généré par le client. Il garantit qu'aucun doublon n'apparaît après une coupure réseau.

| Méthode | Route | Droit | Effet |
|---|---|---|---|
| `POST` | `/invoices/{id}/send` | `invoice` | Contrôle des mentions, scellement, lien, envoi `{channels:["whatsapp","email"]}` |
| `GET` | `/pay/{token}` | public | Facture, reste dû, moyens disponibles (jamais un moyen indisponible) |
| `POST` | `/pay/{token}/initiate` | public, limité en débit | `{method, phone, amount}` → transaction `en_attente` |
| `POST` | `/invoices/{id}/proofs` | `fin.collect` | Justificatif déclaré → analyse et verdict |
| `POST` | `/proofs/{id}/confirm` | `fin.collect` | `{bankTransactionId}` obligatoire |
| `POST` | `/inbox` | `fin.payables` | Dépôt ou réception d'une facture fournisseur |
| `POST` | `/inbox/{id}/validate` | `fin.payables` | `{tiersId, account, override?, comment?}` → écriture d'achat |
| `POST` | `/inbox/{id}/reject` | `fin.payables` | `{reason, fraud}` |
| `POST` | `/parties/{id}/bank-changes` | `fin.vendor` | Demande en quarantaine |
| `POST` | `/bank-changes/{id}/decision` | `fin.verify` | `{result, contactId, comment, override?}` |
| `POST` | `/payments/proposals` | `fin.payables` | `{tiersId, items[], amount?}` → score de risque |
| `POST` | `/payments/proposals/{id}/approve` | `fin.approve` | `{decision, comment}` |
| `POST` | `/payments/proposals/{id}/execute` | `fin.pay` | Risque recalculé, puis règlement |
| `GET` | `/reconciliation/suggestions` | `fin.read` | Propositions avec score et raisons |
| `POST` | `/reconciliation/apply` | `fin.collect` | `{bankTransactionId, docs[] \| book}` |
| `GET` | `/treasury/forecast?weeks=13` | `fin.read` | Semaines, scénarios, tension |
| `POST` | `/watchlist` | `fin.verify` | `{kind, value, reason}` |
| `POST` | `/parties/import` | `fin.vendor` | Fichier, correspondance, options → analyse ; confirmation → création ou mise à jour |

## 4. Rôles et droits du module

| Droit | Propriétaire | Comptable | DAF | Lecteur |
|---|:-:|:-:|:-:|:-:|
| `fin.read` consulter | ● | ● | ● | ● |
| `fin.vendor` fiches tiers | ● | ● | ● | |
| `fin.collect` encaissements, relances, rapprochement | ● | ● | ● | |
| `fin.payables` factures fournisseurs, propositions | ● | ● | ● | |
| `fin.approve` approuver | ● | | ● | |
| `fin.pay` exécuter | ● | | ● | |
| `fin.verify` coordonnées, validation de fiche, vigilance | ● | | ● | |
| `fin.settings` seuils, prestataires, modèles | ● | | ● | |

Séparation des tâches, imposée **à la fois dans le moteur et en base** :

- le préparateur n'approuve ni n'exécute ;
- deux approbateurs doivent être distincts ;
- la personne qui saisit un changement de coordonnées ne le confirme pas ;
- la personne qui crée une fiche fournisseur ne la valide pas.

## 5. Formats d'échange

| Format | Usage |
|---|---|
| Import tiers | Excel ou CSV, colonnes libres, correspondance par synonymes (`F.TIERS_FIELDS`) |
| Export tiers | Mêmes colonnes ; numéros de compte réservés aux rôles habilités |
| Relevés | CSV, Excel (module Banque) ; MT940 et CAMT.053 à prévoir selon les banques |
| Fichiers de virement | À produire par banque (format propre ou ISO 20022 pain.001), depuis les propositions exécutées |

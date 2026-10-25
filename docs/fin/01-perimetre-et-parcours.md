# 01 · Périmètre, écrans et parcours

La navigation ajoute une section « Trésorerie, facturation & paiements ». Ses modules s'ouvrent en accordéon et donnent accès aux sous-onglets.

| Module | Sous-onglets | Page |
|---|---|---|
| Pilotage de trésorerie | Vue d'ensemble · Prévision 13 semaines · Comptes & Mobile Money | `tresor` |
| Facturation électronique | Factures & cycle de vie · Modèles de facture · Mentions & conformité | `fin-factu` |
| Encaissements & relances | Paiements en ligne · Liens de paiement · Justificatifs déclarés · Vérifier un justificatif · Relances du jour · Promesses · Historique | `fin-encaiss`, `fin-relances` |
| Dépenses & paiements | Boîte de réception · Factures reçues · Échéancier · Paiements à approuver · Salaires & charges | `fin-inbox`, `fin-pay` |
| Clients & fournisseurs | Répertoire fournisseurs · Répertoire clients · Import & export | `fin-tiers` |
| Rapprochement intelligent | — | `fin-rappro` |
| Anti-fraude | Vue d'ensemble · Coordonnées en quarantaine · Liste de vigilance · Vérifier un numéro / RIB · Journal de sécurité | `fin-fraude` |
| Contrôles & paramètres | Seuils & droits · Prestataires · Scénario de relance · Offre & fonctions | `fin-param` |

Des badges signalent ce qui attend une action : coordonnées en quarantaine, paiements bloqués ou à approuver, factures reçues, justificatifs suspects, lignes de relevé à rapprocher. Les notifications (cloche) reprennent `Yiel.Fin.notifications`.

## 1. Facturation électronique

### Modèles

Deux sources de modèles :

- le **modèle myyiel** ;
- un **modèle importé** (PDF, Word, ODT ou image).

L'import suit un assistant en quatre étapes :

- **A · Fichier** : dépôt du modèle.
- **B · Zones reconnues** : chaque zone a un indice de confiance, à confirmer.
- **C · Style** : couleurs, QR code, zone 5 facultative, conditions.
- **D · Aperçu** : les 8 zones sont numérotées.

La facture est découpée en 8 zones. Les zones verrouillées tirent leur contenu des données, jamais d'une saisie libre ; elles portent un cadenas.

| # | Zone | Verrouillée |
|---|---|---|
| 1 | Référence, dates, version | oui |
| 2 | Client (NIU en B2B) | oui |
| 3 | Émetteur (raison sociale, forme, capital, NIU, RCCM, adresse) | oui |
| 4 | Lignes (désignation, quantité, PU HT, remise, taxe) | oui |
| 5 | Groupes d'articles | non (facultative) |
| 6 | Totaux, acomptes, net à payer | oui |
| 7 | Paiement (moyens, lien, code, QR) | non |
| 8 | Pied de page légal (pénalités, certification) | oui |

### Mentions et niveau

`F.checkMentions` contrôle 15 mentions et classe la facture à l'un de trois niveaux :

| Niveau | Condition |
|---|---|
| **Mentions à compléter** | Une mention bloquante manque. L'envoi est refusé. |
| **Facture commerciale** | Toutes les mentions sont présentes, sans certification électronique. C'est le niveau par défaut. |
| **Fiscalement conforme** | Possible seulement en mode fiscal avec un numéro d'homologation renseigné. La base de données l'impose aussi. |

Si le NIU ou le RCCM de la société manque, un bandeau propose de les compléter.

### Cycle de vie

Une facture passe par cinq étapes :

1. Émise.
2. Envoyée (canal : WhatsApp ou e-mail).
3. Consultée (le lien a été ouvert).
4. Paiement initié (ou partiellement payée).
5. Payée.

Chaque événement est horodaté dans `meta.events`. À l'envoi, une **empreinte** de la forme canonique (n°, dates, client, lignes, totaux) est calculée. Si le document est modifié ensuite, il apparaît comme « altéré ».

Opérations particulières :

- **Avoir** : on n'annule jamais une facture en la supprimant. L'annulation crée un avoir lié, et l'historique reste consultable.
- **Facture d'acompte** : c'est une vraie facture, numérotée et soumise à la TVA. La facture de solde déduit l'acompte.
- **Paiement partiel** : autorisé ou non selon le paramétrage.

## 2. Encaissements clients

Le parcours :

1. **Envoi** : `F.send` scelle la facture, crée le lien `https://pay.myyiel.com/f/<jeton>` avec un code de vérification, puis prépare le message WhatsApp. Le message rappelle que la société ne demande jamais de payer sur un numéro personnel.
2. **Ouverture** : le client ouvre le lien (`F.view`). La page affiche la facture, le montant, les moyens réellement disponibles et le numéro à débiter.
3. **Initiation** : `F.initiate` crée une transaction `en_attente`. **Rien n'est encaissé à ce stade.**
4. **Notification du prestataire** : `F.callback` traite la réponse de l'opérateur, dans cet ordre :
   - vérification de la signature ;
   - idempotence ;
   - contrôle du montant ;
   - puis seulement `Y.registerPayment`, qui génère l'écriture banque ou Mobile Money, les frais en 631 et le lettrage.

   La facture devient « payée » et le lien est soldé.
5. **Cas d'échec** :
   - échec de l'opérateur : transaction `echouee` ;
   - montant différent : transaction `ecart`, en examen, sans encaissement ;
   - signature invalide : notification rejetée et incident de sécurité journalisé.

## 3. Dépenses et factures fournisseurs

La boîte de réception reçoit les factures par trois canaux :

- une adresse e-mail dédiée ;
- WhatsApp Business (à connecter) ;
- un dépôt de fichier, avec lecture automatique quand elle est disponible.

`F.analyzeInbox` compare chaque facture au référentiel et à la comptabilité. Voir les contrôles au document 03.

Le gestionnaire a ensuite trois choix :

- **Valider** : `F.validateInbox` génère l'écriture d'achat (`Y.postPurchase`), et la facture apparaît dans l'échéancier.
- **Rejeter**.
- **Signaler une fraude** : le RIB, le numéro et le domaine passent en liste de vigilance.

## 4. Paiements fournisseurs

1. **Échéancier** : les lignes 40x non lettrées, déduction faite de ce qui est déjà proposé.
2. **Proposition** (`F.propose`) : regroupement par fournisseur, score de risque, nombre d'approbations requis.
3. **Approbation** (`F.approve`) : le préparateur n'approuve pas son propre paiement. Il faut deux approbateurs distincts au-delà du seuil ou si le risque dépasse le seuil de revue. Un commentaire est obligatoire si le paiement est risqué.
4. **Exécution** (`F.execute`) : le risque est recalculé, puis `Y.paySupplier` génère le règlement et le lettrage.

Les salaires validés dans la Paie suivent leur propre circuit (DRH puis DAF). Ils apparaissent dans l'onglet « Salaires & charges » et dans la prévision.

## 5. Trésorerie

La trésorerie affiche :

- les soldes comptables des comptes 52x et 55x ;
- les factures à encaisser, dont la part échue ;
- les factures fournisseurs à payer.

La prévision sur 13 semaines fonctionne ainsi :

- **Encaissements** : chaque facture ouverte est décalée du retard moyen du client. Une promesse datée remplace cette estimation.
- **Scénario prudent** : +15 jours, factures de plus de 90 jours exclues, probabilité réduite selon l'ancienneté.
- **Décaissements** : fournisseurs à leur échéance ; salaires nets du dernier bulletin figé le 28 ; CNPS, DGI et commune le 15 ; emprunt le 25.
- **Alerte** : la **tension** est signalée dès que le scénario prudent passe sous le seuil.

## 6. Répertoire clients et fournisseurs

**Les cartes**, sur le modèle de la maquette fournie :

- tuiles de catégories ;
- filtres (Tous, Actifs, Factures à payer, Échus, À valider, Suspendus), ville, mode de paiement, recherche ;
- sur chaque carte : avatar à initiales, statut, ville, téléphone, e-mail, modes de paiement, solde, évaluation ;
- boutons « Contacter », « Envoyer un BC » ou « Facturer », « Payer » ou « Encaisser ».

**La fiche** a neuf onglets :

- Vue d'ensemble ;
- Informations ;
- Contacts ;
- Documents ;
- Évaluation ;
- Historique ;
- Achats ou Ventes & factures ;
- Paiements ;
- Notes.

Elle affiche aussi des indicateurs : factures, engagé, payé, solde, évaluation ou fiabilité. **Ces chiffres sont calculés depuis la comptabilité**, rien n'est ressaisi.

Les coordonnées bancaires sont **masquées** pour les rôles non habilités. Elles se modifient uniquement par une demande contrôlée (document 03).

**L'import** suit quatre étapes :

1. Le fichier : modèle Excel téléchargeable.
2. La correspondance des colonnes, avec reconnaissance des synonymes.
3. L'aperçu et les contrôles : doublons dans le fichier et avec le référentiel (NIU, raison sociale proche, téléphone, e-mail), erreurs, choix entre création et mise à jour.
4. Le rapport.

Les fournisseurs importés arrivent « à valider », et leurs coordonnées « à confirmer ». L'export reprend les mêmes colonnes.

## 7. Relances

Le scénario par défaut :

| Jour | Canal | Action |
|---|---|---|
| J-3 | WhatsApp | Rappel courtois |
| J+1 | E-mail | Échéance dépassée |
| J+7 | WhatsApp | Relance avec lien |
| J+15 | Appel | Appel du responsable de compte |
| J+30 | Courrier | Mise en demeure |

Chaque message contient le lien de paiement. Une promesse datée suspend les relances. Une promesse échue sans paiement passe « non tenue ». Le score de fiabilité du client tient compte du retard moyen, des promesses tenues et de l'encours échu.

## 8. Rapprochement intelligent

`F.suggest` propose, pour chaque ligne de relevé ouverte, la meilleure correspondance avec son score et ses raisons :

| Cas | Score |
|---|---|
| Montant exact du reste dû | +40 |
| Montant = reste − frais opérateur (0,5 à 2 %) | +30 |
| Numéro de facture dans le libellé | +50 |
| Numéro partiel | +30 |
| Nom du client, y compris avec une faute de frappe (distance de Levenshtein) | jusqu'à +30 |
| Numéro Mobile Money du client | +25 |

D'autres cas sont reconnus :

- les **encaissements groupés** (2 ou 3 factures du même client) ;
- les **paiements fractionnés** (plusieurs versements qui soldent une facture) ;
- les **écritures déjà passées**.

Niveaux : forte (≥ 75), probable (≥ 50), à examiner. Une proposition « probable » demande une confirmation. `F.applySuggestion` refuse toute association dont le total net diffère du relevé.

# 02 · Règles de gestion

Chaque règle a un identifiant. En production, les règles **[BDD]** doivent aussi être garanties par la base (contraintes, triggers) et pas seulement par l'API, car une écriture comptable fausse est irréparable une fois communiquée.

## Écritures

| ID | Règle | Prototype |
|---|---|---|
| RG-E01 | Une écriture comporte au moins deux lignes. | `checkEntry` |
| RG-E02 **[BDD]** | Somme des débits = somme des crédits, au franc près. | `checkEntry`, trigger `trg_entry_balanced` |
| RG-E03 | Une ligne porte un débit **ou** un crédit, strictement positif ; jamais les deux, jamais zéro, jamais négatif. | `checkEntry`, `CHECK` SQL |
| RG-E04 | Monnaie sans décimales (XAF/XOF) : tout montant décimal est refusé (pas d'arrondi silencieux). | `postEntry` |
| RG-E05 | Seuls les comptes **de détail** (feuilles du plan, au moins 3 chiffres, classes 1 à 8) sont imputables ; la classe 9 est réservée à l'analytique. | `isLeaf`, `checkEntry` |
| RG-E06 | Un compte de nature « tiers » (collectif 40, 41, 42, 46, 48…) exige un tiers sur la ligne. | `checkEntry` |
| RG-E07 | Un compte marqué « analytique obligatoire » exige une section. | `checkEntry` |
| RG-E08 | Un journal de trésorerie exige au moins une ligne sur son compte de contrepartie (52x, 55x, 57x). | `checkEntry` |
| RG-E09 | La date comptable appartient à un exercice existant, non clôturé, et à une période non verrouillée (sauf travaux de clôture au 31/12 et à-nouveaux). | `isPeriodOpen` |
| RG-E10 | Le journal des à-nouveaux (AN) n'accepte que les écritures générées par la clôture ou la reprise de soldes. | `checkEntry` |
| RG-E11 **[BDD]** | **Numérotation** : attribuée au moment de la validation, continue et sans trou par journal et par exercice (`ACH-2026-0001`…). Un brouillon n'a pas de numéro. | `nextNumber`, séquence par (société, journal, exercice) verrouillée en transaction |
| RG-E12 **[BDD]** | **Intangibilité** : une écriture validée ne peut être ni modifiée ni supprimée. Seules exceptions tracées : lettre de lettrage, marque de rapprochement, section analytique (avec audit). | trigger `trg_entry_immutable` |
| RG-E13 | La correction d'une écriture validée se fait par **contre-passation** (écriture inverse datée, motif, lien réciproque) puis nouvelle saisie. Une contre-passation ne se contre-passe pas ; une écriture ne se contre-passe qu'une fois. | `reverseEntry` |
| RG-E14 | Seuls les brouillons peuvent être supprimés. | `deleteDraft` |

## Plan comptable et tiers

| ID | Règle |
|---|---|
| RG-P01 | Numéro de 2 à 10 chiffres commençant par la classe ; unicité par société. |
| RG-P02 | Un compte créé doit se rattacher à un parent SYSCOHADA existant (préfixe le plus long). |
| RG-P03 | Un compte mouvementé ne peut pas être renuméroté ; un compte non soldé ne peut pas être désactivé. |
| RG-P04 | Le sens, la nature (général, tiers, trésorerie), le caractère lettrable et rapprochable sont déduits du numéro (voir `accountMeta`) et modifiables. |
| RG-T01 | Code tiers unique ; automatique C0001 (client), F0001 (fournisseur), P0001 (personnel). |
| RG-T02 | NIU : 8 à 20 caractères alphanumériques ; n° Mobile Money : 8 à 20 chiffres avec indicatif facultatif. |
| RG-T03 | Le compte collectif d'un tiers mouvementé ne peut plus changer. |

## Lettrage et rapprochement

| ID | Règle |
|---|---|
| RG-L01 | Le lettrage porte sur un seul compte lettrable et un seul tiers. |
| RG-L02 | Lettrage total (lettre majuscule) : la sélection est soldée. Lettrage partiel (minuscule) : autorisé avec écart, la ligne reste ouverte dans la balance âgée. |
| RG-L03 | Une ligne déjà lettrée ne peut pas être relettrée sans délettrage préalable. |
| RG-L04 | Lettrage automatique : même tiers, même montant, référence prioritaire. Un encaissement de facture est lettré automatiquement. |
| RG-R01 | Une ligne de relevé et une ligne comptable ne se rapprochent que si les montants sont identiques (signe compris) ; chacune une seule fois. |
| RG-R02 | Import de relevé : dédoublonnage par empreinte (compte, date, montant, référence, libellé). |
| RG-R03 | Rapprochement automatique : montant identique, écart de date ≤ 10 jours, unicité du candidat ou référence concordante. |
| RG-R04 | Les règles d'affectation proposent une imputation ; elles ne valident jamais seules une écriture. |

## Ventes, achats, trésorerie

| ID | Règle |
|---|---|
| RG-V01 | Une facture ne reçoit son numéro (FA-AAAA-NNNN) qu'à l'émission ; une facture émise n'est plus modifiable : on émet un **avoir**. |
| RG-V02 | Contrôles à l'émission : client choisi, au moins une ligne, désignation et quantité > 0 sur chaque ligne, total TTC > 0. À ajouter en production : NIU du client obligatoire en B2B et mentions légales de l'émetteur (NIU, RCCM). |
| RG-V03 | Un règlement ne peut pas dépasser le reste dû. Les frais Mobile Money retenus par l'opérateur sont comptabilisés en 631 et le client est soldé du montant brut. |
| RG-V04 | Un devis converti en facture passe au statut « facturé » et ne peut plus être converti. |
| RG-A01 | Une facture d'achat comportant un compte 2x passe en journal IMMO ; la TVA sur immobilisation va en 4451, sur biens et services en 4452. |
| RG-B01 | Virement interne : transit obligatoire par 585 (deux écritures, une par journal de trésorerie). |
| RG-B02 | Arrêté de caisse : un écart est comptabilisé (658 / 758) et tracé. |

## TVA et fiscalité (Cameroun, paramétrable)

| ID | Règle |
|---|---|
| RG-F01 | TVA au taux normal 19,25 % = 17,5 % de principal + 10 % de centimes additionnels communaux (1,75 point). La décomposition principal / CAC est calculée au prorata (17,5 / 19,25). |
| RG-F02 | Déclaration mensuelle : collectée (443) − déductible (4452, 4451) − crédit antérieur (4449) = TVA due (4441) ou crédit à reporter (4449). Échéance : 15 du mois suivant. |
| RG-F03 | Une période liquidée ne peut pas l'être deux fois ; le paiement exige la liquidation. |
| RG-F04 | IS = max(résultat fiscal × taux, CA × taux du minimum de perception) ; résultat fiscal = résultat comptable + réintégrations − déductions. |
| RG-F05 | Réserve légale : 10 % du bénéfice jusqu'à 20 % du capital (Acte uniforme OHADA, sociétés commerciales). Dividendes : retenue IRCM au taux paramétré. |

## Immobilisations

| ID | Règle |
|---|---|
| RG-I01 | Comptes 21 à 25 ; valeur > 0 ; durée > 0 ; date de mise en service obligatoire. |
| RG-I02 | Amortissement au prorata mensuel à partir du mois de mise en service. Linéaire : base / durée. Dégressif : taux linéaire × coefficient (1,5 jusqu'à 4 ans, 2 pour 5-6 ans, 2,5 au-delà), bascule en linéaire quand il devient supérieur. |
| RG-I03 | Une dotation mensuelle n'est passée qu'une fois par bien (marqueur par mois) ; regroupement par compte de dotation, d'amortissement et section. |
| RG-I04 | Cession : dotations complémentaires jusqu'à la date, sortie des amortissements, VNC en 81x, prix en 82x contre 485. |

## Clôture

| ID | Règle |
|---|---|
| RG-C01 | Contrôles bloquants : balance déséquilibrée, brouillons de l'exercice. Contrôles d'alerte : 471 non soldé, relevés non rapprochés, périodes ouvertes, dotations manquantes, TVA non liquidée, lignes collectives sans tiers. |
| RG-C02 | Écritures d'inventaire datées du 31/12, journal OD ; CCA, PCA, FNP, FAE marquées « à extourner ». |
| RG-C03 | Verrouillage : les 12 périodes sont fermées ; réouverture possible avec motif **tant que les à-nouveaux ne sont pas générés**. |
| RG-C04 **[BDD]** | À-nouveaux : une seule écriture AN au 1er jour de N+1, équilibrée, classes 1 à 5, détail par tiers en option (lettrage conservé), résultat en 131 (bénéfice) ou 139 (perte). L'exercice N+1 est créé s'il n'existe pas. |
| RG-C05 | Extourne automatique au 01/01/N+1 des écritures d'inventaire marquées. |
| RG-C06 | Affectation : réservée à un bénéfice ; répartition = résultat exactement ; datée dans N+1. |

## Piste d'audit

| ID | Règle |
|---|---|
| RG-AU01 **[BDD]** | Toute action métier (création, validation, contre-passation, lettrage, rapprochement, import, paramétrage, droits, clôture) produit un événement horodaté avec l'utilisateur et son rôle. |
| RG-AU02 **[BDD]** | Les événements sont chaînés : `hash = H(hash_précédent | horodatage | utilisateur | action | objet | détail)`. Table en ajout seul (pas d'UPDATE ni de DELETE). |
| RG-AU03 | La vérification recalcule la chaîne et signale le premier événement altéré. |

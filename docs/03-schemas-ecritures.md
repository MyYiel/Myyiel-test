# 03 · Schémas d'écritures

Chaque opération du module génère une écriture déterminée. Montants d'exemple en XAF, TVA à 19,25 %. D = débit, C = crédit. La fonction du moteur qui produit l'écriture est indiquée.

## Ventes

**Facture client** — `emitDoc`, journal VTE, numéro FA-AAAA-NNNN
| Compte | Libellé | D | C |
|---|---|---:|---:|
| 4111 (tiers) | Client · FA-2026-0042 (échéance portée sur la ligne) | 1 192 500 | |
| 7062 (section) | Prestations HT, regroupées par compte / section / code TVA | | 1 000 000 |
| 4431 | TVA collectée | | 192 500 |

**Avoir** — `creditNoteFrom` + `emitDoc` : écriture inverse de la facture (AV-AAAA-NNNN).

**Encaissement Mobile Money avec frais opérateur** — `registerPayment`, journal MTN (ou OM, BQ1, BQ2, CAI)
| Compte | Libellé | D | C |
|---|---|---:|---:|
| 5521 | Montant net reçu sur le compte marchand | 1 180 575 | |
| 631 (STR) | Frais MTN Mobile Money (1 %) | 11 925 | |
| 4111 (tiers) | Client, lettré avec la facture | | 1 192 500 |

## Achats

**Facture fournisseur** — `postPurchase`, journal ACH (IMMO si un compte 2x est présent)
| Compte | D | C |
|---|---:|---:|
| 6055 (section) Fournitures | 100 000 | |
| 4452 TVA récupérable B&S | 19 250 | |
| 4011 (tiers) Fournisseur | | 119 250 |

Pour une immobilisation : 2441 en débit, **4451** pour la TVA, 481 Fournisseur d'investissement possible selon le paramétrage.

**Règlement fournisseur** — `paySupplier` : 4011 (tiers) D / 5211 C, lettrage avec la facture.

## Trésorerie

| Opération | Fonction | Écriture |
|---|---|---|
| Ligne de relevé créditrice sans écriture | `createFromTx` | 52x/55x D / compte choisi C |
| Ligne de relevé débitrice avec TVA incluse | `createFromTx` | charge HT D + 4452 D / 52x/55x C |
| Virement interne | `transfer-new` | journal source : 585 D / compte source C ; journal cible : compte cible D / 585 C |
| Manquant de caisse | `cash-count` | 658 D / 5711 C |
| Excédent de caisse | `cash-count` | 5711 D / 758 C |

## Paie (centralisation) — `postPayroll`, journal PAIE
| Compte | D | C |
|---|---:|---:|
| 661 Salaires bruts (section) | 11 240 000 | |
| 664 Charges patronales | 1 821 000 | |
| 431 CNPS (parts salariale + patronale) | | 2 293 080 |
| 447 IRPP et taxes retenus à la source | | 1 124 000 |
| 422 (tiers P0000) Salaires nets à payer | | 9 643 920 |

## TVA

**Liquidation mensuelle** — `postVatLiquidation`, journal OD au dernier jour du mois
| Compte | D | C |
|---|---:|---:|
| 4431 TVA collectée (solde) | collectée | |
| 4452 TVA déductible B&S | | déductible |
| 4451 TVA déductible immobilisations | | déductible |
| 4449 crédit antérieur imputé | | crédit N-1 |
| 4441 TVA due | | due |
| ou 4449 crédit à reporter | crédit | |

**Paiement** — `postVatPayment`, journal BQ1 : 4441 D / 5211 C.

## Immobilisations

| Opération | Fonction | Écriture |
|---|---|---|
| Dotation mensuelle | `depreciationRun` | 6812 (incorporelles) ou 6813 (corporelles) D, section / 281x, 283x, 284x C |
| Cession | `disposeAsset` | 28x D (cumul) + 811/812 D (VNC) / 2x C (VO) ; 485 (tiers) D / 821/822 C (prix) |
| Mise au rebut | `disposeAsset` (prix 0) | 28x D + 81x D / 2x C |

## Clôture

| Opération | Fonction | Écriture (31/12/N, journal OD) |
|---|---|---|
| Charge constatée d'avance | `postInventory` CCA | 476 D / 6xx C — extournée au 01/01/N+1 |
| Produit constaté d'avance | PCA | 7xx D / 477 C — extourné |
| Facture non parvenue | FNP | 6xx D / 408 C — extournée |
| Facture à établir | FAE | 418 D / 7xx C — extournée |
| Dépréciation de créance | DEPC | 6594 D / 491 C |
| Provision pour risques | PROV | 691 D / 191 C |
| Impôt sur les bénéfices | `postIncomeTax` | 891 D / 441 C |

**À-nouveaux** — `generateAN`, journal AN au 01/01/N+1 : reprise de chaque solde des classes 1 à 5 (par tiers pour les comptes lettrables si l'option est retenue) ; le solde des classes 6, 7 et 8 est porté en **131** (bénéfice, au crédit) ou **139** (perte, au débit).

**Affectation** — `postAffectation`, journal OD (date de l'AGO, exercice N+1)
| Compte | D | C |
|---|---:|---:|
| 131 Résultat en instance d'affectation | bénéfice | |
| 111 Réserve légale | | dotation |
| 118 Autres réserves | | |
| 465 (tiers A0001) Associés, dividendes à payer | | dividendes |
| 121 Report à nouveau créditeur | | solde |

**Contre-passation** — `reverseEntry` : mêmes comptes, tiers, sections, débits et crédits inversés, même journal (OD pour une écriture AN), libellé « Contre-passation de … », liens `reversalOf` / `reversedBy`.

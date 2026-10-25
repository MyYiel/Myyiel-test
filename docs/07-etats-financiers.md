# 07 · États financiers : correspondances

Les états sont recalculés à la demande à partir des écritures validées (`reports.js`). Aucun montant d'état n'est stocké : il n'existe donc aucun risque d'écart entre livres et états. **Ces tables de correspondance sont une base de travail à valider ligne par ligne par l'expert-comptable** (voir [12](12-points-a-valider.md)).

## Bilan (`Y.bilan`)

Les soldes au jour d'arrêté sont pris compte par compte (`balancesAt`). Le net N-1 provient des seuls à-nouveaux de l'exercice. Les classes 6, 7 et 8 forment le résultat (ligne CJ).

### Actif
| Réf. | Rubrique | Comptes (brut) | Amortissements / dépréciations |
|---|---|---|---|
| AD | Immobilisations incorporelles | 21 | 281, 291 |
| AI | Immobilisations corporelles | 22, 23, 24 | 282, 283, 284, 292-294 |
| AP | Avances et acomptes sur immobilisations | 25 | 285, 295 |
| AQ | Immobilisations financières | 26, 27 | 296, 297 |
| BA | Actif circulant HAO | 48 (solde débiteur) | |
| BB | Stocks et encours | 3 (hors 39) | 39 |
| BH | Fournisseurs, avances versées | 409, 40 débiteurs | |
| BI | Clients | 41 débiteurs (hors 419) | 491 |
| BJ | Autres créances | 42, 43, 44 débiteurs ; autres 4 débiteurs | 49 (hors 491, 499) |
| BQ | Titres de placement | 50 | |
| BR | Valeurs à encaisser | 51 | |
| BS | Banques, monnaie électronique, caisse | 52, 53, **55**, 57, 58 débiteurs | 59 (toutes dépréciations de trésorerie) |
| BU | Écart de conversion-actif | 478 | |

Totaux : AZ, BK, BT, BZ (= total actif net).

### Passif
| Réf. | Rubrique | Comptes |
|---|---|---|
| CA | Capital | 101-104 |
| CB | Apporteurs, capital non appelé | 109 (négatif) |
| CD | Primes liées au capital | 105 |
| CE | Écarts de réévaluation | 106 |
| CF | Réserves indisponibles | 111 à 113 |
| CG | Réserves libres | autres 11 (dont 118) |
| CH | Report à nouveau | 121 / 129 |
| CJ | Résultat net | classes 6-8 + 13 (en instance d'affectation) |
| CL | Subventions d'investissement | 14 |
| CM | Provisions réglementées | 15 |
| DA | Emprunts et dettes financières | 16, 18 et autres comptes de classe 1 non affectés |
| DB | Dettes de location-acquisition | 17 |
| DC | Provisions pour risques et charges | 19 |
| DH | Dettes circulantes HAO | 48 créditeurs |
| DI | Clients, avances reçues | 419, 41 créditeurs |
| DJ | Fournisseurs d'exploitation | 40 créditeurs |
| DK | Dettes fiscales et sociales | 42, 43, 44 créditeurs |
| DM | Autres dettes | autres comptes de classe 4 créditeurs (hors 478/479) |
| DN | Provisions pour risques à court terme | 499 |
| DQ | Banques, crédits d'escompte | 565 |
| DR | Banques, crédits de trésorerie | autres 56, comptes de trésorerie (52, 55, 57…) créditeurs |
| DV | Écart de conversion-passif | 479 |

Contrôle affiché : **total actif = total passif** (`balanced`).

## Compte de résultat (`Y.CR_LINES`)

Chaque ligne liste ses racines de comptes ; les totaux (XA à XI) sont des sommes de références. Un compte de classe 6/7/8 non couvert par une racine est ventilé par défaut en RJ (charges), TH (produits) ou RP (HAO) et doit être signalé.

| Réf. | Libellé | Racines |
|---|---|---|
| TA / RA / RB | Ventes de marchandises / achats / variation | 701 / 601 / 6031 |
| XA | Marge commerciale | TA + RA + RB |
| TB / TC / TD | Produits fabriqués / travaux et services / accessoires | 702-704 / 705-706 / 707 |
| XB | Chiffre d'affaires | TA + TB + TC + TD |
| TE / TF / TG / TH / TI | Production stockée / immobilisée / subventions / autres produits / transferts | 73 / 72 / 71 / 75 / 781 |
| RC à RJ | Matières, variations, autres achats, transports, services extérieurs, impôts et taxes, autres charges | 602, 6032, 604-608, 6033, 61, 62-63, 64, 65 |
| XC | Valeur ajoutée | |
| RK | Charges de personnel | 66 |
| XD | Excédent brut d'exploitation | |
| TJ / RL | Reprises / dotations d'exploitation | 791, 798, 799 / 681, 691 |
| XE | Résultat d'exploitation | |
| TK, TL, TM / RM, RN | Produits et charges financiers | 77, 797, 787 / 67, 697 |
| XF, XG | Résultat financier, résultat des activités ordinaires | |
| TN, TO / RO, RP | HAO : produits de cession, autres / valeurs comptables cédées, autres | 82, 84-88 / 81, 83-85 |
| XH | Résultat HAO | |
| RQ / RS | Participation / impôts sur le résultat | 87 / 89 |
| XI | **Résultat net** (= CJ du bilan, contrôlé par les tests) | |

## Tableau des flux de trésorerie (`Y.tft`)

Méthode indirecte par variations de soldes entre l'ouverture (à-nouveaux) et la date d'arrêté, compte par compte, avec affectation à un « seau » :

| Seau | Comptes | Ligne |
|---|---|---|
| T | 5 (trésorerie nette) | ZA (ouverture), ZH (clôture) |
| FA | 6, 7, 8 et amortissements/dépréciations (28, 29, 19, 39, 49, 59) | CAFG |
| FB | 48 | Variation de l'actif circulant HAO |
| FC | 3 | Variation des stocks |
| FD | 409, 41, 421, 441, 445, 4449, 462, 476, 478 | Variation des créances |
| FE | autres 4 | Variation du passif circulant |
| FF / FG / FH | 21 / 22-25 / 26-27 | Investissements nets |
| FK / FL / FN | 10 / 14 / 11-13, 15, 465 | Capitaux propres, subventions, dividendes |
| FO / FQ | 16-18 (mouvements crédit / débit) | Emprunts / remboursements |

Contrôle : `ZA + ZB + ZC + ZD + ZE = ZH` (propriété `check`, testée).

## Notes annexes

Générées : 3A (immobilisations), 7 (clients par ancienneté), 16 (dettes fiscales et sociales), 21 (CA par activité), 27A (charges de personnel), 36 (table des codes). À compléter : 27B (effectifs, depuis le module RH & Paie) et les autres notes qualitatives du système normal.

## Système minimal de trésorerie (SMT)

Société paramétrée en SMT : un bandeau le signale. Les états SMT (recettes / dépenses, situation de trésorerie, bilan simplifié) sont **à développer** ; les états du système normal restent disponibles pour le pilotage.

# 03 · Stocks & inventaires

Ce module complète la comptabilité, qui comptait déjà les immobilisations mais pas les stocks.

## 1. Référentiel

| Famille | Stock | Variation | Achats | Dépréciation |
|---|---|---|---|---|
| Marchandises | 311 | 6031 | 601 | 3911 |
| Matières premières | 321 | 6032 | 602 | 3921 |
| Autres approvisionnements | 331 | 6033 | 604 | 3931 |
| Produits finis | 361 | 736 | — | 3961 |

Les comptes manquants ont été ajoutés au plan : 311, 321, 331, 361, 3911 à 3961, 6031 à 6033, 6593, 736, 759, 7593.

Un article stocké peut être **lié à un article de vente**. Les factures émises génèrent alors les sorties de stock (`K.syncSales`, sans doublon par facture).

## 2. Mouvements et valorisation

| Type | Effet |
|---|---|
| Entrée | Coût d'achat obligatoire ; le CMUP est recalculé |
| Sortie | Valorisée au CMUP ; refusée si le stock est insuffisant à la date ou aujourd'hui |
| Transfert | D'un dépôt à l'autre, au CMUP |
| Ajustement | Positif ou négatif |
| Écart d'inventaire | Généré à la validation d'un inventaire |

La valorisation rejoue les mouvements dans l'ordre (`K.replay`), ce qui permet une situation à n'importe quelle date (`K.valuation`).

**Alertes** :
- article sous le seuil de réapprovisionnement ;
- article **dormant** (sans mouvement depuis 180 jours).

## 3. Inventaire physique

1. **Ouverture** (`K.openCount`, droit `stock.count`). Le stock théorique est figé à la date d'inventaire pour un dépôt et des familles donnés. Un seul inventaire peut être ouvert par dépôt.
2. **Comptage** (`K.setCounted`), **à l'aveugle** par défaut : le compteur ne voit pas la quantité attendue. Une feuille de comptage est disponible en PDF.
3. **Clôture du comptage.** Tous les articles doivent être comptés ; les écarts sont alors valorisés au CMUP.
4. **Validation** (`K.validateCount`) par **une autre personne** que celle qui a ouvert et compté. Les écarts doivent être commentés. Ils deviennent des mouvements « écart d'inventaire ».

## 4. Comptabilisation

| Méthode | Écritures |
|---|---|
| **Inventaire intermittent** (défaut PME) | Les achats vont en 60x. À la clôture, ou pour une situation, `K.postVariation` compare le solde comptable des comptes 3x au stock physique valorisé et passe la **variation nette** en OD : stock en hausse → débit 31x / crédit 603x ; en baisse → l'inverse. L'écriture reprend le stock initial et le stock final dans son libellé. Elle ne peut être passée qu'une fois par date. |
| **Inventaire permanent** | Une écriture à chaque mouvement : entrée débit 31x / crédit 603x, sortie l'inverse. Les écarts d'inventaire sont comptabilisés à leur validation. |
| **Dépréciation** (`K.postDeprec`) | Dotation débit 6593 / crédit 39x ; reprise débit 39x / crédit 7593. Des suggestions sont proposées pour les articles dormants : 25 % au-delà de 180 jours, 50 % au-delà de 365 jours. |

Les écritures de variation et de dépréciation portent la source `inventory`. L'**assistant de clôture** (étape Inventaire) affiche l'état des stocks et indique si la variation est passée.

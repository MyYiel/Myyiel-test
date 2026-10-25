# 02 · Moteur de calcul et formules

## 1. Principes

1. **Aucun taux en dur.** Tous les taux, plafonds, seuils et barèmes vivent dans un **pack pays** (`Y.PAIE_PACKS.CM`), chacun avec ses versions datées. Le moteur (`paie.js`) ignore tout du Cameroun. Pour ajouter le Gabon ou la Côte d’Ivoire, il suffit d’écrire un nouveau pack.
2. **Versions datées et traçables.** Une modification crée une nouvelle version : `{from, value | rows, ref, by, at, reason}`. Elle n’écrase jamais l’ancienne.
   - La valeur appliquée est celle en vigueur au **dernier jour de la période** calculée.
   - `P.addVersion` refuse une date d’effet qui tombe dans une période déjà validée, sauf avec l’option `retro` explicite. Dans ce cas, le recalcul de contrôle génère des rappels sur la période ouverte et ne modifie jamais le passé.
3. **Rubriques déclaratives.** Une rubrique est une donnée, pas du code. Son calcul est décrit par des expressions.
4. **Calcul déterministe et reproductible.** Le bulletin conserve son contexte : variables, paramètres et versions utilisées. Il est scellé par une empreinte à la validation.

## 2. Langage d’expression

Il est compilé par un tokenizer et un parseur à précédence (Pratt) maison. Il n’utilise ni `eval` ni `Function` : aucune exécution de code arbitraire n’est possible depuis le paramétrage.

| Élément | Syntaxe |
|---|---|
| Nombres, chaînes | `1250`, `4.2`, `"HS1"` |
| Opérateurs | `+ - * /`, comparaisons `< <= > >= == !=`, logique `&& || !`, ternaire `c ? a : b`, parenthèses |
| Variables | voir tableau 3 |

| Fonction | Rôle |
|---|---|
| `param("CODE")` | Paramètre du pack en vigueur à la date de la période |
| `bareme("CODE", x)` | Applique un barème à `x` : progressif (par tranches) ou forfaitaire (montant ou taux de la tranche où `x < upTo`) |
| `var("CODE")` | Quantité saisie ou importée pour le mois (heures, jours) |
| `mt("CODE")` | Montant saisi pour le mois (prime, rappel, avance) |
| `fixe("CODE")` | Élément fixe du dossier salarié (indemnité de logement, avantage véhicule…) |
| `rub("CODE")` | Montant salarial d’une rubrique déjà calculée |
| `pat("CODE")` | Montant patronal d’une rubrique déjà calculée |
| `min`, `max`, `abs` | Usuelles |
| `arrondi(x)`, `plancher(x)` | Arrondi au franc, partie entière |
| `si(cond, a, b)` | Condition (évaluation paresseuse) |

`P.checkFormula(expr)` renvoie l’erreur de syntaxe, ou `null`. L’écran **Paramétrage › Rubriques** teste la formule en direct sur un salarié réel.

## 3. Variables disponibles

| Variable | Sens |
|---|---|
| `SB` | Salaire de base du contrat |
| `HMENS`, `TH` | Heures mensuelles (173,33) et taux horaire `SB / HMENS` |
| `JOURS_PAYES`, `PRORATA` | Jours payés sur 30 (entrée ou sortie en cours de mois, absences) et rapport `/30` |
| `ANC`, `TAUX_ANC` | Ancienneté en années révolues, taux de la convention |
| `TAUX_AT` | Taux accident du travail de l’établissement |
| `ENFANTS` | Enfants à charge |
| `SALJ_MOY` | Salaire journalier moyen (12 derniers mois / 26), pour les congés |
| `BRUT`, `BRUT_TAXABLE`, `BRUT_CASH_TAXABLE`, `BASE_CNPS` | Cumuls courants pendant le calcul |
| `BASE`, `QTE`, `TAUX` | Valeurs de la rubrique en cours |

## 4. Anatomie d’une rubrique

```js
{ code: 'HS1', order: 130, label: 'Heures sup. majorées 20 %', labelEn: 'Overtime +20%',
  kind: 'gain',                      // gain | nature | cotisation | impot | retenue
  cond: 'var("HS1") > 0',            // condition d'apparition sur le bulletin
  base: 'TH', qty: 'var("HS1")', rate: '100 + param("HS_MAJ1")',
  // amount par défaut = BASE × QTE × TAUX / 100 (termes absents ignorés)
  taxable: true, cnps: true,         // alimente BRUT_TAXABLE / BASE_CNPS
  source: 'variable', unit: 'h', acc: 'salaire' }   // acc → schéma comptable
```

Les cotisations portent aussi `patRate` (part patronale) et `org` (CNPS, DGI, COMMUNE), qui alimente les déclarations.

**Ordre de calcul.**
1. Gains, de 100 à 199.
2. Avantages en nature, de 190 à 199 : ils entrent dans le brut taxable mais ne sont pas versés, et sont déduits avant le net.
3. Cotisations, à partir de 600.
4. Impôts, à partir de 700.
5. Retenues, à partir de 800.

Le net s’obtient ainsi : `NET = BRUT − NATURE − cotisations salariales − impôts − retenues`.

## 5. Pack Cameroun : règles appliquées

| Élément | Règle (valeur par défaut, versionnée) |
|---|---|
| SMIG | 43 969 XAF depuis le 23/02/2024 (Décret n° 2024/0168/PM). Historique : 41 875 (2023), 36 270 (2014) |
| CNPS · pension (PVID) | 4,2 % salarié + 4,2 % employeur, assiette plafonnée à 750 000 / mois |
| CNPS · prestations familiales | 7 % employeur, assiette plafonnée |
| CNPS · accidents du travail | 1,75 / 2,5 / 5 % employeur selon le groupe de risque de l’établissement, sur la totalité du salaire |
| CFC | 1 % salarié, 1,5 % employeur, sur le brut taxable |
| FNE | 1 % employeur |
| IRPP | Base mensuelle = `BRUT_TAXABLE × 70 % − PVID salariale − 500 000 / 12`. Barème annuel progressif 10 % (≤ 2 M), 15 % (≤ 3 M), 25 % (≤ 5 M), 35 % au-delà, appliqué à `base × 12` puis divisé par 12. Pas de retenue sous 62 000 de brut taxable |
| CAC | 10 % de l’IRPP |
| RAV, TDL | Barèmes forfaitaires mensuels *(à valider)* |
| Heures supplémentaires | +20 / +30 / +40 %, nuit, dimanche et fériés +50 % |
| Congés | 1,5 jour ouvrable par mois, majoration d’ancienneté *(à valider)* |
| Avantages en nature | Logement 15 %, véhicule 10 %, électricité 4 %, eau 2 %, nourriture 10 % du brut en numéraire *(à valider)* |

**Exemple vérifié par les tests.** Salarié à 1 450 000 de base, 10 % d’ancienneté, logement 300 000, transport 50 000 (non taxable), véhicule de fonction :
- brut 2 134 500, dont 189 500 d’avantage en nature ;
- PVID 31 500 (plafonnée) ;
- IRPP par le barème annuel ;
- net vérifié ligne à ligne dans `paie.test.js`.

## 6. Conventions collectives

Chaque convention porte les éléments suivants :
- la grille catégorielle datée (minimum par catégorie) ;
- le barème d’ancienneté ;
- le préavis par catégorie (cadre, maîtrise, employé) ;
- le barème de licenciement ;
- le secteur.

Les trois conventions livrées (CC-COM, CC-NUM, CC-TRANS) sont des **modèles à remplacer** par les textes réellement applicables (voir `09`).

## 7. Points d’extension

| Besoin | Où |
|---|---|
| Nouveau pays | `Y.PAIE_PACKS.XX = { params, baremes, rubriques, accounts, declarations, conventions }`, puis choix du pays dans la société |
| Nouvelle rubrique propre à l’entreprise | Écran **Paramétrage › Rubriques** : elle est stockée dans `d.paie.rubriques`, sans code |
| Nouveau taux légal | **Paramétrage › Réglementation › Nouvelle version**, avec une date d’effet et un motif |
| Nouvelle source de temps | Produire un fichier `myyiel.time-events/1` (voir `03`) |

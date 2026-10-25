# 05 · Anomalies, contrôles et règles de gestion

`P.check(S, cid, key)` est exécuté à chaque calcul et **rejoué à la validation DRH**. Chaque anomalie porte un code, un niveau, le salarié concerné, un message explicite et un lien vers l’écran de correction.

## 1. Anomalies bloquantes

Une seule anomalie bloquante empêche la soumission et la validation.

| Code | Contrôle | Correction attendue |
|---|---|---|
| B01 | Salaire de base inférieur au SMIG en vigueur à la date de la période | Revaloriser le contrat |
| B02 | Salaire inférieur au minimum de la grille de la convention et de la catégorie | Revoir la catégorie ou le salaire |
| B03 | Net à payer négatif | Étaler les retenues (avance, prêt) |
| B04 | Coordonnées de paiement manquantes (RIB pour un virement, numéro pour MoMo ou OM) | Compléter le dossier |
| B05 | Numéro d’immatriculation CNPS manquant | Compléter le dossier (obligatoire pour la DIPE) |
| B06 | Matricule en double | Corriger le référentiel |
| B07 | CDD échu sans sortie enregistrée | Renouveler, transformer en CDI ou enregistrer la sortie |
| B08 | Absences supérieures aux jours payés | Corriger les variables ou les pointages |
| B09 | Erreur de calcul : paramètre absent, barème introuvable, formule invalide | Corriger le paramétrage |

## 2. Anomalies non bloquantes

Elles sont signalées pour revue et n’empêchent pas la soumission.

| Code | Contrôle | Intérêt |
|---|---|---|
| W01 | Net en hausse ou en baisse de plus de 20 % par rapport au mois précédent (hors avances et prêts) | Détecte les erreurs de saisie |
| W02 | Heures supplémentaires au-delà du plafond d’alerte mensuel | Respect du droit du travail, maîtrise des coûts |
| W03 | Même compte bancaire pour plusieurs salariés | Fraude (salarié fictif) |
| W04 | Même numéro Mobile Money pour plusieurs salariés | Fraude |
| W05 | CDD arrivant à échéance dans moins de 30 jours | Éviter la requalification |
| W06 | Fin de période d’essai ce mois-ci | Décision à prendre |
| W07 | Solde de congés négatif ou supérieur à 45 jours | Gestion des congés |
| W08 | NIU manquant | DGI, état annuel |
| W09 | Section analytique manquante | Ventilation analytique |
| W10 | Changement de palier d’ancienneté ce mois-ci | Vérifier la prime |
| W11 | Retenues (avances, prêts) au-delà de la quotité d’alerte du net | Protection du salarié |
| W12 | Aucun pointage GTA reçu ce mois-ci | Oubli d’import |
| W13 | Salaire très éloigné de la médiane du poste | Erreur de saisie, équité |

Yiélina lit cette liste (`lister_anomalies`) pour expliquer, prioriser et proposer les corrections.

## 3. Règles de gestion (RG-P)

| Règle | Énoncé | Où elle est appliquée |
|---|---|---|
| RG-P01 | Une valeur réglementaire n’est jamais modifiée : on ajoute une version datée et motivée | `P.addVersion`, triggers SQL |
| RG-P02 | La valeur appliquée est celle en vigueur au dernier jour de la période | `P.param`, `param_at()` |
| RG-P03 | Une version qui touche une période validée exige l’option rétroactive et produit des rappels, jamais une réécriture | `P.addVersion`, `P.recalcCheck` |
| RG-P10 | Préparer, valider et clôturer relèvent de rôles distincts | `need()`, contrainte SQL |
| RG-P11 | Aucune soumission ni validation avec une anomalie bloquante | `P.submit`, `P.approve`, trigger SQL |
| RG-P12 | Une période validée est gelée : bulletins immuables, scellés par une empreinte (FNV-1a dans la maquette, SHA-256 en base de production) | `P.approve`, `P.isFrozen`, trigger SQL |
| RG-P13 | La clôture exige la validation et l’intégration comptable ; une période clôturée est définitive | `P.close`, trigger SQL |
| RG-P14 | Toute action est tracée dans l’audit chaîné de la société | `Y.audit` |
| RG-P20 | Un bulletin n’est signé qu’une fois, et seulement s’il est intact | `P.signSlips`, trigger SQL |
| RG-P21 | Seuls les détenteurs de `pay.sign` signent | `P.signSlips` |
| RG-P30 | Télétransmission CNPS et DGI seulement après l’intégration du lot comptable | `P.declAction`, trigger SQL |
| RG-P31 | Un lot comptable est intégré une seule fois, en tout ou rien | `Y.acceptBatch` |
| RG-P40 | Une demande d’avance après la date limite est retenue le mois suivant ; plafond et nombre maximal par mois | `P.requestAdvance` |
| RG-P41 | Les données sensibles ne sont visibles qu’avec `pay.sensitive`, à l’écran comme à l’export | `App.sens`, RLS SQL |
| RG-P50 | Un import n’écrit rien tant que le rapport n’est pas validé ; les lignes en erreur ne sont jamais intégrées | `P.analyzeEmployeeImport`, `P.importEmployees` |

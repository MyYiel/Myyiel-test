# 12 · Points à valider avant la mise en production

Le prototype applique des paramètres **par défaut** pour le Cameroun. Ils sont tous modifiables dans l'application (Paramètres, Codes de taxe, Taux sociaux) mais doivent être confirmés par un **expert-comptable inscrit à l'ONECCA** et, pour les aspects juridiques, par un conseil. Les lois de finances changent chaque année.

## Fiscalité

| Paramètre | Valeur par défaut | À confirmer |
|---|---|---|
| TVA taux normal | 19,25 % (17,5 % + 10 % de CAC) | Taux en vigueur ; régimes particuliers (taux zéro, exonérations, TVA sur débours) ; règle de déduction des immobilisations. |
| Échéance des déclarations mensuelles | 15 du mois suivant | Selon le centre de rattachement (DGE, CIME, CSI). |
| Acompte / minimum de perception | 2,2 % du CA | Taux selon le régime (réel, simplifié), assiette exacte (CA HT encaissé ou facturé), imputation sur l'IS. |
| Impôt sur les sociétés | 27,5 % CAC inclus | Taux réduits (PME, CA < seuil, zones, entreprises nouvelles), report déficitaire, réintégrations usuelles. |
| IRCM sur dividendes | 16,5 % | Taux et conventions fiscales. |
| Retenues à la source (447) | Non calculées automatiquement | Précompte sur achats (AIR), retenues sur loyers, honoraires, prestataires non-résidents : taux et cas d'application. |
| DSF | Échéance 15 mars N+1, système normal, notes 1 à 36 | Format de téléversement en vigueur sur impots.cm, liste exacte des tableaux, seuils du SMT. |
| FEC | 18 colonnes inspirées du format normalisé | Format exigé localement en cas de contrôle ; pas de norme FEC officielle au Cameroun à notre connaissance : à vérifier. |

## Social

| Paramètre | Valeur par défaut | À confirmer |
|---|---|---|
| Plafond mensuel CNPS | 750 000 XAF | Plafond en vigueur. |
| Pension vieillesse | 4,2 % salarié / 4,2 % employeur | Taux. |
| Prestations familiales | 7 % employeur | Taux (régime général / agricole). |
| Accidents du travail | 1,75 % | Taux selon le groupe de risque de l'entreprise. |
| Crédit foncier | 1 % salarié / 1,5 % employeur | Taux et assiette. |
| FNE | 1 % employeur | Taux et assiette. |
| IRPP, CAC, RAV, TDL | Saisis manuellement | Calcul à faire dans le module RH & Paie. |

## Comptabilité

| Sujet | Choix du prototype | À confirmer |
|---|---|---|
| Plan comptable | 254 comptes SYSCOHADA révisé (principaux comptes et sous-comptes utiles, intitulés FR/EN) | Compléter avec le plan officiel intégral et ses intitulés anglais officiels ; vérifier chaque intitulé. |
| Mobile Money | Compte 55 (5521 MTN, 5522 Orange), journaux dédiés | Traitement des comptes marchands et des commissions. |
| Correspondances des états | Tables de [07](07-etats-financiers.md) | Ligne par ligne, notamment BJ / DM, DQ / DR, TFT (affectation des comptes 4). |
| Coefficients dégressifs | 1,5 / 2 / 2,5 selon la durée | Coefficients fiscaux en vigueur. |
| Réserve légale | 10 % jusqu'à 20 % du capital | Forme sociale (SA, SARL…) et statuts. |
| Conservation | 10 ans | Durées par type de document et par pays. |
| SMT | Bandeau d'information, états non produits | Développement des états SMT. |
| Secteurs COBAC / CIMA | Hors périmètre | Plans et états sectoriels si ces clients sont visés. |

## Juridique et conformité

- Protection des données personnelles : loi n° 2024/017 du 23 décembre 2024 (Cameroun), déclarations auprès de l'autorité, localisation et transferts de données, contrats de sous-traitance avec l'hébergeur.
- Facturation : mentions obligatoires des factures (NIU, RCCM, régime, numérotation continue), éventuelle obligation de facturation électronique certifiée.
- Contrats avec les opérateurs Mobile Money et les banques (API, frais, responsabilités).
- Conditions générales myyiel : responsabilité sur les calculs fiscaux (le logiciel prépare, le contribuable déclare).

## Données de démonstration

Les fiches société de démonstration contiennent des valeurs à remplacer (`[NIU À RENSEIGNER]`, `[RCCM À RENSEIGNER]`, n° marchands, RIB). Les montants sont fictifs.

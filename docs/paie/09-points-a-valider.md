# 09 · Points à valider avant mise en production

Chaque valeur ci-dessous est **paramétrée, datée et modifiable sans développement** : **Paramétrage › Réglementation › Nouvelle version**. Dans l’application, les lignes concernées portent le badge « À valider ».

## 1. Sourcé, à confirmer par l’expert-comptable

| Élément | Valeur livrée | Source |
|---|---|---|
| SMIG | 43 969 XAF depuis le 23/02/2024 | Décret n° 2024/0168/PM (WageIndicator, avril 2024) |
| CNPS | PVID 4,2 % + 4,2 %, PF 7 %, AT 1,75 / 2,5 / 5 %, plafond 750 000 | CLEISS, fiche Cameroun |
| IRPP | Abattement 30 %, déduction de la PVID, abattement annuel 500 000, barème 10 / 15 / 25 / 35 %, seuil de 62 000, CAC 10 % | DGI, « Tout savoir sur l’IRPP » |
| CFC, FNE | 1 % + 1,5 %, 1 % | CGI |

## 2. À valider (valeurs modèles)

| # | Élément | Question à trancher |
|---|---|---|
| V1 | **RAV** : barème forfaitaire mensuel par tranche de brut | Confirmer les montants de la loi de finances en vigueur |
| V2 | **TDL** : barème mensuel par tranche de salaire de base | Confirmer le barème communal applicable à Douala et Yaoundé |
| V3 | **Avantages en nature** : logement 15 %, véhicule 10 %, électricité 4 %, eau 2 %, nourriture 10 % | Confirmer les taux et l’assiette (brut en numéraire) |
| V4 | **Indemnité de transport** non taxable | Confirmer le plafond d’exonération |
| V5 | **Conventions CC-COM, CC-NUM, CC-TRANS** : grilles, ancienneté, préavis, barème de licenciement | Remplacer les modèles par les conventions réellement applicables à Yiel Group (conseil et édition de logiciels) et à DeyGo (transport) |
| V6 | **Congés** : 1,5 jour par mois, majoration d’ancienneté, salaire journalier moyen sur 12 mois / 26 | Confirmer les modalités de la convention |
| V7 | **Plafond d’alerte des heures supplémentaires** et quotité d’alerte des retenues | Fixer les seuils internes |
| V8 | **Avances** : plafond, date limite (le 15), une avance par mois | Valider la politique interne |
| V9 | **Comptes** : 661 / 662 / 663 / 664 / 641, 421 / 422 / 428 / 431 / 447 | Confirmer, ou adapter aux sous-comptes du plan de la société |
| V10 | **Bordereau bancaire** : format CSV et lettre | Obtenir le format d’import exact de chaque banque (SGC, Afriland, UBA…) |
| V11 | **Confidentialité** du bordereau | Recommandé : matricule et RIB par défaut, noms seulement si la banque l’exige |
| V12 | **Protection des données** (loi n° 2024/017) | Mettre à jour le registre des traitements, informer les salariés, définir la durée de conservation des bulletins |

## 3. Limites connues de la maquette

- La télétransmission CNPS et DGI est **simulée** : un accusé interne est généré. Le dépôt réel se fait sur les portails, avec le DIPE exporté.
- Les envois par e-mail et WhatsApp sont **préparés et tracés**. L’envoi réel nécessite la passerelle de production.
- Yiélina utilise le crédit Claude **de la personne qui ouvre l’application**. Sans accès, elle bascule sur un moteur local de réponses.
- La dictée vocale dépend du navigateur (Web Speech API, présente dans Chrome et Edge).
- Les données de la maquette sont stockées dans le navigateur. La persistance multi-utilisateur passe par le schéma SQL et l’API (`06`, `07`).

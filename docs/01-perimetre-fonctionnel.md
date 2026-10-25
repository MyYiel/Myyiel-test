# 01 · Périmètre fonctionnel

Quatorze écrans, regroupés dans la navigation en cinq familles. Chaque écran est décrit par ses onglets, ses champs de création et ses actions. Les droits requis sont indiqués entre crochets (voir [08](08-securite-roles-audit.md)).

## Éléments communs (coquille)

| Élément | Comportement |
|---|---|
| Sélecteur de **société** | Bascule entre les dossiers ; données strictement cloisonnées ; seules les sociétés autorisées pour l'utilisateur sont proposées. |
| Sélecteur d'**exercice** | Change l'exercice de travail de tous les écrans (livres, états, TVA, clôture). |
| **Palette de commandes** (`Ctrl K` / `⌘ K`) | Recherche unifiée : écrans, actions (« nouvelle facture »), comptes, tiers, n° de pièce, n° de document, **montant** (retrouve les écritures contenant ce montant). Navigation clavier ↑ ↓ Entrée Échap. |
| Pastille **D = C** | Somme des débits et des crédits de toutes les écritures validées ; passe en rouge si elles diffèrent (ne doit jamais arriver). |
| Sélecteur d'**utilisateur** (démo) | Simule la connexion d'un propriétaire, d'un comptable ou d'un lecteur ; les boutons non autorisés sont désactivés avec une infobulle explicative. |
| **Mode simulation** | Copie de travail de toutes les données ; bandeau visible ; « Abandonner » ou « Conserver le résultat ». Utilisé pour la clôture. |
| Tableaux | Recherche, tri par colonne, pagination, sélection multiple, export **Excel / CSV / PDF** de la vue filtrée. |
| Tiroirs de formulaire | Champs obligatoires signalés, erreurs métier listées, aperçu en direct de l'écriture générée, validation `Ctrl Entrée`, fermeture `Échap`. |
| Raccourcis | `Ctrl K` palette · `Ctrl Entrée` valider le formulaire ou l'écriture en cours · `Échap` fermer. |

## Pilotage

### Tableau de bord
- Bandeau « preuve » : équilibre débit/crédit, nombre d'écritures, score de santé comptable (anneau 0-100 issu des contrôles de clôture).
- Indicateurs : CA du mois et cumulé, résultat, trésorerie totale (banques + Mobile Money + caisse), créances clients et retard, dettes fournisseurs, TVA du mois.
- Graphique mensuel produits / charges / trésorerie.
- Points d'attention générés (retards clients, relevés non rapprochés, brouillons, TVA à liquider, dotations manquantes…) avec bouton d'accès direct.
- Trésorerie par compte, échéancier, activité récente.

## Quotidien

### Saisie & journaux
| Onglet | Contenu |
|---|---|
| Nouvelle écriture | Éditeur en grille : journal (puces), date comptable, date de pièce, référence, libellé ; lignes compte (autocomplétion), libellé, tiers (obligatoire sur collectif), section analytique, code TVA, débit, crédit. Barre d'équilibre en direct, contrôles listés avant validation, outils : calcul de TVA, équilibrage, contrepartie automatique, pièces jointes. Actions : enregistrer en brouillon [draft], valider [post], enregistrer comme modèle. |
| Brouillons | Reprendre, valider, supprimer (seuls les brouillons se suppriment). |
| Écritures validées | Filtres journal / mois / origine ; détail ; **contre-passer** (date, motif) [reverse] ; dupliquer ; PDF de la pièce. |
| Modèles et abonnements | Modèles d'écritures récurrentes (loyer, frais Mobile Money, virement banque → caisse…) : utiliser, supprimer, créer depuis l'éditeur. |

### Ventes & factures
| Onglet | Contenu |
|---|---|
| Factures, Devis, Avoirs | Liste avec statut (brouillon, émise, partiellement payée, payée, en retard ; devis envoyé, accepté, refusé, facturé, expiré). Éditeur : client, date, délai, référence, section, notes ; lignes article (catalogue), désignation, quantité, prix HT, remise %, code TVA, compte de produit. Totaux HT / TVA / TTC, montant en lettres. Actions : enregistrer, **émettre** (numérotation continue + écriture VTE) [invoice], PDF, envoyer (texte e-mail / WhatsApp prêt à copier), encaisser, avoir, convertir un devis en facture, accepter / refuser un devis. |
| Encaissements | Liste des règlements ; nouveau règlement : facture, date, moyen (virement, banque 2, **MTN MoMo**, **Orange Money**, espèces), montant, frais opérateur (1 % proposé pour Mobile Money), référence de transaction. Lettrage automatique facture / règlement. |
| Relances | Factures échues par niveau (J+1, J+15, J+30…) ; texte de relance prêt à copier ; marquer relancé ; relance groupée. |
| Articles et tarifs | Création / modification : code, désignation, unité, prix HT, code TVA, compte de produit (70x), section analytique. |

### Achats & fournisseurs
| Onglet | Contenu |
|---|---|
| Factures fournisseurs | Saisie : fournisseur, n° de facture, date de facture, date comptable, libellé, jusqu'à 3 lignes (compte de charge ou d'immobilisation, montant HT, code TVA, section), pièce scannée ; aperçu de l'écriture ; journal IMMO automatique si un compte 2x est utilisé. Règlement : date, moyen, montant, lettrage. |
| Échéancier | Balance âgée fournisseurs (non échu, 1-30, 31-60, 61-90, > 90 jours). |

### Trésorerie & Mobile Money
| Onglet | Contenu |
|---|---|
| Comptes | Cartes par compte (52 banques, 55 monnaie électronique, 57 caisse) : solde comptable, solde du relevé, lignes à rapprocher, alerte de seuil. Actions : synchroniser (API), importer un relevé, rapprocher, arrêté de caisse, paramètres. **Création** : nom, type, compte comptable, établissement/opérateur, RIB ou n° marchand, mode d'alimentation, seuil d'alerte, solde d'ouverture du relevé. Un journal de trésorerie est créé automatiquement. |
| Rapprochement | Deux colonnes (relevé / écritures non rapprochées), suggestions de même montant, règles reconnues ; rapprocher, **créer l'écriture depuis le relevé** (compte, tiers, TVA incluse, section, libellé), rapprochement automatique (montant, ± 10 jours, référence), annulation. |
| État de rapprochement | Solde du relevé ± écritures non au relevé = solde comptable ± opérations non comptabilisées ; écart ; PDF. |
| Règles d'affectation | Si libellé contient… / sens / comptes concernés → compte, TVA, section ; compteur d'utilisation. |
| Arrêtés de caisse | Billetage (billets et pièces XAF), écart comptabilisé automatiquement (658 manquant / 758 excédent). |
| Virement interne | Depuis / vers / montant / date : deux écritures liées par le 585. |

### Immobilisations
| Onglet | Contenu |
|---|---|
| Registre | Groupé par rubrique ; filtre en service / sorties ; VO, amortissements cumulés, VNC ; fiche détaillée avec plan d'amortissement et PDF. **Création** : désignation, compte (21-25), localisation, section, n° de série, valeur HT, valeur résiduelle, date d'acquisition, date de mise en service, durée, mode (linéaire / dégressif), fournisseur, facture, option de comptabilisation de l'acquisition (journal IMMO), TVA. Plan prévisionnel affiché en direct. |
| Dotations | Douze mois : biens, dotation, état (passée, en retard, à venir, période verrouillée), écriture ; passer un mois ou tous les mois en retard. |
| Cessions & rebuts | Sortie : date, nature, prix, acquéreur ; aperçu VNC et plus/moins-value ; écriture IMMO. |
| Tableau de synthèse | Brut début, acquisitions, sorties, brut fin, amortissements début, dotations, reprises, fin, VNC (notes 3A/3C). Excel, PDF. |

## Contrôle

### Livres & balances
| Onglet | Contenu |
|---|---|
| Balance générale | 6 colonnes (à-nouveaux, mouvements, soldes D/C), date d'arrêté, niveau (détail, 3 chiffres, 2 chiffres), filtre de classe, comptes mouvementés ; contrôle d'équilibre ; clic → grand livre. |
| Grand livre | Compte ou racine, période, tiers ; solde progressif, lettre ; PDF ; Excel de tous les comptes de la racine. |
| Journaux & centralisateur | Centralisateur journal × mois ; journal légal détaillé par journal et mois, PDF. |
| Balance des tiers | Clients, fournisseurs, personnel ; dépassement de plafond signalé ; clic → fiche tiers. |
| Balance âgée | Créances ou dettes à une date, barre de répartition par tranche. |
| Lettrage | Compte lettrable, tiers ; sélection des lignes avec somme en direct ; lettrer (lettre majuscule) ou lettrage partiel (minuscule) ; automatique ; délettrer. |

### Analytique
Résultat par section avant / après clés de répartition (mois, trimestre, cumul) avec graphique ; lignes **à ventiler** (sélecteur par ligne ou en masse) ; **budget vs réalisé** (saisie des budgets annuels produits/charges par section, taux d'atteinte au prorata) ; **sections** (code, intitulé, axe activité/site/projet, type principale/auxiliaire, responsable, actif) ; **clés de répartition** (section source, unité d'œuvre, pourcentages par section principale, total contrôlé à 100 %).

### Plan comptable & tiers
- **Plan comptable** : classes 1 à 9, affichage français / anglais / les deux, filtres (mouvementés, personnalisés, inactifs), solde. **Création de compte** : numéro (rattachement au parent affiché en direct), intitulés FR/EN, sens, nature, code TVA par défaut, lettrable, rapprochable, analytique obligatoire ; modification et désactivation (refusée si le compte n'est pas soldé ; renumérotation refusée s'il est mouvementé).
- **Tiers** : filtres par type ; **création** : type, code (auto C/F/P), raison sociale, NIU, RCCM, régime fiscal, compte collectif, e-mail, téléphone, n° Mobile Money, opérateur, adresse, ville, pays, délai de paiement, plafond de crédit, notes ; fiche avec solde, échu, CA, relevé de compte, derniers documents, PDF de relevé, bouton « Facturer ».
- **Codes de taxe** : code, libellé, taux global, principal, centimes additionnels, comptes collectée / déductible B&S / déductible immobilisations, date d'application, droit à déduction, actif (contrôle principal + CAC = taux).

## Synthèse & clôture

### États financiers
Bilan (actif brut / amortissements / net / net N-1, passif net / N-1, contrôle actif = passif), compte de résultat (soldes intermédiaires, % du CA, N-1, variation), tableau des flux de trésorerie (méthode indirecte, contrôle ZA + ZG = ZH), notes annexes générées (3A, 7, 16, 21, 27A, 36) et à compléter (27B…), **DSF & liasse fiscale** (composantes avec statut, échéance du 15 mars, format normal / SMT, mention COBAC / CIMA, « marquer déposée » avec n° d'accusé). Options : date d'arrêté mensuelle, français / anglais, comparatif. Exports : PDF (états ou un état), Excel 5 onglets.

### TVA & fiscalité
- **Déclarations de TVA** mensuelles : CA taxable / export / exonéré, collectée, déductible B&S et immobilisations, crédit antérieur, nette due ou crédit, part principal et CAC, échéance ; **liquider** (OD), **télépayer** (BQ1, référence de quittance), brouillon PDF.
- **Échéancier fiscal & social** : TVA, acomptes d'IS, CNPS et retenues sur salaires (15 du mois suivant), patente, DSF (15 mars).
- **Impôt sur les sociétés** : résultat comptable, réintégrations et déductions (saisie avec nature et justification), résultat fiscal, IS au taux, minimum de perception, impôt dû, acomptes, solde ; comptabilisation 891 / 441.
- **Retenues à la source** (447) : retenu, reversé, reste à reverser.
- **Paie & CNPS** : centralisation mensuelle (mois, date, effectif, brut, base plafonnée, retenues fiscales, section) avec calcul CNPS paramétrable ; taux sociaux modifiables.
- **FEC** : période, séparateur, contrôles (équilibre, continuité de numérotation, comptes, dates, intégrité de l'audit), aperçu, génération `.txt`.

### Clôture & à-nouveaux
Assistant en 6 étapes, progression visible, mode simulation : (1) contrôles préalables avec score, (2) écritures d'inventaire CCA / PCA / FNP / FAE / dépréciation / provision, (3) impôt, (4) verrouillage (saisie de confirmation « CLÔTURER AAAA ») et réouverture motivée, (5) aperçu et génération des **à-nouveaux** (détail par tiers, extournes), PDF, (6) **affectation** du résultat (réserve légale proposée, autres réserves, dividendes avec IRCM, report à nouveau, contrôle de répartition).

## Administration

### Imports & exports
- **Assistant d'import** en 5 étapes : type (plan, tiers, articles, écritures, relevé, immobilisations, soldes d'ouverture), fichier (glisser-déposer, CSV/TXT/Excel, exemple intégré), **correspondance des colonnes** (détection automatique par en-têtes et synonymes, FEC reconnu), **contrôle à blanc** sur copie (valides, rejets détaillés, doublons, durée), import et rapport des rejets.
- **Modèles** Excel (avec notice) et CSV par type.
- **Centre d'export** : FEC, états + balance, balance, écritures (réimportables), factures, tiers, plan, immobilisations, piste d'audit, sauvegarde JSON.
- **Historique** des imports.

### Paramètres
Société (identité légale, référentiel, système normal/SMT, régime, centre des impôts, CNPS, langue des états, RIB, n° marchands MoMo/OM, pied de facture) et **création de société** ; exercices et **périodes** (verrouiller / rouvrir avec motif) ; **journaux** (code, intitulé, type, contrepartie, format de numérotation, alimentation, actif) ; **utilisateurs** (invitation, rôle, sociétés, 2FA, retrait) et **matrice des droits** ; **paramètres fiscaux** ; **intégrations** ; **piste d'audit** (vérification d'intégrité, export) ; **sauvegarde / restauration / réinitialisation**.

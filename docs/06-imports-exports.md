# 06 · Imports et exports

## Principe de l'import (5 étapes)

1. **Type** : plan comptable, tiers, articles, écritures, relevé bancaire / Mobile Money, immobilisations, soldes d'ouverture.
2. **Fichier** : CSV (séparateur `;`, `,` ou tabulation détecté), TXT (FEC), XLSX/XLS/ODS (première feuille). 15 Mo maximum. Lignes entièrement vides ignorées.
3. **Correspondance des colonnes** : proposée automatiquement (`Y.mapColumns`) par en-tête normalisé (minuscules, sans accents ni ponctuation), libellé sans parenthèses, puis **synonymes** (ex. `CompteNum`, `account` → compte), puis inclusion partielle. Une colonne du fichier n'est utilisée qu'une fois. Un fichier FEC (colonne `JournalCode`) est reconnu et mappé directement.
4. **Contrôle à blanc** (`Y.dryRunImport`) : l'import est rejoué sur une **copie complète** des données ; toutes les règles de gestion s'appliquent (partie double, comptes de détail, tiers obligatoires, périodes ouvertes, doublons). Résultat : valides, rejets ligne par ligne, doublons ignorés, durée. En production : même logique dans une transaction PostgreSQL annulée (`ROLLBACK`).
5. **Import** des seules lignes valides, rapport des rejets téléchargeable (CSV), entrée dans l'historique et la piste d'audit.

## Formats

Les modèles sont dans [`modeles-import/`](modeles-import/) (CSV `;`, UTF-8 avec BOM, ouvrables dans Excel). Dates acceptées : `JJ/MM/AAAA`, `AAAA-MM-JJ`, `AAAAMMJJ`, numéro de série Excel. Montants : espaces, espaces insécables et virgule tolérés ; pas de décimales.

| Type | Colonnes obligatoires | Facultatives | Comportement |
|---|---|---|---|
| Plan comptable | Numéro, Intitulé | Intitulé anglais, Sens, Nature, Lettrable, Analytique obligatoire, Code TVA | Crée le compte ou met à jour l'intitulé s'il existe. |
| Tiers | Type, Raison sociale | Code, NIU, RCCM, Régime, Collectif, E-mail, Téléphone, Mobile Money, Opérateur, Adresse, Ville, Délai, Plafond | Code automatique si vide. |
| Articles | Code, Désignation, Prix HT, Compte de produit | Unité, Code TVA, Section | |
| Écritures | Code journal, Date, N° de pièce, Libellé, Compte | Référence, Code tiers, Libellé de ligne, Débit, Crédit, Section, Code TVA | **Regroupement** par (journal, date, n° de pièce) : une pièce = une écriture. Option « importer en brouillons ». |
| Relevé | Date, Libellé | Référence, Montant (signé) **ou** Débit / Crédit | Compte de trésorerie choisi à l'étape 2 ; dédoublonnage par empreinte (RG-R02). |
| Immobilisations | Désignation, Compte, Date de mise en service, Valeur, Durée | Mode, Section, Localisation, Pièce | Les dotations des exercices antérieurs sont marquées comme déjà passées (reprise d'un registre existant). |
| Soldes d'ouverture | Compte | Code tiers, Libellé, Débit, Crédit | Une seule écriture AN au 01/01 de l'exercice choisi, qui doit être équilibrée ; refusé si des à-nouveaux existent déjà. |

## Exports

| Export | Format | Contenu |
|---|---|---|
| FEC | TXT, UTF-8, tabulation ou `|` | 18 colonnes : JournalCode, JournalLib, EcritureNum, EcritureDate (AAAAMMJJ), CompteNum, CompteLib, CompAuxNum, CompAuxLib, PieceRef, PieceDate, EcritureLib, Debit, Credit, EcritureLet, DateLet, ValidDate, Montantdevise, Idevise. Une ligne par ligne d'écriture validée, tri par date puis numéro. Nom : `<NIU>FEC<AAAAMMJJ>.txt`. Contrôles préalables (`fecChecks`). |
| États financiers | XLSX 5 onglets / PDF | Bilan actif, bilan passif, compte de résultat, TFT, balance ; FR ou EN. |
| Balance, grand livre, journaux, balance âgée, balance des tiers | XLSX, CSV, PDF | Vue filtrée affichée. |
| Écritures | XLSX | Même format que le modèle d'import (réimportable). |
| Factures | XLSX | Type, numéro, dates, client, NIU, HT, TVA, TTC, payé, statut. |
| Tiers, plan, immobilisations | XLSX | Réimportables. |
| Piste d'audit | CSV | Horodatage, utilisateur, rôle, action, objet, détail, empreinte, empreinte précédente. |
| Sauvegarde | JSON | `{ format: "myyiel-compta-backup", version: 1, exportedAt, state }` — toutes sociétés. Restauration avec confirmation saisie. |
| Documents | PDF | Factures, devis, avoirs (logo, mentions, TVA détaillée, montant en lettres), pièce comptable, fiche immobilisation, relevé de tiers, état de rapprochement, brouillon de déclaration de TVA, à-nouveaux. |

## Recommandations de production

- Imports et exports lourds en **jobs asynchrones** (file de messages), notification à la fin, fichiers stockés chiffrés avec URL signée à durée limitée.
- Conserver le fichier source et son SHA-256 (`import_job.file_sha256`) pour l'audit.
- Formats bancaires à ajouter : CAMT.053, MT940, CSV propres à chaque banque (profils de correspondance enregistrés par banque).
- Export de la liasse au format de téléversement de la DGI quand il est publié (voir [12](12-points-a-valider.md)).

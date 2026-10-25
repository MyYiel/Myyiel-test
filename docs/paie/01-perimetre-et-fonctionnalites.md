# 01 · Périmètre fonctionnel et plan des fonctionnalités

## 1. Le parcours en 4 étapes

### Étape 1 · Constituer le référentiel salariés
- **Import Excel ou CSV** en assistant de 4 étapes : dépôt du fichier, correspondance des colonnes, analyse, intégration.
  - **Correspondance automatique** des colonnes, insensible aux accents, à la casse et aux synonymes (« Nom de famille », « NOM », « last name »…). Elle reste corrigeable colonne par colonne.
  - **Modèle téléchargeable** avec toutes les colonnes et deux exemples.
- **Analyse avant toute écriture.** Le rapport d’erreurs s’affiche avant validation et rien n’est intégré tant que l’utilisateur ne confirme pas :
  - doublons dans le fichier ;
  - doublons avec le référentiel (même matricule) ;
  - **jumeaux probables** (même nom et même date de naissance, ou même CNPS sous un autre matricule) ;
  - matricules manquants : proposition d’attribution automatique (`YG0001`…) ou rejet ;
  - champs obligatoires, formats (dates, montants, RIB, numéro Mobile Money), cohérences (CDD sans date de fin, salaire < SMIG) ;
  - erreurs bloquantes et avertissements séparés, rapport exportable en Excel ;
  - choix pour les lignes existantes : ignorer ou mettre à jour.
- **Création manuelle** par formulaire complet, avec les mêmes contrôles que l’import.

### Étape 2 · Dossier salarié unique
- **Blocs du dossier** :
  - identité ;
  - organisation : matricule, poste, service, établissement, convention, catégorie, section analytique, responsable ;
  - contrat : type, date d’embauche, fin de CDD, fin d’essai ;
  - rémunération : salaire de base, éléments fixes et avantages en nature ;
  - paiement : virement, MoMo, OM, espèces ;
  - immatriculations : CNPS, NIU, CNI.
- **Accès restreint aux données sensibles** (salaire, RIB, numéros MoMo et OM, CNI, NIU, CNPS) : elles sont réservées au droit `pay.sensitive`. Les autres profils voient `••••••` et l’export applique le même masquage.
- **Historique de chaque modification** : qui, quand, champ, ancienne et nouvelle valeur. Les valeurs sensibles sont masquées dans l’historique pour les profils non autorisés.
- **Entrées, sorties, solde de tout compte.** Motif de sortie, préavis, indemnité compensatrice de congés et indemnité de licenciement (selon la convention) sont calculés en prévisualisation, puis portés sur la paie du mois. Le **certificat de travail** et l’**attestation de salaire** sont générés en PDF.

### Étape 3 · Paramétrer et calculer
- **Rubriques à formules** (gains, avantages en nature, cotisations, impôts, retenues) ordonnées, chacune avec ses indicateurs taxable / soumise CNPS et son compte comptable. Voir `02`.
- **Éléments du mois** saisis dans une grille de type tableur, au clavier : primes, heures supplémentaires (20, 30, 40, 50 %), absences, congés, rappels.
  - **Import des temps GTA** (`myyiel.time-events/1`) ou d’un fichier de pointeuse.
  - Avances et prêts repris **automatiquement**.
- **Calcul automatique** du brut, du brut taxable, de l’assiette CNPS, des cotisations, des impôts, des retenues, du net et des charges patronales.
- **Périodes et régularisation.** Une période validée est gelée par une empreinte. Le **recalcul de contrôle** compare un recalcul aux bulletins figés **sans les écraser**. Les écarts deviennent des rubriques `RAPPEL` sur la période ouverte.

### Étape 4 · Contrôler, valider, produire
- **Contrôles automatiques** : anomalies bloquantes, qui empêchent la soumission, et non bloquantes (voir `05`).
- **Chaîne de validation** : gestionnaire → DRH (validation) → DAF (contrôle comptable, télétransmission, clôture).
- **Bulletins** conformes au modèle fourni : en-tête société et salarié, colonnes Base / Taux / À payer / À déduire / Charges patronales, cumuls annuels, congés, net en lettres. Ils sont **bilingues français / anglais**.
  - Sortie en PDF individuel ou groupé.
  - Envoi par **e-mail** et par **WhatsApp** (message préparé, envoi tracé).
- **Signature électronique DRH et cachet**, appliqués en une fois à tous les bulletins non signés.
- **États** :
  - livre de paie et état récapitulatif ;
  - masse salariale par établissement, convention et service ;
  - état des sommes à déclarer et à verser (CNPS, DGI, commune) ;
  - DIPE et état annuel des salaires (Excel).
- **Virements** :
  - ordre mensuel historisé : référence, dates, montants, motif, commentaires, statut ;
  - validation par la DRH ;
  - **lettre de virement** au modèle de bordereau bancaire ;
  - fichier pour la banque et fichier Mobile Money ;
  - envoi au conseiller bancaire avec un commentaire.
- **Écritures comptables** transmises automatiquement à la validation DRH au format `myyiel.journal-batch/1`, puis lettrage automatique du 422 au paiement.

---

## 2. Organisation et contrôles

| Besoin | Réponse |
|---|---|
| Multi-sites | Établissements (Douala, Yaoundé…) avec employeur CNPS, taux AT (1,75 / 2,5 / 5 %) et commune propres. Les états sont ventilés par site. |
| Plusieurs conventions | Yiel Group (conseil et édition de logiciels) : CC Commerce et services, CC Services numériques. DeyGo : CC Transports. Chaque convention a sa grille catégorielle datée (minimum → anomalie B02), ses paliers d’ancienneté, son préavis et son barème de licenciement. |
| Pointages et absences | Les événements GTA sont agrégés en variables. Les absences non rémunérées réduisent le salaire au 1/30 et les congés sont payés au salaire journalier moyen. B08 si les absences dépassent les jours payés, W12 si aucun pointage n’est reçu. |
| Anomalies | 9 bloquantes et 13 non bloquantes, chacune avec explication, salarié concerné et lien direct vers la correction. |

---

## 3. Plan des fonctionnalités additionnelles : à quoi elles servent, pourquoi elles sont utiles

Les fonctions ci-dessous vont au-delà du cahier des charges. Elles répondent à des réalités propres aux organisations camerounaises et africaines : Mobile Money très répandu, multi-sites, fort recours aux avances sur salaire, contrôles CNPS et DGI fréquents, équipes RH réduites, besoin de preuve.

### 3.1 Livré dans cette version

| # | Fonctionnalité | À quoi ça sert | Pourquoi c’est utile |
|---|---|---|---|
| F1 | **Yiélina, assistante RH (texte et voix)** | Le gestionnaire pose ses questions en français : « Quelles anomalies restent ? », « Ajoute 8 h sup à Kamga », « Explique le bulletin de Fouda », « Simule 450 000 net ». Yiélina lit les données, propose et exécute l’action après confirmation, et alerte sur les erreurs. | Elle fait gagner du temps aux petites équipes RH et réduit les erreurs de saisie. La dictée vocale aide en mobilité. L’explication d’un bulletin en langage simple désamorce les réclamations des salariés. |
| F2 | **Détection de fraude au paiement** (W03, W04) | Signale un même RIB ou un même numéro MoMo utilisé par plusieurs salariés. | Les salariés fictifs et les détournements de virements sont un risque réel. Le contrôle est fait à chaque paie, sans effort. |
| F3 | **Salaire atypique pour le poste** (W13) | Compare chaque salaire à la médiane du même poste. | Repère les erreurs de saisie (un zéro de trop) et les écarts à justifier en cas de contrôle ou d’audit d’équité. |
| F4 | **Paiement Mobile Money natif** | Mode de paiement par salarié (virement, MoMo, OM, espèces). Fichiers de paiement distincts par canal, écritures 5211 / 5521 / 5711. | Beaucoup de salariés, journaliers et livreurs sont payés par MoMo ou OM : la paie le gère sans retraitement Excel. |
| F5 | **Avances avec date limite paramétrable** | Demande, approbation, versement (écriture 421), retenue automatique. Au-delà de la date limite (le 15 par défaut), la retenue glisse au mois suivant. Plafond en % du net et nombre maximal d’avances par mois. | L’avance est très courante. Une règle claire, connue de tous, protège la trésorerie et évite l’arbitraire. |
| F6 | **Prêts au personnel échéancés** | Décaissement comptabilisé, mensualités retenues automatiquement, capital restant dû. | Plus de tableau Excel parallèle, ni d’oubli de retenue. |
| F7 | **Simulateur brut ⇄ net** | Calcule le coût employeur à partir d’un brut, ou le brut nécessaire pour un net promis (calcul inverse). | Il sert à l’embauche (« le candidat veut 500 000 net ») et aux augmentations. Il évite les promesses intenables. |
| F8 | **Bulletins bilingues FR / EN** | Chaque bulletin peut être rendu en anglais. | Le Cameroun est bilingue (régions anglophones) et les salariés expatriés ou les groupes étrangers le demandent. |
| F9 | **Envoi WhatsApp tracé** | Message préparé avec le net, la période et le lien. L’envoi est marqué sur le bulletin. | WhatsApp est le canal réellement lu. La traçabilité prouve la remise du bulletin. |
| F10 | **Cachet photographié et traité** | La photo du cachet sur papier blanc est détourée automatiquement (fond rendu transparent) puis apposée avec la signature. | Elle évite le scan et l’impression pour signer. Le bulletin numérique est présentable à une banque ou une ambassade. |
| F11 | **Signature sans doublon** | Seuls les bulletins non signés sont traités, et un bulletin modifié après validation est refusé. | Pas de double signature, pas de signature d’un document altéré. Le statut est visible : signé (grisé) ou « à signer par la DRH ». |
| F12 | **Gel par empreinte et recalcul de contrôle** | Chaque paie validée est scellée par un hash. Le recalcul de contrôle compare sans écraser et produit les rappels. | C’est la preuve en cas de contrôle CNPS ou DGI. Un changement de taux rétroactif ne casse pas l’historique. |
| F13 | **Alertes d’échéances RH** | Fin de CDD sous 30 jours (W05), fin d’essai (W06), palier d’ancienneté (W10), solde de congés anormal (W07). | Elles évitent les CDD requalifiés en CDI par oubli et les primes d’ancienneté non appliquées. |
| F14 | **Quotité de retenues** (W11) | Alerte quand avances et prêts dépassent la part saisissable du net. | Elle protège le salarié et l’entreprise contre les litiges. |
| F15 | **Centre de notifications par rôle** | Chaque profil voit ses tâches : paie à valider, bulletins à signer, ordre de virement en attente, déclaration à échéance (le 15), avances à traiter. | Personne n’attend un e-mail : le flux avance seul. |
| F16 | **Confidentialité du bordereau** | Choix entre matricule et RIB seulement, ou nom complet. | Il limite la circulation des salaires nominatifs hors de l’entreprise, tout en respectant les banques qui exigent le nom. |
| F17 | **Masse salariale analysée** | Évolution sur 12 mois, ventilation par site, convention et service, coût employeur. | C’est le pilotage du premier poste de charges pour la direction générale. |
| F18 | **Interface GTA prête** | Format d’événements de temps publié. Le futur module s’y branche sans modifier le moteur. | L’investissement est protégé : pas de refonte à l’arrivée de la pointeuse ou de la badgeuse. |

### 3.2 Feuille de route proposée (non livrée)

| # | Fonctionnalité | À quoi ça sert | Pourquoi c’est utile |
|---|---|---|---|
| R1 | **Portail salarié sur WhatsApp et mobile** | Le salarié consulte ses bulletins, demande une avance ou un congé, et télécharge une attestation. | Moins de sollicitations au service RH. Fonctionne avec un smartphone d’entrée de gamme. |
| R2 | **Avance à la demande par MoMo** | Versement instantané d’une part du salaire déjà acquis, via l’API MTN ou Orange. | Il remplace les prêts informels coûteux et fidélise les salariés. |
| R3 | **Attestation vérifiable par QR code** | Une banque ou une ambassade vérifie en ligne l’authenticité d’une attestation ou d’un bulletin. | Il lutte contre les faux bulletins, fréquents dans les dossiers de crédit et de visa. |
| R4 | **Télédéclaration CNPS et DGI par API** | Dépôt direct quand les portails publieront leurs API. | Il supprime la ressaisie, aujourd’hui préparée par l’export DIPE. |
| R5 | **Budget de masse salariale** | Prévision des embauches, augmentations et départs, puis suivi du réel. | Il sécurise les décisions de recrutement. |
| R6 | **Packs pays CEMAC et UEMOA** | Gabon, Congo, Tchad, Côte d’Ivoire, Sénégal sur le même moteur. | Pour les groupes multi-pays : il suffit d’ajouter un pack, sans nouveau code. |
| R7 | **Mode hors ligne** | Saisie des variables sans connexion, synchronisation ensuite. | Utile pour les sites aux coupures fréquentes. |

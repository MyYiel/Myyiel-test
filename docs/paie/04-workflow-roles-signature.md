# 04 · Workflow, rôles, signature, virements, déclarations

## 1. Cycle d’une période de paie

```
 préparation ──calcul──▶ calculée (anomalies bloquantes) ──correction + calcul──▶ contrôlée
      ▲                                                                              │ soumettre (gestionnaire)
      │ rejet motivé (DRH)                                                           ▼
      └──────────────────────────────────────────────────────────────────────────  soumise
                                                                                     │ valider (DRH)
                                                                                     ▼
                         validée · gelée (empreinte) · écritures transmises en comptabilité
                                                                                     │ clôturer (DAF)
                                                                                     ▼
                                                                   clôturée · période suivante ouverte
```

| Statut | Qui agit | Ce qui se passe |
|---|---|---|
| `preparation` | Gestionnaire | Saisie et import des variables, import GTA. Toute modification ramène la période ici. |
| `calculee` | Gestionnaire | Calcul effectué avec au moins une anomalie **bloquante**. La soumission est impossible. |
| `controlee` | Gestionnaire | Aucune anomalie bloquante. Les anomalies non bloquantes sont listées pour revue. Prête à soumettre. |
| `soumise` | DRH | Lecture seule pour le gestionnaire. La DRH valide ou rejette avec un motif obligatoire. |
| `validee` | DRH, puis automatique | Les contrôles sont **rejoués** (une anomalie apparue entre-temps bloque). Puis : gel des bulletins par empreinte, mise à jour des congés, avances et prêts, **construction et intégration du lot comptable**. |
| `cloturee` | DAF | Après vérification des écritures. Ouvre la période suivante. Une période clôturée ne se modifie plus : régularisation en N+1. |

**Préparation, contrôle et validation sont séparés par les droits.** Le gestionnaire n’a pas `pay.approve`, la DRH n’a pas `pay.prepare`. Une même personne ne peut donc pas préparer et valider. Le schéma SQL l’impose aussi en base (`approved_by <> submitted_by`).

## 2. Rôles et droits

| Droit | Signification | Gestionnaire | DRH | DAF | Propriétaire | Expert-comptable |
|---|---|:-:|:-:|:-:|:-:|:-:|
| `pay.read` | Consulter la paie | ✓ | ✓ | ✓ | ✓ | ✓ |
| `pay.sensitive` | Voir salaires, RIB, CNI, NIU, CNPS | ✓ | ✓ | ✓ | ✓ | |
| `pay.prepare` | Salariés, variables, calcul, avances (demande), sorties | ✓ | | | ✓ | |
| `pay.validate` | Soumettre la paie à la DRH | ✓ | | | ✓ | |
| `pay.approve` | Valider ou rejeter la paie, approuver avances et prêts, valider les ordres de virement | | ✓ | | | |
| `pay.sign` | Signer et apposer le cachet | | ✓ | | | |
| `pay.bank` | Préparer, envoyer et confirmer les ordres de virement, verser les avances | ✓ | | | ✓ | |
| `pay.post` | Vérifier les écritures, relancer la transmission, clôturer | | | ✓ | | |
| `pay.declare` | Télétransmettre et payer CNPS, DGI, commune | | | ✓ | | |
| `pay.settings` | Réglementation, rubriques, conventions, schéma comptable, délais | ✓ | | | ✓ | |

Les droits sont vérifiés **dans le moteur** (`need()`), pas seulement dans l’interface. Un appel direct sans le droit lève une `BizError`. La matrice complète est dans `docs/matrice-des-droits.csv`.

## 3. Signature DRH et cachet

1. **Spécimen.** La DRH dessine sa signature (tablette, souris ou doigt) ou importe une image.
2. **Cachet.** Elle photographie le cachet tamponné sur une feuille blanche. myyiel **détoure** l’image : les pixels proches du blanc deviennent transparents, l’encre est renforcée et l’image recadrée. L’aperçu se fait sur un bulletin réel.
3. **Signature en lot.** « Signer tous les bulletins non signés », confirmée par la saisie du mot `SIGNER` :
   - les bulletins **déjà signés sont ignorés** : pas de doublon, compteur affiché ;
   - un bulletin dont l’empreinte ne correspond plus au gel est **refusé** ;
   - chaque signature enregistre le nom, la date, l’empreinte du bulletin et une empreinte de signature.
4. **Affichage.** Les bulletins signés sont **grisés** avec la mention « Signé ». Les autres portent le statut **« À signer par la DRH »**.
5. Le gestionnaire **ne peut pas signer** : il n’a pas le droit `pay.sign`. Il ne diffuse que des bulletins signés.

## 4. Diffusion des bulletins

| Canal | Fonctionnement |
|---|---|
| PDF | Individuel ou groupé (tous ou sélection), signature et cachet incrustés. |
| E-mail | Message préparé, PDF protégé par un code personnel. L’envoi est tracé sur le bulletin. |
| WhatsApp | Message court avec lien sécurisé et code valable 7 jours ; le bulletin n’est jamais joint en clair. L’envoi est tracé. |

En production, l’envoi passe par l’API e-mail et WhatsApp Business de myyiel. La maquette prépare le message et trace l’envoi.

## 5. Ordres de virement

```
brouillon ──soumettre (gestionnaire)──▶ soumis ──valider (DRH)──▶ validé ──envoyer au conseiller──▶ envoyé ──confirmer l'exécution──▶ exécuté
                                          └──rejeter (DRH, motif)──▶ rejeté
```

- **Formulaire mensuel du gestionnaire** :
  - référence `OV-AAAA-MM-NN` ;
  - dates de création et de valeur ;
  - montant total et nombre de bénéficiaires ;
  - motif et commentaire ;
  - compte débité et conseiller bancaire.
- **Historique** de chaque transition : qui, quand, commentaire.
- **Confidentialité** :
  - `matricule`, le défaut recommandé : matricule, banque et RIB uniquement ;
  - `complet` : avec les noms, si la banque l’exige.
- **Lettre de virement PDF** au format du bordereau bancaire fourni : en-tête, destinataire (conseiller), objet, tableau des bénéficiaires, total en lettres, signatures.
- **Fichiers banque.** Fichier de virements (CSV) et **fichier Mobile Money** séparé pour les salariés payés par MoMo ou OM.
- **Conseiller bancaire** : nom, banque, e-mail et téléphone, plus un commentaire libre joint à l’envoi.
- **Exécution** : écriture 422 / trésorerie par mode de paiement, puis lettrage automatique du 422.

## 6. Déclarations et télétransmission

| Organisme | Contenu | Échéance | Compte |
|---|---|---|---|
| CNPS | PVID, PF, AT (parts salariale et patronale) | 15 du mois suivant | 431 |
| DGI | IRPP, CAC, CFC, FNE, RAV | 15 du mois suivant | 447 |
| Commune | TDL | 15 du mois suivant | 447 |

1. **Prérequis** (RG-P30) : la paie est validée **et** le lot est intégré en comptabilité.
2. **Le DAF vérifie** les écritures (lien direct vers le journal PAIE), puis **télétransmet**. Un accusé de réception est enregistré.
3. **Paiement** : écriture 431 ou 447 / banque, puis lettrage.
4. **Exports** : DIPE (CNPS) en Excel, état des sommes à déclarer et à verser en PDF, état annuel des salaires (DSF) en Excel.
5. **Alertes** : à J-5 de l’échéance, puis en retard.

## 7. Avances, prêts, sorties

- **Avance** : demandée par le gestionnaire pour un salarié, ou à terme par le salarié.
  - Contrôles : plafond en % du salaire, nombre maximal par mois, **date limite** (le 15 par défaut, paramétrable).
  - Une demande reçue après la date limite est retenue sur le mois suivant.
  - Circuit : approbation DRH → versement (écriture 421) → retenue automatique sur la paie.
- **Prêt** : approuvé par la DRH, décaissement comptabilisé, mensualités retenues jusqu’à extinction.
- **Sortie** :
  - prévisualisation du solde de tout compte (préavis, congés non pris, indemnité de licenciement selon la convention et le motif) ;
  - enregistrement sur la paie du mois ;
  - certificat de travail et attestation de salaire en PDF.

## 8. Notifications

Les notifications sont calculées en continu (`P.notifications`) et filtrées par rôle. Elles s’affichent dans la cloche et sur le tableau de bord.

| Destinataire | Notifications |
|---|---|
| Gestionnaire | Anomalies, avances à traiter, fin de CDD, date limite des avances, jour de paie |
| DRH | Paie soumise, bulletins à signer, ordre de virement à valider |
| DAF | Écritures à vérifier, déclarations à échéance ou en retard, période à clôturer |

Les réglages se répartissent sur deux écrans :
- **Paramétrage › Notifications & délais** : jour de paie, rappel avant échéance, canaux (myyiel, e-mail, WhatsApp), confidentialité par défaut des virements, langue des bulletins, alerte GTA ;
- **Avances › Paramètres** : date limite des demandes, plafond, nombre maximal d’avances par mois.

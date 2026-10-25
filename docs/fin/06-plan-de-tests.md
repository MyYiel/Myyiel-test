# 06 · Plan de tests

## Tests unitaires — `node app/tests/fin.test.js` (88 vérifications)

| Bloc | Ce qui est vérifié |
|---|---|
| Répertoire | Création avec profil étendu. Doublons (raison sociale proche, NIU). Contact principal unique. Synthèse calculée depuis la comptabilité. Correspondance des colonnes par synonymes. Import : erreurs, doublons fichier et référentiel, coordonnées « à confirmer » |
| Facturation | Mentions manquantes (NIU émetteur), envoi refusé. Niveaux commercial et fiscal. Message WhatsApp avec lien et mise en garde. Empreinte posée, altération détectée. Reconnaissance des 8 zones, format refusé. 6 zones verrouillées. Étapes « consultée » et « payée » |
| Encaissement | Carte non proposée (prestataire indisponible). Numéro contrôlé. Rien n'est payé avant confirmation. Notification falsifiée rejetée et journalisée. Confirmation : paiement partiel et écriture. Notification rejouée sans double écriture. Écart de montant mis en examen. Échec. Facture soldée, lien clôturé |
| Justificatifs | Faux SMS « frais de déblocage ». Capture introuvable : suspecte. Confirmation impossible sans relevé. Virement retrouvé sur le relevé, puis confirmé. Référence réutilisée. Bénéficiaire différent. Rejet |
| Usurpation | Quarantaine, domaine sosie, titulaire différent. Rien n'est appliqué directement. Le comptable ne confirme pas. Rappel à un contact du référentiel. Contrôles au rouge. Refus : vigilance (numéro et domaine). Confirmation régulière avec carence. Paiement bloqué pendant la carence. Nom du titulaire. Numéro du fournisseur identique à celui d'un salarié |
| Factures reçues | Fausse facture (sosie, RIB, domaine, vigilance). Validation bloquée. Fraude signalée. Doublon comptable. Validation, puis écriture ACH. Même facture reçue deux fois. Incohérences HT + TVA et taux |
| Paiements | Fournisseur fictif bloqué. Approbation impossible si bloqué. Le préparateur n'approuve pas. Pas d'exécution avant approbation. Exécution, puis règlement. Double validation au-delà du seuil. Doublon de paiement. Vigilance, puis blocage |
| Rapprochement | Frais de 1 %. Groupé (2 factures). Fractionné (2 versements). Référence imparfaite. Écriture existante. Application, puis facture soldée et frais en 631. Groupé : une seule écriture. Montant incohérent refusé |
| Prévision et relances | Prudent ≤ central. Sources paie et fournisseurs. Tension sous le seuil. Plan de relance. Relance avec lien. Promesse (future seulement). Promesse non tenue. Fiabilité |
| Droits | Le DAF est alerté des blocages. Le lecteur n'a aucune action. Toutes les écritures restent équilibrées |

## Parcours navigateur — `node app/tests/e2e/fin-flows.js [captures]`

Les parcours couvrent :

- les 31 pages et onglets du module (DAF) ;
- le répertoire en cartes, les filtres et la fiche à 9 onglets ;
- le refus de l'usurpation CHG-0001 après rappel, puis le numéro en vigilance ;
- le vérificateur de numéro ;
- la fausse facture IN-0004 signalée, puis la validation de IN-0001 ;
- la saisie du NIU et du RCCM, l'envoi WhatsApp, la page de paiement, l'initiation MoMo ;
- une notification falsifiée (refusée, 0 encaissé), puis une confirmation signée (« Payée ») ;
- le vérificateur de faux SMS, puis un justificatif confirmé par le relevé ;
- l'assistant de modèle de A à D ;
- une proposition par le comptable, puis l'approbation par le DAF ;
- un paiement bloqué non approuvable ;
- une correspondance forte appliquée ;
- l'import du répertoire ;
- les droits du lecteur : aucune sélection, numéros masqués ;
- la **largeur téléphone (390 px) sans débordement horizontal**.

Les suites existantes sont relancées à chaque livraison : `smoke.js`, `flows.js`, `paie-flows.js`, `rh-flows.js`.

## Scénarios SQL — PostgreSQL 16

```
pg_ctlcluster 16 main start
createdb fintest
psql -v ON_ERROR_STOP=1 -d fintest -f docs/schema.sql -f docs/paie/06-schema-paie.sql -f docs/fin/05-schema-fin.sql -f docs/fin/05-schema-fin-test.sql
```

Les 42 scénarios se répartissent en 37 refus attendus et 5 contrôles positifs :

| # | Règle vérifiée |
|---|---|
| T1 | Pas de mode fiscal sans homologation. Pas de prestataire « production » sans identifiant marchand. Délai de carence d'au moins 24 h |
| T2 | La fiche n'est pas validée par son créateur. Un seul contact principal |
| T3 | Le demandeur ne confirme pas. Pas de confirmation sans rappel. Pas de coordonnées « vérifiées » sans demande confirmée |
| T4 | Refus, puis vigilance automatique (numéro et domaine). Pas de doublon dans la vigilance |
| T5 | Carence imposée. Compte identique à la demande. Le rappel ne peut pas viser un contact ajouté après la demande |
| T6 | Un seul lien actif. Pas de confirmation sans notification signée, ni avec un montant différent. Notification rejouée refusée. Second encaissement refusé. Statut confirmé définitif |
| T7 | Pas de justificatif confirmé sans ligne de relevé. Une ligne ne sert qu'une fois |
| T8 | Une facture fournisseur n'est comptabilisée qu'une fois (numéro normalisé). Une fraude exige un motif. Une facture comptabilisée exige une écriture |
| T9 | Le préparateur n'approuve pas. Commentaire si risque. Approbateurs distincts. Nombre d'approbations atteint. Le préparateur n'exécute pas. Carence. Plafond du premier paiement. Vigilance. Fournisseur suspendu |
| T10 | Empreinte figée. Pas de niveau fiscal sans homologation. Promesse future, une seule en cours |
| T11 | Isolation RLS entre sociétés |

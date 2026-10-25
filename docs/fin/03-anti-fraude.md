# 03 · Détection des faux moyens de paiement et des usurpations d'identité

Les escrocs visés usurpent l'identité d'un fournisseur ou fabriquent une preuve de paiement. Le principe directeur tient en deux phrases :

- **Aucune information reçue par message ne suffit, seule une source indépendante fait foi** : la notification signée de l'opérateur, la ligne du relevé, ou le rappel au numéro déjà enregistré.
- Un contrôle au rouge **bloque l'action** et demande une décision humaine, tracée.

## 1. Les quatre schémas couverts

| Schéma | Ce que fait le fraudeur | Ce que fait myyiel |
|---|---|---|
| **Faux changement de RIB ou de numéro MoMo** | E-mail ou WhatsApp « du fournisseur », souvent depuis un domaine sosie, annonçant de nouvelles coordonnées avant une échéance | La demande ne s'applique jamais directement (quarantaine). Contrôles automatiques. Rappel obligatoire au numéro du référentiel par une autre personne. Délai de carence et plafond du premier paiement. En cas de refus : liste de vigilance |
| **Faux SMS ou fausse capture de paiement** | Capture « Vous avez reçu 450 000 FCFA », ou demande de « renvoyer le trop-perçu » ou de payer des « frais de déblocage » | La facture n'est **jamais** marquée payée sur une capture. Analyse : format de référence, doublon, relevé, bénéficiaire, formules d'arnaque. Confirmation uniquement par une ligne de relevé |
| **Fausse facture sosie** | Facture au nom d'un fournisseur presque identique (« Douala Informatique**s** Services ») avec un autre RIB | Comparaison au référentiel : sosie (≥ 80 % de ressemblance), RIB ou MoMo différents des coordonnées vérifiées, domaine différent, doublon, montant anormal, liste de vigilance. Signalement en un clic |
| **Fournisseur fictif** | Fiche créée en interne avec le numéro MoMo d'un salarié ou d'un complice | Contrôle des comptes partagés (salariés de la paie, autres tiers). Fiche « à valider » par une autre personne. Séparation préparation / approbation / exécution |

## 2. Changement de coordonnées : la procédure

1. **Saisie de la demande** (`F.requestBankChange`) : canal d'arrivée, expéditeur, nouvelles coordonnées, texte reçu. Statut « quarantaine ».
2. **Contrôles automatiques** :
   - domaine de l'expéditeur différent du domaine connu, avec repérage des sosies ;
   - numéro de l'expéditeur inconnu du référentiel ;
   - nom du titulaire chez l'opérateur, comparé au fournisseur ;
   - numéro identique à celui d'un salarié ou d'un autre tiers ;
   - liste de vigilance ;
   - message pressant (« urgent », « compte bloqué », « audit »).
3. **Rappel** par le DAF ou le dirigeant, jamais par la personne qui a saisi la demande :
   - on choisit un **contact déjà enregistré** ;
   - le numéro figurant dans la demande est exclu ;
   - en base, le contact doit être antérieur à la demande.
4. **Décision**, avec compte rendu obligatoire :
   - **Confirmé** : nouvelles coordonnées « vérifiées », utilisables après le délai de carence (48 h par défaut, 24 h minimum). Le premier paiement est plafonné (500 000 XAF par défaut).
   - **Refusé** : le numéro, le RIB et le domaine passent en liste de vigilance, et un incident de sécurité est journalisé.
5. Si des contrôles sont au rouge, la confirmation exige de cocher explicitement « J'ai levé chaque alerte avec le fournisseur ».

## 3. Score de risque d'un paiement sortant (`F.risk`)

| Signal | Points | Bloquant |
|---|---|---|
| Aucune coordonnée, ou coordonnées non vérifiées | 60 | oui |
| Délai de carence en cours | 40 | oui |
| Coordonnées en liste de vigilance | 100 | oui |
| Numéro identique à celui d'un salarié | 50 | oui |
| Mêmes coordonnées qu'un autre tiers | 50 | non |
| Titulaire chez l'opérateur différent du fournisseur | 50 | oui si < 40 % |
| Fournisseur non validé / suspendu | 50 | suspendu : oui |
| Premier paiement sur nouvelles coordonnées au-delà du plafond | 30 | non |
| Paiement identique déjà proposé ou exécuté (30 jours) | 40 | non |
| Montant plus de 3 fois supérieur aux paiements habituels | 20 | non |
| Premier paiement à ce fournisseur au-delà du seuil simple | 15 | non |
| Montant rond élevé | 5 | non |

Seuils par défaut :

| Score | Effet |
|---|---|
| ≥ 40 (revue) | Deux approbateurs et un commentaire |
| ≥ 70 (blocage) | Statut « bloquée » |

Le score est **recalculé au moment de l'exécution**.

## 4. Justificatifs déclarés (`F.analyzeProof`)

| Contrôle | Exemple de signal |
|---|---|
| Format de la référence | MTN : 10 à 11 chiffres. Orange : MP / PP / CI + date.heure + code. Un « 12345 » est rejeté |
| Référence déjà utilisée | Même référence sur un autre paiement ou un autre justificatif |
| Relevé | Ligne retrouvée (même référence, ou même montant à ± 3 jours) sur le compte du moyen de paiement |
| Bénéficiaire | Le nom affiché sur la capture n'est pas la société |
| Formules d'arnaque | Marque de l'opérateur absente ou mal orthographiée (« Orang Money »), « frais de déblocage », « renvoyer », « transfert par erreur », urgence, numéro personnel à rappeler |
| Date | Postérieure à aujourd'hui |

Verdicts possibles :

- **confirmable** : une ligne de relevé a été retrouvée ;
- **à vérifier** ;
- **suspect** ;
- **très probablement faux**.

Seule `F.confirmProof`, appelée **avec une ligne de relevé**, enregistre le paiement.

## 5. Notifications des prestataires

Chaque notification passe par trois contrôles :

- une **signature** HMAC calculée avec le secret du prestataire ;
- l'**idempotence** par (prestataire, référence) : une notification rejouée est ignorée et ne produit jamais une seconde écriture ;
- le **contrôle du montant**.

Une notification falsifiée est rejetée et journalisée. Ces règles sont doublées en base (document 05).

## 6. Liste de vigilance

Elle accepte six types d'entrées : numéro Mobile Money, RIB, téléphone, e-mail, domaine, nom. La clé est normalisée :

- les 9 derniers chiffres pour un mobile (le préfixe 237 est ignoré) ;
- les chiffres seuls pour un RIB ;
- les minuscules pour un domaine.

La liste est consultée :

- aux changements de coordonnées ;
- à l'analyse des factures reçues ;
- au calcul du risque de chaque paiement ;
- dans le vérificateur « numéro / RIB ».

Un retrait exige un droit spécifique et une justification, qui sont tracés.

## 7. Données sensibles

| Droit | Rôles |
|---|---|
| Voir les numéros complets | Propriétaire, comptable, DAF |
| Confirmer un changement de coordonnées, valider une fiche, gérer la vigilance (`fin.verify`) | Propriétaire, DAF |
| Approuver (`fin.approve`) et exécuter (`fin.pay`) | Propriétaire, DAF, avec séparation des tâches |
| Tous les autres rôles | Numéros masqués (`••• 1234`) |

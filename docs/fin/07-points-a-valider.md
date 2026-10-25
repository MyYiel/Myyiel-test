# 07 · Points à valider avant la production

## 1. Facturation électronique certifiée (Cameroun)

**Ce qu'on sait :**

- La loi de finances 2026 du Cameroun introduit la facturation électronique au moyen de solutions certifiées, dans une logique de contrôle continu des transactions.
- La transmission doit se faire en temps réel à l'administration fiscale.
- Des secteurs prioritaires sont cités dans les analyses publiées.

**Ce qui reste à confirmer :**

- le calendrier d'application par catégorie d'entreprise ;
- le format technique (structure, signature, QR code, numérotation) ;
- le protocole d'échange avec la DGI ;
- la procédure d'homologation des solutions et la liste des solutions agréées ;
- les mentions exactes à faire figurer ;
- les sanctions.

**Position retenue dans myyiel :**

- Le niveau affiché est **« facture commerciale »**.
- Le niveau « fiscalement conforme » ne peut être activé qu'avec un numéro d'homologation. L'interface et la base de données l'imposent toutes les deux.
- La zone 8 (pied de page légal) et la zone 1 (références) sont prêtes à recevoir les données de certification (identifiant, signature, QR de vérification) dès que le format sera publié.

**Décision attendue :**

- choisir entre deux voies : faire homologuer myyiel, ou s'appuyer sur un intermédiaire certifié ;
- désigner un référent fiscal (cabinet).

## 2. Prestataires de paiement

| Sujet | À obtenir |
|---|---|
| MTN Mobile Money | Contrat marchand, accès à l'API de collecte, clés de production, format exact des notifications et de leur signature, frais applicables |
| Orange Money | Idem (API marchande, notifications, frais) |
| Banques | Formats de relevés (CSV, MT940, CAMT.053), API éventuelles, format des fichiers de virement |
| Carte bancaire | Choix d'un acquéreur ou d'un agrégateur. Tant qu'aucun n'est retenu, la carte n'est pas proposée au client |
| Nom du titulaire | Existence et conditions d'un service de vérification chez chaque opérateur. À défaut, le rappel humain reste la seule preuve |
| Agrégateurs | Comparer un raccordement direct aux opérateurs et un agrégateur régional (couverture CEMAC, frais, reversement) |

## 3. WhatsApp

Les besoins :

- un compte WhatsApp Business vérifié, via l'API officielle ;
- des modèles de messages approuvés (facture, relance) ;
- le consentement des destinataires ;
- les frais par conversation.

Sans compte connecté, le message est **préparé à copier**, et non envoyé automatiquement.

## 4. Données personnelles et sécurité

Points de conformité à traiter :

- la loi camerounaise n° 2024/017 relative à la protection des données personnelles : base légale, durée de conservation des justificatifs et des journaux, droits des personnes ;
- l'hébergement et la localisation des données.

Mesures techniques prévues :

- secrets des prestataires dans un coffre, avec rotation ;
- HMAC-SHA256 pour les notifications ;
- limitation de débit sur la page de paiement publique ;
- authentification à deux facteurs obligatoire pour les rôles `fin.approve`, `fin.pay` et `fin.verify`.

## 5. Règles de gestion à faire valider par la DAF

Les seuils par défaut :

| Paramètre | Valeur par défaut |
|---|---|
| Approbation simple | 1 M XAF |
| Double approbation | 5 M XAF |
| Revue renforcée | risque ≥ 40 |
| Blocage | risque ≥ 70 |
| Délai de carence | 48 h |
| Plafond du premier paiement | 500 000 XAF |
| Seuil de trésorerie | 35 M XAF |

Autres règles :

- **Taux de frais Mobile Money** reconnus au rapprochement : 0 à 2 %, à aligner sur les contrats.
- **Scénario de relance** et ton des messages.
- **Pénalités de retard** mentionnées en zone 8.

## 6. Offre

Le périmètre gratuit doit être confirmé :

- facturation illimitée ;
- envoi avec lien ;
- encaissement ;
- répertoire ;
- relances manuelles ;
- contrôle des justificatifs et vigilance.

La tarification des fonctions avancées reste à définir. Les frais des opérateurs de paiement restent ceux de leurs contrats et ne sont pas refacturés par myyiel, sauf décision contraire.

## Sources

- [Facturation électronique au Cameroun : nouvelle obligation prévue par la loi de finances 2026 — EDICOM](https://edicomgroup.com/fr/blog/facturation-electronique-obligatoire-au-cameroun)
- [Cameroun : les principales innovations de la loi de finances pour 2026 — Deloitte Société d'Avocats](https://blog.avocats.deloitte.fr/cameroun-les-principales-innovations-de-la-loi-de-finances-pour-2026/)
- [Cameroon mandates real-time electronic invoicing under 2026 Finance Law — RegFollower](https://regfollower.com/cameroon-mandates-real-time-electronic-invoicing-under-2026-finance-law/)

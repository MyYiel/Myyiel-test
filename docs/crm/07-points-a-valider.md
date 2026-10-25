# 07 · Points à valider

## 1. Règles de prospection par marché et par canal

La validation d'une campagne par la direction **ne remplace pas** les obligations légales ni les conditions des fournisseurs. Pour chaque pays visé, il faut faire valider par un juriste :

| Marché | Questions à trancher |
|---|---|
| Cameroun | Prospection B2B par e-mail sous la loi n° 2024/017 sur les données personnelles : base légale, information des personnes, droit d'opposition, déclaration ou autorisation éventuelle auprès de l'autorité de protection, durées de conservation |
| Afrique centrale (CEMAC) et Afrique francophone | Lois nationales sur les données personnelles et autorités compétentes, pays par pays |
| Europe (France, Belgique) | RGPD et règles nationales de prospection B2B (intérêt légitime, information, opposition simple), transferts hors de l'Union, sous-traitants |

Le CRM est **paramétrable par pays** : texte d'information, lien de désinscription, canaux autorisés, durée de conservation. La campagne « Gabon » de la démonstration est suspendue précisément pour ce motif.

## 2. Fournisseurs et coûts

Plusieurs choix restent à faire :

- **Messagerie** : boîte Google Workspace ou Microsoft 365, ou fournisseur d'envoi. Il faut connaître les limites quotidiennes réelles, puis paramétrer `limitDay` en conséquence, et configurer SPF, DKIM et DMARC sur le domaine.
- **WhatsApp Business** : compte vérifié, modèles d'alerte, coût par conversation, numéro de la dirigeante.
- **Recherche et vérification d'adresses** : comparer les sources (couverture Afrique, licéité de la collecte, coût), puis décider de ce qui est stocké et pendant combien de temps.
- **IA** (rédaction, classement, lecture) : choisir le fournisseur, la localisation des données et le coût par organisation SaaS.

## 3. Décisions de gouvernance

Trois décisions restent ouvertes :

- **Qui valide** : la direction seule, ou aussi des délégués ? Avec quelle durée maximale de délégation ?
- **Plafonds de départ** :

  | Plafond | Valeur par défaut |
  |---|---|
  | Par boîte et par jour | 150 |
  | Par campagne et par jour | 60 |
  | Par campagne et par semaine | 250 |
  | Par destinataire et par semaine | 2 |
  | Horaires | 8 h – 17 h 30, du lundi au vendredi |

- **Seuil d'arrêt automatique** sur le taux de rejet (10 % par défaut) et sur le taux d'opposition.

Les listes de référence sont aussi à valider : motifs de perte, étapes et probabilités, offres du groupe.

## 4. Conservation et journaux

Trois durées sont à fixer :

- celle des contacts inactifs (par exemple 3 ans sans interaction, puis anonymisation) ;
- celle des journaux d'exécution et des contenus de message ;
- celle des enregistrements d'approbation (durée de vie de la campagne + X ans).

Il faut aussi fixer la politique d'export : qui exporte, et vers quelles destinations.

## 5. Lots et commercialisation SaaS

L'ordre recommandé est confirmé :

1. Fondations.
2. Prospection.
3. Communication.
4. Automatisations.
5. Direction et intégrations avancées.
6. SaaS.

Pour le lot 6, il reste à définir :

- les offres et quotas par organisation (utilisateurs, contacts, envois mensuels) ;
- la facturation, via le module 4 de myyiel ;
- l'intégration des nouveaux clients (création d'espace, import guidé) ;
- les conditions générales et le contrat de sous-traitance des données.

Yiel Group conserve la maîtrise du dépôt de code, des comptes d'hébergement, des clés, des domaines et des accès administratifs.

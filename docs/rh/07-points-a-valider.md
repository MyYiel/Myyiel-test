# 07 · Points à valider avant la mise en production

## Juridique : géolocalisation et données personnelles

La loi n° 2024/017 relative à la protection des données à caractère personnel s'applique. Points à traiter :

1. **Registre et information.**
   - Inscrire les traitements « pointage géolocalisé » et « suivi des missions » au registre.
   - Remettre la notice d'information (texte fourni dans l'application, à relire par un juriste).
   - Informer les représentants du personnel.
2. **Proportionnalité.** Les choix techniques sont les suivants ; ils sont à confirmer :
   - position lue au seul instant du pointage ;
   - suivi limité à la fenêtre de la mission ;
   - aucun suivi hors temps de travail ;
   - accès limité au N+1, aux RH et à la paie.
3. **Durée de conservation des positions** : 90 jours par défaut.
4. **Contrôles aléatoires** : préciser dans le règlement intérieur qu'une absence de réponse **n'entraîne aucune sanction automatique**.
5. **WhatsApp Business** : ouvrir un compte vérifié, faire valider les modèles de messages, informer les salariés que leur numéro est utilisé.

## Social : à valider selon la convention collective

| Point | Valeur livrée |
|---|---|
| Congés payés | 1,5 jour ouvrable par mois (Code du travail, art. 89), majorations selon la convention. Le solde vient de la paie. |
| Permissions exceptionnelles | 10 jours par an et durées par événement (mariage 4 j, naissance 3 j, décès 5 j) : valeurs modèles |
| Maternité | 14 semaines, indemnités journalières CNPS. Choisir entre le maintien du salaire avec subrogation (paramétrage livré, ABS_AUT) et la suspension (ABS_NP). |
| Maintien du salaire en maladie | Selon l'ancienneté et la convention (paramétrage livré : salaire maintenu) |
| Heures supplémentaires | Paliers hebdomadaires de 8 h (+20 / +30 / +40 %), nuit, dimanche et fériés +50 %. Seuil de déclenchement à 30 min. |
| Retards | Remontés à la paie pour information seulement (pas de retenue automatique) |
| Fêtes musulmanes | Dates à confirmer chaque année par arrêté ; les modifier dans **Paramétrage › Jours fériés** |
| Seuil de couverture d'un service | 50 % |

## Comptable : stocks

1. **Méthode.** Intermittent ou permanent, à choisir avec l'expert-comptable.
2. **Stock à l'ouverture.** Pour le premier exercice avec stocks, saisir le stock initial et vérifier qu'il concorde avec les achats déjà comptabilisés en 60x.
3. **Taux de dépréciation des articles dormants** : 25 % et 50 % sont des suggestions, à justifier dans l'annexe.
4. **Coûts accessoires d'achat** (transport, droits de douane) à incorporer au coût d'entrée : manuellement dans cette version.

## Limites de la maquette

- **Envois simulés.** La géolocalisation, les envois WhatsApp et la lecture du QR code sont simulés : le téléphone dans « Mon espace » propose des scénarios. En production, la page du lien lit la position du navigateur du téléphone avec l'accord du salarié.
- **Carte schématique.** C'est un contour simplifié du Cameroun et des villes ; un fond de carte réel (OpenStreetMap) peut la remplacer en production.
- **Horloge figée** au 21/10/2026 à 10:31 pour la démonstration.

# 01 · Temps & présence (GTA)

## 1. Le problème à résoudre

Les pointeuses physiques, à empreinte ou à badge, coûtent cher. Elles tombent en panne avec les délestages et ne couvrent ni les agents terrain ni les sites distants. Elles se contournent facilement : un collègue badge pour un absent, une feuille de présence est remplie après coup. Surtout, elles restent **sans effet sur la paie** : personne ne fait le lien entre les pointages et le bulletin.

myyiel remplace la pointeuse par le téléphone que tout le monde possède déjà, et relie chaque journée à la paie.

## 2. Pointage par lien WhatsApp

1. **Envoi du lien.** À l'heure de prise de poste, le salarié reçoit un **lien personnel** sur le numéro WhatsApp de son dossier (`G.issueLink`). Le lien est :
   - valable 10 minutes (paramétrable) ;
   - à usage unique ;
   - lié au salarié.
2. **Pointage.** Le salarié ouvre le lien sur place. La page lit **une seule fois** la position, la précision, l'identifiant du téléphone, le Wi-Fi visible et éventuellement le QR code scanné (`G.punch`).
3. **Score.** Le serveur calcule un **score de confiance**, puis décide :

| Score | Décision |
|---|---|
| ≥ 70 | Validé automatiquement |
| 40 à 69 | À vérifier par le N+1 |
| < 40, ou position fictive | Rejeté |

Il n'y a pas d'application à installer et aucun suivi en dehors de l'instant du pointage.

### Score de confiance (`G.score`)

| Signal | Points | Ce qu'il empêche |
|---|---|---|
| Lien personnel valide | +10 | Pointer pour un autre, ou rejouer un lien |
| Dans la géozone du site | +40 (à moins de 3 rayons : +15, au-delà : 0) | Pointer depuis chez soi |
| Précision GPS ≤ 30 m / ≤ 100 m / > 300 m | +10 / +5 / −10 | Positions approximatives |
| Téléphone enregistré / appareil inconnu | +20 / −10 (et toujours « à vérifier ») | Le téléphone d'un collègue |
| QR code affiché sur site / QR invalide | +20 / −20 | La photo d'un QR partagée sur WhatsApp (code renouvelable) |
| Wi-Fi de l'entreprise | +10 | Les immeubles partagés |
| Application de fausse localisation | −60, rejet systématique | Le contournement le plus courant |
| Vitesse impossible depuis le pointage précédent | −40 | Deux pointages éloignés à quelques minutes d'intervalle |

**Télétravail.** Un jour de télétravail approuvé, la géozone devient le **domicile déclaré**, et non le site.

## 3. Contrôles aléatoires (`G.planControls`)

- Chaque jour, quelques salariés présents (3 par défaut) sont tirés au sort entre 09:30 et 16:00.
- Ils reçoivent un lien et doivent confirmer leur présence dans la géozone en moins de 15 minutes.
- Une absence de réponse donne « sans réponse ». C'est une alerte pour le N+1 : **aucune retenue automatique** n'en découle.

## 4. Missions terrain

Un ordre de mission (`G.createMission`) contient les éléments suivants :
- les salariés ;
- l'objet et le client ;
- le départ et la destination (site ou ville), avec l'itinéraire calculé (`G.ROUTES`) ;
- les heures prévues ;
- le transport et l'indemnité journalière ;
- un PDF imprimable.

La mission se déroule en quatre statuts : **planifiée → en route → sur site → terminée**.

- **Démarrage.** Le salarié clique « Démarrer ma mission » : le suivi de position commence.
- **Suivi.** Une position est envoyée toutes les 10 minutes. `G.track` refuse toute position hors mission : c'est la règle « **fin de mission = fin du suivi** », appliquée aussi en base (RG-G20).
- **Arrivée.** Dans la géozone de destination, l'écran affiche « Vous semblez être arrivé : confirmer ». La confirmation crée le pointage d'arrivée sur le site de mission.
- **Vue du manager** (`G.missionView`), conforme au tableau de bord demandé :
  - statut ;
  - dernière position autorisée (ville la plus proche) ;
  - progression ;
  - kilomètres restants ;
  - heure d'arrivée estimée (ETA).
- **Alertes calculées** :
  - **départ non détecté** : départ prévu + 30 min sans démarrage ;
  - **retard probable** : ETA au-delà de l'arrivée prévue + 15 min ;
  - **écart d'itinéraire** : plus de 5 km de l'itinéraire prévu.
- **Conservation.** Les positions sont effacées après 90 jours (`G.purge`) ; le résultat du pointage est conservé.

**Démonstration.** L'horloge est figée à 10:31. Les boutons « +15 min » et « +1 h » font avancer les missions simulées (`G.simulate`). En production, les positions viennent des téléphones.

## 5. Journée et feuille de temps

`G.day` détermine le statut de la journée à partir de l'horaire, des pointages validés, des missions, des absences approuvées et des jours fériés :

| Statut | Signification |
|---|---|
| présent | Arrivée et départ pointés, sans retard |
| retard | Arrivée au-delà de l'heure + tolérance |
| absence injustifiée | Aucun pointage un jour ouvré |
| absence | Absence approuvée (congé, maladie…) |
| mission | Journée de mission |
| télétravail | Pointage validé au domicile déclaré |
| incomplet | Départ non pointé |
| à vérifier | Pointage au score intermédiaire en attente de revue |

**Feuille de temps** (`G.sheet`) :
- **Heures supplémentaires.** Un dépassement d'au moins 30 minutes est proposé au N+1, qui l'accepte ou le refuse jour par jour.
- **Classement des heures acceptées**, semaine par semaine : les 8 premières heures en **HS1** (+20 %), les 8 suivantes en **HS2** (+30 %), au-delà en **HS3** (+40 %). Le dimanche et les jours fériés sont classés en **HSN** (+50 %).
- **Absences injustifiées.** Le N+1 les confirme (retenue au 1/30) ou les déclare justifiées (avec un commentaire).
- **Validation** (`G.validateSheet`) :
  - **bloquée** tant qu'un pointage reste à vérifier ou qu'une journée est incomplète ;
  - les points non tranchés sont alors confirmés (absences) ou refusés (heures sup) ;
  - le salarié ne valide jamais sa propre feuille.

## 6. Transmission à la paie (`G.payExport`)

Le gestionnaire (droits `gta.export` et `pay.prepare`) transmet les éléments suivants :
- **depuis les feuilles validées** : heures sup (HS1/HS2/HS3/HSN), absences injustifiées (ABS_NP) et retards (RETARD, pour information) ;
- **depuis le module Absences** : les absences approuvées (CONGE, ABS_NP, ABS_MAL, ABS_AUT).

Les éléments partent au format `myyiel.time-events/1`, via `P.importTimeEvents`.

- Une nouvelle transmission **remplace** les éléments GTA précédents du mois, sans doublon.
- Une paie déjà validée est refusée : les éléments vont alors sur la période suivante.
- Le parcours a été vérifié jusqu'au bulletin : une absence injustifiée confirmée apparaît en retenue.

## 7. Plan des fonctionnalités : à quoi elles servent, pourquoi elles sont utiles

| Fonctionnalité | À quoi ça sert | Pourquoi c'est utile en Afrique |
|---|---|---|
| Lien WhatsApp à usage unique | Pointer sans application ni matériel | WhatsApp est déjà sur tous les téléphones. Aucun investissement, aucune panne de pointeuse. |
| Score multi-signaux | Décider automatiquement dans 9 cas sur 10 et ne soumettre au manager que les cas douteux | Le manager ne passe pas sa journée à vérifier |
| Détection de fausse localisation et de vitesse impossible | Bloquer les contournements connus | Les applications de faux GPS circulent largement |
| QR code renouvelable | Départager les immeubles partagés et les zones mal couvertes par le GPS | Le GPS est imprécis en centre-ville dense |
| Contrôles aléatoires | Vérifier la présence réelle en journée, pas seulement à l'arrivée | Ils dissuadent le « pointer et repartir » |
| Missions en direct | Savoir si l'agent est vraiment en route, et quand il arrive | Pour les commerciaux, techniciens, livreurs et sites distants (Kribi, Bertoua…) |
| Fin de mission = fin du suivi | Garantir la proportionnalité de la géolocalisation | Conformité à la loi n° 2024/017 et confiance des salariés |
| Feuilles de temps → paie | Les heures sup et absences ont enfin un effet sur le salaire | Les pointages ne sont plus déconnectés de la paie |
| Format d'échange ouvert | Brancher une badgeuse existante, un ERP ou le logiciel d'un client | Les investissements passés sont protégés |

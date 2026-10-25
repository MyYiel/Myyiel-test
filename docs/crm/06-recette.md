# 06 · Recette

## Critères REC-01 à REC-20 → tests automatisés

`node app/tests/crm.test.js` exécute 107 vérifications. Chaque critère du cahier des charges y a au moins une vérification nommée.

| ID | Test | Résultat attendu | Vérifié par |
|---|---|---|---|
| REC-01 | Connexion d'un utilisateur sans droit | Accès refusé | Salarié sans droit CRM, compte inconnu et mauvais mot de passe refusés ; MFA exigée ; refus journalisés |
| REC-02 | Données d'une autre organisation | Rien n'est divulgué | Utilisateur DeyGo refusé à la connexion et à la lecture ; données DeyGo absentes de la holding ; SQL T9 |
| REC-03 | Import avec doublons | Doublons détectés, rapport | Doublons dans le fichier et avec le CRM, adresse en opposition, aucune création sans confirmation, rapport 2 créés / 4 ignorés |
| REC-04 | Photo de carte de visite | Champs modifiables, validés avant création | Champ incertain signalé, champ absent non inventé, création impossible sans validation, doublon bloqué |
| REC-05 | Recherche d'entreprise | Sources et fiabilité visibles | Source et date sur chaque résultat ; adresse déduite jamais confirmée ; provenance conservée à l'import |
| REC-06 | Création d'une opportunité | Historique et pipeline à jour | Pipeline +4 M ; étape historisée (qui, quand, de quelle étape vers quelle étape) ; règles « Gagné » et « Perdu » ; client comptable créé |
| REC-07 | Message IA | Modèle personnalisé, aperçu | Rendu personnalisé ; reformulation ; variable vide et destinataire exclu bloqués |
| REC-08 | Campagne non approuvée | Aucun envoi | Le moteur avance d'une semaine : aucun élément créé |
| REC-09 | Campagne approuvée | Envois dans le périmètre et le planning | Rien avant le lancement ; 2 envois le 26/10 entre 8 h et 17 h 30 ; idempotence |
| REC-10 | Modification significative | Nouvelle validation | Ajout hors périmètre, puis modèle modifié : version + 1, envois suspendus ; une simple modification de contact ne demande rien |
| REC-11 | Réponse commerciale | Relances suspendues, tâche créée | Tâche pour le responsable du contact ; absence reportée au retour |
| REC-12 | Opposition | Communications bloquées | Exclusion immédiate, envois annulés, message individuel refusé |
| REC-13 | Plafond atteint | Aucun envoi au-delà | Plafond 2 par jour : 2 envois, 3 reportés, aucun le week-end ; plafond au-delà de la limite du fournisseur refusé |
| REC-14 | Erreur temporaire | Journalisée, reprise contrôlée | Nouvelle tentative, puis envoi à la reprise sans doublon ; adresse inexistante en échec définitif |
| REC-15 | Déconnexion de Google Calendar | Alerte, synchronisation indisponible | Rendez-vous « non synchronisé », alerte, resynchronisation au retour |
| REC-16 | Rendez-vous depuis un prospect | Activité liée, rappel | Rattachement à l'entreprise, rappel 60 min avant, déclenché ; report et fin recalculent la prochaine action |
| REC-17 | Objectif modifié | Indicateurs recalculés | CA signé et pipelines égaux aux dossiers ; objectif modifié et historisé ; filtre par offre |
| REC-18 | Utilisateur sans droit de validation | Approbation impossible | Marketing, responsable sans délégation, administrateur technique refusés ; délégation explicite puis retrait |
| REC-19 | Arrêt d'urgence | Plus de nouvelles exécutions | Campagne suspendue, puis suspension globale : aucun envoi ; reprise réservée à la direction |
| REC-20 | Export | Limité au périmètre, journalisé | Commercial refusé ; export du responsable limité à son équipe et inscrit dans la piste d'audit |

Le schéma SQL rejoue les règles critiques en base : `05-schema-crm-test.sql`, 40 scénarios vérifiés sur PostgreSQL 16.

```
pg_ctlcluster 16 main start
createdb crmtest
psql -v ON_ERROR_STOP=1 -d crmtest -f docs/schema.sql -f docs/crm/05-schema-crm.sql -f docs/crm/05-schema-crm-test.sql
```

Les parcours navigateur (`node app/tests/e2e/crm-flows.js`) couvrent :

- les 24 pages et onglets ;
- le détail des indicateurs du cockpit ;
- la recherche, la qualification et l'import ;
- les fiches ;
- l'import de fichier et la carte de visite ;
- le pipeline et le passage à « Gagné » ;
- l'agenda ;
- la rédaction assistée et l'envoi ;
- la validation d'une campagne, son exécution, la revalidation, l'arrêt d'urgence et la suspension globale ;
- les intégrations et le test de connexion ;
- les rôles commercial, administrateur technique et marketing ;
- la largeur téléphone (390 px) sans débordement.

## Performance et fiabilité (seuils à confirmer selon l'infrastructure)

| Mesure | Seuil proposé |
|---|---|
| Ouverture du cockpit, de la liste des contacts, du pipeline | < 1,5 s pour 50 000 contacts et 5 000 opportunités par organisation (index de `05-schema-crm.sql`) |
| Import | 20 000 lignes sans perte ; analyse < 30 s ; validation en une transaction ou par lots avec reprise |
| Moteur | 10 000 envois planifiés traités dans les plafonds ; un événement rejoué n'envoie jamais deux fois (contrainte unique) |
| Synchronisation | Réponses lues en moins de 5 min ; rendez-vous synchronisés en moins de 1 min ; reprise après coupure sans doublon |
| Sauvegardes | Point de restauration < 24 h, restauration testée chaque trimestre |
| Isolation et droits | Tests automatisés à chaque version (REC-01, REC-02, REC-18, REC-20 et SQL T9) |

Les premiers envois réels se font sur des **destinataires de test explicitement autorisés**, puis sur une campagne pilote à faible plafond.

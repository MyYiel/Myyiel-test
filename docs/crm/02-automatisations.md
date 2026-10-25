# 02 · Moteur d'automatisation

Le moteur repose sur des **événements**, des **conditions**, des **actions** et des **contrôles**. Chaque automatisation est identifiable, journalisée dans `runLog` (en base, `run_log`, en ajout seul) et désactivable par la suspension globale ou l'arrêt d'une campagne.

## 1. Déclencheurs et actions

| Déclencheur | Action | Implémentation MVP |
|---|---|---|
| Import terminé | Doublons, validation des champs, rapport ; aucune création partielle | `C.analyzeImport`, `C.importContacts` |
| Nouveau prospect qualifié | Suggestion d'offre (score d'adéquation), de modèle et de prochaine action | `C.fit`, fiche entreprise |
| Campagne approuvée | Programmation des messages initiaux autorisés | `C.approve` → `schedule` |
| Échéance de relance | Vérification des 9 règles, puis envoi si autorisé | `C.tick` → `process` |
| Réponse reçue | Arrêt des relances concernées, tâche de suivi | `C.receiveReply` |
| Rendez-vous obtenu | Pipeline à « Rendez-vous », activité, rappel | `C.saveActivity` |
| Proposition envoyée | Échéance de suivi (activité) | étape « Proposition » + activité |
| Opportunité inactive | Alerte et suggestion de relance (seuil : 14 jours) | notifications |
| Objectif en retard | Alerte à la direction | `C.cockpit().atRisk` |
| Opposition reçue | Blocage immédiat des communications | `C.exclude` (en base : déclencheur `exclusion_apply`) |
| Échec d'envoi | Erreur journalisée ; nouvelle tentative **seulement si l'erreur est temporaire** | `process` → `reessai` / `echec` |
| Intégration déconnectée | Alerte, suspension des opérations dépendantes, reprise à la reconnexion | `C.setIntegration`, statut `attente_canal` |

## 2. Cycle de vie d'une campagne et versions

```
brouillon ──soumettre──► prévalidation ──(contrôles OK)──► attente_pdg ──autoriser vN──► programmée ──date──► en_cours ──fin──► terminée
                                ▲                                │                           │                │
                                └──────── refus (motif) ◄────────┘                           └── arrêt d'urgence ──► suspendue ──reprise (direction)──┘
modification significative (autorisée, programmée, en cours ou suspendue) ──► version + 1 ──► attente_pdg (envois suspendus)
```

L'**approbation** fige plusieurs éléments :

- la version de la campagne ;
- une empreinte de la campagne ;
- la **liste des destinataires** ;
- pour chaque étape, le modèle **et sa version**, ainsi que son délai ;
- le calendrier, les plafonds et les conditions d'arrêt ;
- le volume ;
- l'auteur, la date et le commentaire.

Ce qui est **significatif** et exige une nouvelle validation :

- un destinataire ajouté hors du périmètre ou un destinataire retiré ;
- un modèle changé ou une **nouvelle version d'un modèle utilisé** ;
- un délai, le calendrier, les plafonds ou les conditions d'arrêt.

Ce qui ne l'est pas : la modification d'une donnée de contact (son téléphone, par exemple).

Ce qui est **bloqué à l'envoi** même sans modification : un destinataire apparu dans le segment après l'approbation. Il est « hors du périmètre approuvé ».

## 3. Les 9 règles vérifiées avant chaque envoi (`C.preSendCheck`)

| # | Règle | En cas d'échec |
|---|---|---|
| 0 | Pas de suspension globale | Mise en attente |
| 1 | Campagne autorisée, en cours, non expirée | Attente (suspendue, à valider) ou blocage (expirée) |
| 2 | Destinataire dans le périmètre approuvé | Blocage et notification |
| 3 | Modèle identique à la version approuvée | Blocage et notification |
| 4 | Pas de réponse qui arrête les relances | Blocage (motif « a répondu ») |
| 5 | Pas d'opposition ni d'exclusion (contact, adresse, canal) | Blocage |
| 6 | Canal connecté et adresse valide | Attente du canal (reprise automatique) ou blocage (adresse) |
| 7 | Horaires et plafonds : boîte par jour, campagne par jour et par semaine, destinataire par semaine | **Report** à la prochaine fenêtre autorisée |
| 8 | Variables obligatoires renseignées | Blocage et notification |
| 9 | Pas déjà envoyé pour ce même événement (clé d'idempotence `campagne|étape|contact`) | Blocage « doublon » |

Chaque échec enregistre le motif sur l'élément de file et dans le journal. Le responsable est notifié si une action humaine est nécessaire. En base, les règles 0, 1, 2, 3, 5 et 7 sont **doublées par un déclencheur** (`send_queue_chk`).

## 4. Gestion des réponses (`C.classify`, `C.receiveReply`)

| Classement | Exemples reconnus | Effet |
|---|---|---|
| Opposition | « désinscrivez-moi », « stop », « ne plus me contacter », « retirez mon adresse » | Exclusion sur tous les canaux. **Annulation immédiate de tous les envois planifiés** du contact, toutes campagnes confondues. Notification |
| Absence | « absent », « en congé », « de retour le 04/11 » | Séquence reportée au lendemain de la date de retour lue (+7 jours à défaut) |
| Négative | « pas intéressé », « non merci » | Relances arrêtées, contact « pas intéressé » |
| Positive | « rendez-vous », « intéressé », « appelez-moi », « devis » | Relances arrêtées, **tâche pour le responsable du contact**, opportunité passée à « Échange engagé », alerte prioritaire |
| Question | Tout autre texte | Comme une réponse positive (traitement humain) |

En production, le classement par règles est complété par l'IA. **Toute incertitude est traitée comme une question, donc par un humain.**

## 5. Plafonds

Les plafonds se déclinent par boîte, par campagne (jour et semaine) et par destinataire (semaine). Le paramétrage refuse :

- un plafond de boîte au-delà de la limite du fournisseur ;
- un plafond de campagne au-delà de celui de la boîte ;
- un plafond hebdomadaire inférieur au plafond journalier.

Une campagne ne peut pas dépasser les plafonds de la direction. Au-delà d'un plafond, les envois sont **reportés**, jamais perdus et jamais envoyés en excès.

## 6. Sécurité opérationnelle

- **File d'attente** : une ligne par envoi, avec date d'échéance, statut, tentatives et motif.
- **Clés d'idempotence** : une notification ou un traitement rejoué ne produit jamais un second envoi.
- **Tentatives limitées** : 3 au plus, espacées de 30, puis 60 minutes, et uniquement pour les erreurs temporaires. Une adresse inexistante entraîne un échec définitif et l'adresse est marquée invalide.
- **Arrêt automatique** si le taux de rejet dépasse le seuil de la campagne (au moins 10 envois).
- **Arrêt d'urgence** d'une campagne et **suspension globale** des envois sortants : plus aucune nouvelle exécution. Les messages déjà remis au fournisseur ne peuvent pas toujours être rappelés.
- **Reprise contrôlée** : seule la direction reprend une campagne suspendue. Si la campagne a été modifiée entre-temps, la reprise exige une nouvelle validation.
- **Mode de démonstration** : une horloge de moteur (`C.now`, `C.tick`) permet de faire avancer le temps. En production, un ordonnanceur traite la file toutes les minutes avec un verrou par organisation.

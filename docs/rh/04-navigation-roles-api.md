# 04 · Navigation, rôles et API

## 1. Navigation en accordéon

La navigation (`App.NAV2` dans `app/src/ui/app.js`) s'organise en trois niveaux : sections → modules → sous-onglets.

- **Module.** Une icône, un libellé et un chevron. Un clic ouvre ou ferme le module, et l'état est mémorisé par navigateur. Le module de la page active s'ouvre automatiquement.
- **Sous-onglet.** Il mène à une page et éventuellement à un onglet. L'onglet actif est souligné à gauche, comme sur la maquette fournie.
- **Badges.** Les éléments à traiter s'affichent sur le sous-onglet, et sur le module quand il est fermé.
- **Droits.** Un module, ou un sous-onglet, ne s'affiche qu'avec son droit (`right`). Une page sans droit redirige vers la première page autorisée (`App.canPage`, `App.firstPage`).
- **Téléphone.** Le menu est replié derrière un bouton « Menu ».

## 2. Rôles et droits ajoutés

| Droit | Salarié | Manager (N+1) | Gestionnaire | DRH | DAF | Propriétaire |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| `self` (Mon espace) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `abs.request` | ✓ | ✓ | ✓ | ✓ | ✓ | |
| `abs.read` (planning du périmètre) | | ✓ | ✓ | ✓ | ✓ | ✓ |
| `abs.approve` (N+1) | | ✓ | | ✓ | ✓ | |
| `abs.manage` (saisir, notifier) | | | ✓ | | | ✓ |
| `abs.hr` (validation DRH) | | | | ✓ | | |
| `abs.settings` | | | ✓ | ✓ | | ✓ |
| `gta.read` | | ✓ | ✓ | ✓ | ✓ | ✓ |
| `gta.validate` (pointages, feuilles) | | ✓ | | ✓ | ✓ | |
| `gta.track` / `gta.mission` | | ✓ | ✓ | ✓ | ✓ | ✓ |
| `gta.manage` (sites, appareils, règles) | | | ✓ | ✓ | | ✓ |
| `gta.export` (vers la paie) | | | ✓ | | | ✓ |
| `stock` / `stock.count` | | | | | ✓ | ✓ (et comptable) |

**Périmètre.** Un N+1 ne voit que les services dont il est le valideur (`A.scope`). Un salarié ne voit que lui-même. Le lien entre un compte utilisateur et un dossier salarié se fait par `user.employee[companyId] = matricule`. La matrice complète est dans `docs/matrice-des-droits.csv`.

## 3. API REST cible

**GTA** : `https://api.myyiel.com/gta/v1/companies/{id}`

| Méthode | Route | Moteur |
|---|---|---|
| POST | `/punch-links` | `G.issueLink` + envoi WhatsApp Business |
| POST | `/punches` (public, par jeton) | `G.punch` : le serveur calcule le score, jamais le téléphone |
| PATCH | `/punches/{id}` (valider / rejeter) | `G.review` |
| POST | `/punches/manual` | `G.manualPunch` |
| POST | `/controls` | `G.planControls` |
| GET | `/presence?date=` | `G.today` |
| POST | `/missions` · `/missions/{id}/start` · `/arrive` · `/end` | `G.createMission`, `startMission`, `confirmArrival`, `endMission` |
| POST | `/missions/{id}/positions` | `G.track` (refusé hors mission) |
| GET | `/timesheets/{AAAA-MM}` · POST `/timesheets/{AAAA-MM}/{emp}/validate` | `G.sheet`, `G.validateSheet` |
| POST | `/timesheets/{AAAA-MM}/export` | `G.payExport` → `/paie/v1/periods/{AAAA-MM}/time-events` |

**Absences** : `/absences/v1/companies/{id}`

| Méthode | Route | Moteur |
|---|---|---|
| POST | `/requests` | `A.request` |
| POST | `/requests/{id}/approve` · `/refuse` · `/notify` · `/cancel` | `A.decide`, `A.cancel` |
| GET | `/balances/{emp}` | `A.balances` |
| GET | `/planning?from=&to=&service=` | `A.cells` |
| CRUD | `/types`, `/holidays`, `/managers`, `/delegations` | — |

**Stocks** : `/stock/v1/companies/{id}`

| Méthode | Route | Moteur |
|---|---|---|
| CRUD | `/articles`, `/warehouses` | `K.saveArticle`, `K.saveWarehouse` |
| POST | `/moves` | `K.addMove` |
| POST | `/counts` · `/counts/{id}/lines` · `/close` · `/validate` | `K.openCount`, `K.setCounted`, `K.closeCount`, `K.validateCount` |
| GET | `/valuation?date=` | `K.valuation` |
| POST | `/variation` · `/depreciation` | `K.postVariation`, `K.postDeprec` |

## 4. Webhooks

| Événement | Contenu |
|---|---|
| `presence.punched` | Nouveau pointage |
| `presence.missing` | Salarié attendu non pointé |
| `control.unanswered` | Contrôle sans réponse |
| `mission.started`, `mission.arrived`, `mission.ended`, `mission.alert` | Cycle de la mission et alertes |
| `timesheet.validated` | Feuille validée par le N+1 |
| `absence.requested`, `absence.decided` | Demande déposée, puis décidée |
| `stock.below_threshold` | Article sous le seuil |
| `stock.count_validated` | Inventaire validé |

Ils permettent à un ERP, un logiciel de planning ou le logiciel métier d'un client de créer des missions et de recevoir les heures.

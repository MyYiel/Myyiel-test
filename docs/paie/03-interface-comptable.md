# 03 · Interfaces : paie → comptabilité, GTA → paie

## 1. Format `myyiel.journal-batch/1`

C’est le **contrat unique** entre un module métier et la comptabilité. La paie l’utilise aujourd’hui ; les notes de frais, les stocks et la GTA pourront l’utiliser demain. Schéma : [`journal-batch.schema.json`](journal-batch.schema.json). Exemple réel : [`exemple-journal-batch.json`](exemple-journal-batch.json).

```json
{
  "format": "myyiel.journal-batch/1",
  "company": "co_…",
  "source": { "module": "paie", "ref": "PAIE-2026-09", "period": "2026-09", "generatedAt": "…" },
  "label": "Paie de septembre 2026",
  "entries": [{
    "journal": "PAIE", "kind": "payroll", "date": "2026-09-30", "ref": "PAIE-2026-09",
    "label": "Paie septembre 2026 · 18 salarié(s)",
    "lines": [
      { "account": "661", "label": "Rémunérations du personnel", "debit": 3410000, "credit": 0, "section": "CNS" },
      { "account": "422", "label": "Net à payer · TCHOUMI Paul-Henri", "debit": 0, "credit": 1438943,
        "tiers": { "code": "YG0001", "name": "TCHOUMI Paul-Henri", "type": "personnel", "collective": "422" } }
    ]
  }],
  "totals": { "debit": 14339930, "credit": 14339930, "lines": 36 },
  "checksum": "ec1d8f36"
}
```

### Règles d’intégration (`Y.acceptBatch`)

L’intégration est **tout ou rien** : la moindre erreur rejette le lot entier et le journal des interfaces trace le rejet avec ses motifs.

1. **Forme.** Le format est reconnu, la source (module et ref) est présente, chaque écriture a au moins deux lignes, une date ISO et des montants **entiers** (XAF).
2. **Équilibre.** Chaque écriture est équilibrée et les totaux du lot correspondent aux lignes.
3. **Empreinte.** `checksum` est le FNV-1a 32 bits de la chaîne canonique `module|ref|journal|date|ref|compte:débit:crédit:tiers,…;…`. Un lot altéré en transit est refusé.
4. **Idempotence.** Un `source.ref` déjà intégré est refusé : un double clic ou un rejeu ne crée pas de doublon.
5. **Comptabilité.** Les comptes doivent exister et être imputables, les périodes ouvertes et les journaux connus. Ce sont les mêmes contrôles que la saisie manuelle (`Y.checkEntry`).
6. **Tiers.** Un tiers personnel absent (code = matricule, collectif 422) est créé automatiquement, puis supprimé si le lot est rejeté.
7. Les écritures sont **validées** (numérotées et intangibles), puis l’audit chaîné enregistre l’intégration.

## 2. Schéma d’écritures de paie (configurable)

Le schéma se configure dans **Paramétrage › Schéma comptable** (`d.paie.accounts`). Les écritures sont ventilées par section analytique du salarié.

| Écriture | Débit | Crédit |
|---|---|---|
| Salaires, congés, primes | 661 (662 pour les expatriés) | 422 net par salarié (tiers = matricule) |
| Indemnités, sorties | 663 | 422 |
| Cotisations CNPS salariales | (dans 661 / 663) | 431 |
| Cotisations CNPS patronales | 664 | 431 |
| CFC et FNE patronaux | 641 | 447 |
| IRPP, CAC, CFC salarial, RAV, TDL | (dans 661) | 447 |
| Avances et prêts retenus | | 421 |
| Retenues diverses (syndicat, mutuelle) | | 428 |

Les avantages en nature entrent dans l’assiette sans flux de trésorerie : ils sont débités en 661 et repris en déduction, donc neutres sur le 422.

| Flux associé | Écriture | Déclencheur |
|---|---|---|
| Versement d’une avance | 421 / 5211 ou 5521 | `advanceAction('verser')` |
| Décaissement d’un prêt | 421 / 5211 | `createLoan` |
| Exécution d’un ordre de virement | 422 (par salarié) / 5211, 5521 ou 5711 selon le mode, puis **lettrage automatique du 422** | `orderAction('executer')` |
| Paiement CNPS, DGI ou commune | 431 ou 447 / 5211 | `declAction('payer')` |

**Contrôle de bouclage**, vérifié par les tests et le parcours e2e : après paiement des salaires, le solde du 422 est nul. Après paiement des déclarations, le 431 et le 447 de la période sont soldés.

## 3. Moment de la transmission

- Le lot est **construit et intégré automatiquement à la validation DRH** (`P.approve` → `P.transmit`).
- En cas d’échec (période comptable clôturée, compte supprimé…), la paie reste validée avec le statut « transmission en erreur ». Le DAF corrige, puis relance la transmission depuis l’espace DAF.
- Le lot peut aussi être **téléchargé** (bouton « Lot JSON ») pour un logiciel comptable tiers.
- La télétransmission CNPS et DGI n’est possible **qu’une fois le lot intégré** (RG-P30), après vérification par le DAF.

## 4. Format `myyiel.time-events/1` (GTA → paie)

Schéma : [`time-events.schema.json`](time-events.schema.json).

```json
{ "format": "myyiel.time-events/1", "period": "2026-10",
  "events": [
    { "id": "badge-88412", "matricule": "YG0010", "date": "2026-10-07", "type": "HS1", "quantite": 4, "commentaire": "Mise en production" },
    { "matricule": "YG0008", "date": "2026-10-16", "type": "ABS_NP", "quantite": 1 }
  ] }
```

| Type | Unité | Effet paie |
|---|---|---|
| `HS1` `HS2` `HS3` `HSN` | heures | Variables d’heures supplémentaires |
| `ABS_NP` | jours | Retenue au 1/30 |
| `CONGE` | jours | Allocation de congés au salaire journalier moyen, décompte du solde |
| `ABS_MAL` `ABS_AUT` `RETARD` | jours / minutes | Information (contrôles, statistiques), sans effet sur le montant |

**Comportement à l’import.**
- Les événements sont contrôlés : matricule connu, date dans la période, type valide, quantité positive.
- Ils sont **agrégés** en variables d’origine `GTA`. Un réimport remplace les variables GTA précédentes sans toucher aux saisies manuelles.
- La période repasse au statut « préparation » et doit être recalculée.

**Pourquoi le module GTA s’ajoutera sans refonte.** La paie ne lit que des événements normalisés. Le futur module (planning, badgeuse, géolocalisation mobile) n’aura qu’à les produire, en fichier ou par appel d’API `POST /paie/periods/{key}/time-events` (voir `07`).

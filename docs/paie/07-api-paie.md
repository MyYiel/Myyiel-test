# 07 · API REST paie (cible)

Les conventions sont les mêmes que l’API comptable (`docs/05-api-openapi.yaml`). Base URL : `https://api.myyiel.com/paie/v1/companies/{companyId}`.

- **Contexte.** L’API vérifie l’appartenance de l’utilisateur à la société et positionne `app.company_id`. Elle positionne `app.pay_sensitive = 'on'` **uniquement** si l’utilisateur a le droit `pay.sensitive` : la RLS masque alors ou expose les données sensibles.
- **Montants** en entiers XAF.
- **`Idempotency-Key`** obligatoire sur les POST.
- **Erreurs métier** : HTTP 422 avec les règles violées (`RG-P…`) ou les anomalies (`B0x`).
- **Droits** : indiqués dans la colonne *Droit*. La colonne *Moteur* donne la fonction équivalente de `Yiel.Paie` dans la maquette, qui sert de spécification exécutable.

## Référentiel salariés

| Méthode | Route | Droit | Moteur |
|---|---|---|---|
| GET | `/employees?status=actif&establishment=DLA&q=` | pay.read (champs sensibles si pay.sensitive) | `P.D().employees` |
| GET | `/employees/{id}` | pay.read | `P.emp` |
| POST | `/employees` | pay.prepare | `P.saveEmployee` |
| PATCH | `/employees/{id}` | pay.prepare | `P.saveEmployee` (historique par champ) |
| GET | `/employees/{id}/history` | pay.read | `employee.history` |
| POST | `/employees/import/analyze` (multipart xlsx ou csv, mapping optionnel) | pay.prepare | `P.mapEmployeeColumns`, `P.analyzeEmployeeImport` : **aucune écriture** |
| POST | `/employees/import/{analysisId}/commit` `{updateExisting}` | pay.prepare | `P.importEmployees` |
| GET | `/employees/import/template.xlsx` | pay.read | `P.employeeTemplate` |
| GET | `/employees/{id}/exit-preview?date=&reason=` | pay.prepare | `P.exitPreview` |
| POST | `/employees/{id}/exit` | pay.prepare | `P.registerExit` |
| GET | `/employees/{id}/documents/{certificat\|attestation}.pdf` | pay.read | `emp-cert` |

## Périodes, variables, calcul

| Méthode | Route | Droit | Moteur |
|---|---|---|---|
| GET | `/periods` · `/periods/{key}` (AAAA-MM) | pay.read | `P.period` |
| POST | `/periods/{key}/variables` `{employeeId, code, qty?, amount?, comment}` | pay.prepare | `P.addVar` |
| DELETE | `/periods/{key}/variables/{varId}` | pay.prepare | `P.delVar` |
| POST | `/periods/{key}/time-events` (`myyiel.time-events/1`) | pay.prepare | `P.importTimeEvents` |
| POST | `/periods/{key}/calculate` | pay.prepare | `P.calculate` → bulletins et anomalies |
| GET | `/periods/{key}/anomalies` | pay.read | `P.check` |
| GET | `/periods/{key}/payslips` · `/payslips/{employeeId}` | pay.read | `P.computeSlip` (gelé si validé) |
| GET | `/periods/{key}/payslips/{employeeId}.pdf?lang=fr\|en` | pay.read | `App.slipPdfPage` |
| POST | `/periods/{key}/submit` | pay.validate | `P.submit` |
| POST | `/periods/{key}/approve` `{comment}` | pay.approve | `P.approve` → gel et lot comptable |
| POST | `/periods/{key}/reject` `{comment}` | pay.approve | `P.reject` |
| POST | `/periods/{key}/transmit` | pay.post | `P.transmit` (relance après erreur) |
| GET | `/periods/{key}/journal-batch` | pay.read | `P.buildPayrollBatch` |
| POST | `/periods/{key}/close` | pay.post | `P.close` |
| GET | `/periods/{key}/recalc-check` | pay.read | `P.recalcCheck` (sans écraser) |
| POST | `/periods/{key}/regularize` `{fromKey}` | pay.prepare | `P.applyRegul` → rappels sur la période ouverte |

## Signature et diffusion

| Méthode | Route | Droit | Moteur |
|---|---|---|---|
| PUT | `/signature` (signature PNG, cachet PNG détouré, nom, titre) | pay.sign | `P.setSignature` |
| POST | `/periods/{key}/sign` `{employeeIds?}` → `{signed, skipped, altered}` | pay.sign | `P.signSlips` |
| POST | `/periods/{key}/payslips/{employeeId}/send` `{channel: email\|whatsapp}` | pay.prepare | `P.markSent`, puis passerelle d’envoi |

## Virements

| Méthode | Route | Droit | Moteur |
|---|---|---|---|
| GET | `/periods/{key}/payment-items` | pay.read | `P.paymentItems` |
| POST | `/transfer-orders` `{key, advisorId, motif, comment, valueDate, confidentiality}` | pay.bank | `P.createOrder` |
| POST | `/transfer-orders/{id}/{soumettre\|valider\|rejeter\|envoyer\|executer}` | pay.bank / pay.approve | `P.orderAction` |
| GET | `/transfer-orders/{id}/letter.pdf` · `/files/{virement\|momo}.csv` | pay.bank | `App.orderPdf`, `P.orderFiles` |
| CRUD | `/bank-advisors` | pay.bank | `d.paie.advisors` |

## Déclarations

| Méthode | Route | Droit | Moteur |
|---|---|---|---|
| GET | `/periods/{key}/declarations` | pay.read | `P.declarations` |
| POST | `/periods/{key}/declarations/{CNPS\|DGI\|COMMUNE}/{teletransmettre\|payer}` | pay.declare | `P.declAction` (RG-P30) |
| GET | `/periods/{key}/dipe.xlsx` · `/years/{year}/etat-annuel.xlsx` | pay.read | `P.dipeRows`, `dc-annual` |

## Avances et prêts

| Méthode | Route | Droit | Moteur |
|---|---|---|---|
| POST | `/advances` `{employeeId, amount, reason}` | pay.prepare | `P.requestAdvance` (date limite, plafond) |
| POST | `/advances/{id}/{approuver\|refuser\|verser}` | pay.approve / pay.bank | `P.advanceAction` |
| POST | `/loans` | pay.approve | `P.createLoan` |

## Paramétrage

| Méthode | Route | Droit | Moteur |
|---|---|---|---|
| GET | `/rules?date=` | pay.read | `P.rules` |
| POST | `/rules/{param\|bareme}/{code}/versions` `{from, value\|rows, reason, retro?}` | pay.settings | `P.addVersion` |
| CRUD | `/rubrics` (avec `POST /rubrics/check-formula`) | pay.settings | `d.paie.rubriques`, `P.checkFormula` |
| CRUD | `/conventions`, `/establishments` | pay.settings | |
| PUT | `/account-mapping` | pay.settings | `d.paie.accounts` |
| PUT | `/settings` (jour de paie, date limite des avances, confidentialité, notifications) | pay.settings | `d.paie.settings` |
| POST | `/simulate` `{gross\|net, employeeId?, …}` | pay.read | `P.simulate`, `P.netToGross` |
| GET | `/notifications` | pay.read | `P.notifications` (filtrées par rôle) |

## Comptabilité (côté réception)

| Méthode | Route | Droit | Moteur |
|---|---|---|---|
| POST | `/compta/v1/companies/{id}/journal-batches` (`myyiel.journal-batch/1`) | `post` (service paie) | `Y.acceptBatch` : 201 intégré, 409 déjà intégré, 422 rejeté avec motifs |
| GET | `/compta/v1/companies/{id}/journal-batches?module=paie` | read | `d.interfaceLog` |

## Yiélina (assistante)

Dans la maquette, l’assistante appelle Claude depuis le navigateur. Les outils exposés au modèle sont des fonctions locales en lecture, ou en écriture **après confirmation explicite** :
- `lister_anomalies`, `chercher_salarie`, `resume_paie`, `expliquer_bulletin`, `echeances` : lecture ;
- `simuler` : calcul sans enregistrement ;
- `ajouter_variable` : écriture, après confirmation ;
- `ouvrir_ecran` : navigation.

En production, prévoir une route `POST /assistant/messages`. Le serveur exécute les outils **avec les droits de l’utilisateur** et ne transmet au modèle que des données déjà filtrées par la RLS.

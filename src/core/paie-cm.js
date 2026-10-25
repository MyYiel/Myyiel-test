/*
 * myyiel Paie · pack réglementaire CAMEROUN (données, aucune logique).
 * Les taux, plafonds et barèmes sont DATÉS et VERSIONNÉS : le moteur prend la version en vigueur
 * au dernier jour de la période de paie. Toute nouvelle version est saisie dans Paramétrage › Réglementation
 * (date d'effet, valeur, motif) et tracée dans la piste d'audit. Aucun taux n'est écrit dans le moteur.
 * ⚠ Valeurs par défaut à faire valider par un expert-comptable / conseiller social (docs/paie/09-points-a-valider.md).
 */
import { Y } from './registry.js';

Y.PAIE_PACKS = Y.PAIE_PACKS || {};
var SYS = 'Pack réglementaire myyiel';
function v(from, value, ref, check) { return { from: from, value: value, ref: ref || '', by: SYS, at: '2026-01-01T00:00:00.000Z', note: check ? 'À valider' : '' }; }

Y.PAIE_PACKS.CM = {
  country: 'CM', label: 'Cameroun', currency: 'XAF', version: '2026.10',
  params: [
    { code: 'SMIG', label: 'Salaire minimum interprofessionnel garanti (mensuel)', unit: 'XAF', group: 'Salaire minimum', versions: [v('2014-07-01', 36270, 'Décret 2014/2217/PM'), v('2023-03-21', 41875, 'Décret 2023/00338/PM'), v('2024-02-23', 43969, 'Décret 2024/0168/PM')] },
    { code: 'HEURES_MOIS', label: 'Durée mensuelle de référence (40 h × 52 / 12)', unit: 'h', group: 'Temps de travail', versions: [v('1992-08-14', 173.33, 'Code du travail, art. 80 (40 h/semaine)')] },
    { code: 'DIVISEUR_JOURS', label: 'Diviseur journalier (prorata, absences)', unit: 'j', group: 'Temps de travail', versions: [v('2000-01-01', 30, 'Usage (mois de 30 jours)', true)] },
    { code: 'HS_MAJ1', label: 'Heures sup. : majoration de la 1re à la 8e heure', unit: '%', group: 'Heures supplémentaires', versions: [v('1995-01-01', 20, 'Décret 95/677/PM', true)] },
    { code: 'HS_MAJ2', label: 'Heures sup. : majoration de la 9e à la 16e heure', unit: '%', group: 'Heures supplémentaires', versions: [v('1995-01-01', 30, 'Décret 95/677/PM', true)] },
    { code: 'HS_MAJ3', label: 'Heures sup. : au-delà de la 16e heure', unit: '%', group: 'Heures supplémentaires', versions: [v('1995-01-01', 40, 'Décret 95/677/PM', true)] },
    { code: 'HS_MAJ_NUIT', label: 'Heures de nuit, dimanches et jours fériés', unit: '%', group: 'Heures supplémentaires', versions: [v('1995-01-01', 50, 'Décret 95/677/PM', true)] },
    { code: 'HS_MAX_MOIS', label: 'Plafond d’alerte d’heures supplémentaires par mois', unit: 'h', group: 'Heures supplémentaires', versions: [v('2000-01-01', 40, 'Paramètre de contrôle', true)] },
    { code: 'CNPS_PLAFOND', label: 'Plafond mensuel des cotisations CNPS (pension, prestations familiales)', unit: 'XAF', group: 'CNPS', versions: [v('2016-01-01', 750000, 'Loi 2016 · CNPS')] },
    { code: 'PVID_SAL', label: 'Pension vieillesse, invalidité, décès · part salariale', unit: '%', group: 'CNPS', versions: [v('2016-01-01', 4.2, 'CNPS')] },
    { code: 'PVID_PAT', label: 'Pension vieillesse, invalidité, décès · part patronale', unit: '%', group: 'CNPS', versions: [v('2016-01-01', 4.2, 'CNPS')] },
    { code: 'PF_PAT', label: 'Prestations familiales · régime général (employeur)', unit: '%', group: 'CNPS', versions: [v('2016-01-01', 7, 'CNPS')] },
    { code: 'AT_PAT_A', label: 'Accidents du travail · groupe A (risque faible)', unit: '%', group: 'CNPS', versions: [v('2016-01-01', 1.75, 'CNPS')] },
    { code: 'AT_PAT_B', label: 'Accidents du travail · groupe B (risque moyen)', unit: '%', group: 'CNPS', versions: [v('2016-01-01', 2.5, 'CNPS')] },
    { code: 'AT_PAT_C', label: 'Accidents du travail · groupe C (risque élevé)', unit: '%', group: 'CNPS', versions: [v('2016-01-01', 5, 'CNPS')] },
    { code: 'CFC_SAL', label: 'Crédit foncier · part salariale', unit: '%', group: 'Taxes sur salaires', versions: [v('2000-01-01', 1, 'CGI', true)] },
    { code: 'CFC_PAT', label: 'Crédit foncier · part patronale', unit: '%', group: 'Taxes sur salaires', versions: [v('2000-01-01', 1.5, 'CGI', true)] },
    { code: 'FNE_PAT', label: 'Fonds national de l’emploi · employeur', unit: '%', group: 'Taxes sur salaires', versions: [v('2000-01-01', 1, 'CGI', true)] },
    { code: 'ABATT_FP', label: 'IRPP : abattement forfaitaire pour frais professionnels', unit: '%', group: 'IRPP', versions: [v('2000-01-01', 30, 'CGI · impots.cm')] },
    { code: 'ABATT_IRPP_AN', label: 'IRPP : abattement annuel', unit: 'XAF', group: 'IRPP', versions: [v('2000-01-01', 500000, 'CGI · impots.cm')] },
    { code: 'IRPP_SEUIL', label: 'IRPP : pas de retenue en dessous de ce salaire mensuel', unit: 'XAF', group: 'IRPP', versions: [v('2000-01-01', 62000, 'impots.cm')] },
    { code: 'CAC_TAUX', label: 'Centimes additionnels communaux sur IRPP', unit: '%', group: 'IRPP', versions: [v('2000-01-01', 10, 'CGI')] },
    { code: 'AN_LOGEMENT', label: 'Avantage en nature · logement (% du salaire taxable)', unit: '%', group: 'Avantages en nature', versions: [v('2000-01-01', 15, 'CGI', true)] },
    { code: 'AN_ELEC', label: 'Avantage en nature · électricité', unit: '%', group: 'Avantages en nature', versions: [v('2000-01-01', 4, 'CGI', true)] },
    { code: 'AN_EAU', label: 'Avantage en nature · eau', unit: '%', group: 'Avantages en nature', versions: [v('2000-01-01', 2, 'CGI', true)] },
    { code: 'AN_DOMESTIQUE', label: 'Avantage en nature · domestique (par domestique)', unit: '%', group: 'Avantages en nature', versions: [v('2000-01-01', 5, 'CGI', true)] },
    { code: 'AN_VEHICULE', label: 'Avantage en nature · véhicule', unit: '%', group: 'Avantages en nature', versions: [v('2000-01-01', 10, 'CGI', true)] },
    { code: 'AN_NOURRITURE', label: 'Avantage en nature · nourriture', unit: '%', group: 'Avantages en nature', versions: [v('2000-01-01', 10, 'CGI', true)] },
    { code: 'CONGES_JOURS_MOIS', label: 'Congés acquis par mois de service effectif', unit: 'j', group: 'Congés', versions: [v('1992-08-14', 1.5, 'Code du travail, art. 89')] },
    { code: 'CONGES_MAJ_5ANS', label: 'Majoration de congés par période de 5 ans d’ancienneté (jours/an)', unit: 'j', group: 'Congés', versions: [v('1992-08-14', 2, 'Code du travail, art. 89', true)] },
    { code: 'AVANCE_PLAFOND', label: 'Avance sur salaire : plafond en % du salaire de base', unit: '%', group: 'Avances', versions: [v('2020-01-01', 50, 'Politique interne', true)] },
    { code: 'QUOTITE_RETENUES', label: 'Retenues diverses (avances, prêts) : alerte au-delà de % du net', unit: '%', group: 'Avances', versions: [v('2020-01-01', 50, 'Paramètre de contrôle', true)] }
  ],
  baremes: [
    { code: 'IRPP', label: 'IRPP · barème annuel progressif (sur revenu net imposable annuel)', kind: 'progressif', unit: '%', versions: [{ from: '2000-01-01', ref: 'CGI · impots.cm', by: SYS, at: '2026-01-01T00:00:00.000Z', rows: [[2000000, 10], [3000000, 15], [5000000, 25], [null, 35]] }] },
    { code: 'RAV', label: 'Redevance audiovisuelle (CRTV) · montant mensuel selon le salaire brut taxable', kind: 'forfait', unit: 'XAF', check: true, versions: [{ from: '2000-01-01', ref: 'CGI', by: SYS, at: '2026-01-01T00:00:00.000Z', note: 'À valider', rows: [[50000, 0], [100000, 750], [200000, 1950], [300000, 3250], [400000, 4550], [500000, 5850], [600000, 7150], [700000, 8450], [800000, 9750], [900000, 11050], [1000000, 12350], [null, 13000]] }] },
    { code: 'TDL', label: 'Taxe de développement local · montant mensuel selon le salaire de base', kind: 'forfait', unit: 'XAF', check: true, versions: [{ from: '2000-01-01', ref: 'Loi sur la fiscalité locale', by: SYS, at: '2026-01-01T00:00:00.000Z', note: 'À valider', rows: [[62000, 0], [75000, 250], [100000, 500], [125000, 750], [150000, 1000], [200000, 1250], [250000, 1500], [300000, 2000], [500000, 2250], [null, 2500]] }] },
    { code: 'ANC_STD', label: 'Prime d’ancienneté · barème standard (% du salaire de base selon les années)', kind: 'forfait', unit: '%', check: true, versions: [{ from: '2000-01-01', ref: 'Modèle à remplacer par la convention', by: SYS, at: '2026-01-01T00:00:00.000Z', note: 'À valider', rows: [[2, 0], [3, 4], [5, 6], [7, 8], [10, 10], [15, 14], [20, 18], [null, 22]] }] },
    { code: 'LIC_STD', label: 'Indemnité de licenciement · % du salaire mensuel moyen par année d’ancienneté', kind: 'progressif', unit: '%', check: true, versions: [{ from: '2000-01-01', ref: 'Modèle à remplacer par la convention', by: SYS, at: '2026-01-01T00:00:00.000Z', note: 'À valider', rows: [[5, 20], [10, 25], [15, 30], [null, 35]] }] }
  ],

  /* Rubriques : formules en langage d'expression myyiel (docs/paie/03-moteur-et-formules.md).
     base, qty, rate, amount : expressions ; amount par défaut = BASE × QTE × TAUX / 100 (termes absents ignorés).
     kind : gain | nature | cotisation | impot | retenue. taxable : entre dans le brut taxable (IRPP, CFC, RAV) ; cnps : entre dans l'assiette CNPS. */
  rubriques: [
    { code: 'SB', order: 100, label: 'Salaire de base', labelEn: 'Basic salary', kind: 'gain', base: 'SB', qty: 'JOURS_PAYES', amount: 'arrondi(SB * PRORATA)', taxable: true, cnps: true, source: 'contrat', acc: 'salaire' },
    { code: 'ABS_NP', order: 110, label: 'Absence non rémunérée', labelEn: 'Unpaid absence', kind: 'gain', cond: 'var("ABS_NP") > 0', base: 'SB / param("DIVISEUR_JOURS")', qty: 'var("ABS_NP")', amount: '-arrondi(BASE * QTE)', taxable: true, cnps: true, source: 'variable', unit: 'j', acc: 'salaire' },
    { code: 'ANC', order: 120, label: 'Prime d’ancienneté', labelEn: 'Seniority bonus', kind: 'gain', cond: 'TAUX_ANC > 0', base: 'arrondi(SB * PRORATA)', rate: 'TAUX_ANC', taxable: true, cnps: true, source: 'auto', acc: 'salaire' },
    { code: 'HS1', order: 130, label: 'Heures sup. majorées 20 %', labelEn: 'Overtime +20%', kind: 'gain', cond: 'var("HS1") > 0', base: 'TH', qty: 'var("HS1")', rate: '100 + param("HS_MAJ1")', taxable: true, cnps: true, source: 'variable', unit: 'h', acc: 'salaire' },
    { code: 'HS2', order: 131, label: 'Heures sup. majorées 30 %', labelEn: 'Overtime +30%', kind: 'gain', cond: 'var("HS2") > 0', base: 'TH', qty: 'var("HS2")', rate: '100 + param("HS_MAJ2")', taxable: true, cnps: true, source: 'variable', unit: 'h', acc: 'salaire' },
    { code: 'HS3', order: 132, label: 'Heures sup. majorées 40 %', labelEn: 'Overtime +40%', kind: 'gain', cond: 'var("HS3") > 0', base: 'TH', qty: 'var("HS3")', rate: '100 + param("HS_MAJ3")', taxable: true, cnps: true, source: 'variable', unit: 'h', acc: 'salaire' },
    { code: 'HSN', order: 133, label: 'Heures de nuit, dimanche et fériés (50 %)', labelEn: 'Night / Sunday / holiday hours', kind: 'gain', cond: 'var("HSN") > 0', base: 'TH', qty: 'var("HSN")', rate: '100 + param("HS_MAJ_NUIT")', taxable: true, cnps: true, source: 'variable', unit: 'h', acc: 'salaire' },
    { code: 'PRIME_RESP', order: 140, label: 'Prime de responsabilité', labelEn: 'Responsibility allowance', kind: 'gain', cond: 'fixe("PRIME_RESP") > 0', amount: 'arrondi(fixe("PRIME_RESP") * PRORATA)', taxable: true, cnps: true, source: 'fixe', acc: 'salaire' },
    { code: 'PRIME_REND', order: 141, label: 'Prime de rendement', labelEn: 'Performance bonus', kind: 'gain', cond: 'mt("PRIME_REND") != 0', amount: 'mt("PRIME_REND")', taxable: true, cnps: true, source: 'variable', acc: 'salaire' },
    { code: 'PRIME_EXC', order: 142, label: 'Prime exceptionnelle / gratification', labelEn: 'Exceptional bonus', kind: 'gain', cond: 'mt("PRIME_EXC") != 0', amount: 'mt("PRIME_EXC")', taxable: true, cnps: true, source: 'variable', acc: 'salaire' },
    { code: 'CONGE', order: 150, label: 'Allocation de congés payés', labelEn: 'Paid leave allowance', kind: 'gain', cond: 'var("CONGE") > 0', base: 'SALJ_MOY', qty: 'var("CONGE")', amount: 'arrondi(BASE * QTE)', taxable: true, cnps: true, source: 'variable', unit: 'j', acc: 'conges' },
    { code: 'IND_LOG', order: 160, label: 'Indemnité de logement', labelEn: 'Housing allowance', kind: 'gain', cond: 'fixe("IND_LOG") > 0', amount: 'arrondi(fixe("IND_LOG") * PRORATA)', taxable: true, cnps: true, source: 'fixe', acc: 'indemnite' },
    { code: 'IND_TRANSP', order: 161, label: 'Indemnité de transport', labelEn: 'Transport allowance', kind: 'gain', cond: 'fixe("IND_TRANSP") > 0', amount: 'arrondi(fixe("IND_TRANSP") * PRORATA)', taxable: false, cnps: false, source: 'fixe', acc: 'indemnite', check: true },
    { code: 'RAPPEL', order: 170, label: 'Rappel / régularisation', labelEn: 'Back pay / adjustment', kind: 'gain', cond: 'mt("RAPPEL") != 0', amount: 'mt("RAPPEL")', taxable: true, cnps: true, source: 'variable', acc: 'salaire' },
    { code: 'PREAVIS', order: 180, label: 'Indemnité compensatrice de préavis', labelEn: 'Payment in lieu of notice', kind: 'gain', cond: 'mt("PREAVIS") != 0', amount: 'mt("PREAVIS")', taxable: true, cnps: true, source: 'sortie', acc: 'sortie' },
    { code: 'ICCP', order: 181, label: 'Indemnité compensatrice de congés payés', labelEn: 'Accrued leave payment', kind: 'gain', cond: 'mt("ICCP") != 0', amount: 'mt("ICCP")', taxable: true, cnps: true, source: 'sortie', acc: 'sortie' },
    { code: 'IND_LIC', order: 182, label: 'Indemnité de licenciement', labelEn: 'Severance pay', kind: 'gain', cond: 'mt("IND_LIC") != 0', amount: 'mt("IND_LIC")', taxable: false, cnps: false, source: 'sortie', acc: 'sortie', check: true },
    { code: 'AN_LOG', order: 190, label: 'Avantage en nature · logement', labelEn: 'Benefit in kind · housing', kind: 'nature', cond: 'fixe("AN_LOG") > 0', base: 'BRUT_CASH_TAXABLE', rate: 'param("AN_LOGEMENT")', taxable: true, cnps: true, source: 'fixe' },
    { code: 'AN_VEH', order: 191, label: 'Avantage en nature · véhicule', labelEn: 'Benefit in kind · car', kind: 'nature', cond: 'fixe("AN_VEH") > 0', base: 'BRUT_CASH_TAXABLE', rate: 'param("AN_VEHICULE")', taxable: true, cnps: true, source: 'fixe' },
    { code: 'AN_ELEC', order: 192, label: 'Avantage en nature · électricité', labelEn: 'Benefit in kind · electricity', kind: 'nature', cond: 'fixe("AN_ELEC") > 0', base: 'BRUT_CASH_TAXABLE', rate: 'param("AN_ELEC")', taxable: true, cnps: true, source: 'fixe' },
    { code: 'AN_EAU', order: 193, label: 'Avantage en nature · eau', labelEn: 'Benefit in kind · water', kind: 'nature', cond: 'fixe("AN_EAU") > 0', base: 'BRUT_CASH_TAXABLE', rate: 'param("AN_EAU")', taxable: true, cnps: true, source: 'fixe' },
    { code: 'AN_NOUR', order: 194, label: 'Avantage en nature · nourriture', labelEn: 'Benefit in kind · food', kind: 'nature', cond: 'fixe("AN_NOUR") > 0', base: 'BRUT_CASH_TAXABLE', rate: 'param("AN_NOURRITURE")', taxable: true, cnps: true, source: 'fixe' },

    { code: 'PVID', order: 600, label: 'CNPS · pension vieillesse, invalidité, décès', labelEn: 'CNPS · old-age pension', kind: 'cotisation', base: 'min(BASE_CNPS, param("CNPS_PLAFOND"))', rate: 'param("PVID_SAL")', patRate: 'param("PVID_PAT")', org: 'CNPS', acc: 'cnps' },
    { code: 'PF', order: 610, label: 'CNPS · prestations familiales', labelEn: 'CNPS · family benefits', kind: 'cotisation', base: 'min(BASE_CNPS, param("CNPS_PLAFOND"))', patRate: 'param("PF_PAT")', org: 'CNPS', acc: 'cnps' },
    { code: 'AT', order: 620, label: 'CNPS · accidents du travail', labelEn: 'CNPS · work accidents', kind: 'cotisation', base: 'BASE_CNPS', patRate: 'TAUX_AT', org: 'CNPS', acc: 'cnps' },
    { code: 'CFC', order: 630, label: 'Crédit foncier du Cameroun', labelEn: 'Housing fund (CFC)', kind: 'cotisation', base: 'BRUT_TAXABLE', rate: 'param("CFC_SAL")', patRate: 'param("CFC_PAT")', org: 'DGI', acc: 'taxe' },
    { code: 'FNE', order: 640, label: 'Fonds national de l’emploi', labelEn: 'National employment fund', kind: 'cotisation', base: 'BRUT_TAXABLE', patRate: 'param("FNE_PAT")', org: 'DGI', acc: 'taxe' },
    { code: 'IRPP', order: 700, label: 'Impôt sur le revenu des personnes physiques', labelEn: 'Personal income tax', kind: 'impot',
      base: 'max(0, arrondi(BRUT_TAXABLE * (1 - param("ABATT_FP") / 100) - rub("PVID") - param("ABATT_IRPP_AN") / 12))',
      amount: 'si(BRUT_TAXABLE < param("IRPP_SEUIL"), 0, arrondi(bareme("IRPP", BASE * 12) / 12))', org: 'DGI', acc: 'impot' },
    { code: 'CAC', order: 710, label: 'Centimes additionnels communaux (10 % IRPP)', labelEn: 'Communal surcharge', kind: 'impot', cond: 'rub("IRPP") > 0', base: 'rub("IRPP")', rate: 'param("CAC_TAUX")', org: 'DGI', acc: 'impot' },
    { code: 'RAV', order: 720, label: 'Redevance audiovisuelle (CRTV)', labelEn: 'Broadcasting fee', kind: 'impot', base: 'BRUT_TAXABLE', amount: 'bareme("RAV", BASE)', org: 'DGI', acc: 'impot' },
    { code: 'TDL', order: 730, label: 'Taxe de développement local', labelEn: 'Local development tax', kind: 'impot', base: 'SB', amount: 'bareme("TDL", BASE)', org: 'COMMUNE', acc: 'impot' },
    { code: 'AVANCE', order: 800, label: 'Avance sur salaire', labelEn: 'Salary advance', kind: 'retenue', cond: 'mt("AVANCE") > 0', amount: 'mt("AVANCE")', source: 'avance', acc: 'avance' },
    { code: 'PRET', order: 810, label: 'Remboursement de prêt', labelEn: 'Loan repayment', kind: 'retenue', cond: 'mt("PRET") > 0', amount: 'mt("PRET")', source: 'pret', acc: 'avance' },
    { code: 'SYND', order: 820, label: 'Cotisation syndicale', labelEn: 'Union dues', kind: 'retenue', cond: 'fixe("SYND") > 0', amount: 'fixe("SYND")', source: 'fixe', acc: 'divers' },
    { code: 'MUTUELLE', order: 830, label: 'Mutuelle santé (part salariale)', labelEn: 'Health insurance', kind: 'retenue', cond: 'fixe("MUTUELLE") > 0', amount: 'fixe("MUTUELLE")', source: 'fixe', acc: 'divers' },
    { code: 'RET_DIV', order: 840, label: 'Retenue diverse', labelEn: 'Other deduction', kind: 'retenue', cond: 'mt("RET_DIV") > 0', amount: 'mt("RET_DIV")', source: 'variable', acc: 'divers' }
  ],

  /* Schéma comptable par défaut (familles de rubriques → comptes SYSCOHADA). Modifiable par société. */
  accounts: {
    salaire: { debit: '661', debitExpat: '662', credit: '422' }, conges: { debit: '661', debitExpat: '662', credit: '422' }, indemnite: { debit: '663', credit: '422' }, sortie: { debit: '663', credit: '422' },
    cnps: { salCredit: '431', patDebit: '664', patCredit: '431' }, taxe: { salCredit: '447', patDebit: '641', patCredit: '447' }, impot: { salCredit: '447' },
    avance: { salCredit: '421' }, divers: { salCredit: '428' }, net: '422', bank: '5211', momo: '5521', cash: '5711'
  },
  declarations: [
    { code: 'CNPS', label: 'CNPS · déclaration et paiement des cotisations (DIPE)', rubriques: ['PVID', 'PF', 'AT'], due: 15, account: '431', channel: 'Télédéclaration CNPS (DAF)' },
    { code: 'DGI', label: 'DGI · retenues sur salaires (IRPP, CAC, CFC, FNE, RAV)', rubriques: ['IRPP', 'CAC', 'CFC', 'FNE', 'RAV'], due: 15, account: '447', channel: 'impots.cm' },
    { code: 'COMMUNE', label: 'Commune · taxe de développement local', rubriques: ['TDL'], due: 15, account: '447', channel: 'Recette municipale / impots.cm' }
  ],
  /* Conventions collectives : MODÈLES de grilles à remplacer par les textes officiels de chaque branche. */
  conventions: [
    { code: 'CC-COM', label: 'Commerce et services (modèle)', sector: 'Conseil, commerce, services', anc: 'ANC_STD', lic: 'LIC_STD', noticeMonths: { cadre: 3, maitrise: 2, employe: 1 }, check: true,
      grid: [['1', 'A', 'Employé · catégorie 1', 44000], ['2', 'A', 'Employé · catégorie 2', 52000], ['4', 'A', 'Employé qualifié', 78000], ['6', 'A', 'Agent de maîtrise', 145000], ['8', 'A', 'Cadre', 320000], ['10', 'A', 'Cadre supérieur', 560000], ['12', 'A', 'Cadre de direction', 900000]] },
    { code: 'CC-NUM', label: 'Services numériques et édition de logiciels (modèle)', sector: 'Édition de solutions digitales', anc: 'ANC_STD', lic: 'LIC_STD', noticeMonths: { cadre: 3, maitrise: 2, employe: 1 }, check: true,
      grid: [['1', 'A', 'Technicien support', 90000], ['2', 'A', 'Développeur junior', 220000], ['3', 'A', 'Développeur confirmé', 420000], ['4', 'A', 'Lead / architecte', 700000], ['5', 'A', 'Direction technique', 1100000]] },
    { code: 'CC-TRANS', label: 'Transports routiers et logistique (modèle)', sector: 'Transport, livraison', anc: 'ANC_STD', lic: 'LIC_STD', noticeMonths: { cadre: 3, maitrise: 2, employe: 1 }, check: true,
      grid: [['1', 'A', 'Coursier / livreur', 45000], ['3', 'A', 'Chauffeur', 75000], ['5', 'A', 'Chef d’équipe', 140000], ['7', 'A', 'Responsable d’exploitation', 380000]] }
  ]
};

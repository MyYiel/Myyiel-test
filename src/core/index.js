/* Point d'entrée du moteur : l'ordre des imports est l'ordre d'évaluation (chaque module complète Y). */
import { Y } from './registry.js';
import './plan-syscohada.js';
import './ledger.js';
import './operations.js';
import './reports.js';
import './io.js';
import './interfaces.js';
import './paie-cm.js';
import './paie.js';
import './paie-seed.js';
import './absences.js';
import './gta.js';
import './stocks.js';
import './modules-seed.js';
import './fin.js';
import './fin-seed.js';
import './crm.js';
import './crm-seed.js';
import './seed.js';

export { Y };
export default Y;

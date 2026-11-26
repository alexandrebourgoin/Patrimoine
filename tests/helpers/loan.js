import { loadClassic } from './load-classic.js';
// Moteur de crédit commun (js/features/loan-calc.js), chargé avant realestate-calc.js dans l'app : à injecter dans ses globales.
export const LOAN = loadClassic('js/features/loan-calc.js', { exports: ['loanAddMonths', 'loanInsurance', 'loanSchedule'] });

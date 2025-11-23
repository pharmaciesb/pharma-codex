// /static/js/assistants/assistant-string.js

/**
 * Normalise et supprime les accents d'une chaîne de caractères, puis la met en minuscules.
 */
export function removeAccents(str) {
    if (typeof str !== 'string') return '';
    // L'ajout de toLowerCase() est la clé ici pour que la recherche dans handleExcel fonctionne
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); 
}
// /static/js/assistants/assistant-string.js

/**
 * Normalise et supprime les accents d'une chaîne de caractères, puis la met en minuscules.
 */
export function removeAccents(str) {
    if (typeof str !== 'string') return '';
    // L'ajout de toLowerCase() est la clé ici pour que la recherche dans handleExcel fonctionne
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); 
}

// Ajoutez cette fonction dans la portée globale (autour de buildEtiquetteItem)
/**
 * Convertit une chaîne en Title Case (Première lettre de chaque mot en majuscule).
 * Ex: "ceanothus americanus siccum" -> "Ceanothus Americanus Siccum"
 */
export function toTitleCase(str) {
    if (!str) return '';
    // Mettre tout en minuscule d'abord, puis capitaliser le début de chaque mot
    return str.toLowerCase().split(' ').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
}
// /static/js/assistants/assistant-datamatrix.js

/**
 * Analyse une chaîne GS1 (Data Matrix) typique des médicaments (01)CIP(17)EXP(10)LOT
 * @param {string} gs1Data - La chaîne GS1 brute, ex: "01340093030600001725123110ABC123"
 * @returns {{ean: string, expiration: string, lot: string}|null}
 */
export function parseGS1(gs1Data) {
    if (!gs1Data || typeof gs1Data !== 'string') return null;

    // Utilisation des identificateurs d'application (IA)
    const match = gs1Data.match(/01(\d{14})17(\d{6})10([a-zA-Z0-9]+)/);

    if (!match) {
        // Alternative : Certains codes peuvent utiliser le caractère FNC1 (chr 29) comme séparateur.
        // On laisse ici l'approche simple des IA concaténés pour l'exemple.
        return null; 
    }

    const [, ean14, expirationGs1, lot] = match;

    // Formatage de la date d'expiration GS1 (AAMMJJ) en JJ/MM/AAAA (fin de mois)
    const annee = '20' + expirationGs1.substring(0, 2);
    const mois = expirationGs1.substring(2, 4);
    // Le 'J' du GS1 est souvent ignoré, et la date d'expiration est le dernier jour du mois.
    const dateExpiration = new Date(annee, mois, 0); // Le jour 0 du mois M est le dernier jour du mois M-1

    return {
        // CIP/EAN-13 sans le '0' de début si EAN-14
        ean: ean14.substring(1), 
        // Date formatée pour affichage
        expiration: `${String(dateExpiration.getDate()).padStart(2, '0')}/${mois}/${annee}`, 
        lot: lot 
    };
}
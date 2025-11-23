// /static/js/assistants/assistant-pdf.js

/**
 * Liste les champs de formulaire (AcroForm) d'un document PDF chargé.
 * Cette fonction est utile pour le diagnostic et pour trouver les noms de champs.
 * * @param {ArrayBuffer} pdfBytes - Les données brutes du fichier PDF.
 * @param {object} PDFLib - La librairie PDFLib (doit être passée si elle n'est pas globale).
 * @returns {void} - Écrit le résultat dans la console.
 */
export async function listFormFields(pdfBytes, PDFLib) {
    if (!pdfBytes || !PDFLib) {
        console.error('[PDF Assistant] Données PDF ou PDFLib manquantes.');
        return;
    }
    
    try {
        const { PDFDocument } = PDFLib;
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const form = pdfDoc.getForm();
        
        const fields = form.getFields();
        
        if (fields.length === 0) {
            console.warn('[PDF Assistant] Ce PDF ne contient aucun champ de formulaire interactif (AcroForm).');
            return;
        }

        console.groupCollapsed(`--- 📝 ${fields.length} Champs PDF interactifs trouvés ---`);
        fields.forEach(field => {
            const name = field.getName();
            // Le nom du constructeur donne le type (PDFTextField, PDFCheckBox, PDFRadioGroup)
            const type = field.constructor.name; 
            console.log(`NOM: %c${name}%c | TYPE: ${type}`, 'color: #165ED5; font-weight: bold;', 'color: unset;');
        });
        console.groupEnd();

    } catch (err) {
        console.error('[PDF Assistant] Erreur lors de l\'analyse des champs PDF :', err);
    }
}
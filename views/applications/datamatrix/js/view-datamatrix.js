/// <reference path="../../../../static/js/types.js" />

/**
 * Handler pour la vue DataMatrix
 * @extends {AppManagers.ViewHandler}
 */
class DataMatrixHandler extends AppManagers.ViewHandler {
    constructor() {
        super('vueDatamatrix');
    }
    
    async onload() {
        AppManagers.PdfAssistant.reset();
        
        // 1. Récupère et configure l'input DLU
        const dluInput = this.getElement('dlu');
        if (dluInput) {
            this.addListener(dluInput, 'input', this.handleDLUFormatting);
        }
        
        // 2. Enregistre le handler de formulaire
        this.registerForm('formDatamatrix', this.handleFormSubmit);
    }
    
    /**
     * Formate automatiquement la DLU au format MM/YYYY
     * @param {Event} e
     */
    handleDLUFormatting(e) {
        // Garde uniquement les chiffres
        let val = e.target.value.replace(/\D/g, '');
        
        if (val.length >= 2) {
            // Mois : entre 01 et 12
            const mois = Math.min(Math.max(parseInt(val.slice(0, 2)), 1), 12)
                .toString()
                .padStart(2, '0');
            
            // Année : 4 chiffres
            const annee = val.slice(2, 6);
            
            // Formatage final
            e.target.value = annee.length > 0 ? `${mois}/${annee}` : mois;
        }
    }
    
    /**
     * Gère la soumission du formulaire
     * @param {FormData} data
     * @param {HTMLFormElement} form
     */
    async handleFormSubmit(data, form) {
        try {
            // 1. Récupération des données
            const ean = data.get('ean').trim();
            const lot = data.get('lot').trim();
            const dlu = data.get('dlu').trim();
            const qte = parseInt(data.get('qte'));
            
            // 2. Validation
            if (!ean || !lot || !dlu || isNaN(qte) || qte < 1) {
                await AppManagers.CodexManager.show('error', 'Tous les champs sont requis et la quantité doit être ≥ 1');
                return;
            }
            
            // 3. Calcul de la date d'expiration GS1
            const [mm, yyyy] = dlu.split('/');
            
            if (!mm || !yyyy || yyyy.length !== 4) {
                await AppManagers.CodexManager.show('error', 'Format DLU invalide (attendu: MM/YYYY)');
                return;
            }
            
            // Dernier jour du mois
            const dernierJour = new Date(parseInt(yyyy), parseInt(mm), 0).getDate();
            const expiryDate = yyyy.slice(-2) + mm + dernierJour.toString().padStart(2, '0');
            
            // 4. Construction du code GS1
            const gs1Data = `01${ean.padStart(14, '0')}17${expiryDate}10${lot}`;
            
            AppManagers.log(this.key, 'info', `GS1 généré: ${gs1Data}`);
            
            // 5. Génération des items
            const items = this.genererItems(qte, gs1Data, ean, lot, dlu);
            
            // 6. Génération du PDF
            await this.genererPDF(items, lot);
            
            await AppManagers.CodexManager.show('success', `${qte} DataMatrix généré(s)`);
            
        } catch (err) {
            AppManagers.log(this.key, 'error', 'Erreur génération DataMatrix:', err);
            await AppManagers.CodexManager.show('error', err.message || 'Erreur lors de la génération');
        }
    }
    
    /**
     * Génère les items pour le PDF
     * @param {number} quantite
     * @param {string} gs1Data
     * @param {string} ean
     * @param {string} lot
     * @param {string} dlu
     * @returns {Array}
     */
    genererItems(quantite, gs1Data, ean, lot, dlu) {
        if (!window.DATAMatrix) {
            throw new Error('Librairie DATAMatrix non chargée');
        }
        
        return Array.from({ length: quantite }, () => ({
            svgHtml: DATAMatrix({ msg: gs1Data, dim: 36 }).outerHTML,
            ean,
            lot,
            dlu
        }));
    }
    
    /**
     * Génère le PDF avec l'assistant PDF
     * @param {Array} items
     * @param {string} lot
     */
    async genererPDF(items, lot) {
        await AppManagers.PdfAssistant.generate({
            items,
            itemTemplateUrl: './views/applications/datamatrix/partials/template-item.html',
            pageTemplateUrl: './views/applications/datamatrix/partials/template-page.html',
            columns: 4,
            rows: 6,
            filename: `datamatrix_${lot}.pdf`,
            targetElementId: '#datamatrix-output'
        });
    }
}

// ✅ Enregistrement
new DataMatrixHandler().register();
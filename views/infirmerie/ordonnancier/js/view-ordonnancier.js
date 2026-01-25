/// <reference path="../../../../static/js/types.js" />

import { exportToPDF, PDF_PRESETS } from '/pharma-codex/static/js/assistants/assistant-html2pdf.js';

/**
 * Handler pour la vue Ordonnancier
 * @extends {AppManagers.ViewHandler}
 */
class OrdonnancierHandler extends AppManagers.ViewHandler {
    constructor() {
        super('viewOrdonnancier');
    }
    
    async onload() {
        // Récupère et configure les boutons
        const boutons = {
            'pdf-basique': 'basique',
            'pdf-basique-double': 'basique-double',
            'pdf-pansement': 'pansement',
            'pdf-pansement-double': 'pansement-double'
        };
        
        for (const [btnId, partial] of Object.entries(boutons)) {
            const btn = this.getElement(btnId, false);
            
            if (btn) {
                this.addListener(btn, 'click', () => this.telechargerModele(partial));
            } else {
                AppManagers.log(this.key, 'warn', `Bouton ${btnId} non trouvé`);
            }
        }
    }
    
    /**
     * Télécharge un modèle d'ordonnance en PDF
     * @param {string} partial - Nom du partial (basique, pansement, etc.)
     */
    async telechargerModele(partial) {
        try {
            // 1. Charge le template via TemplateManager
            const html = await AppManagers.TemplateManager.load(
                `./views/infirmerie/ordonnancier/partials/${partial}.html`
            );
            
            // 2. Parse le HTML
            const temp = document.createElement('div');
            temp.innerHTML = html.trim();
            
            // 3. Extrait le style s'il existe
            const styleTag = temp.querySelector('style');
            let injectedStyle = null;
            
            if (styleTag) {
                injectedStyle = styleTag.cloneNode(true);
                document.head.appendChild(injectedStyle);
            }
            
            // 4. Récupère l'élément ordonnance
            const ordonnance = temp.querySelector('#ordonnance');
            
            if (!ordonnance) {
                throw new Error(`Élément #ordonnance non trouvé dans ${partial}.html`);
            }
            
            // 5. Export PDF
            await exportToPDF(
                ordonnance, 
                `ordonnance-ide-${partial}.pdf`, 
                PDF_PRESETS.FACTURE
            );
            
            // 6. Nettoyage du style injecté
            if (injectedStyle) {
                injectedStyle.remove();
            }
            
            AppManagers.log(this.key, 'success', `PDF généré: ${partial}`);
            await AppManagers.CodexManager.show('success', 'PDF généré avec succès');
            
        } catch (err) {
            AppManagers.log(this.key, 'error', `Erreur chargement ${partial}:`, err);
            await AppManagers.CodexManager.show('error', `Impossible de charger le modèle "${partial}"`);
        }
    }
}

new OrdonnancierHandler().register();
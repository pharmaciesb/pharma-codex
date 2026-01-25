/// <reference path="../../../../static/js/types.js" />

import { definirAujourdhui, formatFR } from '/pharma-codex/static/js/assistants/assistant-date.js';
import { exportToPDF } from '/pharma-codex/static/js/assistants/assistant-html2pdf.js';

/**
 * Handler pour la vue Facture
 * @extends {AppManagers.ViewHandler}
 */
class FactureHandler extends AppManagers.ViewHandler {
    constructor() {
        super('viewFacture');
        this.factureData = null; // Stocke les données de la dernière facture générée
    }

    async onload() {
        // Initialise la date du jour dans les inputs
        definirAujourdhui();

        // Récupère les boutons
        const btnRenseignee = this.getElement('pdf-renseignee');
        const btnVierge = this.getElement('pdf-vierge');
        const btnViergeDouble = this.getElement('pdf-vierge-double');

        // Configure les boutons vierges (actifs dès le départ)
        if (btnVierge) {
            this.addListener(btnVierge, 'click', this.genererFactureVierge);
            btnVierge.disabled = false;
        }

        if (btnViergeDouble) {
            this.addListener(btnViergeDouble, 'click', this.genererFactureViergeDouble);
            btnViergeDouble.disabled = false;
        }

        // Bouton renseignée désactivé par défaut (activé après génération)
        if (btnRenseignee) {
            this.addListener(btnRenseignee, 'click', this.genererFactureRenseignee);
            btnRenseignee.disabled = true;
        }

        // Enregistre le handler de formulaire
        this.registerForm('formFacture', this.handleFormSubmit);
    }

    /**
     * Gère la soumission du formulaire
     * @param {FormData} data
     * @param {HTMLFormElement} form
     */
    async handleFormSubmit(data, form) {
        try {
            const outputDiv = this.getElement('facture-output');
            if (!outputDiv) {
                await AppManagers.CodexManager.show('error', 'Zone de prévisualisation introuvable');
                return;
            }

            // Validation
            const nom = data.get('nom')?.trim();
            const date = data.get('date')?.trim();
            const total = data.get('total')?.trim();

            if (!date || !total) {
                await AppManagers.CodexManager.show('error', 'Date et Total sont obligatoires');
                return;
            }

            // Stocke les données
            this.factureData = { nom, date, total };

            // Génère la prévisualisation
            await AppManagers.CodexManager.show('info', 'Génération de la prévisualisation...');

            await AppManagers.TemplateManager.renderInto(
                './views/infirmerie/facture/partials/satisfait.html',
                { facture: this.factureData },
                outputDiv
            );

            // Active le bouton "renseignée"
            const btnRenseignee = this.getElement('pdf-renseignee');
            if (btnRenseignee) {
                btnRenseignee.disabled = false;
            }

            await AppManagers.CodexManager.show('success', 'Prévisualisation générée');

            // Scroll vers le résultat
            outputDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        } catch (err) {
            AppManagers.log(this.key, 'error', 'Erreur génération facture:', err);
            await AppManagers.CodexManager.show('error', `Erreur: ${err.message}`);
        }
    }

    /**
     * Génère une facture vierge A4
     */
    async genererFactureVierge() {
        try {
            const html = await AppManagers.TemplateManager.load('./views/infirmerie/facture/partials/vierge.html');
            const temp = document.createElement('div');
            temp.innerHTML = html;
            const facture = temp.querySelector('#facture-vierge');

            if (!facture) throw new Error('Template vierge introuvable');

            await exportToPDF(facture, 'facture-vierge.pdf', PDF_PRESETS.FACTURE);

        } catch (err) {
            AppManagers.log(this.key, 'error', 'Erreur facture vierge:', err);
            await AppManagers.CodexManager.show('error', 'Impossible de générer la facture vierge');
        }
    }

    /**
     * Génère une facture vierge double (A5 x2)
     */
    async genererFactureViergeDouble() {
        try {
            const html = await AppManagers.TemplateManager.load('./views/infirmerie/facture/partials/vierge-double.html');
            const temp = document.createElement('div');
            temp.innerHTML = html;
            const facture = temp.querySelector('#facture-vierge-double');

            if (!facture) throw new Error('Template vierge double introuvable');

            await exportToPDF(facture, 'facture-vierge-double.pdf', PDF_PRESETS.FACTURE);

        } catch (err) {
            AppManagers.log(this.key, 'error', 'Erreur facture vierge double:', err);
            await AppManagers.CodexManager.show('error', 'Impossible de générer la facture double');
        }
    }

    /**
     * Génère la facture renseignée
     */
    async genererFactureRenseignee() {
        try {
            const facture = document.getElementById('facture-pdf');
            if (!facture) {
                await AppManagers.CodexManager.show('warn', 'Veuillez d\'abord générer la facture');
                return;
            }

            const clone = facture.cloneNode(true);

            // Remplace l'input de date par le texte formaté
            const dateEl = clone.querySelector('#facture-pdf-date input');
            if (dateEl) {
                const dateFr = formatFR(dateEl.value);
                clone.querySelector('#facture-pdf-date').innerHTML = `À MARSEILLE, le : ${dateFr}`;
            }

            await exportToPDF(clone, 'facture-renseignee.pdf', PDF_PRESETS.FACTURE);

        } catch (err) {
            AppManagers.log(this.key, 'error', 'Erreur facture renseignée:', err);
            await AppManagers.CodexManager.show('error', 'Impossible de générer la facture');
        }
    }

}

new FactureHandler().register();
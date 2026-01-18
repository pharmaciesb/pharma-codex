import { toTitleCase } from '/pharma-codex/static/js/assistants/assistant-string.js';

let items = [];

/**
 * Handlers pour l'étiqueteuse
 * @extends AppManagers.ViewHandler
 */
class EtiqueteuseHandler extends AppManagers.ViewHandler {
    constructor() {
        super('vueEtiqueteuse');
    }
    
    async onload() {
        AppManagers.PdfAssistant.reset();
        
        // ✅ Enregistre le form avec tracking automatique
        this.registerForm('formEtiquette', this.handleFormSubmit);
        
        // ✅ Récupère et stocke le bouton
        const btnClear = this.getElement('btnClear');
        
        if (btnClear) {
            // ✅ Ajoute le listener avec tracking automatique
            this.addListener(btnClear, 'click', this.handleClear);
        }
    }
    
    async handleFormSubmit(data, form) {
        items.push({
            denomination: data.get('denomination').trim(),
            dosage: data.get('dosage').trim(),
            codeBarre: data.get('codeBarre')?.trim() || ''
        });
        
        await this.refreshAll();
        await AppManagers.CodexManager.show('success', 'Souche ajoutée');
        form.reset();
        form.querySelector('#denomination')?.focus();
    }
    
    async handleClear(e) {
        e.preventDefault();
        if (items.length > 0 && confirm('Confirmez-vous la suppression de toutes les souches ?')) {
            items = [];
            await this.refreshAll();
            AppManagers.CodexManager?.show('info', 'Liste vidée');
        }
    }
    
    async refreshAll() {
        const listEl = document.getElementById('data-list');
        const outputEl = document.getElementById('etiqueteuse-output');
        if (!listEl) return;
        
        if (items.length === 0) {
            listEl.innerHTML = '<tr><td colspan="4" class="fr-text--center">Aucune souche.</td></tr>';
            if (outputEl) outputEl.innerHTML = '';
            return;
        }
        
        listEl.innerHTML = items.map((it, idx) => `
            <tr>
                <td class="fr-col--sm">${toTitleCase(it.denomination)}</td>
                <td class="fr-col--xs">${it.dosage}</td>
                <td class="fr-col--sm">${it.codeBarre || '-'}</td>
                <td class="fr-col--xs">
                    <button class="fr-btn fr-btn--tertiary-no-outline fr-btn--sm fr-icon-delete-line delete-item" data-idx="${idx}"></button>
                </td>
            </tr>
        `).join('');
        
        listEl.querySelectorAll('.delete-item').forEach(btn => {
            btn.onclick = async (e) => {
                e.preventDefault();
                items.splice(btn.dataset.idx, 1);
                await this.refreshAll();
            };
        });
        
        const preparedItems = items.map(it => ({
            ...it,
            denomination: toTitleCase(it.denomination),
            dataMatrixHtml: it.codeBarre ? DATAMatrix({ msg: it.codeBarre, dim: 38 }).outerHTML : ''
        }));
        
        await AppManagers.PdfAssistant.generate({
            items: preparedItems,
            itemTemplateUrl: "./views/atelier/etiqueteuse/partials/chemise/template-item.html",
            pageTemplateUrl: "./views/atelier/etiqueteuse/partials/chemise/template-page.html",
            columns: 7,
            rows: 5,
            filename: `Etiquettes_${new Date().toISOString().slice(0, 10)}.pdf`,
            targetElementId: '#etiqueteuse-output'
        });
    }
}

// ✅ Instancie et enregistre en une ligne
new EtiqueteuseHandler().register();
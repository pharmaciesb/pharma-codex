/**
 * Handler pour la vue infirmerie/cartes
 * Affiche l'annuaire des infirmiers (JSON), permet le téléchargement PDF
 * (complet ou filtré par genre) ainsi que le téléchargement/impression
 * individuel de chaque carte.
 * @extends {AppManagers.ViewHandler}
 */
class ViewCartes extends AppManagers.ViewHandler {
    constructor() {
        super('viewCartes');
        this._data = [];
    }

    _urls() {
        const base = window.BASE_URL || '';
        return {
            json: `${base}/views/infirmerie/cartes/json/cartes.json`,
            itemTemplate: `${base}/views/infirmerie/cartes/templates/item-carte.html`,
            pageTemplate: `${base}/views/infirmerie/cartes/templates/page-carte.html`,
            printAssistant: `${base}/static/js/assistants/assistant-html2pdf.js`
        };
    }

    async onload() {
        this._tbody = this.getElement('cartes-liste');
        this._selectGenre = this.getElement('cartes-filtre-genre');
        this._btnApercu = this.getElement('cartes-btn-apercu');
        this._btnTout = this.getElement('cartes-btn-pdf-tout');
        this._btnFiltre = this.getElement('cartes-btn-pdf-filtre');

        await this._chargerDonnees();
        this._renderTable(this._data);

        this.addListener(this._selectGenre, 'change', () => {
            this._renderTable(this._getFiltered());
        });

        this.addListener(this._btnApercu, 'click', () => this._apercuPdf(this._getFiltered()));
        this.addListener(this._btnTout, 'click', () => this._telechargerPdf(this._data, 'annuaire-infirmiers.pdf'));

        this.addListener(this._btnFiltre, 'click', () => {
            const genre = this._selectGenre.value;
            if (!genre) {
                AppManagers.CodexManager.show('info', 'Sélectionnez un genre pour télécharger la version filtrée.');
                return;
            }
            const label = genre === 'F' ? 'femmes' : 'hommes';
            this._telechargerPdf(this._getFiltered(), `annuaire-infirmiers-${label}.pdf`);
        });

        // Délégation des clics sur les boutons "télécharger" / "imprimer" de chaque ligne
        this.addListener(this._tbody, 'click', (e) => this._handleRowClick(e));
    }

    async _chargerDonnees() {
        try {
            const resp = await fetch(this._urls().json);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            this._data = await resp.json();
        } catch (err) {
            AppManagers.log(this.key, 'error', 'Erreur chargement JSON cartes', err);
            AppManagers.CodexManager.show('error', "Impossible de charger l'annuaire des infirmiers.");
            this._data = [];
        }
    }

    _getFiltered() {
        const genre = this._selectGenre?.value;
        return genre ? this._data.filter(d => d.genre === genre) : this._data;
    }

    _renderTable(list) {
        if (!this._tbody) return;

        if (!list.length) {
            this._tbody.innerHTML = `<tr><td colspan="7" class="fr-text--center">Aucun infirmier trouvé.</td></tr>`;
            return;
        }

        this._tbody.innerHTML = list.map((item) => {
            const idx = this._data.indexOf(item);
            const genreLabel = item.genre === 'F' ? 'Femme' : 'Homme';
            const mail = item.mail
                ? `<a class="fr-link" href="mailto:${item.mail}">${item.mail}</a>`
                : '';

            return `
            <tr>
                <td>${item.nom || ''}</td>
                <td>${genreLabel}</td>
                <td>${item.telephone || ''}</td>
                <td>${mail}</td>
                <td>${item.secteur || ''}</td>
                <td>
                    <div class="fr-grid-row fr-grid-row--center" style="gap:.25rem; flex-wrap:nowrap">
                        <button type="button" class="fr-btn fr-btn--tertiary fr-btn--sm fr-icon-file-download-line"
                                data-action="download" data-idx="${idx}" title="Télécharger la carte de ${item.nom}" title="Télécharger"></button>
                        <button type="button" class="fr-btn fr-btn--tertiary fr-btn--sm fr-icon-printer-line"
                                data-action="print" data-idx="${idx}" title="Imprimer la carte de ${item.nom}" title="Imprimer"></button>
                    </div>
                </td>
            </tr>`;
        }).join('');
    }

    _handleRowClick(e) {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;

        const idx = parseInt(btn.dataset.idx, 10);
        const item = this._data[idx];
        if (!item) return;

        if (btn.dataset.action === 'download') {
            this._telechargerPdf([item], `carte-${this._slug(item.nom)}.pdf`);
        } else if (btn.dataset.action === 'print') {
            this._imprimerCarte(item);
        }
    }

    _slug(str) {
        return (str || 'infirmier')
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');
    }

    /**
     * Génère et télécharge directement un PDF (pas de preview).
     */
    async _telechargerPdf(items, filename) {
        if (!items?.length) {
            AppManagers.CodexManager.show('info', 'Aucune donnée à exporter.');
            return;
        }
        const { itemTemplate, pageTemplate } = this._urls();
        try {
            await AppManagers.PdfAssistant.generate({
                items,
                itemTemplateUrl: itemTemplate,
                pageTemplateUrl: pageTemplate,
                columns: 2,
                rows: 4,
                filename,
                targetElementId: null // null => export direct, pas de preview
            });
            AppManagers.CodexManager.show('success', 'PDF généré avec succès.');
        } catch (err) {
            AppManagers.log(this.key, 'error', 'Erreur génération PDF', err);
            AppManagers.CodexManager.show('error', 'Erreur lors de la génération du PDF.');
        }
    }

    /**
     * Affiche un aperçu interactif (colonnes/lignes ajustables, boutons
     * télécharger/imprimer intégrés) dans #cartes-preview.
     */
    async _apercuPdf(items) {
        if (!items?.length) {
            AppManagers.CodexManager.show('info', 'Aucune donnée à afficher.');
            return;
        }
        const { itemTemplate, pageTemplate } = this._urls();
        try {
            await AppManagers.PdfAssistant.generate({
                items,
                itemTemplateUrl: itemTemplate,
                pageTemplateUrl: pageTemplate,
                columns: 2,
                rows: 4,
                filename: 'annuaire-infirmiers.pdf',
                targetElementId: '#cartes-preview'
            });
        } catch (err) {
            AppManagers.log(this.key, 'error', "Erreur génération de l'aperçu", err);
            AppManagers.CodexManager.show('error', "Erreur lors de la génération de l'aperçu.");
        }
    }

    /**
     * Impression isolée d'une seule carte (fenêtre d'impression dédiée,
     * n'affecte pas le reste de l'application).
     */
    async _imprimerCarte(item) {
        try {
            const { itemTemplate, pageTemplate, printAssistant } = this._urls();

            const [itemTplHtml, pageTplHtml] = await Promise.all([
                fetch(itemTemplate).then(r => r.text()),
                fetch(pageTemplate).then(r => r.text())
            ]);

            // Récupère uniquement le <style> du template de page
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = pageTplHtml.trim();
            const styleEl = tempDiv.querySelector('template')?.content?.querySelector('style');
            const styles = styleEl ? styleEl.innerHTML : '';

            const cardEl = AppManagers.PdfAssistant.renderItem(itemTplHtml, { item });

            const { printElement } = await import(printAssistant);
            printElement(cardEl, {
                title: `Carte - ${item.nom}`,
                styles: `
                    @page { size: auto; margin: 10mm; }
                    body { display:flex; justify-content:center; padding-top: 10mm; }
                    ${styles}
                `
            });
        } catch (err) {
            AppManagers.log(this.key, 'error', "Erreur lors de l'impression", err);
            AppManagers.CodexManager.show('error', "Erreur lors de l'impression de la carte.");
        }
    }
}

new ViewCartes().register();
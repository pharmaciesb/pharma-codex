// assistant-pdf.js
export const PdfAssistant = {
    _lastConfig: null,

    reset() {
        this._lastConfig = null;
        console.log("[PdfAssistant] Configuration réinitialisée.");
    },

    async generate(config) {
        // 1. PERSISTANCE DES RÉGLAGES UTILISATEUR
        // On vérifie si on est dans le même module (même cible)
        const isSameContext = config.targetElementId && config.targetElementId === this._lastConfig?.targetElementId;

        if (isSameContext) {
            // Si la toolbar existe déjà dans le DOM, on récupère les valeurs saisies par l'utilisateur
            const inputCols = document.getElementById('pdf-cols');
            const inputRows = document.getElementById('pdf-rows');

            if (inputCols && inputRows) {
                // On injecte les valeurs de l'écran dans la config reçue
                config.columns = parseInt(inputCols.value) || config.columns;
                config.rows = parseInt(inputRows.value) || config.rows;
            }
        }

        // 2. GESTION DU CONTEXTE (Mémorisation)
        if (config.targetElementId && config.targetElementId !== this._lastConfig?.targetElementId) {
            this._lastConfig = { ...config };
        } else {
            this._lastConfig = { ...this._lastConfig, ...config };
        }

        // On récupère les valeurs finales (soit par défaut, soit persistées)
        const { items, targetElementId, filename = "export.pdf", columns, rows } = this._lastConfig;

        if (!items?.length) return;

        // 3. Construction du DOM
        const { pagesRoot, styleHtml } = await this._buildGridDOM(this._lastConfig);

        // 4. ROUTAGE (Preview ou Export)
        if (targetElementId && config.targetElementId !== null) {
            const target = document.querySelector(targetElementId);
            
            if (!target) {
                console.warn(`[PdfAssistant] Cible ${targetElementId} introuvable.`);
                return;
            }

            // On vide et on reconstruit
            target.innerHTML = '';
            
            // On crée la toolbar avec les valeurs à jour (colonnes/lignes)
            target.appendChild(this._createToolbar(filename, columns, rows));

            if (styleHtml) {
                const styleEl = document.createElement("style");
                styleEl.innerHTML = styleHtml;
                target.appendChild(styleEl);
            }

            target.appendChild(pagesRoot);
        } 
        else {
            await this._performPdfExport(pagesRoot, styleHtml, filename);
        }
    },

    async export() {
        if (!this._lastConfig) return;
        const { pagesRoot, styleHtml } = await this._buildGridDOM(this._lastConfig);
        await this._performPdfExport(pagesRoot, styleHtml, this._lastConfig.filename || "export.pdf");
    },

    /**
     * Crée une barre d'actions interactive
     */
    _createToolbar(filename, currentCols, currentRows) {
        const container = document.createElement('div');
        container.className = 'fr-background-alt--blue-france fr-p-2w fr-mb-2w fr-grid-row fr-grid-row--middle fr-grid-row--between';
        container.style.borderRadius = '4px';
        container.style.border = '1px solid #e5e5e5';
        
        container.innerHTML = `
            <form id="pdfassistant-toolbar" class="fr-highlight--yellow-moutarde fr-highlight" style="width:100%">
                <fieldset class="fr-fieldset" style="margin:0; padding:0;">
                    <div class="fr-grid-row fr-grid-row--middle">
                        <div class="fr-col-auto fr-mr-4w">
                            <span class="fr-text--bold">Assistant PDF</span>
                        </div>
                        <div class="fr-col-auto fr-grid-row fr-grid-row--middle">
                            <div class="fr-input-group fr-mr-2w" style="margin-bottom:0">
                                <label class="fr-label fr-text--xs" for="pdf-cols">Colonnes</label>
                                <input type="number" id="pdf-cols" value="${currentCols}" min="1" max="12" class="fr-input fr-input--sm">
                            </div>
                            <div class="fr-input-group fr-mr-4w" style="margin-bottom:0">
                                <label class="fr-label fr-text--xs" for="pdf-rows">Lignes</label>
                                <input type="number" id="pdf-rows" value="${currentRows}" min="1" max="20" class="fr-input fr-input--sm">
                            </div>
                        </div>
                        <div class="fr-col fr-grid-row fr-grid-row--right">
                            <button type="button" class="fr-btn fr-icon-file-download-line fr-btn--secondary fr-btn--sm fr-mr-2w" id="pdf-btn-download">Télécharger</button>
                            <button type="button" class="fr-btn fr-icon-printer-line fr-btn--secondary fr-btn--sm" id="pdf-btn-print">Imprimer</button>
                        </div>
                    </div>
                </fieldset>
            </form>
        `;

        // Événements de changement de grille (Preview seulement)
        const updatePreview = () => {
            const columns = parseInt(container.querySelector('#pdf-cols').value) || 1;
            const rows = parseInt(container.querySelector('#pdf-rows').value) || 1;
            // On force le maintien de la preview en passant le targetElementId mémorisé
            this.generate({ columns, rows, targetElementId: this._lastConfig.targetElementId });
        };

        container.querySelector('#pdf-cols').onchange = updatePreview;
        container.querySelector('#pdf-rows').onchange = updatePreview;

        // Événements boutons
        container.querySelector('#pdf-btn-download').onclick = (e) => {
            e.preventDefault();
            this.export();
        };

        container.querySelector('#pdf-btn-print').onclick = (e) => {
            e.preventDefault();
            window.print();
        };

        return container;
    },

    /**
     * Logique de génération PDF (html2pdf)
     */
    async _performPdfExport(pagesRoot, styleHtml, filename) {
        const sandbox = document.createElement("div");
        Object.assign(sandbox.style, {
            position: 'fixed', top: '0', left: '0', width: '200mm',
            background: 'white', opacity: '0', zIndex: '-1'
        });

        if (styleHtml) {
            const styleEl = document.createElement("style");
            styleEl.innerHTML = styleHtml;
            sandbox.appendChild(styleEl);
        }

        document.body.appendChild(sandbox);
        sandbox.appendChild(pagesRoot);

        const options = {
            margin: 0,
            filename: filename,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, backgroundColor: '#fff', scrollY: 0 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        try {
            await html2pdf().set(options).from(pagesRoot).save();
        } finally {
            sandbox.remove();
        }
    },

    async _buildGridDOM({ items, itemTemplateUrl, pageTemplateUrl, columns, rows }) {
        const itemTpl = await this.loadTemplate(itemTemplateUrl);
        const pageTpl = await this.loadTemplate(pageTemplateUrl);

        // Extraction du style
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = pageTpl.trim();
        const pageTemplateEl = tempDiv.querySelector("template");
        let styleHtml = "";

        if (pageTemplateEl?.content) {
            const content = document.importNode(pageTemplateEl.content, true);
            const styleEl = content.querySelector("style");
            if (styleEl) styleHtml = styleEl.innerHTML;
        }

        const pagesRoot = document.createElement("div");
        const itemsPerPage = columns * rows;
        let pageEl = null;

        items.forEach((item, i) => {
            if (i % itemsPerPage === 0) {
                pageEl = this.createPage(pageTpl, columns, rows);
                pagesRoot.appendChild(pageEl);
            }
            const itemEl = this.renderItem(itemTpl, { item });
            const grid = pageEl.querySelector(".page-grid");
            if (grid) grid.appendChild(itemEl);
        });

        // Ajustement de la dernière page pour éviter les grands vides
        const lastPage = pagesRoot.lastElementChild;
        if (lastPage) {
            const lastGrid = lastPage.querySelector('.page-grid');
            if (lastGrid) {
                const itemsInLastPage = lastGrid.children.length;
                const neededRows = Math.ceil(itemsInLastPage / columns);
                const fullInnerHeight = 280; 
                const proportionalHeight = (fullInnerHeight / rows) * neededRows;
                lastGrid.style.gridTemplateRows = `repeat(${neededRows}, 1fr)`;
                lastGrid.style.height = proportionalHeight + 'mm';
                lastPage.style.minHeight = 'auto';
            }
        }

        return { pagesRoot, styleHtml };
    },

    async loadTemplate(url) {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error("Template introuvable: " + url);
        return await resp.text();
    },

    renderItem(templateHtml, ctx) {
        const html = templateHtml.replace(/\$\{(.+?)\}/g, (_, expr) => {
            try {
                return Function("ctx", "with(ctx){ return " + expr + "; }")(ctx);
            } catch { return ""; }
        });
        const div = document.createElement("div");
        div.innerHTML = html.trim();
        const tpl = div.querySelector("template");
        return tpl ? document.importNode(tpl.content, true).firstElementChild : div.firstElementChild;
    },

    createPage(pageTpl, columns, rows) {
        const div = document.createElement("div");
        div.innerHTML = pageTpl.trim();
        const tpl = div.querySelector("template");
        const content = document.importNode(tpl.content, true);

        const styleEl = content.querySelector("style");
        if (styleEl) styleEl.remove();

        const page = content.querySelector(".pdf-page") || content.firstElementChild;
        const grid = page.querySelector(".page-grid");

        if (grid) {
            Object.assign(grid.style, {
                display: 'grid',
                width: '100%',
                height: '280mm',
                gridTemplateColumns: `repeat(${columns}, 1fr)`,
                gridTemplateRows: `repeat(${rows}, 1fr)`,
                gap: '2mm'
            });
        }
        return page;
    }
};
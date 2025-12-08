export const PdfAssistant = {
    /**
     * Construit un PDF paginé en grille & l’exporte via html2pdf.
     */
    async buildAndExport({
        items = [],
        itemTemplateUrl,
        pageTemplateUrl,
        columns = 4,
        rows = 5,
        filename = "export.pdf",
        targetElementId = null,
    }) {
        if (!items.length) throw new Error("items[] est vide");
        if (!targetElementId && !window.html2pdf) throw new Error("html2pdf manquant");
        // ----- 1. Charger templates -----
        const itemTpl = await this.loadTemplate(itemTemplateUrl);
        const pageTpl = await this.loadTemplate(pageTemplateUrl);
        // ----- Extract global styles from page template (once) -----
        const tempDivForStyle = document.createElement("div");
        tempDivForStyle.innerHTML = pageTpl.trim();
        const pageTemplateEl = tempDivForStyle.querySelector("template");
        let styleHtml = "";
        if (pageTemplateEl && pageTemplateEl.content) {
            // Deep clone pour extraire le <style> complet sans modifications
            const contentForStyle = document.importNode(pageTemplateEl.content, true);
            const styleEl = contentForStyle.querySelector("style");
            if (styleEl) {
                styleHtml = styleEl.innerHTML;
                // Suppression de page-break-after: always; si présent (générique pour éviter doubles breaks)
                styleHtml = styleHtml.replace(/page-break-after:\s*always\s*;?/g, '');
                styleEl.remove();
            }
        }
        // ----- 2. Construire DOM -----
        const pagesRoot = document.createElement("div");
        pagesRoot.style.margin = '0';
        pagesRoot.style.padding = '0';
        const itemsPerPage = columns * rows;
        let pageIndex = 0;
        let pageEl = null;
        items.forEach((item, i) => {
            if (i % itemsPerPage === 0) {
                // Pas de breakers : empilement naturel pour éviter pages blanches
                pageEl = this.createPage(pageTpl, columns, rows);
                pagesRoot.appendChild(pageEl);
                pageIndex++;
            }
            // Construire item
            const itemEl = this.renderItem(itemTpl, { item });
            const grid = pageEl.querySelector(".page-grid");
            if (!grid) throw new Error("Grid introuvable sur la page");
            grid.appendChild(itemEl);
        });
        // ----- Adaptation dynamique de la page finale partielle (générique pour éviter page blanche) -----
        const lastPage = pagesRoot.lastElementChild;
        if (lastPage && lastPage.classList.contains('pdf-page')) {
            const lastGrid = lastPage.querySelector('.page-grid');
            if (lastGrid) {
                // Compter items dans la dernière page
                const itemsInLastPage = lastGrid.children.length;
                const neededRows = Math.ceil(itemsInLastPage / columns);
                // Ajuster rows et hauteur proportionnelle (basé sur full inner 277mm, paddings du template)
                const fullInnerHeight = 277; // mm (adapté aux paddings 10mm top/bottom standards)
                const proportionalHeight = (fullInnerHeight / rows) * neededRows;
                lastGrid.style.gridTemplateRows = `repeat(${neededRows}, 1fr)`;
                lastGrid.style.height = proportionalHeight + 'mm';
                // Laisser la page s'ajuster naturellement (template gère height: auto)
                lastPage.style.height = '';
                lastPage.style.minHeight = '';
            }
        }
        // Debug: Log du DOM (retirez après test)
        console.log("Structure pagesRoot:", pagesRoot.innerHTML);
        // ----- 3. Sandbox pour html2pdf (offset 0) -----
        const sandbox = document.createElement("div");
        sandbox.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 200mm;
            background: white;
            opacity: 0;
            z-index: -1;
            margin: 0;
            padding: 0;
        `;
        // Add global styles to sandbox (applies to descendants) - uniquement ceux du template
        if (styleHtml) {
            const globalStyleEl = document.createElement("style");
            globalStyleEl.innerHTML = styleHtml;
            sandbox.appendChild(globalStyleEl);
        }
        document.body.appendChild(sandbox);
        sandbox.appendChild(pagesRoot);
        // ----- 4. Export PDF -----
        const options = {
            margin: 0,
            filename,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: {
                scale: 2,
                useCORS: true,
                backgroundColor: '#fff',
                scrollY: 0,
                letterRendering: true, // Améliore le rendu texte
                height: pagesRoot.scrollHeight  // Force rendu exact à la hauteur du contenu
            },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            // Pas de pagebreak : empilement naturel
        };
        await html2pdf().set(options).from(pagesRoot).save();
        sandbox.remove();
    },
    // ---------------------------------------------------------------------
    // Helpers internes
    // ---------------------------------------------------------------------
    async loadTemplate(url) {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error("Échec chargement template " + url);
        return await resp.text();
    },
    renderItem(templateHtml, ctx) {
        const html = templateHtml.replace(/\$\{(.+?)\}/g, (_, expr) => {
            try {
                return Function("ctx", "with(ctx){ return " + expr + "; }")(ctx);
            } catch {
                return "";
            }
        });
        const div = document.createElement("div");
        div.innerHTML = html.trim();
        const templateEl = div.querySelector("template");
        if (templateEl && templateEl.content) {
            // Clone content from template and return the first element (générique)
            const content = document.importNode(templateEl.content, true);
            return content.firstElementChild;
        }
        // Fallback if no template wrapper
        return div.firstElementChild;
    },
    createPage(pageTpl, columns, rows) {
        const div = document.createElement("div");
        div.innerHTML = pageTpl.trim();
        const templateEl = div.querySelector("template");
        if (!templateEl || !templateEl.content) throw new Error("Template introuvable dans pageTpl");
        const content = document.importNode(templateEl.content, true);
        // Remove style if present (globals already extracted)
        const styleEl = content.querySelector("style");
        if (styleEl) styleEl.remove();
        const page = content.querySelector(".pdf-page");
        if (!page) throw new Error("Élément .pdf-page introuvable dans le template");
        // Hauteur gérée par template (auto/min-height) ; force seulement pour pages pleines via inline si besoin
        // (la dernière est ajustée dynamiquement)
        const grid = page.querySelector(".page-grid");
        if (!grid) throw new Error("Élément .page-grid introuvable dans le template");
        // Styles inline uniquement pour la grille (répartition pagination)
        const innerHeight = 277; // mm (adapté aux paddings standards du template)
        grid.style.display = 'grid';
        grid.style.width = '100%';
        grid.style.height = innerHeight + 'mm';
        grid.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
        grid.style.gridTemplateRows = `repeat(${rows}, 1fr)`; // 1fr pour étirer et remplir
        grid.style.gap = '4mm';
        return page;
    }
};
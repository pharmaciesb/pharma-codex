/**
 * Assistant pour l'export PDF simple avec html2pdf
 * Utile pour : factures, documents, certificats, attestations, etc.
 * 
 * Usage :
 * import { exportToPDF } from './assistants/assistant-html2pdf.js';
 * 
 * const element = document.getElementById('ma-facture');
 * await exportToPDF(element, 'facture.pdf');
 */

/**
 * Exporte un élément HTML en PDF
 * @param {HTMLElement} element - Élément à exporter
 * @param {string} filename - Nom du fichier PDF
 * @param {Object} options - Options personnalisées
 * @returns {Promise<void>}
 */
export async function exportToPDF(element, filename = 'document.pdf', options = {}) {
    if (!element) {
        throw new Error('[assistant-html2pdf] Aucun élément fourni pour l\'export');
    }
    
    if (!window.html2pdf) {
        throw new Error('[assistant-html2pdf] html2pdf non chargé. Ajoutez <script src="./static/js/libs/html2pdf.bundle.min@0.10.1.js"></script>');
    }
    
    // Sandbox invisible pour l'export (évite d'affecter la page)
    const sandbox = document.createElement('div');
    sandbox.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 210mm;
        background: white;
        opacity: 0;
        z-index: -1;
        pointer-events: none;
    `;
    
    document.body.appendChild(sandbox);
    sandbox.appendChild(element.cloneNode(true)); // Clone pour ne pas modifier l'original
    
    // Configuration par défaut
    const defaultOptions = {
        margin: 0,
        filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
            scale: 2, 
            useCORS: true, 
            backgroundColor: '#fff', 
            scrollY: 0 
        },
        jsPDF: { 
            unit: 'mm', 
            format: 'a4', 
            orientation: 'portrait' 
        },
        pagebreak: { 
            mode: ['css', 'legacy'], 
            before: '.breaker' 
        }
    };
    
    // Fusion des options
    const mergedOptions = mergeOptions(defaultOptions, options);
    
    try {
        // Délai pour le rendu CSS
        await new Promise(resolve => setTimeout(resolve, 300));
        
        await html2pdf()
            .set(mergedOptions)
            .from(sandbox.firstChild)
            .save();
        
        console.log(`[assistant-html2pdf] PDF généré avec succès: ${filename}`);
        
    } catch (error) {
        console.error('[assistant-html2pdf] Erreur lors de l\'export:', error);
        throw error;
        
    } finally {
        sandbox.remove();
    }
}

/**
 * Exporte un élément en mode impression (ouvre la fenêtre d'impression)
 * @param {HTMLElement} element - Élément à imprimer
 * @param {Object} printOptions - Options d'impression
 */
export function printElement(element, printOptions = {}) {
    if (!element) {
        throw new Error('[assistant-html2pdf] Aucun élément fourni pour l\'impression');
    }
    
    const { 
        title = document.title,
        styles = '',
        onBeforePrint = null,
        onAfterPrint = null
    } = printOptions;
    
    // Crée une fenêtre d'impression temporaire
    const printWindow = window.open('', '_blank');
    
    if (!printWindow) {
        throw new Error('[assistant-html2pdf] Impossible d\'ouvrir la fenêtre d\'impression (popup bloquée?)');
    }
    
    // ✅ Construction DOM moderne (sans document.write)
    const doc = printWindow.document;
    
    // Structure HTML
    const html = doc.createElement('html');
    const head = doc.createElement('head');
    const body = doc.createElement('body');
    
    // Titre
    const titleEl = doc.createElement('title');
    titleEl.textContent = title;
    head.appendChild(titleEl);
    
    // Styles DSFR
    const linkDsfr = doc.createElement('link');
    linkDsfr.rel = 'stylesheet';
    linkDsfr.href = './dsfr-v1.14.2/dist/dsfr.min.css';
    head.appendChild(linkDsfr);
    
    // Styles personnalisés
    const styleEl = doc.createElement('style');
    styleEl.textContent = `
        @media print {
            body { margin: 0; padding: 0; }
            .no-print { display: none !important; }
        }
        ${styles}
    `;
    head.appendChild(styleEl);
    
    // Contenu
    body.innerHTML = element.innerHTML;
    
    // Assemblage
    html.appendChild(head);
    html.appendChild(body);
    doc.documentElement.replaceWith(html);
    
    // Attend le chargement des styles
    linkDsfr.onload = () => {
        if (onBeforePrint) onBeforePrint(printWindow);
        
        printWindow.focus();
        printWindow.print();
        
        if (onAfterPrint) onAfterPrint(printWindow);
        
        // Ferme après impression (optionnel)
        setTimeout(() => printWindow.close(), 500);
    };
    
    // Fallback si le CSS ne charge pas
    setTimeout(() => {
        if (!linkDsfr.sheet) {
            console.warn('[assistant-html2pdf] CSS DSFR non chargé, impression sans styles');
            printWindow.print();
        }
    }, 2000);
}

/**
 * Exporte un template HTML rendu avec des données
 * @param {string} templateUrl - URL du template
 * @param {Object} data - Données pour le rendu
 * @param {string} filename - Nom du fichier
 * @param {Object} options - Options html2pdf
 */
export async function exportTemplateAsPDF(templateUrl, data, filename, options = {}) {
    // Charge le template
    const response = await fetch(templateUrl);
    if (!response.ok) {
        throw new Error(`[assistant-html2pdf] Template non trouvé: ${templateUrl}`);
    }
    
    const templateHtml = await response.text();
    
    // Rendu simple avec remplacement ${...}
    const renderedHtml = templateHtml.replace(/\$\{(.*?)\}/g, (match, key) => {
        const value = key.split('.').reduce((obj, k) => obj?.[k], data);
        return value !== undefined ? value : match;
    });
    
    // Crée un élément temporaire
    const temp = document.createElement('div');
    temp.innerHTML = renderedHtml;
    
    // Exporte
    await exportToPDF(temp.firstElementChild, filename, options);
}

/**
 * Fusion profonde des options
 * @private
 */
function mergeOptions(defaults, custom) {
    const result = { ...defaults };
    
    for (const key in custom) {
        if (custom[key] && typeof custom[key] === 'object' && !Array.isArray(custom[key])) {
            result[key] = mergeOptions(defaults[key] || {}, custom[key]);
        } else {
            result[key] = custom[key];
        }
    }
    
    return result;
}

/**
 * Preset d'options pour différents types de documents
 */
export const PDF_PRESETS = {
    // Facture A4 portrait sans marges
    FACTURE: {
        margin: 0,
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    },
    
    // Document A4 avec marges standards
    DOCUMENT: {
        margin: [10, 10, 10, 10],
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    },
    
    // Paysage pour tableaux larges
    PAYSAGE: {
        margin: [10, 10, 10, 10],
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
    },
    
    // A5 pour petits documents
    A5: {
        margin: [5, 5, 5, 5],
        jsPDF: { unit: 'mm', format: 'a5', orientation: 'portrait' }
    },
    
    // Haute qualité pour impression
    IMPRESSION: {
        margin: 0,
        image: { type: 'png', quality: 1 },
        html2canvas: { scale: 3, dpi: 300 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }
};
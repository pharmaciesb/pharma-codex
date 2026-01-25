// /static/js/assistants/assistant-pdf-lib.js

/**
 * Assistant pour la manipulation de PDFs avec PDF-LIB
 * Utilisé par les modules: cuprior, vaccin, grippe
 */

/**
 * Liste les champs de formulaire (AcroForm) d'un document PDF.
 * Utile pour le diagnostic et pour trouver les noms de champs.
 * @param {ArrayBuffer} pdfBytes - Les données brutes du fichier PDF.
 * @param {object} PDFLib - La librairie PDFLib.
 * @returns {Array<{name: string, type: string}>} - Liste des champs trouvés.
 */
export async function listFormFields(pdfBytes, PDFLib) {
    if (!pdfBytes || !PDFLib) {
        console.error('[PDF Assistant] Données PDF ou PDFLib manquantes.');
        return [];
    }
    
    try {
        const { PDFDocument } = PDFLib;
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const form = pdfDoc.getForm();
        
        const fields = form.getFields();
        
        if (fields.length === 0) {
            console.warn('[PDF Assistant] Ce PDF ne contient aucun champ de formulaire interactif (AcroForm).');
            return [];
        }

        const fieldsList = fields.map(field => ({
            name: field.getName(),
            type: field.constructor.name
        }));

        console.groupCollapsed(`--- 📝 ${fields.length} Champs PDF interactifs trouvés ---`);
        fieldsList.forEach(({ name, type }) => {
            console.log(`NOM: %c${name}%c | TYPE: ${type}`, 'color: #165ED5; font-weight: bold;', 'color: unset;');
        });
        console.groupEnd();

        return fieldsList;

    } catch (err) {
        console.error('[PDF Assistant] Erreur lors de l\'analyse des champs PDF :', err);
        return [];
    }
}

/**
 * Classe de base pour gérer les PDFs interactifs
 * Factorise le code commun entre cuprior, vaccin, grippe
 */
export class PDFFormHandler {
    constructor(config = {}) {
        this.config = {
            pdfUrl: config.pdfUrl || '',
            fontSize: config.fontSize || 10,
            letterSpacing: config.letterSpacing || 7,
            debugMode: config.debugMode || false,
            ...config
        };
        
        this.templatePdfBytes = null;
        this.PDFLib = window.PDFLib;
    }

    /**
     * Charge le template PDF
     * @returns {Promise<void>}
     */
    async loadTemplate() {
        if (this.templatePdfBytes) return;

        if (!this.PDFLib && window.PDFLib) {
            this.PDFLib = window.PDFLib;
        }
        if (!this.PDFLib) {
            throw new Error('PDFLib non disponible. Vérifiez que pdf-lib@1.17.1.js est chargé.');
        }

        const resp = await fetch(this.config.pdfUrl);
        if (!resp.ok) {
            throw new Error(`Impossible de charger le modèle PDF (${resp.status})`);
        }

        this.templatePdfBytes = await resp.arrayBuffer();

        // Debug mode : liste les champs du formulaire
        if (this.config.debugMode) {
            await listFormFields(this.templatePdfBytes, this.PDFLib);
        }

        console.log('[PDF Assistant] Modèle PDF chargé:', this.config.pdfUrl);
    }

    /**
     * Crée un nouveau document PDF à partir du template
     * @returns {Promise<{pdfDoc, page, font}>}
     */
    async createDocument() {
        if (!this.templatePdfBytes) {
            await this.loadTemplate();
        }

        const { PDFDocument, StandardFonts } = this.PDFLib;
        const pdfDoc = await PDFDocument.load(this.templatePdfBytes);
        const page = pdfDoc.getPages()[0];
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

        return { pdfDoc, page, font };
    }

    /**
     * Dessine du texte avec espacement entre lettres (pour codes/dates)
     * @param {Object} page - Page PDF-LIB
     * @param {string} text - Texte à dessiner
     * @param {number} x - Position X
     * @param {number} y - Position Y
     * @param {number} size - Taille de police
     * @param {Object} font - Font PDF-LIB
     * @param {number} spacing - Espacement entre lettres
     */
    drawTextWithSpacing(page, text, x, y, size, font, spacing) {
        let cursorX = x;
        for (const char of String(text)) {
            page.drawText(char, { x: cursorX, y, size, font });
            cursorX += font.widthOfTextAtSize(char, size) + spacing;
        }
    }

    /**
     * Calcule les coordonnées PDF à partir d'un cadre en pourcentages
     * @param {Object} cadre - {left, top, width, height} en pourcentages (0-1)
     * @param {number} pageWidth - Largeur de la page en points
     * @param {number} pageHeight - Hauteur de la page en points
     * @param {number} offsetY - Décalage vertical (optionnel)
     * @returns {{x: number, y: number}}
     */
    calculatePosition(cadre, pageWidth, pageHeight, offsetY = -5) {
        return {
            x: cadre.left * pageWidth + 5,
            y: pageHeight - (cadre.top * pageHeight) + offsetY
        };
    }

    /**
     * Remplit un champ de texte du formulaire PDF
     * @param {Object} form - Formulaire PDF-LIB
     * @param {string} fieldName - Nom du champ
     * @param {string} value - Valeur à insérer
     * @param {boolean} silent - Ne pas logger les erreurs
     */
    fillTextField(form, fieldName, value, silent = false) {
        try {
            const field = form.getTextField(fieldName);
            if (field) {
                field.setText(String(value || ''));
            } else if (!silent) {
                console.warn(`[PDF Assistant] Champ "${fieldName}" non trouvé`);
            }
        } catch (err) {
            if (!silent) {
                console.error(`[PDF Assistant] Erreur champ "${fieldName}":`, err);
            }
        }
    }

    /**
     * Finalise et sauvegarde le PDF
     * @param {Object} pdfDoc - Document PDF-LIB
     * @param {boolean} flatten - Aplatir les champs de formulaire
     * @returns {Promise<Uint8Array>}
     */
    async finalize(pdfDoc, flatten = true) {
        if (flatten) {
            const form = pdfDoc.getForm();
            form.flatten();
        }
        return await pdfDoc.save();
    }

    /**
     * Télécharge un PDF
     * @param {Uint8Array|Blob} pdfData - Données PDF
     * @param {string} filename - Nom du fichier
     */
    download(pdfData, filename) {
        const blob = pdfData instanceof Blob 
            ? pdfData 
            : new Blob([pdfData], { type: 'application/pdf' });
        
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Cleanup après un court délai
        setTimeout(() => URL.revokeObjectURL(url), 100);
    }

    /**
     * Crée une URL blob pour prévisualisation
     * @param {Uint8Array} pdfBytes - Données PDF
     * @returns {string} URL blob
     */
    createBlobUrl(pdfBytes) {
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        return URL.createObjectURL(blob);
    }
}

/**
 * Utilitaires de formatage de dates pour PDFs
 */
export const DateFormatter = {
    /**
     * Convertit JJ/MM/AAAA ou AAAA-MM-JJ en JJMMAAAA (pour letterSpacing)
     * @param {string} dateStr - Date source
     * @returns {string} Date formatée
     */
    toCompact(dateStr) {
        if (!dateStr) return '';
        
        if (dateStr.includes('/')) {
            return dateStr.split('/').join(''); // JJ/MM/AAAA → JJMMAAAA
        }
        if (dateStr.includes('-')) {
            const [y, m, d] = dateStr.split('-');
            return `${d}${m}${y}`; // AAAA-MM-JJ → JJMMAAAA
        }
        return dateStr;
    },

    /**
     * Convertit une date en format GS1 AAMMJJ
     * @param {string} dateStr - Date au format JJ/MM/AAAA ou AAAA-MM-JJ
     * @returns {string} Date GS1 (AAMMJJ)
     */
    toGS1(dateStr) {
        let date;
        
        if (dateStr.includes('/')) {
            const [d, m, y] = dateStr.split('/');
            date = new Date(`${y}-${m}-${d}`);
        } else if (dateStr.includes('-')) {
            date = new Date(dateStr);
        } else {
            return '';
        }

        const year = String(date.getFullYear()).slice(-2);
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
        
        return `${year}${month}${lastDay.toString().padStart(2, '0')}`;
    },

    /**
     * Formate une date ISO en format français JJ/MM/AAAA
     * @param {string} isoDate - Date ISO (AAAA-MM-JJ)
     * @returns {string} Date FR
     */
    toFrench(isoDate) {
        if (!isoDate || !isoDate.includes('-')) return '';
        const [y, m, d] = isoDate.split('-');
        return `${d}/${m}/${y}`;
    }
};

/**
 * Gestionnaire de preview PDF dans iframe
 */
export class PDFPreview {
    /**
     * Affiche un PDF dans un iframe
     * @param {string} containerId - ID du conteneur
     * @param {string} iframeId - ID de l'iframe
     * @param {string} blobUrl - URL blob du PDF
     */
    static show(containerId, iframeId, blobUrl) {
        const container = document.getElementById(containerId);
        const iframe = document.getElementById(iframeId);

        if (!container || !iframe) {
            console.warn('[PDF Preview] Conteneur ou iframe introuvable');
            return false;
        }

        container.classList.remove('fr-hidden');
        iframe.src = blobUrl;
        
        return true;
    }

    /**
     * Masque la preview
     * @param {string} containerId - ID du conteneur
     */
    static hide(containerId) {
        const container = document.getElementById(containerId);
        if (container) {
            container.classList.add('fr-hidden');
        }
    }

    /**
     * Ajoute un bouton de téléchargement
     * @param {HTMLElement} container - Conteneur
     * @param {string} blobUrl - URL du PDF
     * @param {string} filename - Nom du fichier
     * @param {Function} clickHandler - Handler optionnel
     */
    static addDownloadButton(container, blobUrl, filename, clickHandler = null) {
        // Évite les doublons
        const existing = container.querySelector('.pdf-download-btn');
        if (existing) existing.remove();

        const wrapper = document.createElement('div');
        wrapper.className = 'fr-mt-2v';
        wrapper.innerHTML = `
            <button class="fr-btn fr-btn--secondary pdf-download-btn" type="button">
                📥 Télécharger le PDF
            </button>
        `;

        container.insertBefore(wrapper, container.firstChild);

        const btn = wrapper.querySelector('.pdf-download-btn');
        btn.addEventListener('click', () => {
            if (clickHandler) {
                clickHandler(blobUrl, filename);
            } else {
                PDFFormHandler.prototype.download(
                    new Blob([]), // Placeholder, le vrai PDF est dans le blobUrl
                    filename
                );
            }
        });
    }
}

/**
 * Validateur de champs pour formulaires PDF
 */
export class FormValidator {
    /**
     * Valide les champs requis
     * @param {Object} data - Données du formulaire
     * @param {Array<string>} requiredFields - Champs requis
     * @returns {{valid: boolean, message: string, field?: string}}
     */
    static validateRequired(data, requiredFields) {
        for (const field of requiredFields) {
            if (!data[field] || String(data[field]).trim() === '') {
                return {
                    valid: false,
                    message: `Le champ "${field}" est obligatoire`,
                    field
                };
            }
        }
        return { valid: true, message: '' };
    }

    /**
     * Valide un NIR (15 chiffres)
     * @param {string} nir - Numéro de sécurité sociale
     * @returns {{valid: boolean, message: string}}
     */
    static validateNIR(nir) {
        if (!nir) {
            return { valid: false, message: 'NIR manquant' };
        }

        const cleaned = nir.replace(/\s/g, '');
        
        if (!/^\d{15}$/.test(cleaned)) {
            return { 
                valid: false, 
                message: 'Le NIR doit contenir exactement 15 chiffres' 
            };
        }

        return { valid: true, message: '' };
    }

    /**
     * Valide une date
     * @param {string} date - Date à valider
     * @returns {{valid: boolean, message: string}}
     */
    static validateDate(date) {
        if (!date) {
            return { valid: false, message: 'Date manquante' };
        }

        const parsed = new Date(date);
        if (isNaN(parsed.getTime())) {
            return { valid: false, message: 'Date invalide' };
        }

        return { valid: true, message: '' };
    }
}
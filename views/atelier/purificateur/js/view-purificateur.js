/// <reference path="../../../../static/js/types.js" />

import { getDocument } from '/pharma-codex/static/js/libs/pdf@5.4.394.js';

// Accès aux objets globaux PDF-LIB
const { PDFDocument, rgb, StandardFonts } = window.PDFLib || {};
const DEFAULT_FONT = StandardFonts.Helvetica;

/**
 * Handler pour la vue Purificateur de BL
 * @extends {AppManagers.ViewHandler}
 */
class PurificateurHandler extends AppManagers.ViewHandler {
    constructor() {
        super('viewPurificateur');
    }
    
    async onload() {
        // Vérification des dépendances
        this.verifierDependances();
        
        // Configuration du worker PDF.js
        this.configurerPdfWorker();
        
        // Enregistre le handler de formulaire
        this.registerForm('formPurificateur', this.handleFormSubmit);
    }
    
    /**
     * Vérifie que les librairies nécessaires sont chargées
     */
    verifierDependances() {
        if (!getDocument) {
            AppManagers.log(this.key, 'error', 'PDF.js (getDocument) non chargé');
        }
        if (!PDFDocument) {
            AppManagers.log(this.key, 'error', 'PDF-LIB non chargé');
        }
        
        AppManagers.log(this.key, 'success', 'Dépendances vérifiées');
    }
    
    /**
     * Configure le worker PDF.js
     */
    configurerPdfWorker() {
        try {
            if (getDocument?.GlobalWorkerOptions) {
                getDocument.GlobalWorkerOptions.workerSrc = '/pharma-codex/static/js/libs/pdf.worker@5.4.394.js';
                AppManagers.log(this.key, 'info', 'Worker PDF.js configuré');
            }
        } catch (err) {
            AppManagers.log(this.key, 'warn', 'Impossible de configurer le worker PDF.js', err);
        }
    }
    
    /**
     * Gère la soumission du formulaire
     * @param {FormData} data
     * @param {HTMLFormElement} form
     */
    async handleFormSubmit(data, form) {
        try {
            await AppManagers.CodexManager.show('info', 'Extraction et purification en cours...');
            
            // 1. Récupération et validation du fichier
            const file = data.get('fileinput');
            if (!file || file.size === 0) {
                await AppManagers.CodexManager.show('error', 'Veuillez sélectionner un fichier PDF.');
                return;
            }
            
            // 2. Extraction du numéro de BL depuis le nom de fichier
            const bonNumber = this.extraireBonNumber(file.name);
            
            // 3. Conversion en ArrayBuffer
            const arrayBuffer = await file.arrayBuffer();
            
            // 4. Extraction du texte du PDF
            const fullText = await this.extraireTextePDF(arrayBuffer);
            AppManagers.log(this.key, 'info', 'Texte extrait:', fullText.substring(0, 200) + '...');
            
            await AppManagers.CodexManager.show('info', 'Texte extrait, analyse en cours...');
            
            // 5. Extraction du nombre attendu de productions
            const expectedCount = this.extraireNombreProductions(fullText);
            
            // 6. Parsage des entrées de production
            const entries = this.parserEntrees(fullText);
            
            if (entries.length === 0) {
                await AppManagers.CodexManager.show('error', 'Aucune entrée valide trouvée. Vérifiez le format du BL.');
                return;
            }
            
            // 7. Validation (non bloquante)
            const validationMessage = this.validerNombreEntrees(entries.length, expectedCount);
            
            await AppManagers.CodexManager.show('info', `${entries.length} entrée(s) trouvée(s), génération du PDF...`);
            
            // 8. Génération du PDF épuré
            await this.genererPDFPurifie(entries, bonNumber, expectedCount);
            
            await AppManagers.CodexManager.show('success', `PDF épuré n°${bonNumber} généré avec succès. ${validationMessage}`);
            
        } catch (err) {
            AppManagers.log(this.key, 'error', 'Erreur traitement PDF:', err);
            await AppManagers.CodexManager.show('error', `Erreur: ${err.message}`);
        }
    }
    
    /**
     * Extrait le numéro de BL depuis le nom de fichier
     * @param {string} filename
     * @returns {string}
     */
    extraireBonNumber(filename) {
        const match = filename.match(/BL(\d{16})\.pdf/i);
        return match ? match[1] : 'INCONNU';
    }
    
    /**
     * Extrait le nombre de productions attendu depuis l'en-tête
     * @param {string} fullText
     * @returns {number|null}
     */
    extraireNombreProductions(fullText) {
        const match = fullText.match(/Nombre de productions:\s*(\d+)/i);
        return match ? parseInt(match[1], 10) : null;
    }
    
    /**
     * Valide que le nombre d'entrées parsées correspond au nombre attendu
     * @param {number} actualCount
     * @param {number|null} expectedCount
     * @returns {string}
     */
    validerNombreEntrees(actualCount, expectedCount) {
        if (expectedCount === null) {
            return 'Validation: nombre de productions non trouvé dans le fichier source.';
        }
        
        if (actualCount === expectedCount) {
            return `✓ Validation OK: ${actualCount}/${expectedCount} productions.`;
        } else {
            return `⚠ Attention: ${actualCount}/${expectedCount} productions parsées.`;
        }
    }
    
    /**
     * Extrait le texte brut du PDF
     * @param {ArrayBuffer} arrayBuffer
     * @returns {Promise<string>}
     */
    async extraireTextePDF(arrayBuffer) {
        if (!getDocument) {
            throw new Error('PDF.js (getDocument) non disponible');
        }
        
        const pdf = await getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            fullText += textContent.items.map(item => item.str).join(' ') + '\n';
        }
        
        return fullText;
    }
    
    /**
     * Parse le texte extrait pour trouver les entrées de production
     * @param {string} fullText
     * @returns {Array<Object>}
     */
    parserEntrees(fullText) {
        const entries = [];
        
        // ✅ REGEX ROBUSTE: 
        // - ID production: 16 chiffres commençant par 20XX (2024, 2025, 2026...)
        // - Nom patient: 1 à plusieurs mots (lettres, espaces, accents, tirets, apostrophes)
        // - Date début: DD/MM/YYYY
        // - Date fin: DD/MM/YYYY
        const productionRegex = /(20\d{14})\s+([A-ZÀ-ÿ\s\-']+?)\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})/gi;
        
        let match;
        let count = 0;
        
        while ((match = productionRegex.exec(fullText)) !== null) {
            count++;
            
            const id = match[1].trim();
            const name = match[2].trim().replace(/\s+/g, ' '); // Normalise les espaces multiples
            const startDate = match[3].trim();
            const endDate = match[4].trim();
            
            entries.push({
                count,
                id,
                name,
                start: startDate,
                end: endDate
            });
            
            AppManagers.log('PurificateurHandler', 'info', `Entrée ${count}: ${id} - ${name}`);
        }
        
        return entries;
    }
    
    /**
     * Génère le PDF épuré
     * @param {Array<Object>} entries
     * @param {string} bonNumber
     * @param {number|null} expectedCount
     */
    async genererPDFPurifie(entries, bonNumber, expectedCount) {
        if (!PDFDocument) {
            throw new Error('PDF-LIB non disponible');
        }
        
        const pdfDoc = await PDFDocument.create();
        let page = pdfDoc.addPage([595, 842]); // A4
        const { width, height } = page.getSize();
        const font = await pdfDoc.embedFont(DEFAULT_FONT);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const fontSize = 10;
        const padding = 30;
        
        // Titre
        page.drawText(`Bon de Livraison Épuré n° ${bonNumber}`, {
            x: padding,
            y: height - padding,
            font: boldFont,
            size: 14,
            color: rgb(0.2, 0.2, 0.2)
        });
        
        // ✅ VALIDATION: Affichage du nombre de productions
        let currentY = height - padding - 25;
        const validationText = expectedCount !== null 
            ? `Nombre de productions : ${entries.length}/${expectedCount}`
            : `Nombre de productions : ${entries.length}`;
        
        const validationColor = (expectedCount !== null && entries.length === expectedCount)
            ? rgb(0, 0.5, 0)  // Vert si OK
            : rgb(0.8, 0.4, 0); // Orange si différence
        
        page.drawText(validationText, {
            x: padding,
            y: currentY,
            font: boldFont,
            size: 10,
            color: validationColor
        });
        
        // Configuration du tableau
        const colWidths = [30, 100, 150, 70, 70];
        const tableHeaders = ['N°', 'ID Production', 'Nom Patient', 'Début', 'Fin'];
        currentY -= 30;
        
        // En-têtes
        this.dessinerLigneTableau(page, tableHeaders, currentY, padding, colWidths, boldFont, fontSize);
        currentY -= 15;
        
        // Données
        for (const entry of entries) {
            // Nouvelle page si nécessaire
            if (currentY < padding + 20) {
                page = pdfDoc.addPage([595, 842]);
                currentY = height - padding;
                this.dessinerLigneTableau(page, tableHeaders, currentY, padding, colWidths, boldFont, fontSize);
                currentY -= 15;
            }
            
            const rowData = [
                String(entry.count),
                entry.id,
                entry.name,
                entry.start,
                entry.end
            ];
            
            this.dessinerLigneTableau(page, rowData, currentY, padding, colWidths, font, fontSize);
            currentY -= 12;
        }
        
        // Génération et téléchargement
        const pdfBytes = await pdfDoc.save();
        this.telechargerPDF(pdfBytes, `BL_purifie_${bonNumber}.pdf`);
    }
    
    /**
     * Dessine une ligne du tableau
     * @param {Object} page - Page PDF
     * @param {Array<string>} data - Données à afficher
     * @param {number} y - Position Y
     * @param {number} startX - Position X de départ
     * @param {Array<number>} colWidths - Largeurs des colonnes
     * @param {Object} font - Police
     * @param {number} fontSize - Taille de la police
     */
    dessinerLigneTableau(page, data, y, startX, colWidths, font, fontSize) {
        let currentX = startX;
        for (let i = 0; i < data.length; i++) {
            page.drawText(data[i], {
                x: currentX,
                y,
                font,
                size: fontSize,
                color: rgb(0, 0, 0)
            });
            currentX += colWidths[i];
        }
    }
    
    /**
     * Télécharge le PDF généré
     * @param {Uint8Array} pdfBytes
     * @param {string} filename
     */
    telechargerPDF(pdfBytes, filename) {
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        
        // Cleanup
        URL.revokeObjectURL(url);
    }
}

// ✅ Enregistrement
new PurificateurHandler().register();
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
            
            // 5. Parsage des entrées de production
            const entries = this.parserEntrees(fullText);
            
            if (entries.length === 0) {
                await AppManagers.CodexManager.show('error', 'Aucune entrée valide trouvée. Vérifiez le format du BL.');
                return;
            }
            
            await AppManagers.CodexManager.show('info', `${entries.length} entrée(s) trouvée(s), génération du PDF...`);
            
            // 6. Génération du PDF épuré
            await this.genererPDFPurifie(entries, bonNumber);
            
            await AppManagers.CodexManager.show('success', `PDF épuré n°${bonNumber} généré avec succès`);
            
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
        const records = fullText.split(/\s+o\s*/i);
        const entries = [];
        let count = 0;
        
        const patientDataRegex = /(\d{16})\s+(.+?)\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})/i;
        
        // ✅ NOUVEAU : Regex pour détecter et retirer les en-têtes de page
        const headerPattern = /Bon de livraison.*?Validation/is;
        
        for (let i = 0; i < records.length; i++) {
            let record = records[i].trim();
            if (!record) continue;
            
            // ✅ Retire les en-têtes de page qui peuvent apparaître dans le bloc
            record = record.replace(headerPattern, '').trim();
            
            // Si c'est le premier bloc, on cherche après "Validation"
            if (i === 0) {
                const validationIndex = record.lastIndexOf('Validation');
                if (validationIndex !== -1) {
                    record = record.substring(validationIndex + 'Validation'.length).trim();
                }
            }
            
            // Cherche les données patient n'importe où dans le texte (pas besoin de ^)
            const match = record.match(patientDataRegex);
            
            if (match) {
                count++;
                entries.push({
                    count,
                    id: match[1],
                    name: match[2].trim().replace(/\s+/g, ' '),
                    start: match[3],
                    end: match[4]
                });
                
                AppManagers.log('PurificateurHandler', 'info', `Entrée ${count}: ${match[2]}`);
            }
        }
        
        return entries;
    }
    
    /**
     * Génère le PDF épuré
     * @param {Array<Object>} entries
     * @param {string} bonNumber
     */
    async genererPDFPurifie(entries, bonNumber) {
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
        
        // Configuration du tableau
        const colWidths = [30, 100, 150, 70, 70];
        const tableHeaders = ['N°', 'ID Production', 'Nom Patient', 'Début', 'Fin'];
        let currentY = height - padding - 40;
        
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
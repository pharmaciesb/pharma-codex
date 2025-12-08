// Import direct de la fonction getDocument depuis le fichier local pdf@5.4.394.js
import { getDocument } from '/pharma-codex/static/js/libs/pdf@5.4.394.js';

// 2. PDF-LIB (Génération)
// Accès aux objets globaux (via <script src="./static/js/libs/pdf-lib@1.17.1.js">)
const { PDFDocument, rgb, StandardFonts } = window.PDFLib || {};
const DEFAULT_FONT = StandardFonts.Helvetica;


// =============================================================
// AIDES À L'EXTRACTION ET AU PARSAGE
// =============================================================

/**
 * Extrait le texte brut du ArrayBuffer du fichier PDF en utilisant PDF.js.
 * @param {ArrayBuffer} arrayBuffer - Les données du fichier PDF.
 * @returns {Promise<string>} Le texte intégral extrait.
 */
async function extractPdfText(arrayBuffer, manager, codex) {
    if (!getDocument) {
        throw new Error("La librairie PDF.js (getDocument) n'a pas pu être chargée. Vérifiez l'import.");
    }

    // Définir le chemin du Worker (CORRECTION APPLIQUÉE)
    try {
        getDocument.GlobalWorkerOptions.workerSrc = '/pharma-codex/static/js/libs/pdf.worker@5.4.394.js';
    } catch (e) {
        manager.addResultMessage(codex, 'warning', "Impossible de définir le worker PDF.js. L'extraction peut échouer si le worker n'était pas déjà chargé.");
    }


    const pdf = await getDocument({ data: arrayBuffer }).promise;
    let fullText = '';

    // Extraction page par page
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();

        // Joindre les blocs de texte et ajouter un espace ou un saut de ligne
        fullText += textContent.items.map(item => item.str).join(' ');
        fullText += '\n';
    }

    return fullText;
}/**
 * Analyse le texte extrait pour trouver les entrées de production (ID, Nom, Dates).
 * Nouvelle logique : Isole le premier patient après l'en-tête "Validation", puis traite les suivants.
 * @param {string} fullText - Le texte brut extrait du PDF.
 * @returns {Array<Object>} Tableau des entrées de production.
 */
function parseExtractedText(fullText) {
    // 1. Découpage du texte en blocs de données en utilisant le marqueur ' o'
    // Bloc 0 = Entêtes + Patient 1 / Bloc 1 à N = Patient 2 à N
    const records = fullText.split(/\s+o\s*/i); 
    const entries = [];
    let j = 0;
    
    // Regex pour extraire les 4 éléments (ID, Nom, Date Début, Date Fin) au DEBUT (^) d'une chaîne
    const patientDataRegex = /^(\d{16})\s+(.+?)\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})/i;

    // --- Traitement du premier bloc (records[0]) pour isoler le Patient 1 ---
    if (records.length > 0) {
        let firstRecord = records[0].trim();
        const headerEndMarker = 'Validation'; 
        
        // 1. Trouver l'index du dernier mot d'en-tête ('Validation')
        const validationIndex = firstRecord.lastIndexOf(headerEndMarker);
        let cleanRecordForP1 = firstRecord;
        
        if (validationIndex !== -1) {
            // Commencer la chaîne *après* le mot "Validation" pour ignorer tous les en-têtes.
            // Le texte restant commence désormais directement par l'ID du Patient 1.
            cleanRecordForP1 = firstRecord.substring(validationIndex + headerEndMarker.length).trim();
        } 
        // Si 'Validation' n'est pas trouvé, on garde le record brut.

        // 2. Appliquer la regex ancrée (^) au texte nettoyé pour capturer P1
        const matchP1 = cleanRecordForP1.match(patientDataRegex); 
        
        if (matchP1) {
            j++;
            entries.push({ 
                count: j, 
                id: matchP1[1], 
                // Nettoyage final du nom (remplace les espaces multiples)
                name: matchP1[2].trim().replace(/\s+/g, ' '), 
                start: matchP1[3], 
                end: matchP1[4] 
            });
        }
    }
    
    // --- Traitement des blocs suivants (records[1] et après) ---
    // Ces blocs sont déjà "propres" car ils commencent par l'ID patient (suite au 'o' précédent)
    for (let i = 1; i < records.length; i++) {
        let record = records[i].trim();
        if (record.length === 0) continue;

        // On applique la regex ancrée (^) au texte
        const match = record.match(patientDataRegex);

        if (match) {
            j++;
            entries.push({ 
                count: j, 
                id: match[1], 
                name: match[2].trim().replace(/\s+/g, ' '), 
                start: match[3], 
                end: match[4] 
            });
        }
    }
    
    return entries;
}

// =============================================================
// GÉNÉRATION DU PDF ÉPURÉ (via PDF-LIB)
// =============================================================

/**
 * Génère le PDF final contenant uniquement le tableau épuré.
 */
async function createPurifiedPdf(entries, bonNumber, manager, codex) {
    if (!PDFDocument) {
        manager.addResultMessage(codex, 'error', `Erreur de dépendance : PDF-LIB (génération de PDF) n'est pas disponible.`);
        return;
    }

    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage([595, 842]); // A4 size
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
        color: rgb(0.2, 0.2, 0.2),
    });

    // Position de départ du tableau
    const colWidths = [30, 100, 150, 70, 70];
    const tableHeaders = ['N°', 'ID Production', 'Nom Patient', 'Début', 'Fin'];
    let currentY = height - padding - 40;

    // Dessiner les en-têtes
    let currentX = padding;
    for (let i = 0; i < tableHeaders.length; i++) {
        page.drawText(tableHeaders[i], {
            x: currentX,
            y: currentY,
            font: boldFont,
            size: fontSize,
            color: rgb(0, 0, 0),
        });
        currentX += colWidths[i];
    }

    currentY -= 15; // Ligne suivante

    // Dessiner les données
    for (const entry of entries) {
        if (currentY < padding + 20) { // Nouvelle page si la place manque
            page = pdfDoc.addPage([595, 842]);
            currentY = height - padding;

            // Redessiner les en-têtes sur la nouvelle page (optionnel)
            currentX = padding;
            for (let i = 0; i < tableHeaders.length; i++) {
                page.drawText(tableHeaders[i], {
                    x: currentX,
                    y: currentY,
                    font: boldFont,
                    size: fontSize,
                    color: rgb(0, 0, 0),
                });
                currentX += colWidths[i];
            }
            currentY -= 15;
        }

        currentX = padding; // Réinitialiser X

        // Affichage des colonnes
        page.drawText(String(entry.count), { x: currentX, y: currentY, font, size: fontSize }); currentX += colWidths[0];
        page.drawText(entry.id, { x: currentX, y: currentY, font, size: fontSize }); currentX += colWidths[1];
        page.drawText(entry.name, { x: currentX, y: currentY, font, size: fontSize }); currentX += colWidths[2];
        page.drawText(entry.start, { x: currentX, y: currentY, font, size: fontSize }); currentX += colWidths[3];
        page.drawText(entry.end, { x: currentX, y: currentY, font, size: fontSize }); currentX += colWidths[4];

        currentY -= 12;
    }

    // Génération et téléchargement
    const finalPdf = await pdfDoc.save();
    const blob = new Blob([finalPdf], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);

    // Téléchargement
    const a = document.createElement('a');
    a.href = url;
    a.download = `BL_purifie_${bonNumber}.pdf`;
    a.click();

    manager.addResultMessage(codex, 'success', `PDF épuré n° ${bonNumber} généré avec succès. Téléchargement en cours.`);
}


// =============================================================
// GESTIONNAIRES APPMANAGERS
// =============================================================

// Gestionnaire de chargement de la vue
AppManagers.DomloadManager.registerHandler('vuePurificateur', {
    presetVariableOnload(element, key) {
        window.currentView = key;
        element.setAttribute('data-loaded', 'true');
        AppManagers.log('vuePurificateur', 'info', 'Preset onload OK');
    },

    methodeOnload: async function () {
        AppManagers.log('vuePurificateur', 'success', 'Méthode onload déclenchée');
    }
});

// Gestionnaire de soumission du formulaire
AppManagers.FormManager.registerHandler('formPurificateur',
    async function (data, form, codex, manager) {
        manager.addResultMessage(codex, 'info', 'Démarrage de l\'extraction et de la purification du PDF...');
        window.AppDebug = true;

        const fileInput = data.get('fileinput');
        if (!fileInput || fileInput.size === 0) {
            manager.addResultMessage(codex, 'error', 'Veuillez sélectionner un fichier PDF.');
            return;
        }

        // Récupération du numéro de bon
        const filename = fileInput.name;
        const bonNumberMatch = filename.match(/BL(\d{16})\.pdf/i);
        const bonNumber = bonNumberMatch ? bonNumberMatch[1] : 'INCONNU';

        // 1. Conversion du fichier en tableau d'octets (ArrayBuffer)
        const arrayBuffer = await fileInput.arrayBuffer();

        // 2. Extraction du texte
        try {
            const fullText = await extractPdfText(arrayBuffer, manager, codex);
            AppManagers.log('vuePurificateur', 'debug', 'Texte extrait du PDF:', fullText);

            manager.addResultMessage(codex, 'info', 'Texte extrait du PDF. Tentative de parsage des entrées de production...');

            // 3. Parsage des données
            const entries = parseExtractedText(fullText);

            if (entries.length === 0) {
                manager.addResultMessage(codex, 'error', 'Aucune entrée valide (ID de production/Nom/Dates) trouvée. Le parsage a échoué. Vérifiez le format du BL.');
                return;
            }

            manager.addResultMessage(codex, 'info', `✅ ${entries.length} entrées de production trouvées. Création du PDF épuré...`);

            // 4. Générer le PDF épuré
            await createPurifiedPdf(entries, bonNumber, manager, codex);

        } catch (e) {
            manager.addResultMessage(codex, 'error', `Erreur critique lors du traitement du PDF : ${e.message}`);
            console.error(e);
        }
    }
);
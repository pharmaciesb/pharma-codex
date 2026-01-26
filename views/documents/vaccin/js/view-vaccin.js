/// <reference path="../../../../static/js/types.js" />
import { definirAujourdhui } from '/pharma-codex/static/js/assistants/assistant-date.js';
import { PDFFormHandler, PDFPreview, FormValidator } from '/pharma-codex/static/js/assistants/assistant-pdf-lib.js';

/**
 * Handler pour la vue Vaccin (Bon de prise en charge 611)
 * @extends {AppManagers.ViewHandler}
 */
class VaccinHandler extends AppManagers.ViewHandler {
  constructor() {
    super('viewVaccin');
    
    // Utilisation de l'assistant standardisé
    this.pdfHandler = new PDFFormHandler({
      pdfUrl: './views/documents/vaccin/pdf/611.pdf',
      fontSize: 10,
      debugMode: false
    });
  }

  // Configuration des dimensions et positions (en pourcentages)
  CONFIG = {
    bigSize: 15,
    letterSpacing: 7,
    positions: {
      pageWidth: 595.28,
      pageHeight: 841.89,
      immat: { left: 0.3300, top: 0.2938 },
      benef: { left: 0.4000, top: 0.3137 },
      naiss: { left: 0.4550, top: 0.3322 },
      organ: { left: 0.2500, top: 0.3492 },
      speci: { left: 0.2000, top: 0.5200 },
      date:  { left: 0.1600, top: 0.7326 }
    }
  };

  async onload() {
    try {
      definirAujourdhui();
      this.registerForm('formVaccin', this.handleFormSubmit);
      AppManagers.log(this.key, 'success', 'Module Vaccin initialisé');
    } catch (err) {
      AppManagers.log(this.key, 'error', 'Échec initialisation Vaccin', err);
    }
  }

  async handleFormSubmit(formData) {
    try {
      const data = this.extractData(formData);

      // 1. Validation
      const validation = FormValidator.validateRequired(data, ['nom', 'prenom', 'immatriculation', 'specialite']);
      if (!validation.valid) {
        return await AppManagers.CodexManager.show('error', validation.message);
      }

      // 2. Chargement (Sécurisé par le futur patch de l'assistant)
      await AppManagers.CodexManager.show('info', 'Chargement du modèle PDF…');
      await this.pdfHandler.loadTemplate();

      await AppManagers.CodexManager.show('info', 'Génération du bon de prise en charge…');

      // 3. Génération
      const pdfBytes = await this.generateFilledPDF(data);
      const blobUrl = this.pdfHandler.createBlobUrl(pdfBytes);
      const filename = `bon_vaccin_${data.nom}_${data.prenom}.pdf`;

      // 4. Affichage
      this.displayResult(blobUrl, filename);
      await AppManagers.CodexManager.show('success', 'Bon généré avec succès');

    } catch (err) {
      AppManagers.log(this.key, 'error', 'Erreur génération PDF:', err);
      await AppManagers.CodexManager.show('error', 'Erreur lors de la génération');
    }
  }

  extractData(formData) {
    const rawDateNaiss = formData.get("dateNaissance").trim();
    const today = new Date();
    
    return {
      nom: formData.get("nom").trim(),
      prenom: formData.get("prenom").trim(),
      immatriculation: formData.get("immatriculation").trim(),
      codeOrganisme: formData.get("codeOrganisme").trim(),
      specialite: formData.get("specialite").trim(),
      // Formatage compact pour drawSpaced (JJMMAAAA)
      dateNaissCompact: rawDateNaiss.split('-').reverse().join(''), 
      dateJourCompact: today.toLocaleDateString('fr-FR').split('/').join(''),
      dateJourFull: today.toLocaleDateString('fr-FR')
    };
  }

  async generateFilledPDF(data) {
    const { pdfDoc, page, font } = await this.pdfHandler.createDocument();
    const { pageWidth, pageHeight, ...pos } = this.CONFIG.positions;

    // Helper interne pour le dessin espacé (cases du formulaire 611)
    const drawSpaced = (text, cadre, offsetY = -5) => {
      const p = this.pdfHandler.calculatePosition(cadre, pageWidth, pageHeight, offsetY);
      let cursorX = p.x;
      for (const char of text) {
        page.drawText(char, { x: cursorX, y: p.y, size: this.CONFIG.bigSize, font });
        cursorX += font.widthOfTextAtSize(char, this.CONFIG.bigSize) + this.CONFIG.letterSpacing;
      }
    };

    // Helper pour le texte libre
    const drawNormal = (text, cadre, offsetY = -5) => {
      const p = this.pdfHandler.calculatePosition(cadre, pageWidth, pageHeight, offsetY);
      page.drawText(text, { x: p.x + 5, y: p.y, size: this.pdfHandler.config.fontSize, font });
    };

    // Remplissage selon la structure du Cerfa 611
    drawSpaced(data.immatriculation, pos.immat);
    drawNormal(`${data.nom} ${data.prenom}`, pos.benef);
    drawSpaced(data.dateNaissCompact, pos.naiss);
    drawNormal(data.codeOrganisme, pos.organ);
    drawNormal(data.specialite.toUpperCase(), pos.speci, -25);
    drawSpaced(data.dateJourCompact, pos.date, -20);

    return await this.pdfHandler.finalize(pdfDoc);
  }

  displayResult(blobUrl, filename) {
    const containerId = 'previewContainer';
    const shown = PDFPreview.show(containerId, 'pdfPreview', blobUrl);
    
    if (shown) {
      const container = document.getElementById(containerId);
      PDFPreview.addDownloadButton(container, blobUrl, filename, (url, name) => {
        fetch(url).then(res => res.blob()).then(blob => this.pdfHandler.download(blob, name));
      });
      container.scrollIntoView({ behavior: 'smooth' });
    }
  }
}

new VaccinHandler().register();
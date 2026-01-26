/// <reference path="../../../../static/js/types.js" />
import { definirAujourdhui } from '/pharma-codex/static/js/assistants/assistant-date.js';
import { PDFFormHandler, DateFormatter, PDFPreview, FormValidator } from '/pharma-codex/static/js/assistants/assistant-pdf-lib.js';

/**
 * Handler pour la vue Vaccin (Bon de prise en charge hors grippe/COVID)
 * @extends {AppManagers.ViewHandler}
 */
class VaccinHandler extends AppManagers.ViewHandler {
  constructor() {
    super('viewVaccin');

    // Assistant PDF partagé (remplace la gestion manuelle de PDFLib)
    this.pdfHandler = new PDFFormHandler({
      pdfUrl: './views/documents/vaccin/pdf/611.pdf',
      fontSize: 10,
      debugMode: false
    });
  }

  // =============================================================
  // Configuration statique
  // =============================================================
  CONFIG = {
    bigSize: 15,
    letterSpacing: 7,
    // Positions des champs (coordonnées normalisées)
    positions: {
      pageWidth: 595.28,
      pageHeight: 841.89,
      immat: { left: 0.3300, top: 0.2938, width: 0.5000, height: 0.0600 },
      benef: { left: 0.4000, top: 0.3137, width: 0.5000, height: 0.0600 },
      naiss: { left: 0.4550, top: 0.3322, width: 0.6000, height: 0.0600 },
      organ: { left: 0.2500, top: 0.3492, width: 0.6000, height: 0.0600 },
      speci: { left: 0.2000, top: 0.5200, width: 0.3500, height: 0.0600 },
      date: { left: 0.1600, top: 0.7326, width: 0.1667, height: 0.0600 },
    }
  };

  // =============================================================
  // Initialisation
  // =============================================================
  async onload() {
    try {
      definirAujourdhui();
      this.registerForm('formVaccin', this.handleFormSubmit);
      AppManagers.log(this.key, 'success', 'Module Vaccin initialisé');
    } catch (err) {
      AppManagers.log(this.key, 'error', 'Échec initialisation Vaccin', err);
      await AppManagers.CodexManager.show('error', 'Erreur au chargement du module Vaccin');
    }
  }

  // =============================================================
  // Soumission du formulaire
  // =============================================================
  async handleFormSubmit(formData, form) {
    try {
      const data = this.extractData(formData);

      // Validation via l'assistant FormValidator
      const validation = this.validateData(data);
      if (!validation.valid) {
        await AppManagers.CodexManager.show('error', validation.message);
        return;
      }

      // Chargement lazy du template
      if (!this.pdfHandler.templatePdfBytes) {
        await AppManagers.CodexManager.show('info', 'Chargement du modèle PDF…');
        await this.pdfHandler.loadTemplate();
      }

      await AppManagers.CodexManager.show('info', 'Génération du bon de prise en charge…');

      const pdfBytes = await this.generateFilledPDF(data);
      const blobUrl = this.pdfHandler.createBlobUrl(pdfBytes);
      const filename = `bon_vaccin_${data.nom}_${data.prenom}.pdf`;

      // Affichage du résultat via l'assistant PDFPreview
      this.displayResult(blobUrl, filename, data);

      await AppManagers.CodexManager.show('success', 'Bon de prise en charge généré avec succès');

    } catch (err) {
      AppManagers.log(this.key, 'error', 'Erreur génération PDF:', err);
      await AppManagers.CodexManager.show('error', err.message || 'Erreur lors de la génération');
    }
  }

  // =============================================================
  // Extraction et validation
  // =============================================================
  extractData(formData) {
    const today = new Date();
    const dateNaiss = formData.get("dateNaissance").trim();

    return {
      nom: formData.get("nom").trim(),
      prenom: formData.get("prenom").trim(),
      dateNaissance: dateNaiss,
      // On garde le format compact pour l'écriture avec espacement
      dateNaissanceCompact: DateFormatter.toFrench(dateNaiss).replace(/\//g, ''),
      immatriculation: formData.get("immatriculation").trim(),
      codeOrganisme: formData.get("codeOrganisme").trim(),
      specialite: formData.get("specialite").trim(),
      dateJour: today.toLocaleDateString("fr-FR"),
      dateJourCompact: today.toLocaleDateString("fr-FR").replace(/\//g, '')
    };
  }

  validateData(data) {
    const requiredValidation = FormValidator.validateRequired(data, [
      'nom', 'prenom', 'dateNaissance', 'immatriculation', 'codeOrganisme', 'specialite'
    ]);

    if (!requiredValidation.valid) return requiredValidation;

    const nirValidation = FormValidator.validateNIR(data.immatriculation);
    if (!nirValidation.valid) return nirValidation;

    return { valid: true };
  }

  // =============================================================
  // Génération du PDF
  // =============================================================
  async generateFilledPDF(data) {
    const { pdfDoc, page, font } = await this.pdfHandler.createDocument();

    // Correction : On extrait les dimensions et les positions depuis CONFIG.positions
    const { pageWidth, pageHeight, ...coords } = this.CONFIG.positions;

    // Helper interne pour dessiner avec espacement
    const drawSpaced = (text, cadre, offsetY = -5) => {
      // On passe explicitement les dimensions de la page pour le calcul
      const pos = this.pdfHandler.calculatePosition(cadre, pageWidth, pageHeight, offsetY);

      let cursorX = pos.x;
      for (const char of text) {
        page.drawText(char, {
          x: cursorX,
          y: pos.y,
          size: this.CONFIG.bigSize,
          font
        });
        cursorX += font.widthOfTextAtSize(char, this.CONFIG.bigSize) + this.CONFIG.letterSpacing;
      }
    };

    // Helper pour dessin normal
    const drawNormal = (text, cadre, offsetY = -5, size = this.pdfHandler.config.fontSize) => {
      const pos = this.pdfHandler.calculatePosition(cadre, pageWidth, pageHeight, offsetY);
      page.drawText(text, {
        x: pos.x + 5,
        y: pos.y,
        size,
        font
      });
    };

    // Remplissage des zones en utilisant l'objet "coords"
    drawSpaced(data.immatriculation, coords.immat);
    drawNormal(`${data.nom} ${data.prenom}`, coords.benef);
    drawSpaced(data.dateNaissanceCompact, coords.naiss);
    drawNormal(data.codeOrganisme, coords.organ);
    drawNormal(data.specialite.toUpperCase(), coords.speci, -25);
    drawSpaced(data.dateJourCompact, coords.date, -20);

    return await this.pdfHandler.finalize(pdfDoc);
  }

  // =============================================================
  // Affichage du résultat
  // =============================================================
  displayResult(blobUrl, filename, data) {
    const shown = PDFPreview.show('previewContainer', 'pdfPreview', blobUrl);

    if (!shown) {
      this.pdfHandler.download(new Blob([]), filename);
      return;
    }

    const container = document.getElementById('previewContainer');
    if (container) {
      PDFPreview.addDownloadButton(container, blobUrl, filename, (url, name) => {
        fetch(url)
          .then(res => res.blob())
          .then(blob => this.pdfHandler.download(blob, name));
      });

      container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
}

// Enregistrement automatique
new VaccinHandler().register();
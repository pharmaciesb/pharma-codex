/// <reference path="../../../../static/js/types.js" />
import { definirAujourdhui, formatFR } from '/pharma-codex/static/js/assistants/assistant-date.js';

/**
 * Handler pour la vue Vaccin (Bon de prise en charge hors grippe/COVID)
 * @extends {AppManagers.ViewHandler}
 */
class VaccinHandler extends AppManagers.ViewHandler {
  constructor() {
    super('viewVaccin');
    
    // Cache des ressources
    this.templatePdfBytes = null;
    this.PDFLib = window.PDFLib;
  }

  // =============================================================
  // Configuration statique
  // =============================================================
  CONFIG = {
    pdfUrl: './views/documents/vaccin/pdf/611.pdf',
    fontSize: 10,
    bigSize: 15,
    letterSpacing: 7,
  };

  PDF_POSITIONS = {
    pageWidth: 595.28,
    pageHeight: 841.89,
    // Cadres (pourcentages du calque HTML)
    immat: { left: 0.3300, top: 0.2938, width: 0.5000, height: 0.0600 },
    benef: { left: 0.4000, top: 0.3137, width: 0.5000, height: 0.0600 },
    naiss: { left: 0.4550, top: 0.3322, width: 0.6000, height: 0.0600 },
    organ: { left: 0.2500, top: 0.3492, width: 0.6000, height: 0.0600 },
    speci: { left: 0.2000, top: 0.5200, width: 0.3500, height: 0.0600 },
    date:  { left: 0.1600, top: 0.7326, width: 0.1667, height: 0.0600 },
  };

  // =============================================================
  // Initialisation
  // =============================================================
  async onload() {
    try {
      // 1. Date par défaut (synchrone)
      definirAujourdhui();

      // 2. Enregistrement du formulaire
      this.registerForm('formVaccin', this.handleFormSubmit);

      // 3. Chargement lazy du template PDF (au submit uniquement)
      AppManagers.log(this.key, 'success', 'Module Vaccin initialisé');
    } catch (err) {
      AppManagers.log(this.key, 'error', 'Échec initialisation Vaccin', err);
      await AppManagers.CodexManager.show('error', 'Erreur au chargement du module Vaccin');
    }
  }

  // =============================================================
  // Chargement du template PDF
  // =============================================================
  async loadPdfTemplate() {
    if (this.templatePdfBytes) return;

    if (!this.PDFLib && window.PDFLib) {
      this.PDFLib = window.PDFLib;
    }
    if (!this.PDFLib) throw new Error('PDFLib non disponible');

    const resp = await fetch(this.CONFIG.pdfUrl);
    if (!resp.ok) throw new Error(`Impossible de charger le modèle PDF (${resp.status})`);

    this.templatePdfBytes = await resp.arrayBuffer();
    AppManagers.log(this.key, 'info', 'Modèle PDF Vaccin chargé');
  }

  // =============================================================
  // Soumission du formulaire
  // =============================================================
  async handleFormSubmit(formData, form) {
    try {
      const data = this.extractData(formData);

      // Validation
      const validation = this.validateData(data);
      if (!validation.valid) {
        await AppManagers.CodexManager.show('error', validation.message);
        return;
      }

      // Chargement lazy du template (au 1er submit)
      if (!this.templatePdfBytes) {
        await AppManagers.CodexManager.show('info', 'Chargement du modèle PDF…');
        await this.loadPdfTemplate();
      }

      await AppManagers.CodexManager.show('info', 'Génération du bon de prise en charge…');

      const pdfBytes = await this.generateFilledPDF(data);

      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const blobUrl = URL.createObjectURL(blob);
      const filename = `bon_vaccin_${data.nom}_${data.prenom}.pdf`;

      // Affichage progressif du résultat
      this.displayResult(blobUrl, filename, data);

      await AppManagers.CodexManager.show('success', 'Bon de prise en charge généré avec succès');

    } catch (err) {
      AppManagers.log(this.key, 'error', 'Erreur génération PDF:', err);
      await AppManagers.CodexManager.show('error', err.message || 'Erreur lors de la génération');
    }
  }

  // =============================================================
  // Extraction et validation des données
  // =============================================================
  extractData(formData) {
    const dateIso = formData.get("dateNaissance").trim();
    const today = new Date();
    
    return {
      nom: formData.get("nom").trim(),
      prenom: formData.get("prenom").trim(),
      dateNaissance: dateIso,
      dateNaissanceFormatee: this.formatDateForPDF(dateIso),
      immatriculation: formData.get("immatriculation").trim(),
      codeOrganisme: formData.get("codeOrganisme").trim(),
      specialite: formData.get("specialite").trim(),
      dateJour: today.toLocaleDateString("fr-FR"),
      dateJourFormatee: this.formatDateForPDF(today.toLocaleDateString("fr-FR")),
    };
  }

  validateData(data) {
    const required = ["nom", "prenom", "dateNaissance", "immatriculation", "codeOrganisme", "specialite"];
    
    for (const field of required) {
      if (!data[field] || data[field] === "") {
        return { valid: false, message: `Le champ "${field}" est obligatoire` };
      }
    }

    return { valid: true };
  }

  formatDateForPDF(dateStr) {
    // Convertit JJ/MM/AAAA ou AAAA-MM-JJ en JJMMAAAA (pour letterSpacing)
    if (dateStr.includes('/')) {
      return dateStr.split('/').join(''); // JJ/MM/AAAA → JJMMAAAA
    }
    if (dateStr.includes('-')) {
      const [y, m, d] = dateStr.split('-');
      return `${d}${m}${y}`; // AAAA-MM-JJ → JJMMAAAA
    }
    return dateStr;
  }

  // =============================================================
  // Génération du PDF
  // =============================================================
  async generateFilledPDF(data) {
    if (!this.templatePdfBytes) throw new Error('Modèle PDF non chargé');

    const { PDFDocument, StandardFonts } = this.PDFLib;
    const pdfDoc = await PDFDocument.load(this.templatePdfBytes);
    const page = pdfDoc.getPages()[0];
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const beneficiaire = `${data.nom} ${data.prenom}`;

    // Helper pour dessiner avec espacement
    const drawSpaced = (text, cadre, offsetY = -5) => {
      const { pageWidth, pageHeight } = this.PDF_POSITIONS;
      const x = cadre.left * pageWidth + 5;
      const y = pageHeight - (cadre.top * pageHeight) + offsetY;
      this.drawTextWithSpacing(page, text, x, y, this.CONFIG.bigSize, font, this.CONFIG.letterSpacing);
    };

    const drawNormal = (text, cadre, offsetY = -5) => {
      const { pageWidth, pageHeight } = this.PDF_POSITIONS;
      const x = cadre.left * pageWidth + 5;
      const y = pageHeight - (cadre.top * pageHeight) + offsetY;
      page.drawText(text, { x, y, size: this.CONFIG.fontSize, font });
    };

    // Remplissage des champs
    drawSpaced(data.immatriculation, this.PDF_POSITIONS.immat);
    drawNormal(beneficiaire, this.PDF_POSITIONS.benef);
    drawSpaced(data.dateNaissanceFormatee, this.PDF_POSITIONS.naiss);
    drawNormal(data.codeOrganisme, this.PDF_POSITIONS.organ);
    drawNormal(data.specialite.toUpperCase(), this.PDF_POSITIONS.speci, -25);
    drawSpaced(data.dateJourFormatee, this.PDF_POSITIONS.date, -20);

    const form = pdfDoc.getForm();
    form.flatten();

    return await pdfDoc.save();
  }

  /**
   * Dessine du texte avec espacement entre lettres (pour les codes)
   */
  drawTextWithSpacing(page, text, x, y, size, font, spacing) {
    let cursorX = x;
    for (const char of text) {
      page.drawText(char, { x: cursorX, y, size, font });
      cursorX += font.widthOfTextAtSize(char, size) + spacing;
    }
  }

  // =============================================================
  // Affichage du résultat
  // =============================================================
  displayResult(blobUrl, filename, data) {
    const container = document.getElementById('previewContainer');
    const iframe = document.getElementById('pdfPreview');

    if (!container || !iframe) {
      // Fallback : téléchargement direct
      this.triggerDownload(blobUrl, filename);
      return;
    }

    // Affichage de la preview
    container.classList.remove('fr-hidden');
    iframe.src = blobUrl;

    // Ajout du bouton de téléchargement
    this.addDownloadButton(container, blobUrl, filename);

    // Scroll vers le résultat
    container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  addDownloadButton(container, blobUrl, filename) {
    // Évite les doublons
    const existingBtn = container.querySelector('.download-btn');
    if (existingBtn) existingBtn.remove();

    const btnWrapper = document.createElement('div');
    btnWrapper.className = 'fr-mt-2v';
    btnWrapper.innerHTML = `
      <button class="fr-btn fr-btn--secondary download-btn" type="button">
        📥 Télécharger le PDF
      </button>
    `;

    container.insertBefore(btnWrapper, container.firstChild);

    const btn = btnWrapper.querySelector('.download-btn');
    this.addListener(btn, 'click', () => this.triggerDownload(blobUrl, filename));
  }

  triggerDownload(blobUrl, filename) {
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

// Enregistrement automatique
new VaccinHandler().register();
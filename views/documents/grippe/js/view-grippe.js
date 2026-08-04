/// <reference path="../../../../static/js/types.js" />

import { definirAujourdhui } from 'assistants/date';
import { initMasks } from 'assistants/masks';
import { parseGS1 } from 'assistants/datamatrix';
import { PDFFormHandler, DateFormatter, PDFPreview, FormValidator } from 'assistants/pdf-lib';

/**
 * Handler pour la vue Grippe (Bon de prise en charge vaccination grippale)
 * @extends {AppManagers.ViewHandler}
 */
class GrippeHandler extends AppManagers.ViewHandler {
  constructor() {
    super('viewGrippe');

    // Initialisation sans URL fixe (configurée dynamiquement au submit)
    this.pdfHandler = new PDFFormHandler({
      fontSize: 10,
      debugMode: false
    });

    this.vaccinsData = [];
    this._currentPdfUrl = null; // Suivi du fichier actuellement en mémoire
  }

  // =============================================================
  // Configuration statique
  // =============================================================
  CONFIG = {
    vaccinsJsonUrl: './views/documents/grippe/json/vaccins.json',

    // Chemins des différents templates
    templates: {
      standard: './views/documents/grippe/pdf/610d.pdf',
      injection: './views/documents/grippe/pdf/610d-injection.pdf'
    },

    positions: {
      pageWidth: 595.28,
      pageHeight: 841.89,
      specialiteTop: { left: 0.136500, top: 0.499200, width: 0.270000, height: 0.060000 },
      dateTop: { left: 0.420000, top: 0.499200, width: 0.130000, height: 0.060000 },
      dateBot: { left: 0.17326, top: 0.782300, width: 0.300000, height: 0.060000 },
      lotBot: { left: 0.250000, top: 0.808000, width: 0.300000, height: 0.060000 }
    }
  };

  async onload() {
    try {
      definirAujourdhui();
      initMasks();
      await this.loadVaccinsData();
      this.setupDataMatrixScanner();
      this.registerForm('formGrippe', this.handleFormSubmit);
      AppManagers.log(this.key, 'success', 'Module Grippe initialisé');
    } catch (err) {
      AppManagers.log(this.key, 'error', 'Échec initialisation Grippe', err);
    }
  }
  // =============================================================
  // Chargement des données vaccins
  // =============================================================
  async loadVaccinsData() {
    if (this.vaccinsData.length > 0) return;

    try {
      const response = await fetch(this.CONFIG.vaccinsJsonUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      this.vaccinsData = await response.json();
      AppManagers.log(this.key, 'success', `${this.vaccinsData.length} vaccins chargés`);
    } catch (err) {
      AppManagers.log(this.key, 'error', 'Erreur chargement vaccins:', err);
      this.vaccinsData = [];
    }
  }

  // =============================================================
  // Scan DataMatrix
  // =============================================================
  setupDataMatrixScanner() {
    const scanInput = this.getElement('datamatrix-input', false);
    if (!scanInput) return;

    // Événement change (après scan)
    this.addListener(scanInput, 'change', this.handleDatamatrixScan);

    // Bloque la soumission par Enter
    this.addListener(scanInput, 'keydown', (e) => {
      if (e.key === 'Enter' || e.keyCode === 13) {
        e.preventDefault();
        // Force le trigger du change si pas déjà fait
        e.target.dispatchEvent(new Event('change'));
      }
    });
  }

  handleDatamatrixScan(e) {
    const gs1Code = e.target.value.trim();
    const lotInput = this.getElement('lot', false);
    const denominationEl = this.getElement('vaccin-denomination', false);
    const specialiteSelect = this.getElement('specialite', false);

    if (!gs1Code) return;

    const result = parseGS1(gs1Code);

    if (result) {
      // 1. Remplir le champ lot
      if (lotInput) lotInput.value = result.lot;

      // 2. Trouver la dénomination du vaccin
      const cip13 = result.ean;
      const vaccin = this.vaccinsData.find(v => v.code_cip === cip13);

      // 3. Afficher les infos
      if (denominationEl) {
        if (vaccin) {
          denominationEl.innerHTML = `
            ✅ <strong>${vaccin.denomination}</strong><br>
            <small>Lot: ${result.lot} | Expiration: ${result.expiration}</small>
          `;
          denominationEl.className = 'fr-text--sm fr-mt-1w';

          // Pré-sélectionner le vaccin
          if (specialiteSelect) {
            specialiteSelect.value = vaccin.denomination;
          }
        } else {
          denominationEl.innerHTML = `
            ⚠️ <strong>Vaccin inconnu</strong><br>
            <small>CIP: ${cip13} | Lot: ${result.lot}</small>
          `;
          denominationEl.className = 'fr-text--sm fr-mt-1w fr-error-text';
        }
      }

      AppManagers.log(this.key, 'success', `Scan GS1 OK: ${vaccin?.denomination || cip13}`);
    } else {
      if (lotInput) lotInput.value = '';
      if (denominationEl) {
        denominationEl.textContent = '❌ Format GS1 non reconnu';
        denominationEl.className = 'fr-text--sm fr-mt-1w fr-error-text';
      }
      AppManagers.log(this.key, 'error', 'Format GS1 invalide');
    }
  }

  // =============================================================
  // Soumission du formulaire
  // =============================================================
  async handleFormSubmit(formData, form) {
    try {
      const data = this.extractData(formData);

      const validation = this.validateData(data);
      if (!validation.valid) {
        await AppManagers.CodexManager.show('error', validation.message);
        return;
      }

      // 1. Détermination de l'URL du fichier
      const targetUrl = data.avecInjection
        ? this.CONFIG.templates.injection
        : this.CONFIG.templates.standard;

      // 2. Changement dynamique du fichier (Correction du cache)
      if (this._currentPdfUrl !== targetUrl) {
        // On force l'assistant à oublier l'ancien fichier
        this.pdfHandler.templatePdfBytes = null;
        this.pdfHandler._loadPromise = null;
        this.pdfHandler.config.pdfUrl = targetUrl;

        await AppManagers.CodexManager.show('info', 'Chargement du modèle PDF…');
        await this.pdfHandler.loadTemplate();
        this._currentPdfUrl = targetUrl;
      }

      await AppManagers.CodexManager.show('info', 'Génération du bon…');

      const pdfBytes = await this.generateFilledPDF(data);
      const blobUrl = this.pdfHandler.createBlobUrl(pdfBytes);
      const filename = `bon_grippe_${data.nom}_${data.prenom}.pdf`;

      this.displayResult(blobUrl, filename, data);
      await AppManagers.CodexManager.show('success', 'Bon généré avec succès');

    } catch (err) {
      AppManagers.log(this.key, 'error', 'Erreur génération PDF:', err);
      await AppManagers.CodexManager.show('error', 'Erreur lors de la génération');
    }
  }

  // =============================================================
  // Extraction et validation des données
  // =============================================================
  extractData(formData) {
    const today = new Date();
    return {
      nom: formData.get("nom").trim(),
      prenom: formData.get("prenom").trim(),
      dateNaissance: formData.get("dateNaissance").trim(),
      immatriculation: formData.get("immatriculation").trim(),
      codeOrganisme: formData.get("codeOrganisme").trim(),
      specialite: formData.get("specialite").trim(),
      lot: formData.get("lot").trim(),
      avecInjection: formData.get("avecInjection") === "on",
      dateJour: today.toLocaleDateString("fr-FR")
    };
  }

  validateData(data) {
    const requiredValidation = FormValidator.validateRequired(data, [
      'nom', 'prenom', 'dateNaissance', 'immatriculation',
      'codeOrganisme', 'specialite', 'lot'
    ]);
    if (!requiredValidation.valid) return requiredValidation;

    return FormValidator.validateNIR(data.immatriculation);
  }

  // =============================================================
  // Génération du PDF
  // =============================================================
  async generateFilledPDF(data) {
    const { pdfDoc, page, font } = await this.pdfHandler.createDocument();
    const form = pdfDoc.getForm();

    // Remplissage des champs de formulaire (Partie commune)
    const fieldMap = {
      "N° immat": data.immatriculation,
      "Bénéficiaire": `${data.nom} ${data.prenom}`,
      "Date": DateFormatter.toFrench(data.dateNaissance),
      "Code organisme": data.codeOrganisme
    };

    for (const [name, value] of Object.entries(fieldMap)) {
      this.pdfHandler.fillTextField(form, name, value);
    }

    const { pageWidth, pageHeight, specialiteTop, dateTop, dateBot, lotBot } = this.CONFIG.positions;
    const calcPos = (cadre, offsetY = -25) => this.pdfHandler.calculatePosition(cadre, pageWidth, pageHeight, offsetY);

    // Écriture Haut (Spécialité + Date)
    page.drawText(data.specialite.toUpperCase(), {
      x: calcPos(specialiteTop).x,
      y: calcPos(specialiteTop).y,
      size: this.pdfHandler.config.fontSize,
      font
    });

    page.drawText(data.dateJour, {
      x: calcPos(dateTop).x,
      y: calcPos(dateTop).y,
      size: this.pdfHandler.config.fontSize,
      font
    });

    // 3 - LOGIQUE BAS DE PAGE : Uniquement si injection est COCHÉE
    if (data.avecInjection) {
      const posDateBot = calcPos(dateBot);
      const posLotBot = calcPos(lotBot);

      page.drawText(data.dateJour, {
        x: posDateBot.x,
        y: posDateBot.y,
        size: this.pdfHandler.config.fontSize,
        font
      });

      page.drawText(data.lot, {
        x: posLotBot.x,
        y: posLotBot.y,
        size: this.pdfHandler.config.fontSize,
        font
      });
    }

    return await this.pdfHandler.finalize(pdfDoc);
  }

  // =============================================================
  // Affichage du résultat
  // =============================================================
  displayResult(blobUrl, filename, data) {
    const shown = PDFPreview.show('previewContainer', 'pdfPreview', blobUrl);

    if (!shown) {
      // Fallback : téléchargement direct
      this.pdfHandler.download(new Blob([]), filename);
      return;
    }

    // Ajout du bouton de téléchargement
    const container = document.getElementById('previewContainer');
    if (container) {
      PDFPreview.addDownloadButton(container, blobUrl, filename, (url, name) => {
        // Téléchargement via fetch du blob
        fetch(url)
          .then(res => res.blob())
          .then(blob => this.pdfHandler.download(blob, name));
      });

      // Scroll vers le résultat
      container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
}

new GrippeHandler().register();
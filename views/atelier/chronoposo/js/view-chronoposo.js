/// <reference path="../../../../static/js/types.js" />

import { downloadBlob } from 'assistants/share-export';
import { ChronoposoAssistant } from 'assistants/chronoposo';

// Exposer l'assistant globalement pour debugging
window.ChronoposoAssistant = ChronoposoAssistant;

/**
 * Handler pour Chronoposo - Modification des dates de Plan de Posologie
 * @extends {AppManagers.ViewHandler}
 */
class ChronoposoHandler extends AppManagers.ViewHandler {
  constructor() {
    super('viewChronoposo');

    this._pdfFile = null;           // Fichier PDF chargé
    this._pdfBytes = null;          // Bytes du PDF (pour extraction)
    this._pdfDoc = null;            // Document PDF.lib
    this._currentStep = 1;
    this._dateProduction = null;
    this._dateDebut = null;
    this._dateFin = null;
  }

  async onload() {
    this._currentStep = 1;
    this.updateStepper();

    // --- Étape 1 : Upload ---
    const dropzone = this.getElement('chronoposo-dropzone', false);
    const fileInput = this.getElement('chronoposo-file-input', false);

    if (dropzone && fileInput) {
      this.addListener(dropzone, 'click', () => fileInput.click());
      this.addListener(dropzone, 'keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          fileInput.click();
        }
      });

      this.addListener(fileInput, 'change', (e) => {
        const file = e.target.files?.[0];
        if (file && file.type === 'application/pdf') {
          this.handleFileImport(file);
        } else {
          this.showAlert('Veuillez sélectionner un fichier PDF', 'error');
        }
      });

      // Drag & drop
      this.addListener(dropzone, 'dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });
      this.addListener(dropzone, 'dragleave', () => dropzone.classList.remove('dragover'));
      this.addListener(dropzone, 'drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        const file = e.dataTransfer.files?.[0];
        if (file && file.type === 'application/pdf') {
          this.handleFileImport(file);
        }
      });
    }

    this.bindElement('chronoposo-btn-to-step2', 'click', () => this.goToStep(2));
    this.bindElement('chronoposo-btn-clear-import', 'click', () => this.resetImport());

    // --- Étape 2 : Modifier dates ---
    this.bindElement('chronoposo-btn-back-to-1', 'click', () => this.goToStep(1));
    this.bindElement('chronoposo-btn-apply-dates', 'click', () => this.applyDatesChanges());

    // --- Étape 3 : Télécharger ---
    this.bindElement('chronoposo-btn-download', 'click', () => this.downloadPDF());
    this.bindElement('chronoposo-btn-restart', 'click', () => this.restart());

    AppManagers.log(this.key, 'success', 'Chronoposo initialisé');
  }

  /**
   * Gestion de l'import du fichier PDF
   */
  async handleFileImport(file) {
    this._pdfFile = file;
    this._pdfBytes = null; // Stocker les bytes pour extraction

    // Afficher les infos du fichier
    const fileInfo = this.getElement('chronoposo-file-info', false);
    const fileName = this.getElement('chronoposo-file-name', false);
    const fileSize = this.getElement('chronoposo-file-size', false);

    if (fileInfo && fileName && fileSize) {
      fileName.textContent = file.name;
      fileSize.textContent = (file.size / 1024).toFixed(2) + ' KB';
      fileInfo.style.display = 'block';
    }

    // Charger les bytes du PDF pour extraction ultérieure
    try {
      this._pdfBytes = new Uint8Array(await file.arrayBuffer());
    } catch (error) {
      console.warn('Erreur lors de la lecture des bytes:', error);
    }

    // Afficher les boutons
    const btnStep2 = this.getElement('chronoposo-btn-to-step2', false);
    const btnClear = this.getElement('chronoposo-btn-clear-import', false);
    if (btnStep2) btnStep2.style.display = 'inline-block';
    if (btnClear) btnClear.style.display = 'inline-block';

    AppManagers.log(this.key, 'success', `Fichier chargé : ${file.name}`);
  }

  /**
   * Réinitialiser l'import
   */
  resetImport() {
    this._pdfFile = null;
    this._pdfBytes = null;
    this._pdfDoc = null;

    const fileInput = this.getElement('chronoposo-file-input', false);
    if (fileInput) fileInput.value = '';

    const fileInfo = this.getElement('chronoposo-file-info', false);
    if (fileInfo) fileInfo.style.display = 'none';

    const btnStep2 = this.getElement('chronoposo-btn-to-step2', false);
    const btnClear = this.getElement('chronoposo-btn-clear-import', false);
    if (btnStep2) btnStep2.style.display = 'none';
    if (btnClear) btnClear.style.display = 'none';

    AppManagers.log(this.key, 'info', 'Import réinitialisé');
  }

  /**
   * Appliquer les modifications de dates
   */
  async applyDatesChanges() {
    const dateProduction = this.getElement('chronoposo-date-production', false)?.value;
    const dateDebut = this.getElement('chronoposo-date-debut', false)?.value;
    const dateFin = this.getElement('chronoposo-date-fin', false)?.value;

    if (!dateDebut || !dateFin) {
      this.showAlert('Veuillez remplir au minimum les dates de pilulier', 'error');
      return;
    }

    // Valider que la date de fin >= date de début
    if (new Date(dateFin) < new Date(dateDebut)) {
      this.showAlert('La date de fin doit être après la date de début', 'error');
      return;
    }

    try {
      // Charger le PDF avec PDF.lib
      const arrayBuffer = await this._pdfFile.arrayBuffer();
      this._pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);

      // Convertir les dates au format français (DD/MM/YYYY)
      this._dateProduction = dateProduction ? this.formatDateFR(dateProduction) : null;
      this._dateDebut = this.formatDateFR(dateDebut);
      this._dateFin = this.formatDateFR(dateFin);

      // Modifier les dates dans le PDF
      await ChronoposoAssistant.modifyDates(
        this._pdfDoc,
        this._pdfBytes,
        this._dateProduction,
        this._dateDebut,
        this._dateFin
      );

      // Afficher aperçu
      const previewProduction = this.getElement('chronoposo-preview-production', false);
      const previewDebut = this.getElement('chronoposo-preview-debut', false);
      const previewFin = this.getElement('chronoposo-preview-fin', false);
      
      if (previewProduction) {
        previewProduction.textContent = this._dateProduction || '(non modifiée)';
      }
      if (previewDebut) previewDebut.textContent = this._dateDebut;
      if (previewFin) previewFin.textContent = this._dateFin;

      this.showAlert('Dates modifiées avec succès', 'success');
      this.goToStep(3);
    } catch (error) {
      AppManagers.log(this.key, 'error', error.message);
      this.showAlert(`Erreur lors de la modification : ${error.message}`, 'error');
    }
  }

  /**
   * Télécharger le PDF modifié
   */
  async downloadPDF() {
    if (!this._pdfDoc) {
      this.showAlert('Document non prêt pour téléchargement', 'error');
      return;
    }

    try {
      const pdfBytes = await this._pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });

      // Générer le nom du fichier
      const originalName = this._pdfFile.name.replace('.pdf', '');
      const newName = `${originalName}-modifie-${Date.now()}.pdf`;

      downloadBlob(blob, newName);
      AppManagers.log(this.key, 'success', 'PDF téléchargé');
    } catch (error) {
      AppManagers.log(this.key, 'error', error.message);
      this.showAlert(`Erreur lors du téléchargement : ${error.message}`, 'error');
    }
  }

  /**
   * Réinitialiser le module
   */
  restart() {
    this._pdfFile = null;
    this._pdfDoc = null;
    this._dateProduction = null;
    this._dateDebut = null;
    this._dateFin = null;

    // Réinitialiser les inputs
    const fileInput = this.getElement('chronoposo-file-input', false);
    const dateProduction = this.getElement('chronoposo-date-production', false);
    const dateDebut = this.getElement('chronoposo-date-debut', false);
    const dateFin = this.getElement('chronoposo-date-fin', false);

    if (fileInput) fileInput.value = '';
    if (dateProduction) dateProduction.value = '';
    if (dateDebut) dateDebut.value = '';
    if (dateFin) dateFin.value = '';

    this.resetImport();
    this.goToStep(1);
    AppManagers.log(this.key, 'info', 'Module réinitialisé');
  }

  /**
   * Naviguer entre les étapes
   */
  goToStep(n) {
    this._currentStep = n;
    this.updateStepper();

    for (let i = 1; i <= 3; i++) {
      const panel = this.getElement(`chronoposo-panel-${i}`, false);
      if (panel) {
        if (i === n) {
          panel.classList.remove('fr-hidden');
        } else {
          panel.classList.add('fr-hidden');
        }
      }
    }

    const numEl = this.getElement('chronoposo-step-num', false);
    if (numEl) numEl.textContent = n;
  }

  /**
   * Mettre à jour le stepper DSFR
   */
  updateStepper() {
    const stepper = document.querySelector('.fr-stepper__steps');
    if (stepper) {
      stepper.dataset.frCurrentStep = String(this._currentStep);
    }
  }

  /**
   * Formater une date YYYY-MM-DD en DD/MM/YYYY
   */
  formatDateFR(isoDate) {
    const [year, month, day] = isoDate.split('-');
    return `${day}/${month}/${year}`;
  }

  /**
   * Afficher une alerte
   */
  showAlert(message, type = 'info') {
    const alertEl = this.getElement('chronoposo-alert-dates', false);
    const textEl = this.getElement('chronoposo-alert-text', false);

    if (alertEl && textEl) {
      textEl.textContent = message;
      alertEl.className = `fr-alert fr-alert--${type}`;
      alertEl.style.display = 'block';

      // Auto-hide après 5 secondes si success
      if (type === 'success') {
        setTimeout(() => {
          alertEl.style.display = 'none';
        }, 5000);
      }
    }
  }
}

new ChronoposoHandler().register();
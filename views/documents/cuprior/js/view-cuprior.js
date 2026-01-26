/// <reference path="../../../../static/js/types.js" />
import { definirAujourdhui, formatFR } from '/pharma-codex/static/js/assistants/assistant-date.js';
import { initCopyListeners } from '/pharma-codex/static/js/assistants/assistant-clipboard.js';
import { PDFFormHandler, PDFPreview, FormValidator } from '/pharma-codex/static/js/assistants/assistant-pdf-lib.js';

class CupriorHandler extends AppManagers.ViewHandler {
  constructor() {
    super('viewCuprior');
    this.pdfHandler = new PDFFormHandler({
      pdfUrl: '/pharma-codex/views/documents/cuprior/pdf/Bon de Commande Orphalan - VF.pdf',
      fontSize: 10
    });
    this.courrielTemplate = null;
    this._isLoading = false; // Verrou pour le lazy loading
  }

  CONFIG = {
    emailTemplateUrl: './views/documents/cuprior/partials/courriel.html',
    pageWidth: 595.28,
    pageHeight: 841.89
  };

  // Positions absolues (vérifiées)
  PDF_POSITIONS = {
    date: [{ x: 160, y: 660 }, { x: 250, y: 25 }],
    etablissement: [{ x: 160, y: 570 }],
    pharmacien_nom: [{ x: 160, y: 515 }],
    pharmacien_rpps: [{ x: 160, y: 495 }],
    numero_tva: [{ x: 160, y: 535 }],
    contact: [{ x: 160, y: 415 }],
    adresse: [{ x: 160, y: 390 }],
    code_postale: [{ x: 160, y: 370 }],
    telephone: [{ x: 160, y: 345 }],
    fax: [{ x: 160, y: 320 }],
    mail: [{ x: 160, y: 295 }],
    quantite: [{ x: 75, y: 170 }],
    commentaire: [{ x: 75, y: 120 }],
  };

  async onload() {
    definirAujourdhui();
    this.registerForm('formCuprior', this.handleFormSubmit);
    initCopyListeners((msg, type) => AppManagers.log(this.key, type || 'info', msg));
  }

  /**
   * Gestion sécurisée du chargement des ressources
   */
  async _prepareResources() {
    if (this._isLoading) return;
    this._isLoading = true;

    try {
      // Chargement du PDF si absent
      if (!this.pdfHandler.templatePdfBytes) {
        AppManagers.log(this.key, 'info', 'Téléchargement du modèle PDF...');
        await this.pdfHandler.loadTemplate();
        
        // Vérification de sécurité immédiate
        if (!this.pdfHandler.templatePdfBytes || this.pdfHandler.templatePdfBytes.byteLength === 0) {
          throw new Error("Le fichier PDF téléchargé est vide ou inaccessible.");
        }
      }

      // Chargement du template email si absent
      if (!this.courrielTemplate) {
        this.courrielTemplate = await AppManagers.TemplateManager.load(this.CONFIG.emailTemplateUrl);
      }
    } finally {
      this._isLoading = false;
    }
  }

  async handleFormSubmit(formData) {
    try {
      const data = this.extractData(formData);

      // 1. Validation
      const validation = FormValidator.validateRequired(data, ['etablissement', 'pharmacien_nom', 'quantite']);
      if (!validation.valid) {
        return await AppManagers.CodexManager.show('error', validation.message);
      }

      // 2. Chargement (Lazy Loading sécurisé)
      await AppManagers.CodexManager.show('info', 'Préparation du document...');
      await this._prepareResources();

      // 3. Génération
      const pdfBytes = await this.generateFilledPDF(data);
      
      // Sécurité 0 ko : on vérifie avant de créer le Blob
      if (!pdfBytes || pdfBytes.byteLength === 0) {
        throw new Error("Échec de la génération : le flux PDF est vide.");
      }

      const blobUrl = this.pdfHandler.createBlobUrl(pdfBytes);
      const filename = `bon_cuprior_${new Date().toISOString().slice(0, 10)}.pdf`;

      // 4. Interface
      this.displayResult(blobUrl, filename);
      await this.renderEmailForm(data, blobUrl, filename);

      await AppManagers.CodexManager.show('success', 'Bon de commande prêt.');

    } catch (err) {
      AppManagers.log(this.key, 'error', 'Erreur critique', err);
      await AppManagers.CodexManager.show('error', `Erreur : ${err.message}`);
    }
  }

  extractData(formData) {
    return {
      date: formatFR(formData.get('date')),
      etablissement: formData.get('etablissement')?.trim() || '',
      pharmacien_nom: formData.get('pharmacien_nom')?.trim() || '',
      pharmacien_rpps: formData.get('pharmacien_rpps')?.trim() || '',
      numero_tva: formData.get('numero_tva')?.trim() || '',
      contact: formData.get('contact')?.trim() || '',
      adresse: formData.get('adresse')?.trim() || '',
      code_postale: formData.get('code_postale')?.trim() || '',
      telephone: formData.get('telephone')?.trim() || '',
      fax: formData.get('fax')?.trim() || '',
      mail: formData.get('mail')?.trim() || '',
      quantite: formData.get('quantite')?.trim() || '1',
      commentaire: formData.get('commentaire')?.trim() || '',
    };
  }

  async generateFilledPDF(data) {
    const { pdfDoc, page, font } = await this.pdfHandler.createDocument();

    // Remplissage
    Object.entries(this.PDF_POSITIONS).forEach(([field, coords]) => {
      const value = String(data[field] ?? '').trim();
      coords.forEach(({ x, y }) => {
        page.drawText(value, {
          x, y,
          size: this.pdfHandler.config.fontSize,
          font
        });
      });
    });

    return await this.pdfHandler.finalize(pdfDoc);
  }

  displayResult(blobUrl, filename) {
    const containerId = 'cuprior-output';
    PDFPreview.show(containerId, 'pdfPreview', blobUrl);
    
    const container = document.getElementById(containerId);
    if (container) {
      PDFPreview.addDownloadButton(container, blobUrl, filename, (url, name) => {
        fetch(url).then(r => r.blob()).then(b => this.pdfHandler.download(b, name));
      });
      container.scrollIntoView({ behavior: 'smooth' });
    }
  }

  async renderEmailForm(data, blobUrl, filename) {
    const container = document.getElementById('cuprior-output');
    if (!container || !this.courrielTemplate) return;

    const html = AppManagers.TemplateManager.renderString(this.courrielTemplate, {
      date_jour: data.date,
      quantite: data.quantite,
      contact: data.contact || data.pharmacien_nom,
      etablissement: data.etablissement,
      adresse: data.adresse,
      code_postale: data.code_postale,
    });

    const div = document.createElement('div');
    div.className = 'fr-mt-4w';
    div.innerHTML = html;
    
    const bodyField = div.querySelector('#cuprior-mail-body');
    if (bodyField) {
        bodyField.value = `Bonjour,\n\nVeuillez trouver ci-joint le bon de commande pour ${data.quantite} boîte(s) de Cuprior.\n\nCordialement,\n${data.contact || data.pharmacien_nom}\n${data.etablissement}`;
    }

    container.appendChild(div);
    
    // Injection du lien caché pour l'assistant d'envoi mail
    const wrapper = document.createElement('div');
    wrapper.id = 'cuprior-pdf-wrapper';
    wrapper.innerHTML = `<a id="pdf-attachment" data-blob-url="${blobUrl}" data-filename="${filename}"></a>`;
    container.appendChild(wrapper);

    await initCopyListeners((msg, type) => AppManagers.log(this.key, type || 'info', msg));
  }
}

new CupriorHandler().register();
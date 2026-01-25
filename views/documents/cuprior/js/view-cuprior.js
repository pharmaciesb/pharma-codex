/// <reference path="../../../../static/js/types.js" />
import { definirAujourdhui, formatFR } from '/pharma-codex/static/js/assistants/assistant-date.js';
import { initCopyListeners } from '/pharma-codex/static/js/assistants/assistant-clipboard.js';

/**
 * Handler pour la vue Cuprior (Bon de commande Orphalan)
 * @extends {AppManagers.ViewHandler}
 */
class CupriorHandler extends AppManagers.ViewHandler {
  constructor() {
    super('viewCuprior');   // ← correspond à l'id de la vue / data-view-key

    // Cache des ressources
    this.templatePdfBytes = null;
    this.courrielTemplate = null;
    this.PDFLib = window.PDFLib;
  }

  // =============================================================
  // Configuration statique
  // =============================================================
  CONFIG = {
    pdfUrl: '/pharma-codex/views/documents/cuprior/pdf/Bon de Commande Orphalan - VF.pdf',
    emailTemplateUrl: './views/documents/cuprior/partials/courriel.html',
    fontSize: 10,
    debugMode: false,
  };

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

  // =============================================================
  // Initialisation de la vue
  // =============================================================
  async onload() {
    try {
      // 1. Date par défaut (synchrone, pas besoin d'attendre)
      definirAujourdhui();

      // 2. Enregistrement du formulaire (ne dépend pas des templates)
      this.registerForm('formCuprior', this.handleFormSubmit);

      // 3. Activation des boutons copier
      await initCopyListeners((msg, type) => {
        AppManagers.log(this.key, type || 'info', msg);
      });

      // 4. Chargement lazy des templates (au submit, pas au load)
      // Gain : page s'affiche instantanément, PDF chargé à la demande
      AppManagers.log(this.key, 'success', 'Module Cuprior initialisé');
    } catch (err) {
      AppManagers.log(this.key, 'error', 'Échec initialisation Cuprior', err);
      await AppManagers.CodexManager.show('error', 'Erreur au chargement du module Cuprior');
    }
  }

  // =============================================================
  // Chargement des ressources
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

    if (this.CONFIG.debugMode) {
      // Optionnel : lister les champs interactifs du PDF
      const { listFormFields } = await import('/pharma-codex/static/js/assistants/assistant-pdf.js');
      await listFormFields(this.templatePdfBytes, this.PDFLib);
    }

    AppManagers.log(this.key, 'info', 'Modèle PDF Cuprior chargé');
  }

  async loadEmailTemplate() {
    if (this.courrielTemplate) return;

    this.courrielTemplate = await AppManagers.TemplateManager.load(this.CONFIG.emailTemplateUrl);
    AppManagers.log(this.key, 'info', 'Template email Cuprior chargé');
  }

  // =============================================================
  // Soumission du formulaire
  // =============================================================
  async handleFormSubmit(formData, form) {
    try {
      AppManagers.CodexManager.show('info', 'Génération du bon Cuprior…');

      await Promise.all([
        this.loadPdfTemplate(),
        this.loadEmailTemplate(),
      ]);

      const data = this.extractData(formData);

      // Optionnel : validation minimale
      if (!data.quantite || isNaN(Number(data.quantite)) || Number(data.quantite) < 1) {
        throw new Error('La quantité doit être un nombre ≥ 1');
      }

      const pdfBytes = await this.generateFilledPDF(data);

      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const blobUrl = URL.createObjectURL(blob);
      const filename = `bon_cuprior_${new Date().toISOString().slice(0, 10)}.pdf`;

      // 1. Aperçu
      this.showPdfPreview(blobUrl);

      // 2. Téléchargement automatique
      this.triggerDownload(blobUrl, filename);

      // 3. Affichage + remplissage du bloc email
      await this.renderEmailForm(data, blobUrl, filename);

      AppManagers.CodexManager.show('success', 'Bon Cuprior généré avec succès');
    } catch (err) {
      AppManagers.log(this.key, 'error', 'Erreur génération Cuprior', err);
      AppManagers.CodexManager.show('error', err.message || 'Erreur lors de la génération');
    }
  }

  // =============================================================
  // Helpers
  // =============================================================
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
    if (!this.templatePdfBytes) throw new Error('Modèle PDF non chargé');

    const { PDFDocument, StandardFonts } = this.PDFLib;
    const pdfDoc = await PDFDocument.load(this.templatePdfBytes);
    const page = pdfDoc.getPages()[0];
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    Object.entries(this.PDF_POSITIONS).forEach(([field, positions]) => {
      const value = String(data[field] ?? '').trim();
      positions.forEach(({ x, y }) => {
        page.drawText(value, {
          x, y,
          size: this.CONFIG.fontSize,
          font,
          lineHeight: this.CONFIG.fontSize * 1.15,
        });
      });
    });

    return await pdfDoc.save();
  }

  showPdfPreview(blobUrl) {
    const container = document.getElementById('cuprior-output');
    if (!container) return;

    const iframe = document.createElement('iframe');
    iframe.src = blobUrl;
    iframe.style.cssText = 'width:100%; height:600px; border:1px solid #ccc; margin-bottom:1.5rem;';
    container.prepend(iframe);   // ou append selon l'ordre souhaité
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

  async renderEmailForm(data, blobUrl, filename) {
    const container = document.getElementById('cuprior-output');
    if (!container || !this.courrielTemplate) return;

    // Option 1 : utilisation de TemplateManager (recommandé)
    const html = AppManagers.TemplateManager.renderString(this.courrielTemplate, {
      date_jour: data.date,
      quantite: data.quantite,
      contact: data.contact || data.pharmacien_nom,
      etablissement: data.etablissement,
      adresse: data.adresse,
      code_postale: data.code_postale,
    });

    // Injection
    const div = document.createElement('div');
    div.innerHTML = html;

    // Mise à jour dynamique des champs (si besoin)
    const subject = div.querySelector('#cuprior-mail-subject');
    if (subject) {
      subject.value = `Cuprior — Bon de commande du ${data.date}`;
    }

    const body = div.querySelector('#cuprior-mail-body');
    if (body) {
      body.value = this.buildEmailBody(data);
    }

    container.appendChild(div);

    // Stockage de la référence PDF pour envoi futur
    const wrapper = document.getElementById('cuprior-pdf-wrapper') || document.createElement('div');
    wrapper.id = 'cuprior-pdf-wrapper';
    wrapper.innerHTML = `<a id="pdf-attachment" data-blob-url="${blobUrl}" data-filename="${filename}"></a>`;
    container.appendChild(wrapper);

    // Ré-init des copy listeners (car DOM modifié)
    await initCopyListeners((msg, type) => AppManagers.log(this.key, type || 'info', msg));
  }

  buildEmailBody(data) {
    return `Bonjour,

Veuillez trouver ci-joint le bon de commande pour ${data.quantite} boîte(s) de Cuprior.

Cordialement,
${data.contact || data.pharmacien_nom || 'Pharmacien'}
${data.etablissement || ''}
${data.adresse || ''} ${data.code_postale || ''}
`.trim();
  }
}

// Enregistrement automatique
new CupriorHandler().register();
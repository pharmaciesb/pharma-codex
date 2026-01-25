/// <reference path="../../../../static/js/types.js" />

import { removeAccents } from '/pharma-codex/static/js/assistants/assistant-string.js';

let items = [];

/**
 * Handler pour la vue Trombinoscope
 * @extends {AppManagers.ViewHandler}
 */
class TrombinoscopeHandler extends AppManagers.ViewHandler {
  constructor() {
    super('viewTrombinoscope');
  }

  async onload() {
    AppManagers.PdfAssistant.reset();

    // Enregistre les forms
    this.registerForm('formTrombinoscopeAutomatique', this.handleImportAuto);
    this.registerForm('formTrombinoscopeManuel', this.handleAjoutManuel);

    // Ajout des listeners
    this.bindElement('btnClear', 'click', this.handleClear);
    this.bindElement('btnPreview', 'click', this.handlePreview);

    // Debug
    window.trombinoscopeItems = items;
  }

  /**
   * Gère la suppression de la liste
   */
  async handleClear(e) {
    e.preventDefault();
    if (items.length > 0 && confirm('Vider toute la liste ?')) {
      items = [];
      await this.refreshAll();
      AppManagers.CodexManager?.show('info', 'Liste vidée');
    }
  }

  /**
   * Affiche la prévisualisation
   */

  async handlePreview(e) {
    e.preventDefault();
    if (items.length > 0) {
      const target = this.getElement('trombinoscope-output');
      if (target) {
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    }
  }

  /**
   * Gère l'import automatique (Excel/JSON)
   */
  async handleImportAuto(data, form) {
    try {
      const input = document.getElementById('fileinput');
      if (!input?.files?.length) {
        await AppManagers.CodexManager.show('warn', 'Veuillez sélectionner un fichier');
        return;
      }

      const file = input.files[0];
      const extension = file.name.toLowerCase().split('.').pop();

      if (extension === 'json') {
        await this.importJSON(file);
      } else if (['xlsx', 'xlsm', 'xls'].includes(extension)) {
        await this.importExcel(file);
      } else {
        await AppManagers.CodexManager.show('error', 'Format non supporté');
      }

    } catch (err) {
      AppManagers.log(this.key, 'error', 'Erreur import:', err);
      await AppManagers.CodexManager.show('error', `Erreur: ${err.message}`);
    }
  }

  /**
   * Importe un fichier JSON
   */
  async importJSON(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          this.fusionnerDonnees(data);
          resolve();
        } catch (err) {
          reject(new Error('JSON invalide'));
        }
      };
      reader.onerror = () => reject(new Error('Erreur lecture fichier'));
      reader.readAsText(file);
    });
  }

  /**
   * Importe un fichier Excel
   */
  async importExcel(file) {
    if (!window.XLSX) {
      throw new Error('XLSX (SheetJS) non chargé');
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const workbook = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });

          let validSheet = null;
          let idxNom = -1;
          let idxPrenom = -1;

          for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

            if (!rows.length) continue;

            const headers = rows[0].map(h => removeAccents(String(h)).toLowerCase());
            const iNom = headers.findIndex(h => h.includes('nom'));
            const iPrenom = headers.findIndex(h => h.includes('prenom'));

            if (iNom !== -1 && iPrenom !== -1) {
              validSheet = sheet;
              idxNom = iNom;
              idxPrenom = iPrenom;
              break;
            }
          }

          if (!validSheet) {
            throw new Error('Aucune feuille avec colonnes NOM/PRÉNOM trouvée');
          }

          const rows = XLSX.utils.sheet_to_json(validSheet, { header: 1 });
          const extracted = rows
            .slice(1)
            .map(r => ({ NOM: r[idxNom], PRENOM: r[idxPrenom] }))
            .filter(x => x.NOM && x.PRENOM);

          if (!extracted.length) {
            throw new Error('Aucune donnée valide trouvée');
          }

          this.fusionnerDonnees(extracted);
          resolve();

        } catch (err) {
          reject(err);
        }
      };

      reader.onerror = () => reject(new Error('Erreur lecture fichier'));
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Gère l'ajout manuel
   */
  async handleAjoutManuel(data, form) {
    try {
      const nom = data.get('nom')?.trim();
      const prenom = data.get('prenom')?.trim();

      if (!nom || !prenom) {
        await AppManagers.CodexManager.show('warn', 'Nom et prénom requis');
        return;
      }

      items.push({
        NOM: nom.toUpperCase(),
        PRENOM: prenom
      });

      await this.refreshAll();
      form.reset();

      await AppManagers.CodexManager.show('success', 'Entrée ajoutée');

    } catch (err) {
      AppManagers.log(this.key, 'error', 'Erreur ajout:', err);
      await AppManagers.CodexManager.show('error', `Erreur: ${err.message}`);
    }
  }

  /**
   * Fusionne des données importées
   */
  fusionnerDonnees(data) {
    data.forEach(x => {
      items.push({
        NOM: String(x.NOM).toUpperCase(),
        PRENOM: String(x.PRENOM)
      });
    });

    this.refreshAll();
    AppManagers.CodexManager.show('success', `${data.length} entrée(s) ajoutée(s)`);
  }

  /**
   * Rafraîchit la liste et la preview
   */
  async refreshAll() {
    this.renderListe();

    if (!items.length) {
      const outputEl = document.getElementById('trombinoscope-output');
      if (outputEl) outputEl.innerHTML = '<small>Aperçu du PDF ici</small>';
      return;
    }

    // Vérifie QRious
    if (!window.QRious) {
      await AppManagers.CodexManager.show('error', 'QRious non chargé');
      return;
    }

    // Prépare les items avec QR codes
    const preparedItems = items.map(item => ({
      ...item,
      qrCodeDataUrl: this.genererQRCode(item)
    }));

    // Génère la preview avec PdfAssistant
    await AppManagers.PdfAssistant.generate({
      items: preparedItems,
      itemTemplateUrl: "./views/atelier/trombinoscope/partials/template-item.html",
      pageTemplateUrl: "./views/atelier/trombinoscope/partials/template-page.html",
      columns: 3,
      rows: 3,
      filename: `Trombinoscope_${new Date().toISOString().slice(0, 10)}.pdf`,
      targetElementId: '#trombinoscope-output'
    });
  }

  /**
   * Génère un QR code pour un item
   */
  genererQRCode(item) {
    const qr = new QRious({
      value: removeAccents(item.NOM + '+' + item.PRENOM),
      size: 126, // Double de 63 pour meilleure qualité
      level: 'H'
    });
    return qr.canvas.toDataURL();
  }

  /**
   * Rend la liste des items
   */
  renderListe() {
    const listEl = document.getElementById('data-list');
    if (!listEl) return;

    if (!items.length) {
      listEl.innerHTML = '<tr><td colspan="3" class="fr-text--center">Aucune entrée.</td></tr>';
      return;
    }

    listEl.innerHTML = items.map((item, idx) => `
            <tr>
                <td>${item.NOM}</td>
                <td>${item.PRENOM}</td>
                <td>
                    <button data-idx="${idx}" class="delete-item fr-btn fr-icon-delete-bin-line fr-btn--tertiary fr-mt-0">Supprimer</button>
                </td>
            </tr>
        `).join('');

    // Listeners de suppression
    listEl.querySelectorAll('.delete-item').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        items.splice(btn.dataset.idx, 1);
        await this.refreshAll();
      });
    });
  }
}

new TrombinoscopeHandler().register();
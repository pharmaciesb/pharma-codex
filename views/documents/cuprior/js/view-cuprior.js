import { definirAujourdhui, formatFR } from '/pharma-codex/static/js/assistants/assistant-date.js';

// =============================================================
// Vue Cuprior – PDF remplissable via PDF-LIB
// =============================================================
AppManagers.DomloadManager.registerHandler('vueCuprior', {
  presetVariableOnload(element, key) {
    try {
      window.currentView = key;
      element.setAttribute('data-loaded', 'true');
      AppManagers.log('vueCuprior', 'info', 'Preset onload OK');
    } catch (err) {
      console.error('[vueCuprior] Erreur presetVariableOnload :', err);
    }
  },

  methodeOnload: async function () {
    AppManagers.log('vueCuprior', 'success', 'Méthode onload déclenchée');
    await definirAujourdhui();
  }
});

// =============================================================
// FormManager – Remplissage du Bon Cuprior
// =============================================================
AppManagers.FormManager.registerHandler('formCuprior',
  async function (data, form, codex, manager) {
    try {

      manager.addResultMessage(codex, 'info', 'Remplissage du bon Cuprior en cours...');
     
      // --- Récupération des valeurs du formulaire
      const champs = {
        date: await formatFR(data.get("date")),
        etablissement: data.get("etablissement"),
        pharmacien_nom: data.get("pharmacien_nom"),
        pharmacien_rpps: data.get("pharmacien_rpps"),
        numero_tva: data.get("numero_tva"),
        contact: data.get("contact"),
        adresse: data.get("adresse"),
        code_postale: data.get("code_postale"),
        telephone: data.get("telephone"),
        fax: data.get("fax"),
        mail: data.get("mail"),
        quantite: data.get("quantite"),
        commentaire: data.get("commentaire")
      };

      // --- Charger le PDF existant
      const pdfBytes = await fetch('./views/documents/cuprior/pdf/Bon de Commande Orphalan - VF.pdf')
        .then(r => r.arrayBuffer());

      const { PDFDocument, StandardFonts } = PDFLib;
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const page = pdfDoc.getPages()[0];

      // Police
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontSize = 10;

      // =============================================================
      // Coordonnées d'après ton script Python
      // (tu pourras les ajuster en direct si besoin)
      // =============================================================
      const positions = {
        date:            [{x:160, y:660}, {x:250, y:25}],  // tu ajusteras
        etablissement:   [{x:160, y:570}],
        pharmacien_nom:  [{x:160, y:515}],
        pharmacien_rpps: [{x:160, y:495}],
        numero_tva:      [{x:160, y:535}],
        contact:         [{x:160, y:415}],
        adresse:         [{x:160, y:390}],
        code_postale:    [{x:160, y:370}],
        telephone:       [{x:160, y:345}],
        fax:             [{x:160, y:320}],
        mail:            [{x:160, y:295}],
        quantite:        [{x:75,  y:170}],
        commentaire:     [{x:75,  y:120}]
      };

      // =============================================================
      // Écriture des champs sur le PDF
      // =============================================================
      for (const [champ, coords] of Object.entries(positions)) {
        coords.forEach(pos => {
          page.drawText(String(champs[champ] ?? ""), {
            x: pos.x,
            y: pos.y,
            font,
            size: fontSize
          });
        });
      }

      // =============================================================
      // Génération du PDF final
      // =============================================================
      const finalPdf = await pdfDoc.save();
      const blob = new Blob([finalPdf], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      // Aperçu PDF optionnel
      const previewEl = document.getElementById('cupriorPreview');
      if (previewEl) {
        previewEl.src = url;
      }

      // Téléchargement immédiat
      const a = document.createElement('a');
      a.href = url;
      a.download = `bon_cuprior_${new Date().toISOString().slice(0,10)}.pdf`;
      a.click();

      manager.addResultMessage(codex, 'success', 'Bon Cuprior généré avec succès.');

    } catch (err) {
      console.error(err);
      manager.addResultMessage(codex, 'error', 'Erreur Cuprior : ' + err);
    }
  }
);

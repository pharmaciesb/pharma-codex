// -- Vue DomloadManager
AppManagers.DomloadManager.registerHandler('vueVaccin', {
  presetVariableOnload: function (element, key) {
    window.currentView = key;
    element.setAttribute('data-loaded', 'true');
    AppManagers.log('vueVaccin', 'info', 'Vue vaccin chargée.');
  },

  methodeOnload: async function () {
    AppManagers.log('vueVaccin', 'success', 'Méthode onload OK - Vue vaccin prête.');
  }
});

// -- FormManager : remplissage précis des champs PDF du formulaire grippe
AppManagers.FormManager.registerHandler('formVaccin', async function (data, form, codex, manager, validator) {
  try {
    // Champs requis de base
    const required = ["nom", "prenom", "dateNaissance", "immatriculation", "codeOrganisme"];
    for (const f of required) {
      if (!data.get(f) || data.get(f).trim() === "") {
        manager.addResultMessage(codex, 'error', `Le champ "${f}" est obligatoire.`);
        return;
      }
    }

    // Récupération des données
    const nom = data.get("nom").trim();
    const prenom = data.get("prenom").trim();
    const beneficiaire = `${nom} ${prenom}`;
    const dateIso = data.get("dateNaissance").trim();
    const immat = data.get("immatriculation").trim();
    const codeOrganisme = data.get("codeOrganisme").trim();
    const specialite = data.get("specialite");

    // Date du jour auto
    const today = new Date();
    const dateJour = today.toLocaleDateString("fr-FR"); // format JJ/MM/AAAA

    // Format date patient
    let dateForPdf = dateIso;
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) {
      const [y, m, d] = dateIso.split("-");
      dateForPdf = `${d}${m}${y}`;
    }

    let dateJourForPdf = dateJour;
    if (dateJour.includes('/')) {
      dateJourForPdf = dateJour.split('/').join('');
    }

    manager.addResultMessage(codex, 'info', 'Remplissage du document en cours...');

    // Chargement du modèle
    const existingPdfBytes = await fetch('./views/documents/vaccin/pdf/611.pdf').then(r => r.arrayBuffer());
    const { PDFDocument } = PDFLib;
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const formPdf = pdfDoc.getForm();

    // Embed font pour le drawText des zones spéciales
    const font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
    const page = pdfDoc.getPages()[0];
    const size = 10;
    const bigSize = 15;
    const letterSpacing = 7;

    // Etendre la méthode drawText pour le letterSpacing
    function drawTextWithSpacing(page, text, x, y, size, font, spacing) {
      let cursorX = x;
      for (const char of text) {
        page.drawText(char, { x: cursorX, y, size, font });
        cursorX += font.widthOfTextAtSize(char, size) + spacing;
      }
    }

    // --- Coordonnées calculées depuis ton calque HTML ---
    const pageWidth = 595.28;
    const pageHeight = 841.89;

    const immatCadre = { left: 0.3300 * pageWidth, top: 0.2938 * pageHeight, width: 0.5000 * pageWidth, height: 0.060000 * pageHeight };
    const benefCadre = { left: 0.4000 * pageWidth, top: 0.3137 * pageHeight, width: 0.5000 * pageWidth, height: 0.060000 * pageHeight };
    const naissCadre = { left: 0.4550 * pageWidth, top: 0.3322 * pageHeight, width: 0.6000 * pageWidth, height: 0.060000 * pageHeight };
    const organCadre = { left: 0.2500 * pageWidth, top: 0.3492 * pageHeight, width: 0.6000 * pageWidth, height: 0.060000 * pageHeight };
    const speciCadre = { left: 0.2000 * pageWidth, top: 0.5200 * pageHeight, width: 0.3500 * pageWidth, height: 0.060000 * pageHeight };
    const dateCadre = { left: 0.1600 * pageWidth, top: 0.7326 * pageHeight, width: 0.1667 * pageWidth, height: 0.060000 * pageHeight };

    // Convertir top% en coordonnées PDF (origine en bas à gauche)
    const yimmatCadre = pageHeight - immatCadre.top - 5;
    const ybenefCadre = pageHeight - benefCadre.top - 5;
    const ynaissCadre = pageHeight - naissCadre.top - 5;
    const yorganCadre = pageHeight - organCadre.top - 5;
    const yspeciCadre = pageHeight - speciCadre.top - 25;
    const ydateCadre = pageHeight - dateCadre.top - 20;

    const texteVaccin = `${specialite.toUpperCase()}`;
    // Remplissage des champs bénéficiaire
    drawTextWithSpacing(page, immat, immatCadre.left + 5, yimmatCadre, bigSize, font, letterSpacing);
    page.drawText(beneficiaire, { x: benefCadre.left + 5, y: ybenefCadre, size, font });
    drawTextWithSpacing(page, dateForPdf, naissCadre.left + 5, ynaissCadre, bigSize, font, letterSpacing);
    page.drawText(codeOrganisme, { x: organCadre.left + 5, y: yorganCadre, size, font });

    // Remplissage des champs vaccin
    page.drawText(texteVaccin, { x: speciCadre.left + 5, y: yspeciCadre, size, font });
    drawTextWithSpacing(page, dateJourForPdf, dateCadre.left + 5, ydateCadre, bigSize, font, letterSpacing);
    //page.drawText(texteDate, { x: dateCadre.left + 5, y: ydateCadre, digitSize, font });

    formPdf.flatten();

    // Génération du PDF final
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const blobUrl = URL.createObjectURL(blob);

    // Prévisualisation
    const previewContainer = document.getElementById('previewContainer');
    const pdfPreview = document.getElementById('pdfPreview');
    if (previewContainer && pdfPreview) {
      pdfPreview.src = blobUrl;
      previewContainer.classList.remove('fr-hidden');
    }

    // Téléchargement
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `bon_vaccin_${nom}_${prenom}.pdf`;
    a.click();

    manager.addResultMessage(codex, 'success', 'Le bon de prise en charge a été généré avec succès.');
  } catch (err) {
    AppManagers.log('formVaccin', 'error', 'Erreur génération PDF', err);
    manager.addResultMessage(codex, 'error', 'Erreur lors de la génération : ' + (err.message || err));
  }
});

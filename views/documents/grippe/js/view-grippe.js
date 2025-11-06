// -- Vue DomloadManager
AppManagers.DomloadManager.registerHandler('vueGrippe', {
  presetVariableOnload: function(element, key) {
    window.currentView = key;
    element.setAttribute('data-loaded', 'true');
    AppManagers.log('vueGrippe', 'info', 'Vue grippe chargée.');
  },

  methodeOnload: async function() {
    AppManagers.log('vueGrippe', 'success', 'Méthode onload OK - Vue grippe prête.');
  }
});

// -- FormManager : remplissage précis des champs PDF du formulaire grippe
AppManagers.FormManager.registerHandler('formGrippe', async function (data, form, codex, manager, validator) {
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
    const specialite = data.get("specialite") || "Influvac";
    const avecInjection = data.get("avecInjection") === "on";

    // Date du jour auto
    const today = new Date();
    const dateJour = today.toLocaleDateString("fr-FR"); // format JJ/MM/AAAA

    // Format date patient
    let dateForPdf = dateIso;
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) {
      const [y, m, d] = dateIso.split("-");
      dateForPdf = `${d}/${m}/${y}`;
    }

    manager.addResultMessage(codex, 'info', 'Remplissage du document en cours...');

    // Chargement du modèle
    const existingPdfBytes = await fetch('./views/documents/grippe/pdf/610d.pdf').then(r => r.arrayBuffer());
    const { PDFDocument } = PDFLib;
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const formPdf = pdfDoc.getForm();

    // Remplissage des champs connus du formulaire
    const fieldMap = {
      "N° immat": immat,
      "Bénéficiaire": beneficiaire,
      "Date": dateForPdf,
      "Code organisme": codeOrganisme
    };

    for (const [name, value] of Object.entries(fieldMap)) {
      const field = formPdf.getTextField(name);
      if (field) field.setText(String(value));
    }

    // Embed font pour le drawText des zones spéciales
    const font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
    const page = pdfDoc.getPages()[0];
    const size = 10;

    // --- Coordonnées calculées depuis ton calque HTML ---
    const pageWidth = 595.28;
    const pageHeight = 841.89;

    // Cadre Haut spécialité
    const specialiteTop = {
      left: 0.136500 * pageWidth,
      top: 0.499200 * pageHeight,
      width: 0.270000 * pageWidth,
      height: 0.060000 * pageHeight
    };
    // Cadre Haut date
    const dateTop = {
      left: 0.420000 * pageWidth,
      top: 0.499200 * pageHeight,
      width: 0.130000 * pageWidth,
      height: 0.060000 * pageHeight
    };
    // Cadre Bas date
    const dateBot = {
      left: 0.17326 * pageWidth,
      top: 0.782300 * pageHeight,
      width: 0.300000 * pageWidth,
      height: 0.060000 * pageHeight
    };

    // Convertir top% en coordonnées PDF (origine en bas à gauche)
    const ySpecialiteTop = pageHeight - specialiteTop.top - 25;
    const yDateTop = pageHeight - dateTop.top - 25;
    const yDateBot = pageHeight - dateBot.top - 25;

    // Texte : "Influvac  06/11/2025"
    const texteVaccin = `${specialite.toUpperCase()}`;
    const texteDate = `${dateJour}`;    
    page.drawText(texteVaccin, {x: specialiteTop.left + 5,y: ySpecialiteTop ,size,font});    
    page.drawText(texteDate, {x: dateTop.left + 5,y: yDateTop ,size,font});

    // Second cadre si injection cochée
    if (avecInjection) {    
      page.drawText(texteDate, {x: dateBot.left + 5,y: yDateBot,size,font});
    }

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
    a.download = `bon_grippe_${nom}_${prenom}.pdf`;
    a.click();

    manager.addResultMessage(codex, 'success', 'Le bon de prise en charge a été généré avec succès.');
  } catch (err) {
    AppManagers.log('formGrippe', 'error', 'Erreur génération PDF', err);
    manager.addResultMessage(codex, 'error', 'Erreur lors de la génération : ' + (err.message || err));
  }
});

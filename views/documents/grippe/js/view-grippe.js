import { parseGS1 } from '/pharma-codex/static/js/assistants/assistant-datamatrix.js';
// Déclarer des variables à la portée du module (hors des handlers)
let PDFLib = window.PDFLib; // Assumant que PDFLib est une variable globale
let templatePdfBytes = null;
let vaccinsData = []; // Stockage des données de vaccins

// -- Vue DomloadManager
AppManagers.DomloadManager.registerHandler('vueGrippe', {
  presetVariableOnload: function (element, key) {
    window.currentView = key;
    element.setAttribute('data-loaded', 'true');
    AppManagers.log('vueGrippe', 'info', 'Vue grippe chargée.');
  },

  methodeOnload: async function () {
    AppManagers.log('vueGrippe', 'success', 'Méthode onload OK - Vue grippe prête.');
    // --- NOUVEAU : Chargement unique des ressources PDF ---
    try {
      // 1. Récupération de PDFLib (si non global)
      // (Si PDFLib est chargé par <script>, cette ligne est juste une vérification)
      if (!PDFLib && window.PDFLib) {
        PDFLib = window.PDFLib;
      }
      if (!PDFLib) {
        // Gérer le chargement asynchrone si nécessaire, mais si c'est une lib globale, ça devrait être OK.
        AppManagers.log('vueGrippe', 'error', 'PDFLib non trouvé.');
        return;
      }

      // 2. Chargement du modèle PDF (UNE SEULE FOIS)
      if (!templatePdfBytes) {
        AppManagers.log('vueGrippe', 'info', 'Chargement asynchrone du modèle PDF...');
        const pdfUrl = `./views/documents/grippe/pdf/610d.pdf`;
        const response = await fetch(pdfUrl);
        if (!response.ok) throw new Error("Échec du chargement du modèle PDF.");
        templatePdfBytes = await response.arrayBuffer();
        AppManagers.log('vueGrippe', 'success', 'Modèle PDF chargé et mis en cache.');
      }

      // 3. Chargement des données de vaccins (UNE SEULE FOIS)// 2. Chargement des données de vaccins (NOUVEAU)
      if (vaccinsData.length === 0) {
        AppManagers.log('vueGrippe', 'info', 'Chargement des données vaccins...');
        const dataUrl = `./views/documents/grippe/json/vaccins.json`;
        const response = await fetch(dataUrl);
        if (!response.ok) throw new Error(`Échec du chargement des données vaccins : ${dataUrl}`);
        vaccinsData = await response.json();
        AppManagers.log('vueGrippe', 'success', `${vaccinsData.length} vaccins chargés.`);
      }

    } catch (err) {
      AppManagers.log('vueGrippe', 'error', 'Erreur de chargement des dépendances PDF/Data:', err);
    }
    // 4. Gestion du scan Data Matrix (NOUVEAU)
    const datamatrixInput = document.getElementById('datamatrix-input');
    if (datamatrixInput) {
      datamatrixInput.addEventListener('change', handleDatamatrixScan);
      // NOUVEAU : Événement 'keydown' pour bloquer la soumission par 'Enter'
      datamatrixInput.addEventListener('keydown', blockFormSubmissionOnEnter);
    }
  }
});
/**
 * Empêche l'appui sur la touche Entrée de soumettre le formulaire.
 * @param {KeyboardEvent} e 
 */
function blockFormSubmissionOnEnter(e) {
  // Vérifie si la touche pressée est 'Enter' (code 13 ou 'Enter')
  if (e.key === 'Enter' || e.keyCode === 13) {
    AppManagers.log('vueGrippe', 'action', 'Soumission du formulaire bloquée par Entrée sur champ scan.');

    // Annule l'action par défaut de la touche Entrée (qui est de soumettre le formulaire)
    e.preventDefault();

    // Pour garantir que le 'change' est bien déclenché si ce n'est pas déjà le cas :
    // (Le scanner déclenche souvent 'change' juste avant le 'Enter')
    e.target.dispatchEvent(new Event('change'));
  }
}
/**
 * Gère le changement dans le champ de scan GS1
 * @param {Event} e 
 */
function handleDatamatrixScan(e) {
  const gs1Code = e.target.value.trim();
  const lotInput = document.getElementById('lot');
  const denominationEl = document.getElementById('vaccin-denomination');

  if (!gs1Code) return;

  const result = parseGS1(gs1Code);

  if (result) {
    // 1. Trouver la dénomination
    const cip13 = result.ean;
    const vaccin = vaccinsData.find(v => v.code_cip === cip13);

    // 2. Mettre à jour les champs du formulaire
    lotInput.value = result.lot;

    // 3. Afficher la dénomination
    if (vaccin) {
      denominationEl.textContent = `Vaccin détecté: ${vaccin.denomination} (Lot: ${result.lot}, Exp: ${result.expiration})`;
      // Mettre à jour le champ "specialite" si vous l'avez dans le formulaire
      const specialiteInput = document.querySelector('[name="specialite"]');
      if (specialiteInput) specialiteInput.value = vaccin.denomination;
    } else {
      denominationEl.textContent = `Vaccin inconnu (CIP: ${cip13}). Lot: ${result.lot}`;
    }

    AppManagers.log('vueGrippe', 'success', `Scan GS1 OK. Lot: ${result.lot}`);
  } else {
    lotInput.value = '';
    denominationEl.textContent = 'Erreur: Format GS1 non reconnu.';
    AppManagers.log('vueGrippe', 'error', 'Format GS1 invalide.');
  }
}

// -- FormManager : remplissage précis des champs PDF du formulaire grippe
AppManagers.FormManager.registerHandler('formGrippe', async function (data, form, codex, manager, validator) {
  try {
    if (!templatePdfBytes || !PDFLib) {
      manager.addResultMessage(codex, 'error', 'Erreur: Les ressources PDF ne sont pas chargées. Veuillez recharger la page.');
      return;
    }

    // Récupération des données
    const nom = data.get("nom").trim();
    const prenom = data.get("prenom").trim();
    const beneficiaire = `${nom} ${prenom}`;
    const dateIso = data.get("dateNaissance").trim();
    const immat = data.get("immatriculation").trim();
    const codeOrganisme = data.get("codeOrganisme").trim();
    const specialite = data.get("specialite") || "Influvac";
    const lot = data.get("lot").trim();
    if (!lot) {
      manager.addResultMessage(codex, 'error', 'Le numéro de lot est manquant.');
      return;
    }
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
    const existingPdfBytes = templatePdfBytes;
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
    const lotBot = {
      left: 0.250000 * pageWidth,
      top: 0.808000 * pageHeight,
      width: 0.300000 * pageWidth,
      height: 0.060000 * pageHeight
    };

    // Convertir top% en coordonnées PDF (origine en bas à gauche)
    const ySpecialiteTop = pageHeight - specialiteTop.top - 25;
    const yDateTop = pageHeight - dateTop.top - 25;
    const yDateBot = pageHeight - dateBot.top - 25;
    // NOUVEAU : Cadre Lot (estimation: sous le champ "Code Organisme")
    const yLotBot = pageHeight - lotBot.top - 25;
    // Texte : "Influvac  06/11/2025"
    const texteVaccin = `${specialite.toUpperCase()}`;
    const texteDate = `${dateJour}`;
    page.drawText(texteVaccin, { x: specialiteTop.left + 5, y: ySpecialiteTop, size, font });
    page.drawText(texteDate, { x: dateTop.left + 5, y: yDateTop, size, font });
    page.drawText(lot, { x: lotBot.left + 5, y: yLotBot, size, font });
    // Second cadre si injection cochée
    if (avecInjection) {
      page.drawText(texteDate, { x: dateBot.left + 5, y: yDateBot, size, font });
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

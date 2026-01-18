import { definirAujourdhui, formatFR } from '/pharma-codex/static/js/assistants/assistant-date.js';
import { initCopyListeners } from '/pharma-codex/static/js/assistants/assistant-clipboard.js';

let PDFLib = window.PDFLib; // Récupérer la lib globale
let templatePdfBytes = null; // Cache pour le modèle PDF
let courrielTemplate = null;

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
    definirAujourdhui();

    // NOUVEAU : Chargement du template de courriel
    try {
      const tplUrl = './views/documents/cuprior/partials/courriel.html';
      const response = await fetch(tplUrl);
      if (response.ok) {
        courrielTemplate = await response.text();
        AppManagers.log('vueCuprior', 'info', 'Template courriel chargé.');
      } else {
        AppManagers.log('vueCuprior', 'error', 'Échec du chargement du template courriel.');
      }
    } catch (err) {
      AppManagers.log('vueCuprior', 'error', 'Erreur chargement Template courriel:', err);
    }

    // NOUVEAU : Chargement asynchrone unique du modèle PDF
    try {
      if (!PDFLib && window.PDFLib) { PDFLib = window.PDFLib; }
      if (!PDFLib) throw new Error("PDFLib non trouvé.");

      if (!templatePdfBytes) {
        // Utilisation de BASE_URL si nécessaire, comme discuté précédemment. 
        // Je suppose l'utilisation de window.BASE_URL ici pour la résilience.
        const pdfUrl = `/pharma-codex/views/documents/cuprior/pdf/Bon de Commande Orphalan - VF.pdf`;
        AppManagers.log('vueCuprior', 'info', 'Chargement du modèle PDF...');
        const response = await fetch(pdfUrl);
        if (!response.ok) throw new Error("Échec du chargement du modèle PDF.");
        templatePdfBytes = await response.arrayBuffer();
        AppManagers.log('vueCuprior', 'success', 'Modèle PDF chargé et mis en cache.');

      }
    } catch (err) {
      AppManagers.log('vueCuprior', 'error', 'Erreur chargement PDF/PDFLib:', err);
    }
  }
});

// =============================================================
// FormManager – Remplissage du Bon Cuprior
// =============================================================
AppManagers.FormManager.registerHandler('formCuprior',
  async function (data, form, codex, manager) {
    try {
      // NOUVEAU : Vérification de la librairie PDF-LIB
      if (typeof PDFLib === 'undefined') {
        
        AppManagers.CodexManager.show('error', 'La librairie PDF-LIB est manquante. Impossible de générer le PDF.');
        return;
      }

      AppManagers.CodexManager.show('info', 'Remplissage du bon Cuprior en cours...');

      // --- Récupération des valeurs du formulaire
      const champs = {
        date: formatFR(data.get("date")),
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
      if (!templatePdfBytes || !PDFLib) {
        AppManagers.CodexManager.show('error', 'Ressources PDF non chargées. Réessayez.');
        return;
      }

      const { PDFDocument, StandardFonts } = PDFLib;
      const pdfDoc = await PDFDocument.load(templatePdfBytes);
      const page = pdfDoc.getPages()[0];

      // Police
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontSize = 10;

      // =============================================================
      // Coordonnées d'après ton script Python
      // (tu pourras les ajuster en direct si besoin)
      // =============================================================
      const positions = {
        date: [{ x: 160, y: 660 }, { x: 250, y: 25 }],  // tu ajusteras
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
        commentaire: [{ x: 75, y: 120 }]
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

      // NOUVEAU : Référence au conteneur de sortie
      const outputEl = document.getElementById('cuprior-output');
      outputEl.innerHTML = ''; // Nettoyer l'output précédent (messages d'info)

      // Aperçu PDF optionnel (CORRECTION DE L'ID)
      const previewEl = document.createElement('iframe');
      previewEl.id = 'cupriorPreviewFrame'; // Utiliser un ID unique
      previewEl.src = url;
      previewEl.style.width = '100%';
      previewEl.style.height = '600px';
      previewEl.style.border = '1px solid var(--border-default-grey)';
      previewEl.style.marginBottom = '2rem';

      // Injecter l'iframe avant l'email
      outputEl.appendChild(previewEl);

      // Téléchargement immédiat
      const a = document.createElement('a');
      a.href = url;
      a.download = `bon_cuprior_${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();

      // --- 4. Intégration et Remplissage du Courriel (NOUVEAU)
      if (courrielTemplate) {
        // Préparation du contenu dynamique
        const dateFr = champs.date;
        const bodyText = `Bonjour,\n\nVeuillez trouver ci-joint le bon de commande pour ${champs.quantite} Cuprior.\n\nCordialement,\n${champs.contact}\n${champs.etablissement}\n${champs.adresse}\n${champs.code_postale}`;

        let html = courrielTemplate;

        // Remplissage des variables
        html = html.replace(/\[\[DATE_JOUR\]\]/g, dateFr); // Date dans l'objet

        // Remplissage du corps et des informations statiques du template
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;

        // Mise à jour de l'Objet
        const subjectInput = tempDiv.querySelector('#cuprior-mail-subject');
        if (subjectInput) {
          subjectInput.value = `Cuprior — Bon de Commande du ${dateFr}`;
        }

        // Mise à jour du Corps
        const bodyTextarea = tempDiv.querySelector('#cuprior-mail-body');
        if (bodyTextarea) {
          bodyTextarea.value = bodyText;
        }

        // Injection dans l'output, après l'aperçu PDF
        outputEl.appendChild(tempDiv);
      }
      
      AppManagers.CodexManager.show('success', 'Bon Cuprior généré avec succès.');

      // NOUVEAU : Affichage du courriel
      await AppManagers.TemplateManager.renderInto(
        `/pharma-codex/views/documents/cuprior/partials/courriel.html`,
        {
          // Données à injecter dans le template
          date_jour: champs.date, // Format FR (ex: 23/11/2025)
          quantite: champs.quantite,
          contact: champs.contact,
          etablissement: champs.etablissement,
          adresse: champs.adresse,
          code_postale: champs.code_postale
        },
        '#cuprior-output', // Cible dans cuprior.html
        true // Remplacer le contenu précédent
      );

      // Mettre le PDF généré en cache dans le wrapper pour un futur envoi
      // (Ceci est une étape nécessaire si vous implémentez l'envoi réel plus tard)
      const pdfWrapper = document.getElementById('cuprior-pdf-wrapper');
      if (pdfWrapper) {
        pdfWrapper.innerHTML = `<a id="pdf-attachment" data-blob-url="${url}" data-filename="${a.download}"></a>`;
      }
      await initCopyListeners(AppManagers.log);
    } catch (err) {
      console.error(err);
      AppManagers.CodexManager.show('error', 'Erreur Cuprior : ' + err);
    }
  }
);

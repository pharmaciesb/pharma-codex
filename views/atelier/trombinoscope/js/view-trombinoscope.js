import { removeAccents } from '/pharma-codex/static/js/assistants/assistant-string.js';
let items = [];
let trombiTemplate = null; // Cache pour le modèle HTML

// =====================================================================
//  view-trombinoscope.js – Version complète intégrée au Pharma-Codex
// =====================================================================
AppManagers.DomloadManager.registerHandler('vueTrombinoscope', {
  presetVariableOnload(element, key) {
    try {
      window.currentView = key;
      element.setAttribute('data-loaded', 'true');
      AppManagers.log('vueTrombinoscope', 'info', 'Preset onload OK');
    } catch (err) {
      console.error('[vueTrombinoscope] Erreur presetVariableOnload :', err);
    }
  },

  methodeOnload: async function () {
    AppManagers.log('vueTrombinoscope', 'success', 'Chargement de la vue Trombinoscope');

    // --- 0) PRÉ-CHARGEMENT DU TEMPLATE HTML (Amélioration Performance) ---
    try {
      const tplUrl = `/pharma-codex/views/atelier/trombinoscope/partials/trombinoscope.html`;
      const response = await fetch(tplUrl);
      if (!response.ok) throw new Error("Échec du chargement du template HTML.");
      trombiTemplate = await response.text();
      AppManagers.log('vueTrombinoscope', 'success', 'Template HTML chargé et mis en cache.');
    } catch (err) {
      AppManagers.log('vueTrombinoscope', 'error', 'Erreur chargement Template HTML:', err);
    }

    // --- Références DOM principales ---
    const listEl = document.getElementById('data-list');

    // Boutons globaux
    const previewBtn = document.getElementById('btnPreview');
    const generateBtn = document.getElementById('btnGenerate');

    // =====================================================================
    // 1) RENDU DE LA LISTE COURANTE
    // =====================================================================
    function renderList() {
      listEl.innerHTML = '';

      items.forEach((it, idx) => {
        const tr = document.createElement('tr');

        // NOM
        const tdNom = document.createElement('td');
        tdNom.textContent = it.NOM;
        tr.appendChild(tdNom);

        // PRÉNOM
        const tdPrenom = document.createElement('td');
        tdPrenom.textContent = it.PRENOM;
        tr.appendChild(tdPrenom);

        // ACTION
        const tdAction = document.createElement('td');

        const btn = document.createElement('button');
        btn.className = 'fr-btn fr-btn--secondary fr-btn--sm';
        btn.textContent = 'Supprimer';
        btn.onclick = () => {
          items.splice(idx, 1);
          renderList();
        };

        tdAction.appendChild(btn);
        tr.appendChild(tdAction);

        listEl.appendChild(tr);
      });
    }


    // =====================================================================
    // 2) IMPORT AUTOMATIQUE : FormManager Listener
    // =====================================================================
    AppManagers.FormManager.registerHandler('formTrombinoscopeAutomatique', async function (data, form, codex, manager) {
      try {
        const input = document.getElementById('fileinput');
        if (!input.files?.length) {
          AppManagers.CodexManager.show('warning', 'Veuillez sélectionner un fichier à importer.');
          return;
        }

        const file = input.files[0];
        const reader = new FileReader();

        if (file.name.toLowerCase().endsWith('.json')) {
          reader.onload = (e) => {
            mergeData(JSON.parse(e.target.result));
          };
          reader.readAsText(file);
        } else {
          reader.onload = (e) => handleExcel(e, manager, codex);
          reader.readAsArrayBuffer(file);
        }
        AppManagers.CodexManager.show('success', 'Données importées.');
      } catch (err) {
        AppManagers.CodexManager.show('error', '[Auto] Erreur : ' + (err?.message || err));
      }
    });

    function handleExcel(e, manager, codex) {
      // Vérification de la dépendance (NOUVEAU)
      if (typeof XLSX === 'undefined') {
        AppManagers.CodexManager.show('error', "La librairie XLSX (SheetJS) est manquante pour l'import Excel.");
        return;
      }

      const workbook = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });

      let validSheet = null;
      let idxNom = -1;
      let idxPrenom = -1;

      // 🔎 1. Chercher automatiquement la bonne feuille
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        if (!rows.length) continue;

        const headers = rows[0].map((h) => removeAccents(String(h)));

        const iNom = headers.findIndex((h) => h.includes("nom"));
        const iPrenom = headers.findIndex((h) => h.includes("prenom"));

        if (iNom !== -1 && iPrenom !== -1) {
          validSheet = sheet;
          idxNom = iNom;
          idxPrenom = iPrenom;
          break;
        }
      }

      // ❌ Aucune feuille valide trouvée
      if (!validSheet) {
        AppManagers.CodexManager.show('warning', "Aucune feuille valide trouvée contenant les colonnes NOM et PRÉNOM.");
        return;
      }

      // ✔️ 2. Extraction des données
      const rows = XLSX.utils.sheet_to_json(validSheet, { header: 1 });

      const extracted = rows
        .slice(1)
        .map((r) => ({ NOM: r[idxNom], PRENOM: r[idxPrenom] }))
        .filter((x) => x.NOM && x.PRENOM);

      if (!extracted.length) {
        AppManagers.CodexManager.show('warning', "Aucune donnée valide trouvée dans la feuille détectée.");
        return;
      }

      // ✔️ Confirmation utilisateur via manager
      const sheetName = workbook.SheetNames.find(
        (s) => workbook.Sheets[s] === validSheet
      );
      AppManagers.CodexManager.show('info',
        `${extracted.length} entrées détectées dans la feuille « ${sheetName} ».`);

      mergeData(extracted);
      AppManagers.CodexManager.show('success', `${extracted.length} entrées ont été ajoutées à la liste.`);
    }


    // =====================================================================
    // 3) AJOUT MANUEL : FormManager Listener
    // =====================================================================
    AppManagers.FormManager.registerHandler('formTrombinoscopeManuel', async function (data, form, codex, manager) {
      try {
        const nom = data.get('nom').trim();
        const prenom = data.get('prenom').trim();

        if (!nom || !prenom) {
          AppManagers.CodexManager.show('warning', 'Merci de renseigner nom + prénom');
          return;
        }

        items.push({ NOM: nom.toUpperCase(), PRENOM: prenom });
        renderList();
        AppManagers.CodexManager.show('success', 'Entrée ajoutée.');
      } catch (err) {
        AppManagers.CodexManager.show('error', '[Manuel] Erreur : ' + (err?.message || err));
      }
    });

    // Fusionner plusieurs entrées importées
    function mergeData(arr) {
      arr.forEach((x) => items.push({ NOM: String(x.NOM).toUpperCase(), PRENOM: String(x.PRENOM) }));
      renderList();
    }
    // =====================================================================
    // 4) LOGIQUE DE CONSTRUCTION DU CONTENU PAGINÉ
    // =====================================================================
    /**
     * Construit les éléments de trombinoscope avec pagination (9 éléments par page)
     * et les injecte dans le conteneur cible.
     * @param {HTMLElement} pagesContainer - Le conteneur #trombinoscope-pages du template PDF.
     */
    async function buildTrombiContent(pagesContainer) {
      if (!items.length) {
        throw new Error("La liste de données est vide. Veuillez ajouter des entrées.");
      }

      // Vérification de la librairie QRious (nécessaire pour buildTrombiItem)
      if (!window.QRious) {
        AppManagers.log('vueTrombinoscope', 'error', 'La librairie QRious est manquante (nécessaire pour générer les QR Codes).', 'error');
        throw new Error("QRious non disponible.");
      }

      let gridContainer = null;
      let counter = 0; // Compteur d'éléments par page (max 9)

      items.forEach((item, index) => {
        // Créer une nouvelle page/grille si c'est le premier élément ou si on atteint 9
        if (counter === 0) {
          // Ajouter un saut de page (breaker) sauf pour la toute première page
          if (index > 0) {
            const breaker = document.createElement('div');
            breaker.className = 'breaker';
            pagesContainer.appendChild(breaker);
          }

          // Créer le conteneur de page (grid)
          gridContainer = document.createElement('div');
          gridContainer.className = 'fr-grid-row fr-grid-row--gutters trombi-page'; // Utilise les classes DSFR
          pagesContainer.appendChild(gridContainer);
        }

        // Construire et injecter l'élément
        buildTrombiItem(gridContainer, item);

        counter++;
        if (counter >= 9) {
          counter = 0; // Réinitialiser le compteur pour la prochaine page
        }
      });

      // La fonction buildTrombiItem est supposée être déjà dans votre code (elle l'était)
      // Elle prend le gridContainer et itère sur les propriétés it.NOM, it.PRENOM
    }

    // =====================================================================
    // 4) GÉNÉRATION DU PDF
    // =====================================================================

    // /views/atelier/trombinoscope/js/view-trombinoscope.js (Remplacer la fonction generatePDF)

    /**
     * Génère le contenu HTML pour le PDF, puis utilise html2pdf pour le convertir.
     * @param {boolean} preview - Vrai si l'on génère juste l'aperçu.
     */
    async function generatePDF(preview) {
      const isGenerating = !preview;
      const outputEl = document.getElementById('trombinoscope-output');
      const previewBtn = document.getElementById('btnPreview');
      const generateBtn = document.getElementById('btnGenerate');

      // Déclaration de la variable dans la portée de la fonction
      let elementToRender = null;

      // Le code html2pdf est exposé globalement (vérifié par l'utilisateur)
      if (!window.html2pdf) {
        AppManagers.log('vueTrombinoscope', 'error', 'Erreur: La librairie html2pdf.js est manquante ou non chargée.', 'error');
        outputEl.innerHTML = '<div class="fr-alert fr-alert--error fr-m-3v"><p>Erreur: html2pdf.js n\'est pas disponible.</p></div>';
        return;
      }
      if (!trombiTemplate) {
        outputEl.innerHTML = '<p class="fr-m-3v fr-label--warning">Erreur: Le modèle HTML est manquant.</p>';
        return;
      }

      try {
        // --- 1. GESTION DE L'ÉTAT (UX) ---
        if (isGenerating) {
          AppManagers.log('vueTrombinoscope', 'info', 'Génération du PDF en cours...');
          previewBtn.disabled = true;
          generateBtn.disabled = true;
          outputEl.innerHTML = '<div class="fr-alert fr-alert--info fr-m-3v"><p>Génération du PDF... Veuillez patienter.</p></div>';
        } else {
          // Pour l'aperçu, on nettoie
          outputEl.innerHTML = '';
        }

        // --- 2. INJECTION DU CONTENU ET PRÉPARATION ---

        // Initialisation de la variable 
        elementToRender = document.createElement('div');
        elementToRender.innerHTML = trombiTemplate;

        const pagesContainer = elementToRender.querySelector('#trombinoscope-pages');
        if (!pagesContainer) throw new Error("Conteneur #trombinoscope-pages non trouvé dans le template.");

        // Construction et injection du contenu (maintenant définie)
        await buildTrombiContent(pagesContainer);

        // Rendre l'élément visible dans le DOM pour html2pdf
        if (preview) {
          // BUG CORRIGÉ : On ajoute d'abord un message puis le contenu
          outputEl.innerHTML = '<div class="fr-alert fr-alert--info fr-m-3v"><p>Aperçu chargé. Déplacez-vous vers le bas pour voir le rendu.</p></div>';
          outputEl.appendChild(elementToRender); // Laisse l'élément dans le DOM pour la prévisualisation
          return; // Terminer si c'est seulement un aperçu
        }

        // --- 3. OPTIONS HTML2PDF ---
        const filename = `Trombinoscope_${new Date().toISOString().slice(0, 10)}.pdf`;
        const options = {
          margin: 0,
          filename: filename,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 3, logging: false },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          // Utilisation des sélecteurs CSS pour les sauts de page
          pagebreak: { mode: ['css', 'legacy'], before: '.breaker' }
        };

        // --- 4. EXÉCUTION DE LA GÉNÉRATION (ASYNCHRONE) ---
        // Le .save() déclenche le téléchargement
        await html2pdf().set(options).from(elementToRender).save();

        // Log de succès seulement si la Promesse aboutit
        AppManagers.log('vueTrombinoscope', 'success', `PDF ${filename} généré et téléchargé.`);

      } catch (error) {
        // --- 5. GESTION DES ERREURS ---
        AppManagers.log('vueTrombinoscope', 'error', 'Erreur lors de la génération du PDF :', error);
        // S'assurer que le message d'erreur écrase l'ancien contenu/spinner
        outputEl.innerHTML = '<div class="fr-alert fr-alert--error fr-m-3v"><p>Une erreur est survenue lors de la génération du PDF. Consultez la console pour plus de détails.</p></div>';

      } finally {
        // --- 6. NETTOYAGE ET RÉINITIALISATION DE L'ÉTAT ---

        // Si la Promesse a réussi ou échoué, on réactive les boutons
        previewBtn.disabled = false;
        generateBtn.disabled = false;

        // Suppression sécurisée de l'élément si créé et s'il n'est plus utile (i.e. on n'est pas en mode preview)
        if (!preview && elementToRender && elementToRender.parentNode) {
          elementToRender.parentNode.removeChild(elementToRender);
        }

        // Si on génère un PDF, on affiche le message final après le succès ou l'échec.
        if (!preview) {
          // Le message de succès a déjà été géré dans le try/catch.
          // On met juste un message de fin.
        }
      }
    }

    // Construction d'un item visible (buildTrombiItem)
    function buildTrombiItem(grid, it) {
      const col = document.createElement('div');
      col.className = 'fr-col-4 fr-mb-3v';
      col.style.textAlign = 'center';

      const svgNS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(svgNS, 'svg');
      svg.setAttribute('width', '270');
      svg.setAttribute('height', '270');

      // --- 1. Cercle (Centré sur 135, 135) ---
      const circle = document.createElementNS(svgNS, 'circle');
      circle.setAttribute('cx', '135'); // Centré
      circle.setAttribute('cy', '135'); // Centré
      circle.setAttribute('r', '110');
      circle.setAttribute('stroke', 'black');
      circle.setAttribute('stroke-width', '4');
      circle.setAttribute('fill', 'white');

      // --- 2. Texte (NOM en haut, centré sur 135) ---
      const text1 = document.createElementNS(svgNS, 'text');
      text1.setAttribute('x', '135'); // Centré
      text1.setAttribute('y', '90');
      text1.setAttribute('text-anchor', 'middle');
      text1.setAttribute('font-size', '16'); // Ajout pour lisibilité
      text1.setAttribute('font-weight', 'bold'); // Ajout pour lisibilité
      text1.textContent = it.NOM;

      // --- 3. Texte (PRENOM en bas, centré sur 135) ---
      const text2 = document.createElementNS(svgNS, 'text');
      text2.setAttribute('x', '135'); // Centré
      text2.setAttribute('y', '115'); // Légèrement plus bas
      text2.setAttribute('text-anchor', 'middle');
      text2.setAttribute('font-size', '14'); // Ajout pour lisibilité
      text2.textContent = it.PRENOM;

      // --- 4. QR Code (Centré au milieu de la vignette) ---
      const img = document.createElementNS(svgNS, 'image');
      img.setAttribute('width', '63');
      img.setAttribute('height', '63');
      img.setAttribute('x', '103.5'); // Centré horizontalement: 135 - 31.5
      img.setAttribute('y', '150'); // Décalé vers le bas pour ne pas chevaucher le texte

      // Création du QR Code
      const qr = new QRious({
        value: removeAccents(it.NOM + '+' + it.PRENOM),
        size: 63,
        level: 'H'
      });
      // Insertion dans l'image SVG
      img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', qr.canvas.toDataURL());

      // Assemblage
      svg.append(circle, text1, text2, img);
      col.appendChild(svg);

      // Légende textuelle sous le SVG
      const caption = document.createElement('p');
      caption.className = 'fr-text--xs fr-mt-1v';
      caption.textContent = `${it.NOM} ${it.PRENOM}`;

      col.appendChild(caption);
      grid.appendChild(col);
    }

    // =====================================================================
    // 5) Boutons Aperçu / Génération
    // =====================================================================
    if (previewBtn) previewBtn.onclick = () => generatePDF(true);
    if (generateBtn) generateBtn.onclick = () => generatePDF(false);
    // Pour debug
    window.trombinoscopeItems = items;
  }
});

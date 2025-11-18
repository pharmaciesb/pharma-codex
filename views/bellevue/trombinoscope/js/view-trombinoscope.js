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

    // --- Références DOM principales ---
    const listEl = document.getElementById('data-list');
    const outputEl = document.getElementById('trombinoscope-output');
    const pdfWrapper = document.getElementById('trombinoscope-pdf-wrapper');

    // Boutons globaux
    const previewBtn = document.getElementById('btnPreview');
    const generateBtn = document.getElementById('btnGenerate');

    // Données internes
    let items = []; // { NOM, PRENOM }

    // Utilitaire
    const removeAccents = (str) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

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
          manager.addResultMessage(codex, 'warning', 'Veuillez sélectionner un fichier.');
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

        manager.addResultMessage(codex, 'success', 'Données importées.');
      } catch (err) {
        manager.addResultMessage(codex, 'error', '[Auto] Erreur : ' + (err?.message || err));
      }
    });

    function handleExcel(e, manager, codex) {
      const workbook = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });

      const removeAccents = (str) =>
        str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

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
        manager.addResultMessage(codex, "warning",
          "Aucune feuille valide trouvée contenant les colonnes NOM et PRÉNOM.");
        return;
      }

      // ✔️ 2. Extraction des données
      const rows = XLSX.utils.sheet_to_json(validSheet, { header: 1 });

      const extracted = rows
        .slice(1)
        .map((r) => ({ NOM: r[idxNom], PRENOM: r[idxPrenom] }))
        .filter((x) => x.NOM && x.PRENOM);

      if (!extracted.length) {
        manager.addResultMessage(codex, "warning",
          "Aucune donnée valide trouvée dans la feuille détectée.");
        return;
      }

      // ✔️ Confirmation utilisateur via manager
      const sheetName = workbook.SheetNames.find(
        (s) => workbook.Sheets[s] === validSheet
      );

      manager.addResultMessage(codex, "info",
        `${extracted.length} entrées détectées dans « ${sheetName} ». Import en cours...`);

      mergeData(extracted);

      manager.addResultMessage(codex, "success",
        `${extracted.length} entrées ont été ajoutées à la liste.`);
    }


    // =====================================================================
    // 3) AJOUT MANUEL : FormManager Listener
    // =====================================================================
    AppManagers.FormManager.registerHandler('formTrombinoscopeManuel', async function (data, form, codex, manager) {
      try {
        const nom = data.get('nom').trim();
        const prenom = data.get('prenom').trim();

        if (!nom || !prenom) {
          manager.addResultMessage(codex, 'warning', 'Merci de renseigner nom + prénom');
          return;
        }

        items.push({ NOM: nom.toUpperCase(), PRENOM: prenom });
        renderList();

        manager.addResultMessage(codex, 'success', 'Entrée ajoutée.');
      } catch (err) {
        manager.addResultMessage(codex, 'error', '[Manuel] Erreur : ' + (err?.message || err));
      }
    });

    // Fusionner plusieurs entrées importées
    function mergeData(arr) {
      arr.forEach((x) => items.push({ NOM: String(x.NOM).toUpperCase(), PRENOM: String(x.PRENOM) }));
      renderList();
    }

    // =====================================================================
    // 4) GÉNÉRATION DU PDF
    // =====================================================================
    async function generatePDF(preview = false) {
      const tpl = await fetch('./views/bellevue/trombinoscope/partials/trombinoscope.html').then((r) => r.text());
      pdfWrapper.innerHTML = tpl;

      const pagesContainer = pdfWrapper.querySelector('#trombinoscope-pages');
      pagesContainer.innerHTML = '';

      // page builders: 9 items per page (3 cols x 3 rows)
      let page = null;
      let grid = null;
      let count = 0;
      items.forEach((it, i) => {
        // New page when count === 0
        if (count === 0) {
          // add a breaker BEFORE the page except for first page
          if (pagesContainer.children.length > 0) {
            const br = document.createElement('div');
            br.className = 'breaker';
            pagesContainer.appendChild(br);
          }
          page = document.createElement('div');
          page.className = 'trombi-page';
          // inner grid for 3 columns (uses DSFR classes)
          const inner = document.createElement('div');
          inner.className = 'fr-grid-row fr-grid-row--gutters';
          page.appendChild(inner);
          pagesContainer.appendChild(page);
          grid = inner;
        }

        // build item into current grid
        // buildTrombiItem appends a .fr-col-4 element into passed grid
        buildTrombiItem(grid, it);

        count++;
        if (count === 9) count = 0;
      });

      // If no items, create an empty page so preview shows something
      if (!items.length) {
        const p = document.createElement('div');
        p.className = 'trombi-page';
        p.innerHTML = '<div class="fr-grid-row fr-grid-row--gutters"><p>Aucune entrée</p></div>';
        pagesContainer.appendChild(p);
      }

      // Preview: inject visible snapshot
      outputEl.innerHTML = '';
      outputEl.appendChild(pdfWrapper.querySelector('#trombinoscope-pdf').cloneNode(true));

      if (!preview) {
        const element = pdfWrapper.querySelector('#trombinoscope-pdf');

        const opt = {
          margin: 0,
          filename: 'trombinoscope.pdf',
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: '#fff', scrollY: 0 },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['css', 'legacy'], before: '.breaker' }
        };

        // Put element in DOM for stable rendering
        document.body.appendChild(element);

        setTimeout(() => {
          html2pdf()
            .set(opt)
            .from(element)
            .save()
            .finally(() => {
              // move it back into wrapper to keep DOM tidy
              pdfWrapper.appendChild(element);
            });
        }, 250);
      }
    }

    // Construction d'un item visible
    function buildTrombiItem(grid, it) {
      const col = document.createElement('div');
      col.className = 'fr-col-4 fr-mb-3v';
      col.style.textAlign = 'center';

      const svgNS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(svgNS, 'svg');
      svg.setAttribute('width', '270');
      svg.setAttribute('height', '270');

      const circle = document.createElementNS(svgNS, 'circle');
      circle.setAttribute('cx', '120');
      circle.setAttribute('cy', '120');
      circle.setAttribute('r', '110');
      circle.setAttribute('stroke', 'black');
      circle.setAttribute('stroke-width', '4');
      circle.setAttribute('fill', 'white');

      const text1 = document.createElementNS(svgNS, 'text');
      text1.setAttribute('x', '120');
      text1.setAttribute('y', '90');
      text1.setAttribute('text-anchor', 'middle');
      text1.textContent = it.NOM;

      const text2 = document.createElementNS(svgNS, 'text');
      text2.setAttribute('x', '120');
      text2.setAttribute('y', '110');
      text2.setAttribute('text-anchor', 'middle');
      text2.textContent = it.PRENOM;

      const img = document.createElementNS(svgNS, 'image');
      img.setAttribute('width', '63');
      img.setAttribute('height', '63');
      img.setAttribute('x', '93');
      img.setAttribute('y', '120');

      const qr = new QRious({ value: removeAccents(it.NOM + '+' + it.PRENOM), size: 63, level: 'H' });
      img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', qr.canvas.toDataURL());

      svg.append(circle, text1, text2, img);
      col.appendChild(svg);

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

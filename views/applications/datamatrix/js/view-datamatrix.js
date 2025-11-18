// =============================================================
// Vue Datamatrix - version refactorisée inspirée de vueFacture
// =============================================================

// -- Vue DomloadManager
AppManagers.DomloadManager.registerHandler('vueDatamatrix', {
    presetVariableOnload(element, key) {
        try {
            window.currentView = key;
            element.setAttribute('data-loaded', 'true');
            AppManagers.log('vueDatamatrix', 'info', 'Preset onload OK');
        } catch (err) {
            console.error('[vueDatamatrix] Erreur presetVariableOnload :', err);
        }
    },

    methodeOnload(element, key) {
        AppManagers.log('vueDatamatrix', 'success', 'Méthode onload déclenchée');

        // --- Saisie auto format DLU (MMYYYY -> MM/YYYY) ---
        const expiryInput = document.getElementById('dlu');
        if (expiryInput && !expiryInput.dataset.listenerAttached) {
            expiryInput.dataset.listenerAttached = 'true';
            expiryInput.addEventListener('input', (e) => {
                let value = e.target.value.replace(/\D/g, '');
                if (value.length >= 2) {
                    let mm = value.slice(0, 2);
                    let year = value.slice(2, 6);
                    let monthNum = parseInt(mm, 10);
                    if (monthNum < 1) monthNum = 1;
                    if (monthNum > 12) monthNum = 12;
                    mm = monthNum.toString().padStart(2, '0');
                    value = year.length > 0 ? `${mm}/${year}` : mm;
                }
                e.target.value = value;
            });
        }

        AppManagers.log('vueDatamatrix', 'info', 'Champ DLU autoformat actif.');
    }
});

// =============================================================
// FormManager : génération + export PDF du Datamatrix
// =============================================================
AppManagers.FormManager.registerHandler('formDatamatrix', async (data, form, codex, manager) => {
    try {
        const ean = (data.get('ean') || '').trim();
        const lot = (data.get('lot') || '').trim();
        const dlu = (data.get('dlu') || '').trim();
        const qte = parseInt(data.get('qte') || '1', 10);

        if (!ean || !lot || !dlu) {
            manager.addResultMessage(codex, 'warning', 'Veuillez remplir tous les champs avant de générer le datamatrix.');
            return;
        }

        // --- Calcul DLU & GS1 ---
        const [mm, yyyy] = dlu.split('/');
        const yy = yyyy.slice(-2);
        const lastDay = new Date(parseInt(yyyy), parseInt(mm), 0).getDate();
        const expiryDate = yy + mm.padStart(2, '0') + String(lastDay).padStart(2, '0');
        const ean14 = ean.length === 13 ? '0' + ean : ean;
        const datamatrixData = `01${ean14}17${expiryDate}10${lot}`;

        const outputDiv = document.getElementById('datamatrix-output');
        if (!outputDiv) {
            manager.addResultMessage(codex, 'error', 'Zone de sortie introuvable.');
            return;
        }

        manager.addResultMessage(codex, 'info', 'Préparation du modèle de sortie...');

        // --- Chargement du partial "satisfait.html" ---
        await AppManagers.TemplateManager.renderInto(
            './views/applications/datamatrix/partials/satisfait.html',
            { datamatrix: { data: datamatrixData, lot, dlu, qte, ean } },
            outputDiv
        );

        const titleEl = document.getElementById('datamatrix-title');
        if (titleEl) {
            titleEl.textContent = `DATAMATRIX – ${ean}`;
        }

        // --- Génération des codes dans le partial ---
        const page = document.querySelector('#datamatrix-pdf #datamatrix-output');
        if (!page) throw new Error('Zone #datamatrix-output introuvable dans le partial.');

        for (let i = 0; i < qte; i++) {
            const svgNode = DATAMatrix({
                msg: datamatrixData,
                dim: 38,
                rct: 0,
                pad: 0,
                pal: ['#000000', '#ffffff'],
                vrb: 0
            });
            const item = document.createElement('div');
            item.classList.add('datamatrix-item', 'fr-col-3');
            item.appendChild(svgNode);
            item.innerHTML += `<p class="fr-text--xs fr-mt-1v">${dlu} - ${lot}</p>`;
            page.appendChild(item);
        }

        // --- Export PDF automatique ---
        const exportToPDF = (element, filename, options = {}) => {
            const sandbox = document.createElement('div');
            sandbox.style.cssText = `
        position: fixed;
        top: 0; left: 0;
        width: 210mm;
        background: white;
        opacity: 0;
        z-index: -1;
      `;
            document.body.appendChild(sandbox);
            sandbox.appendChild(element);

            const opt = {
                margin: 0,
                filename,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, backgroundColor: '#fff', scrollY: 0 },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
                pagebreak: { mode: ['css', 'legacy'], before: '.breaker' },
                ...options
            };

            setTimeout(() => {
                html2pdf()
                    .set(opt)
                    .from(element)
                    .save()
                    .finally(() => sandbox.remove());
            }, 300);
        };

        const datamatrixPdf = document.getElementById('datamatrix-pdf');
        if (datamatrixPdf) {
            exportToPDF(datamatrixPdf, 'datamatrix.pdf');
            AppManagers.log('formDatamatrix', 'success', 'PDF Datamatrix généré avec succès.');
        } else {
            AppManagers.log('formDatamatrix', 'warn', 'Élément #datamatrix-pdf introuvable, export annulé.');
        }

        manager.addResultMessage(codex, 'success', `${qte} datamatrix exporté${qte > 1 ? 's' : ''} en PDF.`);
    } catch (err) {
        console.error('[formDatamatrix] Erreur :', err);
        manager.addResultMessage(codex, 'error', 'Erreur lors de la génération : ' + (err.message || err));
    }
});

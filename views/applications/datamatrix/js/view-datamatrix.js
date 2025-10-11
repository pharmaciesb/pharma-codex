AppManagers.DomloadManager.registerHandler('vueDatamatrix', {
    presetVariableOnload(element, key) {
        window.currentView = key;
        element.setAttribute('data-loaded', 'true');
        AppManagers.log('vueDatamatrix', 'info', 'Preset onload');
    },

    methodeOnload(element, key) {
        AppManagers.log('vueDatamatrix', 'success', 'Méthode onload OK');

        // --- Gestion de la saisie auto DLU ---
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

        // --- Bouton PDF (corrigé pour éviter les doublons) ---
        let oldBtn = document.getElementById('pdf-btn');
        if (!oldBtn) return;

        // clone propre pour supprimer les anciens listeners
        const newBtn = oldBtn.cloneNode(true);
        oldBtn.replaceWith(newBtn);

        newBtn.addEventListener('click', async () => {
            const outputDiv = document.getElementById('datamatrix-output');
            if (!outputDiv || outputDiv.children.length === 0) {
                alert("Aucun Datamatrix généré à exporter !");
                return;
            }

            const opt = {
                margin: 10,
                filename: 'datamatrix.pdf',
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };

            newBtn.disabled = true;
            newBtn.textContent = '📄 Génération...';

            try {
                await html2pdf().set(opt).from(outputDiv).save();
                AppManagers.log('vueDatamatrix', 'success', 'PDF généré avec succès');
            } catch (err) {
                console.error('Erreur lors de la génération du PDF :', err);
                alert('Erreur lors de la génération du PDF.');
            } finally {
                newBtn.disabled = false;
                newBtn.textContent = '📄 Télécharger en PDF';
            }
        });
    }
});

// -------------------------------------------------------------
// FORM HANDLER : génération du datamatrix
// -------------------------------------------------------------
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

        // --- Calculs DLU & GS1 ---
        const [mm, yyyy] = dlu.split('/');
        const yy = yyyy.slice(-2);
        const year = parseInt(yyyy, 10);
        const month = parseInt(mm, 10);
        const lastDay = new Date(year, month, 0).getDate();
        const expiryDate = yy + mm.padStart(2, '0') + String(lastDay).padStart(2, '0');
        const ean14 = ean.length === 13 ? '0' + ean : ean;
        const datamatrixData = `01${ean14}17${expiryDate}10${lot}`;

        // --- Sortie ---
        const output = document.getElementById('datamatrix-output');
        if (!output) {
            AppManagers.log('formDatamatrix', 'error', 'Aucune sortie trouvée (#datamatrix-output)');
            return;
        }

        output.innerHTML = `
            <p class="fr-text--sm fr-mb-1v"><b>Code GS1 généré :</b> ${datamatrixData}</p>
            <div id="datamatrix-page" class="fr-grid-row fr-grid-row--gutters"></div>
        `;

        const page = document.getElementById('datamatrix-page');

        // --- Génération des SVG ---
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

        // --- Réactivation du bouton PDF ---
        const pdfBtn = document.getElementById('pdf-btn');
        if (pdfBtn) {
            pdfBtn.disabled = false;
        }

        manager.addResultMessage(codex, 'success', `${qte} datamatrix généré${qte > 1 ? 's' : ''} avec succès.`);
    } catch (err) {
        AppManagers.log('formDatamatrix', 'error', 'Erreur :', err);
        manager.addResultMessage(codex, 'error', 'Erreur inattendue lors de la génération du datamatrix.');
    }
});

import { toTitleCase } from '/pharma-codex/static/js/assistants/assistant-string.js';
import { PdfAssistant } from "/pharma-codex/static/js/assistants/assistant-pdf.js";

let items = []; // Liste des souches à imprimer. Scope OK.

// =====================================================================
//  view-etiqueteuse.js – Nouvelle version (PdfAssistant)
// =====================================================================
AppManagers.DomloadManager.registerHandler('vueEtiqueteuse', {
    presetVariableOnload(element, key) {
        try {
            window.currentView = key;
            window.AppDebug = true;
            element.setAttribute('data-loaded', 'true');
            AppManagers.log('vueEtiqueteuse', 'info', 'Preset onload OK');
        } catch (err) {
            console.error('[vueEtiqueteuse] Erreur presetVariableOnload :', err);
        }
    },

    methodeOnload: async function () {
        AppManagers.log('vueEtiqueteuse', 'success', 'Chargement vue Étiqueteuse');

        // --- 0) Variables et Références DOM ---
        const listEl = document.getElementById('data-list');
        const countEl = document.getElementById('count-items');
        const previewBtn = document.getElementById('btnPreview');
        const generateBtn = document.getElementById('btnGenerate');
        const clearBtn = document.getElementById('btnClear');
        // Référence au conteneur de prévisualisation (pour le vider si besoin)
        const previewContainerEl = document.getElementById('preview-container');

        // Reset
        items = [];
        renderList();
        generateBtn.disabled = true;

        // Mise à jour des handlers pour pointer vers la nouvelle fonction
        // MODIFICATION DES HANDLERS
        if (previewBtn) previewBtn.onclick = () => handlePdfAction('preview');
        if (generateBtn) generateBtn.onclick = () => handlePdfAction('export');
        if (clearBtn) clearBtn.onclick = () => {
            if (confirm("Vider la liste ?")) {
                items = [];
                renderList();
                // Vider le conteneur de preview lors du reset
                if (previewContainerEl) previewContainerEl.innerHTML = '';
            }
        };

        // =====================================================================
        // 1) Rendu liste (inchangé, mais s'assurer que previewBtn est géré)
        // =====================================================================
        function renderList() {
            listEl.innerHTML = '';

            if (items.length === 0) {
                listEl.innerHTML =
                    '<tr><td colspan="4" class="fr-text--center">Aucune souche ajoutée.</td></tr>';
            } else {
                items.forEach((it, idx) => {
                    const tr = document.createElement('tr');

                    tr.innerHTML = `
                        <td>${toTitleCase(it.denomination)}</td>
                        <td>${it.dosage}</td>
                        <td>${it.codeBarre || 'N/A'}</td>
                        <td>
                            <button class="fr-btn fr-btn--secondary fr-btn--sm fr-btn--icon-left fr-icon-delete-line">
                                Supprimer
                            </button>
                        </td>`;

                    tr.querySelector('button').onclick = () => {
                        items.splice(idx, 1);
                        renderList();
                    };

                    listEl.appendChild(tr);
                });
            }

            countEl.textContent = items.length;
            generateBtn.disabled = items.length === 0;
            // Ajout : s'assurer que le bouton preview est également géré
            if (previewBtn) previewBtn.disabled = items.length === 0;
        }


        // =====================================================================
        // 2) Ajout manuel via FormManager (inchangé)
        // =====================================================================
        AppManagers.FormManager.registerHandler('formEtiquette', async function (data, form, codex, manager) {
            try {
                const denomination = data.get('denomination').trim().toLowerCase();
                const dosage = data.get('dosage').trim();
                const codeBarre = data.get('codeBarre')?.trim() || '';

                if (!denomination || !dosage) {
                    manager.addResultMessage(codex, 'warning', 'Dénomination et dosage requis.');
                    return;
                }

                items.push({
                    denomination,
                    dosage,
                    codeBarre
                });

                renderList();
                manager.addResultMessage(codex, 'success', `Souche ajoutée.`);
            } catch (err) {
                manager.addResultMessage(codex, 'error', '[Manuel] ' + err.message);
            }
        });


        // =====================================================================
        // 3) Préparation des items (Logique métier)
        // =====================================================================
        function prepareItemsForPDF(itemsToProcess) {
            return itemsToProcess.map(data => {
                let dataMatrixHtml = '';

                if (data.codeBarre && window.DATAMatrix) {
                    try {
                        const svgNode = DATAMatrix({
                            msg: data.codeBarre,
                            dim: 38,
                            rct: 0,
                            pad: 0,
                            pal: ['#000000', '#ffffff'],
                            vrb: 0
                        });
                        dataMatrixHtml = `<div class="dmx">${svgNode.outerHTML}</div>`;
                    } catch (e) {
                        dataMatrixHtml = '<div class="datamatrix-error">Erreur DMX</div>';
                    }
                }

                return {
                    denomination: toTitleCase(data.denomination),
                    dosage: data.dosage,
                    codeBarre: data.codeBarre,
                    dataMatrixHtml: dataMatrixHtml
                };
            });
        }


        // =====================================================================
        // 4) Gestion unifiée des actions PDF (Preview et Export)
        // MODIFICATION DE LA FONCTION : handlePdfAction remplace generatePDF
        // =====================================================================
        async function handlePdfAction(mode = 'export') {
            // Détermine si l'action est une prévisualisation ou un export
            const isPreview = mode === 'preview';
            // Définit la cible DOM uniquement en mode prévisualisation
            const targetElementId = isPreview ? '#etiqueteuse-output' : null;

            const outputEl = document.getElementById('etiqueteuse-output');
            const messagerieEl = document.getElementById('etiqueteuse-messagerie');

            if (!items.length) {
                outputEl.innerHTML = '<div class="fr-alert fr-alert--warning fr-m-3v"><p>Liste des étiquettes vide.</p></div>';
                return;
            }

            // Vérification html2pdf seulement si c'est un export
            if (!isPreview && !window.html2pdf) {
                outputEl.innerHTML = '<div class="fr-alert fr-alert--error fr-m-3v"><p>html2pdf manquant.</p></div>';
                return;
            }

            try {
                previewBtn.disabled = true;
                generateBtn.disabled = true;
                outputEl.innerHTML = `<div class="fr-alert fr-alert--info fr-m-3v"><p>Action "${mode}" en cours...</p></div>`;

                // 1. Préparation des données (Logique métier du module)
                const preparedItems = prepareItemsForPDF(items);

                // 2. Appel à l'assistant (méthode unifiée)
                await PdfAssistant.generate({
                    items: preparedItems,
                    itemTemplateUrl: "./views/atelier/etiqueteuse/partials/chemise/template-item.html",
                    pageTemplateUrl: "./views/atelier/etiqueteuse/partials/chemise/template-page.html",
                    columns: 4,
                    rows: 5,
                    filename: `Planche_Etiquettes_${new Date().toISOString().slice(0, 10)}.pdf`,
                    // Passage du paramètre clé pour indiquer le mode Preview
                    targetElementId: targetElementId
                });

                // 3. Message de succès
                if (isPreview) {
                    messagerieEl.innerHTML = '<div class="fr-alert fr-alert--success fr-m-3v"><p>Prévisualisation affichée ci-dessous.</p></div>'
                    // Faire défiler vers la prévisualisation pour meilleure UX
                    document.querySelector(targetElementId).scrollIntoView({ behavior: 'smooth' });
                } else {
                    outputEl.innerHTML = '<div class="fr-alert fr-alert--success fr-m-3v"><p>Fichier PDF généré avec succès.</p></div>';
                }

            } catch (err) {
                AppManagers.log('vueEtiqueteuse', 'error', `Erreur ${mode} :`, err);
                outputEl.innerHTML = `<div class="fr-alert fr-alert--error fr-m-3v"><p>Erreur lors de l'action "${mode}" : ${err.message}</p></div>`;
            } finally {
                previewBtn.disabled = items.length === 0;
                generateBtn.disabled = items.length === 0;
            }
        }
    }
});
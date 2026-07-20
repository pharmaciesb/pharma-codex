/// <reference path="../../../../static/js/types.js" />

import { listenForImagePaste, listenForImageDrop } from '/pharma-codex/static/js/assistants/assistant-clipboard-paste.js';
import { detectDocumentCorners, mountCornerEditor, extractFlattenedImage } from '/pharma-codex/static/js/assistants/assistant-ordoscan-scanic.js';
import { preloadBackgroundRemoval, removeImageBackground, compositeOnWhite, applyAlphaStrength } from '/pharma-codex/static/js/assistants/assistant-ordoscan-bgremoval.js';
import { downloadBlob, canShareFiles, shareBlob } from '/pharma-codex/static/js/assistants/assistant-share-export.js';

const STEP_TITLES = {
    1: { title: 'Import de la photo', next: 'Recadrage & perspective' },
    2: { title: 'Recadrage & correction de perspective', next: 'Suppression du fond' },
    3: { title: 'Suppression de l\'arrière-plan', next: 'Export' },
    4: { title: 'Téléchargement', next: null }
};

/**
 * Handler pour la vue Ordoscan (nettoyage de photos d'ordonnances)
 * @extends {AppManagers.ViewHandler}
 */
class OrdoscanHandler extends AppManagers.ViewHandler {
    constructor() {
        super('viewOrdoscan');

        this._sourceImageEl = null;   // <img> source chargée (étape 1)
        this._cornerEditor = null;    // instance de l'éditeur de coins (étape 2)
        this._croppedBlob = null;     // résultat étape 2
        this._finalBlob = null;       // résultat final (étape 3 ou copie de l'étape 2)
        this._objectUrls = [];        // URLs à révoquer au cleanup
        this._rawRemovedBgBlob = null;   // masque alpha brut, calculé une seule fois par l'IA
        this._rawRemovedBgForBlob = null; // référence du _croppedBlob utilisé pour ce calcul (invalidation cache)
        this._strengthDebounceTimer = null;
    }

    async onload() {
        this.currentStep = 1;

        // --- Étape 1 : import ---
        const dropzone = this.getElement('ordoscan-dropzone');
        const fileInput = this.getElement('ordoscan-fileinput');

        this.addListener(dropzone, 'click', () => fileInput.click());
        this.addListener(dropzone, 'keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
        });
        this.addListener(fileInput, 'change', (e) => {
            const file = e.target.files?.[0];
            if (file) this.handleImportedFile(file);
        });
        listenForImageDrop(dropzone, (file) => this.handleImportedFile(file));

        // Écoute globale du Ctrl+V (n'agit que si l'étape 1 est visible)
        listenForImagePaste(document, (file) => {
            if (this.currentStep === 1) this.handleImportedFile(file);
        }, (msg, type) => AppManagers.log(this.key, type, msg));

        this.bindElement('ordoscan-btn-to-step2', 'click', () => this.goToStep(2));
        this.bindElement('ordoscan-btn-clear-import', 'click', () => this.resetImport());

        // --- Étape 2 : Scanic ---
        this.bindElement('ordoscan-btn-back-to-1', 'click', () => this.goToStep(1));
        this.bindElement('ordoscan-btn-validate-crop', 'click', () => this.validateCrop());
        this.bindElement('ordoscan-btn-download-step2', 'click', () => this.downloadCurrent(this._croppedBlob, 'ordonnance-recadree.jpg'));
        this.bindElement('ordoscan-btn-goto-step3', 'click', () => this.goToStep(3));

        // --- Étape 3 : suppression du fond (optionnelle) ---
        this.bindElement('ordoscan-btn-back-to-2', 'click', () => this.goToStep(2));
        this.bindElement('ordoscan-btn-skip-bg', 'click', () => this.skipBackgroundRemoval());
        this.bindElement('ordoscan-btn-remove-bg', 'click', () => this.runBackgroundRemoval());
        this.bindElement('ordoscan-bg-strength', 'input', (e) => this.onStrengthChange(e.target.value));
        this.addListener(document.getElementById('ordoscan-fond-blanc'), 'change', () => this.rerenderWithCurrentStrength());
        this.addListener(document.getElementById('ordoscan-fond-transparent'), 'change', () => this.rerenderWithCurrentStrength());

        // --- Étape 4 : export ---
        this.bindElement('ordoscan-btn-download', 'click', () => this.downloadCurrent(this._finalBlob, 'ordonnance-finale.png'));
        this.bindElement('ordoscan-btn-back-to-3', 'click', () => this.goToStep(3));
        this.bindElement('ordoscan-btn-share', 'click', () => this.shareCurrent());
        this.bindElement('ordoscan-btn-restart', 'click', () => this.restart());

        AppManagers.log(this.key, 'success', 'Module Ordoscan initialisé');
    }

    // =============================================================
    // Navigation entre étapes (stepper DSFR)
    // =============================================================
    goToStep(n) {
        this.currentStep = n;

        for (let i = 1; i <= 4; i++) {
            const panel = this.getElement(`ordoscan-panel-${i}`, false);
            if (panel) panel.classList.toggle('fr-hidden', i !== n);
        }

        const info = STEP_TITLES[n];
        this.getElement('ordoscan-step-label', false).textContent = `Étape ${n} sur 4`;
        this.getElement('ordoscan-step-title', false).textContent = info.title;
        this.getElement('ordoscan-stepper-steps', false).dataset.frCurrentStep = String(n);

        const nextWrapper = this.getElement('ordoscan-step-next-wrapper', false);
        if (info.next) {
            nextWrapper.classList.remove('fr-hidden');
            this.getElement('ordoscan-step-next', false).textContent = info.next;
        } else {
            nextWrapper.classList.add('fr-hidden');
        }

        if (n === 2) this.initStep2();
        if (n === 3) this.initStep3();
        if (n === 4) this.initStep4();
    }

    // =============================================================
    // Étape 1 : Import (fichier ou presse-papier)
    // =============================================================
    async handleImportedFile(file) {
        if (!file.type.startsWith('image/')) {
            await AppManagers.CodexManager.show('error', 'Le fichier collé/déposé n\'est pas une image.');
            return;
        }

        const url = URL.createObjectURL(file);
        this._objectUrls.push(url);

        const img = new Image();
        img.onload = () => {
            this._sourceImageEl = img;

            const previewImg = this.getElement('ordoscan-import-preview-img');
            previewImg.src = url;
            this.getElement('ordoscan-import-preview').classList.remove('fr-hidden');

            AppManagers.CodexManager.show('success', 'Image importée avec succès');

            // Préchargement anticipé du modèle de suppression de fond (non bloquant)
            preloadBackgroundRemoval();
        };
        img.src = url;
    }

    resetImport() {
        this._sourceImageEl = null;
        this.getElement('ordoscan-import-preview').classList.add('fr-hidden');
        this.getElement('ordoscan-fileinput').value = '';
    }

    // =============================================================
    // Étape 2 : Scanic (recadrage + perspective)
    // =============================================================
    async initStep2() {
        if (!this._sourceImageEl) { this.goToStep(1); return; }

        const status = this.getElement('ordoscan-crop-status', false);
        const container = this.getElement('ordoscan-scanic-container', false);
        this.getElement('ordoscan-step2-export', false).classList.add('fr-hidden');

        status.textContent = '🔍 Détection du document en cours…';
        status.classList.remove('fr-hidden');

        try {
            const corners = await detectDocumentCorners(this._sourceImageEl);
            status.classList.add('fr-hidden');

            this._cornerEditor?.destroy();
            this._cornerEditor = mountCornerEditor(container, this._sourceImageEl, corners, () => {
                // callback à chaque ajustement manuel : rien de bloquant à faire ici
            });
        } catch (err) {
            AppManagers.log(this.key, 'error', 'Erreur détection Scanic', err);
            status.textContent = '⚠️ Détection automatique indisponible, ajustez les coins manuellement.';
        }
    }

    async validateCrop() {
        if (!this._cornerEditor) return;

        try {
            await AppManagers.CodexManager.show('info', 'Recadrage et correction de perspective en cours…');
            const corners = this._cornerEditor.getCorners();
            const canvas = await extractFlattenedImage(this._sourceImageEl, corners, 1400);

            this._croppedBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.95));
            this._finalBlob = this._croppedBlob;

            // Nouveau recadrage -> le masque de suppression de fond éventuellement
            // calculé précédemment n'est plus valable.
            this._rawRemovedBgBlob = null;
            this._rawRemovedBgForBlob = null;

            this.getElement('ordoscan-step2-export', false).classList.remove('fr-hidden');
            await AppManagers.CodexManager.show('success', 'Recadrage validé');
        } catch (err) {
            AppManagers.log(this.key, 'error', 'Erreur extraction Scanic', err);
            await AppManagers.CodexManager.show('error', 'Erreur lors du recadrage : ' + err.message);
        }
    }

    // =============================================================
    // Étape 3 : suppression du fond (optionnelle)
    // =============================================================
    initStep3() {
        if (!this._croppedBlob) { this.goToStep(2); return; }

        const beforeImg = this.getElement('ordoscan-bg-before-img', false);
        const url = URL.createObjectURL(this._croppedBlob);
        this._objectUrls.push(url);
        beforeImg.src = url;

        const slider = this.getElement('ordoscan-bg-strength', false);
        const afterImg = this.getElement('ordoscan-bg-after-img', false);
        this.getElement('ordoscan-bg-progress', false).classList.add('fr-hidden');

        if (this._rawRemovedBgBlob && this._rawRemovedBgForBlob === this._croppedBlob) {
            slider.disabled = false;
            this.rerenderWithCurrentStrength();
        } else {
            slider.disabled = true;
            afterImg.classList.add('fr-hidden');
        }
    }

    skipBackgroundRemoval() {
        this._finalBlob = this._croppedBlob;
        this.goToStep(4);
    }

    async runBackgroundRemoval() {
        const progressEl = this.getElement('ordoscan-bg-progress', false);
        const progressText = this.getElement('ordoscan-bg-progress-text', false);
        const afterImg = this.getElement('ordoscan-bg-after-img', false);
        const slider = this.getElement('ordoscan-bg-strength', false);

        // Cache : si le masque a déjà été calculé pour ce même recadrage, on ne
        // relance pas l'IA (coûteuse), on ré-applique juste le curseur actuel.
        if (this._rawRemovedBgBlob && this._rawRemovedBgForBlob === this._croppedBlob) {
            return this.rerenderWithCurrentStrength();
        }

        progressEl.classList.remove('fr-hidden');
        afterImg.classList.add('fr-hidden');
        slider.disabled = true;

        try {
            const transparentPng = await removeImageBackground(this._croppedBlob, (key, current, total) => {
                progressText.textContent = `Traitement en cours… (${key} ${Math.round((current / total) * 100)}%)`;
            });

            this._rawRemovedBgBlob = transparentPng;
            this._rawRemovedBgForBlob = this._croppedBlob;

            progressEl.classList.add('fr-hidden');
            slider.disabled = false;
            slider.value = 50;
            this.getElement('ordoscan-bg-strength-output', false).textContent = '50';

            await this.rerenderWithCurrentStrength();
            await AppManagers.CodexManager.show('success', 'Arrière-plan supprimé');
            this.goToStep(4);
        } catch (err) {
            progressEl.classList.add('fr-hidden');
            AppManagers.log(this.key, 'error', 'Erreur suppression du fond', err);
            await AppManagers.CodexManager.show('error', 'Erreur lors de la suppression du fond : ' + err.message);
        }
    }

    /**
     * Appelé sur chaque déplacement du curseur : re-traite juste le canal alpha
     * (rapide, pas de re-calcul IA) et met à jour l'aperçu "Après" en direct.
     */
    onStrengthChange(value) {
        this.getElement('ordoscan-bg-strength-output', false).textContent = value;

        clearTimeout(this._strengthDebounceTimer);
        this._strengthDebounceTimer = setTimeout(() => this.rerenderWithCurrentStrength(), 100);
    }

    async rerenderWithCurrentStrength() {
        if (!this._rawRemovedBgBlob) return;

        const strength = Number(this.getElement('ordoscan-bg-strength', false).value);
        const adjustedPng = await applyAlphaStrength(this._rawRemovedBgBlob, strength);

        const fondChoisi = document.querySelector('input[name="ordoscan-fond"]:checked')?.value || 'blanc';
        this._finalBlob = fondChoisi === 'blanc' ? await compositeOnWhite(adjustedPng) : adjustedPng;

        const afterImg = this.getElement('ordoscan-bg-after-img', false);
        const url = URL.createObjectURL(this._finalBlob);
        this._objectUrls.push(url);
        afterImg.src = url;
        afterImg.classList.remove('fr-hidden');
    }

    // =============================================================
    // Étape 4 : export (télécharger / partager)
    // =============================================================
    initStep4() {
        if (!this._finalBlob) { this.goToStep(2); return; }

        const preview = this.getElement('ordoscan-final-preview', false);
        const url = URL.createObjectURL(this._finalBlob);
        this._objectUrls.push(url);
        preview.src = url;

        const shareBtn = this.getElement('ordoscan-btn-share', false);
        shareBtn.classList.toggle('fr-hidden', !canShareFiles(this._finalBlob, 'ordonnance.png'));
    }

    downloadCurrent(blob, filename) {
        if (!blob) return;
        downloadBlob(blob, filename);
        AppManagers.CodexManager.show('success', 'Téléchargement lancé');
    }

    async shareCurrent() {
        if (!this._finalBlob) return;
        try {
            await shareBlob(this._finalBlob, 'ordonnance.png', {
                title: 'Ordonnance nettoyée',
                text: 'Ordonnance retravaillée avec Ordoscan'
            });
        } catch (err) {
            if (err.name !== 'AbortError') {
                AppManagers.log(this.key, 'error', 'Erreur de partage', err);
                await AppManagers.CodexManager.show('error', 'Le partage a échoué.');
            }
        }
    }

    // =============================================================
    // Reset complet
    // =============================================================
    restart() {
        this._objectUrls.forEach(u => URL.revokeObjectURL(u));
        this._objectUrls = [];
        this._sourceImageEl = null;
        this._cornerEditor?.destroy();
        this._cornerEditor = null;
        this._croppedBlob = null;
        this._finalBlob = null;
        this.resetImport();
        this.goToStep(1);
    }

    cleanup() {
        this._objectUrls.forEach(u => URL.revokeObjectURL(u));
        this._cornerEditor?.destroy();
        clearTimeout(this._strengthDebounceTimer);
        super.cleanup();
    }
}

new OrdoscanHandler().register();
/// <reference path="../../../static/js/types.js" />

/**
 * Handler pour la vue Vaccination avec gestion de modale DSFR
 * @extends {AppManagers.ViewHandler}
 */
class VaccinationHandler extends AppManagers.ViewHandler {
    constructor() {
        super('viewVaccination');
        
        // ✅ Références des éléments de la modale (initialisés dans onload)
        this.modal = {
            element: null,
            title: null,
            body: null,
            dsfr: null  // Instance DSFR de la modale
        };
    }
    
    async onload() {
        // 1. Initialise la modale
        this.initModal();
        
        // 2. Attache les triggers
        this.attachTriggers();
    }
    
    /**
     * Initialise la modale et son listener de fermeture
     */
    initModal() {
        this.modal.element = this.getElement('vaccination-modal');
        this.modal.title = this.getElement('modal-content-title');
        this.modal.body = this.getElement('modal-content-body');
        
        if (!this.modal.element) {
            AppManagers.log(this.key, 'error', 'Modale #vaccination-modal non trouvée');
            return;
        }
        
        // Instance DSFR pour contrôler la modale
        this.modal.dsfr = window.dsfr(this.modal.element);
        
        // ✅ Listener de fermeture (natif du <dialog>)
        this.addListener(this.modal.element, 'close', this.handleModalClose);
        
        AppManagers.log(this.key, 'success', 'Modale initialisée');
    }
    
    /**
     * Nettoie le contenu de la modale à la fermeture
     */
    handleModalClose() {
        if (!this.modal.title || !this.modal.body) return;
        
        // Reset le contenu
        this.modal.title.textContent = '';
        this.modal.body.innerHTML = '';
        
        // Reset tous les triggers actifs
        this.resetTriggers();
        
        AppManagers.log(this.key, 'info', 'Modale fermée et nettoyée');
    }
    
    /**
     * Attache les listeners sur tous les triggers [data-vaccination-trigger]
     */
    attachTriggers() {
        const triggers = document.querySelectorAll('[data-vaccination-trigger]');
        
        if (!triggers.length) {
            AppManagers.log(this.key, 'warn', 'Aucun trigger [data-vaccination-trigger] trouvé');
            return;
        }
        
        triggers.forEach(trigger => {
            this.addListener(trigger, 'click', this.handleTriggerClick);
            
            // Support clavier (Enter/Space sur éléments avec tabindex)
            if (trigger.hasAttribute('tabindex')) {
                this.addListener(trigger, 'keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        this.handleTriggerClick(e);
                    }
                });
            }
        });
        
        AppManagers.log(this.key, 'success', `${triggers.length} trigger(s) attaché(s)`);
    }
    
    /**
     * Gère le clic sur un trigger
     * @param {Event} e
     */
    async handleTriggerClick(e) {
        e.preventDefault();
        
        const trigger = e.currentTarget;
        const title = trigger.dataset.modalTitle || 'Détail';
        const partialPath = trigger.dataset.partialPath;
        
        if (!partialPath) {
            AppManagers.log(this.key, 'error', 'Pas de data-partial-path sur le trigger');
            return;
        }
        
        // ✅ Met à jour le contenu de la modale
        await this.updateModalContent(title, partialPath);
        
        // ✅ Marque le trigger comme actif
        trigger.setAttribute('data-fr-opened', 'true');
        
        // ✅ Ouvre la modale (API DSFR)
        if (this.modal.dsfr?.modal) {
            this.modal.dsfr.modal.disclose();
        }
        
        AppManagers.log(this.key, 'info', `Modale ouverte: "${title}"`);
    }
    
    /**
     * Met à jour le titre et le contenu de la modale
     * @param {string} title
     * @param {string} partialPath
     */
    async updateModalContent(title, partialPath) {
        if (!this.modal.title || !this.modal.body) return;
        
        // Titre
        this.modal.title.textContent = title;
        
        // Contenu (charge le partial)
        try {
            await AppManagers.TemplateManager.renderInto(
                partialPath,
                {},
                this.modal.body,
                true  // replace
            );
        } catch (err) {
            this.modal.body.innerHTML = '<p class="fr-error-text">Erreur de chargement du contenu.</p>';
            AppManagers.log(this.key, 'error', `Erreur chargement: ${partialPath}`, err);
        }
    }
    
    /**
     * Reset tous les triggers à data-fr-opened="false"
     */
    resetTriggers() {
        const openedTriggers = document.querySelectorAll('[data-vaccination-trigger][data-fr-opened="true"]');
        openedTriggers.forEach(trigger => {
            trigger.setAttribute('data-fr-opened', 'false');
        });
    }
}

// ✅ Enregistrement
new VaccinationHandler().register();
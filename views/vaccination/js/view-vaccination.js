// /views/vaccination/js/view-vaccination.js

// Enregistrement du gestionnaire de vue auprès du DomloadManager
AppManagers.DomloadManager.registerHandler('vueVaccination', {
  presetVariableOnload(element, key) {
    // Initialisation de base
    window.currentView = key;
    window.AppDebug = true; // Activer le mode debug globalement
    element.setAttribute('data-loaded', 'true');
    AppManagers.log('vueVaccination', 'info', 'Preset onload OK');
  },

  methodeOnload: async function (viewElement) {
    // ⚠️ SÉCURITÉ : Vérifier si les écouteurs ont déjà été attachés pour éviter le double chargement.
    if (viewElement.getAttribute('data-listeners-attached') === 'true') {
        AppManagers.log('vueVaccination', 'warn', 'methodeOnload déjà exécuté. Annulation de la double exécution.');
        return;
    }
    viewElement.setAttribute('data-listeners-attached', 'true'); 


    AppManagers.log('vueVaccination', 'success', 'Chargement de la vue Vaccination. Mise en place des écouteurs.');
    
    // 1. Récupération de l'instance unique de la modale
    const modalElement = document.getElementById('vaccination-modal');
    if (!modalElement) {
        AppManagers.log('vueVaccination', 'error', 'Instance de modale #vaccination-modal non trouvée. Assurez-vous qu\'elle est bien dans le DOM.');
        return;
    }

    // 2. Attendre que HTMX ait chargé le tableau (synchronisation)
    setTimeout(() => {
        const table = viewElement.querySelector('#presentation-panel .vaccination-table');
        if (table) {
            //setupTableListeners(table, modalElement); // Configurer les clics sur le tableau
            AppManagers.log('vueVaccination', 'info', 'Écouteurs de clic attachés au tableau.');
        } else {
            AppManagers.log('vueVaccination', 'warn', 'Tableau de vaccination non trouvé après 100ms. Vérifiez le sélecteur ou le chargement HTMX.');
        }
    }, 100); 
  }
});


/**
 * Configure les écouteurs de clic sur les cellules cliquables du tableau.
 * @param {HTMLElement} tableElement - L'élément <table>.
 * @param {HTMLDialogElement} modalElement - L'élément <dialog> de la modale unique.
 */
function setupTableListeners(tableElement, modalElement) {
    const triggerCells = tableElement.querySelectorAll('.vaccination-trigger'); 

    // GESTION DE LA FERMETURE (inchangé)
    modalElement.querySelector('#modal-close-btn').addEventListener('click', () => {
        modalElement.close();
    });
    
    // Événement natif de fermeture (pour retirer la classe DSFR et nettoyer)
    modalElement.addEventListener('close', () => {
        modalElement.classList.remove('is-open');
        const modalBodyEl = modalElement.querySelector('#modal-content-body');
        modalBodyEl.innerHTML = '';
    });

    // ÉVÉNEMENT DE CLIC SUR LES CELLULES
    triggerCells.forEach(cell => {
        cell.addEventListener('click', async (event) => {
            const target = event.currentTarget;
            
            // 🎯 CORRECTION 1: Nouvelle garde contre le double-clic (plus fiable que modalElement.open)
            if (target.getAttribute('data-loading') === 'true') {
                AppManagers.log('vueVaccination', 'warn', 'Chargement en cours, double-clic ignoré.');
                return; 
            }
            
            const partialPath = target.getAttribute('data-partial-path');
            const modalTitle = target.getAttribute('data-modal-title');
            
            if (!partialPath) return; 

            const modalTitleEl = modalElement.querySelector('#modal-content-title');
            const modalBodyEl = modalElement.querySelector('#modal-content-body');

            // --- DEBUT DU TRAITEMENT ---
            target.setAttribute('data-loading', 'true'); // Verrouiller l'élément
            
            // 1. Mettre à jour le titre et afficher un message de chargement
            modalTitleEl.textContent = modalTitle; // ✅ Devient "Rappel DTP / Coqueluche à 25 ans"
            modalBodyEl.innerHTML = '<p class="fr-my-3v fr-p-2v fr-text--info">Chargement des indications...</p>'; 
            
            // 2. OUVERTURE DE LA MODALE
            modalElement.showModal(); 
            modalElement.classList.add('is-open'); 

            try {
                // 3. Injection des données du partial
                await AppManagers.TemplateManager.renderInto(
                    partialPath, 
                    {}, 
                    modalBodyEl,
                    true
                );
                
                // 4. Post-traitement et formatage du contenu (inchangé)
                const content = modalBodyEl.textContent.trim();
                
                if (content.includes(',')) {
                    const items = content.split(',').map(item => `<li>${item.trim()}</li>`).join('');
                    modalBodyEl.innerHTML = `<ul class="fr-list">${items}</ul>`;
                    AppManagers.log('vueVaccination', 'success', `Partial ${partialPath} injecté et formaté en liste.`);
                } else {
                    AppManagers.log('vueVaccination', 'success', `Partial ${partialPath} injecté.`);
                }

            } catch (error) {
                AppManagers.log('vueVaccination', 'error', `Erreur lors du chargement du partial ${partialPath}: ${error.message}`);
                modalBodyEl.innerHTML = `<p class="fr-my-3v fr-p-2v fr-text--danger">Erreur de chargement du contenu. Vérifiez le chemin : ${partialPath}</p>`;
            } finally {
                // 🎯 CORRECTION 2: S'assurer que l'élément est déverrouillé après le try/catch
                target.setAttribute('data-loading', 'false'); 
            }
        });
    });
}
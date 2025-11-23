/**
 * Utilisation :
 * import { initCopyListeners } from '.../assistant-clipboard.js';
 * await initCopyListeners();
 * 
 * Dans le HTML, ajouter l'attribut data-copy sur un bouton ou un lien,
 * avec comme valeur le sélecteur CSS de l'élément à copier.
 * <button type="button" class="..." data-copy="#target-element">Copier</button>
 */
/**
 * Initialise les listeners de clic sur tous les éléments ayant l'attribut data-copy.
 * Copie le contenu de l'élément cible (défini par data-copy) dans le presse-papiers.
 * * @param {function} [logFunction=console.log] - Fonction de logging à utiliser (ex: AppManagers.log).
 */
export function initCopyListeners(logFunction = console.log) {
    const copyButtons = document.querySelectorAll("[data-copy]");
    
    copyButtons.forEach(btn => {
        // Empêche l'initialisation multiple sur le même élément
        if (btn.hasAttribute('data-clipboard-initialized')) return; 

        btn.addEventListener("click", () => {
            const targetSelector = btn.dataset.copy;
            const target = document.querySelector(targetSelector);
            
            if (!target) {
                logFunction('[Assistant Clipboard] Cible non trouvée : ' + targetSelector, 'error');
                return;
            }

            // Récupère la valeur (pour input/textarea) ou le texte (pour autres)
            const textToCopy = target.value || target.innerText;

            // Utilisation de l'API moderne du presse-papiers
            navigator.clipboard.writeText(textToCopy)
                .then(() => {
                    logFunction('[Assistant Clipboard] Contenu copié avec succès.', 'success');
                    
                    // Feedback visuel (conforme à l'UX DSFR)
                    const initialText = btn.textContent;
                    btn.textContent = 'Copié !';
                    setTimeout(() => {
                        btn.textContent = initialText;
                    }, 1500);
                })
                .catch(err => {
                    logFunction('[Assistant Clipboard] Erreur de copie :', err, 'error');
                    alert("Erreur de copie. Assurez-vous d'être en HTTPS ou localhost.");
                });
        });
        
        btn.setAttribute('data-clipboard-initialized', 'true'); // Marquer comme initialisé
    });
}
// form-manager.js (mis à jour : query spécifique pour codex lié au form)
(function () {
    if (window.FormManager) {
        return;
    }

    window.FormManager = {
        handlers: {},

        registerHandler: function (formId, handler) {
            this.handlers[formId] = handler;
            console.log(`Handler enregistré pour: ${formId}`);
        },

        addResultMessage: async function (codex, type, message) {
            if (!codex) return;
            // Retry si pas prêt (micro-delay pour fetch)
            setTimeout(() => codex.addMessage(type, message), 0);
        },

        init: function () {
            document.addEventListener("submit", async function (e) {
                if (e.target && e.target.matches("form")) {
                    e.preventDefault();
                    const form = e.target;
                    const data = new FormData(form);

                    const handler = window.FormManager.handlers[form.id];
                    if (handler) {
                        // Query spécifique : codex avec attribut for matching form.id
                        const codex = document.querySelector(`codex-missives[for="${form.id}"]`);
                        if (!codex) {
                            console.warn(`Codex-missives pour "${form.id}" non trouvé ! Vérifie l'attribut for dans le HTML.`);
                            return;
                        }
                        try {
                            await handler(data, form, codex, window.FormManager, window.Validator);
                            console.log('Handler exécuté avec succès');
                        } catch (err) {
                            console.error('Erreur dans handler:', err);
                        }
                    } else {
                        console.warn("Aucun handler pour:", form.id);
                    }
                }
            });
            console.log('FormManager initialisé');
        }
    };

    window.FormManager.init();
})();
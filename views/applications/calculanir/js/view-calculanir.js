// -- Vue DomloadManager
AppManagers.DomloadManager.registerHandler('vueNir', {
    presetVariableOnload: function (element, key) {
        window.currentView = key;
        element.setAttribute('data-loaded', 'true');
        AppManagers.log('vueNir', 'info', 'Preset onload');
    },

    methodeOnload: async function () {
        await this.ecouterPressePapier();
        AppManagers.log('vueNir', 'success', 'Méthode onload OK');
    },

    // Lecture du presse-papier au chargement
    ecouterPressePapier: async function () {
        try {
            const texte = await navigator.clipboard.readText();
            if (!texte) return;

            const nirInput = document.getElementById('nir');
            const valid = this.validerNIR(texte);

            if (valid) {
                nirInput.value = this.normaliserNIR(texte);
                manager.addResultMessage(codex, 'info', 'NIR collé depuis le presse-papier. Cliquez sur "Calculer la clé" pour continuer.');
            }
        } catch (err) {
            AppManagers.log('vueNir', 'warning', 'Lecture presse-papier non autorisée :', err);
        }
    },

    // Vérifie si la chaîne ressemble à un NIR valide
    validerNIR: function (nir) {
        return /^[12]\d{2}[0-9ABab]{2}\d{6,8}$/.test(nir.replace(/\s/g, ''));
    },

    // Remplace 2A → 19 et 2B → 18 pour le calcul
    normaliserNIR: function (nir) {
        return nir
            .toUpperCase()
            .replace(/\s/g, '')
            .replace('2A', '19')
            .replace('2B', '18');
    },

    // Calcul de la clé modulo 97
    calculerCle: function (nir) {
        const nirNum = this.normaliserNIR(nir);
        if (!/^\d{13}$/.test(nirNum)) return null;

        let reste = 0;
        for (let i = 0; i < nirNum.length; i++) {
            reste = (reste * 10 + parseInt(nirNum[i], 10)) % 97;
        }
        return String(97 - reste).padStart(2, '0');
    }
});


// -- FormManager
AppManagers.FormManager.registerHandler('formCleNir', async (data, form, codex, manager) => {
    try {
        const handler = AppManagers.DomloadManager.handlers['vueNir'];
        const nir = data.get('nir');

        if (!nir) {
            manager.addResultMessage(codex, 'warning', 'Veuillez saisir ou copier un numéro de sécurité sociale.');
            return;
        }

        const nirNormalise = handler.normaliserNIR(nir);
        const cle = handler.calculerCle(nirNormalise);

        if (!cle) {
            manager.addResultMessage(codex, 'error', 'Le NIR doit contenir exactement 13 chiffres après normalisation.');
            return;
        }

        // Affiche la clé dans le champ
        document.getElementById('cle').value = cle;

        // Copie NIR + clé dans le presse-papier
        await navigator.clipboard.writeText(nirNormalise + cle);

        manager.addResultMessage(codex, 'success', `Clé calculée : ${cle} (copié dans le presse-papier)`);

    } catch (err) {
        AppManagers.log('formCleNir', 'error', 'Erreur calcul clé NIR :', err);
        manager.addResultMessage(codex, 'error', 'Erreur lors du calcul de la clé.');
    }
});

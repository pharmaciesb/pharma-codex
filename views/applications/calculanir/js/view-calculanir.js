/**
 * Handlers pour le calcul de la clé NIR (Numéro d'Inscription au Répertoire)
 * @extends AppManagers.ViewHandler
 */
class NirHandler extends AppManagers.ViewHandler {
    constructor() {
        super('viewNir');
    }
    async onload() {
        AppManagers.log('viewNir', 'info', 'Handler NIR chargé');
        this.registerForm('formCleNir', this.handleFormSubmit);
        await this.ecouterPressePapier();
    }

    // Lecture du presse-papier au chargement
    async ecouterPressePapier() {
        try {
            const texte = await navigator.clipboard.readText();
            if (!texte) return;

            const nirInput = document.getElementById('nir');
            const valid = this.validerNIR(texte);

            if (valid) {
                nirInput.value = this.normaliserNIR(texte);
                AppManagers.CodexManager.show('info', 'NIR collé depuis le presse-papier. Cliquez sur "Calculer la clé" pour continuer.');
            }
        } catch (err) {
            AppManagers.log('viewNir', 'warning', 'Lecture presse-papier non autorisée :', err);
        }
    }

    // Vérifie si la chaîne ressemble à un NIR valide
    validerNIR(nir) {
        return /^[12]\d{2}[0-9ABab]{2}\d{6,8}$/.test(nir.replace(/\s/g, ''));
    }

    // Remplace 2A → 19 et 2B → 18 pour le calcul
    normaliserNIR(nir) {
        return nir
            .toUpperCase()
            .replace(/\s/g, '')
            .replace('2A', '19')
            .replace('2B', '18');
    }

    // Calcul de la clé modulo 97
    calculerCle(nir) {
        const nirNum = this.normaliserNIR(nir);
        if (!/^\d{13}$/.test(nirNum)) return null;

        let reste = 0;
        for (let i = 0; i < nirNum.length; i++) {
            reste = (reste * 10 + parseInt(nirNum[i], 10)) % 97;
        }
        return String(97 - reste).padStart(2, '0');
    }

    async handleFormSubmit(data, form, codex, manager) {
        try {
            const nir = data.get('nir');

            if (!nir) {
                AppManagers.CodexManager.show('warning', 'Veuillez saisir ou copier un numéro de sécurité sociale.');
                return;
            }

            const nirNormalise = this.normaliserNIR(nir);
            const cle = this.calculerCle(nirNormalise);

            if (!cle) {
                AppManagers.CodexManager.show('error', 'Le NIR doit contenir exactement 13 chiffres après normalisation.');
                return;
            }

            // Affiche la clé dans le champ
            document.getElementById('cle').value = cle;

            // Copie NIR + clé dans le presse-papier
            await navigator.clipboard.writeText(nirNormalise + cle);

            AppManagers.CodexManager.show('success', `Clé calculée : ${cle} (copié dans le presse-papier)`);

        } catch (err) {
            AppManagers.log('formCleNir', 'error', 'Erreur calcul clé NIR :', err);
            AppManagers.CodexManager.show('error', 'Erreur lors du calcul de la clé.');
        }
    }
}
new NirHandler().register();
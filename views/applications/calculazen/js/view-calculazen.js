/**
 * Handler pour la vue calculazen
 * @extends {AppManagers.ViewHandler}
 */
class ViewCalculazen extends AppManagers.ViewHandler {

    constructor() {
        super('viewCalculazen');
    }
    async onload() {
        AppManagers.log('viewCalculazen', 'info', 'onload étendu');
        this.registerForm('formNombreBoites', this.handleFormSubmitBoite);
        this.registerForm('formRemise', this.handleFormSubmitRemise);
    }

    async handleFormSubmitRemise(data, form, codex, manager, validator) {
        try {
            // Validation globale
            const globalValidation = validator.validatePositiveNumbers(
                data,
                ["unitesPayantes", "prixUnitaire", "remisePourcent", "unitesGratuites"]
            );
            if (!globalValidation.valid) {
                AppManagers.CodexManager.show('error', 'Les valeurs doivent être positives.');
                return;
            }

            const unitesPayantes = parseFloat((data.get("unitesPayantes") || "0").replace(",", ".")) || 0;
            const prixUnitaire = parseFloat((data.get("prixUnitaire") || "0").replace(",", ".")) || 0;
            const remisePourcent = parseFloat((data.get("remisePourcent") || "0").replace(",", ".")) || 0;
            const unitesGratuites = parseFloat((data.get("unitesGratuites") || "0").replace(",", ".")) || 0;

            const montantPayantes = unitesPayantes * prixUnitaire;
            const remiseValeur = montantPayantes * (remisePourcent / 100);
            const montantApresRemise = montantPayantes - remiseValeur;

            const quantiteTotale = unitesPayantes + unitesGratuites;
            if (quantiteTotale === 0) {
                AppManagers.CodexManager.show('error', 'Les valeurs doivent être positives.');
                return;
            }

            const prixTotalSansRemise = quantiteTotale * prixUnitaire;
            const remiseEffective = prixTotalSansRemise - montantApresRemise;
            const pourcentageEffectif = (remiseEffective / prixTotalSansRemise) * 100;
            AppManagers.CodexManager.show('success', `Nouveau pourcentage de remise effectif : ${pourcentageEffectif.toFixed(2)} %`);
        } catch (err) {
            AppManagers.CodexManager.show('error', 'Erreur lors du calcul de la remise.');
            AppManagers.log('formRemise', 'error', 'Erreur handler', err);
        }
    }

    async handleFormSubmitBoite(data, form, codex, manager, validator) {
        try {
            const unitePrise = parseFloat((data.get("unitePrise") || "0").replace(",", ".")) || 0;
            const nombrePrise = parseFloat((data.get("nombrePrise") || "0").replace(",", ".")) || 0;
            const dureePrise = parseFloat((data.get("dureePrise") || "0").replace(",", ".")) || 0;
            const unitesBoite = parseFloat((data.get("unitesBoite") || "1").replace(",", ".")) || 1;

            // Validation
            const posValidation = validator.validatePositiveNumbers(
                data,
                ["unitePrise", "nombrePrise", "dureePrise"]
            );
            const boiteValidation = validator.validateGreaterThanZero(data, "unitesBoite");
            if (!posValidation.valid || !boiteValidation.valid) {
                AppManagers.CodexManager.show('error', "Les valeurs doivent être positives et unités par boîte > 0.");
                return;
            }

            const totalUnites = unitePrise * nombrePrise * dureePrise;
            const nombreBoites = Math.ceil(totalUnites / unitesBoite);
            AppManagers.CodexManager.show('success', `Nombre de boîtes nécessaires : ${nombreBoites}`);
        } catch (err) {
            AppManagers.CodexManager.show('error', 'Erreur lors du calcul du nombre de boîtes.');
            AppManagers.log('formNombreBoites', 'error', 'Erreur handler', err);
        }
    }
}
new ViewCalculazen().register();

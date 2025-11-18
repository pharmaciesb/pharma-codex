// Handler spécifique pour calcul remise effective
AppManagers.FormManager.registerHandler('formRemise', async function (data, form, codex, manager, validator) {
  try {
    // Validation globale
    const globalValidation = validator.validatePositiveNumbers(
      data,
      ["unitesPayantes", "prixUnitaire", "remisePourcent", "unitesGratuites"]
    );
    if (!globalValidation.valid) {
      manager.addResultMessage(codex, 'error', 'Les valeurs doivent être positives.');
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
      manager.addResultMessage(codex, 'error', 'Les valeurs doivent être positives.');
      return;
    }

    const prixTotalSansRemise = quantiteTotale * prixUnitaire;
    const remiseEffective = prixTotalSansRemise - montantApresRemise;
    const pourcentageEffectif = (remiseEffective / prixTotalSansRemise) * 100;

    manager.addResultMessage(
      codex,
      'success',
      `Nouveau pourcentage de remise effectif : ${pourcentageEffectif.toFixed(2)} %`
    );
  } catch (err) {
    manager.addResultMessage(codex, 'error', 'Erreur lors du calcul de la remise.');
    AppManagers.log('formRemise', 'error', 'Erreur handler', err);
  }
});

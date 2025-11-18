// Handler spécifique pour calcul nombre de boîtes
AppManagers.FormManager.registerHandler('formNombreBoites', async function (data, form, codex, manager, validator) {
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
      manager.addResultMessage(codex, 'error', "Les valeurs doivent être positives et unités par boîte > 0.");
      return;
    }

    const totalUnites = unitePrise * nombrePrise * dureePrise;
    const nombreBoites = Math.ceil(totalUnites / unitesBoite);

    manager.addResultMessage(codex, 'success', `Nombre de boîtes nécessaires : ${nombreBoites}`, nombreBoites);
  } catch (err) {
    manager.addResultMessage(codex, 'error', 'Erreur lors du calcul du nombre de boîtes.');
    AppManagers.log('formNombreBoites', 'error', 'Erreur handler', err);
  }
});

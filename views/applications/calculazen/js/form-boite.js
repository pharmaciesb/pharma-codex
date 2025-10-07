// Handlers spécifiques à cette vue
window.FormManager.registerHandler('formNombreBoites', async function(data, form, codex, manager, validator) {
  const unitePrise = parseFloat((data.get("unitePrise") || "0").replace(",", ".")) || 0;
  const nombrePrise = parseFloat((data.get("nombrePrise") || "0").replace(",", ".")) || 0;
  const dureePrise = parseFloat((data.get("dureePrise") || "0").replace(",", ".")) || 0;
  const unitesBoite = parseFloat((data.get("unitesBoite") || "1").replace(",", ".")) || 1;

  // Validation avec Validator
  const posValidation = validator.validatePositiveNumbers(data, ["unitePrise", "nombrePrise", "dureePrise"]);
  const boiteValidation = validator.validateGreaterThanZero(data, "unitesBoite");
  if (!posValidation.valid || !boiteValidation.valid) {
    manager.addResultMessage(codex, 'error', "Les valeurs doivent être positives et unités par boîte > 0.");
    return;
  }

  const totalUnites = unitePrise * nombrePrise * dureePrise;
  const nombreBoites = Math.ceil(totalUnites / unitesBoite);

  const dernierResultat = nombreBoites.toString();
  manager.addResultMessage(codex, 'success', `Nombre de boîtes nécessaires : ${dernierResultat}`, dernierResultat);
});

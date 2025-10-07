(function() {
  // Éviter l'exécution multiple
  if (window.Validator) {
    return;
  }

  window.Validator = {
    // Validation pour valeurs numériques positives
    validatePositiveNumbers: function(data, fields, errorMessage) {
      for (const field of fields) {
        const value = parseFloat((data.get(field) || "0").replace(",", ".")) || 0;
        if (value < 0) {
          return { valid: false, field, value };
        }
      }
      return { valid: true };
    },

    // Validation pour valeur > 0 (ex: unités par boîte)
    validateGreaterThanZero: function(data, field, errorMessage) {
      const value = parseFloat((data.get(field) || "0").replace(",", ".")) || 0;
      if (value <= 0) {
        return { valid: false, field, value };
      }
      return { valid: true };
    },

    // Exemple d'extension : validation email basique
    validateEmail: function(data, field, errorMessage) {
      const email = data.get(field);
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return { valid: false, field, value: email };
      }
      return { valid: true };
    },

    // Méthode générique pour valider plusieurs checks
    validate: function(data, validations, codex) {
      for (const validation of validations) {
        const result = window.Validator[validation.method](data, validation.field, validation.errorMessage);
        if (!result.valid) {
          codex?.addMessage(validation.errorMessage || `Erreur sur ${result.field}: ${result.value}`, 'ERROR', 'SM');
          return { valid: false, details: result };
        }
      }
      return { valid: true };
    }
  };
})();
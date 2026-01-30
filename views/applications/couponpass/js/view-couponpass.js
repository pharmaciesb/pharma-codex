/// <reference path="../../../../static/js/types.js" />

/**
 * Handler pour la vue CouponPass (Extracteur HighCo)
 * Extrait les codes promo depuis les URLs HighCo via un proxy CORS
 * @extends {AppManagers.ViewHandler}
 */
class CouponpassHandler extends AppManagers.ViewHandler {
  constructor() {
    super('viewCouponpass');
    
    // Configuration
    this.PROXY_URL = 'https://long-credit-5315.zink13013.workers.dev/?url=';
    this.MAX_LOGS = 50;
    this.URL_PATTERN = /opn\.to/i;
  }

  // =============================================================
  // Initialisation
  // =============================================================
  async onload() {
    try {
      // Récupération des éléments DOM
      this.urlInput = this.getElement('couponpass-url');
      this.extractBtn = this.getElement('couponpass-extract');
      this.logsDiv = this.getElement('couponpass-logs');

      // Enregistrement du formulaire avec gestion du submit
      this.registerForm('formCouponPass', this.handleExtractSubmit);

      // Log d'initialisation
      this.log('✅ Module CouponPass initialisé');
      AppManagers.log(this.key, 'success', 'Module CouponPass initialisé');
      
    } catch (err) {
      AppManagers.log(this.key, 'error', 'Échec initialisation CouponPass', err);
      await AppManagers.CodexManager.show('error', 'Erreur au chargement du module CouponPass');
    }
  }

  // =============================================================
  // Gestion des logs
  // =============================================================
  
  /**
   * Ajoute une entrée dans le journal d'activité
   * @param {string} message - Message à logger
   * @param {string} [type='info'] - Type de log (info, success, error, warn)
   */
  log(message, type = 'info') {
    if (!this.logsDiv) return;

    const timestamp = new Date().toLocaleTimeString('fr-FR');
    const logEntry = document.createElement('div');
    logEntry.className = 'couponpass-log-entry';
    
    // Icônes selon le type
    const icons = {
      info: 'ℹ️',
      success: '✅',
      error: '❌',
      warn: '⚠️'
    };
    
    const icon = icons[type] || icons.info;
    logEntry.innerHTML = `<span class="timestamp">${timestamp}</span> ${icon} ${message}`;
    
    this.logsDiv.appendChild(logEntry);
    this.logsDiv.scrollTop = this.logsDiv.scrollHeight;

    // Limite le nombre d'entrées
    while (this.logsDiv.children.length > this.MAX_LOGS) {
      this.logsDiv.removeChild(this.logsDiv.firstChild);
    }

    // Log dans AppManagers pour debug
    AppManagers.log(this.key, type, message);
  }

  /**
   * Efface tous les logs
   */
  clearLogs() {
    if (this.logsDiv) {
      this.logsDiv.innerHTML = '';
    }
  }

  // =============================================================
  // Validation
  // =============================================================
  
  /**
   * Valide l'URL saisie
   * @param {string} url - URL à valider
   * @returns {{valid: boolean, error?: string}}
   */
  validateUrl(url) {
    if (!url || url.trim() === '') {
      return { valid: false, error: 'Veuillez entrer une URL' };
    }

    if (!this.URL_PATTERN.test(url)) {
      return { 
        valid: false, 
        error: 'URL invalide. Format attendu: https://opn.to/a/XXXXXX' 
      };
    }

    try {
      new URL(url);
      return { valid: true };
    } catch {
      return { valid: false, error: 'URL malformée' };
    }
  }

  // =============================================================
  // Extraction du code promo
  // =============================================================
  
  /**
   * Gère la soumission du formulaire d'extraction
   * @param {Event} event - Événement de soumission
   */
  async handleExtractSubmit(event) {
    const url = this.urlInput.value.trim();

    // Validation de l'URL
    const validation = this.validateUrl(url);
    if (!validation.valid) {
      await AppManagers.CodexManager.show('error', validation.error);
      this.log(validation.error, 'error');
      return;
    }

    // Désactivation du bouton pendant le traitement
    this.setButtonState(false);

    // Logs
    const truncatedUrl = this.truncateUrl(url, 60);
    this.log(`🔍 Extraction en cours... ${truncatedUrl}`);

    try {
      // Extraction du code
      const code = await this.extractCode(url);
      
      // Succès
      await this.handleSuccess(code);
      
    } catch (err) {
      // Erreur
      await this.handleError(err);
      
    } finally {
      // Réactivation du bouton
      this.setButtonState(true);
    }
  }

  /**
   * Extrait le code promo depuis l'URL HighCo
   * @param {string} url - URL HighCo
   * @returns {Promise<string>} Code promo extrait
   * @throws {Error} Si l'extraction échoue
   */
  async extractCode(url) {
    const proxyUrl = this.PROXY_URL + encodeURIComponent(url);
    
    this.log(`📡 Appel au proxy...`);
    const response = await fetch(proxyUrl);

    if (!response.ok) {
      throw new Error(`Erreur HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    this.log(`📦 Réponse reçue`);

    // Vérification de la réponse
    if (data.status === 'success' && data.code) {
      return data.code;
    }

    // Cas d'erreur ou code non trouvé
    const errorMsg = data.error || data.status || 'Réponse inattendue du serveur';
    throw new Error(`Aucun code détecté: ${errorMsg}`);
  }

  // =============================================================
  // Gestion du succès
  // =============================================================
  
  /**
   * Gère le succès de l'extraction
   * @param {string} code - Code promo extrait
   */
  async handleSuccess(code) {
    // Log succès
    this.log(`Code extrait → ${code}`, 'success');

    // Notification utilisateur
    await AppManagers.CodexManager.show('success', `Code promo extrait: ${code}`);

    // Copie dans le presse-papiers
    await this.copyToClipboard(code);

    // Reset du formulaire
    this.urlInput.value = '';
    this.urlInput.focus();
  }

  /**
   * Copie le code dans le presse-papiers
   * @param {string} code - Code à copier
   */
  async copyToClipboard(code) {
    try {
      await navigator.clipboard.writeText(code);
      this.log('📋 Code copié dans le presse-papiers', 'success');
    } catch (err) {
      this.log('⚠️ Copie impossible (autorisez le presse-papiers)', 'warn');
      AppManagers.log(this.key, 'warn', 'Clipboard API refusée', err);
    }
  }

  // =============================================================
  // Gestion des erreurs
  // =============================================================
  
  /**
   * Gère les erreurs d'extraction
   * @param {Error} err - Erreur rencontrée
   */
  async handleError(err) {
    const errorMsg = err.message || 'Erreur inconnue';
    
    // Log erreur
    this.log(`Erreur: ${errorMsg}`, 'error');
    
    // Notification utilisateur
    await AppManagers.CodexManager.show('error', `Erreur d'extraction: ${errorMsg}`);
    
    // Log détaillé pour debug
    AppManagers.log(this.key, 'error', 'Erreur extraction', err);
  }

  // =============================================================
  // Utilitaires UI
  // =============================================================
  
  /**
   * Active/désactive le bouton d'extraction
   * @param {boolean} enabled - État du bouton
   */
  setButtonState(enabled) {
    if (!this.extractBtn) return;

    this.extractBtn.disabled = !enabled;
    this.extractBtn.textContent = enabled ? ' 🔍 ' : ' ⏳ ';
  }

  /**
   * Tronque une URL pour l'affichage
   * @param {string} url - URL à tronquer
   * @param {number} maxLength - Longueur maximale
   * @returns {string} URL tronquée
   */
  truncateUrl(url, maxLength) {
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength) + '...';
  }
}

// Enregistrement automatique du handler
new CouponpassHandler().register();
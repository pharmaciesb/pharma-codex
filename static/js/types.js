// static/js/types.js

/**
 * Interface pour les handlers de vue (DomloadManager) - Version objet classique
 * @typedef {Object} IViewHandler
 * @property {function(HTMLElement, string): Promise<void>} methodeOnload - Fonction appelée au chargement du DOM.
 * @property {function(HTMLElement, string): void} [presetVariableOnload] - (Optionnel) Initialisation synchrone.
 * @property {function(): Promise<void>|void} [cleanup] - (Optionnel) Nettoyage avant destruction du handler.
 */

/**
 * Signature pour les callbacks de formulaires (FormManager)
 * @callback FormHandlerCallback
 * @param {FormData} data - Les données du formulaire.
 * @param {HTMLFormElement} form - L'élément formulaire source.
 * @param {HTMLElement} [codexGlobal] - Element de notification.
 * @param {Object} [formManager] - Instance du FormManager.
 * @param {Object} [validator] - Validateur global si disponible.
 * @returns {Promise<void>|void}
 */

/**
 * Classe de base pour créer des handlers de vue avec gestion automatique du cycle de vie
 * @class ViewHandler
 * @property {string} key - Identifiant unique du handler (ex: 'vueEtiqueteuse')
 * @property {Object.<string, HTMLElement>} elements - Stockage des éléments DOM récupérés
 * @property {Array.<{element: HTMLElement, event: string, handler: Function}>} listeners - Liste des listeners attachés
 * @property {Array.<string>} formHandlers - Liste des IDs de formulaires enregistrés
 */

/**
 * @typedef {Object} ViewHandlerMethods
 * @property {function(): Promise<void>} onload - Méthode à override pour initialiser la vue
 * @property {function(): Promise<void>} methodeOnload - Méthode appelée par DomloadManager (ne pas override)
 * @property {function(HTMLElement, string, Function, Object=): Function} addListener - Ajoute un listener avec tracking automatique
 * @property {function(string, FormHandlerCallback): Function} registerForm - Enregistre un form handler avec tracking
 * @property {function(string, boolean=): HTMLElement|null} getElement - Récupère et stocke un élément par ID
 * @property {function(): void} cleanup - Nettoie automatiquement tous les listeners (ne pas override sauf besoin spécifique)
 * @property {function(): ViewHandler} register - Enregistre le handler auprès du DomloadManager
 */

/**
 * Configuration pour Events.safeListen
 * @typedef {Object} SafeListenOptions
 * @property {boolean} [capture] - Mode capture
 * @property {boolean} [once] - Écouter une seule fois
 * @property {boolean} [passive] - Listener passif
 */

/**
 * Manager global de l'application
 * @typedef {Object} AppManagers
 * @property {Object} DomloadManager - Gère le cycle de vie des handlers de vue
 * @property {function(string, IViewHandler): void} DomloadManager.registerHandler - Enregistre un handler
 * @property {function(string): Promise<void>} DomloadManager.initModule - Initialise un module
 * 
 * @property {Object} FormManager - Gère les soumissions de formulaires
 * @property {function(string, FormHandlerCallback): void} FormManager.registerHandler - Enregistre un handler de form
 * @property {function(): void} FormManager.clearAllHandlers - Nettoie tous les handlers
 * 
 * @property {Object} CodexManager - Gère les notifications
 * @property {function(string, string): Promise<void>} CodexManager.show - Affiche une notification (type: 'success'|'error'|'info'|'warn', message)
 * 
 * @property {Object} Events - Gère les listeners sécurisés
 * @property {function(HTMLElement, string, Function, SafeListenOptions=): void} Events.safeListen - Attache un listener avec lock
 * @property {function(HTMLElement, string, Function): void} Events.safeRemove - Détache un listener avec lock
 * 
 * @property {Object} TemplateManager - Gère le rendu de templates
 * @property {function(string): Promise<string>} TemplateManager.load - Charge un template
 * @property {function(string, Object): string} TemplateManager.renderString - Rend un template avec data
 * @property {function(string, Object, string|HTMLElement, boolean=): Promise<HTMLElement>} TemplateManager.renderInto - Rend dans un élément
 * 
 * @property {Object} IncludeLoader - Charge les includes HTML
 * @property {function(HTMLElement=, number=): Promise<void>} IncludeLoader.loadIncludes - Charge récursivement les [data-include]
 * 
 * @property {Object} PdfAssistant - Gère la génération de PDFs
 * @property {function(): void} PdfAssistant.reset - Réinitialise la config
 * @property {function(Object): Promise<void>} PdfAssistant.generate - Génère un PDF
 * 
 * @property {typeof ViewHandler} ViewHandler - Classe de base pour les handlers
 * 
 * @property {function(string, string, ...any): void} log - Logger avec couleurs (manager, type, ...args)
 */

/**
 * Router global de navigation
 * @typedef {Object} Router
 * @property {string} defaultRoute - Route par défaut
 * @property {string} target - Sélecteur de l'élément cible (#router)
 * @property {string|null} currentModule - Module actuellement chargé
 * @property {function(): string} getRouteFromHash - Récupère la route depuis le hash
 * @property {function(string): void} updateActiveNav - Met à jour aria-current sur la nav
 * @property {function(): Promise<void>} loadRoute - Charge la route actuelle
 * @property {function(HTMLElement): string|null} extractModuleKey - Extrait le data-load-key
 * @property {function(): Promise<void>} cleanup - Nettoie le module précédent
 * @property {function(string): void} navigate - Navigation programmatique
 * @property {function(): void} init - Initialise le router
 */

/**
 * Manager du breadcrumb
 * @typedef {Object} BreadcrumbManager
 * @property {function(string): void} updateBreadcrumb - Met à jour le fil d'Ariane
 * @property {function(): void} init - Initialise le manager
 */

// Export pour JSDoc (ne s'exécute pas)
export {};
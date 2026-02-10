// #module-application-manager.js
import { PdfAssistant } from "./assistants/assistant-pdf.js";

(function () {
    if (window.AppManagers) return;

    window.AppDebug = true;

    const log = (manager, type, ...args) => {
        if (!window.AppDebug) return;
        const colors = { info: '#00f', success: '#0a0', warn: '#f90', error: '#f00', action: '#09f' };
        console.log(`%c[${manager}][${type}]`, `color: ${colors[type] || '#888'}; font-weight: bold`, ...args);
    };

    // --- CodexManager : Notifications ---
    const CodexManager = {
        _selector: '#codexGlobal',
        show: async function (type, message) {
            log('CodexManager', type, message);
            await customElements.whenDefined('codex-missives');
            const codex = document.querySelector(this._selector);
            if (codex?.addMessage) codex.addMessage(type, message);
        }
    };

    // --- Events : Gestion sécurisée des listeners ---
    const Events = {
        safeListen: function (element, eventType, callback, options = {}) {
            if (!element) {
                console.warn('[Events] Element null/undefined fourni à safeListen');
                return;
            }

            // ✅ Lock spécifique au TYPE d'événement (permet plusieurs types sur le même élément)
            const lockAttr = `listener_${eventType.replace(/[^a-z0-9]/gi, '_')}_attached`;

            if (element.dataset[lockAttr] === 'true') {
                log('Events', 'info', `Listener ${eventType} déjà attaché, skip`);
                return;
            }

            element.addEventListener(eventType, callback, options);
            element.dataset[lockAttr] = 'true';
            log('Events', 'success', `Listener ${eventType} attaché`);
        },

        // ✅ NOUVEAU : Méthode pour détacher proprement
        safeRemove: function (element, eventType, callback) {
            if (!element) return;

            const lockAttr = `listener_${eventType.replace(/[^a-z0-9]/gi, '_')}_attached`;

            if (element.dataset[lockAttr] === 'true') {
                element.removeEventListener(eventType, callback);
                delete element.dataset[lockAttr];
                log('Events', 'info', `Listener ${eventType} détaché`);
            }
        }
    };

    // --- DomloadManager : Initialisation robuste ---
    const DomloadManager = {
        handlers: {},
        _initialized: false,

        // ✅ Convention pour charger auto les scripts
        _loadModuleScript: async function (key) {
            const currentRoute = window.location.hash.replace('#', '');

            if (!currentRoute) {
                log('DomloadManager', 'warn', 'Pas de route dans le hash');
                return;
            }

            const pathParts = currentRoute.split('/');
            const htmlFile = pathParts[pathParts.length - 1];
            const moduleName = htmlFile.replace('.html', '');
            const basePath = pathParts.slice(0, -1).join('/');

            const scriptPath = `${window.BASE_URL}/${basePath}/js/view-${moduleName}.js`;

            try {
                await import(scriptPath);
                log('DomloadManager', 'success', `Script chargé : ${scriptPath}`);
            } catch (err) {
                log('DomloadManager', 'warn', `Script non trouvé : ${scriptPath}`);
            }
        },

        registerHandler: function (key, handler) {
            this.handlers[key] = handler;
            log('DomloadManager', 'info', `Handler enregistré : ${key}`);
            if (this._initialized) this._executeWithRetry(key);
        },

        _executeWithRetry: async function (key, retries = 5) {
            const handler = this.handlers[key];

            if (!handler) {
                log('DomloadManager', 'info', `Pas de handler pour ${key}, tentative de chargement du script`);
                await this._loadModuleScript(key);

                const newHandler = this.handlers[key];
                if (!newHandler) {
                    log('DomloadManager', 'warn', `Aucun handler après load script : ${key}`);
                    return;
                }
                return this._executeWithRetry(key, retries);
            }

            // ✅ NOUVEAU : Vérifier si déjà initialisé
            const el = document.querySelector(`[data-load-key="${key}"]`) || document.getElementById(key);

            if (!el) {
                log('DomloadManager', 'warn', `Cible ${key} non trouvée, skip init`);
                return;
            }

            if (el.dataset.handlerInitialized === 'true') {
                log('DomloadManager', 'info', `✅ Handler déjà initialisé : ${key}, skip`);
                return;
            }

            // Marquer comme en cours d'initialisation
            el.dataset.handlerInitialized = 'pending';

            for (let i = 1; i <= retries; i++) {
                try {
                    if (handler.presetVariableOnload) handler.presetVariableOnload(el, key);
                    if (handler.methodeOnload) {
                        const result = handler.methodeOnload(el, key);
                        if (result instanceof Promise) await result;
                    }

                    // ✅ Marquer comme initialisé avec succès
                    el.dataset.handlerInitialized = 'true';
                    log('DomloadManager', 'success', `Initialisé : ${key}`);
                    return;
                } catch (err) {
                    el.dataset.handlerInitialized = 'error';
                    log('DomloadManager', 'error', `Erreur dans ${key}:`, err);
                    return;
                }
            }

            log('DomloadManager', 'warn', `Cible ${key} non trouvée après ${retries} essais.`);
        },

        init: function () {
            if (this._initialized) return;
            this._initialized = true;

            const runAll = () => {
                requestAnimationFrame(() => {
                    Object.keys(this.handlers).forEach(k => this._executeWithRetry(k));
                });
            };

            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', runAll);
            } else {
                runAll();
            }
        },

        // ✅ Méthode publique pour le Router
        initModule: async function (key) {
            return this._executeWithRetry(key);
        }
    };

    // --- FormManager : Soumission propre ---
    const FormManager = {
        handlers: {},

        registerHandler: function (id, callback) {
            this.handlers[id] = callback;
            log('FormManager', 'info', `Handler enregistré : ${id}`);
        },

        // ✅ NOUVEAU : Cleanup automatique de tous les handlers
        clearAllHandlers: function () {
            const handlerKeys = Object.keys(this.handlers);
            if (handlerKeys.length > 0) {
                handlerKeys.forEach(key => delete this.handlers[key]);
                log('FormManager', 'info', `🧹 ${handlerKeys.length} handler(s) nettoyé(s): ${handlerKeys.join(', ')}`);
            }
        },

        init: function () {
            document.addEventListener('submit', async (e) => {
                const form = e.target;
                const handler = this.handlers[form.id];

                if (handler) {
                    e.preventDefault();
                    log('FormManager', 'action', `Submit: ${form.id}`);

                    if (!form.checkValidity()) {
                        form.reportValidity();
                        return;
                    }

                    try {
                        await handler(new FormData(form), form, document.getElementById('codexGlobal'), this, window.Validator);
                    } catch (err) {
                        CodexManager.show('error', err.message);
                        log('FormManager', 'error', `Erreur dans ${form.id}:`, err);
                    }
                } else {
                    log('FormManager', 'warn', `Pas de handler pour: ${form.id}`);
                }
            });
        }
    };

    // --- TemplateManager : Rendu de chaîne ---
    const TemplateManager = {
        _cache: new Map(),
        async load(url) {
            if (this._cache.has(url)) return this._cache.get(url);
            const resp = await fetch(url);
            const html = await resp.text();
            this._cache.set(url, html);
            return html;
        },
        renderString(tpl, data = {}) {
            return tpl.replace(/\$\{(.*?)\}/g, (m, key) => {
                const val = key.split('.').reduce((acc, k) => acc?.[k], data);
                return val !== undefined ? val : m;
            });
        },
        async renderInto(url, data, target, replace = true) {
            const tpl = await this.load(url);
            const html = this.renderString(tpl, data);
            const el = typeof target === 'string' ? document.querySelector(target) : target;
            if (el) {
                if (replace) el.innerHTML = html;
                else el.insertAdjacentHTML('beforeend', html);
            }
            return el;
        }
    };

    // --- IncludeLoader : Chargement des partials avec cache global et gestion de profondeur ---
    const IncludeLoader = {
        _loadedUrls: new Set(),
        _pendingLoads: new Map(),

        async loadIncludes(container = document, depth = 0) {
            if (depth > 5) {
                log('IncludeLoader', 'warn', 'Profondeur max atteinte (boucle infinie ?)');
                return;
            }

            const includes = Array.from(container.querySelectorAll('[data-include]'));
            if (includes.length === 0) return;

            // ✅ CHANGEMENT CLÉ : Boucle for...of au lieu de Promise.all
            for (const el of includes) {
                const url = el.getAttribute('data-include');
                if (!url) continue;

                const cacheKey = url;

                // Si déjà chargé globalement, on supprime juste l'attribut
                if (this._loadedUrls.has(cacheKey)) {
                    log('IncludeLoader', 'info', `⚡ Déjà chargé (cache): ${url}`);
                    el.removeAttribute('data-include');
                    continue;
                }

                // Si chargement en cours, attendre
                if (this._pendingLoads.has(cacheKey)) {
                    log('IncludeLoader', 'info', `⏳ Chargement en cours: ${url}`);
                    await this._pendingLoads.get(cacheKey);
                    el.removeAttribute('data-include');
                    continue;
                }

                // Nouveau chargement
                const loadPromise = this._loadFile(url, el, depth);
                this._pendingLoads.set(cacheKey, loadPromise);

                try {
                    await loadPromise;
                    this._loadedUrls.add(cacheKey);
                } catch (err) {
                    log('IncludeLoader', 'error', `Erreur fatale: ${url}`, err);
                } finally {
                    this._pendingLoads.delete(cacheKey);
                }
            }

            // Récursion pour traiter les nouveaux includes ajoutés
            await this.loadIncludes(container, depth + 1);
        },

        async _loadFile(url, el, depth) {
            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);

                const html = await response.text();

                // ✅ CRITIQUE : Créer un wrapper temporaire
                const wrapper = document.createElement('div');
                wrapper.innerHTML = html;

                // Remplacer l'élément par le contenu du wrapper
                el.replaceWith(...wrapper.childNodes);

                log('IncludeLoader', 'success', `Chargé (depth ${depth}): ${url}`);
            } catch (error) {
                log('IncludeLoader', 'error', `Erreur: ${url}`, error);
                el.innerHTML = '<p class="fr-error-text">Erreur de chargement</p>';
                el.removeAttribute('data-include');
            }
        },

        reset() {
            // ✅ Préserver le cache du layout
            const layoutUrls = [
                './layout/header.html',
                './layout/navigation.html',
                './layout/fil-ariane.html',
                './layout/codex-missives.html'
            ];

            const newSet = new Set();
            layoutUrls.forEach(url => {
                if (this._loadedUrls.has(url)) {
                    newSet.add(url);
                }
            });

            this._loadedUrls = newSet;
            this._pendingLoads.clear();

            log('IncludeLoader', 'info', '🧹 Cache des partials réinitialisé (layout préservé)');
        }
    };


    // --- ViewHandler : Classe de base pour créer des handlers propres ---
    class ViewHandler {
        constructor(key) {
            this.key = key;
            this.elements = {};
            this.listeners = [];
            this.formHandlers = [];
        }

        // À override dans les sous-classes
        async onload() {
            log(this.key, 'warn', 'Aucune méthode onload() définie');
        }

        // Méthode appelée par DomloadManager
        async methodeOnload() {
            try {
                await this.onload();
                log(this.key, 'success', 'Handler initialisé');
            } catch (err) {
                log(this.key, 'error', 'Erreur dans onload:', err);
                throw err;
            }
        }

        // Helper : Ajoute un listener avec tracking automatique
        addListener(element, event, handler, options = {}) {
            if (!element) {
                log(this.key, 'warn', `Element null pour listener ${event}`);
                return;
            }

            const boundHandler = handler.bind(this);
            Events.safeListen(element, event, boundHandler, options);
            this.listeners.push({ element, event, handler: boundHandler });

            return boundHandler;
        }

        // Helper : Enregistre un form handler avec tracking
        registerForm(formId, handler) {
            const boundHandler = handler.bind(this);
            FormManager.registerHandler(formId, boundHandler);
            this.formHandlers.push(formId);

            return boundHandler;
        }

        // Helper : Récupère et stocke un élément
        getElement(id, required = true) {
            const el = document.getElementById(id);
            if (!el && required) {
                log(this.key, 'warn', `Element #${id} non trouvé`);
            }
            this.elements[id] = el;
            return el;
        }

        // Helper : Associer un listener avec un élément
        bindElement(id, event, handler, required = true) {
            const el = this.getElement(id, required);
            if (!el) return;
            this.addListener(el, event, handler);
        }

        // Cleanup automatique de tous les listeners
        cleanup() {
            // Détache tous les listeners
            this.listeners.forEach(({ element, event, handler }) => {
                if (element) {
                    Events.safeRemove(element, event, handler);
                }
            });
            this.listeners = [];

            // Nettoie les form handlers (fait automatiquement par le Router, mais on garde la référence)
            this.formHandlers = [];

            // Reset les éléments
            this.elements = {};

            log(this.key, 'info', 'Cleanup effectué');
        }

        // Enregistre le handler auprès du DomloadManager
        register() {
            DomloadManager.registerHandler(this.key, this);
            return this;
        }
    }

    window.AppManagers = {
        DomloadManager,
        FormManager,
        CodexManager,
        Events,
        TemplateManager,
        PdfAssistant,
        IncludeLoader,
        ViewHandler,  // ✅ Expose la classe
        log
    };

    DomloadManager.init();
    FormManager.init();
})();
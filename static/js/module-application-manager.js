(function () {
    if (window.AppManagers) return;

    window.AppDebug = false; // <- true pour activer les logs

    const log = (manager, type, ...args) => {
        if (!window.AppDebug) return;
        const styles = {
            info: 'color: #00f; font-weight: bold',
            success: 'color: #0a0; font-weight: bold',
            warn: 'color: #f90; font-weight: bold',
            error: 'color: #f00; font-weight: bold',
            action: 'color: #09f; font-weight: bold'
        };
        console.log(`%c[${manager}][${type}]`, styles[type] || '', ...args);
    };

    // -------------------- DomloadManager --------------------
    const DomloadManager = {
        handlers: {},
        _initialized: false,
        _pendingHandlers: new Set(),

        registerHandler: function (key, handler) {
            this.handlers[key] = handler;
            log('DomloadManager', 'info', `Handler enregistré pour: ${key}`);
            if (this._initialized) this._executeHandlerWithRetry(key, 3);
            else this._pendingHandlers.add(key);
        },

        init: function () {
            if (this._initialized) return;
            this._initialized = true;
            log('DomloadManager', 'success', 'Initialisé');

            const safeExecute = () => {
                requestAnimationFrame(() => setTimeout(() => {
                    this._executeHandlersWithRetry(3);
                    this._pendingHandlers.forEach(key => this._executeHandlerWithRetry(key, 3));
                    this._pendingHandlers.clear();
                }, 50));
            };

            if (document.readyState === 'loading')
                document.addEventListener('DOMContentLoaded', safeExecute);
            else
                safeExecute();

            if (typeof htmx !== 'undefined') {
                document.body.addEventListener('htmx:afterSwap', (e) => {
                    const targetKey =
                        e.detail.target.getAttribute('data-load-key') ||
                        e.detail.target.id;
                    if (targetKey)
                        requestAnimationFrame(() =>
                            setTimeout(() => this._executeHandlerWithRetry(targetKey, 3), 50)
                        );
                });
            }
        },

        _executeHandlersWithRetry: function (maxRetries = 3) {
            Object.keys(this.handlers).forEach(key =>
                this._executeHandlerWithRetry(key, maxRetries)
            );
        },

        _executeHandlerWithRetry: async function (key, retries = 3) {
            const handler = this.handlers[key];
            if (!handler) {
                log('DomloadManager', 'warn', `Handler manquant pour ${key}`);
                return;
            }

            for (let attempt = 1; attempt <= retries; attempt++) {
                const element =
                    document.querySelector(`[data-load-key="${key}"]`) ||
                    document.getElementById(key);
                if (element) {
                    await this._executeHandler(key);
                    return;
                }
                if (attempt < retries)
                    await new Promise(r => setTimeout(r, 100 * attempt));
            }
            log('DomloadManager', 'error', `Onload ${key} : échec après ${retries} tentatives`);
        },

        _executeHandler: async function (key) {
            const handler = this.handlers[key];
            if (!handler) return;
            const element =
                document.querySelector(`[data-load-key="${key}"]`) ||
                document.getElementById(key);
            if (!element) return;

            try {
                if (typeof handler.presetVariableOnload === 'function')
                    handler.presetVariableOnload(element, key);

                if (typeof handler.methodeOnload === 'function') {
                    const result = handler.methodeOnload(element, key);
                    if (result instanceof Promise) await result;
                }
            } catch (err) {
                log('DomloadManager', 'error', `Erreur onload pour ${key}:`, err);
            }
        },

        waitForCodex: async function (selector = '#codexGlobal', timeout = 2000) {
            const start = performance.now();
            while (performance.now() - start < timeout) {
                const codex = document.querySelector(selector);
                if (codex && codex.shadowRoot && codex.shadowRoot.querySelector('.missives')) {
                    return codex;
                }
                await new Promise(r => setTimeout(r, 50));
            }
            console.warn(`[DomloadManager] Codex ${selector} non prêt après ${timeout}ms`);
            return document.querySelector(selector);
        }
    };

    // -------------------- FormManager --------------------
    const FormManager = {
        handlers: {},

        registerHandler: function (formId, handler) {
            this.handlers[formId] = handler;
            log('FormManager', 'info', `Handler enregistré pour: ${formId}`);
        },

        addResultMessage: async function (codex, type, message) {
            if (!codex) return;
            const readyCodex = await AppManagers.DomloadManager.waitForCodex(`#${codex.id}`);
            readyCodex.addMessage(type, message);
            log('FormManager', 'success', `Message ajouté: [${type}] ${message}`);
        },

        init: function () {
            document.addEventListener('submit', async (e) => {
                if (!e.target || !e.target.matches('form')) return;
                
                const form = e.target;

                if (!form.checkValidity()) {
                    return;
                }
                
                e.preventDefault();

                const data = new FormData(form);
                const handler = this.handlers[form.id];
                
                if (!handler) {
                    log('FormManager', 'warn', `Aucun handler pour ${form.id}`);
                    return;
                }

                const globalCodex = document.getElementById('codexGlobal');

                try {
                    await handler(data, form, globalCodex, this, window.Validator);
                } catch (err) {
                    log('FormManager', 'error', `Erreur dans handler pour ${form.id}:`, err);
                    await this.addResultMessage(globalCodex, 'error', err.message || 'Erreur inconnue');
                }
            });

            log('FormManager', 'success', 'Initialisé avec codex global');
        }
    };

    // -------------------- TemplateManager --------------------
    const TemplateManager = {
        _cache: new Map(),

        async load(url) {
            if (this._cache.has(url)) return this._cache.get(url);
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Échec du chargement du template : ${url}`);
            const html = await response.text();
            this._cache.set(url, html);
            log('TemplateManager', 'info', `Template chargé : ${url}`);
            return html;
        },

        /**
         * Remplace les variables du type ${variable} dans un template HTML
         * @param {string} template - le contenu du template HTML
         * @param {object} data - les données à injecter
         * @returns {string} - le HTML rendu
         */
        renderString(template, data = {}) {
            return template.replace(/\$\{(.*?)\}/g, (match, key) => {
                const value = key.split('.').reduce((acc, k) => acc?.[k], data);
                return value ?? match;
            });
        },

        /**
         * Charge, compile et insère le template rendu dans une cible du DOM
         * @param {string} url - chemin du template HTML
         * @param {object} data - données à injecter
         * @param {Element|string} target - élément cible ou sélecteur
         * @param {boolean} replace - si true, remplace entièrement le contenu
         */
        async renderInto(url, data, target, replace = true) {
            const tpl = await this.load(url);
            const rendered = this.renderString(tpl, data);
            const element = typeof target === 'string' ? document.querySelector(target) : target;
            if (!element) throw new Error(`Cible introuvable : ${target}`);
            if (replace) element.innerHTML = rendered;
            else element.insertAdjacentHTML('beforeend', rendered);
            log('TemplateManager', 'success', `Template inséré dans ${target}`);
            return element;
        }
    };

    // -------------------- Export global --------------------
    window.AppManagers = { DomloadManager, FormManager, TemplateManager, log };

    window.addEventListener('load', () => {
        DomloadManager.init();
        FormManager.init();
    });
})();

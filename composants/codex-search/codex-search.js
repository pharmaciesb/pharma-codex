// /composants/codex-search/codex-search.js
import { BaseComponent } from '../base-component.js';

export class CodexSearch extends BaseComponent {
    constructor() {
        // Le composant aura besoin de chemins d'accès pour ses propres fichiers 
        // ou vous pouvez centraliser les chemins d'accès au DSFR dans votre BaseComponent.
        super({
            htmlPath: './composants/codex-search/codex-search.html',
            cssPath: './composants/codex-search/codex-search.css',
            globalCssPath: '/pharma-codex/dsfr-v1.14.2/dist/dsfr.min.css'
        });

        this.searchIndex = [];
        this.minQueryLength = 2; // Longueur minimale pour déclencher la recherche
    }

    // Fonction d'initialisation appelée après le chargement du HTML par BaseComponent
    _init() {
        this._input = this.shadowRoot.querySelector('#search-input');
        this._resultsList = this.shadowRoot.querySelector('#search-results');
        this._form = this.shadowRoot.querySelector('#search-form');

        this._loadIndex().then(() => {
            // 1. Écoute de l'entrée utilisateur avec debouncing
            this._input.addEventListener('input', this._debouncedSearch);

            // 2. Empêcher l'envoi du formulaire (recherche traditionnelle)
            this._form.addEventListener('submit', (e) => e.preventDefault());

            // 3. Cacher les résultats au clic en dehors
            document.addEventListener('click', (e) => {
                if (!this.shadowRoot.contains(e.target)) {
                    this._resultsList.setAttribute('hidden', '');
                }
            });
        });
    }

    // --- Utilitaires ---

    // Fonction de Debounce (à mettre dans un fichier utilitaire si possible)
    debounce(func, delay) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    }

    // Définir la méthode de recherche debounced une seule fois
    _debouncedSearch = this.debounce(this._handleSearch, 300);

    // Chargement de l'index JSON (simulé ici, ajustez le chemin)
    async _loadIndex() {
        try {
            // ASSUME: search-index.json est accessible à la racine ou via un chemin défini dans config.json
            const response = await fetch('./composants/codex-search/search-index.json');
            this.searchIndex = await response.json();
            console.log(`[CodexSearch] Index de recherche chargé avec ${this.searchIndex.length} entrées.`);
        } catch (error) {
            console.error("[CodexSearch] Erreur lors du chargement de l'index de recherche:", error);
        }
    }

    // --- Logique de Recherche ---

    _handleSearch() {
        const query = this._input.value.toLowerCase().trim();
        this._resultsList.innerHTML = '';

        if (query.length < this.minQueryLength) {
            this._resultsList.setAttribute('hidden', '');
            return;
        }

        // Recherche floue simplifiée (titre ou mots-clés)
        const results = this.searchIndex.filter(item =>
            item.title.toLowerCase().includes(query) ||
            item.keywords.toLowerCase().includes(query)
        ).slice(0, 8); // Limiter les résultats

        this._renderResults(results);
    }

    _renderResults(results) {
        if (results.length === 0) {
            this._resultsList.innerHTML = '<li><span class="fr-text--sm fr-m-0">Aucun résultat trouvé.</span></li>';
        } else {
            this._resultsList.innerHTML = results.map(item => `
                <li>
                    <a class="fr-link" href="${item.route}" 
                       onclick="this.closest('#search-form').reset();">
                        ${item.title}
                    </a>
                </li>
            `).join('');
        }
        this._resultsList.removeAttribute('hidden');
    }
}

if (!customElements.get('codex-search')) {
    customElements.define('codex-search', CodexSearch);
}
window.CodexSearch = CodexSearch;

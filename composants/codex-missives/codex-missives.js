import { BaseComponent } from '../base-component.js';

const TYPE_TO_ICON = {
  info: 'fr-icon-info-fill',
  success: 'fr-icon-success-fill',
  error: 'fr-icon-error-fill',
  warning: 'fr-icon-warning-fill'
};

export class CodexMissives extends BaseComponent {

  constructor() {
    super({
      htmlPath: './composants/codex-missives/codex-missives.html',
      cssPath: './composants/codex-missives/codex-missives.css',
      globalCssPath: '/pharma-codex/dsfr-v1.14.2/dist/dsfr.min.css'
    });

    this._pendingMessages = [];
    this._history = [];
    this._small = false;
  }

  _init() {
    this._container = this.shadowRoot.querySelector('.missives');
    this._panel = this.shadowRoot.querySelector('.history-panel');
    this._historyList = this.shadowRoot.querySelector('.history-list');
    this._btnJournal = this.shadowRoot.querySelector('[part=journal-btn]');
    this._btnClear = this.shadowRoot.querySelector('[part=clear-btn]');
    this._counter = this.shadowRoot.querySelector('.counter');   // ← compteur ajouté

    this._small = this.getAttribute('small') === 'true';

    this._btnJournal.addEventListener('click', () => this._togglePanel());
    this._btnClear.addEventListener('click', () => this.clearMessages());
    this._flushPending();
  }

  addMessage(type, message) {
    if (!this._container) {
      this._pendingMessages.push([type, message]);
      return;
    }

    // conserver historique 
    this._history.push({ type, message });

    // afficher uniquement le dernier
    this._container.innerHTML = '';

    const iconClass = TYPE_TO_ICON[type] || TYPE_TO_ICON.info; // Sécurise le type

    const alertDiv = document.createElement('div');
    alertDiv.className = `fr-alert fr-alert--${type} ${iconClass}`;
    if (this._small) {
      alertDiv.classList.add('fr-alert--sm');
      alertDiv.innerHTML = `<p>${message}</p>`;
    } else {
      alertDiv.innerHTML = `<h3 class="fr-alert__title">${message}</h3>`;
    }
    this._container.appendChild(alertDiv);

    // historisation (pas visible)
    this._refreshHistoryList();
    this._updateCounter();    // ← Mise à jour compteur
  }

  clearMessages() {
    if (this._container) this._container.innerHTML = '';
    this._history = [];
    this._refreshHistoryList();
    this._updateCounter();    // ← Mise à jour compteur
  }

  _updateCounter() {
    if (this._counter) {
      this._counter.textContent = `(${this._history.length})`;
    }
  }

  _togglePanel() {
    const isHidden = this._panel.hasAttribute('hidden');
    if (isHidden) this._panel.removeAttribute('hidden');
    else this._panel.setAttribute('hidden', '');
  }

  _refreshHistoryList() {
    this._historyList.innerHTML = this._history
      .map(h => `
        <div class="fr-alert fr-alert--${h.type} ${TYPE_TO_ICON[h.type] || TYPE_TO_ICON.info} fr-alert--sm">
          <p>${h.message}</p>
        </div>
      `)
      .join('');
  }

  _flushPending() {
    while (this._pendingMessages.length > 0) {
      const [type, message] = this._pendingMessages.shift();
      this.addMessage(type, message);
    }
  }
}

customElements.define('codex-missives', CodexMissives);
window.CodexMissives = CodexMissives;

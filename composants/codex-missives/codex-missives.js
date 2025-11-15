import { BaseComponent } from '../base-component.js';

export class CodexMissives extends BaseComponent {
  constructor() {
    super({
      htmlPath: './composants/codex-missives/codex-missives.html',
      cssPath: './composants/codex-missives/codex-missives.css'
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
    this._counter = this.shadowRoot.querySelector('.counter');   // ← compteur ajouté

    this._small = this.getAttribute('small') === 'true';

    this._btnJournal.addEventListener('click', () => this._togglePanel());
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
    const alertDiv = document.createElement('div');
    alertDiv.className = `fr-alert fr-alert--${type}`;
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
        <div class="fr-alert fr-alert--${h.type} fr-alert--sm">
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

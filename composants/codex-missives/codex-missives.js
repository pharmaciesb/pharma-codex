// codex-missives.min.js
import { BaseComponent } from '../base-component.js';

export class CodexMissives extends BaseComponent {
  constructor() {
    super({
      htmlPath: './composants/codex-missives/codex-missives.html',
      cssPath: './composants/codex-missives/codex-missives.css'
    });
    this._pendingMessages = [];
    this._small = false;
  }

  _init() {
    console.log('CodexMissives _init ✅');

    this._container = this.shadowRoot.querySelector('.missives');
    if (!this._container) {
      console.error('Container ".missives" non trouvé !');
      return;
    }

    this._small = this.getAttribute('small') === 'true';

    // Flush des messages en attente
    this._flushPending();
  }

  // Ajouter un message
  addMessage(type, message) {
    if (!this._container) {
      this._pendingMessages.push([type, message]);
      console.warn('Container pas prêt, message en attente:', { type, message });
      return;
    }

    const alertDiv = document.createElement('div');
    alertDiv.className = `fr-alert fr-alert--${type}`;
    if (this._small) {
      alertDiv.classList.add('fr-alert--sm');
      alertDiv.innerHTML = `<p>${message}</p>`;
    } else {
      alertDiv.innerHTML = `<h3 class="fr-alert__title">${message}</h3>`;
    }
    this._container.appendChild(alertDiv);
    this._container.scrollTop = this._container.scrollHeight;
  }

  // Vider les messages
  clearMessages() {
    if (this._container) this._container.innerHTML = '';
  }

  // Flush des messages en attente
  _flushPending() {
    while (this._pendingMessages.length > 0) {
      const [type, message] = this._pendingMessages.shift();
      this.addMessage(type, message);
    }
  }
}

customElements.define('codex-missives', CodexMissives);
window.CodexMissives = CodexMissives;
console.log('Composant "codex-missives" minimal chargé');

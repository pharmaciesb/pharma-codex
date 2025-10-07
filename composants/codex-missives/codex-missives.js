// codex-missives.js (mis à jour : _bindForm sans e.preventDefault pour éviter conflit)
import { BaseComponent } from '../base-component.js';

export class CodexMissives extends BaseComponent {
  constructor() {
    super({
      htmlPath: '/composants/codex-missives/codex-missives.html',
      cssPath: '/composants/codex-missives/codex-missives.css'
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

    // Flush pending messages
    this._flushPending();
  }

  _connected() {
    // Process HTMX dans le Shadow DOM
    if (typeof htmx !== 'undefined') {
      htmx.process(this.shadowRoot);
      console.log('HTMX processé dans Shadow DOM de codex-missives');
    } else {
      console.warn('HTMX non chargé – ignore process');
    }

    // Bind form si défini (sans preventDefault, car FormManager gère)
    this._bindForm();
  }

  // addMessage avec pending
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

  // Flush pending
  _flushPending() {
    if (this._pendingMessages.length > 0) {
      console.log(`Flush ${this._pendingMessages.length} messages en attente.`);
      this._pendingMessages.forEach(([type, message]) => this.addMessage(type, message));
      this._pendingMessages = [];
    }
  }

  clearMessages() {
    if (this._container) this._container.innerHTML = '';
  }

  _bindForm() {
    const formId = this.getAttribute('for');
    if (!formId) return;

    const form = document.getElementById(formId);
    if (!form) return;

    form.addEventListener('submit', (e) => {
      // Pas de preventDefault ici (FormManager le fait déjà)
      this.clearMessages();

      const errors = Array.from(form.querySelectorAll('[required]'))
        .filter(f => !f.value.trim())
        .map(f => f.name || f.id || 'Champ inconnu');

      if (errors.length > 0) {
        errors.forEach(field => this.addMessage('error', `${field} est obligatoire`));
      } else {
        this.addMessage('success', 'Le formulaire a été envoyé avec succès.');
      }
    });
  }
}

customElements.define('codex-missives', CodexMissives);
window.CodexMissives = CodexMissives;
console.log('Composant "codex-missives" chargé avec HTMX process');
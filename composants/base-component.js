export class BaseComponent extends HTMLElement {
  constructor({ htmlPath, cssPath } = {}) {
    super();
    this.attachShadow({ mode: 'open' });

    // Charger le HTML
    if (htmlPath) {
      fetch(htmlPath)
        .then(res => res.text())
        .then(html => {
          const template = document.createElement('template');
          template.innerHTML = html;
          this.shadowRoot.appendChild(template.content.cloneNode(true));

          // Injecter le CSS
          if (cssPath) {
            const style = document.createElement('link');
            style.rel = 'stylesheet';
            style.href = cssPath;
            this.shadowRoot.appendChild(style);
          }

          // Appeler _init() si défini
          if (typeof this._init === 'function') this._init();
        })
        .catch(err => console.error(`Erreur chargement HTML pour ${this.tagName}:`, err));
    }
  }
}

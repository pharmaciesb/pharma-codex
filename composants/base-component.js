export class BaseComponent extends HTMLElement {
  // Accepte globalCssPath
  constructor({ htmlPath, cssPath, globalCssPath } = {}) { 
    super();
    this.attachShadow({ mode: 'open' });

    // Stockage des chemins pour une utilisation asynchrone
    this._htmlPath = htmlPath;
    this._cssPath = cssPath;
    this._globalCssPath = globalCssPath;

    // Lancement du processus de chargement asynchrone
    this._loadContent().catch(err => {
      console.error(`Erreur critique dans le chargement du composant ${this.tagName}:`, err);
    });
  }

  // Nouvelle méthode asynchrone pour gérer la séquence de chargement
  async _loadContent() {
    
    // 1. Injecter le CSS global (DSFR) en premier
    if (this._globalCssPath) {
      const globalStyle = document.createElement('link');
      globalStyle.rel = 'stylesheet';
      globalStyle.href = this._globalCssPath;
      this.shadowRoot.appendChild(globalStyle);
    }
    
    // 2. Charger le HTML et le CSS spécifique
    if (this._htmlPath) {
      try {
        const res = await fetch(this._htmlPath);
        const html = await res.text();
        
        const template = document.createElement('template');
        template.innerHTML = html;
        this.shadowRoot.appendChild(template.content.cloneNode(true));

        // 3. Injecter le CSS spécifique du composant
        if (this._cssPath) {
          const style = document.createElement('link');
          style.rel = 'stylesheet';
          style.href = this._cssPath;
          this.shadowRoot.appendChild(style);
        }

        // 4. Appeler _init() si défini
        if (typeof this._init === 'function') {
          this._init();
        }

      } catch (err) {
        console.error(`Erreur chargement HTML/CSS pour ${this.tagName}:`, err);
      }
    }
  }
}
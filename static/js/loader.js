// Ex. grenier/js/loader.js
export async function loadComponentsFromConfig(configPath = '/composants/config.json') {
  try {
    const config = await fetch(configPath).then(r => r.json());
    const { env, components } = config;

    for (const comp of components) {
      const { name, global } = comp;
      const jsPath = `${env.basePath}/${name}/${name}.js`;
      const htmlPath = `${env.basePath}/${name}/${name}.html`;
      const cssPath = `${env.basePath}/${name}/${name}.css`;

      // Import dynamique du module JS
      const module = await import(jsPath).catch(err => {
        console.error(`Erreur import module ${name}:`, err);
        return {};
      });

      const componentClass = module[global] || module.default;
      if (!componentClass) {
        console.warn(`Classe globale pour ${name} non trouvée`);
        continue;
      }

      // Définir le Custom Element si pas déjà défini
      if (!customElements.get(name)) {
        class AutoComponent extends componentClass {
          constructor() {
            super({ htmlPath, cssPath });
            if (env.debug) console.log(`Composant "${name}" instancié`);
          }
        }
        customElements.define(name, AutoComponent);

        if (global) window[global] = componentClass;
      }

      if (env.debug) console.log(`Composant "${name}" chargé et exposé global "${global}"`);
    }
  } catch (err) {
    console.error('Erreur lors du chargement des composants depuis config.json :', err);
  }
}

window.loadComponentsFromConfig = loadComponentsFromConfig;

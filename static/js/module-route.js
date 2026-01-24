(function() {
  const Router = {
    defaultRoute: "views/officine/officine.html",
    target: "#router",
    currentModule: null, // Track le module actif pour cleanup
    
    getRouteFromHash() {
      const hash = window.location.hash.replace(/^#/, "");
      
      // ✅ Si pas de hash, initialise-le immédiatement avec la route par défaut
      if (!hash) {
        window.location.hash = this.defaultRoute;
        return this.defaultRoute;
      }
      
      return hash;
    },
    
    updateActiveNav(route) {
      const links = document.querySelectorAll("a[data-route]");
      if (!links.length) return;
      
      links.forEach(link => link.removeAttribute("aria-current"));
      
      const activeLink = document.querySelector(`a[data-route][href="#${route}"]`);
      if (activeLink) activeLink.setAttribute("aria-current", "true");
    },
    
    async loadRoute() {
      const route = this.getRouteFromHash();
      const targetEl = document.querySelector(this.target);
      
      if (!targetEl) {
        console.error("Target element not found:", this.target);
        return;
      }
      
      try {
        // 1. Cleanup du module précédent
        await this.cleanup();
        
        // 2. Fetch du nouveau contenu
        const response = await fetch(route);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const html = await response.text();
        
        // 3. Swap du contenu
        targetEl.innerHTML = html;
        
        // 4. NOUVEAU : Charge les partials [data-include] AVANT l'init du module
        if (window.AppManagers?.IncludeLoader) {
          await AppManagers.IncludeLoader.loadIncludes(targetEl);
        }
        
        // 5. Extraction du module ID depuis le HTML chargé
        const moduleKey = this.extractModuleKey(targetEl);
        this.currentModule = moduleKey;
        
        // 6. Trigger DomloadManager pour ce module
        if (moduleKey && window.AppManagers?.DomloadManager) {
          // Petit délai pour que le DOM soit stable
          requestAnimationFrame(() => {
            setTimeout(() => {
              AppManagers.DomloadManager._executeWithRetry(moduleKey);
            }, 50);
          });
        }
        
        // 7. ✅ NOUVEAU : Mise à jour du breadcrumb
        if (window.BreadcrumbManager) {
          BreadcrumbManager.updateBreadcrumb(route);
        }
        
        // 8. Mise à jour nav
        this.updateActiveNav(route);
        
        console.log("Loaded route:", route);
        
      } catch (error) {
        console.error("Error loading route:", error);
        targetEl.innerHTML = "<p>Erreur : vue introuvable.</p>";
      }
    },
    
    // Extraction du data-load-key ou id du module
    extractModuleKey(container) {
      const el = container.querySelector('[data-load-key]') || container.querySelector('[id]');
      return el?.dataset.loadKey || el?.id || null;
    },
    
    // Nettoyage avant changement de route
    async cleanup() {
      if (!this.currentModule) return;
      
      // Si le module a une méthode cleanup, l'appeler
      const handler = window.AppManagers?.DomloadManager?.handlers?.[this.currentModule];
      if (handler?.cleanup) {
        try {
          await handler.cleanup();
          console.log(`Cleanup effectué pour: ${this.currentModule}`);
        } catch (err) {
          console.error(`Erreur cleanup ${this.currentModule}:`, err);
        }
      }
      
      // ✅ NOUVEAU : Cleanup automatique des form handlers
      if (window.AppManagers?.FormManager) {
        AppManagers.FormManager.clearAllHandlers();
      }
      
      this.currentModule = null;
    },
    
    // Navigation programmatique
    navigate(route) {
      window.location.hash = route;
    },
    
    async init() {
      // Charge les includes du layout AVANT tout (gère les nested includes)
      if (window.AppManagers?.IncludeLoader) {
        await AppManagers.IncludeLoader.loadIncludes(document.body);
        console.log('Layout includes chargés');
      }
      
      // Hashchange listener
      window.addEventListener("hashchange", () => this.loadRoute());
      
      // Délégation des clics sur liens de navigation
      document.addEventListener("click", (e) => {
        const link = e.target.closest("a[data-route]");
        if (link) {
          e.preventDefault();
          const route = link.getAttribute("href").replace(/^#/, "");
          this.navigate(route);
        }
      });
      
      // Listener pour quand la nav est chargée dynamiquement
      const navObserver = new MutationObserver(() => {
        if (document.querySelector("nav a[data-route]")) {
          this.updateActiveNav(this.getRouteFromHash());
        }
      });
      
      navObserver.observe(document.body, {
        childList: true,
        subtree: true
      });
      
      // Charge la route initiale
      this.loadRoute();
    }
  };
  
  // Expose Router globalement
  window.Router = Router;
  
  // Auto-init au DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener("DOMContentLoaded", () => Router.init());
  } else {
    Router.init();
  }
})();
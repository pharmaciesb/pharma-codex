// module-breadcrumb.js
(function () {
  const BreadcrumbManager = {
    updateBreadcrumb(route) {
      const breadcrumb = document.querySelector("#breadcrumb");
      if (!breadcrumb) {
        console.warn('[Breadcrumb] Element #breadcrumb non trouvé');
        return;
      }
      
      const ol = breadcrumb.querySelector(".fr-breadcrumb__list");
      if (!ol) return;
      
      // Supprime les anciens éléments (sauf le premier "Accueil")
      ol.querySelectorAll("li:not(:first-child)").forEach(li => li.remove());
      
      // Nettoie le chemin
      let path = route.replace(/^views\//, "").replace(/\.html$/, "");
      if (!path) return;
      
      const segments = path.split("/");
      let cumulativePath = "views";
      
      segments.forEach((seg, idx) => {
        cumulativePath += "/" + seg;
        
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.classList.add("fr-breadcrumb__link");
        
        // Label lisible (première lettre majuscule)
        const label = seg.charAt(0).toUpperCase() + seg.slice(1);
        a.textContent = label;
        
        if (idx < segments.length - 1) {
          // Lien intermédiaire vers le hub du module
          const intermediatePath = cumulativePath + "/" + seg + ".html";
          a.href = "#" + intermediatePath;
          a.setAttribute("data-route", "");
        } else {
          // Dernier segment = page actuelle
          a.removeAttribute("href");
          a.setAttribute("aria-current", "page");
        }
        
        li.appendChild(a);
        ol.appendChild(li);
      });
      
      console.log('[Breadcrumb] Mis à jour:', route);
    },
    
    init() {
      // ✅ Attend que le breadcrumb soit chargé, puis init une seule fois
      const observer = new MutationObserver(() => {
        const breadcrumb = document.querySelector("#breadcrumb");
        if (breadcrumb) {
          const route = window.location.hash.replace(/^#/, "") || window.Router?.defaultRoute || "";
          if (route) {
            this.updateBreadcrumb(route);
          }
          observer.disconnect();
        }
      });
      
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
      
      console.log('[Breadcrumb] Manager initialisé');
    }
  };
  
  window.BreadcrumbManager = BreadcrumbManager;
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => BreadcrumbManager.init());
  } else {
    BreadcrumbManager.init();
  }
})();
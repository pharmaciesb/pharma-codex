(function () {
  function updateBreadcrumb(route) {
    const breadcrumb = document.querySelector("#breadcrumb");
    if (!breadcrumb) return;

    const ol = breadcrumb.querySelector(".fr-breadcrumb__list");
    if (!ol) return;

    // Supprime les anciens éléments (sauf le premier)
    ol.querySelectorAll("li:not(:first-child)").forEach(li => li.remove());

    // Nettoie le chemin
    let path = route.replace(/^views\//, "").replace(/\.html$/, "");
    if (!path) return;

    const segments = path.split("/");

    // Construction progressive du chemin complet
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
        // 🔧 correction : on ne met .html que sur les vues finales de chaque module
        const intermediatePath = cumulativePath + "/" + seg + ".html";
        a.href = "#" + intermediatePath;
      } else {
        // Dernier segment = page actuelle
        a.removeAttribute("href");
        a.setAttribute("aria-current", "page");
      }

      li.appendChild(a);
      ol.appendChild(li);
    });
  }

  // Met à jour à chaque changement de route
  window.addEventListener("hashchange", () => {
    const route = window.location.hash.replace(/^#/, "");
    updateBreadcrumb(route);
  });

  // Réagit quand HTMX charge le template du fil d’Ariane
  document.body.addEventListener("htmx:afterSwap", evt => {
    if (evt.target.id === "breadcrumb" || evt.target.querySelector?.("#breadcrumb")) {
      const route = window.location.hash.replace(/^#/, "");
      updateBreadcrumb(route);
    }
  });

  // Premier affichage
  window.addEventListener("DOMContentLoaded", () => {
    const route = window.location.hash.replace(/^#/, "");
    updateBreadcrumb(route);
  });
})();

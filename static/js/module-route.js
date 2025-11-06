document.addEventListener("DOMContentLoaded", function () {
  const defaultRoute = "views/officine/officine.html";
  const target = "#router";

  function getRouteFromHash() {
    const hash = window.location.hash.replace(/^#/, "");
    return hash || defaultRoute;
  }

  function updateActiveNav(route) {
    const links = document.querySelectorAll("a[data-route]");
    if (!links.length) return; // nav pas encore chargée

    // Supprime tous les aria-current
    links.forEach(link => link.removeAttribute("aria-current"));

    // Met à jour le lien actif
    const activeLink = document.querySelector(`a[data-route][href="#${route}"]`);
    if (activeLink) activeLink.setAttribute("aria-current", "true");
  }

  function loadRoute() {
    const route = getRouteFromHash();
    htmx.ajax("GET", route, { target: target }).catch(() => document.querySelector(target).innerHTML = "<p>Erreur : vue introuvable.</p>");;
    updateActiveNav(route);
    console.log("Loaded route:", route);
  }

  // Quand le hash change
  window.addEventListener("hashchange", loadRoute);

  // Gestion des clics nav
  document.addEventListener("click", function (e) {
    const link = e.target.closest("a[data-route]");
    if (link) {
      e.preventDefault();
      const route = link.getAttribute("href").replace(/^#/, "");
      window.location.hash = route; // déclenche loadRoute()
    }
  });

  // Dès que la nav est chargée via HTMX → mettre à jour aria-current
  document.body.addEventListener("htmx:afterSwap", function (evt) {
    if (evt.target.matches("nav") || evt.target.closest("nav")) {
      loadRoute();
    }
  });

  // Tentative initiale au cas où nav est déjà dans le DOM
  loadRoute();
});

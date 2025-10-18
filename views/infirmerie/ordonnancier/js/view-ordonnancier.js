AppManagers.DomloadManager.registerHandler('vueOrdonnancier', {
  presetVariableOnload: function (element, key) {
    window.currentView = key;
    element.setAttribute('data-loaded', 'true');
    AppManagers.log('vueOrdonnancier', 'info', 'Preset onload');
  },

  methodeOnload: async function () {
    AppManagers.log('vueOrdonnancier', 'success', 'Méthode onload OK');

    // --- Référence sécurisée des boutons ---
    const btns = {
      base: document.getElementById('pdf-basique'),
      baseDouble: document.getElementById('pdf-basique-double'),
      pansement: document.getElementById('pdf-pansement'),
      pansementDouble: document.getElementById('pdf-pansement-double'),
    };

    // Journalise les boutons manquants sans bloquer l’exécution
    for (const [key, btn] of Object.entries(btns)) {
      if (!btn) AppManagers.log('vueOrdonnancier', 'warn', `Bouton manquant : ${key}`);
    }

    // --- Clone les boutons existants pour éviter les anciens listeners HTMX ---
    for (const [key, btn] of Object.entries(btns)) {
      if (!btn) continue;
      const clone = btn.cloneNode(true);
      btn.replaceWith(clone);
      btns[key] = clone;
    }

    // --- Fonction générique pour exporter un élément HTML en PDF ---
    const exportToPDF = (element, filename, options = {}, cleanup) => {
      if (!element) {
        alert("Aucun contenu à exporter !");
        return;
      }

      const sandbox = document.createElement('div');
      sandbox.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 210mm;
        background: white;
        opacity: 0;
        z-index: -1;
      `;
      document.body.appendChild(sandbox);
      sandbox.appendChild(element);

      const opt = {
        margin: 0,
        filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          scrollY: 0,
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'], before: '.breaker' },
        ...options,
      };

      setTimeout(() => {
        html2pdf()
          .set(opt)
          .from(element)
          .save()
          .then(() => {
            sandbox.remove();
            if (typeof cleanup === "function") cleanup(); // 🧼 nettoyage du style injecté
          })
          .catch((err) => {
            console.error('Erreur export PDF :', err);
            sandbox.remove();
            if (typeof cleanup === "function") cleanup();
          });
      }, 500);
    };

    // --- Fonction pour charger un modèle HTML et lancer le PDF ---
    const telechargerModele = async (partial) => {
      try {
        const resp = await fetch(`./views/infirmerie/ordonnancier/partials/${partial}.html`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

        const html = await resp.text();
        const temp = document.createElement('div');
        temp.innerHTML = html.trim();

        // 🧩 On récupère et injecte temporairement le style du partial
        const styleTag = temp.querySelector('style');
        let injectedStyle = null;
        if (styleTag) {
          injectedStyle = styleTag.cloneNode(true);
          document.head.appendChild(injectedStyle);
        }

        const ordonnance = temp.querySelector('#ordonnance');
        if (!ordonnance) throw new Error(`Aucun élément #ordonnance trouvé dans ${partial}.html`);

        // 🧼 On passe une fonction de nettoyage en callback
        exportToPDF(ordonnance, `ordonnance-ide-${partial}.pdf`, {}, () => {
          if (injectedStyle) injectedStyle.remove();
        });

        AppManagers.log('vueOrdonnancier', 'success', `PDF généré : ${partial}`);
      } catch (err) {
        console.error(`Erreur lors du chargement de ${partial}.html :`, err);
        alert(`Impossible de charger le modèle "${partial}" !`);
      }
    };

    // --- Liaison conditionnelle des événements ---
    if (btns.base) btns.base.addEventListener('click', () => telechargerModele('basique'));
    if (btns.baseDouble) btns.baseDouble.addEventListener('click', () => telechargerModele('basique-double'));
    if (btns.pansement) btns.pansement.addEventListener('click', () => telechargerModele('pansement'));
    if (btns.pansementDouble) btns.pansementDouble.addEventListener('click', () => telechargerModele('pansement-double'));
  }
});

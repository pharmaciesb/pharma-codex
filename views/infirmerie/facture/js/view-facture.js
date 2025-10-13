AppManagers.DomloadManager.registerHandler('vueFacture', {
  presetVariableOnload: function (element, key) {
    window.currentView = key;
    element.setAttribute('data-loaded', 'true');
    AppManagers.log('vueFacture', 'info', 'Preset onload');
  },

  methodeOnload: async function () {
    AppManagers.log('vueFacture', 'success', 'Méthode onload OK');

    // --- Formatage de date au format dd/mm/yyyy ---
    function formatDate(isoDate) {
      const [year, month, day] = isoDate.split('-');
      return `${day}/${month}/${year}`;
    }

    // --- Préremplir la date du jour ---
    const dateInput = document.getElementById('date');
    if (dateInput) {
      const today = new Date().toISOString().split('T')[0];
      dateInput.value = today;
    }

    const form = document.getElementById('formFacture');
    const outputDiv = document.getElementById('facture-output');

    // --- Patch HTMX : on clone les boutons pour éviter les anciens listeners ---
    const oldBtnR = document.getElementById('pdf-renseignee');
    const oldBtnV = document.getElementById('pdf-vierge');
    const oldBtnVD = document.getElementById('pdf-vierge-double'); // 🔥 Nouveau bouton
    if (!oldBtnR || !oldBtnV || !oldBtnVD) return;

    const btnRenseignee = oldBtnR.cloneNode(true);
    const btnVierge = oldBtnV.cloneNode(true);
    const btnViergeDouble = oldBtnVD.cloneNode(true);

    oldBtnR.replaceWith(btnRenseignee);
    oldBtnV.replaceWith(btnVierge);
    oldBtnVD.replaceWith(btnViergeDouble);
    // ------------------------------------------------------------------

    // --- Soumission du formulaire ---
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const data = {
        nom: document.getElementById('nom').value.trim(),
        date: document.getElementById('date').value,
        total: document.getElementById('total').value,
      };

      if (!data.date || !data.total) {
        alert("Veuillez remplir tous les champs obligatoires avant de prévisualiser la facture !");
        return;
      }

      try {
        await AppManagers.TemplateManager.renderInto(
          './views/infirmerie/facture/partials/satisfait.html',
          { facture: data },
          outputDiv
        );

        btnRenseignee.disabled = false;
        AppManagers.log('vueFacture', 'success', 'Prévisualisation générée');
      } catch (err) {
        AppManagers.log('vueFacture', 'error', 'Erreur de prévisualisation', err);
        alert("Erreur lors du chargement de la prévisualisation !");
      }
    });

    // --- Fonction générique pour exporter un élément en PDF ---
    const exportToPDF = (element, filename, options = {}) => {
      const sandbox = document.createElement('div');
      sandbox.style.cssText = `
        position: fixed;
        top: 0; left: 0;
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
        ...options
      };

      // délai pour laisser le temps aux images/fonts de se charger
      setTimeout(() => {
        html2pdf()
          .set(opt)
          .from(element) // 🔥 On capture le contenu réel, pas le parent invisible
          .save()
          .then(() => sandbox.remove())
          .catch(() => sandbox.remove());
      }, 800);
    };

    // --- Génération facture renseignée ---
    const generateFactureRenseignee = () => {
      const facture = document.getElementById('facture-pdf');
      if (!facture) {
        alert("Veuillez d'abord générer la facture via le formulaire !");
        return;
      }

      const clone = facture.cloneNode(true);
      const dateEl = clone.querySelector('#facture-pdf-date input');
      if (dateEl) {
        const dateFrancaise = formatDate(dateEl.value);
        clone.querySelector('#facture-pdf-date').innerHTML = 'À MARSEILLE, le : ' + dateFrancaise;
      }

      exportToPDF(clone, 'facture-renseignee.pdf');
    };

    // --- Génération facture vierge simple ---
    const generateFactureVierge = async () => {
      try {
        const resp = await fetch('./views/infirmerie/facture/partials/vierge.html');
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const html = await resp.text();

        const temp = document.createElement('div');
        temp.innerHTML = html.trim();
        const facture = temp.querySelector('#facture-vierge');

        exportToPDF(facture, 'facture-vierge.pdf');
      } catch (err) {
        console.error('Erreur lors du chargement de vierge.html :', err);
        alert("Impossible de charger le modèle vierge !");
      }
    };

    // --- Génération facture vierge double page ---
    const generateFactureViergeDouble = async () => {
      try {
        const resp = await fetch('./views/infirmerie/facture/partials/vierge-double.html');
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const html = await resp.text();

        const temp = document.createElement('div');
        temp.innerHTML = html.trim();
        const facture = temp.querySelector('#facture-vierge-double');

        exportToPDF(facture, 'facture-vierge-double.pdf');
      } catch (err) {
        console.error('Erreur lors du chargement de vierge-double.html :', err);
        alert("Impossible de charger le modèle vierge double !");
      }
    };

    // --- Liaison des boutons ---
    btnRenseignee.addEventListener('click', generateFactureRenseignee);
    btnVierge.addEventListener('click', generateFactureVierge);
    btnViergeDouble.addEventListener('click', generateFactureViergeDouble);
  }
});

AppManagers.DomloadManager.registerHandler('vueFacture', {
  presetVariableOnload: function (element, key) {
    window.currentView = key;
    element.setAttribute('data-loaded', 'true');
    AppManagers.log('vueFacture', 'info', 'Preset onload');
  },

  methodeOnload: async function () {
    AppManagers.log('vueFacture', 'success', 'Méthode onload OK');

    // Fonction pour formater la date au format dd/mm/yyyy
    function formatDate(isoDate) {
      const [year, month, day] = isoDate.split('-');
      return `${day}/${month}/${year}`;
    }

    // --- Préremplir la date ---
    const dateInput = document.getElementById('date');
    if (dateInput) {
      const today = new Date().toISOString().split('T')[0];
      dateInput.value = today;
    }

    const form = document.getElementById('formFacture');
    const outputDiv = document.getElementById('facture-output');

    // --- Patch HTMX : suppression des anciens listeners via clonage ---
    const oldBtnR = document.getElementById('pdf-renseignee');
    const oldBtnV = document.getElementById('pdf-vierge');
    if (!oldBtnR || !oldBtnV) return;

    const btnRenseignee = oldBtnR.cloneNode(true);
    const btnVierge = oldBtnV.cloneNode(true);
    oldBtnR.replaceWith(btnRenseignee);
    oldBtnV.replaceWith(btnVierge);
    // ------------------------------------------------------------------

    // --- Soumission du formulaire : affichage de la prévisualisation ---
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

    // --- Génération PDF (renseignée / vierge) ---
    const generatePDF = async (isVierge = false) => {
      let facture = document.getElementById('facture-pdf');

  // Si vierge et aucune facture n'est encore générée → créer une version vierge à la volée
  if (isVierge && !facture) {
    // On charge dynamiquement le template "satisfait.html"
    const response = await fetch('./views/infirmerie/facture/partials/satisfait.html');
    const html = await response.text();

    // On insère temporairement dans un div
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html.replace(/\$\{facture\..*?\}/g, ''); // supprime les interpolations ${facture.xxx}
    facture = tempDiv.querySelector('#facture-pdf');
  }
      if (!facture) {
        alert("Veuillez d'abord générer la facture via le formulaire !");
        return;
      }

      // On clone la facture pour préserver le rendu original
      const clone = facture.cloneNode(true);

      // Si vierge → remplace les champs texte par des lignes
      if (isVierge) {
        clone.querySelector('#facture-pdf-nom').innerHTML = 'Nom : _ _ _ _ _ _ _ _ _ _';
        clone.querySelector('#facture-pdf-total').innerHTML = 'Total TTC (€) : _ _ _ _ _ _';
        clone.querySelector('#facture-pdf-date').innerHTML = 'À MARSEILLE, le : _ _ / _ _ / _ _ _ _';
      } else {
        let dateFrancaise = formatDate(clone.querySelector('#facture-pdf-date input').value);
        clone.querySelector('#facture-pdf-date').innerHTML = 'À MARSEILLE, le : ' + dateFrancaise;
      }

      // Sandbox invisible mais capturable
      const sandbox = document.createElement('div');
      sandbox.style.cssText = `
        position: fixed;
        top: 0; left: 0;
        width: 210mm;
        height: 297mm;
        background: white;
        opacity: 0;
        z-index: -1;
      `;
      sandbox.appendChild(clone);
      document.body.appendChild(sandbox);

      const opt = {
        margin: 0,
        filename: isVierge ? 'facture-vierge.pdf' : 'facture-renseignee.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          scrollY: 0
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      setTimeout(() => {
        html2pdf()
          .set(opt)
          .from(clone)
          .save()
          .then(() => document.body.removeChild(sandbox))
          .catch(() => document.body.removeChild(sandbox));
      }, 300);
    };

    btnRenseignee.addEventListener('click', () => generatePDF(false));
    btnVierge.addEventListener('click', () => generatePDF(true));
  }
});

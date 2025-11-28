// -- Vue Assistants
import { definirAujourdhui , formatFR } from '/pharma-codex/static/js/assistants/assistant-date.js';
// -- Vue DomloadManager
AppManagers.DomloadManager.registerHandler('vueFacture', {
  presetVariableOnload(element, key) {
    try {
      window.currentView = key;
      element.setAttribute('data-loaded', 'true');
      AppManagers.log('vueFacture', 'info', 'Preset onload OK');
    } catch (err) {
      console.error('[vueFacture] Erreur presetVariableOnload :', err);
    }
  },

  methodeOnload: async function () {
    AppManagers.log('vueFacture', 'success', 'Méthode onload déclenchée');
    definirAujourdhui();

    // Récupération boutons
    const btnRenseignee = document.getElementById('pdf-renseignee');
    const btnVierge = document.getElementById('pdf-vierge');
    const btnViergeDouble = document.getElementById('pdf-vierge-double');

    // -- Vérification DOM --
    if (!btnVierge || !btnViergeDouble) {
      AppManagers.log('vueFacture', 'warn', 'Boutons vierge non trouvés, vérifiez la vue HTML.');
      return;
    }

    // -- Fonction générique d’export PDF --
    const exportToPDF = (element, filename, options = {}) => {
      if (!element) return console.error('[vueFacture] Aucun élément à exporter.');

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
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#fff', scrollY: 0 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'], before: '.breaker' },
        ...options
      };

      // léger délai pour le rendu
      setTimeout(() => {
        html2pdf()
          .set(opt)
          .from(element)
          .save()
          .finally(() => sandbox.remove());
      }, 300);
    };

    // -- Génération de facture vierge (A4 simple) --
    const generateFactureVierge = async () => {
      try {
        const resp = await fetch('./views/infirmerie/facture/partials/vierge.html', { cache: 'no-store' });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const html = await resp.text();
        const temp = document.createElement('div');
        temp.innerHTML = html.trim();
        const facture = temp.querySelector('#facture-vierge');
        if (!facture) throw new Error('Template vierge introuvable.');
        exportToPDF(facture, 'facture-vierge.pdf');
      } catch (err) {
        console.error('[vueFacture] Erreur génération vierge :', err);
        alert('Impossible de charger le modèle vierge.');
      }
    };

    // -- Génération de facture vierge double (A5 x2) --
    const generateFactureViergeDouble = async () => {
      try {
        const resp = await fetch('./views/infirmerie/facture/partials/vierge-double.html', { cache: 'no-store' });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const html = await resp.text();
        const temp = document.createElement('div');
        temp.innerHTML = html.trim();
        const facture = temp.querySelector('#facture-vierge-double');
        if (!facture) throw new Error('Template vierge double introuvable.');
        exportToPDF(facture, 'facture-vierge-double.pdf');
      } catch (err) {
        console.error('[vueFacture] Erreur génération vierge double :', err);
        alert('Impossible de charger le modèle vierge double.');
      }
    };

    // -- Configuration des boutons (sans doublons) --
    btnVierge.disabled = false;
    btnVierge.onclick = generateFactureVierge;

    btnViergeDouble.disabled = false;
    btnViergeDouble.onclick = generateFactureViergeDouble;

    if (btnRenseignee) {
      btnRenseignee.disabled = true;
      btnRenseignee.onclick = null; // sera défini par le FormManager après rendu
    }

    AppManagers.log('vueFacture', 'info', 'Boutons vierge actifs, bouton renseignée en attente.');
  }
});


// -- FormManager : gestion du formulaire de facture
AppManagers.FormManager.registerHandler('formFacture', async function (data, form, codex, manager, validator) {
  try {
    const outputDiv = document.getElementById('facture-output');
    const btnRenseignee = document.getElementById('pdf-renseignee');

    if (!outputDiv) {
      manager.addResultMessage(codex, 'error', 'Zone de prévisualisation introuvable.');
      return;
    }

    // Validation de base
    const required = ["date", "total"];
    for (const f of required) {
      const val = data.get(f)?.trim();
      if (!val) {
        manager.addResultMessage(codex, 'error', `Le champ "${f}" est obligatoire.`);
        return;
      }
    }

    const factureData = {
      nom: data.get("nom").trim(),
      date: data.get("date").trim(),
      total: data.get("total").trim(),
    };

    manager.addResultMessage(codex, 'info', 'Génération de la prévisualisation...');
    await AppManagers.TemplateManager.renderInto(
      './views/infirmerie/facture/partials/satisfait.html',
      { facture: factureData },
      outputDiv
    );

    // Active le bouton "renseignée" et attache son handler
    if (btnRenseignee) {
      btnRenseignee.disabled = false;

      btnRenseignee.onclick = async () => {
        const facture = document.getElementById('facture-pdf');
        if (!facture) return alert("Veuillez d'abord générer la facture !");
        const clone = facture.cloneNode(true);
        const dateEl = clone.querySelector('#facture-pdf-date input');
        if (dateEl) {
          const dateFr = formatFR(dateEl.value);
          clone.querySelector('#facture-pdf-date').innerHTML = 'À MARSEILLE, le : ' + dateFr;
        }

        const exportToPDF = (element, filename, options = {}) => {
          const sandbox = document.createElement('div');
          sandbox.style.cssText = `
            position: fixed; top: 0; left: 0; width: 210mm;
            background: white; opacity: 0; z-index: -1;
          `;
          document.body.appendChild(sandbox);
          sandbox.appendChild(element);

          const opt = {
            margin: 0,
            filename,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, backgroundColor: '#fff', scrollY: 0 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak: { mode: ['css', 'legacy'], before: '.breaker' },
            ...options
          };

          setTimeout(() => {
            html2pdf().set(opt).from(element).save().finally(() => sandbox.remove());
          }, 300);
        };

        exportToPDF(clone, 'facture-renseignee.pdf');
      };
    }

    manager.addResultMessage(codex, 'success', 'Prévisualisation générée avec succès.');
    AppManagers.log('formFacture', 'success', 'Facture renseignée OK');
  } catch (err) {
    AppManagers.log('formFacture', 'error', 'Erreur génération facture', err);
    manager.addResultMessage(codex, 'error', 'Erreur lors de la génération : ' + (err.message || err));
  }
});

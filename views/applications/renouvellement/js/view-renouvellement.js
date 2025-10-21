// -- Vue DomloadManager
AppManagers.DomloadManager.registerHandler('vueRenouvellement', {
  joursFeries: [],
  anneeEnCours: new Date().getFullYear(),

  chargerJoursFeries: async function () {
    try {
      const response = await fetch(`https://calendrier.api.gouv.fr/jours-feries/metropole/${this.anneeEnCours}.json`);
      if (!response.ok) throw new Error('API indisponible');
      const data = await response.json();

      this.joursFeries = Object.keys(data).map(dateStr => {
        const [year, monthStr, dayStr] = dateStr.split('-');
        return {
          date: new Date(parseInt(year), parseInt(monthStr) - 1, parseInt(dayStr)),
          libelle: data[dateStr]
        };
      }).sort((a, b) => a.date - b.date);

      const tbody = document.getElementById("joursFeries");
      tbody.innerHTML = '';
      this.joursFeries.forEach(jour => {
        const jourSemaine = jour.date.toLocaleDateString("fr-FR", { weekday: 'long' });
        const row = `<tr>
          <td>${jour.date.toLocaleDateString("fr-FR")}</td>
          <td>${jour.libelle}</td>
          <td>${jourSemaine.charAt(0).toUpperCase() + jourSemaine.slice(1)}</td>
        </tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
      });

    } catch (err) {
      AppManagers.log('vueRenouvellement','error','Erreur chargement jours fériés:', err);
      document.getElementById("joursFeries").innerHTML =
        '<tr><td colspan="3" class="fr-text--danger">Erreur chargement fériés (mode offline).</td></tr>';
    }
  },

  EstJourFerie: function (date) {
    return this.joursFeries.some(j => j.date.toDateString() === date.toDateString());
  },

  AjusterSiJourFerieOuDimanche: function (date) {
    while (this.EstJourFerie(date) || date.getDay() === 0) {
      date.setDate(date.getDate() + 1);
    }
    return date;
  },

  CalculerRenouvellements: function (dateInitiale, quantite, intervalle) {
    let dates = [], dateCourante = new Date(dateInitiale);
    for (let i = 0; i < quantite; i++) {
      dateCourante.setDate(dateCourante.getDate() + intervalle);
      dateCourante = this.AjusterSiJourFerieOuDimanche(dateCourante);
      dates.push(new Date(dateCourante));
    }
    return dates;
  },

  setDateDuJour: async function () {
    const today = new Date();
    const formatted = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    const input = document.getElementById('dateInitiale');
    if(input) input.value = formatted;

    const lastDate = new Date(today);
    lastDate.setDate(lastDate.getDate() - 22);
    document.getElementById('dateDerniereFacturation').textContent =
      `${String(lastDate.getDate()).padStart(2,'0')}/${String(lastDate.getMonth() + 1).padStart(2,'0')}/${lastDate.getFullYear()}`;
  },

  presetVariableOnload: function(element,key){
    window.currentView = key;
    element.setAttribute('data-loaded','true');
    AppManagers.log('vueRenouvellement','info','Preset onload');
  },

  methodeOnload: async function(){
    await this.chargerJoursFeries();
    await this.setDateDuJour();
    AppManagers.log('vueRenouvellement','success','Méthode onload OK');
  }
});

// -- FormManager
AppManagers.FormManager.registerHandler('formRenouvellement', async (data, form, codex, manager, validator) => {
  try {
    const handlerObj = AppManagers.DomloadManager.handlers['vueRenouvellement'];

    let dateInitiale = new Date(data.get('dateInitiale'));
    let quantite = parseInt(data.get('nombreRenouvellements'));
    let intervalle = parseInt(data.get('intervalleRenouvellement'));

    if (isNaN(dateInitiale) || quantite < 1 || intervalle < 7) {
      manager.addResultMessage(codex, 'error', 'Inputs invalides : date valide, quantité ≥1, intervalle ≥7.');
      return;
    }

    const dates = handlerObj.CalculerRenouvellements(dateInitiale, quantite, intervalle);
    const tableBody = document.getElementById('renouvellementTable');
    tableBody.innerHTML = '';

    dates.forEach((date, index) => {
      const jourSemaine = date.toLocaleDateString("fr-FR", { weekday: 'long' });
      const dateStr = `${date.toLocaleDateString("fr-FR")} (${jourSemaine.charAt(0).toUpperCase() + jourSemaine.slice(1)})`;
      const modalId = `modal-qr-R${index + 1}`;
      const titreModal = `R${index + 1} = ${date.toLocaleDateString("fr-FR")} - ${jourSemaine}`;

      const rowHTML = `
        <tr>
          <td>R${index + 1}</td>
          <td>${dateStr}</td>
          <td>
            <button class="fr-btn fr-btn--tertiary" type="button" title="Copier" 
              onclick="navigator.clipboard.writeText('R${index + 1} = ${date.toLocaleDateString("fr-FR")} - ${jourSemaine}')">📋</button>
            <button class="fr-btn fr-btn--tertiary" type="button" data-fr-opened="false" aria-controls="${modalId}" title="QRCode">⛆</button>

            <dialog id="${modalId}" class="fr-modal" aria-labelledby="${modalId}-title">
              <div class="fr-modal__body">
                <div class="fr-modal__content">
                  <div class="fr-modal__header">
                    <h2 id="${modalId}-title" class="fr-modal__title">${titreModal}</h2>
                    <button class="fr-btn--close fr-btn" type="button" aria-controls="${modalId}" title="Fermer">Fermer</button>
                  </div>
                  <div class="fr-modal__content">
                    <p id="qrcode-${index + 1}"></p>
                  </div>
                </div>
              </div>
            </dialog>
          </td>
        </tr>
      `;
      tableBody.insertAdjacentHTML('beforeend', rowHTML);

      // Génération QR code
      const qrcodePlaceholder = document.getElementById(`qrcode-${index + 1}`);
      if (qrcodePlaceholder) {
        const qrcode = new QRious({
          element: qrcodePlaceholder,
          value: `R${index + 1} = ${date.toLocaleDateString("fr-FR")} - ${jourSemaine}`,
          size: 120
        });
        qrcodePlaceholder.appendChild(qrcode.image);
      }
    });

    manager.addResultMessage(codex, 'success', `Dates générées : ${dates.length} renouvellements.`);
  } catch (err) {
    AppManagers.log('FormManager', 'error', 'Erreur handler formRenouvellement', err);
    manager.addResultMessage(codex, 'error', err.message || 'Erreur lors du calcul des dates.');
  }
});

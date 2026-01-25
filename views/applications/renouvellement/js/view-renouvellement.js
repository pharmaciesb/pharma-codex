/// <reference path="../../../../static/js/types.js" />

import { definirAujourdhui, formatFR, obtenirIntervalle } from '/pharma-codex/static/js/assistants/assistant-date.js';
import { initCopyListeners } from '/pharma-codex/static/js/assistants/assistant-clipboard.js';

/**
 * Handler pour la vue Renouvellement
 * @extends {AppManagers.ViewHandler}
 */
class RenouvellementHandler extends AppManagers.ViewHandler {
  constructor() {
    super('viewRenouvellement');

    // État interne
    this.joursFeries = [];
    this.anneeEnCours = new Date().getFullYear();
  }

  async onload() {
    // 1. Charge les jours fériés depuis l'API
    await this.chargerJoursFeries();
    // 2. Initialise la date du jour dans les inputs
    definirAujourdhui();
    // 3. Initialise les dates affichées
    this.initDates();
    // 4. Enregistre le handler de formulaire
    this.registerForm('formRenouvellement', this.handleFormSubmit);
  }

  /**
   * Charge les jours fériés depuis l'API gouv.fr
   */
  async chargerJoursFeries() {
    const tbody = this.getElement('joursFeries');
    if (!tbody) return;

    try {
      const response = await fetch(
        `https://calendrier.api.gouv.fr/jours-feries/metropole/${this.anneeEnCours}.json`
      );

      if (!response.ok) throw new Error('API indisponible');

      const data = await response.json();

      // Parse et trie les dates
      this.joursFeries = Object.keys(data)
        .map(dateStr => {
          const [year, month, day] = dateStr.split('-');
          return {
            date: new Date(parseInt(year), parseInt(month) - 1, parseInt(day)),
            libelle: data[dateStr]
          };
        })
        .sort((a, b) => a.date - b.date);

      // Affiche dans le tableau
      tbody.innerHTML = this.joursFeries.map(jour => {
        const jourSemaine = jour.date.toLocaleDateString('fr-FR', { weekday: 'long' });
        const jourCapitalized = jourSemaine.charAt(0).toUpperCase() + jourSemaine.slice(1);

        return `
                    <tr>
                        <td>${jour.date.toLocaleDateString('fr-FR')}</td>
                        <td>${jour.libelle}</td>
                        <td>${jourCapitalized}</td>
                    </tr>
                `;
      }).join('');

      AppManagers.log(this.key, 'success', `${this.joursFeries.length} jours fériés chargés`);

    } catch (err) {
      AppManagers.log(this.key, 'error', 'Erreur chargement jours fériés:', err);
      tbody.innerHTML = '<tr><td colspan="3" class="fr-error-text">Erreur chargement fériés (mode offline).</td></tr>';
    }
  }

  /**
   * Vérifie si une date est un jour férié
   * @param {Date} date
   * @returns {boolean}
   */
  estJourFerie(date) {
    return this.joursFeries.some(j => j.date.toDateString() === date.toDateString());
  }

  /**
   * Ajuste une date si elle tombe un dimanche ou un jour férié
   * @param {Date} date
   * @returns {Date}
   */
  ajusterSiJourFerieOuDimanche(date) {
    while (this.estJourFerie(date) || date.getDay() === 0) {
      date.setDate(date.getDate() + 1);
    }
    return date;
  }

  /**
   * Calcule les dates de renouvellement
   * @param {Date} dateInitiale
   * @param {number} quantite
   * @param {number} intervalle
   * @returns {Date[]}
   */
  calculerRenouvellements(dateInitiale, quantite, intervalle) {
    const dates = [];
    let dateCourante = new Date(dateInitiale);

    for (let i = 0; i < quantite; i++) {
      dateCourante.setDate(dateCourante.getDate() + intervalle);
      dateCourante = this.ajusterSiJourFerieOuDimanche(dateCourante);
      dates.push(new Date(dateCourante));
    }

    return dates;
  }

  /**
   * Initialise les dates affichées dans la page
   */
  initDates() {
    const dateEl = this.getElement('dateDerniereFacturation', false);
    if (dateEl) {
      dateEl.textContent = formatFR(obtenirIntervalle(new Date(), -22));
    }
  }

  /**
   * Gère la soumission du formulaire
   * @param {FormData} data
   * @param {HTMLFormElement} form
   */
  async handleFormSubmit(data, form) {
    try {
      // Récupération et validation des données
      const dateInitiale = new Date(data.get('dateInitiale'));
      const quantite = parseInt(data.get('nombreRenouvellements'));
      const intervalle = parseInt(data.get('intervalleRenouvellement'));

      if (isNaN(dateInitiale.getTime()) || quantite < 1 || intervalle < 7) {
        await AppManagers.CodexManager.show('error', 'Données invalides : date valide, quantité ≥1, intervalle ≥7.');
        return;
      }

      // Calcul des dates
      const dates = this.calculerRenouvellements(dateInitiale, quantite, intervalle);

      // Affichage dans le tableau
      this.afficherRenouvellements(dates);
      await AppManagers.CodexManager.show('success', `${dates.length} renouvellement(s) généré(s)`);

    } catch (err) {
      AppManagers.log(this.key, 'error', 'Erreur calcul renouvellements:', err);
      await AppManagers.CodexManager.show('error', err.message || 'Erreur lors du calcul des dates.');
    }
  }

  /**
   * Affiche les dates de renouvellement dans le tableau avec modales QR code
   * @param {Date[]} dates
   */
  async afficherRenouvellements(dates) {
    const tableBody = this.getElement('renouvellementTable');
    if (!tableBody) return;

    tableBody.innerHTML = '';

    const templatePath = './views/applications/renouvellement/partials/renouvellement-row.html';

    // ✅ Prépare toutes les données
    const rendersData = dates.map((date, index) => {
      const jourSemaine = date.toLocaleDateString('fr-FR', { weekday: 'long' });
      const jourCapitalized = jourSemaine.charAt(0).toUpperCase() + jourSemaine.slice(1);
      const dateStr = `${date.toLocaleDateString('fr-FR')} (${jourCapitalized})`;
      const modalId = `modal-qr-R${index + 1}`;
      const texteCopie = `R${index + 1} = ${date.toLocaleDateString('fr-FR')} - ${jourSemaine}`;

      return { numero: index + 1, dateStr, modalId, texteCopie };
    });

    // ✅ Rend tous les templates en parallèle
    await Promise.all(
      rendersData.map(data =>
        AppManagers.TemplateManager.renderInto(templatePath, data, tableBody, false)
      )
    );

    // ✅ Génère les QR codes après le rendu
    rendersData.forEach(data => {
      this.genererQRCode(data.numero, data.texteCopie);
    });

    // ✅ Attache les listeners
    await initCopyListeners(AppManagers.log);
  }

  /**
   * Génère un QR code dans le canvas
   * @param {number} index
   * @param {string} texte
   */
  genererQRCode(index, texte) {
    const canvas = document.getElementById(`qrcode-${index}`);
    if (!canvas || !window.QRious) return;

    new QRious({
      element: canvas,
      value: texte,
      size: 200
    });
  }
}

new RenouvellementHandler().register();
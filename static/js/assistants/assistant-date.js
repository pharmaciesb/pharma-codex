// /pharma-codex/static/js/assistants/assistant-date.js

// --- Fonctions utilitaires internes ---

/**
 * Assure que l'entrée est un objet Date valide.
 * @param {string|Date} d - Date ou chaîne à normaliser.
 * @returns {Date} L'objet Date valide.
 */
function normalizeDate(d) {
    // Si c'est une chaîne, on tente de la convertir en Date (attention : le format doit être ISO pour la fiabilité)
    if (typeof d === "string") {
        d = new Date(d);
    }
    // Vérifie si c'est bien une instance de Date et si elle n'est pas invalide
    if (!(d instanceof Date) || isNaN(d)) {
        // Log l'erreur avant de la relancer pour plus de contexte
        console.error("assitant-date: Date invalide fournie.", d);
        throw new Error("Date invalide");
    }
    return d;
}

// --- Fonctions exportées (Synchrones) ---

/**
 * Initialise tous les champs <input type="date" data-init="aujourdhui"> à la date du jour au format ISO.
 */
export function definirAujourdhui() {
    try {
        const todayISO = new Date().toISOString().slice(0, 10);
        const dateInputs = document.querySelectorAll('input[type="date"]');
        dateInputs.forEach(dateEl => {
            if (dateEl.dataset.init === 'aujourdhui') {
                dateEl.value = todayISO;
            }
        });
    } catch (error) {
        console.error('assitant-date: echec sur definirAujourdhui', error);
    }
}


/**
 * Retourne une date ajustée par un intervalle en jours.
 * @param {Date|string} d - Date de départ.
 * @param {number} jours - Nombre de jours à ajouter (positif) ou retirer (négatif).
 * @returns {Date|null} La nouvelle date ou null en cas d'erreur.
 */
export function obtenirIntervalle(d = new Date(), jours = -22) {
    try {
        const date = normalizeDate(d);
        const targetDate = new Date(date);
        targetDate.setDate(targetDate.getDate() + jours);
        return targetDate;
    } catch (error) {
        // L'erreur est déjà loggée par normalizeDate
        return null;
    }
}

/**
 * Formate une date au format français DD/MM/YYYY.
 * @param {Date|string} d - Date à formater.
 * @returns {string} Date au format DD/MM/YYYY ou chaîne vide en cas d'erreur.
 */
export function formatFR(d = new Date()) {
    try {
        const date = normalizeDate(d);
        const dd = String(date.getDate()).padStart(2, '0');
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const yyyy = date.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
    } catch (error) {
        // L'erreur est déjà loggée par normalizeDate
        return "";
    }
}

/**
 * Formate une date au format ISO YYYY-MM-DD.
 * @param {Date|string} d - Date à formater.
 * @returns {string} Date au format YYYY-MM-DD ou chaîne vide en cas d'erreur.
 */
export function formatISO(d = new Date()) {
    try {
        const date = normalizeDate(d);
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    } catch (error) {
        // L'erreur est déjà loggée par normalizeDate
        return "";
    }
}

/**
 * Parse une chaîne de date lâche (dd/mm/yyyy, yyyy-mm-dd, ddmmyyyy) en objet Date.
 * @param {string} s - Chaîne de date.
 * @returns {Date|null} L'objet Date ou null.
 */
export function parseLoose(s) {
    if (!s || typeof s !== 'string') return null;

    if (s.includes('/')) {
        // dd/mm/yyyy
        const [d, m, y] = s.split('/');
        return new Date(`${y}-${m}-${d}`);
    }
    if (s.includes('-')) {
        // yyyy-mm-dd
        return new Date(s);
    }
    if (/^\d{8}$/.test(s)) {
        // DDMMYYYY
        const d = s.slice(0, 2);
        const m = s.slice(2, 4);
        const y = s.slice(4, 8);
        return new Date(`${y}-${m}-${d}`);
    }

    return null;
}
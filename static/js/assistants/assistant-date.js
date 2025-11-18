export async function definirAujourdhui() {
    try {
        const dateInputs = document.querySelectorAll('input[type="date"]');
        dateInputs.forEach(dateEl => {
            if (dateEl.dataset.init === 'aujourdhui') {
                dateEl.value = new Date().toISOString().slice(0, 10);
            }
        });
    } catch (error) {
        console.error('assitant-date: echec sur definirAujourdhui', error);
    }
}

function normalizeDate(d) {
    if (typeof d === "string") {
        d = new Date(d);
    }
    if (!(d instanceof Date) || isNaN(d)) {
        throw new Error("Date invalide");
    }
    return d;
}

export async function obtenirIntervalle(d = new Date(), jours = -22) {
    try {
        const date = normalizeDate(d);

        const targetDate = new Date(date); // clone propre
        targetDate.setDate(targetDate.getDate() + jours);

        return targetDate;

    } catch (error) {
        console.error('assitant-date: echec sur obtenirIntervalle', error);
        return null;
    }
}

export async function formatFR(d = new Date()) {
    try {
        const date = normalizeDate(d);

        const dd = String(date.getDate()).padStart(2, '0');
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const yyyy = date.getFullYear();

        return `${dd}/${mm}/${yyyy}`;

    } catch (error) {
        console.error('assitant-date: echec sur formatFR', error);
        return "";
    }
}

export async function formatISO(d = new Date()) {
    try {
        const date = normalizeDate(d);

        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');

        return `${yyyy}-${mm}-${dd}`;

    } catch (error) {
        console.error('assitant-date: echec sur formatISO', error);
        return "";
    }
}

export async function parseLoose(s) {
    // accepte dd/mm/yyyy, yyyy-mm-dd, ddmmyyyy
    if (!s) return null;
    if (s.includes('/')) {
        const [d, m, y] = s.split('/');
        return new Date(`${y}-${m}-${d}`);
    }
    if (s.includes('-')) return new Date(s);
    if (/^\d{8}$/.test(s)) {
        return new Date(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6)}`);
    }
    return null;
}


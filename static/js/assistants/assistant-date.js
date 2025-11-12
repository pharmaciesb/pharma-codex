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

export async function obtenirIntervalle(d = new Date(), jours = -22) {
    try {
        const targetDate = new Date(d);
        targetDate.setDate(targetDate.getDate() + jours);
        return targetDate;
    } catch (error) {
        console.error('assitant-date: echec sur obtenirIntervalle', error);
    }
}

export async function formatFR(d = new Date()) {
    try {
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
    } catch (error) {
        console.error('assitant-date: echec sur formatFR', error);
    }
}

export async function formatISO(d = new Date()) {
    try {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    } catch (error) {
        console.error('assitant-date: echec sur formatISO', error);
    }
}
export async function parseLoose(s) {
    // accepte dd/mm/yyyy, yyyy-mm-dd, ddmmyyyy
    if (!s) return null;
    if (s.includes('/')) {
      const [d,m,y] = s.split('/');
      return new Date(`${y}-${m}-${d}`);
    }
    if (s.includes('-')) return new Date(s);
    if (/^\d{8}$/.test(s)) {
      return new Date(`${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6)}`);
    }
    return null;
  }


// /static/js/assistants/assistant-share-export.js
// Utilitaire réutilisable : téléchargement direct ou partage natif (mobile).

/**
 * Déclenche le téléchargement d'un Blob.
 */
export function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
}

/**
 * Vérifie si le partage natif de fichiers est disponible (mobile essentiellement).
 */
export function canShareFiles(blob, filename) {
    if (!navigator.canShare || !navigator.share) return false;
    try {
        const file = new File([blob], filename, { type: blob.type });
        return navigator.canShare({ files: [file] });
    } catch {
        return false;
    }
}

/**
 * Ouvre la feuille de partage native (mail, drive, messages, etc.)
 */
export async function shareBlob(blob, filename, { title = '', text = '' } = {}) {
    const file = new File([blob], filename, { type: blob.type });
    await navigator.share({ files: [file], title, text });
}
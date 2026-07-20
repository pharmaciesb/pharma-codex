// /static/js/assistants/assistant-clipboard-paste.js
/**
 * Utilitaire réutilisable : écoute l'événement "paste" (Ctrl+V) sur un élément
 * (par défaut document) et extrait la première image trouvée dans le presse-papier.
 *
 * Usage :
 * const detach = listenForImagePaste(document, (file) => { ... });
 * // detach() pour retirer le listener
 */
export function listenForImagePaste(target = document, onImage, logFunction = console.log) {
    const handler = (e) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        for (const item of items) {
            if (item.type && item.type.startsWith('image/')) {
                const file = item.getAsFile();
                if (file) {
                    logFunction('[ClipboardPaste] Image détectée dans le presse-papier', 'success');
                    onImage(file);
                    e.preventDefault();
                    return;
                }
            }
        }
    };

    target.addEventListener('paste', handler);
    return () => target.removeEventListener('paste', handler);
}

/**
 * Support du drag & drop de fichier image sur une dropzone.
 * @returns {Function} fonction de nettoyage
 */
export function listenForImageDrop(dropzoneEl, onImage, { dragoverClass = 'ordoscan-dropzone--dragover' } = {}) {
    const onDragOver = (e) => {
        e.preventDefault();
        dropzoneEl.classList.add(dragoverClass);
    };
    const onDragLeave = () => dropzoneEl.classList.remove(dragoverClass);
    const onDrop = (e) => {
        e.preventDefault();
        dropzoneEl.classList.remove(dragoverClass);
        const file = e.dataTransfer?.files?.[0];
        if (file && file.type.startsWith('image/')) onImage(file);
    };

    dropzoneEl.addEventListener('dragover', onDragOver);
    dropzoneEl.addEventListener('dragleave', onDragLeave);
    dropzoneEl.addEventListener('drop', onDrop);

    return () => {
        dropzoneEl.removeEventListener('dragover', onDragOver);
        dropzoneEl.removeEventListener('dragleave', onDragLeave);
        dropzoneEl.removeEventListener('drop', onDrop);
    };
}
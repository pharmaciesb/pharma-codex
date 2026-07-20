// /static/js/assistants/assistant-ordoscan-bgremoval.js

const IMGLY_VERSION = '1.5.8';
const IMGLY_MODULE_URL = `https://esm.sh/@imgly/background-removal@${IMGLY_VERSION}?bundle`;
const IMGLY_PUBLIC_PATH = `https://staticimgly.com/@imgly/background-removal-data/${IMGLY_VERSION}/dist/`;

let _imglyModulePromise = null;
function loadImgly() {
    if (!_imglyModulePromise) {
        _imglyModulePromise = import(/* webpackIgnore: true */ IMGLY_MODULE_URL);
    }
    return _imglyModulePromise;
}

// Résolution défensive : selon l'interop CJS/ESM d'esm.sh, la fonction peut se
// trouver à différents endroits du module chargé.
function resolveFn(mod, ...names) {
    const candidates = [mod, mod?.default, mod?.default?.default, ...names.map(n => mod?.[n])];
    const fn = candidates.find(c => typeof c === 'function');
    if (!fn) {
        console.error('[assistant-ordoscan-bgremoval] Module chargé :', mod);
        throw new Error('Impossible de localiser removeBackground dans le module @imgly/background-removal chargé');
    }
    return fn;
}

export async function preloadBackgroundRemoval(onProgress) {
    try {
        const mod = await loadImgly();
        const preload = resolveFn(mod, 'preload');
        await preload({ publicPath: IMGLY_PUBLIC_PATH, progress: onProgress });
    } catch (err) {
        console.warn('[assistant-ordoscan-bgremoval] Préchargement impossible (non bloquant)', err);
    }
}

export async function removeImageBackground(imageBlob, onProgress) {
    const mod = await loadImgly();
    const removeBackground = resolveFn(mod, 'removeBackground');

    return await removeBackground(imageBlob, {
        publicPath: IMGLY_PUBLIC_PATH,
        progress: onProgress
    });
}

export async function compositeOnWhite(transparentPngBlob) {
    const bitmap = await createImageBitmap(transparentPngBlob);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0);
    return await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.95));
}
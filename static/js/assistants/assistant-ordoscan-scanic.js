// /static/js/assistants/assistant-ordoscan-scanic.js
//
// Intégration Scanic (https://github.com/marquaye/scanic).
// API confirmée : import { scanDocument, extractDocument } from 'scanic'
//   scanDocument(img, { mode: 'detect' })  -> { success, corners }
//   scanDocument(img, { mode: 'extract', output: 'canvas' }) -> { success, output }
//
// ⚠️ Vérifiez la forme exacte de `corners` renvoyée par votre version installée
// (tableau de 4 points {x,y} vs objet nommé). normalizeCorners() gère les deux cas.
// Si `extractDocument` a une signature différente chez vous, adaptez `tryScanicExtract()`.

const SCANIC_CDN_URL = 'https://esm.sh/scanic'; // ⚠️ à figer sur une version précise en prod, ex: https://esm.sh/scanic@0.x.x

let _scanicModulePromise = null;
function loadScanic() {
    if (!_scanicModulePromise) {
        _scanicModulePromise = import(/* webpackIgnore: true */ SCANIC_CDN_URL);
    }
    return _scanicModulePromise;
}

/**
 * Normalise la forme des corners renvoyée par Scanic vers un tableau [{x,y} x4]
 * dans l'ordre TL, TR, BR, BL.
 */
function normalizeCorners(raw, fallbackWidth, fallbackHeight) {
    if (Array.isArray(raw) && raw.length === 4) {
        return raw.map(p => ({ x: p.x ?? p[0], y: p.y ?? p[1] }));
    }
    if (raw && raw.topLeft) {
        return [raw.topLeft, raw.topRight, raw.bottomRight, raw.bottomLeft];
    }
    // Fallback : rectangle inséré à 8% des bords
    const insetX = fallbackWidth * 0.08;
    const insetY = fallbackHeight * 0.08;
    return [
        { x: insetX, y: insetY },
        { x: fallbackWidth - insetX, y: insetY },
        { x: fallbackWidth - insetX, y: fallbackHeight - insetY },
        { x: insetX, y: fallbackHeight - insetY }
    ];
}

/**
 * Détecte automatiquement les 4 coins du document sur l'image.
 * Ne lève jamais d'exception : retourne un rectangle par défaut en cas d'échec.
 */
export async function detectDocumentCorners(imageEl) {
    try {
        const { scanDocument } = await loadScanic();
        const result = await scanDocument(imageEl, { mode: 'detect' });
        if (result?.success && result.corners) {
            return normalizeCorners(result.corners, imageEl.naturalWidth, imageEl.naturalHeight);
        }
    } catch (err) {
        console.warn('[assistant-ordoscan-scanic] Détection auto indisponible, fallback rectangle', err);
    }
    return normalizeCorners(null, imageEl.naturalWidth, imageEl.naturalHeight);
}

/**
 * Monte un éditeur de coins interactif (canvas + poignées glissables) par-dessus l'image.
 * Travaille sur un APERÇU redimensionné (perf/UX), tout en stockant les coins
 * en coordonnées "image naturelle" (pleine résolution) pour l'extraction finale.
 */
export function mountCornerEditor(container, imageEl, initialCorners, onChange, options = {}) {
    container.innerHTML = '';

    // Taille d'aperçu : jamais la taille native, toujours calculée/bornée explicitement.
    const availableWidth = options.maxDisplayWidth ?? Math.min(700, container.clientWidth || 700, window.innerWidth - 32);
    const maxDisplayHeight = options.maxDisplayHeight ?? 480;

    const scaleFactor = Math.min(
        1,
        availableWidth / imageEl.naturalWidth,
        maxDisplayHeight / imageEl.naturalHeight
    );
    const dispW = Math.round(imageEl.naturalWidth * scaleFactor);
    const dispH = Math.round(imageEl.naturalHeight * scaleFactor);

    container.style.width = dispW + 'px';
    container.style.height = dispH + 'px';

    const displayImg = document.createElement('img');
    displayImg.src = imageEl.src;
    displayImg.className = 'ordoscan-base-img';
    displayImg.width = dispW;   // taille forcée en JS, pas de CSS "max-width" qui pourrait re-scaler
    displayImg.height = dispH;
    container.appendChild(displayImg);

    const overlay = document.createElement('canvas');
    overlay.className = 'ordoscan-overlay';
    overlay.width = dispW;      // buffer interne canvas === taille CSS affichée (1:1)
    overlay.height = dispH;
    overlay.style.width = dispW + 'px';
    overlay.style.height = dispH + 'px';
    overlay.style.touchAction = 'none';
    container.appendChild(overlay);

    // corners stockés en coordonnées "image naturelle" (pleine résolution)
    let corners = initialCorners.map(p => ({ ...p }));
    let dragIndex = -1;

    const toDisplay = (p) => ({ x: p.x * scaleFactor, y: p.y * scaleFactor });
    const toNatural = (p) => ({ x: p.x / scaleFactor, y: p.y / scaleFactor });

    function draw() {
        const ctx = overlay.getContext('2d');
        ctx.clearRect(0, 0, overlay.width, overlay.height);

        ctx.strokeStyle = '#1EC4F4';
        ctx.lineWidth = 2;
        ctx.beginPath();
        corners.forEach((p, i) => {
            const d = toDisplay(p);
            if (i === 0) ctx.moveTo(d.x, d.y); else ctx.lineTo(d.x, d.y);
        });
        ctx.closePath();
        ctx.stroke();

        corners.forEach((p) => {
            const d = toDisplay(p);
            ctx.beginPath();
            ctx.arc(d.x, d.y, 12, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(30,196,244,0.85)';
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
        });
    }

    function pointerPos(e) {
        const rect = overlay.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    function findHandle(pos) {
        let closestIndex = -1;
        let closestDist = 26; // rayon de tolérance en px CSS
        corners.forEach((p, i) => {
            const d = toDisplay(p);
            const dist = Math.hypot(d.x - pos.x, d.y - pos.y);
            if (dist < closestDist) { closestDist = dist; closestIndex = i; }
        });
        return closestIndex;
    }

    function onPointerDown(e) {
        const pos = pointerPos(e);
        dragIndex = findHandle(pos);
        if (dragIndex !== -1) {
            overlay.setPointerCapture(e.pointerId);
            e.preventDefault();
        }
    }
    function onPointerMove(e) {
        if (dragIndex === -1) return;
        e.preventDefault();
        const pos = pointerPos(e);
        const clampedX = Math.max(0, Math.min(overlay.width, pos.x));
        const clampedY = Math.max(0, Math.min(overlay.height, pos.y));
        corners[dragIndex] = toNatural({ x: clampedX, y: clampedY });
        draw();
    }
    function onPointerUp(e) {
        if (dragIndex !== -1) {
            overlay.releasePointerCapture(e.pointerId);
            dragIndex = -1;
            onChange?.(corners.map(p => ({ ...p })));
        }
    }

    overlay.addEventListener('pointerdown', onPointerDown);
    overlay.addEventListener('pointermove', onPointerMove);
    overlay.addEventListener('pointerup', onPointerUp);
    overlay.addEventListener('pointercancel', onPointerUp);

    draw();

    return {
        getCorners: () => corners.map(p => ({ ...p })), // toujours en coordonnées image pleine résolution
        destroy: () => {
            overlay.removeEventListener('pointerdown', onPointerDown);
            overlay.removeEventListener('pointermove', onPointerMove);
            overlay.removeEventListener('pointerup', onPointerUp);
            overlay.removeEventListener('pointercancel', onPointerUp);
            container.innerHTML = '';
        }
    };
}

/**
 * Extrait l'image finale (recadrée + perspective corrigée) à partir des 4 coins
 * choisis/ajustés par l'utilisateur.
 *
 * ⚠️ Scanic n'expose pas d'API confirmée pour extraire à partir de coins
 * personnalisés (son mode "extract" refait sa propre détection interne et
 * ignore silencieusement les coins qu'on lui passe). On utilise donc toujours
 * notre warp maison (perspectiveWarpCanvas), qui applique exactement les
 * coins choisis par l'utilisateur — c'est le comportement attendu ici.
 */
export async function extractFlattenedImage(imageEl, corners, outputWidth = 1400) {
    const ratio = estimateOutputRatio(corners);
    const outW = outputWidth;
    const outH = Math.round(outputWidth * ratio);
    return perspectiveWarpCanvas(imageEl, corners, outW, outH);
}

function estimateOutputRatio(corners) {
    const [tl, tr, br, bl] = corners;
    const width = (dist(tl, tr) + dist(bl, br)) / 2;
    const height = (dist(tl, bl) + dist(tr, br)) / 2;
    return width > 0 ? height / width : 1.414; // fallback ratio A4
}
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

/**
 * Fallback 100% maison : approxime la correction de perspective en découpant
 * le quadrilatère source en 2 triangles, et en appliquant une transformation
 * affine (3 points) à chacun via canvas 2D (setTransform). C'est une approximation
 * (pas une vraie homographie), mais suffisante pour redresser une photo de feuille.
 */
function perspectiveWarpCanvas(imageEl, corners, outW, outH) {
    const [tl, tr, br, bl] = corners;
    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');

    // Triangle 1 : TL, TR, BL  →  (0,0),(outW,0),(0,outH)
    drawAffineTriangle(ctx, imageEl, tl, tr, bl, { x: 0, y: 0 }, { x: outW, y: 0 }, { x: 0, y: outH });
    // Triangle 2 : TR, BR, BL  →  (outW,0),(outW,outH),(0,outH)
    drawAffineTriangle(ctx, imageEl, tr, br, bl, { x: outW, y: 0 }, { x: outW, y: outH }, { x: 0, y: outH });

    return canvas;
}

function drawAffineTriangle(ctx, img, s0, s1, s2, d0, d1, d2) {
    ctx.save();

    // Clip sur le triangle destination
    ctx.beginPath();
    ctx.moveTo(d0.x, d0.y);
    ctx.lineTo(d1.x, d1.y);
    ctx.lineTo(d2.x, d2.y);
    ctx.closePath();
    ctx.clip();

    // Résolution de la matrice affine [a,b,c,d,e,f] telle que : dest = M * src
    const denom = s0.x * (s1.y - s2.y) - s1.x * (s0.y - s2.y) + s2.x * (s0.y - s1.y);
    if (denom === 0) { ctx.restore(); return; }

    const a = (d0.x * (s1.y - s2.y) - d1.x * (s0.y - s2.y) + d2.x * (s0.y - s1.y)) / denom;
    const b = (d0.y * (s1.y - s2.y) - d1.y * (s0.y - s2.y) + d2.y * (s0.y - s1.y)) / denom;
    const c = (s0.x * (d1.x - d2.x) - s1.x * (d0.x - d2.x) + s2.x * (d0.x - d1.x)) / denom;
    const d = (s0.x * (d1.y - d2.y) - s1.x * (d0.y - d2.y) + s2.x * (d0.y - d1.y)) / denom;
    const e = (s0.x * (s1.y * d2.x - s2.y * d1.x) - s1.x * (s0.y * d2.x - s2.y * d0.x) + s2.x * (s0.y * d1.x - s1.y * d0.x)) / denom;
    const f = (s0.x * (s1.y * d2.y - s2.y * d1.y) - s1.x * (s0.y * d2.y - s2.y * d0.y) + s2.x * (s0.y * d1.y - s1.y * d0.y)) / denom;

    ctx.transform(a, b, c, d, e, f);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
}
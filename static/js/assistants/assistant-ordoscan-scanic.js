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

function estimateOutputRatio(corners) {
    const [tl, tr, br, bl] = corners;
    const width = (dist(tl, tr) + dist(bl, br)) / 2;
    const height = (dist(tl, bl) + dist(tr, br)) / 2;
    return width > 0 ? height / width : 1.414; // fallback ratio A4
}
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

/**
 * Extrait l'image finale (recadrée + perspective corrigée) à partir des 4 coins
 * choisis/ajustés par l'utilisateur, via une vraie homographie (pas d'approximation
 * par triangles) : aucune couture, quelle que soit l'inclinaison de la photo.
 */
export async function extractFlattenedImage(imageEl, corners, outputWidth = 1400) {
    const ratio = estimateOutputRatio(corners);
    const outW = outputWidth;
    const outH = Math.round(outputWidth * ratio);
    return perspectiveWarpCanvas(imageEl, corners, outW, outH);
}

/**
 * Calcule les 8 coefficients (a,b,c,d,e,f,g,h) de la transformation projective
 * qui envoie le carré unité (0,0)-(1,0)-(1,1)-(0,1) sur le quadrilatère `quad`
 * (dans le même ordre : TL, TR, BR, BL). Méthode classique de Heckbert.
 *
 *   x = (a*u + b*v + c) / (g*u + h*v + 1)
 *   y = (d*u + e*v + f) / (g*u + h*v + 1)
 */
function computeSquareToQuadCoeffs([p0, p1, p2, p3]) {
    const dx1 = p1.x - p2.x, dx2 = p3.x - p2.x, sx = p0.x - p1.x + p2.x - p3.x;
    const dy1 = p1.y - p2.y, dy2 = p3.y - p2.y, sy = p0.y - p1.y + p2.y - p3.y;

    let a, b, c, d, e, f, g, h;

    if (Math.abs(sx) < 1e-9 && Math.abs(sy) < 1e-9) {
        // Cas dégénéré : le quadrilatère est en fait un parallélogramme (pas de perspective)
        a = p1.x - p0.x; b = p2.x - p1.x; c = p0.x;
        d = p1.y - p0.y; e = p2.y - p1.y; f = p0.y;
        g = 0; h = 0;
    } else {
        const denom = dx1 * dy2 - dx2 * dy1;
        g = (sx * dy2 - dx2 * sy) / denom;
        h = (dx1 * sy - sx * dy1) / denom;
        a = p1.x - p0.x + g * p1.x;
        b = p3.x - p0.x + h * p3.x;
        c = p0.x;
        d = p1.y - p0.y + g * p1.y;
        e = p3.y - p0.y + h * p3.y;
        f = p0.y;
    }

    return { a, b, c, d, e, f, g, h };
}

/**
 * Applique le warp perspective par mapping inverse : pour chaque pixel de sortie,
 * on retrouve le pixel source correspondant (via l'homographie) et on l'échantillonne
 * en bilinéaire. C'est du calcul brut sur ImageData (pas d'API canvas de warp),
 * donc plus lent qu'un simple drawImage, mais sans aucune approximation/couture.
 */
function perspectiveWarpCanvas(imageEl, corners, outW, outH) {
    const [tl, tr, br, bl] = corners;
    const { a, b, c, d, e, f, g, h } = computeSquareToQuadCoeffs([tl, tr, br, bl]);

    // Canvas source (pour lire les pixels bruts de l'image)
    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = imageEl.naturalWidth;
    srcCanvas.height = imageEl.naturalHeight;
    const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true });
    srcCtx.drawImage(imageEl, 0, 0);
    const srcW = srcCanvas.width, srcH = srcCanvas.height;
    const src = srcCtx.getImageData(0, 0, srcW, srcH).data;

    const dstCanvas = document.createElement('canvas');
    dstCanvas.width = outW;
    dstCanvas.height = outH;
    const dstCtx = dstCanvas.getContext('2d');
    const dstImageData = dstCtx.createImageData(outW, outH);
    const dst = dstImageData.data;

    const maxX = srcW - 1, maxY = srcH - 1;

    for (let py = 0; py < outH; py++) {
        const v = py / outH;
        for (let px = 0; px < outW; px++) {
            const u = px / outW;
            const denom = g * u + h * v + 1;
            const di = (py * outW + px) * 4;

            if (Math.abs(denom) < 1e-9) {
                dst[di] = 255; dst[di + 1] = 255; dst[di + 2] = 255; dst[di + 3] = 255;
                continue;
            }

            const sx = (a * u + b * v + c) / denom;
            const sy = (d * u + e * v + f) / denom;

            if (sx < 0 || sy < 0 || sx > maxX || sy > maxY) {
                // En dehors de l'image source (coin étiré hors-cadre) -> blanc
                dst[di] = 255; dst[di + 1] = 255; dst[di + 2] = 255; dst[di + 3] = 255;
                continue;
            }

            const x0 = sx | 0, y0 = sy | 0;
            const x1 = x0 < maxX ? x0 + 1 : x0;
            const y1 = y0 < maxY ? y0 + 1 : y0;
            const fx = sx - x0, fy = sy - y0;

            const i00 = (y0 * srcW + x0) * 4;
            const i10 = (y0 * srcW + x1) * 4;
            const i01 = (y1 * srcW + x0) * 4;
            const i11 = (y1 * srcW + x1) * 4;

            for (let ch = 0; ch < 4; ch++) {
                const top = src[i00 + ch] * (1 - fx) + src[i10 + ch] * fx;
                const bottom = src[i01 + ch] * (1 - fx) + src[i11 + ch] * fx;
                dst[di + ch] = top * (1 - fy) + bottom * fy;
            }
        }
    }

    dstCtx.putImageData(dstImageData, 0, 0);
    return dstCanvas;
}
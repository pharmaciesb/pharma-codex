/**
 * Assistant Masks - Utilitaires de formatage pour les inputs
 *
 * Fonctionnement :
 * - Chaque mask est une fonction (input) => void, enregistrée via registerMask().
 * - data-oninput="xxx" sur l'input détermine quel mask appliquer.
 * - Les alias (ex: "code-organisme" / "codeOrganisme" / "CODE_ORGANISME") sont
 *   normalisés automatiquement (minuscule, sans tiret/underscore/espace).
 *
 * Pour ajouter un nouveau mask, une seule chose à faire en bas du fichier :
 *   registerMask('nomDuMask', maFonctionDeFormatage, ['alias-optionnel']);
 */

// --- Registre interne : clé normalisée -> fonction de formatage ---
const MASKS = {};

/**
 * Normalise une clé de mask pour la rendre insensible à la casse,
 * aux tirets, underscores et espaces.
 * Ex: "code-organisme", "Code_Organisme", "CODE ORGANISME" -> "codeorganisme"
 */
function normalizeKey(str) {
  if (!str) return '';
  return str.toLowerCase().replace(/[-_\s]+/g, '');
}

/**
 * Enregistre un mask dans le registre.
 * @param {string} name - Nom principal du mask (ex: 'codeOrganisme')
 * @param {function(HTMLInputElement): void} formatterFn - Fonction de formatage
 * @param {Array<string>} [aliases] - Alias acceptés dans data-oninput
 */
export function registerMask(name, formatterFn, aliases = []) {
  const key = normalizeKey(name);
  MASKS[key] = formatterFn;
  aliases.forEach(alias => {
    MASKS[normalizeKey(alias)] = formatterFn;
  });
}

/**
 * Récupère la fonction de formatage associée à un data-oninput donné.
 * @param {string} maskType
 * @returns {function|undefined}
 */
function resolveMask(maskType) {
  return MASKS[normalizeKey(maskType)];
}

// --- Formatters ---

export function formatCodeOrganisme(input) {
  if (!input || !(input instanceof HTMLInputElement)) return;

  let value = input.value.trim().replace(/\s+/g, '').substring(0, 9);

  const parts = [];
  if (value.length > 0) parts.push(value.substring(0, 2));
  if (value.length > 2) parts.push(value.substring(2, 5));
  if (value.length > 5) parts.push(value.substring(5, 9));

  const formatted = parts.join(' ');

  if (input.value !== formatted) {
    input.value = formatted;
  }
}

// --- Câblage générique (plus besoin d'y toucher pour un nouveau mask) ---

/**
 * Handler générique attaché à chaque input masqué.
 * Retrouve dynamiquement la fonction de formatage via le registre.
 */
function handleMaskInput(e) {
  const input = e.target;
  const maskType = input.dataset.oninput;
  const fn = resolveMask(maskType);
  if (fn) fn(input);
}

/**
 * Initialise tous les inputs porteurs d'un data-oninput reconnu.
 * Peut être appelé plusieurs fois sans dupliquer les listeners
 * (protection via data-mask-initialized).
 */
export function initMasks(root = document) {
  const inputs = root.querySelectorAll('input[type="text"], input[type="tel"]');

  inputs.forEach(input => {
    const maskType = input.dataset.oninput;
    if (!maskType) return;

    const fn = resolveMask(maskType);
    if (!fn) {
      console.warn(`[assistant-masks] Aucun mask enregistré pour "${maskType}"`);
      return;
    }

    // Évite d'attacher plusieurs fois le même listener sur un input réutilisé
    if (input.dataset.maskInitialized === 'true') return;

    input.addEventListener('input', handleMaskInput);
    input.dataset.maskInitialized = 'true';

    // Formatage immédiat si une valeur est déjà présente (ex: pré-remplissage)
    if (input.value) fn(input);
  });
}

// --- Déclaration des masks disponibles ---
// Pour en ajouter un nouveau : une seule ligne ici, rien à modifier au-dessus.
registerMask('codeOrganisme', formatCodeOrganisme, ['code-organisme']);

// Exemples pour un futur mask (à décommenter/adapter le jour venu) :
// registerMask('telephone', formatTelephone, ['tel', 'phone']);
// registerMask('nir', formatNIR, ['secu', 'numero-secu']);
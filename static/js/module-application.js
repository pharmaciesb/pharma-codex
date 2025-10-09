// Détection auto du préfixe GitHub Pages
window.BASE_URL = window.location.pathname.includes("/pharma-codex/") ? "/pharma-codex" : "";
import { loadComponentsFromConfig } from './module-loader.js';
await loadComponentsFromConfig();
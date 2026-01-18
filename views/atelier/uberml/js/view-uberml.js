/// <reference path="../../../../static/js/types.js" />

import { getDocument } from '/pharma-codex/static/js/libs/pdf@5.4.394.js';
import { initCopyListeners } from '/pharma-codex/static/js/assistants/assistant-clipboard.js';

/**
 * Handler pour la vue UberML (génération de commandes OCP)
 * @extends {AppManagers.ViewHandler}
 */
class UberMLHandler extends AppManagers.ViewHandler {
    constructor() {
        super('viewUberml');
    }

    async onload() {
        this.configurerPdfWorker();
        this.registerForm('formUberml', this.handleFormSubmit);

        await initCopyListeners((msg, type) => {
            AppManagers.log(this.key, type || 'info', msg);
        });
    }

    configurerPdfWorker() {
        try {
            if (getDocument?.GlobalWorkerOptions) {
                getDocument.GlobalWorkerOptions.workerSrc = '/pharma-codex/static/js/libs/pdf.worker@5.4.394.js';
            }
        } catch (err) {
            AppManagers.log(this.key, 'warn', 'Worker PDF.js non configuré', err);
        }
    }

    async handleFormSubmit(data, form) {
        try {
            await AppManagers.CodexManager.show('info', 'Extraction de la commande en cours...');

            const file = data.get('fileinput');
            if (!file || file.size === 0) {
                await AppManagers.CodexManager.show('error', 'Veuillez sélectionner un fichier PDF.');
                return;
            }

            const arrayBuffer = await file.arrayBuffer();
            const fullText = await this.extraireTextePDF(arrayBuffer);

            AppManagers.log(this.key, 'info', 'Texte brut extrait');

            const produits = this.parserProduits(fullText);

            if (produits.length === 0) {
                await AppManagers.CodexManager.show('error', 'Aucun produit trouvé dans le PDF.');
                return;
            }

            const message = this.genererMessage(produits);
            this.afficherResultat(message, produits.length);

            await AppManagers.CodexManager.show('success', `${produits.length} produit(s) extrait(s)`);

        } catch (err) {
            AppManagers.log(this.key, 'error', 'Erreur traitement PDF:', err);
            await AppManagers.CodexManager.show('error', `Erreur: ${err.message}`);
        }
    }

    async extraireTextePDF(arrayBuffer) {
        if (!getDocument) {
            throw new Error('PDF.js non disponible');
        }

        const pdf = await getDocument({ data: arrayBuffer }).promise;
        let fullText = '';

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            fullText += textContent.items.map(item => item.str).join(' ') + '\n';
        }

        return fullText;
    }

    /**
     * Parse les produits en utilisant une logique de remontée par la fin du bloc
     * @param {string} fullText
     * @returns {Array<Object>}
     */
    parserProduits(fullText) {
        const produits = [];

        // 1. Isolation de la zone pertinente [cite: 6, 7]
        const debutTableau = "Réception par";
        const finTableau = "Date de livraison";

        const indexDebut = fullText.indexOf(debutTableau);
        const indexFin = fullText.indexOf(finTableau);

        if (indexDebut === -1) return [];

        let zoneUtile = indexFin !== -1
            ? fullText.substring(indexDebut + debutTableau.length, indexFin)
            : fullText.substring(indexDebut + debutTableau.length);

        // 2. Découpage en blocs par Code Produit (13 chiffres) 
        // On utilise un split qui conserve le délimiteur (le code EAN)
        const blocs = zoneUtile.split(/(?=\d{13})/g);

        blocs.forEach(bloc => {
            const contenu = bloc.trim().replace(/\s+/g, ' ');
            if (!contenu) return;

            // Extraction du code EAN (les 13 premiers caractères) 
            const code = contenu.substring(0, 13);
            const reste = contenu.substring(13).trim();

            // 3. Logique d'algorithme inversé :
            // Les colonnes de droite sont : [Qté cdée] [Qté reçue] [UG cdée] [UG reçue] [PA Net] [Dus]
            // Nous cherchons le bloc numérique final qui contient ces données.
            // On cherche le prix (nombre avec virgule) comme point d'ancrage. 
            const parties = reste.split(' ');

            // On remonte depuis la fin pour trouver les colonnes stables 
            // Index de fin vers début :
            // [PA Net est souvent à l'indice length - 2]
            // [Dus est à l'indice length - 1]

            let indexPrix = -1;
            for (let i = parties.length - 1; i >= 0; i--) {
                if (parties[i].includes(',')) { // Le prix contient une virgule 
                    indexPrix = i;
                    break;
                }
            }

            if (indexPrix !== -1 && indexPrix >= 4) {
                // Selon votre analyse des colonnes :
                // indexPrix est PA Net 
                // indexPrix - 1 est UG reçue (0) 
                // indexPrix - 2 est UG cdée (0) 
                // indexPrix - 3 est Qté reçue (0) 
                // indexPrix - 4 est la fameuse Qté cdée ! 

                const quantite = parseInt(parties[indexPrix - 4]);

                // La dénomination est tout ce qui se trouve entre le code et la Qté cdée
                const denomination = parties.slice(0, indexPrix - 4).join(' ').trim();

                if (code.length === 13 && !isNaN(quantite)) {
                    produits.push({ code, designation: denomination, quantite });
                }
            }
        });

        return produits;
    }

    /**
     * Génère le message avec padding des quantités
     * @param {Array<Object>} produits
     * @returns {string}
     */
    genererMessage(produits) {
        // Trouve le max de chiffres pour le padding
        const maxQte = Math.max(...produits.map(p => p.quantite));
        const nbChiffres = maxQte.toString().length;

        const lignes = [
            'Bonjour, voici le détail de la commande',
            '',
            `Code Produit  | Qté : ${"".toString().padStart(nbChiffres, 'X')} | Désignation`,
            ...produits.map(p => {
                const qtePadded = p.quantite.toString().padStart(nbChiffres, '0');
                return `${p.code} | qté : ${qtePadded} | ${p.designation}`;
            }),
            '',
            'En vous remerciant,'
        ];

        return lignes.join('\n');
    }

    /**
     * Affiche le résultat
     * @param {string} message
     * @param {number} nbProduits
     */
    afficherResultat(message, nbProduits) {
        const resultDiv = document.getElementById('uberml-result');
        const textarea = this.getElement('uberml-output');
        const compteur = this.getElement('uberml-count');

        if (textarea) {
            textarea.value = message;
            textarea.rows = nbProduits + 6; // Ajuste la hauteur
        }

        if (compteur) {
            compteur.textContent = `${nbProduits} produit(s) extrait(s)`;
        }

        // ✅ CORRECTION : Affiche la div de résultat
        if (resultDiv) {
            resultDiv.style.display = 'block';
        }

        textarea?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

new UberMLHandler().register();
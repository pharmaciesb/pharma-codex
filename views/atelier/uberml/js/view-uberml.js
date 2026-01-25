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
        
        // 1. Isolation de la zone pertinente
        const debutTableau = "Réception par";
        const finTableau = "Date de livraison";
        const indexDebut = fullText.indexOf(debutTableau);
        const indexFin = fullText.indexOf(finTableau);
        
        if (indexDebut === -1) {
            AppManagers.log(this.key, 'warn', 'Zone tableau non trouvée');
            return [];
        }
        
        let zoneUtile = indexFin !== -1
            ? fullText.substring(indexDebut + debutTableau.length, indexFin)
            : fullText.substring(indexDebut + debutTableau.length);
        
        // ✅ NOUVEAU : Nettoie les en-têtes de pages répétés
        zoneUtile = zoneUtile.replace(/MARSEILLE, le.*?Réception par/gs, '');
        zoneUtile = zoneUtile.replace(/Page\s+\d+\s*\/\s*\d+/g, '');
        
        // 2. Découpage en blocs par Code Produit (13 chiffres)
        const blocs = zoneUtile.split(/(?=\d{13})/g);
        
        blocs.forEach((bloc, index) => {
            const contenu = bloc.trim().replace(/\s+/g, ' ');
            if (!contenu || contenu.length < 13) return;
            
            // Extraction du code EAN
            const code = contenu.substring(0, 13);
            
            // ✅ Vérification que c'est bien un code valide (que des chiffres)
            if (!/^\d{13}$/.test(code)) {
                AppManagers.log(this.key, 'warn', `Code invalide (bloc ${index}): ${code}`);
                return;
            }
            
            const reste = contenu.substring(13).trim();
            const parties = reste.split(' ');
            
            // 3. Cherche le prix (PA Net) depuis la fin
            let indexPrix = -1;
            
            for (let i = parties.length - 1; i >= 0; i--) {
                if (parties[i].match(/^\d+[,\.]\d+$/)) {
                    indexPrix = i;
                    break;
                }
            }
            
            // ✅ Validation stricte des colonnes
            if (indexPrix !== -1 && indexPrix >= 5) {
                const indexPANet = parties.length - 2;
                
                // ✅ Vérifie que PA Net est bien un prix
                if (!parties[indexPANet].match(/^\d+[,\.]\d+$/)) {
                    AppManagers.log(this.key, 'warn', `Prix invalide pour ${code}: ${parties[indexPANet]}`);
                    return;
                }
                
                // La Qté cdée est 5 positions avant la fin
                const indexQteCdee = parties.length - 6;
                
                if (indexQteCdee < 0) {
                    AppManagers.log(this.key, 'warn', `Index Qté cdée invalide pour ${code}`);
                    return;
                }
                
                const quantite = parseInt(parties[indexQteCdee]);
                
                // ✅ Vérifie que c'est bien un nombre
                if (isNaN(quantite)) {
                    AppManagers.log(this.key, 'warn', `Qté invalide pour ${code}: ${parties[indexQteCdee]}`);
                    return;
                }
                
                // La dénomination est tout avant la Qté cdée
                const denomination = parties.slice(0, indexQteCdee).join(' ').trim();
                
                if (denomination && quantite > 0) {
                    produits.push({ code, designation: denomination, quantite });
                    AppManagers.log(this.key, 'info', `✓ ${code} | qté: ${quantite} | ${denomination.substring(0, 30)}...`);
                } else if (denomination && quantite === 0) {
                    AppManagers.log(this.key, 'warn', `Produit ignoré (qté=0): ${code} - ${denomination.substring(0, 30)}`);
                }
            } else {
                AppManagers.log(this.key, 'warn', `Structure invalide pour: ${code} (indexPrix=${indexPrix}, parties=${parties.length})`);
            }
        });
        
        AppManagers.log(this.key, 'success', `${produits.length} produit(s) valide(s) extrait(s)`);
        return produits;
    }
    
    /**
     * Génère le message avec padding des quantités
     * @param {Array<Object>} produits
     * @returns {string}
     */
    genererMessage(produits) {
        if (produits.length === 0) return 'Aucun produit extrait.';
        
        // Trouve le max de chiffres pour le padding
        const maxQte = Math.max(...produits.map(p => p.quantite));
        const nbChiffres = maxQte.toString().length;
        
        // Placeholder pour l'en-tête
        const placeholder = 'X'.repeat(nbChiffres);
        
        const lignes = [
            'Bonjour, voici le détail de la commande',
            '',
            `Code Produit  | Qté : ${placeholder} | Désignation`,
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
        }
        
        if (compteur) {
            compteur.textContent = `${nbProduits} produit(s) extrait(s)`;
            textarea.rows = 5+ nbProduits;
        }
        
        // ✅ CORRECTION : Affiche la div de résultat
        if (resultDiv) {
            resultDiv.style.display = 'block';
        }
        
        textarea?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

new UberMLHandler().register();
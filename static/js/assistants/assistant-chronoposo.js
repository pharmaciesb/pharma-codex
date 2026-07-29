/**
 * Assistant Chronoposo v3 - Zone fixe uniquement
 * Approche simple: couvrir les 60 pixels du bas et ajouter le nouveau texte
 */

class ChronoposoAssistant {
  /**
   * Modifier les dates du PDF (production + pilulier)
   * @param {PDFDocument} pdfDoc - Document PDF chargé
   * @param {Uint8Array} pdfBytes - Bytes du PDF (non utilisés pour v3 simple)
   * @param {string|null} dateProduction - Date de production (DD/MM/YYYY) ou null
   * @param {string} dateDebut - Date de début pilulier (DD/MM/YYYY)
   * @param {string} dateFin - Date de fin pilulier (DD/MM/YYYY)
   * @returns {Promise<PDFDocument>}
   */
  static async modifyDates(pdfDoc, pdfBytes, dateProduction, dateDebut, dateFin) {
    try {
      const { rgb } = PDFLib;
      const pages = pdfDoc.getPages();
      const font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
      console.log(`🔄 Modification de ${pages.length} page(s)`);

      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const pageHeight = page.getHeight();
        const pageWidth = page.getWidth();

        console.log(`📄 Page ${i + 1}: ${pageWidth} x ${pageHeight}`);

        // ===== ZONE BAS: Pilulier commencant/finissant =====

        // Rectangle blanc en bas
        page.drawRectangle({
          x: 30,
          y: 26,
          width: 180,
          height: 30,
          color: rgb(1, 1, 1), // Blanc pur
          opacity: 1,
        });

        console.log(`✅ Rectangle blanc bas ajouté`);

        // Textes en bas
        const fontSize = 8;

        const text1 = `PILLULIER COMMENCANT LE ${dateDebut}`;
        const textWidth1 = font.widthOfTextAtSize(text1, fontSize);
        page.drawText(text1, {
          x: 30 + 180 - textWidth1 - 4, // Aligné à droite dans le rectangle
          y: 40,
          font: font,
          size: 8,
          color: rgb(0, 0, 0),
        });
        console.log(`✍️  ${text1}`);

        const text2 = `PILLULIER FINISSANT LE ${dateFin}`;
        const textWidth2 = font.widthOfTextAtSize(text2, fontSize);
        page.drawText(text2, {
          x: 30 + 180 - textWidth2 - 4, // Aligné à droite dans le rectangle
          y: 32,
          font: font,
          size: 8,
          color: rgb(0, 0, 0),
        });
        console.log(`✍️  ${text2}`);

        // ===== ZONE HAUT DROIT: Date de production (optionnel) =====
        if (dateProduction) {          
          // Rectangle blanc en haut à droite
          page.drawRectangle({
            x: 490,
            y: pageHeight - 120,
            width: 70,
            height: 14,
            color: rgb(1, 1, 1), // Blanc pur
            opacity: 1,
          });

          console.log(`✅ Rectangle blanc haut-droit ajouté`);

          // Texte en haut à droite
          const textProduction = `${dateProduction}`;
          page.drawText(textProduction, {
            x: 490 + 5,
            y: pageHeight - 120 + 4,
            size: 10,
            color: rgb(0, 0, 0),
          });

          console.log(`✍️  ${textProduction}`);
        }
      }

      console.log(`✅ Modification terminée`);
      return pdfDoc;
    } catch (error) {
      console.error('❌ Erreur lors de la modification:', error);
      throw error;
    }
  }

  /**
   * Valider les dates
   */
  static validateDates(dateDebut, dateFin) {
    const regex = /^\d{2}\/\d{2}\/\d{4}$/;

    if (!regex.test(dateDebut)) {
      throw new Error('Format date début invalide (attendu: JJ/MM/AAAA)');
    }

    if (!regex.test(dateFin)) {
      throw new Error('Format date fin invalide (attendu: JJ/MM/AAAA)');
    }

    // Convertir en Date pour comparaison
    const [jDebut, mDebut, aDebut] = dateDebut.split('/');
    const [jFin, mFin, aFin] = dateFin.split('/');

    const debut = new Date(parseInt(aDebut), parseInt(mDebut) - 1, parseInt(jDebut));
    const fin = new Date(parseInt(aFin), parseInt(mFin) - 1, parseInt(jFin));

    if (fin < debut) {
      throw new Error('La date de fin doit être après la date de début');
    }
  }
}

export { ChronoposoAssistant };

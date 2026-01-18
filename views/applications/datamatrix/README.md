# 🧩 Module Datamatrix – Documentation Développeur

## 🎯 Objectif
Ce module permet de **générer et imprimer des codes GS1 Datamatrix** à partir d’un EAN13, d’un numéro de lot et d’une date limite d’utilisation (DLU).  
Les utilisateurs peuvent ensuite **exporter facilement le résultat en PDF** (format A4, prêt à imprimer).

---

## ⚙️ Structure
- **HTML View** : `views/applications/datamatrix/datamatrix.html`  
- **JS Logic** : `views/applications/datamatrix/js/view-datamatrix.js`  
- **Dépendances** :
  - `datamatrix.min.js` → génération SVG
  - `html2pdf.bundle.min.js` → export PDF
  - `AppManagers` → gestion du cycle de vie (DomloadManager / FormManager)

---

## 🧠 Cycle de vie du module
| Étape | Gestionnaire | Description |
|:------|:-------------|:------------|
| Chargement de la vue | `DomloadManager.registerHandler()` | Initialise la page, active le watcher sur le champ DLU et le bouton PDF |
| Soumission du formulaire | `FormManager.registerHandler()` | Calcule le code GS1, génère les Datamatrix, et affiche le résultat |
| Export PDF | `html2pdf()` | Capture la div `#datamatrix-output` et télécharge un PDF prêt à imprimer |

---

## 💡 Ajouter une fonctionnalité

### 1️⃣ Étendre le comportement d’affichage
```js
AppManagers.DomloadManager.registerHandler('vueDatamatrix', {
  methodeOnload: async () => {
    // Exemple : ajouter un écouteur de clic, une info-bulle, etc.
  }
});
```

### 2️⃣ Modifier la logique du formulaire
```js
AppManagers.FormManager.registerHandler('formDatamatrix', async (data, form, codex, manager) => {
  const ean = data.get('ean');
  // ... ton traitement
  AppManagers.CodexManager.show('success', 'Opération terminée');
});
```

📌 Types de messages :
- `success`
- `warning`
- `error`
- `info`

---

## 🧾 Génération du Datamatrix
```js
const svgNode = DATAMatrix({
  msg: "01" + ean + "17" + expiry + "10" + lot,
  dim: 38,
  pad: 0
});
container.appendChild(svgNode);
```

---

## 🖨️ Export PDF
Le bouton “📄 Télécharger en PDF” déclenche :
```js
html2pdf().set({
  margin: 10,
  filename: 'datamatrix.pdf',
  html2canvas: { scale: 2 },
  jsPDF: { unit: 'mm', format: 'a4' }
}).from(outputDiv).save();
```

✅ Le bouton est temporairement désactivé pendant la génération pour éviter plusieurs téléchargements simultanés.

---

## 🧰 Debug
Active les logs :
```js
window.AppDebug = true;
```

Les logs apparaîtront dans la console :
```
[FormManager][success] Message ajouté: [success] Datamatrix généré avec succès
```

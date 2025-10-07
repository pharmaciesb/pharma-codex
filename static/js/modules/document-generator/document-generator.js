class DocumentGenerator {
  constructor(templateName, fields, formatters = {}) {
    this.templateName = templateName;
    this.fields = fields;
    this.formatters = formatters;
  }

  collectData() {
    const data = {};
    for (const [domId, key] of Object.entries(this.fields)) {
      const el = document.getElementById(domId);
      let value = el ? el.value + "" : "";

      // Si un formateur existe pour ce champ → on l’applique
      if (this.formatters[key]) {
        value = this.formatters[key](value);
      }

      data[key] = value;
    }
    return data;
  }

  preview(renderCallback) {
    const data = this.collectData();
    if (renderCallback) renderCallback(data);
  }

  async downloadDOCX(filename = null, extraData = null) {
    const data = extraData || this.collectData();

    const response = await fetch(`${window.BASE_URL}/static/templates/template-${this.templateName}.docx`);
    const buffer = await response.arrayBuffer();

    const zip = new PizZip(buffer);
    const doc = new window.docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
    doc.render(data);

    saveAs(doc.toBlob(), filename || `${this.templateName}.docx`);
  }

}
function formatDateFr(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("fr-FR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

function formatTimeFr(timeStr) {
  if (!timeStr) return "";
  return timeStr.replace(":", "h"); // ex: "14:30" → "14h30"
}
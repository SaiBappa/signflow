const { PDFDocument, degrees } = require('pdf-lib');
(async () => {
  const doc = await PDFDocument.create();
  const page = doc.addPage([500, 1000]);
  page.setRotation(degrees(90));
  console.log("getSize:", page.getSize());
  console.log("rotation:", page.getRotation().angle);
})();

import { PDFDocument, rgb, degrees } from 'pdf-lib';
import fs from 'fs';

async function run() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([200, 300]);
  
  // Set page rotation to 90
  page.setRotation(degrees(90));

  page.drawRectangle({
    x: 50, y: 150, width: 20, height: 20, color: rgb(1,0,0)
  });

  page.drawText("HELLO", {
    x: 50,
    y: 150,
    size: 20,
    rotate: degrees(0)
  });
  
  const b = await doc.save();
  fs.writeFileSync('test.pdf', b);
  console.log("Success");
}
run();

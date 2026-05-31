import fs from 'fs';
['src/components/Sidebar.tsx', 'src/components/DocumentViewer.tsx', 'src/App.tsx'].forEach(file => {
  if (fs.existsSync(file)) {
    const data = fs.readFileSync(file, 'utf8');
    const replaced = data.replace(/bg-blue-/g, 'bg-indigo-')
                        .replace(/text-blue-/g, 'text-indigo-')
                        .replace(/border-blue-/g, 'border-indigo-')
                        .replace(/accent-blue-/g, 'accent-indigo-')
                        .replace(/ring-blue-/g, 'ring-indigo-')
                        .replace(/shadow-blue-/g, 'shadow-indigo-')
                        .replace(/hover:bg-blue-/g, 'hover:bg-indigo-')
                        .replace(/hover:text-blue-/g, 'hover:text-indigo-')
                        .replace(/hover:border-blue-/g, 'hover:border-indigo-');
    fs.writeFileSync(file, replaced);
  }
});

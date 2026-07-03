const fs = require('fs');
const path = require('path');

const HTML_FILES = ['index.html', 'portfolio.html'];
const ROOT_DIR = __dirname;

const FOLDER_MAP = {
  'Client showcase logos': 'assets/images/logos',
  'Tata Motors': 'assets/images/projects/tata-motors',
  'cloudspillar': 'assets/images/projects/cloudspillar',
  'noorel': 'assets/images/projects/noorel',
  'outservee': 'assets/images/projects/outservee',
  'simranbuildzone': 'assets/images/projects/simranbuildzone',
  'thedgsolution': 'assets/images/projects/thedgsolution'
};

function copyUsedImagesAndUpdateHTML() {
  let usedImagesCount = 0;
  
  console.log("🧹 Starting Image Cleanup & Reorganization...\n");

  // 1. Ensure new directories exist
  for (const newPath of Object.values(FOLDER_MAP)) {
    const fullNewPath = path.join(ROOT_DIR, newPath);
    if (!fs.existsSync(fullNewPath)) {
      fs.mkdirSync(fullNewPath, { recursive: true });
    }
  }

  // 2. Process HTML files
  for (const htmlFile of HTML_FILES) {
    const htmlPath = path.join(ROOT_DIR, htmlFile);
    if (!fs.existsSync(htmlPath)) continue;

    let content = fs.readFileSync(htmlPath, 'utf8');
    
    // Find all src="old/path.ext"
    const regex = /src=["']([^"']+\.(png|jpg|jpeg|webp))["']/gi;
    let matches;
    let newContent = content;

    const uniqueReplacements = new Map(); // oldSrc -> newSrc

    while ((matches = regex.exec(content)) !== null) {
      const oldSrc = matches[1]; 
      
      const parts = oldSrc.split('/');
      if (parts.length >= 2) {
        const oldDir = parts[0];
        const filename = parts[parts.length - 1];
        
        if (FOLDER_MAP[oldDir]) {
          const newDir = FOLDER_MAP[oldDir];
          const newSrc = `${newDir}/${filename}`;
          
          if (!uniqueReplacements.has(oldSrc)) {
            uniqueReplacements.set(oldSrc, newSrc);
            
            // Move file
            const oldFilePath = path.join(ROOT_DIR, ...parts);
            const newFilePath = path.join(ROOT_DIR, ...newDir.split('/'), filename);
            
            if (fs.existsSync(oldFilePath)) {
              if (!fs.existsSync(newFilePath)) {
                fs.copyFileSync(oldFilePath, newFilePath);
              }
              usedImagesCount++;
            } else {
              console.warn(`⚠️ Warning: Image found in HTML but missing on disk: ${oldSrc}`);
            }
          }
        }
      }
    }

    // Apply HTML string replacements
    for (const [oldSrc, newSrc] of uniqueReplacements.entries()) {
      newContent = newContent.split(`src="${oldSrc}"`).join(`src="${newSrc}"`);
      newContent = newContent.split(`src='${oldSrc}'`).join(`src='${newSrc}'`);
    }

    // Write HTML back
    fs.writeFileSync(htmlPath, newContent, 'utf8');
    console.log(`✅ Updated HTML paths in ${htmlFile}`);
  }

  // 3. Delete old folders
  console.log(`\n🗑️ Deleting old folders and unused images...`);
  for (const oldDir of Object.keys(FOLDER_MAP)) {
    const fullOldPath = path.join(ROOT_DIR, oldDir);
    if (fs.existsSync(fullOldPath)) {
      fs.rmSync(fullOldPath, { recursive: true, force: true });
      console.log(`✅ Deleted folder: ${oldDir}/`);
    }
  }

  console.log(`\n🎉 Cleanup Complete!`);
  console.log(`Retained ${usedImagesCount} active images in 'assets/images/'.`);
  console.log(`Permanently removed all unused screenshots, backups, and old assets.`);
}

copyUsedImagesAndUpdateHTML();

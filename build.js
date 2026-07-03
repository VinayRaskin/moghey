const fs = require('fs');
const path = require('path');
const sharp = require('sharp'); // already installed in package.json

const ROOT_DIR = __dirname;
const HTML_FILES = ['index.html', 'portfolio.html'];

const DIRS_TO_CREATE = [
  'assets/images',
  'assets/css',
  'assets/js',
  'assets/fonts',
  'assets/icons'
];

function minifyCSS(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([\{\}\:\;\,\>])\s*/g, '$1')
    .replace(/;}/g, '}');
}

function minifyJS(js) {
  return js
    .replace(/\/\/.*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([\{\}\:\;\,\=\(\)\.\+\-\*\/])\s*/g, '$1')
    .trim();
}

function minifyHTML(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\n\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/>\s+</g, '><')
    .trim();
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function runBuild() {
  console.log("🚀 Starting Website Optimization Build...");

  // 1. Create Directories
  for (const dir of DIRS_TO_CREATE) {
    const fullPath = path.join(ROOT_DIR, dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
  }

  // 2. Process Images in the Root Directory (or any remaining in FOLDER_MAP if they somehow exist)
  const allImages = [];
  const rootFiles = fs.readdirSync(ROOT_DIR);
  
  for (const file of rootFiles) {
    const ext = path.extname(file).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
      allImages.push({
        name: file,
        fullPath: path.join(ROOT_DIR, file)
      });
    }
  }

  // We should also check if the user accidentally moved them to assets/images already and we are re-running
  if (fs.existsSync(path.join(ROOT_DIR, 'assets/images'))) {
    const assetFiles = fs.readdirSync(path.join(ROOT_DIR, 'assets/images'));
    for (const file of assetFiles) {
      const ext = path.extname(file).toLowerCase();
      if (['.jpg', '.jpeg', '.png'].includes(ext)) {
        allImages.push({
          name: file,
          fullPath: path.join(ROOT_DIR, 'assets/images', file)
        });
      }
    }
  }

  let totalSaved = 0;
  const fileNameMap = new Map(); // originalFileName -> new relative path

  for (const img of allImages) {
    const file = img.name;
    const ext = path.extname(file).toLowerCase();
    const inputPath = img.fullPath;
    
    let cleanName = file.toLowerCase()
                        .replace(/[^a-z0-9.]/g, '-')
                        .replace(/-+/g, '-');
                        
    let outputName = cleanName;
    let isWebp = ext === '.webp';
    if (!isWebp) {
      outputName = cleanName.replace(new RegExp(`${ext}$`, 'i'), '.webp');
    }

    const newSrc = `assets/images/${outputName}`;
    fileNameMap.set(file, newSrc);
    // Support URL encoded filename matching too
    fileNameMap.set(encodeURI(file), newSrc);

    const outputPath = path.join(ROOT_DIR, 'assets/images', outputName);
    
    // Only convert if it doesn't exist
    if (!fs.existsSync(outputPath)) {
      try {
        if (!isWebp) {
          let processor = sharp(inputPath);
          const metadata = await processor.metadata();
          if (metadata.width > 2000) {
            processor = processor.resize({ width: 2000, withoutEnlargement: true });
          }
          await processor.webp({ quality: 80, effort: 6 }).toFile(outputPath);
          console.log(`✅ Converted -> ${newSrc}`);
        } else {
          fs.copyFileSync(inputPath, outputPath);
          console.log(`✅ Copied -> ${newSrc}`);
        }
      } catch (err) {
        console.error(`❌ Failed to process ${file}:`, err.message);
      }
    }
  }

  // 3. Process HTML, CSS, JS
  for (const file of HTML_FILES) {
    const htmlPath = path.join(ROOT_DIR, file);
    if (!fs.existsSync(htmlPath)) continue;

    let content = fs.readFileSync(htmlPath, 'utf8');

    // a) Replace image paths using regex matching the filename
    for (const [originalName, newSrc] of fileNameMap.entries()) {
      // Matches src="<anything>/originalName" or src="originalName"
      const regex = new RegExp(`src="[^"]*?${escapeRegExp(originalName)}"`, 'gi');
      content = content.replace(regex, `src="${newSrc}"`);
      
      const regexSingle = new RegExp(`src='[^']*?${escapeRegExp(originalName)}'`, 'gi');
      content = content.replace(regexSingle, `src='${newSrc}'`);
    }

    // Add lazy loading and decoding
    content = content.replace(/<img(?!.*loading="lazy")([^>]*)>/gi, '<img loading="lazy" decoding="async"$1>');
    content = content.replace(/<img(?!.*decoding="async")([^>]*)>/gi, '<img decoding="async"$1>');

    const name = file.replace('.html', '');

    // b) Extract CSS
    const styleRegex = /<style>([\s\S]*?)<\/style>/i;
    const styleMatch = content.match(styleRegex);
    if (styleMatch) {
      const cssContent = styleMatch[1];
      const minifiedCss = minifyCSS(cssContent);
      const cssPath = `assets/css/${name}.css`;
      fs.writeFileSync(path.join(ROOT_DIR, cssPath), minifiedCss);
      content = content.replace(styleRegex, `<link rel="stylesheet" href="${cssPath}">`);
      console.log(`✅ Extracted and minified CSS to ${cssPath}`);
    }

    // c) Extract JS
    const scriptRegex = /<script>([\s\S]*?)<\/script>/i;
    const scriptMatch = content.match(scriptRegex);
    if (scriptMatch) {
      const jsContent = scriptMatch[1];
      const minifiedJs = minifyJS(jsContent);
      const jsPath = `assets/js/${name}.js`;
      fs.writeFileSync(path.join(ROOT_DIR, jsPath), minifiedJs);
      content = content.replace(scriptRegex, `<script src="${jsPath}"></script>`);
      console.log(`✅ Extracted and minified JS to ${jsPath}`);
    }

    // d) Minify HTML
    const minifiedHtml = minifyHTML(content);
    fs.writeFileSync(htmlPath, minifiedHtml, 'utf8');
    console.log(`✅ Minified and updated HTML in ${file}`);
  }

  // 4. Cleanup old files
  const filesToDelete = ['cleanup.js', 'optimize.js'];
  for (const f of filesToDelete) {
    if (fs.existsSync(path.join(ROOT_DIR, f))) {
      fs.rmSync(path.join(ROOT_DIR, f));
      console.log(`🗑️ Deleted old script: ${f}`);
    }
  }

  // Clean up original root images since they are safely in assets/images
  for (const img of allImages) {
    if (img.fullPath.includes('assets')) continue; // don't delete if it's already in assets
    try {
      if (fs.existsSync(img.fullPath)) {
        fs.unlinkSync(img.fullPath);
        console.log(`🗑️ Removed original image: ${img.name}`);
      }
    } catch(e) {}
  }

  console.log("🎉 Website Optimization & Restructuring Complete!");
}

runBuild();

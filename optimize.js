const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const DIRECTORIES_TO_SCAN = [
  'Client showcase logos',
  'Tata Motors',
  'cloudspillar',
  'noorel',
  'outservee',
  'simranbuildzone',
  'thedgsolution'
];

const HTML_FILES = ['index.html', 'portfolio.html'];
const ROOT_DIR = __dirname;

async function optimizeImages() {
  let totalSaved = 0;
  let count = 0;

  console.log("🚀 Starting Image Optimization & WebP Conversion...");

  for (const dir of DIRECTORIES_TO_SCAN) {
    const fullPath = path.join(ROOT_DIR, dir);
    if (!fs.existsSync(fullPath)) continue;

    const files = fs.readdirSync(fullPath);

    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (!['.jpg', '.jpeg', '.png'].includes(ext)) continue;

      const inputPath = path.join(fullPath, file);
      const outputName = file.replace(new RegExp(`${ext}$`), '.webp');
      const outputPath = path.join(fullPath, outputName);

      // Skip if webp already exists
      if (fs.existsSync(outputPath)) {
         console.log(`⏩ Skipped (already exists): ${outputName}`);
         continue;
      }

      try {
        const statsBefore = fs.statSync(inputPath);
        console.log(`Processing: ${file}...`);
        
        let processor = sharp(inputPath);
        const metadata = await processor.metadata();

        if (metadata.width > 2000) {
          processor = processor.resize({ width: 2000, withoutEnlargement: true });
        }

        await processor
          .webp({ quality: 80, effort: 6 })
          .toFile(outputPath);

        const statsAfter = fs.statSync(outputPath);
        const savedMb = ((statsBefore.size - statsAfter.size) / (1024 * 1024)).toFixed(2);
        
        console.log(`✅ Converted -> ${outputName} (Saved ${savedMb} MB)`);
        totalSaved += (statsBefore.size - statsAfter.size);
        count++;
        
      } catch (err) {
        console.error(`❌ Failed to process ${file}:`, err.message);
      }
    }
  }

  console.log(`\n🎉 Image Optimization Complete! (Optimized ${count} images, Saved ${(totalSaved / (1024 * 1024)).toFixed(2)} MB)`);
  
  console.log(`\n📄 Updating HTML files to use WebP...`);
  for (const htmlFile of HTML_FILES) {
    const htmlPath = path.join(ROOT_DIR, htmlFile);
    if (fs.existsSync(htmlPath)) {
      let content = fs.readFileSync(htmlPath, 'utf8');
      
      // Replace .png, .jpg, .jpeg with .webp in src attributes
      const originalLength = content.length;
      content = content.replace(/src="([^"]+)\.(png|jpg|jpeg)"/gi, 'src="$1.webp"');
      
      // Ensure loading="lazy" and decoding="async" on all images that don't already have it
      content = content.replace(/<img(?!.*loading="lazy")([^>]*)>/gi, '<img loading="lazy" decoding="async"$1>');
      content = content.replace(/<img(?!.*decoding="async")([^>]*)>/gi, '<img decoding="async"$1>');

      fs.writeFileSync(htmlPath, content, 'utf8');
      console.log(`✅ Updated ${htmlFile}`);
    }
  }
  
  console.log(`\n✨ All done! Your website is now fully optimized for performance.`);
}

optimizeImages();

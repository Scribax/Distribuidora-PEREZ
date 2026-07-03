// Genera los PNG de la PWA a partir de public/icon-source.svg.
// Uso: node scripts/generate-icons.mjs   (requiere `sharp`)
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pub = path.resolve(__dirname, "../public");
const src = path.join(pub, "icon-source.svg");

const targets = [
  { file: "pwa-192.png", size: 192 },
  { file: "pwa-512.png", size: 512 },
  { file: "maskable-512.png", size: 512 },
  { file: "apple-touch-icon.png", size: 180 }
];

for (const { file, size } of targets) {
  await sharp(src, { density: 384 })
    .resize(size, size, { fit: "cover" })
    .png()
    .toFile(path.join(pub, file));
  console.log(`✓ ${file} (${size}x${size})`);
}
console.log("Íconos generados en public/");

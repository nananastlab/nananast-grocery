// Run once: node generate-icons.cjs
// Requires: npm install canvas (optional) — or just replace public/icon-192.png and icon-512.png manually

const fs = require('fs')
const path = require('path')

// Create a simple SVG icon and save as data
const svgIcon = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="#16a34a"/>
  <text x="50%" y="55%" font-size="${size * 0.55}" text-anchor="middle" dominant-baseline="middle">🥦</text>
</svg>`

const publicDir = path.join(__dirname, 'public')
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir)

fs.writeFileSync(path.join(publicDir, 'icon-192.svg'), svgIcon(192))
fs.writeFileSync(path.join(publicDir, 'icon-512.svg'), svgIcon(512))

// Minimal valid 1x1 transparent PNG fallback (vite-plugin-pwa won't crash with svg either)
// For production, convert SVGs to PNGs manually or use a tool like sharp/Inkscape
console.log('SVG icons written to public/. For PNG, convert them or replace with your own icons.')
console.log('Tip: use https://realfavicongenerator.net or Inkscape to convert SVG -> PNG')

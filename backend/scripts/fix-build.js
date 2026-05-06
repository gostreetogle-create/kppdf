const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'dist', 'backend', 'src', 'app.js');
const dst = path.join(__dirname, '..', 'dist', 'app.js');

if (fs.existsSync(src)) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  console.log('✅ Copied app.js to dist/app.js');
} else {
  console.log('⚠️  dist/backend/src/app.js not found, skipping copy');
}

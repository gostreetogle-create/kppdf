const fs = require('fs');
const path = require('path');

const compiledEntry = path.join(__dirname, '..', 'dist', 'backend', 'src', 'app.js');
const launcherPath = path.join(__dirname, '..', 'dist', 'app.js');

if (fs.existsSync(compiledEntry)) {
  fs.mkdirSync(path.dirname(launcherPath), { recursive: true });
  fs.writeFileSync(
    launcherPath,
    `'use strict';\nrequire('./backend/src/app.js');\n`,
    'utf8'
  );
  console.log('✅ Created dist/app.js launcher -> dist/backend/src/app.js');
} else {
  console.log('⚠️  dist/backend/src/app.js not found, skipping launcher creation');
}

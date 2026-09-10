const fs = require('fs');
const path = require('path');
const archiverModule = require('archiver');

// Robust check for the archiver constructor
const archiver = (typeof archiverModule === 'function')
  ? archiverModule
  : (archiverModule.default || archiverModule);

const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

const targetZip = path.join(publicDir, 'frigate-guardian-project.zip');
const output = fs.createWriteStream(targetZip);

try {
  const archive = archiver('zip', { zlib: { level: 9 } });

  output.on('close', () => {
    console.log(`[ZIP BUILDER] Successfully built frigate-guardian-project.zip (${(archive.pointer() / 1024).toFixed(1)} KB)`);
  });

  archive.on('error', (err) => {
    console.error('[ZIP BUILDER ERROR]', err);
  });

  archive.pipe(output);

  archive.glob('**/*', {
    cwd: rootDir,
    ignore: [
      'node_modules/**',
      'dist/**',
      '.git/**',
      'public/frigate-guardian-project.zip',
      '*.zip',
    ],
    dot: true,
  });

  archive.finalize();
} catch (e) {
  console.warn('[ZIP BUILDER] Skipping zip creation due to archiver error:', e.message);
  // Don't crash the whole build if just the zip fails
}

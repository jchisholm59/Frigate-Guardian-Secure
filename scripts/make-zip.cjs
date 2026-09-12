const fs = require('fs');
const path = require('path');
const { ZipArchive } = require('archiver');

const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

const targetZip = path.join(publicDir, 'watchtower-project.zip');
const output = fs.createWriteStream(targetZip);
const archive = new ZipArchive({ zlib: { level: 9 } });

output.on('close', () => {
  console.log(`[ZIP BUILDER] Successfully built watchtower-project.zip (${(archive.pointer() / 1024).toFixed(1)} KB)`);
});

archive.on('error', (err) => {
  console.error('[ZIP BUILDER ERROR]', err);
  process.exit(1);
});

archive.pipe(output);

archive.glob('**/*', {
  cwd: rootDir,
  ignore: [
    'node_modules/**',
    'dist/**',
    '.git/**',
    'public/watchtower-project.zip',
    '*.zip',
    // Real credentials (Gmail SMTP password, Slack/Discord webhook URLs,
    // Gemini/OpenSky API keys) live in these — must never end up in a zip
    // that anyone hitting the (unauthenticated) web UI can download.
    // .env.example is a template with no real values, so it's fine to keep.
    '.env',
    '.env.local',
    '.env.production',
    '.env.development',
    'guardian.env',
  ],
  dot: true,
});

archive.finalize();

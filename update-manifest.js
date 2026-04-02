const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const GITHUB_USER = 'Lyrinalin';
const GITHUB_REPO = 'sborka-mods';
const GITHUB_BRANCH = 'main';
const BASE_URL = `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/${GITHUB_BRANCH}/mods`;

const MODS_DIR = path.join(__dirname, 'mods');
const OUTPUT_FILE = path.join(__dirname, 'manifest.json');

function hashFile(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);
        stream.on('data', (data) => hash.update(data));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', reject);
    });
}

async function main() {
    console.log('🔍 Сканирование папки mods/...\n');

    if (!fs.existsSync(MODS_DIR)) {
        console.error('❌ Папка mods/ не найдена!');
        process.exit(1);
    }

    const files = fs.readdirSync(MODS_DIR).filter(f => f.endsWith('.jar'));

    if (files.length === 0) {
        console.error('❌ В папке mods/ нет .jar файлов!');
        process.exit(1);
    }

    const manifest = {
        version: new Date().toISOString(),
        generatedAt: new Date().toISOString(),
        totalFiles: 0,
        totalSize: 0,
        files: {}
    };

    for (const file of files) {
        const filePath = path.join(MODS_DIR, file);
        const stats = fs.statSync(filePath);
        const hash = await hashFile(filePath);

        manifest.files[file] = {
            hash: hash,
            size: stats.size,
            url: `${BASE_URL}/${encodeURIComponent(file)}`
        };

        manifest.totalFiles++;
        manifest.totalSize += stats.size;

        const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
        console.log(`  ✅ ${file} (${sizeMB} МБ)`);
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(manifest, null, 2), 'utf-8');

    console.log(`\n📦 Файлов: ${manifest.totalFiles}`);
    console.log(`📏 Общий размер: ${(manifest.totalSize / 1024 / 1024).toFixed(2)} МБ`);
    console.log(`💾 Манифест сохранён: ${OUTPUT_FILE}`);
    console.log(`\n🚀 Теперь сделай:`);
    console.log(`   git add .`);
    console.log(`   git commit -m "Обновление модов"`);
    console.log(`   git push`);
}

main().catch(err => {
    console.error('❌ Ошибка:', err.message);
    process.exit(1);
});

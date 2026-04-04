const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const GITHUB_USER = 'Lyrinalin';
const GITHUB_REPO = 'sborka-mods';
const GITHUB_BRANCH = 'main';

// Клиентские моды (отображаются в лаунчере, можно вкл/выкл)
const MODS_DIR = path.join(__dirname, 'mods');
const MODS_BASE_URL = `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/${GITHUB_BRANCH}/mods`;
const MODS_MANIFEST = path.join(__dirname, 'manifest.json');

// Серверные моды (скачиваются автоматически, НЕ отображаются в лаунчере)
const SERVER_MODS_DIR = path.join(__dirname, 'server-mods');
const SERVER_MODS_BASE_URL = `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/${GITHUB_BRANCH}/server-mods`;
const SERVER_MODS_MANIFEST = path.join(__dirname, 'server-manifest.json');

// Стикер-паки (синхронизируются в config/stickerchat/packs/)
const STICKER_PACKS_DIR = path.join(__dirname, 'sticker-packs');
const STICKER_PACKS_BASE_URL = `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/${GITHUB_BRANCH}/sticker-packs`;
const STICKER_MANIFEST = path.join(__dirname, 'sticker-manifest.json');

function hashFile(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);
        stream.on('data', (data) => hash.update(data));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', reject);
    });
}

async function buildManifest(dir, baseUrl, outputPath, label) {
    console.log(`\n🔍 Сканирование ${label}...`);

    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`  📁 Папка создана: ${dir}`);
    }

    const files = fs.readdirSync(dir).filter(f => f.endsWith('.jar') || f.endsWith('.zip'));

    const manifest = {
        version: new Date().toISOString(),
        generatedAt: new Date().toISOString(),
        totalFiles: 0,
        totalSize: 0,
        files: {}
    };

    if (files.length === 0) {
        console.log(`  ⚠ Нет файлов в ${label}`);
    }

    for (const file of files) {
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);
        const hash = await hashFile(filePath);

        manifest.files[file] = {
            hash: hash,
            size: stats.size,
            url: `${baseUrl}/${encodeURIComponent(file)}`
        };

        manifest.totalFiles++;
        manifest.totalSize += stats.size;

        const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
        console.log(`  ✅ ${file} (${sizeMB} МБ)`);
    }

    fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2), 'utf-8');

    console.log(`  📦 Файлов: ${manifest.totalFiles}`);
    console.log(`  📏 Размер: ${(manifest.totalSize / 1024 / 1024).toFixed(2)} МБ`);
    console.log(`  💾 Манифест: ${path.basename(outputPath)}`);

    return manifest;
}

/**
 * Сканирует стикер-паки рекурсивно: sticker-packs/packName/*.png + packs.json
 * Генерирует манифест с относительными путями (loh/1.png, packs.json)
 */
async function buildStickerManifest() {
    console.log(`\n🎨 Сканирование стикер-паков...`);

    if (!fs.existsSync(STICKER_PACKS_DIR)) {
        fs.mkdirSync(STICKER_PACKS_DIR, { recursive: true });
        console.log(`  📁 Папка создана: ${STICKER_PACKS_DIR}`);
        return;
    }

    const manifest = {
        version: new Date().toISOString(),
        generatedAt: new Date().toISOString(),
        totalFiles: 0,
        totalSize: 0,
        files: {}
    };

    // 1. Сканируем packs.json (метаданные паков)
    const packsJsonPath = path.join(STICKER_PACKS_DIR, 'packs.json');
    if (fs.existsSync(packsJsonPath)) {
        const stats = fs.statSync(packsJsonPath);
        const hash = await hashFile(packsJsonPath);
        manifest.files['packs.json'] = {
            hash,
            size: stats.size,
            url: `${STICKER_PACKS_BASE_URL}/packs.json`
        };
        manifest.totalFiles++;
        manifest.totalSize += stats.size;
        console.log(`  ✅ packs.json`);
    }

    // 2. Сканируем подпапки (каждая = пак)
    const entries = fs.readdirSync(STICKER_PACKS_DIR, { withFileTypes: true });
    for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const packName = entry.name;
        const packDir = path.join(STICKER_PACKS_DIR, packName);
        const pngFiles = fs.readdirSync(packDir).filter(f => f.toLowerCase().endsWith('.png'));

        if (pngFiles.length === 0) {
            console.log(`  ⚠ Пак '${packName}' пуст`);
            continue;
        }

        for (const png of pngFiles) {
            const filePath = path.join(packDir, png);
            const stats = fs.statSync(filePath);
            const hash = await hashFile(filePath);
            const relPath = `${packName}/${png}`;

            manifest.files[relPath] = {
                hash,
                size: stats.size,
                url: `${STICKER_PACKS_BASE_URL}/${packName}/${encodeURIComponent(png)}`
            };

            manifest.totalFiles++;
            manifest.totalSize += stats.size;
        }

        console.log(`  ✅ Пак '${packName}': ${pngFiles.length} стикеров`);
    }

    fs.writeFileSync(STICKER_MANIFEST, JSON.stringify(manifest, null, 2), 'utf-8');

    console.log(`  📦 Файлов: ${manifest.totalFiles}`);
    console.log(`  📏 Размер: ${(manifest.totalSize / 1024 / 1024).toFixed(2)} МБ`);
    console.log(`  💾 Манифест: sticker-manifest.json`);
}

async function main() {
    console.log('═══════════════════════════════════════');
    console.log(' SBORKA — Обновление манифестов');
    console.log('═══════════════════════════════════════');

    // 1. Клиентские моды (отображаются, можно вкл/выкл)
    await buildManifest(MODS_DIR, MODS_BASE_URL, MODS_MANIFEST, 'mods/ (клиентские)');

    // 2. Серверные моды (скрытые, обязательные)
    await buildManifest(SERVER_MODS_DIR, SERVER_MODS_BASE_URL, SERVER_MODS_MANIFEST, 'server-mods/ (серверные)');

    // 3. Стикер-паки
    await buildStickerManifest();

    console.log(`\n🚀 Теперь сделай:`);
    console.log(`   git add .`);
    console.log(`   git commit -m "Обновление модов"`);
    console.log(`   git push`);
}

main().catch(err => {
    console.error('❌ Ошибка:', err.message);
    process.exit(1);
});

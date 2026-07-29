const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');
const extract = require('extract-zip');

// Maps the OS and Architecture to Adoptium's API format
const getOS = () => {
    if (process.platform === 'win32') return 'windows';
    if (process.platform === 'darwin') return 'mac';
    return 'linux';
};

const getArch = () => {
    if (process.arch === 'x64') return 'x64';
    if (process.arch === 'arm64') return 'aarch64';
    return 'x64';
};

// Helper to determine active root directory
function resolveGameDir(gameDir) {
    if (gameDir && typeof gameDir === 'string' && gameDir.trim() !== '') {
        return gameDir;
    }
    const home = process.env.APPDATA || (process.platform === 'darwin' ? path.join(process.env.HOME, 'Library/Preferences') : process.env.HOME);
    return path.join(home, '.aura-launcher');
}

// Downloads a file using native Node https
function downloadFile(url, dest, onProgress) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                return downloadFile(response.headers.location, dest, onProgress).then(resolve).catch(reject);
            }
            
            const total = parseInt(response.headers['content-length'], 10);
            let downloaded = 0;

            response.on('data', (chunk) => {
                downloaded += chunk.length;
                if (total && onProgress) {
                    onProgress((downloaded / total) * 100);
                }
            });

            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => reject(err));
        });
    });
}

async function ensureJava(version, rawGameDir, onProgress) {
    const gameDir = resolveGameDir(rawGameDir);
    const runtimesDir = path.join(gameDir, 'runtimes');
    const javaTargetDir = path.join(runtimesDir, `jre-${version}`);
    
    if (!fs.existsSync(runtimesDir)) fs.mkdirSync(runtimesDir, { recursive: true });

    let exeName = process.platform === 'win32' ? 'bin/java.exe' : 'bin/java';
    
    // Check if Java runtime already exists
    if (fs.existsSync(javaTargetDir)) {
        const folders = fs.readdirSync(javaTargetDir).filter(f => fs.statSync(path.join(javaTargetDir, f)).isDirectory());
        if (folders.length > 0) {
            let binPath = path.join(javaTargetDir, folders[0], exeName);
            if (process.platform === 'darwin' && fs.existsSync(path.join(javaTargetDir, folders[0], 'Contents'))) {
                binPath = path.join(javaTargetDir, folders[0], 'Contents/Home/bin/java');
            }
            if (fs.existsSync(binPath)) return binPath;
        }
    }

    fs.mkdirSync(javaTargetDir, { recursive: true });
    
    const apiUrl = `https://api.adoptium.net/v3/assets/latest/${version}/hotspot?os=${getOS()}&architecture=${getArch()}&image_type=jre`;
    
    return new Promise((resolve, reject) => {
        https.get(apiUrl, async (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', async () => {
                try {
                    const json = JSON.parse(data);
                    if (!json || json.length === 0) throw new Error(`No Java ${version} binaries found for your OS.`);
                    
                    const downloadUrl = json[0].binary.package.link;
                    const fileName = json[0].binary.package.name;
                    const archivePath = path.join(runtimesDir, fileName);

                    await downloadFile(downloadUrl, archivePath, onProgress);

                    if (fileName.endsWith('.zip')) {
                        await extract(archivePath, { dir: javaTargetDir });
                    } else if (fileName.endsWith('.tar.gz')) {
                        execSync(`tar -xzf "${archivePath}" -C "${javaTargetDir}"`);
                    }

                    if (fs.existsSync(archivePath)) fs.unlinkSync(archivePath);

                    const folders = fs.readdirSync(javaTargetDir);
                    let binPath = path.join(javaTargetDir, folders[0], exeName);
                    
                    if (process.platform === 'darwin' && fs.existsSync(path.join(javaTargetDir, folders[0], 'Contents'))) {
                        binPath = path.join(javaTargetDir, folders[0], 'Contents/Home/bin/java');
                    }

                    resolve(binPath);
                } catch (err) {
                    reject(err);
                }
            });
        }).on('error', reject);
    });
}

module.exports = { ensureJava };
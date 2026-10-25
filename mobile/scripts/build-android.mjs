/**
 * Builds the Android app on this computer — no Expo account, no cloud build.
 *
 *   npm run apk   → release/sprouty-<version>.apk  (signed; for the website's /tai-app page)
 *   npm run aab   → release/sprouty-<version>.aab  (signed; for Google Play, VIP not sold)
 *
 * It generates android/ from app.json (`expo prebuild`, which also runs
 * plugins/with-release-signing.js), then runs Gradle. Finds a JDK 21 and the
 * Android SDK in their usual places when JAVA_HOME and ANDROID_HOME are not
 * set. Both builds are signed with keystore/sprouty-release.jks through
 * keystore.properties — the same key as every earlier APK, so phones that
 * have one installed update in place. Never make a new key.
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const android = join(root, 'android');
const kind = process.argv[2] || 'apk';
const { expo } = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8'));
const version = expo.version;
const windows = process.platform === 'win32';

if (!['apk', 'aab'].includes(kind)) {
  console.error(`Không biết loại build "${kind}". Dùng: apk | aab`);
  process.exit(1);
}
if (!existsSync(join(root, 'keystore.properties'))) {
  console.error('Thiếu keystore.properties — bản phát hành cần khoá ký. Xem README.md, mục "Khoá ký".');
  process.exit(1);
}

const firstExisting = (paths) => paths.find((p) => p && existsSync(p));

function findJdk() {
  if (process.env.JAVA_HOME && existsSync(process.env.JAVA_HOME)) return process.env.JAVA_HOME;
  const candidates = [];
  const jdks = join(homedir(), '.jdks');
  if (existsSync(jdks)) for (const d of readdirSync(jdks)) if (/21/.test(d)) candidates.push(join(jdks, d));
  candidates.push('C:/Program Files/Android/Android Studio/jbr', '/Applications/Android Studio.app/Contents/jbr/Contents/Home');
  return firstExisting(candidates);
}

function findSdk() {
  return firstExisting([
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    join(homedir(), 'AppData/Local/Android/Sdk'),
    join(homedir(), 'Library/Android/sdk'),
    join(homedir(), 'Android/Sdk'),
  ]);
}

const jdk = findJdk();
const sdk = findSdk();
if (!sdk) {
  console.error('Không tìm thấy Android SDK. Cài Android Studio hoặc đặt ANDROID_HOME.');
  process.exit(1);
}

// What the JavaScript is built with. A store build hides the VIP purchase
// (src/lib/config.ts); EXPO_PUBLIC_* values are fixed into the bundle here.
const env = {
  ...process.env,
  ...(jdk ? { JAVA_HOME: jdk } : {}),
  ANDROID_HOME: sdk,
  NODE_ENV: 'production',
  EXPO_PUBLIC_STORE: kind === 'aab' ? '1' : '',
};
delete env.EXPO_PUBLIC_API_ORIGIN; // never ship a build pointed at a laptop

function run(cmd, args, cwd) {
  const result = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: windows, env });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

/**
 * Windows: CMake names object files after the full path of their source, under
 * a build folder deep inside node_modules, so from C:\Users\…\sprouty-repo\mobile
 * they pass 260 characters and the C++ build of react-native-worklets fails
 * ("ninja: mkdir … No such file"). The SDK's default CMake 3.22 carries ninja
 * 1.10, which cannot use longer paths; CMake 3.31.6 carries ninja 1.12, which
 * can (Windows' LongPathsEnabled must be on). This picks it for every module,
 * installing it through the SDK manager the first time.
 */
function longPathCmake() {
  if (!windows) return null;
  const cmake = join(sdk, 'cmake', '3.31.6');
  if (!existsSync(join(cmake, 'bin', 'ninja.exe'))) {
    console.log('\n▸ Cài CMake 3.31.6 (ninja hỗ trợ đường dẫn dài trên Windows)');
    const sdkmanager = join(sdk, 'cmdline-tools', 'latest', 'bin', 'sdkmanager.bat');
    spawnSync(sdkmanager, ['--install', 'cmake;3.31.6'], { stdio: ['pipe', 'inherit', 'inherit'], input: 'y\n', shell: true, env });
  }
  return existsSync(join(cmake, 'bin', 'cmake.exe')) ? cmake : null;
}

console.log(`\n▸ Tạo thư mục android/ từ app.json (Sprouty ${version}, versionCode ${expo.android.versionCode})`);
// Prebuild rewrites `npm run android` to a native build; this project runs in
// Expo Go, so package.json is put back as it was.
const packageJson = readFileSync(join(root, 'package.json'), 'utf8');
const prebuild = spawnSync('npx', ['expo', 'prebuild', '--platform', 'android', '--clean', '--no-install'], { cwd: root, stdio: 'inherit', shell: windows, env });
writeFileSync(join(root, 'package.json'), packageJson);
if (prebuild.status !== 0) process.exit(prebuild.status ?? 1);

const gradleFile = readFileSync(join(android, 'app/build.gradle'), 'utf8');
if (!gradleFile.includes('signingConfigs.release : signingConfigs.debug')) {
  console.error('plugins/with-release-signing.js không gắn được khoá ký vào android/app/build.gradle — dừng lại để không phát hành bản ký bằng khoá debug.');
  process.exit(1);
}
const cmake = longPathCmake();
const slash = (p) => p.replace(/\\/g, '/');
writeFileSync(join(android, 'local.properties'), `sdk.dir=${slash(sdk)}\n${cmake ? `cmake.dir=${slash(cmake)}\n` : ''}`);

const task = kind === 'apk' ? 'assembleRelease' : 'bundleRelease';
console.log(`\n▸ Gradle ${task}`);
// Phones are ARM. Leaving out the x86 builds (emulators run ARM apps by
// translation) keeps the download small and the build quicker.
run(join(android, windows ? 'gradlew.bat' : 'gradlew'), [task, '-PreactNativeArchitectures=armeabi-v7a,arm64-v8a', '--console=plain'], android);

const [from, name] = kind === 'apk'
  ? ['app/build/outputs/apk/release/app-release.apk', `sprouty-${version}.apk`]
  : ['app/build/outputs/bundle/release/app-release.aab', `sprouty-${version}.aab`];
mkdirSync(join(root, 'release'), { recursive: true });
const target = join(root, 'release', name);
copyFileSync(join(android, from), target);
console.log(`\n→ ${target}`);

// The APK also goes on the website's download page (/tai-app), with the
// facts the page shows. Deploying the website publishes it.
if (kind === 'apk') {
  const downloads = resolve(root, '../frontend/public/downloads');
  mkdirSync(downloads, { recursive: true });
  copyFileSync(target, join(downloads, 'sprouty.apk'));
  const sizeMb = Math.round((statSync(target).size / 1024 / 1024) * 10) / 10;
  writeFileSync(join(downloads, 'latest.json'), JSON.stringify({
    version,
    sizeMb,
    date: new Date().toISOString(),
    file: '/downloads/sprouty.apk',
    minAndroid: '7.0',
  }, null, 2) + '\n');
  console.log(`→ frontend/public/downloads/sprouty.apk (${sizeMb} MB), trang tải: /tai-app`);
}

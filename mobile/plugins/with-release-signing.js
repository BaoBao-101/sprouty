/**
 * Signs release builds with Sprouty's own key.
 *
 * The android/ folder is generated (`npx expo prebuild`), so the signing
 * setup cannot be written into it by hand — it would be lost on the next
 * prebuild. This config plugin adds it every time instead. The key itself
 * stays out of git: mobile/keystore.properties names it (storeFile,
 * storePassword, keyAlias, keyPassword). Without that file a release build
 * falls back to the debug key, as Expo's template does.
 */
const { withAppBuildGradle } = require('expo/config-plugins');

const LOAD_KEYSTORE = `
// Added by plugins/with-release-signing.js
def sproutyKeystore = new Properties()
def sproutyKeystoreFile = rootProject.file('../keystore.properties')
if (sproutyKeystoreFile.exists()) {
    sproutyKeystoreFile.withInputStream { sproutyKeystore.load(it) }
}
`;

const RELEASE_SIGNING = `signingConfigs {
        release {
            if (sproutyKeystoreFile.exists()) {
                storeFile rootProject.file('../' + sproutyKeystore['storeFile'])
                storePassword sproutyKeystore['storePassword']
                keyAlias sproutyKeystore['keyAlias']
                keyPassword sproutyKeystore['keyPassword']
            }
        }`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (mod) => {
    let gradle = mod.modResults.contents;
    if (gradle.includes('sproutyKeystore')) return mod;

    gradle = gradle.replace(/\nandroid\s*\{/, `${LOAD_KEYSTORE}\nandroid {`);
    gradle = gradle.replace(/signingConfigs\s*\{/, RELEASE_SIGNING);
    // The template signs release with the debug key; use ours when present.
    gradle = gradle.replace(
      /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/,
      '$1signingConfig sproutyKeystoreFile.exists() ? signingConfigs.release : signingConfigs.debug',
    );
    mod.modResults.contents = gradle;
    return mod;
  });
};

const fs = require('fs');
const path = require('path');
const { withAppBuildGradle, withDangerousMod } = require('expo/config-plugins');

/**
 * Teach the generated Android project how to sign a release build.
 *
 * `npx expo prebuild` regenerates `android/` from scratch, which throws away any
 * hand-edit to `app/build.gradle` or `gradle.properties`. Doing the signing
 * setup by hand therefore works exactly once and then silently reverts to
 * debug-signed output — an APK that installs but can never be updated by a
 * differently-signed build, which is the confusing failure rather than the loud
 * one. Expressing it as a config plugin makes it survive every prebuild.
 *
 * Credentials live in `credentials/keystore.properties`, which is gitignored.
 * They are deliberately NOT in app.json: that file is committed, and a signing
 * password in version control is the same mistake as a service-role key in an
 * env var the bundle can read.
 *
 * With no credentials file present the plugin is a no-op and Gradle falls back
 * to the debug keystore. That is correct for a developer who only ever runs
 * `expo run:android`, and `assembleRelease` will say plainly that it is unsigned.
 */

const CREDENTIALS_DIR = 'credentials';
const PROPERTIES_FILE = 'keystore.properties';

function readCredentials(projectRoot) {
  const file = path.join(projectRoot, CREDENTIALS_DIR, PROPERTIES_FILE);
  if (!fs.existsSync(file)) return null;

  const values = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    values[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }

  const required = ['storeFile', 'storePassword', 'keyAlias', 'keyPassword'];
  if (required.some((key) => !values[key])) return null;
  return values;
}

/** Copy the keystore next to the Gradle module that signs with it. */
function withKeystoreCopied(config) {
  return withDangerousMod(config, [
    'android',
    (cfg) => {
      const creds = readCredentials(cfg.modRequest.projectRoot);
      if (!creds) return cfg;

      const source = path.join(cfg.modRequest.projectRoot, CREDENTIALS_DIR, creds.storeFile);
      if (!fs.existsSync(source)) {
        throw new Error(
          `with-release-signing: keystore "${creds.storeFile}" named in ` +
            `${CREDENTIALS_DIR}/${PROPERTIES_FILE} does not exist at ${source}.`,
        );
      }

      const destination = path.join(cfg.modRequest.platformProjectRoot, 'app', creds.storeFile);
      fs.copyFileSync(source, destination);
      return cfg;
    },
  ]);
}

function withSigningConfig(config) {
  return withAppBuildGradle(config, (cfg) => {
    const creds = readCredentials(cfg.modRequest.projectRoot);
    if (!creds) return cfg;

    let contents = cfg.modResults.contents;

    // Idempotent: prebuild can run repeatedly against an existing android/ dir.
    if (contents.includes('// bachat-release-signing')) return cfg;

    const escape = (value) => value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

    const signingBlock = `
        release {
            // bachat-release-signing
            storeFile file('${escape(creds.storeFile)}')
            storePassword '${escape(creds.storePassword)}'
            keyAlias '${escape(creds.keyAlias)}'
            keyPassword '${escape(creds.keyPassword)}'
        }`;

    // Add the release signingConfig alongside the debug one Expo generates.
    contents = contents.replace(
      /signingConfigs\s*\{/,
      (match) => `${match}${signingBlock}`,
    );

    // Point the release buildType at it. Expo's template ships
    // `signingConfig signingConfigs.debug` inside `buildTypes { release { … } }`,
    // which is what produces a debug-signed "release" APK if left alone.
    contents = contents.replace(
      /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/,
      '$1signingConfig signingConfigs.release',
    );

    cfg.modResults.contents = contents;
    return cfg;
  });
}

module.exports = function withReleaseSigning(config) {
  return withSigningConfig(withKeystoreCopied(config));
};

const { withAppBuildGradle } = require('expo/config-plugins');

/**
 * Let the development build sit beside the shared APK instead of fighting it.
 *
 * Both variants are built from the same `applicationId`, but the release APK is
 * signed with the real keystore and a debug build is signed with Android's debug
 * key. Android treats "same package, different signature" as an attempted
 * hijack and refuses:
 *
 *     INSTALL_FAILED_UPDATE_INCOMPATIBLE: Existing package … signatures do not match
 *
 * The usual advice is to uninstall the release build first. That is the wrong
 * trade here — the release APK is the one being handed round on WhatsApp, and
 * wiping it to run a dev build means reinstalling it afterwards every single
 * time.
 *
 * Giving debug its own id (`com.bachatbook.app.dev`) makes them two apps as far
 * as Android is concerned, so both install, and the phone shows "Bachat Book"
 * and "Bachat Book (dev)" side by side with separate storage.
 */
module.exports = function withDevVariant(config) {
  return withAppBuildGradle(config, (cfg) => {
    let contents = cfg.modResults.contents;

    // Idempotent — prebuild may run against an existing android/ directory.
    if (contents.includes('// bachat-dev-variant')) return cfg;

    contents = contents.replace(
      /(buildTypes\s*\{\s*debug\s*\{)/,
      `$1
            // bachat-dev-variant
            applicationIdSuffix '.dev'
            resValue "string", "app_name", "Bachat Book (dev)"`,
    );

    cfg.modResults.contents = contents;
    return cfg;
  });
};

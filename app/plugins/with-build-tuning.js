const { withGradleProperties } = require('expo/config-plugins');

/**
 * Make the Android build fit this machine.
 *
 * `npx expo prebuild` regenerates `android/gradle.properties`, so hand-edits
 * there last exactly one build. These belong in a plugin for the same reason the
 * signing config does.
 *
 * The failure this fixes is not obvious from its message. A release build died
 * with:
 *
 *     Execution failed for task ':…_netinfo:verifyReleaseResources'
 *     > AAPT2 … Daemon #0: Link timed out, attempting to stop daemon.
 *
 * which reads as a broken dependency. It is memory. AAPT2 daemons are separate
 * OS processes from the Gradle JVM, and `org.gradle.parallel=true` on an
 * 8-core machine lets AGP start several at once. With ~1 GB physically free they
 * cannot allocate, and the symptom is a timeout rather than an out-of-memory.
 */

/** Upsert, because these keys already exist in Expo's generated template. */
function set(properties, key, value) {
  const existing = properties.find((p) => p.type === 'property' && p.key === key);
  if (existing) {
    existing.value = value;
    return properties;
  }
  properties.push({ type: 'property', key, value });
  return properties;
}

module.exports = function withBuildTuning(config) {
  return withGradleProperties(config, (cfg) => {
    let properties = cfg.modResults;

    // Serial, and at most two worker processes. Slower per build, but it
    // finishes — a 41-minute build that fails is worse than a longer one that
    // does not.
    set(properties, 'org.gradle.parallel', 'false');
    set(properties, 'org.gradle.workers.max', '2');

    // Leaves headroom for the AAPT2 daemons beside the Gradle JVM rather than
    // competing with them. Raising this instead is the intuitive move and makes
    // the problem worse.
    set(properties, 'org.gradle.jvmargs', '-Xmx2048m -XX:MaxMetaspaceSize=512m');

    // Two ABIs, not four. `x86` and `x86_64` exist for emulators — no phone
    // anyone will install this on uses them, and building all four compiles the
    // native code four times for no reachable device. `armeabi-v7a` stays so
    // older budget handsets, which are common here, are still covered.
    set(properties, 'reactNativeArchitectures', 'arm64-v8a,armeabi-v7a');

    cfg.modResults = properties;
    return cfg;
  });
};

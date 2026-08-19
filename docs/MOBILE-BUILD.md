# Building and installing the Bachat Book app

How to run the phone app in development, and how to produce the single `.apk`
file you can send over WhatsApp for someone to install.

This machine has everything needed — Node 26, pnpm 10.8, Java 17 and a complete
Android SDK at `F:\Android\Sdk` (build-tools 37, platforms 34–36.1, NDK 27.1).
**No Expo account and no cloud build are required.** Everything below runs
locally.

---

## 0. The one-time things, already done

You do not need to repeat these. They are recorded so you know what exists.

| Thing | Where | Why it matters |
|---|---|---|
| `pnpm` conversion | `app/.npmrc` | `node-linker=hoisted`, because Metro resolves modules by walking real directories and cannot follow pnpm's symlink store. `package-lock.json` was deleted. |
| Release keystore | `app/credentials/` | **Gitignored. Back this folder up somewhere private.** |
| Signing plugin | `app/plugins/with-release-signing.js` | Injects the signing config so a `prebuild` cannot silently revert it. |

### The keystore is the app's identity — do not lose it

Android identifies an app by the key it was signed with. If
`app/credentials/` is lost:

- you cannot ship an update that upgrades an existing install — every user
  would have to uninstall the old app first, losing nothing on the server but
  every local setting;
- on the Play Store the package name `com.bachatbook.app` is burned permanently.

Copy that folder to a private backup now. It is gitignored, so `git push` will
never carry it, which is correct and also means git is not your backup.

---

## 1. Running it while you work — the fast loop

This is what you want day to day. It hot-reloads: save a file and the phone
updates in about a second.

```powershell
cd "Bachat Book\app"
pnpm start
```

Then, on your phone:

1. Install **Expo Go** from the Play Store.
2. Put the phone on the **same Wi-Fi** as this PC.
3. Scan the QR code the terminal prints.

If the QR does not connect — common on a Wi-Fi network that isolates clients,
which most public and many home routers do — force it through a tunnel:

```powershell
pnpm start --tunnel
```

**Expo Go has one real limit:** it runs the app inside its own shell, so it
cannot load native modules the app adds later (biometrics behaves differently,
and any future native module will not exist there at all). It is right for
building screens, wrong for testing the finished thing.

### Running the real app over USB

Closer to the truth than Expo Go, still hot-reloading:

1. On the phone: Settings → About phone → tap **Build number** seven times to
   unlock Developer options.
2. Developer options → turn on **USB debugging**.
3. Plug the phone in and accept the "Allow USB debugging?" prompt.
4. Then:

```powershell
cd "Bachat Book\app"
pnpm exec expo run:android
```

Check the phone is seen first if it does not work:

```powershell
& "F:\Android\Sdk\platform-tools\adb.exe" devices
```

A device listed as `unauthorized` means you have not accepted the prompt on the
phone yet.

---

## 2. Making the APK you can share

This is the answer to "how do I make the file I send on WhatsApp".

```powershell
cd "Bachat Book\app"
pnpm exec expo prebuild --platform android --no-install
cd android
./gradlew assembleRelease
```

The file lands at:

```
Bachat Book\app\android\app\build\outputs\apk\release\app-release.apk
```

That single file is the whole app. Send it on WhatsApp, put it on Drive, copy it
to a USB stick — anyone with it can install it.

**The first build takes 10–25 minutes** because Gradle compiles the native code
and the NDK toolchain from scratch. Later builds take 2–4 minutes.

### What the person installing it will see

Android blocks apps that did not come from the Play Store until told otherwise,
so warn them — otherwise it looks broken:

1. They tap the `.apk` in WhatsApp. WhatsApp may need to be granted "Install
   unknown apps" — the prompt offers the toggle, and it only applies to WhatsApp.
2. Play Protect shows **"Unsafe app blocked"** or **"App scan recommended"**.
   This is not a virus warning. It is Android saying the app is not from the
   Play Store and it has never seen this signing key before. They tap **More
   details → Install anyway**.
3. It installs as a normal app with its own icon.

There is no way to remove that warning short of publishing on the Play Store.
It is normal for every sideloaded app.

### Before you send it to anyone

- **Raise `versionCode`** in `app/app.json` for every build you distribute.
  Android refuses to install an APK whose `versionCode` is not higher than the
  installed one, and the failure message ("App not installed") does not say why.
- The APK points at the **live** Supabase project. Whoever installs it can
  create a real account. That is the intent for a real product, but it does mean
  a test build and a real build are the same backend.

---

## 3. When something breaks

| Symptom | Cause | Fix |
|---|---|---|
| `SDK location not found`, or `The filename, directory name, or volume label syntax is incorrect` | Gradle cannot find the Android SDK | `app/android/local.properties` must read `sdk.dir=F:/Android/Sdk` — **forward slashes**. `prebuild` does not create this file. It is a Java properties file, so a backslash starts an escape sequence: `F\:\Android\Sdk` makes `\A` and `\S` invalid and Gradle fails while evaluating the root project, which reads as a React Native plugin bug rather than a path typo. |
| `Unable to resolve module …` | pnpm's symlinks | Confirm `app/.npmrc` has `node-linker=hoisted`, then `rm -rf node_modules && pnpm install`. |
| "App not installed" on the phone | `versionCode` not increased | Bump it in `app.json`, rebuild. |
| Release APK installs but will not update an earlier one | Signed with a different key | Check `app/credentials/` is the same keystore as last time. |
| Changes to `.env` are ignored | `EXPO_PUBLIC_*` is inlined at build time | Restart Metro. A running bundler will not pick them up. |
| `android/` edits keep disappearing | `prebuild` regenerates the folder | That is why signing is a config plugin. Put anything else that must survive into a plugin too. |

---

## 4. What ships inside the APK

`EXPO_PUBLIC_*` variables are **inlined into the JavaScript bundle**, and anyone
can unzip an APK and read them. Two are in there:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Both are safe to publish. The publishable key grants nothing on its own — every
tenant table has RLS with explicit policies, and reads and writes are separated
(`is_household_member()` for reads, `is_household_editor()` for writes).

**The `service_role` key must never appear in `app/.env`, `app.json`, or
anywhere the bundle can reach.** It bypasses every RLS policy. Server-only
secrets belong in Supabase Edge Function secrets.

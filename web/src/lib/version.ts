/**
 * The build the user is looking at.
 *
 * Read from `package.json` at BUILD time rather than fetched — a version number
 * that needs a round trip to the server is a version number nobody sees when
 * the server is the thing misbehaving, which is exactly when it is asked for.
 *
 * Kept in one module because a version string that appears in three places and
 * is typed three times will disagree with itself by the second release.
 */
import pkg from "../../package.json";

export const APP_VERSION = pkg.version;

/** What to show beside it. Bumped by hand at each milestone. */
export const APP_STAGE = "beta";

/** e.g. "v0.1.0 · beta" — the one formatting of it. */
export const APP_VERSION_LABEL = `v${APP_VERSION} · ${APP_STAGE}`;

"use client";

/**
 * The last resort — the root layout itself failed.
 *
 * This component REPLACES the root layout, so it must render its own <html> and
 * <body>, and it cannot count on globals.css having been applied. Everything
 * here is therefore self-contained: the tokens are inlined in a <style> tag and
 * both themes are declared, because a page that only works in light mode will
 * be white text on white for half the people who ever see it.
 *
 * Kept deliberately plain. If the shell is broken, importing more of the app to
 * render the apology risks failing for the same reason.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <style>{`
          :root {
            --bg: #f8f6f1;
            --surface: #ffffff;
            --border: #e6e0d4;
            --fg: #0d1420;
            --muted: #6e6a62;
            --faint: #9a958a;
            --navy: #0b1a33;
            --on-navy: #eae6dc;
            --loss: #b4342a;
            --loss-soft: #f8e6e4;
          }
          @media (prefers-color-scheme: dark) {
            :root {
              --bg: #080f1c;
              --surface: #0f1a2e;
              --border: #1c2a44;
              --fg: #efeae0;
              --muted: #8e897d;
              --faint: #6b675e;
              --navy: #d9b978;
              --on-navy: #0b1a33;
              --loss: #b4342a;
              --loss-soft: #2e1512;
            }
          }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 2rem 1rem;
            background: var(--bg);
            color: var(--fg);
            font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
            -webkit-font-smoothing: antialiased;
          }
          .card { max-width: 26rem; text-align: center; }
          .glyph {
            width: 3.5rem; height: 3.5rem; margin: 0 auto;
            border-radius: 999px;
            background: var(--loss-soft); color: var(--loss);
            display: flex; align-items: center; justify-content: center;
          }
          h1 {
            font-family: Georgia, "Times New Roman", serif;
            font-size: 1.375rem; font-weight: 600;
            letter-spacing: -.02em;
            margin: 1.25rem 0 0;
          }
          p { color: var(--muted); font-size: .8125rem; line-height: 1.6; margin: .5rem 0 0; }
          .ref {
            margin-top: 1rem; padding: .5rem .75rem;
            border: 1px solid var(--border); border-radius: 10px;
            background: var(--surface); color: var(--faint);
            font-family: ui-monospace, Consolas, monospace; font-size: .6875rem;
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          }
          button {
            margin-top: 1.5rem;
            height: 2.25rem; padding: 0 1rem;
            border: none; border-radius: 10px; cursor: pointer;
            background: var(--navy); color: var(--on-navy);
            font-size: .8125rem; font-weight: 500; font-family: inherit;
          }
          button:active { transform: scale(.98); }
          button:focus-visible { outline: 2px solid var(--loss); outline-offset: 2px; }
        `}</style>

        <div className="card">
          <div className="glyph" aria-hidden>
            {/* Inline SVG — a lucide import could fail for the same reason the
                shell did. */}
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z" />
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
            </svg>
          </div>

          <h1>Bachat Book could not start</h1>
          <p>
            Something failed before the app finished loading. Your accounts,
            entries and balances are stored on the server and are untouched —
            nothing here was saved or lost.
          </p>

          {error.digest && <p className="ref">Reference {error.digest}</p>}

          <button type="button" onClick={reset}>
            Reload the app
          </button>
        </div>
      </body>
    </html>
  );
}

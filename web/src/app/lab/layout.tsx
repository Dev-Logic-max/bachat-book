/**
 * The lab renders screens on fixtures, outside any auth or data fetching.
 * Nothing in the product imports from here — it stays deletable.
 */
export default function LabLayout({ children }: { children: React.ReactNode }) {
  return <div className="app-shell bg-canvas min-h-screen">{children}</div>;
}

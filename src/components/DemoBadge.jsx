/** Visible marker for any placeholder value. Never remove it while data is not real. */
export function DemoBadge({ children = 'Demo data', title }) {
  return (
    <span className="demo-badge" title={title || 'Placeholder values for development. Not live market data.'}>
      {children}
    </span>
  );
}

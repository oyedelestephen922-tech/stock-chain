export function SectionHead({ title, sub, align = 'left', id, children }) {
  return (
    <header className={`section-head align-${align}`}>
      <h2 id={id} className="section-title">{title}</h2>
      {sub && <p className="section-sub">{sub}</p>}
      {children}
    </header>
  );
}

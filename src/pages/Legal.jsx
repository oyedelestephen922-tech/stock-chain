export default function Legal({ kind }) {
  const title = kind === 'privacy' ? 'Privacy policy' : 'Terms of use';
  return (
    <section className="section section-first">
      <div className="wrap docs-body narrow">
        <h1>{title}</h1>
        <p>The {title.toLowerCase()} will be published here before Stock Chain launches. Have it reviewed by a lawyer for every region you plan to serve.</p>
        <a className="btn btn-line" href="#/">Back to home</a>
      </div>
    </section>
  );
}

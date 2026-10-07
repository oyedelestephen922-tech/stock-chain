import { SectionHead } from '../components/SectionHead';
import { BorrowSection } from '../components/BorrowSection';

export default function Borrow() {
  return (
    <>
      <section className="section section-first section-tight">
        <div className="wrap">
          <SectionHead
            title="Borrow Desk"
            sub="Pledge your yield-bearing Stonk Well shares as collateral to draw liquid USDG credit without selling equity exposure."
          />
        </div>
      </section>
      <section className="section">
        <div className="wrap">
          <BorrowSection />
        </div>
      </section>
    </>
  );
}

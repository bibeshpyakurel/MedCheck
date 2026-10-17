import { PRESCRIPTION_LABEL as RX } from "@/data/demo-documents";
import { DemoDisclaimer } from "./demo-sheet";

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase">{label}</dt>
      <dd className={strong ? "text-lg font-black" : "text-base font-semibold"}>{value}</dd>
    </div>
  );
}

/** A retail pharmacy prescription label (the sticker on the bottle), styled for a phone photo. */
export function PrescriptionLabel() {
  return (
    <article className="w-full max-w-[6.5in] font-sans text-black">
      <DemoDisclaimer />
      <div className="mt-3 border-[3px] border-black">
        <header className="flex flex-wrap items-start justify-between gap-2 border-b-[3px] border-black p-3">
          <div>
            <h2 className="text-2xl leading-tight font-black">{RX.pharmacy}</h2>
            <p className="text-sm">{RX.pharmacyAddress}</p>
            <p className="text-sm">Phone {RX.pharmacyPhone}</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-black">Rx# {RX.rxNumber}</p>
            <p className="text-base font-semibold">Date filled: {RX.dateFilled}</p>
          </div>
        </header>

        <div className="space-y-3 p-3">
          <p className="text-2xl font-black uppercase">{RX.patient}</p>
          <p className="border-y-2 border-black py-2 text-2xl leading-snug font-black">{RX.directions}</p>
          <p className="text-xl font-bold">{RX.drug}</p>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
            <Row label="Qty" value={RX.quantity} strong />
            <Row label="Refills" value={RX.refills} strong />
            <Row label="Prescriber" value={RX.prescriber} />
            <Row label="Mfr" value={RX.manufacturer} />
            <Row label="Discard after" value={RX.discardAfter} />
          </dl>
        </div>

        <footer className="flex flex-wrap gap-2 border-t-[3px] border-black p-3">
          {RX.auxiliary.map((a) => (
            <span key={a} className="rounded border-2 border-black bg-yellow-200 px-2 py-1 text-xs font-black uppercase">
              {a}
            </span>
          ))}
        </footer>
      </div>
      <DemoDisclaimer className="mt-3" />
    </article>
  );
}

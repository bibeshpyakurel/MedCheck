import type { ReactNode } from "react";
import { formatNdc532, type DrugFactsLabel } from "@/data/demo-documents";
import { formatStrength } from "@/lib/domain/fields";
import { BarcodeSvg } from "./barcode-svg";
import { DemoDisclaimer } from "./demo-sheet";

/** Bold lead-in up to the first colon, as US Drug Facts panels print "Liver warning: …". */
function LeadIn({ text }: { text: string }) {
  const i = text.indexOf(":");
  if (i === -1) return <>{text}</>;
  return (
    <>
      <strong>{text.slice(0, i + 1)}</strong>
      {text.slice(i + 1)}
    </>
  );
}

function Section({ title, aside, children }: { title: string; aside?: string; children: ReactNode }) {
  return (
    <div className="border-t-[3px] border-black px-3 py-2 print:py-1.5">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="text-lg font-black print:text-base">{title}</h3>
        {aside ? <span className="text-lg font-black print:text-base">{aside}</span> : null}
      </div>
      <div className="mt-1 space-y-1">{children}</div>
    </div>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="space-y-0.5">
      {items.map((u) => (
        <li key={u} className="flex gap-2">
          <span aria-hidden>■</span>
          <span>{u}</span>
        </li>
      ))}
    </ul>
  );
}

/** "Stop use and ask a doctor if ■ a ■ b" run together, as carton Drug Facts panels print them. */
function InlineBullets({ title, items }: { title: string; items: string[] }) {
  return (
    <p>
      <strong>{title}</strong>
      {items.map((i) => (
        <span key={i}>
          {" "}
          <span aria-hidden>■</span> {i}
        </span>
      ))}
    </p>
  );
}

/** A Calmora bottle: front-panel identity, a US-style Drug Facts panel, and a scannable UPC-A. */
export function FictionalLabel({ label }: { label: DrugFactsLabel }) {
  const f = label.formulation;
  const [ingredient] = f.activeIngredients;
  const s = ingredient.strength;
  const per = s.perUnit ? `${s.perAmount ?? 1} ${s.perUnit}` : "dose";
  const [liverWarning, doNotUse] = f.warningsQuotes;

  return (
    <article className="w-full max-w-[7in] font-sans text-[15px] leading-snug text-black print:text-[13px]">
      <DemoDisclaimer />

      <header className="mt-3 grid gap-3 border-[3px] border-black p-3 sm:grid-cols-[1fr_auto] print:grid-cols-[1fr_auto] print:py-2">
        <div>
          <p className="flex flex-wrap items-center gap-3 text-sm font-bold uppercase">
            NDC {formatNdc532(f.ndc10)}
            <span className="rounded-md border-[3px] border-black px-2 text-xl font-black normal-case">{label.nickname}</span>
          </p>
          <h2 className="mt-1 text-3xl leading-tight font-black print:text-[22px]">{f.brandName}</h2>
          <p className="text-xl font-bold print:text-base">
            {f.genericName} · {formatStrength(s)}
          </p>
          <p className="text-sm">
            {label.purpose} · {label.netContents}
          </p>
        </div>
        <BarcodeSvg
          upc={f.upcA}
          className="w-[2.2in] max-w-full self-center print:w-[1.9in]"
          title={`${f.brandName} barcode, UPC-A ${f.upcA}`}
        />
      </header>

      <section aria-label="Drug Facts" className="mt-3 border-[3px] border-black">
        <h2 className="px-3 pt-1 text-3xl font-black print:text-2xl">Drug Facts</h2>
        <Section title={`Active ingredient (in each ${per})`} aside="Purpose">
          <p className="flex justify-between gap-4">
            <span>
              {ingredient.name} {s.amount} {s.unit}
            </span>
            <span>{label.purpose}</span>
          </p>
        </Section>
        <Section title="Uses">
          <Bullets items={label.uses} />
        </Section>
        <Section title="Warnings">
          <p>
            <LeadIn text={liverWarning} />
          </p>
          <p>
            <strong>Do not use</strong>
            {doNotUse.replace(/^Do not use/, "")}
          </p>
          <InlineBullets title="Ask a doctor before use if" items={label.askDoctor} />
          <InlineBullets title="Stop use and ask a doctor if" items={label.stopUse} />
          <p>
            <LeadIn text={label.keepOut.replace(/^Keep out of reach of children\./, "Keep out of reach of children:")} />
          </p>
        </Section>
        <Section title="Directions">
          <p className="text-base font-semibold print:text-[14px]">{f.directionsText}</p>
        </Section>
        <div className="grid sm:grid-cols-2 print:grid-cols-2">
          <Section title="Other information">
            <Bullets items={label.otherInformation} />
          </Section>
          <Section title="Inactive ingredients">
            <p>{label.inactiveIngredients}</p>
          </Section>
        </div>
      </section>

      <DemoDisclaimer className="mt-3" />
    </article>
  );
}

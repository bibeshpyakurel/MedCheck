import { FALLBACK_BARCODE as FB } from "@/data/demo-documents";
import { BarcodeSvg } from "./barcode-svg";
import { DemoDisclaimer } from "./demo-sheet";

/** A large real-product barcode to scan when the physical NyQuil box isn't on stage. */
export function FallbackBarcode() {
  return (
    <article className="w-full max-w-[7in] font-sans text-black">
      <DemoDisclaimer />
      <h2 className="mt-6 text-center text-2xl leading-tight font-black">{FB.title}</h2>
      <div className="mt-8 flex justify-center">
        <BarcodeSvg upc={FB.upcA} className="w-[4in] max-w-full" title={`NyQuil fallback barcode, UPC-A ${FB.upcA}`} />
      </div>
      <p className="mt-6 text-center text-lg font-bold">
        UPC-A {FB.upcA} · NDC {FB.ndc}
      </p>
      <p className="mx-auto mt-4 max-w-[5in] text-center text-sm">
        This sheet only reproduces a real product code so MedCheck can look the label up in openFDA. It is not a label —
        when the app asks, photograph the Drug Facts panel of a real box, or skip the photo.
      </p>
      <DemoDisclaimer className="mt-8" />
    </article>
  );
}

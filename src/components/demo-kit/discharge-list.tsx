import { DISCHARGE_LIST as DL } from "@/data/demo-documents";
import { DemoDisclaimer } from "./demo-sheet";

/** A hospital discharge medication list, one page, printed in black on white for photographing. */
export function DischargeList() {
  return (
    <article className="w-full max-w-[7in] font-sans text-[15px] text-black">
      <DemoDisclaimer />

      <header className="mt-4 border-b-[3px] border-black pb-3">
        <h2 className="text-2xl leading-tight font-black">{DL.facility}</h2>
        <p className="text-sm">
          {DL.department} · {DL.facilityAddress}
        </p>
        <p className="mt-3 text-xl font-black uppercase">Discharge Medication List</p>
      </header>

      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-base">
        <div>
          <dt className="text-xs font-bold uppercase">Patient</dt>
          <dd className="font-bold">{DL.patient}</dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase">Discharge date</dt>
          <dd className="font-bold">{DL.date}</dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase">Date of birth</dt>
          <dd>{DL.dateOfBirth}</dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase">MRN</dt>
          <dd>{DL.mrn}</dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase">Attending physician</dt>
          <dd>{DL.attending}</dd>
        </div>
      </dl>

      <table className="mt-4 w-full border-collapse border-2 border-black text-left">
        <thead>
          <tr className="border-b-2 border-black">
            <th className="border-r border-black p-2 text-sm font-black uppercase">Medication</th>
            <th className="border-r border-black p-2 text-sm font-black uppercase">How to take</th>
            <th className="border-r border-black p-2 text-sm font-black uppercase">For</th>
            <th className="p-2 text-sm font-black uppercase">Status</th>
          </tr>
        </thead>
        <tbody>
          {DL.medications.map((m) => (
            <tr key={m.medication} className="border-b border-black align-top">
              <td className="border-r border-black p-2 text-base font-bold">{m.medication}</td>
              <td className="border-r border-black p-2 text-base">{m.directions}</td>
              <td className="border-r border-black p-2">{m.reason}</td>
              <td className="p-2 font-bold">{m.status}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="mt-4 list-disc space-y-1 pl-5 text-sm">
        {DL.notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>

      <div className="mt-8 grid grid-cols-2 gap-6 text-sm">
        <p className="border-t border-black pt-1">Nurse signature</p>
        <p className="border-t border-black pt-1">Caregiver signature</p>
      </div>

      <DemoDisclaimer className="mt-6" />
    </article>
  );
}

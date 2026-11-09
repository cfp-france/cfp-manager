import { fmtEuro } from '@/lib/utils'

/**
 * Facture CFP → CFA au format officiel CFP.
 * Colonnes : DATE | FORMATEURS | NDA | HORAIRE | PROMOTION | MODULE | LIEU | TAUX/H | VOLUME/H | TOTAL
 */
export function CfaInvoicePrint({
  invoice,
  recipient,
}: {
  invoice: any
  recipient: {
    name: string
    address?: string | null
    siret?: string | null
  }
}) {
  const lines = (invoice.lines ?? []).slice().sort((a: any, b: any) => {
    const d = (a.session_date ?? '').localeCompare(b.session_date ?? '')
    if (d !== 0) return d
    return (a.start_time ?? '').localeCompare(b.start_time ?? '')
  })

  const fmtDMY = (d: string) => {
    if (!d) return ''
    const [y, m, day] = d.split('-')
    return `${day}/${m}/${y}`
  }
  const fmtHr = (t: string | null) => {
    if (!t) return ''
    const [h, m] = t.split(':')
    return m === '00' ? `${h}h` : `${h}h${m}`
  }

  return (
    <div className="bg-white p-6 shadow-sm rounded-md print:shadow-none print:p-0 max-w-[1100px] mx-auto text-[11px] cfa-invoice-print">
      <style>{`
        @media print {
          /* Format paysage pour que les 10 colonnes tiennent bien */
          @page { size: A4 landscape; margin: 8mm; }
          html, body { background: white !important; }
          .sidebar, nav, .btn, aside, header { display: none !important; }
          /* Ne garder QUE la facture à l'impression (masque le reste de l'app) */
          body > *:not(.cfa-invoice-print-root) { visibility: hidden; }
          .cfa-invoice-print, .cfa-invoice-print * { visibility: visible; }
          .cfa-invoice-print {
            position: absolute;
            left: 0; top: 0;
            width: 100%;
            padding: 0 !important;
            margin: 0 !important;
            max-width: none !important;
            font-size: 9pt;
          }
          /* Tableau serré mais lisible */
          .cfa-invoice-print table { page-break-inside: auto; }
          .cfa-invoice-print tr { page-break-inside: avoid; page-break-after: auto; }
          .cfa-invoice-print thead { display: table-header-group; }
          .cfa-invoice-print tfoot { display: table-footer-group; }
          .cfa-invoice-print td, .cfa-invoice-print th { padding: 3px 4px !important; font-size: 8.5pt; }
        }
      `}</style>

      {/* En-tête */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-navy flex items-center justify-center text-white text-xl font-bold">CF</div>
          <div className="text-navy font-bold text-sm leading-tight">
            CENTRE DE<br/>FORMATION DES<br/>PROFESSIONNELS
          </div>
        </div>
        <div className="text-right text-[11px]">
          <div className="font-bold">{recipient.name}</div>
          {recipient.address && <div className="whitespace-pre-line">{recipient.address}</div>}
          {recipient.siret && <div>Siret : {recipient.siret}</div>}
        </div>
      </div>

      <div className="text-[11px] mb-2">
        <b>Date de la facture :</b> {fmtDMY(invoice.issue_date)}
      </div>
      <div className="text-center text-base font-bold mb-3">FACTURE N.CFP/ {invoice.invoice_number?.replace(/^CFP-FC-\d+-/, '') ?? invoice.invoice_number}</div>

      {/* Tableau */}
      <table className="w-full border-collapse mb-4" style={{ tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: '8%' }} />{/* DATE */}
          <col style={{ width: '13%' }} />{/* FORMATEURS */}
          <col style={{ width: '11%' }} />{/* NDA */}
          <col style={{ width: '9%' }} />{/* HORAIRE */}
          <col style={{ width: '10%' }} />{/* PROMOTION */}
          <col style={{ width: '18%' }} />{/* MODULE */}
          <col style={{ width: '12%' }} />{/* LIEU */}
          <col style={{ width: '6%' }} />{/* TAUX */}
          <col style={{ width: '6%' }} />{/* VOLUME */}
          <col style={{ width: '7%' }} />{/* TOTAL */}
        </colgroup>
        <thead>
          <tr className="bg-navy text-white text-[10px]">
            <th className="border border-navy/60 p-1.5 text-left">DATE</th>
            <th className="border border-navy/60 p-1.5 text-left">FORMATEURS</th>
            <th className="border border-navy/60 p-1.5 text-left">NDA</th>
            <th className="border border-navy/60 p-1.5 text-left">HORAIRE</th>
            <th className="border border-navy/60 p-1.5 text-left">PROMOTION</th>
            <th className="border border-navy/60 p-1.5 text-left">MODULE</th>
            <th className="border border-navy/60 p-1.5 text-left">LIEU</th>
            <th className="border border-navy/60 p-1.5 text-right">TAUX/H</th>
            <th className="border border-navy/60 p-1.5 text-right">VOLUME/H</th>
            <th className="border border-navy/60 p-1.5 text-right">TOTAL</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l: any, idx: number) => (
            <tr key={l.id ?? idx} className={idx % 2 === 0 ? 'bg-blue-50/40' : ''} style={{ wordBreak: 'break-word' }}>
              <td className="border border-gray-300 p-1 whitespace-nowrap">{fmtDMY(l.session_date)}</td>
              <td className="border border-gray-300 p-1">{l.trainer_name}</td>
              <td className="border border-gray-300 p-1">
                {l.trainer_nda || <span className="italic text-[9px]">En cours d'acquisition</span>}
              </td>
              <td className="border border-gray-300 p-1 whitespace-nowrap">
                {fmtHr(l.start_time)} {fmtHr(l.end_time)}
              </td>
              <td className="border border-gray-300 p-1">{l.promotion || '—'}</td>
              <td className="border border-gray-300 p-1">{l.module || l.mission_name || '—'}</td>
              <td className="border border-gray-300 p-1">{l.lieu || '—'}</td>
              <td className="border border-gray-300 p-1 text-right">{Number(l.hourly_rate)}</td>
              <td className="border border-gray-300 p-1 text-right">{Number(l.hours)}</td>
              <td className="border border-gray-300 p-1 text-right font-semibold">{Number(l.amount_ht)}</td>
            </tr>
          ))}
          {lines.length === 0 && (
            <tr><td colSpan={10} className="border border-gray-300 p-3 text-center text-gray-500 italic">Aucune ligne</td></tr>
          )}
        </tbody>
      </table>

      {/* Totaux */}
      <div className="flex justify-center my-5">
        <div className="border border-gray-400 rounded px-5 py-2 text-sm">
          <b>Coût de la formation Total</b> &nbsp;&nbsp; {fmtEuro(Number(invoice.amount_ht))}
        </div>
      </div>

      <div className="text-right text-[11px] italic mb-4">Exonéré de TVA</div>

      <div className="text-[11px] space-y-1 mb-4">
        <div><b>Condition de paiement :</b></div>
        <div>Règlement par chèque ou par virement</div>
        <div>Par chèque : à l'ordre du CFP</div>
        <div>Par virement :</div>
      </div>

      <table className="text-[10px] border-collapse mb-6">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-400 px-2 py-1 text-left">Code Banque</th>
            <th className="border border-gray-400 px-2 py-1 text-left">Agence</th>
            <th className="border border-gray-400 px-2 py-1 text-left">Numéro de compte</th>
            <th className="border border-gray-400 px-2 py-1 text-left">Clé RIB</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-gray-400 px-2 py-1">16958</td>
            <td className="border border-gray-400 px-2 py-1">00001</td>
            <td className="border border-gray-400 px-2 py-1">50429967932</td>
            <td className="border border-gray-400 px-2 py-1">57</td>
          </tr>
          <tr>
            <td className="border border-gray-400 px-2 py-1 font-semibold" colSpan={1}>IBAN</td>
            <td className="border border-gray-400 px-2 py-1" colSpan={3}>FR76 1695 8000 0150 4299 6793 257</td>
          </tr>
        </tbody>
      </table>

      <div className="text-right text-[11px] italic">Administration</div>

      <div className="mt-8 pt-3 border-t border-gray-300 text-[9px] text-center text-gray-600 leading-snug">
        C.F.P - SAS - 66 avenue des Champs Élysées - 75008 PARIS - SIRET : 922 180 690 00013<br />
        NDA : 11756640075 - RCS Paris - TVA intracommunautaire : FR38922180690 - APE : 8559A
      </div>
    </div>
  )
}

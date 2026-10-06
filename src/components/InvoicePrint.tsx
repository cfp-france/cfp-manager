import { fmtDate, fmtEuro, fmtHours } from '@/lib/utils'

const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

type Party = {
  name: string
  companyName?: string | null
  legalStatus?: string | null
  siret?: string | null
  nda?: string | null
  vatNumber?: string | null
  address?: string | null
  email?: string | null
  phone?: string | null
  iban?: string | null
  bic?: string | null
}

/**
 * Mise en page facture — rendu propre pour impression PDF via le navigateur.
 * `kind` : "trainer" = le formateur facture le CFP ; "cfa" = le CFP facture le CFA.
 */
export function InvoicePrint({
  invoice,
  issuer,
  recipient,
  kind,
}: {
  invoice: any
  issuer: Party
  recipient: Party
  kind: 'trainer' | 'cfa'
}) {
  const lines = invoice.lines ?? []
  return (
    <div className="bg-white p-8 shadow-sm rounded-md print:shadow-none print:p-0 max-w-[800px] mx-auto">
      <style>{`
        @media print {
          @page { size: A4; margin: 15mm; }
          body { background: white !important; }
          .sidebar, nav, .btn, aside, header { display: none !important; }
        }
      `}</style>

      <div className="flex justify-between items-start mb-8">
        <div>
          <div className="text-3xl font-bold text-navy">FACTURE</div>
          <div className="text-sm text-gray-600 mt-1">N° <b>{invoice.invoice_number}</b></div>
          <div className="text-sm text-gray-600">Émise le {fmtDate(invoice.issue_date)}</div>
          {invoice.due_date && <div className="text-sm text-gray-600">Échéance : {fmtDate(invoice.due_date)}</div>}
          <div className="mt-2 text-sm">
            <b>Période :</b> {MONTHS[invoice.period_month - 1]} {invoice.period_year}
          </div>
        </div>
        <div className="text-right text-xs">
          <div className="inline-block px-3 py-1.5 rounded-full text-sm font-semibold mt-1" style={{
            background: invoice.status === 'paid' ? '#d1fae5' : invoice.status === 'cancelled' ? '#fee2e2' : '#fef3c7',
            color: invoice.status === 'paid' ? '#065f46' : invoice.status === 'cancelled' ? '#991b1b' : '#92400e',
          }}>
            {invoice.status === 'draft' && 'Brouillon'}
            {invoice.status === 'sent' && 'En cours de traitement'}
            {invoice.status === 'paid' && `✓ Payée le ${fmtDate(invoice.paid_at)}`}
            {invoice.status === 'cancelled' && 'Annulée'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-8 text-xs">
        <div>
          <div className="font-bold text-navy mb-1 uppercase text-[10px]">Émetteur</div>
          <div className="font-semibold">{issuer.companyName || issuer.name}</div>
          {issuer.name && issuer.companyName && <div>{issuer.name}</div>}
          {issuer.legalStatus && <div className="text-gray-600">{issuer.legalStatus}</div>}
          {issuer.address && <div className="text-gray-600 whitespace-pre-line mt-1">{issuer.address}</div>}
          <div className="text-gray-600 mt-1">
            {issuer.email && <div>{issuer.email}</div>}
            {issuer.phone && <div>{issuer.phone}</div>}
          </div>
          <div className="mt-2 text-gray-600 space-y-0.5">
            {issuer.siret && <div><b>SIRET :</b> {issuer.siret}</div>}
            {issuer.nda && <div><b>NDA :</b> {issuer.nda}</div>}
            {issuer.vatNumber ? <div><b>N° TVA :</b> {issuer.vatNumber}</div> : <div className="italic text-gray-500">TVA non applicable, art. 293 B du CGI</div>}
          </div>
        </div>
        <div>
          <div className="font-bold text-navy mb-1 uppercase text-[10px]">Destinataire</div>
          <div className="font-semibold">{recipient.companyName || recipient.name}</div>
          {recipient.address && <div className="text-gray-600 whitespace-pre-line mt-1">{recipient.address}</div>}
          <div className="text-gray-600 mt-1">
            {recipient.email && <div>{recipient.email}</div>}
            {recipient.phone && <div>{recipient.phone}</div>}
          </div>
          <div className="mt-2 text-gray-600 space-y-0.5">
            {recipient.siret && <div><b>SIRET :</b> {recipient.siret}</div>}
            {recipient.vatNumber && <div><b>N° TVA :</b> {recipient.vatNumber}</div>}
          </div>
        </div>
      </div>

      <table className="w-full text-sm mb-6 border-collapse">
        <thead>
          <tr className="bg-brand-light border-b-2 border-brand">
            <th className="text-left p-2">Date</th>
            <th className="text-left p-2">{kind === 'trainer' ? 'CFA' : 'Formateur'}</th>
            <th className="text-left p-2">Mission</th>
            <th className="text-right p-2">Heures</th>
            <th className="text-right p-2">Taux HT</th>
            <th className="text-right p-2">Montant HT</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l: any) => (
            <tr key={l.id} className="border-b border-gray-100">
              <td className="p-2">{fmtDate(l.session_date)}</td>
              <td className="p-2">{kind === 'trainer' ? l.cfa_name : l.trainer_name}</td>
              <td className="p-2 text-xs">{l.mission_name || '—'}</td>
              <td className="p-2 text-right">{fmtHours(Number(l.hours))}</td>
              <td className="p-2 text-right">{fmtEuro(Number(l.hourly_rate))}</td>
              <td className="p-2 text-right font-semibold">{fmtEuro(Number(l.amount_ht))}</td>
            </tr>
          ))}
          {lines.length === 0 && <tr><td colSpan={6} className="text-center text-gray-400 py-4 italic">Aucune ligne</td></tr>}
        </tbody>
      </table>

      <div className="flex justify-end">
        <div className="w-80 text-sm space-y-1">
          <div className="flex justify-between"><span>Total heures :</span><b>{fmtHours(Number(invoice.total_hours))}</b></div>
          <div className="flex justify-between"><span>Total HT :</span><b>{fmtEuro(Number(invoice.amount_ht))}</b></div>
          <div className="flex justify-between"><span>TVA ({Number(invoice.vat_rate)} %) :</span><b>{fmtEuro(Number(invoice.amount_vat))}</b></div>
          <div className="flex justify-between text-lg border-t-2 border-navy pt-2 mt-2">
            <span className="font-bold text-navy">TOTAL TTC :</span>
            <b className="text-navy">{fmtEuro(Number(invoice.amount_ttc))}</b>
          </div>
        </div>
      </div>

      {kind === 'trainer' && (issuer.iban || issuer.bic) && (
        <div className="mt-8 pt-4 border-t border-gray-200 text-xs">
          <div className="font-bold text-navy mb-1 uppercase text-[10px]">Règlement</div>
          <div>Par virement bancaire à l'ordre de <b>{issuer.companyName || issuer.name}</b></div>
          {issuer.iban && <div className="font-mono mt-1">IBAN : {issuer.iban}</div>}
          {issuer.bic && <div className="font-mono">BIC : {issuer.bic}</div>}
        </div>
      )}

      {invoice.payment_reference && (
        <div className="mt-4 text-xs text-gray-600 italic">
          Référence de règlement : {invoice.payment_reference}
        </div>
      )}

      <div className="mt-8 pt-4 border-t border-gray-200 text-[10px] text-gray-500 text-center">
        En cas de retard de paiement, pénalités au taux de 3× le taux d'intérêt légal + indemnité forfaitaire de 40€ (art. L441-6 et D441-5 du Code de commerce).
      </div>
    </div>
  )
}

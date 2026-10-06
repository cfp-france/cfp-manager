import { createClient } from '@/lib/supabase/server'
import { fmtDate, fmtEuro } from '@/lib/utils'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { InvoicePrint } from '@/components/InvoicePrint'
import { markInvoicePaid, cancelInvoice } from '@/actions/invoices'

export const dynamic = 'force-dynamic'
const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

export default async function AdminTrainerInvoicePage({ params }: { params: { id: string } }) {
  const s = createClient()
  const { data: inv } = await s.from('trainer_invoices')
    .select('*, trainer:trainers(*), lines:trainer_invoice_lines(*)')
    .eq('id', params.id).single()
  if (!inv) notFound()
  const t: any = inv.trainer

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-4 print:hidden">
        <div>
          <h1 className="text-xl font-bold text-navy">Facture reçue {inv.invoice_number}</h1>
          <p className="text-sm text-gray-500">
            {t?.first_name} {t?.last_name} — {MONTHS[inv.period_month - 1]} {inv.period_year} — {fmtEuro(Number(inv.amount_ttc))} TTC
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/invoicing" className="btn btn-outline">← Retour</Link>
          {inv.status !== 'paid' && inv.status !== 'cancelled' && (
            <form action={markInvoicePaid} className="flex gap-2 items-center">
              <input type="hidden" name="id" value={inv.id} />
              <input type="hidden" name="type" value="trainer" />
              <input name="reference" placeholder="N° virement/chèque" className="text-sm border rounded px-2 py-1" />
              <button className="btn btn-success">💶 Marquer payée</button>
            </form>
          )}
          {inv.status !== 'cancelled' && (
            <form action={cancelInvoice}>
              <input type="hidden" name="id" value={inv.id} />
              <input type="hidden" name="type" value="trainer" />
              <button className="btn btn-danger">Annuler</button>
            </form>
          )}
          <a href="javascript:window.print()" className="btn btn-primary">🖨 PDF</a>
        </div>
      </div>

      <InvoicePrint
        kind="trainer"
        invoice={inv}
        issuer={{
          name: `${t?.first_name} ${t?.last_name}`,
          companyName: t?.company_name,
          legalStatus: t?.legal_status,
          siret: t?.siret,
          nda: t?.nda,
          vatNumber: t?.vat_number,
          address: t?.billing_address,
          email: t?.email,
          phone: t?.phone,
          iban: t?.iban,
          bic: t?.bic,
        }}
        recipient={{ name: 'CFP — Centre de Formation des Professionnels' }}
      />
    </div>
  )
}

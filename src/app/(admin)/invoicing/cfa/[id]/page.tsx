import { createClient } from '@/lib/supabase/server'
import { fmtEuro } from '@/lib/utils'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { InvoicePrint } from '@/components/InvoicePrint'
import { markInvoicePaid, markInvoiceSent, cancelInvoice } from '@/actions/invoices'

export const dynamic = 'force-dynamic'
const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

export default async function AdminCfaInvoicePage({ params }: { params: { id: string } }) {
  const s = createClient()
  const { data: inv } = await s.from('cfa_invoices')
    .select('*, cfa:cfa(*), lines:cfa_invoice_lines(*)')
    .eq('id', params.id).single()
  if (!inv) notFound()
  const c: any = inv.cfa

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-4 print:hidden flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-navy">Facture CFA {inv.invoice_number}</h1>
          <p className="text-sm text-gray-500">
            {c?.name} — {MONTHS[inv.period_month - 1]} {inv.period_year} — {fmtEuro(Number(inv.amount_ttc))} TTC
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link href="/invoicing" className="btn btn-outline">← Retour</Link>
          {inv.status === 'draft' && (
            <form action={markInvoiceSent}>
              <input type="hidden" name="id" value={inv.id} />
              <input type="hidden" name="type" value="cfa" />
              <button className="btn btn-primary">📧 Marquer envoyée</button>
            </form>
          )}
          {inv.status !== 'paid' && inv.status !== 'cancelled' && (
            <form action={markInvoicePaid} className="flex gap-2 items-center">
              <input type="hidden" name="id" value={inv.id} />
              <input type="hidden" name="type" value="cfa" />
              <input name="reference" placeholder="N° virement" className="text-sm border rounded px-2 py-1" />
              <button className="btn btn-success">💶 Encaissée</button>
            </form>
          )}
          {inv.status !== 'cancelled' && (
            <form action={cancelInvoice}>
              <input type="hidden" name="id" value={inv.id} />
              <input type="hidden" name="type" value="cfa" />
              <button className="btn btn-danger">Annuler</button>
            </form>
          )}
          <a href="javascript:window.print()" className="btn btn-primary">🖨 PDF</a>
        </div>
      </div>

      <InvoicePrint
        kind="cfa"
        invoice={inv}
        issuer={{
          name: 'CFP — Centre de Formation des Professionnels',
          companyName: 'CFP — Centre de Formation des Professionnels',
          address: 'À compléter dans les paramètres',
        }}
        recipient={{
          name: c?.name,
          address: [c?.address, c?.city].filter(Boolean).join('\n'),
          siret: c?.siret,
          email: c?.email,
          phone: c?.phone,
        }}
      />
    </div>
  )
}

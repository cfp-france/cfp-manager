import { createClient } from '@/lib/supabase/server'
import { requireTrainer, fmtDate, fmtEuro, fmtHours } from '@/lib/utils'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { InvoicePrint } from '@/components/InvoicePrint'

export const dynamic = 'force-dynamic'

const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

export default async function TrainerInvoiceDetailPage({ params }: { params: { id: string } }) {
  const { trainer } = await requireTrainer()
  if (!trainer) return <div className="card p-6 text-sm">Pas de fiche formateur liée.</div>
  const s = createClient()
  const { data: inv } = await s.from('trainer_invoices')
    .select('*, lines:trainer_invoice_lines(*)')
    .eq('id', params.id).single()
  if (!inv || inv.trainer_id !== trainer.id) notFound()

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-4 print:hidden">
        <div>
          <h1 className="text-xl font-bold text-navy">Facture {inv.invoice_number}</h1>
          <p className="text-sm text-gray-500">{MONTHS[inv.period_month - 1]} {inv.period_year} — {fmtEuro(Number(inv.amount_ttc))} TTC</p>
        </div>
        <div className="flex gap-2">
          <Link href="/invoices" className="btn btn-outline">← Retour</Link>
          <a href="javascript:window.print()" className="btn btn-primary">🖨 Imprimer / PDF</a>
        </div>
      </div>

      <InvoicePrint
        kind="trainer"
        invoice={inv}
        issuer={{
          name: `${trainer.first_name} ${trainer.last_name}`,
          companyName: (trainer as any).company_name,
          legalStatus: (trainer as any).legal_status,
          siret: (trainer as any).siret,
          nda: (trainer as any).nda,
          vatNumber: (trainer as any).vat_number,
          address: (trainer as any).billing_address,
          email: trainer.email,
          phone: trainer.phone,
          iban: (trainer as any).iban,
          bic: (trainer as any).bic,
        }}
        recipient={{
          name: 'CFP — Centre de Formation des Professionnels',
        }}
      />
    </div>
  )
}

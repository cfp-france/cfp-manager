// Palette de couleurs pastel, assignée à chaque formateur de façon déterministe
// Avec un hash sur son id, on obtient toujours la même couleur pour un formateur donné.

const PALETTE: { bg: string; border: string; text: string }[] = [
  { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' },   // bleu
  { bg: '#dcfce7', border: '#22c55e', text: '#166534' },   // vert
  { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },   // ambre
  { bg: '#fce7f3', border: '#ec4899', text: '#9d174d' },   // rose
  { bg: '#e0e7ff', border: '#6366f1', text: '#3730a3' },   // indigo
  { bg: '#ccfbf1', border: '#14b8a6', text: '#115e59' },   // teal
  { bg: '#fed7aa', border: '#f97316', text: '#9a3412' },   // orange
  { bg: '#e9d5ff', border: '#a855f7', text: '#6b21a8' },   // violet
  { bg: '#fee2e2', border: '#ef4444', text: '#991b1b' },   // rouge
  { bg: '#d1fae5', border: '#10b981', text: '#065f46' },   // émeraude
  { bg: '#cffafe', border: '#06b6d4', text: '#155e75' },   // cyan
  { bg: '#f5d0fe', border: '#d946ef', text: '#86198f' },   // fuchsia
]

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

export function trainerColor(trainerId: string | null | undefined) {
  if (!trainerId) return { bg: '#f3f4f6', border: '#9ca3af', text: '#374151' }
  return PALETTE[hash(trainerId) % PALETTE.length]
}

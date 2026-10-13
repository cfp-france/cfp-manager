// Palette de couleurs pastel bien distinctes.
// On attribue une couleur unique à chaque formateur en fonction de sa position
// dans la liste triée des IDs → aucune collision tant qu'il y a assez de couleurs.

export const PALETTE: { bg: string; border: string; text: string }[] = [
  { bg: '#dbeafe', border: '#2563eb', text: '#1e3a8a' },   // bleu
  { bg: '#dcfce7', border: '#16a34a', text: '#14532d' },   // vert
  { bg: '#fef3c7', border: '#d97706', text: '#78350f' },   // ambre
  { bg: '#fce7f3', border: '#db2777', text: '#831843' },   // rose
  { bg: '#e0e7ff', border: '#4f46e5', text: '#312e81' },   // indigo
  { bg: '#ccfbf1', border: '#0d9488', text: '#134e4a' },   // teal
  { bg: '#fed7aa', border: '#ea580c', text: '#7c2d12' },   // orange
  { bg: '#e9d5ff', border: '#9333ea', text: '#581c87' },   // violet
  { bg: '#fee2e2', border: '#dc2626', text: '#7f1d1d' },   // rouge
  { bg: '#d1fae5', border: '#059669', text: '#064e3b' },   // émeraude
  { bg: '#cffafe', border: '#0891b2', text: '#164e63' },   // cyan
  { bg: '#f5d0fe', border: '#c026d3', text: '#701a75' },   // fuchsia
  { bg: '#fef9c3', border: '#ca8a04', text: '#713f12' },   // jaune
  { bg: '#bbf7d0', border: '#15803d', text: '#14532d' },   // vert foncé
  { bg: '#fecaca', border: '#b91c1c', text: '#7f1d1d' },   // rouge rose
  { bg: '#bfdbfe', border: '#1d4ed8', text: '#1e3a8a' },   // bleu royal
  { bg: '#f3e8ff', border: '#7e22ce', text: '#581c87' },   // mauve clair
  { bg: '#a7f3d0', border: '#047857', text: '#064e3b' },   // menthe
  { bg: '#fde68a', border: '#b45309', text: '#78350f' },   // moutarde
  { bg: '#fbcfe8', border: '#be185d', text: '#831843' },   // rose profond
]

const NEUTRAL = { bg: '#f3f4f6', border: '#9ca3af', text: '#374151' }

/**
 * Construit un dictionnaire { trainerId → couleur } garantissant l'unicité
 * (jusqu'à PALETTE.length formateurs). Tri par id pour stabilité.
 */
export function buildTrainerColorMap(trainerIds: string[]): Record<string, typeof PALETTE[number]> {
  const sorted = [...new Set(trainerIds)].filter(Boolean).sort()
  const map: Record<string, typeof PALETTE[number]> = {}
  sorted.forEach((id, i) => {
    map[id] = PALETTE[i % PALETTE.length]
  })
  return map
}

/**
 * API de secours (compat) : hash-based. Préférer buildTrainerColorMap côté page
 * pour garantir qu'aucun formateur n'ait la même couleur qu'un autre.
 */
function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return Math.abs(h)
}
export function trainerColor(trainerId: string | null | undefined) {
  if (!trainerId) return NEUTRAL
  return PALETTE[hash(trainerId) % PALETTE.length]
}

export const NO_TRAINER_COLOR = NEUTRAL

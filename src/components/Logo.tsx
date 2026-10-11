import Image from 'next/image'

/**
 * Logo officiel CFP. Utilisé dans le header de connexion, la sidebar, les factures.
 * - size="sm" (32px) pour la sidebar
 * - size="md" (56px) pour l'écran de connexion
 * - size="lg" (96px) pour l'en-tête des factures PDF
 */
export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
 const px = size === 'sm' ? 32 : size === 'lg' ? 96 : 56
 return (
 <Image
 src="/logo-cfp.png"
 alt="CFP — Centre de Formation des Professionnels"
 width={px}
 height={px}
 priority
 className="object-contain"
 />
 )
}

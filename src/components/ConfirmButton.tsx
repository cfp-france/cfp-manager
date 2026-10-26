'use client'
/**
 * Bouton qui demande une confirmation via le dialog natif du navigateur
 * avant de laisser le formulaire parent se soumettre.
 * À utiliser dans un <form action={serverAction}>.
 *
 * Exemple :
 *   <form action={deleteTrainer}>
 *     <input type="hidden" name="id" value={t.id} />
 *     <ConfirmButton
 *       message="Supprimer définitivement Jean Dupont ?"
 *       className="btn btn-sm btn-danger"
 *     >Supprimer</ConfirmButton>
 *   </form>
 */
export function ConfirmButton({
  message,
  className,
  title,
  children,
}: {
  message: string
  className?: string
  title?: string
  children: React.ReactNode
}) {
  return (
    <button
      type="submit"
      className={className}
      title={title}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault()
      }}
    >
      {children}
    </button>
  )
}

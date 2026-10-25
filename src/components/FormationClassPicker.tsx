'use client'
import { useState } from 'react'

/**
 * Sélecteur de formation (classe) obligatoire, avec option « Autre » qui débloque
 * un champ texte libre pour renseigner le nom exact de la classe.
 * - Si une formation est sélectionnée : name="formation_id" porte son id
 * - Si « Autre » est choisi : name="declared_class_label" porte le texte libre
 */
export function FormationClassPicker({
  formations,
}: { formations: { id: string; code: string; name: string }[] }) {
  const [value, setValue] = useState('')
  const isOther = value === '__other__'
  return (
    <div className="space-y-2">
      <div className="field mb-0">
        <label>Classe / formation <span className="text-red-600">*</span></label>
        <select
          name={isOther ? undefined : 'formation_id'}
          required
          value={value}
          onChange={(e) => setValue(e.target.value)}
        >
          <option value="">— Sélectionner —</option>
          {formations.map((f) => (
            <option key={f.id} value={f.id}>
              {f.code} — {f.name}
            </option>
          ))}
          <option value="__other__">Autre (préciser ci-dessous)</option>
        </select>
      </div>
      {isOther && (
        <div className="field mb-0">
          <label>Nom de la classe <span className="text-red-600">*</span></label>
          <input
            name="declared_class_label"
            required
            placeholder="Ex : BTS NDRC 2e année — Promo 3"
            className="w-full"
          />
          <p className="text-[11px] text-gray-500 mt-1">
            Précisez le nom de la classe. L'administration pourra l'ajouter au référentiel plus tard si besoin.
          </p>
        </div>
      )}
    </div>
  )
}

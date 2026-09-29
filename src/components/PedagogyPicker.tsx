'use client'
import { useState, useMemo } from 'react'

type Skill = { id: string; number: number; label: string }
type Block = { id: string; number: number; title: string; skills: Skill[] }
type Formation = { id: string; code: string; name: string; blocks: Block[] }

/**
 * PedagogyPicker — cascade Formation → Matière → Compétence(s)
 * - Si `formation` est passé (mission rattachée), la formation est en lecture seule.
 * - Sinon (déclaration hors planning), l'utilisateur choisit d'abord la formation.
 * - Puis la matière (bloc) filtrée par formation.
 * - Puis les compétences filtrées par matière (multi-sélection).
 * Envoie côté FormData : `blocks` (nº bloc unique) et `skills` (UUIDs multiples).
 */
export function PedagogyPicker({
  formations,
  fixedFormationId,
  initialBlockNumber,
  initialSkillIds,
}: {
  formations: Formation[]
  fixedFormationId?: string | null
  initialBlockNumber?: number
  initialSkillIds?: string[]
}) {
  const initFormation = fixedFormationId
    ? formations.find(f => f.id === fixedFormationId)
    : undefined
  const [formationId, setFormationId] = useState<string>(initFormation?.id ?? '')
  const [blockNumber, setBlockNumber] = useState<number | ''>(initialBlockNumber ?? '')
  const [selectedSkills, setSelectedSkills] = useState<string[]>(initialSkillIds ?? [])

  const currentFormation = useMemo(
    () => formations.find(f => f.id === formationId),
    [formations, formationId]
  )
  const availableBlocks = currentFormation?.blocks ?? []
  const currentBlock = availableBlocks.find(b => b.number === blockNumber)
  const availableSkills = currentBlock?.skills ?? []

  function toggleSkill(id: string) {
    setSelectedSkills(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id])
  }

  if (formations.length === 0) {
    return (
      <div className="bg-amber-50 border-l-4 border-amber-500 p-3 rounded text-sm">
        Aucune formation configurée. Demandez à l'administration d'ajouter des formations depuis « Référentiels ».
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Étape 1 : Formation */}
      <div>
        <label className="text-xs font-semibold text-navy block mb-1">
          ① Formation {fixedFormationId && <span className="text-gray-500 font-normal">(depuis la mission)</span>}
        </label>
        {fixedFormationId ? (
          <div className="px-3 py-2 bg-brand-light rounded-md text-sm text-navy font-medium">
            {currentFormation?.name ?? '— aucune formation associée à cette mission —'}
          </div>
        ) : (
          <select
            value={formationId}
            onChange={e => { setFormationId(e.target.value); setBlockNumber(''); setSelectedSkills([]) }}
            className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm bg-white"
          >
            <option value="">— Choisir une formation —</option>
            {formations.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        )}
      </div>

      {/* Étape 2 : Matière (bloc) */}
      {currentFormation && (
        <div>
          <label className="text-xs font-semibold text-navy block mb-1">
            ② Matière / bloc de compétences <span className="text-red-600">*</span>
          </label>
          {availableBlocks.length === 0 ? (
            <div className="text-xs text-gray-500 italic px-3 py-2 bg-gray-50 rounded">
              Cette formation n'a pas encore de matières définies. Contactez l'administration.
            </div>
          ) : (
            <select
              value={blockNumber}
              onChange={e => { setBlockNumber(e.target.value === '' ? '' : Number(e.target.value)); setSelectedSkills([]) }}
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm bg-white"
              required
            >
              <option value="">— Choisir une matière —</option>
              {availableBlocks.map(b => (
                <option key={b.id} value={b.number}>Bloc {b.number} — {b.title}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Étape 3 : Compétences */}
      {currentBlock && (
        <div>
          <label className="text-xs font-semibold text-navy block mb-1">
            ③ Compétence(s) travaillée(s) dans cette matière
            <span className="text-gray-500 font-normal ml-1">({availableSkills.length} disponibles — cochez celles abordées pendant la séance)</span>
          </label>
          {availableSkills.length === 0 ? (
            <div className="text-xs text-gray-500 italic px-3 py-2 bg-gray-50 rounded">
              Aucune compétence configurée pour cette matière.
            </div>
          ) : (
            <div className="border border-gray-200 rounded-md p-2 bg-white max-h-72 overflow-y-auto space-y-1">
              {availableSkills.map(sk => {
                const checked = selectedSkills.includes(sk.id)
                return (
                  <label key={sk.id} className={`flex items-start gap-2 p-1.5 rounded cursor-pointer text-xs ${checked ? 'bg-brand-light' : 'hover:bg-gray-50'}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSkill(sk.id)}
                      className="mt-0.5"
                    />
                    <span><b>B{currentBlock.number}.{sk.number}</b> — {sk.label}</span>
                  </label>
                )
              })}
            </div>
          )}
          <p className="text-[11px] text-gray-500 mt-1">
            Si votre séance couvrait plusieurs matières, enregistrez-la en 2 saisies séparées.
          </p>
        </div>
      )}

      {/* Champs cachés pour la soumission du formulaire */}
      {blockNumber !== '' && (
        <input type="hidden" name="blocks" value={String(blockNumber)} />
      )}
      {selectedSkills.map(id => (
        <input key={id} type="hidden" name="skills" value={id} />
      ))}
      {!fixedFormationId && formationId && (
        <input type="hidden" name="formation_id" value={formationId} />
      )}
    </div>
  )
}

import { useState } from 'react'
import { supabase } from '../lib/supabase'

const EMPTY_ING = { nom: '', quantite: '', unite: '' }

export default function RecipeForm({ onAdded, onCancel }) {
  const [nom, setNom] = useState('')
  const [portions, setPortions] = useState('4')
  const [ings, setIngs] = useState([{ ...EMPTY_ING }])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function updateIng(i, field, val) {
    setIngs(prev => prev.map((ing, idx) => idx === i ? { ...ing, [field]: val } : ing))
  }

  function addIng() {
    setIngs(prev => [...prev, { ...EMPTY_ING }])
  }

  function removeIng(i) {
    setIngs(prev => prev.filter((_, idx) => idx !== i))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!nom.trim()) { setError('Le nom de la recette est requis'); return }
    setSaving(true)
    setError('')

    // Insert recipe
    const { data: recette, error: err1 } = await supabase
      .from('recettes')
      .insert({ nom: nom.trim(), portions: parseInt(portions) || 4 })
      .select()
      .single()

    if (err1) { setError(err1.message); setSaving(false); return }

    // Insert ingredients (filter empty rows, normalize to lowercase)
    const validIngs = ings
      .filter(ing => ing.nom.trim())
      .map(ing => ({
        recette_id: recette.id,
        nom: ing.nom.trim().toLowerCase(),
        quantite: ing.quantite ? parseFloat(ing.quantite) : null,
        unite: ing.unite.trim().toLowerCase() || null
      }))

    let insertedIngs = []
    if (validIngs.length > 0) {
      const { data, error: err2 } = await supabase
        .from('ingredients')
        .insert(validIngs)
        .select()
      if (err2) { setError(err2.message); setSaving(false); return }
      insertedIngs = data
    }

    setSaving(false)
    onAdded(recette, insertedIngs)
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-brand-300 bg-brand-50 p-4 space-y-4">
      <h2 className="font-semibold text-gray-900">Nouvelle recette</h2>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Nom</label>
          <input
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder="Ex: Pasta bolognaise"
            value={nom}
            onChange={e => setNom(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Portions</label>
          <input
            type="number"
            min="1"
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            value={portions}
            onChange={e => setPortions(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-2">Ingrédients</label>
        <div className="space-y-2">
          {ings.map((ing, i) => (
            <div key={i} className="grid grid-cols-12 gap-1.5 items-center">
              <input
                className="col-span-5 px-2 py-1.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="Ingrédient"
                value={ing.nom}
                onChange={e => updateIng(i, 'nom', e.target.value)}
              />
              <input
                type="number"
                step="any"
                min="0"
                className="col-span-3 px-2 py-1.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="Qté"
                value={ing.quantite}
                onChange={e => updateIng(i, 'quantite', e.target.value)}
              />
              <input
                className="col-span-3 px-2 py-1.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="Unité"
                value={ing.unite}
                onChange={e => updateIng(i, 'unite', e.target.value)}
              />
              <button
                type="button"
                onClick={() => removeIng(i)}
                className="col-span-1 text-gray-400 active:text-red-500 text-lg leading-none flex items-center justify-center"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addIng}
          className="mt-2 text-sm text-brand-600 font-medium active:text-brand-800"
        >
          + Ajouter un ingrédient
        </button>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-600 active:bg-gray-100"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex-1 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-semibold active:bg-brand-700 disabled:opacity-60"
        >
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </form>
  )
}

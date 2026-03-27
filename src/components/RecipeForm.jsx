import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const EMPTY_ING = { nom: '', quantite: '', unite: '', categorie: null }

// recipe + onSaved → mode édition
// onAdded           → mode création
export default function RecipeForm({ onAdded, onCancel, recipe, onSaved }) {
  const isEdit = !!recipe

  const [nom, setNom] = useState(recipe?.nom || '')
  const [portions, setPortions] = useState(String(recipe?.portions || 4))
  const [ings, setIngs] = useState(isEdit ? [] : [{ ...EMPTY_ING }])
  const [loadingIngs, setLoadingIngs] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [categories, setCategories] = useState([])

  useEffect(() => {
    supabase.from('categories').select('id, nom').order('nom')
      .then(({ data }) => setCategories(data || []))
  }, [])

  // En mode édition, charger les ingrédients existants
  useEffect(() => {
    if (!isEdit) return
    supabase
      .from('ingredients')
      .select('id, nom, quantite, unite, categorie_id, categories(id, nom)')
      .eq('recette_id', recipe.id)
      .order('nom')
      .then(({ data }) => {
        setIngs((data || []).map(ing => ({
          nom: ing.nom,
          quantite: ing.quantite != null ? String(ing.quantite) : '',
          unite: ing.unite || '',
          categorie: ing.categories ? { id: ing.categories.id, nom: ing.categories.nom } : null
        })))
        if (data?.length === 0) setIngs([{ ...EMPTY_ING }])
        setLoadingIngs(false)
      })
  }, [])

  function updateIng(i, field, val) {
    setIngs(prev => prev.map((ing, idx) => idx === i ? { ...ing, [field]: val } : ing))
  }

  function addIng() {
    setIngs(prev => [...prev, { ...EMPTY_ING }])
  }

  function removeIng(i) {
    setIngs(prev => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : [{ ...EMPTY_ING }])
  }

  async function resolveCategories(validIngs) {
    const catNames = [...new Set(
      validIngs.filter(ing => ing.categorie?.nom?.trim()).map(ing => ing.categorie.nom.trim())
    )]
    if (catNames.length === 0) return {}
    const { data: cats, error } = await supabase
      .from('categories')
      .upsert(catNames.map(n => ({ nom: n })), { onConflict: 'nom' })
      .select()
    if (error) throw error
    const map = {}
    for (const cat of cats || []) map[cat.nom] = cat.id
    return map
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!nom.trim()) { setError('Le nom de la recette est requis'); return }
    setSaving(true)
    setError('')

    try {
      const validIngs = ings.filter(ing => ing.nom.trim())
      const catNameToId = await resolveCategories(validIngs)

      const ingRows = validIngs.map(ing => ({
        nom: ing.nom.trim().toLowerCase(),
        quantite: ing.quantite ? parseFloat(ing.quantite) : null,
        unite: ing.unite.trim().toLowerCase() || null,
        categorie_id: ing.categorie?.nom ? (catNameToId[ing.categorie.nom.trim()] || null) : null
      }))

      if (isEdit) {
        // Update recette
        const { data: updated, error: err1 } = await supabase
          .from('recettes')
          .update({ nom: nom.trim(), portions: parseInt(portions) || 4 })
          .eq('id', recipe.id)
          .select().single()
        if (err1) throw err1

        // Remplacer tous les ingrédients
        await supabase.from('ingredients').delete().eq('recette_id', recipe.id)

        let insertedIngs = []
        if (ingRows.length > 0) {
          const { data, error: err2 } = await supabase
            .from('ingredients')
            .insert(ingRows.map(r => ({ ...r, recette_id: recipe.id })))
            .select()
          if (err2) throw err2
          insertedIngs = data
        }
        onSaved(updated, insertedIngs)
      } else {
        // Créer la recette
        const { data: recette, error: err1 } = await supabase
          .from('recettes')
          .insert({ nom: nom.trim(), portions: parseInt(portions) || 4 })
          .select().single()
        if (err1) throw err1

        let insertedIngs = []
        if (ingRows.length > 0) {
          const { data, error: err2 } = await supabase
            .from('ingredients')
            .insert(ingRows.map(r => ({ ...r, recette_id: recette.id })))
            .select()
          if (err2) throw err2
          insertedIngs = data
        }
        onAdded(recette, insertedIngs)
      }
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl bg-white shadow-card-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-brand-700 to-brand-500 px-4 py-3.5 flex items-center justify-between">
        <h2 className="font-semibold text-white text-base">
          {isEdit ? 'Modifier la recette' : 'Nouvelle recette'}
        </h2>
        <button
          type="button"
          onClick={onCancel}
          className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center active:bg-white/30 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <div className="p-4 space-y-4">
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 text-xs rounded-xl px-3 py-2.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/>
            </svg>
            {error}
          </div>
        )}

        {/* Nom + Portions */}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2 space-y-1">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">Nom</label>
            <input
              className="input-field"
              placeholder="Ex: Pasta bolognaise"
              value={nom}
              onChange={e => setNom(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">Portions</label>
            <input
              type="number"
              min="1"
              className="input-field"
              value={portions}
              onChange={e => setPortions(e.target.value)}
            />
          </div>
        </div>

        {/* Ingrédients */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">Ingrédients</label>

          {loadingIngs ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-gray-100 animate-pulse" />)}
            </div>
          ) : (
            <div className="space-y-2">
              {ings.map((ing, i) => (
                <div key={i} className="bg-gray-50/70 rounded-xl p-2 space-y-1.5">
                  <div className="grid grid-cols-12 gap-1.5 items-center">
                    <input
                      className="input-field col-span-5 !py-2 !bg-white"
                      placeholder="Ingrédient"
                      value={ing.nom}
                      onChange={e => updateIng(i, 'nom', e.target.value)}
                    />
                    <input
                      type="number"
                      step="any"
                      min="0"
                      className="input-field col-span-3 !py-2 !bg-white"
                      placeholder="Qté"
                      value={ing.quantite}
                      onChange={e => updateIng(i, 'quantite', e.target.value)}
                    />
                    <input
                      className="input-field col-span-3 !py-2 !bg-white"
                      placeholder="Unité"
                      value={ing.unite}
                      onChange={e => updateIng(i, 'unite', e.target.value.toLowerCase())}
                    />
                    <button
                      type="button"
                      onClick={() => removeIng(i)}
                      className="col-span-1 h-9 flex items-center justify-center text-gray-300 rounded-lg active:text-red-400 transition-colors"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M18 6L6 18M6 6l12 12"/>
                      </svg>
                    </button>
                  </div>
                  <CategoryInput
                    value={ing.categorie}
                    onChange={val => updateIng(i, 'categorie', val)}
                    categories={categories}
                  />
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={addIng}
            disabled={loadingIngs}
            className="flex items-center gap-1.5 text-sm text-brand-600 font-semibold py-1 active:text-brand-800 disabled:opacity-40 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Ajouter un ingrédient
          </button>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onCancel} className="btn-ghost flex-1">
            Annuler
          </button>
          <button type="submit" disabled={saving || loadingIngs} className="btn-primary flex-1">
            {saving ? <><Spinner /> Enregistrement…</> : isEdit ? 'Enregistrer' : 'Créer'}
          </button>
        </div>
      </div>
    </form>
  )
}

// ─── Category autocomplete ────────────────────────────────────────────────────

function CategoryInput({ value, onChange, categories }) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const ref = useRef(null)
  const listRef = useRef(null)

  // Fermer au clic extérieur
  useEffect(() => {
    function handle(e) {
      if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setActiveIndex(-1) }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const query = value?.nom || ''

  const filtered = query.trim()
    ? categories.filter(c => c.nom.toLowerCase().includes(query.trim().toLowerCase()))
    : categories

  const exactMatch = categories.find(c => c.nom.toLowerCase() === query.trim().toLowerCase())
  const showCreate = query.trim() && !exactMatch

  // Tous les items navigables : catégories filtrées + option "créer"
  const allItems = [
    ...filtered.map(c => ({ type: 'cat', id: c.id, nom: c.nom })),
    ...(showCreate ? [{ type: 'create', nom: query.trim() }] : [])
  ]

  // Réinitialiser l'index quand la liste change
  useEffect(() => { setActiveIndex(-1) }, [query])

  // Scroller l'élément actif dans la vue
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      listRef.current.children[activeIndex]?.scrollIntoView({ block: 'nearest' })
    }
  }, [activeIndex])

  function handleKeyDown(e) {
    if (!open) { if (e.key === 'ArrowDown') { setOpen(true); e.preventDefault() }; return }
    if (allItems.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(prev => Math.min(prev + 1, allItems.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (activeIndex < 0) return
      const item = allItems[activeIndex]
      if (item.type === 'create') onChange({ id: null, nom: item.nom })
      else onChange({ id: item.id, nom: item.nom })
      setOpen(false)
      setActiveIndex(-1)
    } else if (e.key === 'Escape') {
      setOpen(false)
      setActiveIndex(-1)
    }
  }

  function selectCat(cat) {
    onChange({ id: cat.id, nom: cat.nom })
    setOpen(false)
    setActiveIndex(-1)
  }

  function createCat() {
    onChange({ id: null, nom: query.trim() })
    setOpen(false)
    setActiveIndex(-1)
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative flex items-center">
        <svg className="absolute left-3 text-gray-400 pointer-events-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M4 6h16M4 12h8M4 18h12"/>
        </svg>
        <input
          className="input-field !py-1.5 !text-xs !pl-8 !bg-white w-full"
          placeholder="Catégorie (optionnel)"
          value={query}
          onChange={e => { onChange(e.target.value ? { id: null, nom: e.target.value } : null); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
        />
        {query && (
          <button type="button" onMouseDown={() => { onChange(null); setOpen(false) }} className="absolute right-2.5 text-gray-300 active:text-gray-500">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        )}
      </div>

      {open && allItems.length > 0 && (
        <div ref={listRef} className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-card-lg border border-gray-100 z-50 overflow-hidden max-h-40 overflow-y-auto">
          {filtered.map((cat, i) => (
            <button
              key={cat.id}
              type="button"
              onMouseDown={() => selectCat(cat)}
              className={`w-full text-left px-3 py-2.5 text-xs transition-colors
                ${i === activeIndex ? 'bg-brand-50 text-brand-700 font-semibold'
                  : value?.id === cat.id ? 'bg-gray-50 text-brand-700 font-semibold'
                  : 'text-gray-700'}`}
            >
              {cat.nom}
            </button>
          ))}
          {showCreate && (
            <button
              type="button"
              onMouseDown={createCat}
              className={`w-full text-left px-3 py-2.5 text-xs font-semibold border-t border-gray-100 flex items-center gap-1.5 transition-colors
                ${activeIndex === filtered.length ? 'bg-brand-50 text-brand-700' : 'text-brand-600'}`}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 5v14M5 12h14"/>
              </svg>
              Créer « {query.trim()} »
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" strokeOpacity="0.3"/>
      <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="3" strokeLinecap="round"/>
    </svg>
  )
}

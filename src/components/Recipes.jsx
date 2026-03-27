import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import RecipeForm from './RecipeForm'

const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s

export default function Recipes({ selectedRecipes, onToggleRecipe, onSetSelected }) {
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingRecipe, setEditingRecipe] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [ingredients, setIngredients] = useState({})

  useEffect(() => { fetchRecipes() }, [])

  async function fetchRecipes() {
    setLoading(true)
    const { data } = await supabase.from('recettes').select('*').order('nom')
    setRecipes(data || [])
    setLoading(false)
  }

  async function fetchIngredients(recipeId) {
    if (ingredients[recipeId]) return
    const { data } = await supabase
      .from('ingredients').select('*').eq('recette_id', recipeId).order('nom')
    setIngredients(prev => ({ ...prev, [recipeId]: data || [] }))
  }

  async function deleteRecipe(id) {
    if (!confirm('Supprimer cette recette ?')) return
    await supabase.from('recettes').delete().eq('id', id)
    setRecipes(prev => prev.filter(r => r.id !== id))
    setIngredients(prev => { const n = { ...prev }; delete n[id]; return n })
  }

  function toggleExpand(id) {
    const next = expandedId === id ? null : id
    setExpandedId(next)
    if (next) fetchIngredients(next)
  }

  function startEdit(recipe) {
    setShowForm(false)
    setExpandedId(null)
    setEditingRecipe(recipe)
  }

  function handleAdded(recipe, ingrs) {
    setRecipes(prev => [...prev, recipe].sort((a, b) => a.nom.localeCompare(b.nom)))
    setIngredients(prev => ({ ...prev, [recipe.id]: ingrs }))
    setShowForm(false)
  }

  function handleSaved(updatedRecipe, ingrs) {
    setRecipes(prev =>
      prev.map(r => r.id === updatedRecipe.id ? updatedRecipe : r)
        .sort((a, b) => a.nom.localeCompare(b.nom))
    )
    setIngredients(prev => ({ ...prev, [updatedRecipe.id]: ingrs }))
    setEditingRecipe(null)
  }

  const isSelected = (id) => selectedRecipes.some(r => r.id === id)
  const allSelected = recipes.length > 0 && recipes.every(r => isSelected(r.id))

  if (loading) return (
    <div className="p-4 space-y-3">
      {[1,2,3].map(i => (
        <div key={i} className="h-16 rounded-2xl bg-gray-100 animate-pulse" />
      ))}
    </div>
  )

  return (
    <div className="p-4 space-y-3 pb-6">
      {recipes.length > 0 && !editingRecipe && (
        <div className="flex justify-end">
          <button
            onClick={() => onSetSelected(allSelected ? [] : recipes)}
            className="flex items-center gap-1.5 text-xs font-semibold text-brand-600 active:text-brand-800 transition-colors py-1 px-2 rounded-lg active:bg-brand-50"
          >
            {allSelected ? (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                Tout désélectionner
              </>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                Tout sélectionner
              </>
            )}
          </button>
        </div>
      )}

      {recipes.length === 0 && !showForm && (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-3xl bg-brand-50 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🍽️</span>
          </div>
          <p className="font-semibold text-gray-800 mb-1">Aucune recette</p>
          <p className="text-sm text-gray-400">Commence par en ajouter une</p>
        </div>
      )}

      {recipes.map(recipe => {
        // Remplacer la carte par le formulaire d'édition
        if (editingRecipe?.id === recipe.id) {
          return (
            <RecipeForm
              key={recipe.id}
              recipe={recipe}
              onSaved={handleSaved}
              onCancel={() => setEditingRecipe(null)}
            />
          )
        }

        const selected = isSelected(recipe.id)
        const expanded = expandedId === recipe.id

        return (
          <div
            key={recipe.id}
            className={`rounded-2xl bg-white transition-all duration-200 overflow-hidden
              ${selected ? 'shadow-selected' : 'shadow-card'}`}
          >
            <div className="flex items-center px-4 py-3.5 gap-3">
              {/* Select */}
              <button
                onClick={() => onToggleRecipe(recipe)}
                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-150
                  ${selected ? 'bg-brand-600 border-brand-600 shadow-sm' : 'border-gray-300 active:border-brand-400'}`}
              >
                {selected && (
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>

              {/* Title */}
              <button className="flex-1 text-left min-w-0" onClick={() => toggleExpand(recipe.id)}>
                <div className={`font-semibold break-words transition-colors ${selected ? 'text-brand-800' : 'text-gray-900'}`}>
                  {cap(recipe.nom)}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {recipe.portions} portion{recipe.portions > 1 ? 's' : ''}
                </div>
              </button>

              {/* Expand */}
              <button
                onClick={() => toggleExpand(recipe.id)}
                className="w-8 h-8 flex items-center justify-center text-gray-400 rounded-lg active:bg-gray-100 transition-colors"
              >
                <svg
                  width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
                >
                  <path d="M6 9l6 6 6-6"/>
                </svg>
              </button>

              {/* Edit */}
              <button
                onClick={() => startEdit(recipe)}
                className="w-8 h-8 flex items-center justify-center text-gray-400 rounded-lg active:bg-brand-50 active:text-brand-600 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>

              {/* Delete */}
              <button
                onClick={() => deleteRecipe(recipe.id)}
                className="w-8 h-8 flex items-center justify-center text-gray-300 rounded-lg active:bg-red-50 active:text-red-400 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>

            {expanded && (
              <div className="px-4 pb-4 border-t border-gray-50">
                {!ingredients[recipe.id] ? (
                  <div className="py-3 space-y-2">
                    {[1,2].map(i => <div key={i} className="h-4 rounded bg-gray-100 animate-pulse" />)}
                  </div>
                ) : ingredients[recipe.id].length === 0 ? (
                  <p className="text-xs text-gray-400 py-3">Aucun ingrédient renseigné</p>
                ) : (
                  <div className="flex flex-wrap gap-2 pt-3">
                    {ingredients[recipe.id].map(ing => (
                      <span key={ing.id} className="inline-flex items-center gap-1 bg-gray-50 border border-gray-100 text-gray-700 rounded-lg px-2.5 py-1 text-xs">
                        {ing.quantite && (
                          <span className="font-semibold text-gray-500">
                            {ing.quantite}{ing.unite ? ` ${ing.unite}` : ''}
                          </span>
                        )}
                        <span>{cap(ing.nom)}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {showForm
        ? <RecipeForm onAdded={handleAdded} onCancel={() => setShowForm(false)} />
        : !editingRecipe && (
          <button
            onClick={() => setShowForm(true)}
            className="w-full py-4 rounded-2xl border-2 border-dashed border-gray-200 text-gray-500
              font-medium text-sm flex items-center justify-center gap-2
              active:border-brand-300 active:text-brand-600 active:bg-brand-50 transition-all duration-150"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Nouvelle recette
          </button>
        )
      }
    </div>
  )
}

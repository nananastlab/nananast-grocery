import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import RecipeForm from './RecipeForm'

export default function Recipes({ selectedRecipes, onToggleRecipe }) {
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [ingredients, setIngredients] = useState({}) // { recipeId: [...] }

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
      .from('ingredients')
      .select('*')
      .eq('recette_id', recipeId)
      .order('nom')
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

  function handleAdded(recipe, ingrs) {
    setRecipes(prev => [...prev, recipe].sort((a, b) => a.nom.localeCompare(b.nom)))
    setIngredients(prev => ({ ...prev, [recipe.id]: ingrs }))
    setShowForm(false)
  }

  const isSelected = (id) => selectedRecipes.some(r => r.id === id)

  if (loading) return <div className="p-6 text-center text-gray-400">Chargement…</div>

  return (
    <div className="p-4 space-y-3">
      {recipes.length === 0 && !showForm && (
        <div className="text-center py-12 text-gray-400">
          <div className="text-5xl mb-3">🍽️</div>
          <p>Aucune recette pour l'instant</p>
        </div>
      )}

      {recipes.map(recipe => (
        <div key={recipe.id}
          className={`rounded-xl border transition-all ${isSelected(recipe.id)
            ? 'border-brand-500 bg-brand-50'
            : 'border-gray-200 bg-white'}`}
        >
          <div className="flex items-center px-4 py-3 gap-3">
            {/* Select checkbox */}
            <button
              onClick={() => onToggleRecipe(recipe)}
              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors
                ${isSelected(recipe.id) ? 'bg-brand-600 border-brand-600' : 'border-gray-300'}`}
            >
              {isSelected(recipe.id) && <span className="text-white text-xs">✓</span>}
            </button>

            {/* Title */}
            <button className="flex-1 text-left" onClick={() => toggleExpand(recipe.id)}>
              <div className="font-medium text-gray-900">{recipe.nom}</div>
              <div className="text-xs text-gray-400">{recipe.portions} portion{recipe.portions > 1 ? 's' : ''}</div>
            </button>

            {/* Expand */}
            <button onClick={() => toggleExpand(recipe.id)} className="text-gray-400 px-1">
              <span className={`inline-block transition-transform ${expandedId === recipe.id ? 'rotate-180' : ''}`}>▾</span>
            </button>

            {/* Delete */}
            <button onClick={() => deleteRecipe(recipe.id)} className="text-red-400 active:text-red-600 px-1">
              ✕
            </button>
          </div>

          {expandedId === recipe.id && (
            <div className="px-4 pb-3 border-t border-gray-100">
              {!ingredients[recipe.id]
                ? <p className="text-xs text-gray-400 py-2">Chargement…</p>
                : ingredients[recipe.id].length === 0
                  ? <p className="text-xs text-gray-400 py-2">Aucun ingrédient</p>
                  : <ul className="mt-2 space-y-1">
                      {ingredients[recipe.id].map(ing => (
                        <li key={ing.id} className="text-sm flex gap-2">
                          <span className="text-gray-500">
                            {ing.quantite && `${ing.quantite} ${ing.unite || ''}`}
                          </span>
                          <span className="text-gray-800">{ing.nom}</span>
                        </li>
                      ))}
                    </ul>
              }
            </div>
          )}
        </div>
      ))}

      {showForm
        ? <RecipeForm onAdded={handleAdded} onCancel={() => setShowForm(false)} />
        : (
          <button
            onClick={() => setShowForm(true)}
            className="w-full py-3 rounded-xl border-2 border-dashed border-brand-300 text-brand-600 font-medium
              hover:bg-brand-50 active:bg-brand-100 transition-colors"
          >
            + Nouvelle recette
          </button>
        )
      }
    </div>
  )
}

import { useState } from 'react'
import Recipes from './components/Recipes'
import ShoppingList from './components/ShoppingList'
import Inventory from './components/Inventory'

const TABS = [
  { id: 'recipes',  label: 'Recettes',  icon: '🍽️' },
  { id: 'shopping', label: 'Courses',   icon: '🛒' },
  { id: 'inventory',label: 'Inventaire',icon: '📦' },
]

export default function App() {
  const [tab, setTab] = useState('recipes')
  const [selectedRecipes, setSelectedRecipes] = useState([])

  const toggleRecipe = (recipe) => {
    setSelectedRecipes(prev =>
      prev.find(r => r.id === recipe.id)
        ? prev.filter(r => r.id !== recipe.id)
        : [...prev, recipe]
    )
  }

  return (
    <div className="flex flex-col min-h-screen max-w-lg mx-auto bg-white shadow-sm">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-brand-600 text-white px-4 py-3 flex items-center gap-2">
        <span className="text-2xl">🥦</span>
        <h1 className="text-lg font-bold tracking-tight">Nananast Grocery</h1>
        {tab === 'shopping' && selectedRecipes.length > 0 && (
          <span className="ml-auto text-xs bg-white/20 rounded-full px-2 py-0.5">
            {selectedRecipes.length} recette{selectedRecipes.length > 1 ? 's' : ''}
          </span>
        )}
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        {tab === 'recipes'   && <Recipes selectedRecipes={selectedRecipes} onToggleRecipe={toggleRecipe} />}
        {tab === 'shopping'  && <ShoppingList selectedRecipes={selectedRecipes} />}
        {tab === 'inventory' && <Inventory />}
      </main>

      {/* Bottom nav */}
      <nav className="sticky bottom-0 z-10 bg-white border-t border-gray-100 grid grid-cols-3 safe-bottom">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition-colors
              ${tab === t.id ? 'text-brand-600' : 'text-gray-400 active:text-gray-600'}`}
          >
            <span className="text-xl leading-none">{t.icon}</span>
            {t.label}
            {t.id === 'shopping' && selectedRecipes.length > 0 && (
              <span className="absolute mt-0.5 ml-5 -translate-y-1 w-4 h-4 rounded-full bg-brand-600 text-white text-[10px] flex items-center justify-center">
                {selectedRecipes.length}
              </span>
            )}
          </button>
        ))}
      </nav>
    </div>
  )
}

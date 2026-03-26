import { useState } from 'react'
import Recipes from './components/Recipes'
import ShoppingList from './components/ShoppingList'
import Inventory from './components/Inventory'

const TABS = [
  { id: 'recipes',   label: 'Recettes',   icon: RecipesIcon },
  { id: 'shopping',  label: 'Courses',    icon: CartIcon },
  { id: 'inventory', label: 'Inventaire', icon: BoxIcon },
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
    <div className="flex flex-col min-h-screen max-w-lg mx-auto bg-stone-100 shadow-[0_0_40px_rgba(0,0,0,0.08)]">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur-xl border-b border-gray-100">
        <div className="flex items-center gap-3 px-4 h-14">
          <div className="w-8 h-8 rounded-xl bg-brand-600 flex items-center justify-center flex-shrink-0 shadow-sm">
            <span className="text-base leading-none">🥦</span>
          </div>
          <div className="leading-none">
            <span className="text-sm font-bold text-gray-900 tracking-tight">Nananast </span>
            <span className="text-sm font-bold text-brand-600 tracking-tight">Grocery</span>
          </div>
          {tab === 'shopping' && selectedRecipes.length > 0 && (
            <div className="ml-auto bg-brand-50 text-brand-700 rounded-full px-3 py-1 flex items-center gap-1">
              <span className="text-xs font-semibold">{selectedRecipes.length}</span>
              <span className="text-xs font-medium">recette{selectedRecipes.length > 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        {tab === 'recipes'   && <Recipes selectedRecipes={selectedRecipes} onToggleRecipe={toggleRecipe} />}
        {tab === 'shopping'  && <ShoppingList selectedRecipes={selectedRecipes} />}
        {tab === 'inventory' && <Inventory />}
      </main>

      {/* Bottom nav */}
      <nav className="sticky bottom-0 z-10 bg-white/90 backdrop-blur-xl shadow-nav safe-bottom">
        <div className="grid grid-cols-3 px-2 pt-1 pb-1">
          {TABS.map(t => {
            const Icon = t.icon
            const active = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="relative flex flex-col items-center justify-center gap-0.5 py-2 rounded-2xl transition-colors duration-150"
              >
                {active && (
                  <span className="absolute inset-x-2 inset-y-0 bg-brand-50 rounded-2xl" />
                )}
                <span className="relative">
                  <Icon active={active} />
                  {t.id === 'shopping' && selectedRecipes.length > 0 && (
                    <span className="absolute -top-1 -right-2 w-4 h-4 rounded-full bg-brand-600 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                      {selectedRecipes.length}
                    </span>
                  )}
                </span>
                <span className={`relative text-[11px] font-semibold transition-colors ${active ? 'text-brand-700' : 'text-gray-400'}`}>
                  {t.label}
                </span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}

function RecipesIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#15803d' : '#9ca3af'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/>
      <path d="M7 2v20"/>
      <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>
    </svg>
  )
}

function CartIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#15803d' : '#9ca3af'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/>
      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>
    </svg>
  )
}

function BoxIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#15803d' : '#9ca3af'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
      <path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>
    </svg>
  )
}

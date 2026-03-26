import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s

// Ordre d'affichage des catégories connues
const CATEGORY_ORDER = [
  'Légumes', 'Fruits', 'Viandes', 'Poissons', 'Produits laitiers',
  'Epicerie salée', 'Epicerie sucrée', 'Conserves', 'Boissons', 'Surgelés', 'Autres'
]

function buildGroups(items) {
  const grouped = {}
  for (const item of items) {
    const key = item.categorie_nom || 'Autres'
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(item)
  }
  return Object.entries(grouped).sort(([a], [b]) => {
    if (a === 'Autres') return 1
    if (b === 'Autres') return -1
    const ai = CATEGORY_ORDER.indexOf(a)
    const bi = CATEGORY_ORDER.indexOf(b)
    if (ai === -1 && bi === -1) return a.localeCompare(b)
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })
}

export default function ShoppingList({ selectedRecipes }) {
  const [shoppingItems, setShoppingItems] = useState([])
  const [inventory, setInventory] = useState([])
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [checked, setChecked] = useState(new Set())

  useEffect(() => { fetchInventory() }, [])

  useEffect(() => {
    setChecked(new Set())
    if (selectedRecipes.length > 0) buildList()
    else setShoppingItems([])
  }, [selectedRecipes, inventory])

  async function fetchInventory() {
    const { data } = await supabase.from('inventaire').select('nom')
    setInventory((data || []).map(i => i.nom.toLowerCase()))
  }

  async function buildList() {
    setLoading(true)
    const ids = selectedRecipes.map(r => r.id)
    const { data: ingrs } = await supabase
      .from('ingredients')
      .select('nom, quantite, unite, categorie_id, categories(nom)')
      .in('recette_id', ids)

    // Aggregate by (nom, unite), keep first non-null category
    const map = {}
    for (const ing of ingrs || []) {
      const key = `${ing.nom.toLowerCase()}||${(ing.unite || '').toLowerCase()}`
      if (map[key]) {
        map[key].quantite = (map[key].quantite || 0) + (ing.quantite || 0)
        if (!map[key].categorie_nom && ing.categories?.nom) {
          map[key].categorie_nom = ing.categories.nom
        }
      } else {
        map[key] = {
          nom: ing.nom.toLowerCase(),
          quantite: ing.quantite || 0,
          unite: ing.unite || '',
          categorie_nom: ing.categories?.nom || null
        }
      }
    }

    const items = Object.values(map)
      .filter(item => !inventory.includes(item.nom))
      .sort((a, b) => a.nom.localeCompare(b.nom))

    setShoppingItems(items)
    setLoading(false)
  }

  function toggleCheck(nom) {
    setChecked(prev => {
      const next = new Set(prev)
      next.has(nom) ? next.delete(nom) : next.add(nom)
      return next
    })
  }

  function formatQty(n) {
    return Number.isInteger(n) ? n : parseFloat(n.toFixed(2))
  }

  // Build groups once per render (used in JSX and getListText)
  const sortedGroups = buildGroups(shoppingItems)

  function getListText() {
    return sortedGroups.map(([catName, items]) => {
      const lines = items.map(item => {
        const qty = item.quantite ? `${formatQty(item.quantite)} ${item.unite}`.trim() : ''
        return qty ? `${cap(item.nom)} - ${qty}` : cap(item.nom)
      }).join('\n')
      return `${catName}\n${lines}`
    }).join('\n\n')
  }

  async function handleShare() {
    const text = getListText()
    if (!text) return
    if (navigator.share) {
      try { await navigator.share({ title: 'Liste de courses', text }) } catch {}
    } else {
      handleCopy()
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(getListText())
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
    } catch {}
  }

  const remaining = shoppingItems.filter(i => !checked.has(i.nom)).length

  if (selectedRecipes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
        <div className="w-16 h-16 rounded-3xl bg-brand-50 flex items-center justify-center mb-4">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/>
            <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>
          </svg>
        </div>
        <p className="font-semibold text-gray-800 mb-1">Liste vide</p>
        <p className="text-sm text-gray-400 leading-relaxed">
          Sélectionne des recettes dans l'onglet <strong className="text-gray-600">Recettes</strong> pour générer ta liste de courses
        </p>
      </div>
    )
  }

  return (
    <div className="p-4 pb-6 space-y-4">
      {/* Recipe chips */}
      <div className="flex flex-wrap gap-2">
        {selectedRecipes.map(r => (
          <span key={r.id} className="inline-flex items-center gap-1.5 bg-white shadow-card text-gray-700 rounded-full px-3 py-1.5 text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-500 flex-shrink-0" />
            {cap(r.nom)}
          </span>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3 pt-1">
          {['w-20', 'w-24', 'w-16'].map((w, gi) => (
            <div key={gi}>
              <div className={`h-3 ${w} rounded bg-gray-200 animate-pulse mb-2`} />
              {[1, 2].map(i => (
                <div key={i} className="h-12 rounded-xl bg-gray-100 animate-pulse mb-1.5" style={{ opacity: 1 - i * 0.2 }} />
              ))}
            </div>
          ))}
        </div>
      ) : shoppingItems.length === 0 ? (
        <div className="text-center py-10">
          <div className="w-14 h-14 rounded-3xl bg-brand-50 flex items-center justify-center mx-auto mb-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5"/>
            </svg>
          </div>
          <p className="font-semibold text-gray-800 mb-1">Tout est dispo !</p>
          <p className="text-sm text-gray-400">Tout est déjà dans ton inventaire</p>
        </div>
      ) : (
        <>
          {/* Toolbar */}
          <div className="flex items-center justify-between">
            <div>
              <span className="font-semibold text-gray-900 text-base">
                {remaining} article{remaining > 1 ? 's' : ''}
              </span>
              {checked.size > 0 && (
                <span className="ml-2 text-xs text-gray-400">{checked.size} coché{checked.size > 1 ? 's' : ''}</span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-gray-600 text-xs font-semibold active:bg-gray-50 transition-colors"
              >
                {copied
                  ? <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg> Copié</>
                  : <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copier</>
                }
              </button>
              <button
                onClick={handleShare}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand-600 text-white text-xs font-semibold active:bg-brand-700 transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                  <polyline points="16 6 12 2 8 6"/>
                  <line x1="12" y1="2" x2="12" y2="15"/>
                </svg>
                Partager
              </button>
            </div>
          </div>

          {/* Grouped list */}
          <div className="space-y-4">
            {sortedGroups.map(([catName, items]) => (
              <div key={catName}>
                {/* Section header */}
                <div className="flex items-center gap-2 mb-1.5 px-1">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    {catName}
                  </span>
                  <span className="text-xs text-gray-400">
                    ({items.filter(i => !checked.has(i.nom)).length}/{items.length})
                  </span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>

                {/* Items card */}
                <div className="bg-white rounded-2xl shadow-card overflow-hidden">
                  {items.map((item, i) => {
                    const done = checked.has(item.nom)
                    return (
                      <button
                        key={item.nom}
                        onClick={() => toggleCheck(item.nom)}
                        className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors
                          ${i > 0 ? 'border-t border-gray-50' : ''}
                          ${done ? 'bg-gray-50/60' : 'active:bg-gray-50'}`}
                      >
                        <span className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all duration-150
                          ${done ? 'bg-brand-600 border-brand-600' : 'border-gray-300'}`}>
                          {done && (
                            <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
                              <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </span>
                        <span className={`flex-1 text-sm font-medium transition-colors ${done ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                          {cap(item.nom)}
                        </span>
                        {item.quantite > 0 && (
                          <span className={`text-xs font-semibold rounded-lg px-2 py-1 transition-colors
                            ${done ? 'bg-gray-100 text-gray-400' : 'bg-brand-50 text-brand-700'}`}>
                            {formatQty(item.quantite)}{item.unite ? ` ${item.unite}` : ''}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {checked.size > 0 && remaining === 0 && (
            <div className="text-center py-4">
              <p className="text-sm font-semibold text-brand-700">✓ Liste complète !</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

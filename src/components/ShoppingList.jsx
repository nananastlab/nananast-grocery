import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export default function ShoppingList({ selectedRecipes }) {
  const [shoppingItems, setShoppingItems] = useState([])
  const [inventory, setInventory] = useState([])
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetchInventory()
  }, [])

  useEffect(() => {
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
      .select('nom, quantite, unite')
      .in('recette_id', ids)

    // Aggregate by (nom, unite)
    const map = {}
    for (const ing of ingrs || []) {
      const key = `${ing.nom.toLowerCase()}||${(ing.unite || '').toLowerCase()}`
      if (map[key]) {
        map[key].quantite = (map[key].quantite || 0) + (ing.quantite || 0)
      } else {
        map[key] = { nom: ing.nom.toLowerCase(), quantite: ing.quantite || 0, unite: ing.unite || '' }
      }
    }

    // Filter out items in inventory
    const items = Object.values(map).filter(item => !inventory.includes(item.nom))
    items.sort((a, b) => a.nom.localeCompare(b.nom))
    setShoppingItems(items)
    setLoading(false)
  }

  function formatItem(item) {
    const qty = item.quantite ? `${formatQty(item.quantite)} ${item.unite}`.trim() : ''
    return qty ? `${qty} ${item.nom}` : item.nom
  }

  function formatQty(n) {
    return Number.isInteger(n) ? n : parseFloat(n.toFixed(2))
  }

  function getListText() {
    return shoppingItems.map(formatItem).join('\n')
  }

  async function handleShare() {
    const text = getListText()
    if (!text) return
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Liste de courses', text })
      } catch {}
    } else {
      handleCopy()
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(getListText())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  if (selectedRecipes.length === 0) {
    return (
      <div className="p-6 text-center py-16 text-gray-400">
        <div className="text-5xl mb-3">🛒</div>
        <p>Sélectionne des recettes dans l'onglet <strong>Recettes</strong> pour générer ta liste</p>
      </div>
    )
  }

  return (
    <div className="p-4">
      {/* Selected recipes chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        {selectedRecipes.map(r => (
          <span key={r.id} className="text-xs bg-brand-100 text-brand-700 rounded-full px-3 py-1 font-medium">
            {r.nom}
          </span>
        ))}
      </div>

      {loading ? (
        <p className="text-center text-gray-400 py-8">Calcul en cours…</p>
      ) : shoppingItems.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <div className="text-4xl mb-2">✅</div>
          <p>Tout est déjà dans ton inventaire !</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-800">
              {shoppingItems.length} article{shoppingItems.length > 1 ? 's' : ''}
            </h2>
            <div className="flex gap-2">
              <button
                onClick={handleCopy}
                className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 active:bg-gray-100 transition-colors"
              >
                {copied ? '✓ Copié' : 'Copier'}
              </button>
              <button
                onClick={handleShare}
                className="text-sm px-3 py-1.5 rounded-lg bg-brand-600 text-white font-medium active:bg-brand-700 transition-colors"
              >
                Partager
              </button>
            </div>
          </div>

          <ul className="space-y-1">
            {shoppingItems.map((item, i) => (
              <li key={i} className="flex items-baseline gap-3 py-2.5 border-b border-gray-100 last:border-0">
                <span className="w-5 h-5 rounded-full border-2 border-gray-300 flex-shrink-0 mt-0.5" />
                <span className="flex-1 text-gray-900">{item.nom}</span>
                {item.quantite > 0 && (
                  <span className="text-sm text-gray-500 font-medium">
                    {formatQty(item.quantite)}{item.unite ? ` ${item.unite}` : ''}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

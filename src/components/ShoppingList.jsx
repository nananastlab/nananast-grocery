import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s

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

export default function ShoppingList({ selectedRecipes, onSetSelected }) {
  const [shoppingItems, setShoppingItems] = useState([])
  const [manuelItems, setManuelItems] = useState([])
  const [inventory, setInventory] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingManuel, setLoadingManuel] = useState(true)
  const [copied, setCopied] = useState(false)
  const [checked, setChecked] = useState(new Set())
  const [openSource, setOpenSource] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)

  useEffect(() => { fetchInventory(); fetchManuelItems() }, [])

  useEffect(() => {
    setChecked(new Set())
    setOpenSource(null)
    if (selectedRecipes.length > 0) buildList()
    else setShoppingItems([])
  }, [selectedRecipes, inventory])

  async function fetchInventory() {
    const { data } = await supabase.from('inventaire').select('nom')
    setInventory((data || []).map(i => i.nom.toLowerCase()))
  }

  async function fetchManuelItems() {
    setLoadingManuel(true)
    const { data } = await supabase
      .from('liste_manuelle')
      .select('*, categories(nom)')
    setManuelItems(data || [])
    setLoadingManuel(false)
  }

  async function buildList() {
    setLoading(true)
    const ids = selectedRecipes.map(r => r.id)
    const { data: ingrs } = await supabase
      .from('ingredients')
      .select('nom, quantite, unite, categorie_id, recette_id, categories(nom)')
      .in('recette_id', ids)

    const recipeNameMap = {}
    for (const r of selectedRecipes) recipeNameMap[r.id] = r.nom

    const map = {}
    for (const ing of ingrs || []) {
      const key = `${ing.nom.toLowerCase()}||${(ing.unite || '').toLowerCase()}`
      const rName = recipeNameMap[ing.recette_id]
      if (map[key]) {
        map[key].quantite = (map[key].quantite || 0) + (ing.quantite || 0)
        if (!map[key].categorie_nom && ing.categories?.nom) {
          map[key].categorie_nom = ing.categories.nom
        }
        if (rName && !map[key].recipes.includes(rName)) {
          map[key].recipes.push(rName)
        }
      } else {
        map[key] = {
          nom: ing.nom.toLowerCase(),
          quantite: ing.quantite || 0,
          unite: ing.unite || '',
          categorie_nom: ing.categories?.nom || null,
          recipes: rName ? [rName] : []
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

  async function toggleManuelCheck(item) {
    const newCoche = !item.coche
    await supabase.from('liste_manuelle').update({ coche: newCoche }).eq('id', item.id)
    setManuelItems(prev => prev.map(m => m.id === item.id ? { ...m, coche: newCoche } : m))
  }

  function removeItem(item) {
    if (item.isManuel) {
      supabase.from('liste_manuelle').delete().eq('id', item.id)
      setManuelItems(prev => prev.filter(m => m.id !== item.id))
    } else {
      setShoppingItems(prev => prev.filter(i => !(i.nom === item.nom && i.unite === item.unite)))
    }
  }

  async function clearAll() {
    await supabase.from('liste_manuelle').delete().not('id', 'is', null)
    onSetSelected([])
    setManuelItems([])
    setShoppingItems([])
    setChecked(new Set())
    setOpenSource(null)
    setConfirmClear(false)
  }

  function formatQty(n) {
    return Number.isInteger(n) ? n : parseFloat(n.toFixed(2))
  }

  const manuelForList = manuelItems.map(m => ({
    nom: m.nom,
    quantite: m.quantite || 0,
    unite: m.unite || '',
    categorie_nom: m.categories?.nom || null,
    recipes: [],
    isManuel: true,
    id: m.id,
    coche: m.coche
  }))

  const allItems = [...shoppingItems, ...manuelForList]
  const sortedGroups = buildGroups(allItems)

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
                  + manuelItems.filter(m => !m.coche).length
  const totalChecked = checked.size + manuelItems.filter(m => m.coche).length
  const hasAnything = selectedRecipes.length > 0 || manuelItems.length > 0

  // ── Chargement initial ──────────────────────────────────────────────────────
  if (loadingManuel) {
    return (
      <div className="p-4 space-y-3 pt-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-12 rounded-xl bg-gray-100 animate-pulse" />
        ))}
      </div>
    )
  }

  // ── État vide ───────────────────────────────────────────────────────────────
  if (!hasAnything) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center space-y-5">
        <div className="w-16 h-16 rounded-3xl bg-brand-50 flex items-center justify-center">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/>
            <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>
          </svg>
        </div>
        <div>
          <p className="font-semibold text-gray-800 mb-1">Liste vide</p>
          <p className="text-sm text-gray-400 leading-relaxed">
            Sélectionne des recettes dans l'onglet <strong className="text-gray-600">Recettes</strong> ou ajoute des articles manuellement
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-brand-600 text-white rounded-2xl px-5 py-3 text-sm font-semibold active:bg-brand-700 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Ajouter un ingrédient
        </button>
        {showAddModal && (
          <AddIngredientModal
            onAdded={item => { setManuelItems(prev => [...prev, item]); setShowAddModal(false) }}
            onClose={() => setShowAddModal(false)}
          />
        )}
      </div>
    )
  }

  // ── Liste principale ────────────────────────────────────────────────────────
  return (
    <div className="p-4 pb-6 space-y-4">
      {/* Recipe chips */}
      {selectedRecipes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedRecipes.map(r => (
            <span key={r.id} className="inline-flex items-center gap-1.5 bg-white shadow-card text-gray-700 rounded-full px-3 py-1.5 text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-500 flex-shrink-0" />
              {cap(r.nom)}
            </span>
          ))}
        </div>
      )}

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
      ) : (
        <>
          {/* Toolbar */}
          {(allItems.length > 0 || selectedRecipes.length > 0) && (
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                {allItems.length > 0 && (
                  <>
                    <span className="font-semibold text-gray-900 text-base">
                      {remaining} article{remaining > 1 ? 's' : ''}
                    </span>
                    {totalChecked > 0 && (
                      <span className="ml-2 text-xs text-gray-400">
                        {totalChecked} coché{totalChecked > 1 ? 's' : ''}
                      </span>
                    )}
                  </>
                )}
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                {/* Nouvelle liste */}
                {!confirmClear ? (
                  <button
                    onClick={() => setConfirmClear(true)}
                    className="flex items-center gap-1 px-2.5 py-2 rounded-xl border border-red-100 text-red-400 text-xs font-semibold active:bg-red-50 transition-colors"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                      <path d="M10 11v6M14 11v6"/>
                      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                    </svg>
                    Vider
                  </button>
                ) : (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-500">Effacer tout ?</span>
                    <button
                      onClick={clearAll}
                      className="px-2.5 py-1.5 rounded-lg bg-red-500 text-white text-xs font-bold active:bg-red-600 transition-colors"
                    >
                      Oui
                    </button>
                    <button
                      onClick={() => setConfirmClear(false)}
                      className="px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-xs font-semibold active:bg-gray-200 transition-colors"
                    >
                      Non
                    </button>
                  </div>
                )}

                {allItems.length > 0 && (
                  <>
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
                  </>
                )}
              </div>
            </div>
          )}

          {/* "Tout est dispo" — seulement si des recettes sont sélectionnées mais tout est filtré */}
          {allItems.length === 0 && selectedRecipes.length > 0 && (
            <div className="text-center py-10">
              <div className="w-14 h-14 rounded-3xl bg-brand-50 flex items-center justify-center mx-auto mb-3">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
              </div>
              <p className="font-semibold text-gray-800 mb-1">Tout est dispo !</p>
              <p className="text-sm text-gray-400">Tout est déjà dans ton inventaire</p>
            </div>
          )}

          {/* Grouped list */}
          {allItems.length > 0 && (
            <div className="space-y-4">
              {sortedGroups.map(([catName, items]) => (
                <div key={catName}>
                  {/* Section header */}
                  <div className="flex items-center gap-2 mb-1.5 px-1">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                      {catName}
                    </span>
                    <span className="text-xs text-gray-400">
                      ({items.filter(i => i.isManuel ? !i.coche : !checked.has(i.nom)).length}/{items.length})
                    </span>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>

                  {/* Items card */}
                  <div className="bg-white rounded-2xl shadow-card overflow-hidden">
                    {items.map((item, i) => {
                      const done = item.isManuel ? item.coche : checked.has(item.nom)
                      const srcOpen = !item.isManuel && openSource === item.nom

                      return (
                        <div key={item.isManuel ? `m:${item.id}` : item.nom}>
                          <SwipeableItem onDelete={() => removeItem(item)} addBorderTop={i > 0}>
                          <div className={`flex items-center gap-3 px-4 py-3.5 transition-colors
                            ${done ? 'bg-gray-50/60' : ''}`}
                          >
                            {/* Check button */}
                            <button
                              onClick={() => item.isManuel ? toggleManuelCheck(item) : toggleCheck(item.nom)}
                              className="flex items-center gap-3 flex-1 min-w-0 text-left"
                            >
                              <span className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all duration-150
                                ${done ? 'bg-brand-600 border-brand-600' : 'border-gray-300'}`}>
                                {done && (
                                  <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
                                    <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                )}
                              </span>
                              <span className={`flex-1 min-w-0 text-sm font-medium transition-colors ${done ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                                {cap(item.nom)}
                              </span>
                            </button>

                            {/* Quantity badge */}
                            {item.quantite > 0 && (
                              <span className={`text-xs font-semibold rounded-lg px-2 py-1 flex-shrink-0 transition-colors
                                ${done ? 'bg-gray-100 text-gray-400' : 'bg-brand-50 text-brand-700'}`}>
                                {formatQty(item.quantite)}{item.unite ? ` ${item.unite}` : ''}
                              </span>
                            )}

                            {/* Source chevron (recettes) ou indicateur manuel */}
                            {!item.isManuel && item.recipes.length > 0 ? (
                              <button
                                onClick={() => setOpenSource(prev => prev === item.nom ? null : item.nom)}
                                className="w-7 h-7 flex-shrink-0 flex items-center justify-center text-gray-300 rounded-lg active:bg-gray-100 transition-colors"
                              >
                                <svg
                                  width="14" height="14" viewBox="0 0 24 24" fill="none"
                                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                                  className={`transition-transform duration-200 ${srcOpen ? 'rotate-180' : ''}`}
                                >
                                  <path d="M6 9l6 6 6-6"/>
                                </svg>
                              </button>
                            ) : item.isManuel ? (
                              <span className="w-7 h-7 flex-shrink-0 flex items-center justify-center">
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                </svg>
                              </span>
                            ) : (
                              <span className="w-7 h-7 flex-shrink-0" />
                            )}
                          </div>
                          </SwipeableItem>

                          {/* Source dropdown */}
                          {srcOpen && (
                            <div className="px-4 pb-3 pt-1 border-t border-gray-50 flex flex-wrap gap-1.5">
                              {item.recipes.map(name => (
                                <span key={name} className="text-xs bg-brand-50 text-brand-700 rounded-lg px-2 py-1 font-medium">
                                  {cap(name)}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Ajouter un ingrédient */}
          <button
            onClick={() => setShowAddModal(true)}
            className="w-full py-4 rounded-2xl border-2 border-dashed border-gray-200 text-gray-500 font-medium text-sm flex items-center justify-center gap-2 active:border-brand-300 active:text-brand-600 active:bg-brand-50 transition-all duration-150"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Ajouter un ingrédient
          </button>

          {remaining === 0 && allItems.length > 0 && (
            <div className="text-center py-4">
              <p className="text-sm font-semibold text-brand-700">✓ Liste complète !</p>
            </div>
          )}
        </>
      )}

      {showAddModal && (
        <AddIngredientModal
          onAdded={item => { setManuelItems(prev => [...prev, item]); setShowAddModal(false) }}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  )
}

// ── Modal ajout ingrédient ────────────────────────────────────────────────────

function AddIngredientModal({ onAdded, onClose }) {
  // Champ 1 — sélection depuis l'historique
  const [selectedLibre, setSelectedLibre] = useState(null) // objet ingredients_libres | null
  const [libreSearch, setLibreSearch] = useState('')
  const [libreOpen, setLibreOpen] = useState(false)
  // Champ 2 — saisie libre
  const [nomNouveau, setNomNouveau] = useState('')
  // Champs communs
  const [quantite, setQuantite] = useState('')
  const [unite, setUnite] = useState('')
  const [categorie, setCategorie] = useState(null) // { id, nom } | null
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [categories, setCategories] = useState([])
  const [libres, setLibres] = useState([])
  const [catOpen, setCatOpen] = useState(false)
  const [catActiveIndex, setCatActiveIndex] = useState(-1)

  const libreRef = useRef(null)
  const catRef = useRef(null)
  const catListRef = useRef(null)

  useEffect(() => {
    supabase.from('categories').select('id, nom').order('nom')
      .then(({ data }) => setCategories(data || []))
    supabase.from('ingredients_libres').select('*').order('nom')
      .then(({ data }) => setLibres(data || []))
  }, [])

  useEffect(() => {
    function handle(e) {
      if (libreRef.current && !libreRef.current.contains(e.target)) setLibreOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  useEffect(() => {
    function handle(e) {
      if (catRef.current && !catRef.current.contains(e.target)) setCatOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const filteredLibres = libreSearch.trim()
    ? libres.filter(l => l.nom.toLowerCase().includes(libreSearch.trim().toLowerCase()))
    : libres

  const catQuery = categorie?.nom || ''
  const filteredCats = catQuery.trim()
    ? categories.filter(c => c.nom.toLowerCase().includes(catQuery.toLowerCase()))
    : categories
  const showCreateCat = catQuery.trim() && !categories.find(c => c.nom.toLowerCase() === catQuery.trim().toLowerCase())

  const allCatItems = [
    ...filteredCats.map(c => ({ type: 'cat', id: c.id, nom: c.nom })),
    ...(showCreateCat ? [{ type: 'create', nom: catQuery.trim() }] : [])
  ]

  useEffect(() => { setCatActiveIndex(-1) }, [catQuery])

  useEffect(() => {
    if (catActiveIndex >= 0 && catListRef.current) {
      catListRef.current.children[catActiveIndex]?.scrollIntoView({ block: 'nearest' })
    }
  }, [catActiveIndex])

  function selectLibre(libre) {
    setSelectedLibre(libre)
    setLibreSearch('')
    setLibreOpen(false)
    setNomNouveau('') // mutuellement exclusif
    setQuantite(libre.quantite != null ? String(libre.quantite) : '')
    setUnite(libre.unite || '')
    const cat = libre.categorie_id ? categories.find(c => c.id === libre.categorie_id) : null
    setCategorie(cat ? { id: cat.id, nom: cat.nom } : null)
  }

  function clearLibre() {
    setSelectedLibre(null)
    setLibreSearch('')
    setQuantite('')
    setUnite('')
    setCategorie(null)
  }

  function handleCatKeyDown(e) {
    if (!catOpen) {
      if (e.key === 'ArrowDown') { setCatOpen(true); e.preventDefault() }
      return
    }
    if (allCatItems.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCatActiveIndex(prev => Math.min(prev + 1, allCatItems.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCatActiveIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (catActiveIndex < 0) return
      const item = allCatItems[catActiveIndex]
      setCategorie(item.type === 'create' ? { id: null, nom: item.nom } : { id: item.id, nom: item.nom })
      setCatOpen(false)
      setCatActiveIndex(-1)
    } else if (e.key === 'Escape') {
      setCatOpen(false)
      setCatActiveIndex(-1)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const nomTrimmed = (selectedLibre?.nom || nomNouveau.trim()).toLowerCase()
    if (!nomTrimmed) { setError('Sélectionne ou saisis un ingrédient'); return }
    setSaving(true)
    setError('')

    try {
      let categorie_id = categorie?.id || null
      if (!categorie_id && catQuery.trim()) {
        const { data: cat, error: catErr } = await supabase
          .from('categories')
          .upsert({ nom: catQuery.trim() }, { onConflict: 'nom' })
          .select().single()
        if (catErr) throw catErr
        categorie_id = cat.id
      }

      const qty = quantite ? parseFloat(quantite) : null
      const uniteTrimmed = unite.trim().toLowerCase() || null

      const { data: libre, error: libreErr } = await supabase
        .from('ingredients_libres')
        .upsert(
          { nom: nomTrimmed, quantite: qty, unite: uniteTrimmed, categorie_id },
          { onConflict: 'nom' }
        )
        .select().single()
      if (libreErr) throw libreErr

      const { data: manuel, error: manuelErr } = await supabase
        .from('liste_manuelle')
        .insert({
          ingredient_libre_id: libre.id,
          nom: nomTrimmed,
          quantite: qty,
          unite: uniteTrimmed,
          categorie_id,
          coche: false
        })
        .select('*, categories(nom)')
        .single()
      if (manuelErr) throw manuelErr

      onAdded(manuel)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  const hasValue = !!selectedLibre || !!nomNouveau.trim()

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-t-3xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-0">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 pb-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 text-base">Ajouter un ingrédient</h2>
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center active:bg-gray-200 transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 text-xs rounded-xl px-3 py-2.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/>
              </svg>
              {error}
            </div>
          )}

          {/* ── Champ 1 : Historique ── */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Depuis l'historique
            </label>

            {selectedLibre ? (
              /* Item sélectionné */
              <div className="flex items-center gap-2 bg-brand-50 border border-brand-100 rounded-xl px-3 py-2.5">
                <span className="flex-1 text-sm font-medium text-brand-800">{cap(selectedLibre.nom)}</span>
                <button
                  type="button"
                  onClick={clearLibre}
                  className="w-5 h-5 rounded-full bg-brand-100 flex items-center justify-center active:bg-brand-200 text-brand-500 transition-colors"
                >
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            ) : (
              /* Picker avec recherche */
              <div ref={libreRef} className="relative">
                <div className="relative flex items-center">
                  <svg className="absolute left-3 text-gray-400 pointer-events-none" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                  </svg>
                  <input
                    className="input-field !pl-9 w-full"
                    placeholder={libres.length === 0 ? 'Aucun historique' : `Rechercher parmi ${libres.length} ingrédient${libres.length > 1 ? 's' : ''}…`}
                    value={libreSearch}
                    onChange={e => { setLibreSearch(e.target.value); setLibreOpen(true) }}
                    onFocus={() => setLibreOpen(true)}
                    disabled={libres.length === 0}
                    autoComplete="off"
                  />
                </div>
                {libreOpen && filteredLibres.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-card-lg border border-gray-100 z-50 overflow-hidden max-h-44 overflow-y-auto">
                    {filteredLibres.map(l => (
                      <button
                        key={l.id}
                        type="button"
                        onMouseDown={() => selectLibre(l)}
                        className="w-full text-left px-3 py-2.5 text-sm text-gray-700 active:bg-gray-50 flex items-center justify-between gap-2"
                      >
                        <span>{cap(l.nom)}</span>
                        {l.quantite != null && (
                          <span className="text-xs text-gray-400 flex-shrink-0">
                            {l.quantite}{l.unite ? ` ${l.unite}` : ''}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Séparateur */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 font-semibold">ou</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* ── Champ 2 : Saisie libre ── */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Nouvel ingrédient
            </label>
            <input
              className="input-field w-full"
              placeholder="Ex: yaourt nature"
              value={nomNouveau}
              onChange={e => {
                setNomNouveau(e.target.value)
                if (e.target.value) { setSelectedLibre(null); setLibreSearch('') }
              }}
              autoComplete="off"
            />
          </div>

          {/* Quantité + Unité */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">Quantité</label>
              <input
                type="number"
                step="any"
                min="0"
                className="input-field"
                placeholder="Optionnel"
                value={quantite}
                onChange={e => setQuantite(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">Unité</label>
              <input
                className="input-field"
                placeholder="Ex: g, ml…"
                value={unite}
                onChange={e => setUnite(e.target.value.toLowerCase())}
              />
            </div>
          </div>

          {/* Catégorie */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">Catégorie</label>
            <div ref={catRef} className="relative">
              <div className="relative flex items-center">
                <svg className="absolute left-3 text-gray-400 pointer-events-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M4 6h16M4 12h8M4 18h12"/>
                </svg>
                <input
                  className="input-field !pl-8 w-full"
                  placeholder="Catégorie (optionnel)"
                  value={catQuery}
                  onChange={e => { setCategorie(e.target.value ? { id: null, nom: e.target.value } : null); setCatOpen(true) }}
                  onFocus={() => setCatOpen(true)}
                  onKeyDown={handleCatKeyDown}
                  autoComplete="off"
                />
                {catQuery && (
                  <button
                    type="button"
                    onMouseDown={() => { setCategorie(null); setCatOpen(false) }}
                    className="absolute right-2.5 text-gray-300 active:text-gray-500"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                  </button>
                )}
              </div>
              {catOpen && allCatItems.length > 0 && (
                <div ref={catListRef} className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-card-lg border border-gray-100 z-50 overflow-hidden max-h-40 overflow-y-auto">
                  {filteredCats.map((cat, i) => (
                    <button
                      key={cat.id}
                      type="button"
                      onMouseDown={() => { setCategorie({ id: cat.id, nom: cat.nom }); setCatOpen(false); setCatActiveIndex(-1) }}
                      className={`w-full text-left px-3 py-2.5 text-xs transition-colors
                        ${i === catActiveIndex ? 'bg-brand-50 text-brand-700 font-semibold'
                          : categorie?.id === cat.id ? 'bg-gray-50 text-brand-700 font-semibold'
                          : 'text-gray-700'}`}
                    >
                      {cat.nom}
                    </button>
                  ))}
                  {showCreateCat && (
                    <button
                      type="button"
                      onMouseDown={() => { setCategorie({ id: null, nom: catQuery.trim() }); setCatOpen(false); setCatActiveIndex(-1) }}
                      className={`w-full text-left px-3 py-2.5 text-xs font-semibold border-t border-gray-100 flex items-center gap-1.5 transition-colors
                        ${catActiveIndex === filteredCats.length ? 'bg-brand-50 text-brand-700' : 'text-brand-600'}`}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M12 5v14M5 12h14"/>
                      </svg>
                      Créer « {catQuery.trim()} »
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">
              Annuler
            </button>
            <button type="submit" disabled={saving || !hasValue} className="btn-primary flex-1">
              {saving ? <><ModalSpinner /> Ajout…</> : 'Ajouter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Swipe-to-delete ──────────────────────────────────────────────────────────

function SwipeableItem({ onDelete, addBorderTop, children }) {
  const DELETE_W = 80
  const offsetRef = useRef(0)
  const [offsetState, setOffsetState] = useState(0)
  const [anim, setAnim] = useState(false)
  const startX = useRef(0)
  const startY = useRef(0)
  const startOffset = useRef(0)
  const isHoriz = useRef(null)
  const snapToRef = useRef(null)
  const containerRef = useRef(null)

  function snapTo(target) {
    setAnim(true)
    offsetRef.current = target
    setOffsetState(target)
  }
  snapToRef.current = snapTo

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    function onTouchStart(e) {
      if (e.target.closest('[data-nodelete]')) return
      startX.current = e.touches[0].clientX
      startY.current = e.touches[0].clientY
      startOffset.current = offsetRef.current
      isHoriz.current = null
      setAnim(false)
    }

    function onTouchMove(e) {
      const dx = e.touches[0].clientX - startX.current
      const dy = e.touches[0].clientY - startY.current

      if (isHoriz.current === null) {
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
          isHoriz.current = Math.abs(dx) > Math.abs(dy)
        }
        return
      }
      if (!isHoriz.current) return

      e.preventDefault()
      const clamped = Math.min(0, Math.max(startOffset.current + dx, -DELETE_W))
      offsetRef.current = clamped
      setOffsetState(clamped)
    }

    function onTouchEnd() {
      if (!isHoriz.current) return
      snapToRef.current(offsetRef.current < -DELETE_W * 0.4 ? -DELETE_W : 0)
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    el.addEventListener('touchcancel', onTouchEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [])

  return (
    <div ref={containerRef} className="relative overflow-hidden">
      {/* Zone rouge révélée au swipe */}
      <div
        data-nodelete
        className="absolute inset-y-0 right-0 bg-red-500 flex items-center justify-center"
        style={{ width: DELETE_W }}
      >
        <button
          type="button"
          data-nodelete
          onClick={() => { snapTo(0); onDelete() }}
          className="flex flex-col items-center gap-0.5 text-white px-3 h-full justify-center"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6M14 11v6"/>
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
          </svg>
          <span className="text-[10px] font-bold">Supprimer</span>
        </button>
      </div>
      {/* Contenu glissant */}
      <div
        className={`bg-white${addBorderTop ? ' border-t border-gray-50' : ''}`}
        style={{
          transform: `translateX(${offsetState}px)`,
          transition: anim ? 'transform 0.2s ease-out' : 'none',
          willChange: 'transform',
        }}
        onTransitionEnd={() => setAnim(false)}
      >
        {children}
      </div>
    </div>
  )
}

function ModalSpinner() {
  return (
    <svg className="animate-spin inline-block mr-1" width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" strokeOpacity="0.3"/>
      <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="3" strokeLinecap="round"/>
    </svg>
  )
}

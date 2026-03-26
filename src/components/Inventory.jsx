import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s

export default function Inventory() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)

  const [categories, setCategories] = useState([])
  const [loadingCats, setLoadingCats] = useState(true)
  const [catOpen, setCatOpen] = useState(false)

  useEffect(() => { fetchItems(); fetchCategories() }, [])

  async function fetchItems() {
    setLoading(true)
    const { data } = await supabase.from('inventaire').select('*').order('nom')
    setItems(data || [])
    setLoading(false)
  }

  async function fetchCategories() {
    setLoadingCats(true)
    const { data } = await supabase.from('categories').select('*').order('nom')
    setCategories(data || [])
    setLoadingCats(false)
  }

  async function addItem(nomRaw) {
    const nom = nomRaw.trim().toLowerCase()
    if (!nom || items.find(i => i.nom === nom)) return
    setSaving(true)
    const { data, error } = await supabase.from('inventaire').insert({ nom }).select().single()
    if (!error && data) {
      setItems(prev => [...prev, data].sort((a, b) => a.nom.localeCompare(b.nom)))
    }
    setSaving(false)
    setInput('')
  }

  async function removeItem(id) {
    await supabase.from('inventaire').delete().eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  async function deleteCategory(id, nom) {
    if (!confirm(`Supprimer la catégorie « ${nom} » ?\nLes ingrédients associés ne seront plus catégorisés.`)) return
    await supabase.from('categories').delete().eq('id', id)
    setCategories(prev => prev.filter(c => c.id !== id))
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') { e.preventDefault(); addItem(input) }
  }

  async function handlePaste(e) {
    e.preventDefault()
    const text = e.clipboardData.getData('text')
    const lines = text.split(/[,\n]+/).map(s => s.trim()).filter(Boolean)
    if (lines.length > 1) {
      setSaving(true)
      const newItems = lines
        .map(l => l.toLowerCase())
        .filter(n => n && !items.find(i => i.nom === n))
        .map(nom => ({ nom }))
      if (newItems.length > 0) {
        const { data } = await supabase.from('inventaire').insert(newItems).select()
        if (data) setItems(prev => [...prev, ...data].sort((a, b) => a.nom.localeCompare(b.nom)))
      }
      setInput('')
      setSaving(false)
    } else {
      setInput(text)
    }
  }

  return (
    <div className="p-4 pb-6 space-y-4">
      {/* Info banner */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3">
        <svg className="flex-shrink-0 mt-0.5" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/>
        </svg>
        <p className="text-xs text-amber-800 leading-relaxed">
          Ces ingrédients sont exclus de ta liste de courses automatiquement.
        </p>
      </div>

      {/* Input inventaire */}
      <div className="space-y-1.5">
        <div className="flex gap-2">
          <input
            className="input-field flex-1"
            placeholder="Ex: huile d'olive, sel, poivre…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            disabled={saving}
          />
          <button
            onClick={() => addItem(input)}
            disabled={saving || !input.trim()}
            className="btn-primary px-5 flex-shrink-0"
          >
            {saving
              ? <Spinner />
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
            }
          </button>
        </div>
        <p className="text-xs text-gray-400 px-1">Astuce : colle une liste séparée par virgules</p>
      </div>

      {/* Inventaire */}
      {loading ? (
        <div className="flex flex-wrap gap-2 pt-1">
          {[80, 100, 60, 120, 90, 70].map((w, i) => (
            <div key={i} className="h-8 rounded-full bg-gray-100 animate-pulse" style={{ width: w }} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-10">
          <div className="w-14 h-14 rounded-3xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
              <path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>
            </svg>
          </div>
          <p className="font-semibold text-gray-700 mb-1">Inventaire vide</p>
          <p className="text-sm text-gray-400">Ajoute ce que tu as déjà chez toi</p>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {items.length} article{items.length > 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {items.map(item => (
              <span
                key={item.id}
                className="inline-flex items-center gap-1.5 bg-white shadow-card text-gray-700 rounded-full pl-3.5 pr-2 py-1.5 text-sm font-medium"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-brand-400 flex-shrink-0" />
                {cap(item.nom)}
                <button
                  onClick={() => removeItem(item.id)}
                  className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center ml-0.5 active:bg-red-100 active:text-red-500 text-gray-400 transition-colors"
                >
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Gestion des catégories ── */}
      <div className="pt-2">
        <button
          onClick={() => setCatOpen(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-white shadow-card text-sm font-semibold text-gray-700 active:bg-gray-50 transition-colors"
        >
          <span className="flex items-center gap-2">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 6h16M4 12h8M4 18h12"/>
            </svg>
            Catégories
            {!loadingCats && (
              <span className="text-xs font-medium text-gray-400">{categories.length}</span>
            )}
          </span>
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
            className={`transition-transform duration-200 ${catOpen ? 'rotate-180' : ''}`}
          >
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </button>

        {catOpen && (
          <div className="mt-2 bg-white rounded-2xl shadow-card overflow-hidden">
            {loadingCats ? (
              <div className="p-4 space-y-2">
                {[1,2,3].map(i => <div key={i} className="h-10 rounded-xl bg-gray-100 animate-pulse" />)}
              </div>
            ) : categories.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Aucune catégorie</p>
            ) : (
              <ul>
                {categories.map((cat, i) => (
                  <li
                    key={cat.id}
                    className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-gray-50' : ''}`}
                  >
                    <span className="flex-1 text-sm text-gray-800">{cat.nom}</span>
                    <button
                      onClick={() => deleteCategory(cat.id, cat.nom)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-300 active:bg-red-50 active:text-red-400 transition-colors"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                        <path d="M10 11v6M14 11v6"/>
                        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" strokeOpacity="0.3"/>
      <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="3" strokeLinecap="round"/>
    </svg>
  )
}

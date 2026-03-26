import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Inventory() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchItems() }, [])

  async function fetchItems() {
    setLoading(true)
    const { data } = await supabase.from('inventaire').select('*').order('nom')
    setItems(data || [])
    setLoading(false)
  }

  async function addItem(nomRaw) {
    const nom = nomRaw.trim().toLowerCase()
    if (!nom) return
    if (items.find(i => i.nom === nom)) return
    setSaving(true)
    const { data, error } = await supabase
      .from('inventaire')
      .insert({ nom })
      .select()
      .single()
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

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      addItem(input)
    }
  }

  // Handle multi-paste (comma or newline separated)
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
        if (data) {
          setItems(prev => [...prev, ...data].sort((a, b) => a.nom.localeCompare(b.nom)))
        }
      }
      setInput('')
      setSaving(false)
    } else {
      setInput(text)
    }
  }

  return (
    <div className="p-4 space-y-4">
      <p className="text-sm text-gray-500">
        Ce que tu as déjà chez toi — ces ingrédients seront exclus de la liste de courses.
      </p>

      {/* Input */}
      <div className="flex gap-2">
        <input
          className="flex-1 px-3 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          placeholder="Ex: huile d'olive, sel…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          disabled={saving}
        />
        <button
          onClick={() => addItem(input)}
          disabled={saving || !input.trim()}
          className="px-4 py-2.5 rounded-xl bg-brand-600 text-white font-semibold text-sm active:bg-brand-700 disabled:opacity-50"
        >
          Ajouter
        </button>
      </div>
      <p className="text-xs text-gray-400 -mt-2">Astuce : colle une liste séparée par virgules pour ajouter en masse</p>

      {loading ? (
        <p className="text-center text-gray-400 py-8">Chargement…</p>
      ) : items.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <div className="text-4xl mb-2">📦</div>
          <p>Inventaire vide</p>
        </div>
      ) : (
        <ul className="space-y-1">
          {items.map(item => (
            <li key={item.id} className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0">
              <span className="text-lg">✓</span>
              <span className="flex-1 text-gray-800">{item.nom}</span>
              <button
                onClick={() => removeItem(item.id)}
                className="text-gray-300 active:text-red-500 transition-colors text-lg px-1"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

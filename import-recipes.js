import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const SUPABASE_URL = 'https://oxqppowhhrfkfficcmnu.supabase.co'
const SUPABASE_KEY = 'sb_publishable_KSStmTK341eZrJ0WcYOBkg_RICVWmEA'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const recettes = JSON.parse(readFileSync(join(__dirname, 'recettes.json'), 'utf-8'))

async function main() {
  // 1. Collecter toutes les catégories uniques
  const catNames = [...new Set(
    recettes.flatMap(r => r.ingredients.map(i => i.categorie).filter(Boolean))
  )]

  console.log(`Catégories à importer : ${catNames.join(', ')}`)

  // 2. Upsert des catégories
  const { data: cats, error: catErr } = await supabase
    .from('categories')
    .upsert(catNames.map(nom => ({ nom })), { onConflict: 'nom' })
    .select()

  if (catErr) {
    console.error('Erreur catégories :', catErr.message)
    process.exit(1)
  }

  const catMap = {}
  for (const cat of cats) catMap[cat.nom] = cat.id
  console.log(`✓ ${cats.length} catégorie(s) importée(s)`)

  // 3. Importer chaque recette
  for (const recette of recettes) {
    // Insérer la recette
    const { data: rec, error: recErr } = await supabase
      .from('recettes')
      .insert({ nom: recette.nom, portions: recette.portions })
      .select()
      .single()

    if (recErr) {
      console.error(`Erreur recette "${recette.nom}" :`, recErr.message)
      continue
    }

    console.log(`✓ Recette "${rec.nom}" créée (id: ${rec.id})`)

    // Insérer les ingrédients
    const ingRows = recette.ingredients.map(ing => ({
      nom: ing.nom.toLowerCase(),
      quantite: ing.quantite ?? null,
      unite: ing.unite || null,
      recette_id: rec.id,
      categorie_id: ing.categorie ? (catMap[ing.categorie] ?? null) : null
    }))

    if (ingRows.length > 0) {
      const { error: ingErr } = await supabase.from('ingredients').insert(ingRows)
      if (ingErr) {
        console.error(`  Erreur ingrédients pour "${rec.nom}" :`, ingErr.message)
      } else {
        console.log(`  ✓ ${ingRows.length} ingrédient(s) ajouté(s)`)
      }
    }
  }

  console.log('\nImport terminé.')
}

main()

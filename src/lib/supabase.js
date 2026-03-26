import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://oxqppowhhrfkfficcmnu.supabase.co'
const SUPABASE_KEY = 'sb_publishable_KSStmTK341eZrJ0WcYOBkg_RICVWmEA'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

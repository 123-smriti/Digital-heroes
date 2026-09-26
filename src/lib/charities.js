import { supabase } from './supabaseClient'

export async function fetchCharities({ search = '' } = {}) {
  let query = supabase.from('charities').select('*').order('is_featured', { ascending: false })
  if (search) query = query.ilike('name', `%${search}%`)
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function fetchFeaturedCharity() {
  const { data, error } = await supabase
    .from('charities')
    .select('*')
    .eq('is_featured', true)
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function fetchCharity(id) {
  const { data, error } = await supabase.from('charities').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

export async function createCharity(payload) {
  const { data, error } = await supabase.from('charities').insert(payload).select().single()
  if (error) throw error
  return data
}

export async function updateCharity(id, payload) {
  const { error } = await supabase.from('charities').update(payload).eq('id', id)
  if (error) throw error
}

export async function deleteCharity(id) {
  const { error } = await supabase.from('charities').delete().eq('id', id)
  if (error) throw error
}

import { supabase } from './supabaseClient'

const BUCKET = 'winner-proofs'

/** Uploads a winner's score screenshot and returns its public URL. */
export async function uploadWinnerProof(winnerId, file) {
  const ext = file.name.split('.').pop()
  const path = `${winnerId}/${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
  })
  if (uploadError) throw uploadError

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)

  const { error: updateError } = await supabase
    .from('winners')
    .update({ proof_url: data.publicUrl })
    .eq('id', winnerId)
  if (updateError) throw updateError

  return data.publicUrl
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Tables } from '../../lib/database.types'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/useAuth'

export type UserSettings = Tables<'user_settings'>

/** Mirrors the column defaults, used until the row loads (it is created by a trigger on signup). */
export const DEFAULT_SETTINGS: Omit<UserSettings, 'user_id'> = {
  voice: 'en-US-AndrewNeural',
  slow_rate: '-25%',
  send_audio_to_llm: true,
  privacy_ack: false,
  azure_minutes_cap: 300,
}

export function useUserSettings() {
  return useQuery({
    queryKey: ['user_settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('user_settings').select('*').maybeSingle()
      if (error) throw error
      return data
    },
  })
}

/** Saves some of the owner's settings. */
export function useUpdateUserSettings() {
  const queryClient = useQueryClient()
  const { session } = useAuth()
  return useMutation({
    mutationFn: async (patch: Partial<Omit<UserSettings, 'user_id'>>) => {
      const userId = session?.user.id
      if (!userId) throw new Error('not signed in')
      // Updates need a filter (safeupdate); RLS limits it to the owner's row anyway.
      const { error } = await supabase.from('user_settings').update(patch).eq('user_id', userId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['user_settings'] }),
  })
}

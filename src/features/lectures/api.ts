import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Tables, TablesInsert, TablesUpdate } from '../../lib/database.types'
import type { ParsedDeck } from '../../lib/pptx'
import { supabase } from '../../lib/supabase'
import { slideImagesFolder } from '../../lib/storagePaths'
import { importDeck } from './importDeck'
import { renderSlideImages, type RenderProgress } from './slideImages'

export type Lecture = Tables<'lectures'>
export type Slide = Tables<'slides'>
export type Sentence = Tables<'sentences'>
export type LectureSummary = Lecture & { slideCount: number }
export type SlideWithSentences = Slide & { sentences: Sentence[] }
export type LectureDeck = Lecture & { slides: SlideWithSentences[] }

export type LectureFieldsInput = Pick<TablesInsert<'lectures'>, 'title' | 'audience' | 'target_minutes'>

export const lectureKeys = {
  all: ['lectures'] as const,
  detail: (id: string) => ['lectures', id] as const,
}

export function useLectures() {
  return useQuery({
    queryKey: lectureKeys.all,
    queryFn: async (): Promise<LectureSummary[]> => {
      const { data, error } = await supabase
        .from('lectures')
        .select('*, slides(count)')
        .order('updated_at', { ascending: false })
      if (error) throw error
      return data.map(({ slides, ...lecture }) => ({ ...lecture, slideCount: slides[0]?.count ?? 0 }))
    },
  })
}

/** A lecture with its slides and their sentences, both in position order. Null when it does not exist. */
export async function fetchLectureDeck(id: string): Promise<LectureDeck | null> {
  const { data, error } = await supabase
    .from('lectures')
    .select('*, slides(*, sentences(*))')
    .eq('id', id)
    .order('position', { referencedTable: 'slides' })
    .order('position', { referencedTable: 'slides.sentences' })
    .maybeSingle()
  if (error) throw error
  return data
}

export function useLectureDeck(id: string) {
  return useQuery({ queryKey: lectureKeys.detail(id), queryFn: () => fetchLectureDeck(id) })
}

export function useCreateLecture() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: LectureFieldsInput): Promise<Lecture> => {
      const { data, error } = await supabase.from('lectures').insert(input).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: lectureKeys.all }),
  })
}

export function useUpdateLecture() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: TablesUpdate<'lectures'> }): Promise<Lecture> => {
      const { data, error } = await supabase.from('lectures').update(patch).eq('id', id).select().single()
      if (error) throw error
      return data
    },
    onSuccess: (lecture) => {
      queryClient.setQueryData<LectureDeck | null>(lectureKeys.detail(lecture.id), (deck) =>
        deck ? { ...deck, ...lecture } : deck,
      )
      return queryClient.invalidateQueries({ queryKey: lectureKeys.all, exact: true })
    },
  })
}

/** Imports a parsed deck into a lecture that has no slides yet. */
export function useImportDeck() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ lecture, file, deck }: { lecture: Lecture; file: File; deck: ParsedDeck }) => importDeck(lecture, file, deck),
    // Prefix match: the list (slide counts) and this lecture's deck.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: lectureKeys.all }),
  })
}

/** Renders a PDF export of the deck into slide images. */
export function useRenderSlideImages() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ lecture, pdf, onProgress }: { lecture: LectureDeck; pdf: File; onProgress: (p: RenderProgress) => void }) =>
      renderSlideImages(lecture, pdf, onProgress),
    onSettled: (_, __, { lecture }) => queryClient.invalidateQueries({ queryKey: lectureKeys.detail(lecture.id) }),
  })
}

/** Signed URLs for the deck's slide images, by storage path (private bucket, valid for an hour). */
export function useSlideImageUrls(deck: LectureDeck | null | undefined) {
  const paths = deck?.slides.flatMap((slide) => (slide.image_path ? [slide.image_path] : [])) ?? []
  return useQuery({
    queryKey: ['slide-images', deck?.id, paths],
    enabled: paths.length > 0,
    staleTime: 50 * 60_000,
    gcTime: 55 * 60_000,
    queryFn: async (): Promise<Map<string, string>> => {
      const { data, error } = await supabase.storage.from('slides').createSignedUrls(paths, 60 * 60)
      if (error) throw error
      return new Map(data.flatMap((item) => (item.path && item.signedUrl ? [[item.path, item.signedUrl] as const] : [])))
    },
  })
}

/** Deletes the lecture's files first (the rows cascade, storage does not), then the lecture. */
export function useDeleteLecture() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (lecture: Lecture): Promise<void> => {
      const folder = slideImagesFolder(lecture.user_id, lecture.id)
      const { data: images, error: listError } = await supabase.storage.from('slides').list(folder, { limit: 1000 })
      if (listError) throw listError
      if (images.length) {
        const { error } = await supabase.storage.from('slides').remove(images.map((file) => `${folder}/${file.name}`))
        if (error) throw error
      }
      if (lecture.pptx_path) {
        const { error } = await supabase.storage.from('pptx').remove([lecture.pptx_path])
        if (error) throw error
      }
      const { error } = await supabase.from('lectures').delete().eq('id', lecture.id)
      if (error) throw error
    },
    onSuccess: (_, lecture) => {
      queryClient.removeQueries({ queryKey: lectureKeys.detail(lecture.id) })
      return queryClient.invalidateQueries({ queryKey: lectureKeys.all, exact: true })
    },
  })
}

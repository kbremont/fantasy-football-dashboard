import { supabase, authReady } from './supabase'

// Supabase Storage bucket for draft media
const BUCKET = 'draft-media'

// Base URL for public storage access
const STORAGE_URL = `https://fnphwakozzgoqpoidpvq.supabase.co/storage/v1/object/public/${BUCKET}`

export interface MediaItem {
  name: string
  url: string
  isVideo: boolean
  size: number
}

// Video file extensions
const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.webm', '.m4v']

/**
 * Check if a filename is a video based on extension
 */
export function isVideo(filename: string): boolean {
  const lower = filename.toLowerCase()
  return VIDEO_EXTENSIONS.some(ext => lower.endsWith(ext))
}

/**
 * Get the public URL for a file in the draft-media bucket
 */
export function getMediaUrl(path: string): string {
  return `${STORAGE_URL}/${path}`
}

/**
 * Get the cover image URL for a draft year
 */
export function getDraftCoverUrl(year: number): string {
  return getMediaUrl(`drafts/${year}/cover.jpg`)
}

/**
 * List all media files for a specific draft year
 * Excludes the cover.jpg file (used separately as hero)
 */
export async function listDraftMedia(year: number): Promise<MediaItem[]> {
  await authReady

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(`drafts/${year}`, {
      sortBy: { column: 'name', order: 'asc' }
    })

  if (error) {
    console.error('Error listing draft media:', error)
    return []
  }

  if (!data) return []

  // Filter out cover.jpg and any folders, map to MediaItem
  return data
    .filter(file =>
      file.name !== 'cover.jpg' &&
      file.name !== '.emptyFolderPlaceholder' &&
      file.metadata // Has metadata = is a file, not folder
    )
    .map(file => ({
      name: file.name,
      url: getMediaUrl(`drafts/${year}/${file.name}`),
      isVideo: isVideo(file.name),
      size: file.metadata?.size || 0
    }))
}

/**
 * Check if a draft year has any gallery media (excluding cover)
 */
export async function hasDraftMedia(year: number): Promise<boolean> {
  const media = await listDraftMedia(year)
  return media.length > 0
}

const YT_REGEX =
  /^(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})(?:[?&#].*)?$/

export function isValidYouTubeUrl(url: string): boolean {
  return YT_REGEX.test(url.trim())
}

export function extractVideoId(url: string): string | null {
  const match = url.trim().match(YT_REGEX)
  return match ? match[1] : null
}

export function getThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
}

import type { PublishedVideo } from '@shared/types'
import { computeVideoStats } from './videoStats'

// Common French function words — filtered out by default so the ranking surfaces actual themes
// (products, formats, subjects) instead of "je", "et", "à", "le"...
const FRENCH_STOPWORDS = new Set([
  'je',
  'tu',
  'il',
  'elle',
  'on',
  'nous',
  'vous',
  'ils',
  'elles',
  'le',
  'la',
  'les',
  'l',
  'un',
  'une',
  'des',
  'de',
  'du',
  'd',
  'et',
  'ou',
  'ni',
  'mais',
  'donc',
  'or',
  'car',
  'à',
  'au',
  'aux',
  'en',
  'dans',
  'sur',
  'sous',
  'avec',
  'sans',
  'par',
  'pour',
  'chez',
  'entre',
  'vers',
  'contre',
  'ce',
  'cet',
  'cette',
  'ces',
  'mon',
  'ma',
  'mes',
  'ton',
  'ta',
  'tes',
  'son',
  'sa',
  'ses',
  'notre',
  'nos',
  'votre',
  'vos',
  'leur',
  'leurs',
  'que',
  'qui',
  'quoi',
  'dont',
  'où',
  'comment',
  'pourquoi',
  'quand',
  'est',
  'es',
  'suis',
  'sont',
  'étais',
  'était',
  'être',
  'ai',
  'as',
  'a',
  'avons',
  'avez',
  'ont',
  'avoir',
  'ne',
  'pas',
  'plus',
  'moins',
  'très',
  'trop',
  'peu',
  'tout',
  'tous',
  'toute',
  'toutes',
  'comme',
  'si',
  'se',
  'ça',
  'cela',
  'ceci',
  'y',
  'c',
  'j',
  'n',
  'qu',
  's',
  't',
  'm'
])

export interface WordUsage {
  word: string
  count: number
  avgViews: number | null
  videos: PublishedVideo[]
}

// How many videos' worth of "trust" the channel-wide average is worth when correcting a word's
// own average — 3 means a word backed by 3 videos already counts about as much as the baseline.
const BIAS_CORRECTION_WEIGHT = 3

/**
 * A word used by only one or two videos can have a wildly high raw average — one viral video
 * using it once would otherwise rank it above words that consistently perform well across many
 * videos. This pulls the average toward the channel-wide baseline in proportion to how little
 * evidence (how few videos) backs it, so a single lucky video stops dominating the ranking.
 */
export function biasCorrectedAvgViews(usage: WordUsage, globalAvgViews: number): number {
  const avg = usage.avgViews ?? globalAvgViews
  const weight = usage.count / (usage.count + BIAS_CORRECTION_WEIGHT)
  return weight * avg + (1 - weight) * globalAvgViews
}

function extractWords(text: string): string[] {
  return text.toLowerCase().match(/[a-zà-ÿ]+/gi) ?? []
}

/**
 * Ranks words appearing in published video titles by how many distinct videos use them — a word
 * repeated multiple times in a single title still only counts that video once, mirroring how tag
 * usage is counted.
 */
export function computeWordUsage(videos: PublishedVideo[], excludeStopwords: boolean): WordUsage[] {
  const videosByWord = new Map<string, PublishedVideo[]>()

  for (const video of videos) {
    if (!video.title) continue
    const words = new Set(extractWords(video.title))
    for (const word of words) {
      if (word.length < 2) continue
      if (excludeStopwords && FRENCH_STOPWORDS.has(word)) continue
      const list = videosByWord.get(word)
      if (list) list.push(video)
      else videosByWord.set(word, [video])
    }
  }

  return [...videosByWord.entries()].map(([word, vids]) => ({
    word,
    count: vids.length,
    avgViews: computeVideoStats(vids).avgViews,
    videos: vids
  }))
}

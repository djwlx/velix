import { Hono } from 'hono'
import { env } from 'hono/adapter'
import { create115Sdk, listPictures, pickRandom, resolveDownloadUrl, type FileItem } from './sdk/115'

type Bindings = {
  '115_COOKIE'?: string
  '115_CID_LIST'?: string
}
const app = new Hono<{ Bindings: Bindings }>()

const parseFolders = (raw: string | undefined) => {
  if (!raw?.trim()) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.filter((item): item is string => typeof item === 'string' && /^\d{1,64}$/.test(item.trim())).map(item => item.trim()).slice(0, 128)
  } catch { /* comma-separated configuration is also supported */ }
  const list = raw.trim()
  if (/^\[\s*'?\d{1,64}'?(?:\s*,\s*'?\d{1,64}'?)*\s*\]$/.test(list)) {
    return list.slice(1, -1).split(',').map(item => item.trim().replace(/^'|'$/g, '')).filter(Boolean).slice(0, 128)
  }
  return list.split(',').map(item => item.trim()).filter(item => /^\d{1,64}$/.test(item)).slice(0, 128)
}

app.get('/', c => c.text('Hello Hono!'))
app.get('/pic', async c => {
  const config = env<Bindings>(c)
  const cookie = config['115_COOKIE']?.trim()
  const folders = parseFolders(config['115_CID_LIST'])
  const userAgent = c.req.header('User-Agent')?.trim()
  if (!cookie || !folders.length) return c.json({ error: '115 is not configured' }, 500)
  if (cookie.length > 16_384) return c.json({ error: 'invalid 115 configuration' }, 500)
  if (!userAgent || userAgent.length > 512) return c.json({ error: 'User-Agent is required' }, 400)
  try {
    const sdk = create115Sdk(cookie, userAgent)
    const lists = await Promise.all(folders.map(folder => listPictures(sdk, folder)))
    const selected = pickRandom(lists.flat()) as (FileItem & { parentCid: string }) | undefined
    if (!selected?.pc) return c.json({ error: 'no pictures found' }, 404)
    const meta = await resolveDownloadUrl(sdk, selected.pc)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15_000)
    let image: Response
    try {
      image = await fetch(meta.url, { headers: { 'User-Agent': userAgent }, signal: controller.signal })
    } finally {
      clearTimeout(timer)
    }
    if (!image.ok) return c.json({ error: 'image download failed' }, 502)
    const contentLength = Number(image.headers.get('Content-Length') || 0)
    if (contentLength > 20 * 1024 * 1024) return c.json({ error: 'image is too large' }, 502)
    const reportedContentType = image.headers.get('Content-Type')?.split(';', 1)[0]?.toLowerCase() || ''
    const extension = meta.fileName.toLowerCase().match(/\.(jpe?g|png|gif|webp|bmp|avif)$/)?.[1]
    const extensionContentType = extension === 'jpg' || extension === 'jpeg' ? 'image/jpeg' : extension ? `image/${extension}` : ''
    const contentType = reportedContentType.startsWith('image/') ? reportedContentType : reportedContentType === 'application/octet-stream' ? extensionContentType : ''
    if (!contentType) return c.json({ error: 'remote file is not an image' }, 502)
    return new Response(image.body, { status: 200, headers: { 'Content-Type': contentType, 'Cache-Control': 'no-store' } })
  } catch {
    return c.json({ error: 'unable to fetch picture' }, 502)
  }
})

export default app

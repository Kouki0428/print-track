// 视频链接抓取：仅支持哔哩哔哩（x/web-interface/view + 标准 WBI 签名）
// 健壮性加固：
//  - 访问首页收集 cookie 罐（buvid3 / b_nut 等），再叠加 spi 的 buvid3/buvid4，规避 -412 拦截
//  - Accept-Encoding: identity，避免 gzip 响应导致 JSON.parse 失败
//  - 链接识别扩展：BV 号（任意位置）/ av 号 / b23.tv 短链（跟随重定向）
//  - 清晰报错：带回 B 站 code 与 message，便于用户反馈真实失败原因
import http from 'node:http'
import https from 'node:https'
import { URL } from 'node:url'
import crypto from 'node:crypto'

export interface FetchedVideoStats {
  platform: string
  views: number
  likes: number
  comments: number
  title?: string
  published_at?: string
}

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const COMMON_HEADERS = {
  'User-Agent': UA,
  Accept: 'application/json, text/plain, */*',
  'Accept-Encoding': 'identity',
  Referer: 'https://www.bilibili.com',
}

// ---------- cookie 罐（首页 + spi 双来源，缓存 1h） ----------
let cookieCache: { value: string; ts: number } | null = null

function collectCookies(url: string): Promise<string> {
  return new Promise((resolve) => {
    const u = new URL(url)
    const lib = u.protocol === 'https:' ? https : http
    const req = lib.request(
      url,
      { method: 'GET', headers: { ...COMMON_HEADERS, 'Accept-Encoding': 'identity' } },
      (res) => {
        res.resume() // 丢弃 body，只取 Set-Cookie
        const setCookies = res.headers['set-cookie'] || []
        const jar = setCookies.map((c) => c.split(';')[0]).join('; ')
        resolve(jar)
      },
    )
    req.on('error', () => resolve(''))
    req.setTimeout(8000, () => {
      req.destroy()
      resolve('')
    })
    req.end()
  })
}

async function getCookie(): Promise<string> {
  if (cookieCache && Date.now() - cookieCache.ts < 3600_000) return cookieCache.value
  let jar = ''
  try {
    jar = await collectCookies('https://www.bilibili.com')
  } catch {
    jar = ''
  }
  let buvid = ''
  try {
    const sp = await getJson('https://api.bilibili.com/x/frontend/finger/spi')
    const b3 = sp?.data?.b_3
    const b4 = sp?.data?.b_4
    buvid = [b3 && `buvid3=${b3}`, b4 && `buvid4=${b4}`].filter(Boolean).join('; ')
  } catch {
    buvid = ''
  }
  const combined = [jar, buvid].filter(Boolean).join('; ')
  cookieCache = { value: combined, ts: Date.now() }
  return combined
}

// ---------- 通用 GET JSON（自动跟随重定向） ----------
function getJson(url: string, extra: Record<string, string> = {}, redirects = 0): Promise<any> {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    const lib = u.protocol === 'https:' ? https : http
    const req = lib.request(
      url,
      { method: 'GET', headers: { ...COMMON_HEADERS, ...extra } },
      (res) => {
        const code = res.statusCode || 0
        if ([301, 302, 303, 307, 308].includes(code) && res.headers.location && redirects < 4) {
          res.resume()
          const next = new URL(res.headers.location, url).toString()
          return resolve(getJson(next, extra, redirects + 1))
        }
        let data = ''
        res.on('data', (c) => (data += c))
        res.on('end', () => {
          try {
            resolve(JSON.parse(data))
          } catch (e) {
            reject(new Error('返回内容无法解析为 JSON（可能被拦截或网络异常）：' + String(e)))
          }
        })
      },
    )
    req.on('error', reject)
    req.setTimeout(12000, () => req.destroy(new Error('请求超时（12s）')))
    req.end()
  })
}

// ---------- 仅解析最终 URL（用于 b23.tv 短链跳转，不解析 body） ----------
function resolveFinalUrl(url: string, redirects = 0): Promise<string> {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    const lib = u.protocol === 'https:' ? https : http
    const req = lib.request(url, { method: 'GET', headers: COMMON_HEADERS }, (res) => {
      const code = res.statusCode || 0
      res.resume() // 丢弃 body，只关心 Location
      if ([301, 302, 303, 307, 308].includes(code) && res.headers.location && redirects < 5) {
        const next = new URL(res.headers.location, url).toString()
        return resolve(resolveFinalUrl(next, redirects + 1))
      }
      resolve(url)
    })
    req.on('error', reject)
    req.setTimeout(12000, () => req.destroy(new Error('请求超时（12s）')))
    req.end()
  })
}

// ---------- B 站 WBI 签名 ----------
const MIXIN_KEY_ENC_TAB = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39,
  12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63,
  57, 62, 11, 36, 20, 34, 44, 52,
]

function getMixinKey(orig: string): string {
  return MIXIN_KEY_ENC_TAB.map((n) => orig[n]).join('').slice(0, 32)
}

async function getWbiKeys(): Promise<{ imgKey: string; subKey: string }> {
  const data = await getJson('https://api.bilibili.com/x/web-interface/nav')
  if (data.code !== 0 || !data.data?.wbi_img)
    throw new Error('B站获取 WBI 密钥失败：' + (data.message || data.code || '未知'))
  const img = (data.data.wbi_img.img_url.split('/').pop() || '').split('.')[0]
  const sub = (data.data.wbi_img.sub_url.split('/').pop() || '').split('.')[0]
  return { imgKey: img, subKey: sub }
}

function signWbi(params: Record<string, string | number>, imgKey: string, subKey: string): string {
  const mixinKey = getMixinKey(imgKey + subKey)
  const wts = Math.floor(Date.now() / 1000)
  const sorted = Object.entries({ ...params, wts }).sort((a, b) => a[0].localeCompare(b[0]))
  const query = sorted.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')
  const w_rid = crypto.createHash('md5').update(query + mixinKey).digest('hex')
  return `${query}&w_rid=${w_rid}`
}

// ---------- 识别视频 ID（BV 任意位置 / av 号 / b23.tv 短链） ----------
type VideoId = { bvid?: string; aid?: number }

function extractId(url: string): VideoId | null {
  const m = url.match(/BV[0-9A-Za-z]+/i)
  if (m) return { bvid: m[0] }
  const av = url.match(/av(\d+)/i)
  if (av) return { aid: parseInt(av[1], 10) }
  return null
}

async function fetchBilibili(id: VideoId): Promise<FetchedVideoStats> {
  const cookie = await getCookie()
  const { imgKey, subKey } = await getWbiKeys()
  const params: Record<string, string | number> = id.bvid
    ? { bvid: id.bvid }
    : { aid: id.aid as number }
  const query = signWbi(params, imgKey, subKey)
  const headers: Record<string, string> = {}
  if (cookie) headers.Cookie = cookie
  const data = await getJson(`https://api.bilibili.com/x/web-interface/view?${query}`, headers)
  if (data.code !== 0)
    throw new Error(`B站接口错误 code=${data.code}（${data.message || '未知'}）`)
  const s = data.data.stat
  const pub = data.data.pubdate ? new Date(data.data.pubdate * 1000).toISOString().slice(0, 10) : undefined
  return {
    platform: 'bilibili',
    views: Number(s.view ?? 0),
    likes: Number(s.like ?? 0),
    comments: Number(s.reply ?? 0),
    title: data.data.title,
    published_at: pub,
  }
}

export async function fetchVideoStats(url: string): Promise<FetchedVideoStats> {
  let u = (url || '').trim()
  if (!u) throw new Error('链接为空')
  // b23.tv 短链：跟随重定向拿最终视频页 URL 再解析
  if (/b23\.tv\//i.test(u)) {
    u = await resolveFinalUrl(u)
  }
  const id = extractId(u)
  if (!id) {
    throw new Error('无法识别的链接：仅支持哔哩哔哩视频（BV 号 / av 号 / b23.tv 短链）')
  }
  return fetchBilibili(id)
}

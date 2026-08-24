// 视频链接抓取：仅支持哔哩哔哩（x/web-interface/view + 标准 WBI 签名）
// 网络层：Electron net.fetch（Chromium 网络栈）——真实浏览器 TLS/HTTP2 指纹，
//         自动跟随重定向、共享默认会话 cookie 罐，大幅降低被 B 站风控拦截
//         （-412 请求被拦截 / -101 账号未登录）的概率。Node http/https 指纹
//         会被 B 站识别为脚本流量，即使带 cookie 也拿不到 wbi_img。
// 抗风控链路：访问首页种 cookie → finger/spi 补 buvid3/buvid4 → nav 取 WBI 密钥
//             （失败自动刷新 cookie 重试一次）→ view 签名请求 → 失败回退无签名直连。
import { net, session } from 'electron'
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

// ---------- 基础请求（net.fetch + 超时控制） ----------
async function fetchPage(
  url: string,
  opts: { headers?: Record<string, string>; timeoutMs?: number } = {},
): Promise<{ text: string; finalUrl: string }> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 12000)
  try {
    const res = await net.fetch(url, {
      method: 'GET',
      headers: { ...COMMON_HEADERS, ...(opts.headers || {}) },
      redirect: 'follow',
      credentials: 'include',
      signal: ctrl.signal,
    })
    const text = await res.text()
    return { text, finalUrl: res.url || url }
  } finally {
    clearTimeout(timer)
  }
}

async function getJson(url: string, extra: Record<string, string> = {}): Promise<any> {
  const { text } = await fetchPage(url, { headers: extra })
  try {
    return JSON.parse(text)
  } catch {
    throw new Error('返回内容无法解析为 JSON（可能被拦截或网络异常）：' + text.slice(0, 80))
  }
}

// ---------- cookie 罐（Chromium 会话统一管理，缓存 1h） ----------
let cookieCache: { value: string; ts: number } | null = null

async function readSessionJar(): Promise<string> {
  try {
    const list = await session.defaultSession.cookies.get({ domain: 'bilibili.com' })
    return list.map((c) => `${c.name}=${c.value}`).join('; ')
  } catch {
    return ''
  }
}

async function getCookie(force = false): Promise<string> {
  if (!force && cookieCache && Date.now() - cookieCache.ts < 3600_000) return cookieCache.value
  // 访问首页，让 Chromium 会话种下 buvid3 / b_nut 等风控所需 cookie
  try {
    await fetchPage('https://www.bilibili.com', { timeoutMs: 10000 })
  } catch {
    // 首页失败不致命，继续尝试 spi
  }
  // finger/spi 补 buvid3/buvid4，写入 .bilibili.com 域供 api 子域共用
  try {
    const sp = await getJson('https://api.bilibili.com/x/frontend/finger/spi')
    const b3 = sp?.data?.b_3
    const b4 = sp?.data?.b_4
    const exp = Math.floor(Date.now() / 1000) + 86400 * 365
    if (b3)
      await session.defaultSession.cookies.set({
        url: 'https://www.bilibili.com',
        name: 'buvid3',
        value: String(b3),
        domain: '.bilibili.com',
        path: '/',
        expirationDate: exp,
      })
    if (b4)
      await session.defaultSession.cookies.set({
        url: 'https://www.bilibili.com',
        name: 'buvid4',
        value: String(b4),
        domain: '.bilibili.com',
        path: '/',
        expirationDate: exp,
      })
  } catch {
    // spi 失败不致命
  }
  const jar = await readSessionJar()
  cookieCache = { value: jar, ts: Date.now() }
  return jar
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

let wbiCache: { imgKey: string; subKey: string; ts: number } | null = null

// nav 必须带 buvid3 cookie，否则 B 站返回 -101「账号未登录」且无 wbi_img。
// 失败自动强制刷新 cookie 再试一次；密钥缓存 1h。
async function getWbiKeys(cookie: string): Promise<{ imgKey: string; subKey: string }> {
  if (wbiCache && Date.now() - wbiCache.ts < 3600_000) return wbiCache
  const attemptOnce = async (ck: string): Promise<{ imgKey: string; subKey: string }> => {
    const data = await getJson('https://api.bilibili.com/x/web-interface/nav', ck ? { Cookie: ck } : {})
    const wbiImg = data?.data?.wbi_img
    if (!wbiImg?.img_url || !wbiImg?.sub_url)
      throw new Error('B站获取 WBI 密钥失败：' + (data?.message || data?.code || '未知'))
    const img = (wbiImg.img_url.split('/').pop() || '').split('.')[0]
    const sub = (wbiImg.sub_url.split('/').pop() || '').split('.')[0]
    return { imgKey: img, subKey: sub }
  }
  let lastErr: unknown
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const ck = attempt === 0 ? cookie : await getCookie(true)
      const keys = await attemptOnce(ck)
      wbiCache = { ...keys, ts: Date.now() }
      return keys
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr
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

function parseView(data: any): FetchedVideoStats {
  if (data.code !== 0) throw new Error(`B站接口错误 code=${data.code}（${data.message || '未知'}）`)
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

async function fetchBilibili(id: VideoId): Promise<FetchedVideoStats> {
  const cookie = await getCookie()
  const plainQuery = id.bvid ? `bvid=${encodeURIComponent(id.bvid)}` : `aid=${id.aid}`
  const signedParams: Record<string, string | number> = id.bvid
    ? { bvid: id.bvid }
    : { aid: id.aid as number }
  let lastData: any = null
  let lastErr: unknown = null
  // 1) WBI 签名请求（官方推荐链路）
  try {
    const { imgKey, subKey } = await getWbiKeys(cookie)
    lastData = await getJson(
      `https://api.bilibili.com/x/web-interface/view?${signWbi(signedParams, imgKey, subKey)}`,
      cookie ? { Cookie: cookie } : {},
    )
    if (lastData?.code === 0) return parseView(lastData)
  } catch (e) {
    lastErr = e
  }
  // 2) 回退：无签名直连（view 接口部分场景仍放行）
  try {
    lastData = await getJson(
      `https://api.bilibili.com/x/web-interface/view?${plainQuery}`,
      cookie ? { Cookie: cookie } : {},
    )
    if (lastData?.code === 0) return parseView(lastData)
  } catch (e) {
    lastErr = e
  }
  if (lastData && typeof lastData.code === 'number' && lastData.code !== 0)
    throw new Error(`B站接口错误 code=${lastData.code}（${lastData.message || '未知'}）`)
  throw lastErr instanceof Error ? lastErr : new Error('抓取失败：未知错误')
}

export async function fetchVideoStats(url: string): Promise<FetchedVideoStats> {
  let u = (url || '').trim()
  if (!u) throw new Error('链接为空')
  // b23.tv 短链：跟随重定向拿最终视频页 URL 再解析
  if (/b23\.tv\//i.test(u)) {
    const r = await fetchPage(u)
    u = r.finalUrl
  }
  const id = extractId(u)
  if (!id) {
    throw new Error('无法识别的链接：仅支持哔哩哔哩视频（BV 号 / av 号 / b23.tv 短链）')
  }
  return fetchBilibili(id)
}

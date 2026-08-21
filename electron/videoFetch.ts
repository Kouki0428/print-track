// 视频链接抓取：仅支持哔哩哔哩（x/web-interface/view + 标准 WBI 签名）
// 健壮性加固：
//  - 携带 buvid3 cookie（/x/frontend/finger/spi 获取并缓存），规避 B 站对 Electron 非浏览器上下文的 -412 拦截
//  - Accept-Encoding: identity，避免 gzip 响应导致 JSON.parse 失败
//  - 支持 b23.tv 短链：跟随重定向解析出最终 BV 号
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

// ---------- buvid3 缓存（每小时刷新） ----------
let buvid3Cache: { value: string; ts: number } | null = null
async function getBuvid3(): Promise<string | null> {
  if (buvid3Cache && Date.now() - buvid3Cache.ts < 3600_000) return buvid3Cache.value
  try {
    const sp = await getJson('https://api.bilibili.com/x/frontend/finger/spi')
    const v = sp?.data?.b_3 || null
    if (v) buvid3Cache = { value: v, ts: Date.now() }
    return v
  } catch {
    return buvid3Cache?.value ?? null
  }
}

// ---------- 通用 GET JSON（自动跟随重定向） ----------
function getJson(url: string, extra: Record<string, string> = {}, redirects = 0): Promise<any> {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    const lib = u.protocol === 'https:' ? https : http
    const req = lib.request(
      url,
      {
        method: 'GET',
        headers: { ...COMMON_HEADERS, ...extra },
      },
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
            reject(new Error('返回内容无法解析为 JSON：' + String(e)))
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
  if (data.code !== 0 || !data.data?.wbi_img) throw new Error('B站获取 WBI 密钥失败：' + (data.message || data.code))
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

async function fetchBilibili(bvid: string): Promise<FetchedVideoStats> {
  const buvid3 = await getBuvid3()
  const { imgKey, subKey } = await getWbiKeys()
  const query = signWbi({ bvid }, imgKey, subKey)
  const headers: Record<string, string> = {}
  if (buvid3) headers.Cookie = `buvid3=${buvid3}`
  const data = await getJson(`https://api.bilibili.com/x/web-interface/view?${query}`, headers)
  if (data.code !== 0) throw new Error('B站接口错误：' + (data.message || data.code))
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

// ---------- 平台识别（仅哔哩哔哩） ----------
function extractBv(url: string): string | null {
  const m = url.match(/(?:bilibili\.com\/(?:video|s|blackboard\/activity\/|festival\/)|player\.bilibili\.com\/)(BV[0-9A-Za-z]+)/i)
  return m ? m[1] : null
}

export async function fetchVideoStats(url: string): Promise<FetchedVideoStats> {
  let bv = extractBv(url)
  if (!bv) {
    // b23.tv 短链：跟随重定向拿最终视频页 URL 再解析 BV
    const finalUrl = await resolveFinalUrl(url)
    bv = extractBv(finalUrl)
  }
  if (!bv) {
    throw new Error('仅支持哔哩哔哩视频链接（含 BV 号，如 https://www.bilibili.com/video/BVxxxx 或 b23.tv 短链）')
  }
  return fetchBilibili(bv)
}

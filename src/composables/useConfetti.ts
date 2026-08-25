// 轻量彩纸庆祝：状态流转到「完成」时全屏撒纸屑，~1.8s 自动清理
// 尊重系统「减少动态效果」设置
let canvas: HTMLCanvasElement | null = null

export function fireConfetti() {
  if (typeof window === 'undefined') return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  if (!canvas) {
    canvas = document.createElement('canvas')
    canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:3000'
    document.body.appendChild(canvas)
  }
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
  canvas.width = window.innerWidth * dpr
  canvas.height = window.innerHeight * dpr
  canvas.style.width = window.innerWidth + 'px'
  canvas.style.height = window.innerHeight + 'px'
  ctx.scale(dpr, dpr)

  const colors = ['#3b6fe0', '#8b5cf6', '#1f9d57', '#e8912f', '#e23c3c', '#0ea5b7', '#d9469c']
  const parts = Array.from({ length: 130 }, () => ({
    x: window.innerWidth / 2 + (Math.random() - 0.5) * 220,
    y: window.innerHeight * 0.32,
    vx: (Math.random() - 0.5) * 9,
    vy: -(Math.random() * 9 + 5),
    size: Math.random() * 6 + 4,
    color: colors[(Math.random() * colors.length) | 0],
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.3,
  }))

  const start = performance.now()
  const DURATION = 1800
  function frame(now: number) {
    if (!canvas || !ctx) return
    const t = now - start
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
    let alive = false
    for (const p of parts) {
      p.x += p.vx
      p.y += p.vy
      p.vy += 0.25
      p.rot += p.vr
      const alpha = Math.max(0, 1 - t / DURATION)
      if (alpha <= 0 || p.y > window.innerHeight + 24) continue
      alive = true
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      ctx.fillStyle = p.color
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6)
      ctx.restore()
    }
    if (alive && t < DURATION + 200) {
      requestAnimationFrame(frame)
    } else {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
    }
  }
  requestAnimationFrame(frame)
}

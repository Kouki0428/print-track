import { ref, watch } from 'vue'

// 数字滚动动画：监听 getter 返回值变化，用 ease-out 补间到新值
export function useCountUp(get: () => number, duration = 650) {
  const display = ref(0)
  let raf = 0
  const reduced =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  function animateTo(to: number) {
    cancelAnimationFrame(raf)
    if (reduced || duration <= 0) {
      display.value = to
      return
    }
    const from = display.value
    if (from === to) return
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      display.value = Math.round(from + (to - from) * eased)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
  }

  watch(get, (v) => animateTo(v), { immediate: true })
  return display
}

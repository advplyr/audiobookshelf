<template>
  <div class="relative">
    <!-- 触发按钮：显示图标和进度 -->
    <button class="appbar-btn" title="Volume Fade" aria-label="Volume Fade" @click="open = !open">
      <span class="material-symbols text-2xl"> volume_down_alt </span>
      <span v-if="running" class="ml-1 text-sm font-medium">{{ timeLeftLabel }}</span>
    </button>

    <!-- 弹出面板 -->
    <div v-if="open" class="absolute right-0 mt-2 w-72 rounded-md border shadow-lg z-50" :style="panelStyle">
      <div class="px-3 py-2 text-sm font-semibold">Volume Fade</div>
      <div class="px-3 pb-3 space-y-3">
        <div class="grid grid-cols-2 gap-2">
          <div class="field">
            <label>Duration (min)</label>
            <input type="number" min="1" class="input" v-model.number="minutes" />
          </div>
          <div class="field">
            <label>Target Volume</label>
            <input type="number" min="0" max="1" step="0.05" class="input" v-model.number="targetVolume" />
          </div>
        </div>

        <div class="field">
          <label>Curve</label>
          <select class="input" v-model="curve">
            <option value="linear">Linear</option>
            <option value="easeIn">Ease-in</option>
            <option value="easeOut">Ease-out</option>
            <option value="log">Logarithmic</option>
          </select>
        </div>

        <div class="flex items-center justify-between">
          <label class="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" v-model="pauseOnEnd" />
            Pause at the end
          </label>
          <span class="text-sm opacity-80">Current: {{ currentVolume.toFixed(2) }}</span>
        </div>

        <!-- 进度条 -->
        <div v-if="running" class="h-2 w-full bg-[color:var(--border)] rounded overflow-hidden">
          <div class="h-full bg-[color:var(--accent)]" :style="{ width: (progress * 100).toFixed(1) + '%' }" />
        </div>

        <!-- 启动/停止按钮 -->
        <div class="flex gap-2">
          <button v-if="!running" class="btn-primary flex-1" @click="startFade">Start</button>
          <button v-else class="btn-danger flex-1" @click="stopFade(true)">Stop</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
/**
 * 接入方式（二选一，已在代码里给了开关）：
 *   A) 使用 Vuex 播放模块：
 *      - 获取音量：this.$store.getters['player/getVolume'] 或 state
 *      - 设置音量：this.$store.dispatch('player/setVolume', vol)
 *      - 暂停播放：this.$store.dispatch('player/pause')
 *
 *   B) 使用全局事件总线（eventBus）：
 *      - 设置音量：this.$eventBus.$emit('player:set-volume', vol)
 *      - 暂停播放：this.$eventBus.$emit('player:pause')
 *
 * 你只需要把“TODO 接入点”那里换成你项目里已有的函数/事件名即可。
 */
export default {
  name: 'VolumeFade',
  data() {
    return {
      open: false,
      minutes: 5, // 渐弱时长（分钟）
      targetVolume: 0, // 目标音量（0~1）
      curve: 'linear', // 曲线：linear/easeIn/easeOut/log
      pauseOnEnd: true, // 结束时是否暂停
      running: false,

      // 运行期变量
      startTs: 0,
      endTs: 0,
      startVolume: 1,
      rafId: null,
      progress: 0,
      currentVolume: 1
    }
  },
  computed: {
    panelStyle() {
      return {
        background: 'var(--panel)',
        borderColor: 'var(--border)',
        color: 'var(--text)'
      }
    },
    timeLeftLabel() {
      if (!this.running) return ''
      const left = Math.max(0, this.endTs - Date.now())
      const mm = Math.floor(left / 60000)
      const ss = Math.floor((left % 60000) / 1000)
      return `${mm}:${ss.toString().padStart(2, '0')}`
    }
  },
  methods: {
    // === TODO：接入点：读/写音量 + 暂停 ===
    getVolume() {
      // A) Vuex 版本（优先）：
      // return this.$store.getters['player/getVolume']

      // B) 如果没有 getter，可以从你的 audio el 读：
      // return this.$refs.audio?.volume ?? 1

      // C) eventBus 项目常见做法：需要你在播放器里监听并把当前音量同步到全局（略）
      // 这里给个容错：尝试从本地缓存读取，作为兜底
      const v = Number(localStorage.getItem('playerVolume'))
      return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : this.currentVolume
    },
    setVolume(vol) {
      const clamped = Math.min(1, Math.max(0, vol))

      // A) Vuex：
      // this.$store.dispatch('player/setVolume', clamped)

      // B) eventBus：
      this.$eventBus && this.$eventBus.$emit('player:set-volume', clamped)

      // 作为 UI 显示用
      this.currentVolume = clamped
      // 可选：缓存一份，方便 getVolume 兜底
      localStorage.setItem('playerVolume', String(clamped))
    },
    pause() {
      // A) Vuex：
      // this.$store.dispatch('player/pause')

      // B) eventBus：
      this.$eventBus && this.$eventBus.$emit('player:pause')
    },

    // === 渐弱核心 ===
    startFade() {
      // 安全校验
      const durationMs = Math.max(5 * 1000, (this.minutes || 0) * 60 * 1000) // 最少 5 秒，避免“看不见效果”
      this.startVolume = this.getVolume()
      this.currentVolume = this.startVolume

      // 若目标音量不在 0~1，夹紧
      this.targetVolume = Math.min(1, Math.max(0, this.targetVolume))

      // 如果已经是目标音量，直接结束
      if (Math.abs(this.startVolume - this.targetVolume) < 0.001) {
        this.$toast && this.$toast.info('Already at target volume')
        return
      }

      this.startTs = Date.now()
      this.endTs = this.startTs + durationMs
      this.running = true
      this.progress = 0
      this.tick()
      this.open = false
      this.$toast && this.$toast.success('Volume fade started')
    },
    stopFade(notify = false) {
      this.running = false
      this.progress = 0
      if (this.rafId) {
        cancelAnimationFrame(this.rafId)
        this.rafId = null
      }
      if (notify && this.$toast) this.$toast.info('Volume fade stopped')
    },
    tick() {
      if (!this.running) return

      const now = Date.now()
      const t = Math.min(1, (now - this.startTs) / (this.endTs - this.startTs)) // 0~1
      this.progress = t

      const eased = this.applyCurve(t, this.curve)
      const next = this.lerp(this.startVolume, this.targetVolume, eased)

      this.setVolume(next)

      if (now >= this.endTs) {
        this.setVolume(this.targetVolume)
        this.stopFade(false)
        if (this.pauseOnEnd) this.pause()
        this.$toast && this.$toast.success('Volume fade completed')
        return
      }

      this.rafId = requestAnimationFrame(this.tick)
    },

    // 线性插值
    lerp(a, b, t) {
      return a + (b - a) * t
    },
    // 曲线（可自行扩展）
    applyCurve(t, mode) {
      switch (mode) {
        case 'easeIn':
          return t * t
        case 'easeOut':
          return 1 - Math.pow(1 - t, 2)
        case 'log':
          return Math.log2(1 + t) / Math.log2(2) // 0->1 对数型
        default:
          return t // linear
      }
    }
  },
  mounted() {
    // 如果你的播放器会通过 eventBus 广播当前音量（可选增强）：
    // this.$eventBus.$on('player:volume', v => {
    //   this.currentVolume = v
    //   localStorage.setItem('playerVolume', String(v))
    // })
    // 兜底初始化
    this.currentVolume = this.getVolume()
  },
  beforeDestroy() {
    if (this.rafId) cancelAnimationFrame(this.rafId)
    // this.$eventBus && this.$eventBus.$off('player:volume')
  }
}
</script>

<style scoped>
.appbar-btn {
  width: 2.25rem;
  height: 2.25rem;
  min-width: 2.25rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin: 0 0.25rem;
  border-radius: 0.375rem;
  color: var(--text);
  transition: background-color 0.18s ease, transform 0.06s ease;
}
.appbar-btn:hover {
  background: rgba(255, 255, 255, 0.06);
}
html[data-theme='light'] .appbar-btn:hover {
  background: rgba(0, 0, 0, 0.06);
}
.appbar-btn:active {
  transform: scale(0.98);
}

.field label {
  display: block;
  font-size: 0.75rem;
  opacity: 0.8;
  margin-bottom: 0.25rem;
}
.input {
  width: 100%;
  border: 1px solid var(--border);
  background: var(--panel);
  color: var(--text);
  border-radius: 0.5rem;
  padding: 0.35rem 0.5rem;
}
.btn-primary {
  background-image: linear-gradient(135deg, var(--accent), var(--accent-2));
  color: #101010;
  border: none;
  border-radius: 0.5rem;
  padding: 0.5rem 0.75rem;
}
.btn-danger {
  background: #dc2626;
  color: #fff;
  border: none;
  border-radius: 0.5rem;
  padding: 0.5rem 0.75rem;
}
</style>

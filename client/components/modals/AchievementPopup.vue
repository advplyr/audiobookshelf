<template>
  <transition name="abs-pop-fade">
    <div
      v-if="value"
      class="fixed inset-0 z-[2000] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Achievement unlocked"
    >
      <div class="absolute inset-0 bg-black/60" @click="$emit('input', false)" aria-hidden="true" />
      <div class="relative w-full max-w-sm rounded-2xl shadow-2xl ring-1 ring-black/20 bg-gray-900 text-gray-50 p-6">
        <button class="absolute right-2 top-2 p-1 text-gray-400 hover:text-white" @click="$emit('input', false)" aria-label="Close">✕</button>

        <div class="w-16 h-16 rounded-xl mb-3 grid place-items-center mx-auto"
             :style="{ background: 'linear-gradient(135deg,#1f2937,#0b1220)' }">
          <svg viewBox="0 0 24 24" class="w-9 h-9">
            <path fill="currentColor" d="M12 2l3 5 5 .5-3.7 3.1L17 16l-5-2.6L7 16l.7-5.4L4 7.5 9 7l3-5z"/>
          </svg>
        </div>

        <h2 class="text-2xl font-bold text-center">Congratulations!</h2>
        <p class="text-center text-gray-300 mt-1">
          You unlocked: <span class="font-semibold">{{ badge?.name || 'Badge' }}</span>
        </p>

        <div class="mt-5 flex justify-center">
          <button class="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500" @click="$emit('input', false)">Close</button>
        </div>
      </div>
    </div>
  </transition>
</template>

<script>
export default {
  name: 'AchievementPopup',
  props: { value: { type: Boolean, default: false }, badge: { type: Object, default: null } },
  mounted () {
    if (typeof window !== 'undefined') {
      window.addEventListener('achievement:unlocked', (e) => {
        const [first] = e.detail?.badges || []
        if (first) {
          this.$emit('input', true)
          this.$data.last = first
        }
      })
    }
  },
  data () { return { last: null } }
}
</script>

<style>
.abs-pop-fade-enter-active, .abs-pop-fade-leave-active { transition: opacity .2s ease, transform .2s ease }
.abs-pop-fade-enter-from, .abs-pop-fade-leave-to { opacity: 0; transform: scale(0.98) }
</style>

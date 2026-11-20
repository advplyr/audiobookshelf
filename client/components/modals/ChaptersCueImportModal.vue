<template>
  <modals-modal v-model="show" name="import-cue" :width="500">
    <template #outer>
      <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden pointer-events-none">
        <p class="text-3xl text-white truncate pointer-events-none">{{ $strings.HeaderImportCue }}</p>
      </div>
    </template>
    <div class="w-full h-full max-h-full text-sm rounded-lg bg-bg shadow-lg border border-black-300 relative p-4">
      <div class="flex items-center mb-2">
        <p v-if="!cueChapters && !cueParseError" class="text-xs text-gray-300">{{ $strings.MessageCueSelectFile }}</p>
      </div>
      <p v-if="cueFileName" class="text-xs text-gray-300 mb-2 truncate">{{ cueFileName }}</p>
      <p v-if="cueParseError" class="text-xs text-error mb-3">{{ cueParseError }}</p>
      <div v-if="cueChapters">
        <p class="text-sm mb-2"><span class="font-semibold">{{ cueChapters.length }}</span> {{ $strings.LabelChaptersFound }}</p>
        <div class="flex py-0.5 text-xs font-semibold uppercase text-gray-300 mb-1">
          <div class="w-24 px-2">{{ $strings.LabelStart }}</div>
          <div class="grow px-2">{{ $strings.LabelTitle }}</div>
        </div>
        <div class="w-full max-h-80 overflow-y-auto my-2">
          <div v-for="(chapter, index) in cueChapters" :key="index" class="flex py-0.5 text-xs" :class="index % 2 === 0 ? 'bg-primary/30' : ''">
            <div class="w-24 min-w-24 px-2">
              <p class="font-mono">{{ $secondsToTimestamp(chapter.start) }}</p>
            </div>
            <div class="grow px-2">
              <p class="truncate max-w-sm">{{ chapter.title }}</p>
            </div>
          </div>
        </div>
      </div>
      <div class="flex items-center pt-2 justify-end gap-2">
        <ui-btn small @click="show = false">{{ $strings.ButtonCancel }}</ui-btn>
        <ui-btn small color="bg-success" :disabled="!cueChapters || !cueChapters.length" @click="applyChapters">{{ $strings.ButtonApplyChapters }}</ui-btn>
      </div>
    </div>
  </modals-modal>
</template>

<script>
export default {
  props: {
    value: {
      type: Boolean,
      default: false
    },
    cueFile: {
      type: Object,
      default: null
    }
  },
  data() {
    return {
      cueFileName: '',
      cueParseError: null,
      cueChapters: null
    }
  },
  computed: {
    show: {
      get() {
        return this.value
      },
      set(value) {
        this.$emit('input', value)
      }
    }
  },
  watch: {
    show(newValue) {
      if (newValue) {
        this.resetCueImportState()
        if (this.cueFile) {
          this.loadCueFile(this.cueFile)
        }
      }
    },
    cueFile(newValue) {
      if (this.show && newValue) {
        this.loadCueFile(newValue)
      }
    }
  },
  methods: {
    resetCueImportState() {
      this.cueFileName = ''
      this.cueParseError = null
      this.cueChapters = null
    },
    loadCueFile(file) {
      this.cueFileName = file?.name || ''
      this.cueParseError = null
      this.cueChapters = null

      if (!file) return

      const reader = new FileReader()
      reader.onload = () => {
        const text = reader.result || ''
        const { chapters, error } = this.parseCueText(String(text))
        if (error) {
          this.cueParseError = error
          this.$toast.error(this.$strings.ToastCueParseFailed)
          return
        }
        this.cueChapters = chapters
      }
      reader.onerror = () => {
        this.cueParseError = this.$strings.ToastCueParseFailed
        this.$toast.error(this.$strings.ToastCueParseFailed)
      }
      reader.readAsText(file)
    },
    parseCueText(text) {
      if (!text || !text.trim()) {
        return { chapters: [], error: this.$strings.MessageCueNoChaptersFound }
      }

      const lines = text.split(/\r?\n/)
      const chapters = []
      let currentTrack = null

      const pushTrack = () => {
        if (!currentTrack || !Number.isFinite(currentTrack.start)) {
          return
        }
        const title = currentTrack.title || `Track ${currentTrack.number}`
        chapters.push({
          start: currentTrack.start,
          title: title.trim()
        })
      }

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.toUpperCase().startsWith('REM')) {
          continue
        }

        const trackMatch = trimmed.match(/^TRACK\s+(\d+)\s+/i)
        if (trackMatch) {
          pushTrack()
          currentTrack = {
            number: Number(trackMatch[1]),
            title: '',
            start: null
          }
          continue
        }

        const titleMatch = trimmed.match(/^TITLE\s+(.+)$/i)
        if (titleMatch) {
          const title = this.stripCueValue(titleMatch[1])
          if (currentTrack) {
            currentTrack.title = title
          }
          continue
        }

        const indexMatch = trimmed.match(/^INDEX\s+01\s+(\d{1,3}:\d{2}:\d{2})/i)
        if (indexMatch && currentTrack) {
          const start = this.parseCueTime(indexMatch[1])
          currentTrack.start = start
        }
      }

      pushTrack()

      const cleaned = chapters.filter((chapter) => Number.isFinite(chapter.start))
      if (!cleaned.length) {
        return { chapters: [], error: this.$strings.MessageCueNoChaptersFound }
      }
      cleaned.sort((a, b) => a.start - b.start)
      return { chapters: cleaned, error: null }
    },
    stripCueValue(value) {
      const trimmed = String(value || '').trim()
      if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
        return trimmed.slice(1, -1).trim()
      }
      return trimmed
    },
    parseCueTime(timecode) {
      const match = String(timecode || '').match(/^(\d{1,3}):(\d{2}):(\d{2})$/)
      if (!match) return NaN

      const minutes = Number(match[1])
      const seconds = Number(match[2])
      const frames = Number(match[3])
      if (!Number.isFinite(minutes) || !Number.isFinite(seconds) || !Number.isFinite(frames)) {
        return NaN
      }
      const totalSeconds = minutes * 60 + seconds + frames / 75
      return Math.round(totalSeconds * 1000) / 1000
    },
    applyChapters() {
      if (!this.cueChapters || !this.cueChapters.length) {
        this.$toast.error(this.$strings.MessageCueNoChaptersFound)
        return
      }
      this.$emit('apply', this.cueChapters)
      this.show = false
      this.resetCueImportState()
    }
  }
}
</script>

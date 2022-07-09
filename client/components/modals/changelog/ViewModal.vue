<template>
  <modals-modal v-model="show" name="changelog" :width="800" :height="'unset'">
    <template #outer>
      <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden">
        <p class="font-book text-3xl text-white truncate">Changelog</p>
      </div>
    </template>
    <div class="px-8 py-6 w-full rounded-lg bg-bg shadow-lg border border-black-300 relative overflow-hidden">
      <p class="text-xl font-bold">Changelog v{{ currentVersionNumber }}</p>
      <div class="custom-text" v-html="compiledMarkedown" />
    </div>
  </modals-modal>
</template>

<script>
import { marked } from "marked";
export default {
  props: {
    value: Boolean,
    changelog: String,
    currentVersion: String,
  },
  watch: {
    show: {
      immediate: true,
      handler(newVal) {
        if (newVal) {
          this.init()
        }
      }
    }
  },
  computed: {
    show: {
      get() {
        return this.value
      },
      set(val) {
        this.$emit('input', val)
      }
    },
    compiledMarkedown() {
      return marked.parse(this.changelog, {gfm: true, breaks: true})
    },
    currentVersionNumber() {
      return this.currentVersion
    }
  },
  methods: {
    init() {},
  },
  mounted() {}
}
</script>
<style scoped>
.custom-text ::v-deep > h3 {
  @apply text-lg font-bold pt-4
}

.custom-text ::v-deep > ul {
  @apply list-disc list-inside
}
</style>
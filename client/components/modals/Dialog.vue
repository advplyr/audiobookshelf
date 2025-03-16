<template>
  <modals-modal v-model="show" :width="300" height="100%">
    <template #outer>
      <div v-if="title" class="absolute top-7 left-4 z-40" style="max-width: 80%">
        <p class="text-white text-lg truncate">{{ title }}</p>
      </div>
    </template>

    <div class="w-full h-full overflow-hidden absolute top-0 left-0 flex items-center justify-center" @click="show = false">
      <div ref="container" class="w-full overflow-x-hidden overflow-y-auto bg-primary rounded-lg border border-white/20" style="max-height: 75%" @click.stop>
        <ul class="h-full w-full" role="listbox" aria-labelledby="listbox-label">
          <template v-for="item in items">
            <li :key="item.value" class="text-gray-50 select-none relative py-4 cursor-pointer hover:bg-black-400" :class="selected === item.value ? 'bg-success/10' : ''" role="option" @click="clickedOption(item.value)">
              <div class="relative flex items-center px-3">
                <p class="font-normal block truncate text-base text-white/80">{{ item.text }}</p>
              </div>
            </li>
          </template>
        </ul>
      </div>
    </div>
  </modals-modal>
</template>

<script>
export default {
  props: {
    value: Boolean,
    title: String,
    items: {
      type: Array,
      default: () => []
    },
    selected: String // optional
  },
  data() {
    return {}
  },
  computed: {
    show: {
      get() {
        return this.value
      },
      set(val) {
        this.$emit('input', val)
      }
    }
  },
  methods: {
    clickedOption(action) {
      this.$emit('action', { action })
    }
  },
  mounted() {}
}
</script>

<template>
  <modals-modal v-model="show" :width="700" :height="'unset'" :processing="processing">
    <template #outer>
      <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden">
        <p class="font-book text-3xl text-white truncate">{{ title }}</p>
      </div>
    </template>
    <div class="p-4 w-full text-sm py-6 rounded-lg bg-bg shadow-lg border border-black-300 relative overflow-hidden" style="min-height: 400px; max-height: 80vh">
      <modals-libraries-edit-library v-if="show" :library="library" :processing.sync="processing" @close="show = false" />
    </div>
  </modals-modal>
</template>

<script>
export default {
  props: {
    value: Boolean,
    library: {
      type: Object,
      default: () => {}
    }
  },
  data() {
    return {
      processing: false
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
    title() {
      return this.library ? 'Update Library' : 'New Library'
    }
  },
  methods: {},
  mounted() {},
  beforeDestroy() {}
}
</script>

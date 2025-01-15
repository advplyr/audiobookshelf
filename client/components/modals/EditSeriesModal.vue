<template>
  <modals-modal v-model="show" name="edit-series" :processing="isProcessing" :width="500" :height="'unset'">
    <div ref="container" class="w-full rounded-lg bg-bg box-shadow-md overflow-y-auto overflow-x-hidden p-4" style="max-height: 80vh; min-height: 40vh">
      <h3 class="text-xl font-semibold mb-8">{{ $strings.LabelEditSeries }}</h3>
      <div class="flex items-center mb-4">
        <ui-textarea-with-label v-model="descriptionValue" :label="$strings.LabelSeriesDescription" :rows="8" />
      </div>
      <div class="absolute bottom-0 left-0 w-full py-2 md:py-4 bg-bg border-t border-white border-opacity-5">
        <div class="flex items-center px-4">
          <div class="flex-grow" />

          <!-- desktop -->
          <ui-btn @click="save" class="mx-2 hidden md:block">{{ $strings.ButtonSave }}</ui-btn>
          <ui-btn @click="saveAndClose" class="mx-2 hidden md:block">{{ $strings.ButtonSaveAndClose }}</ui-btn>
          <!-- mobile -->
          <ui-btn @click="saveAndClose" class="mx-2 md:hidden">{{ $strings.ButtonSave }}</ui-btn>
        </div>
      </div>
    </div>
  </modals-modal>
</template>

<script>
export default {
  props: {
    value: Boolean,
    series: Object
  },
  data() {
    return {
      isProcessing: false,
      descriptionValue: ''
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
    }
  },
  methods: {
    async save() {
      if (this.isProcessing) {
        return null
      }

      const payload = {
        description: this.descriptionValue
      }

      this.isProcessing = true
      // Handle series update
      this.isProcessing = false
    },
    async saveAndClose() {
      const wasUpdated = await this.save()
      if (wasUpdated !== null) this.show = false
    }
  }
}
</script>

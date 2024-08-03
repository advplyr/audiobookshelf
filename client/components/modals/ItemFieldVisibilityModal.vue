<template>
  <modals-modal v-model="show" name="field-visibility" :width="600" :height="'unset'">
    <template #outer>
      <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden">
        <p class="text-3xl text-white truncate">{{ $strings.LabelFieldVisibility }}</p>
      </div>
    </template>
    <div ref="container" class="w-full rounded-lg bg-bg box-shadow-md overflow-y-auto overflow-x-hidden p-4" style="max-height: 80vh">
      <h3 class="text-xl font-semibold mb-8">{{ $strings.HeaderFields }}</h3>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div v-for="field in fields" :key="field.text" class="flex items-center">
          <ui-toggle-switch v-model="field.visible" @input="updateFieldVisibility(field.key, field.visible)" />
          <div class="pl-4">
            <span>{{ field.text }}</span>
          </div>
        </div>
      </div>
    </div>
  </modals-modal>
</template>

<script>
export default {
  props: {
    value: Boolean
  },
  computed: {
    fields() {
      return [
        { text: this.$strings.LabelNarrators, key: 'narrators', visible: this.$store.getters['user/getUserSetting']('fieldVisibility').narrators },
        { text: this.$strings.LabelPublishYear, key: 'publishYear', visible: this.$store.getters['user/getUserSetting']('fieldVisibility').publishYear },
        { text: this.$strings.LabelPublisher, key: 'publisher', visible: this.$store.getters['user/getUserSetting']('fieldVisibility').publisher },
        { text: this.$strings.LabelGenres, key: 'genres', visible: this.$store.getters['user/getUserSetting']('fieldVisibility').genres },
        { text: this.$strings.LabelTags, key: 'tags', visible: this.$store.getters['user/getUserSetting']('fieldVisibility').tags },
        { text: this.$strings.LabelLanguage, key: 'language', visible: this.$store.getters['user/getUserSetting']('fieldVisibility').language },
        { text: this.$strings.LabelDuration, key: 'duration', visible: this.$store.getters['user/getUserSetting']('fieldVisibility').duration },
        { text: this.$strings.LabelReleaseDate, key: 'releaseDate', visible: this.$store.getters['user/getUserSetting']('fieldVisibility').releaseDate },
        { text: this.$strings.LabelSize, key: 'size', visible: this.$store.getters['user/getUserSetting']('fieldVisibility').size }
      ]
    },
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
    updateFieldVisibility(fieldKey, visible) {
      const payload = {
        fieldVisibility: {
          ...this.$store.state.user.settings.fieldVisibility,
          [fieldKey]: visible
        }
      }
      this.$store.dispatch('user/updateUserSettings', { fieldVisibility: payload.fieldVisibility })
    }
  }
}
</script>
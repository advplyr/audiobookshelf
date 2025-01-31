<template>
  <div class="default-style">
    <p v-if="label" class="px-1 text-sm font-semibold" :class="{ 'text-gray-400': disabled }" style="margin-top: 0; margin-bottom: 0.125em">
      {{ label }}
    </p>
    <ui-vue-trix ref="input" v-model="content" :disabled-editor="disabled" @trix-file-accept="trixFileAccept" />
  </div>
</template>

<script>
export default {
  props: {
    value: String,
    label: String,
    disabled: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {}
  },
  computed: {
    content: {
      get() {
        return this.value
      },
      set(val) {
        this.$emit('input', val)
      }
    }
  },
  methods: {
    trixFileAccept(e) {
      e.preventDefault()
    },
    blur() {
      if (this.$refs.input && this.$refs.input.blur) {
        this.$refs.input.blur()
      }
    }
  },
  mounted() {},
  beforeDestroy() {}
}
</script>

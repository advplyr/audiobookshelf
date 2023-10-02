<template>
  <div>
    <p v-if="label" class="px-1 text-sm font-semibold" :class="{ 'text-gray-400': disabled }">
      {{ label }}
    </p>
    <ui-vue-trix v-model="content" :config="config" :disabled-editor="disabled" editorClasses="h-24 resize-y overflow-y-auto default-style py-2 px-3 rounded bg-primary text-gray-200 focus:border-gray-500 focus:outline-none" @trix-file-accept="trixFileAccept" />
  </div>
</template>

<script>
export default {
  props: {
    value: String,
    label: String,
    disabled: Boolean
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
    },
    config() {
      return {
        blockAttributes: {default: {tagName: 'p'}},
        // lang: {bold: this.$strings.ButtonEditorBold}, // this should work but for some reason it doesn't if toolbar.getDefaultHTML is provided
        toolbar: {
          getDefaultHTML: () => `    <div class="trix-button-row">
      <span class="trix-button-group trix-button-group--text-tools" data-trix-button-group="text-tools">
        <button type="button" class="trix-button trix-button--icon trix-button--icon-bold" data-trix-attribute="bold" data-trix-key="b" title="Bold" tabindex="-1">Bold</button>
        <button type="button" class="trix-button trix-button--icon trix-button--icon-italic" data-trix-attribute="italic" data-trix-key="i" title="Italic" tabindex="-1">Italic</button>
        <button type="button" class="trix-button trix-button--icon trix-button--icon-strike" data-trix-attribute="strike" title="Strikethrough" tabindex="-1">Strikethrough</button>
        <button type="button" class="trix-button trix-button--icon trix-button--icon-link" data-trix-attribute="href" data-trix-action="link" data-trix-key="k" title="Link" tabindex="-1">Link</button>
      </span>
      <span class="trix-button-group trix-button-group--block-tools" data-trix-button-group="block-tools">
        <button type="button" class="trix-button trix-button--icon trix-button--icon-bullet-list" data-trix-attribute="bullet" title="Bullets" tabindex="-1">Bullets</button>
        <button type="button" class="trix-button trix-button--icon trix-button--icon-number-list" data-trix-attribute="number" title="Numbers" tabindex="-1">Numbers</button>
      </span>

      <span class="trix-button-group-spacer"></span>
      <span class="trix-button-group trix-button-group--history-tools" data-trix-button-group="history-tools">
        <button type="button" class="trix-button trix-button--icon trix-button--icon-undo" data-trix-action="undo" data-trix-key="z" title="Undo" tabindex="-1">Undo</button>
        <button type="button" class="trix-button trix-button--icon trix-button--icon-redo" data-trix-action="redo" data-trix-key="shift+z" title="Redo" tabindex="-1">Redo</button>
      </span>
    </div>
    <div class="trix-dialogs" data-trix-dialogs>
      <div class="trix-dialog trix-dialog--link" data-trix-dialog="href" data-trix-dialog-attribute="href">
        <div class="trix-dialog__link-fields">
          <input type="url" name="href" class="trix-input trix-input--dialog" placeholder="lang.Enter a URL…" aria-label="URL" required data-trix-input>
          <div class="trix-button-group">
            <input type="button" class="trix-button trix-button--dialog" value="Link" data-trix-method="setAttribute">
            <input type="button" class="trix-button trix-button--dialog" value="Unlink" data-trix-method="removeAttribute">
          </div>
        </div>
      </div>
    </div>`
        }
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
    },
  },
  mounted() {},
  beforeDestroy() {}
}
</script>

<style scoped>
::v-deep .default-style p {
  margin-block-start: 0em;
}
::v-deep trix-editor:not([contenteditable="true"]) {
  color: #aaa;
  background-color: #444;
}
</style>
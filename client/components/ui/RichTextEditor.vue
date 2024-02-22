<template>
  <div class="default-style">
    <p v-if="label" class="px-1 text-sm font-semibold" :class="{ 'text-gray-400': disabled }">
      {{ label }}
    </p>
    <ui-vue-trix v-model="content" :config="config" :disabled-editor="disabled" @trix-file-accept="trixFileAccept" />
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
        toolbar: {
          getDefaultHTML: () => `<div class="trix-button-row">
      <span class="trix-button-group trix-button-group--text-tools" data-trix-button-group="text-tools">
        <button type="button" class="trix-button trix-button--icon trix-button--icon-bold" data-trix-attribute="bold" data-trix-key="b" title="${this.$strings.LabelFontBold}" tabindex="-1">${this.$strings.LabelFontBold}</button>
        <button type="button" class="trix-button trix-button--icon trix-button--icon-italic" data-trix-attribute="italic" data-trix-key="i" title="${this.$strings.LabelFontItalic}" tabindex="-1">${this.$strings.LabelFontItalic}</button>
        <button type="button" class="trix-button trix-button--icon trix-button--icon-strike" data-trix-attribute="strike" title="${this.$strings.LabelFontStrikethrough}" tabindex="-1">${this.$strings.LabelFontStrikethrough}</button>
        <button type="button" class="trix-button trix-button--icon trix-button--icon-link" data-trix-attribute="href" data-trix-action="link" data-trix-key="k" title="${this.$strings.LabelTextEditorLink}" tabindex="-1">${this.$strings.LabelTextEditorLink}</button>
      </span>
      <span class="trix-button-group trix-button-group--block-tools" data-trix-button-group="block-tools">
        <button type="button" class="trix-button trix-button--icon trix-button--icon-bullet-list" data-trix-attribute="bullet" title="${this.$strings.LabelTextEditorBulletedList}" tabindex="-1">${this.$strings.LabelTextEditorBulletedList}</button>
        <button type="button" class="trix-button trix-button--icon trix-button--icon-number-list" data-trix-attribute="number" title="${this.$strings.LabelTextEditorNumberedList}" tabindex="-1">${this.$strings.LabelTextEditorNumberedList}</button>
      </span>

      <span class="trix-button-group-spacer"></span>
      <span class="trix-button-group trix-button-group--history-tools" data-trix-button-group="history-tools">
        <button type="button" class="trix-button trix-button--icon trix-button--icon-undo" data-trix-action="undo" data-trix-key="z" title="${this.$strings.LabelUndo}" tabindex="-1">${this.$strings.LabelUndo}</button>
        <button type="button" class="trix-button trix-button--icon trix-button--icon-redo" data-trix-action="redo" data-trix-key="shift+z" title="${this.$strings.LabelRedo}" tabindex="-1">${this.$strings.LabelRedo}</button>
      </span>
    </div>
    <div class="trix-dialogs" data-trix-dialogs>
      <div class="trix-dialog trix-dialog--link" data-trix-dialog="href" data-trix-dialog-attribute="href">
        <div class="trix-dialog__link-fields">
          <input type="url" name="href" class="trix-input trix-input--dialog" placeholder="" aria-label="URL" required data-trix-input>
          <div class="trix-button-group">
            <input type="button" class="trix-button trix-button--dialog" value="${this.$strings.LabelTextEditorLink}" data-trix-method="setAttribute">
            <input type="button" class="trix-button trix-button--dialog" value="${this.$strings.LabelTextEditorUnlink}" data-trix-method="removeAttribute">
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
    }
  },
  mounted() {},
  beforeDestroy() {}
}
</script>
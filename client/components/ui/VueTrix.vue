<template>
  <div>
    <trix-toolbar :id="toolbarId">
      <div v-show="!disabledEditor" class="trix-button-row">
        <span class="trix-button-group trix-button-group--text-tools" data-trix-button-group="text-tools">
          <button type="button" class="trix-button trix-button--icon trix-button--icon-bold" data-trix-attribute="bold" data-trix-key="b" :title="$strings.LabelFontBold" tabindex="-1">{{ $strings.LabelFontBold }}</button>
          <button type="button" class="trix-button trix-button--icon trix-button--icon-italic" data-trix-attribute="italic" data-trix-key="i" :title="$strings.LabelFontItalic" tabindex="-1">{{ $strings.LabelFontItalic }}</button>
          <button type="button" class="trix-button trix-button--icon trix-button--icon-strike" data-trix-attribute="strike" :title="$strings.LabelFontStrikethrough" tabindex="-1">{{ $strings.LabelFontStrikethrough }}</button>
          <button type="button" class="trix-button trix-button--icon trix-button--icon-link" data-trix-attribute="href" data-trix-action="link" data-trix-key="k" :title="$strings.LabelTextEditorLink" tabindex="-1">{{ $strings.LabelTextEditorLink }}</button>
        </span>
        <span class="trix-button-group trix-button-group--block-tools" data-trix-button-group="block-tools">
          <button type="button" class="trix-button trix-button--icon trix-button--icon-bullet-list" data-trix-attribute="bullet" :title="$strings.LabelTextEditorBulletedList" tabindex="-1">{{ $strings.LabelTextEditorBulletedList }}</button>
          <button type="button" class="trix-button trix-button--icon trix-button--icon-number-list" data-trix-attribute="number" :title="$strings.LabelTextEditorNumberedList" tabindex="-1">{{ $strings.LabelTextEditorNumberedList }}</button>
        </span>

        <span class="trix-button-group-spacer"></span>
        <span class="trix-button-group trix-button-group--history-tools" data-trix-button-group="history-tools">
          <button type="button" class="trix-button trix-button--icon trix-button--icon-undo" data-trix-action="undo" data-trix-key="z" :title="$strings.LabelUndo" tabindex="-1">{{ $strings.LabelUndo }}</button>
          <button type="button" class="trix-button trix-button--icon trix-button--icon-redo" data-trix-action="redo" data-trix-key="shift+z" :title="$strings.LabelRedo" tabindex="-1">{{ $strings.LabelRedo }}</button>
        </span>
      </div>
      <div class="trix-dialogs" data-trix-dialogs>
        <div class="trix-dialog trix-dialog--link" data-trix-dialog="href" data-trix-dialog-attribute="href">
          <div class="trix-dialog__link-fields">
            <input type="url" name="href" class="trix-input trix-input--dialog" placeholder="" aria-label="URL" required data-trix-input />
            <div class="trix-button-group">
              <input type="button" class="trix-button trix-button--dialog" :value="$strings.LabelTextEditorLink" data-trix-method="setAttribute" />
              <input type="button" class="trix-button trix-button--dialog" :value="$strings.LabelTextEditorUnlink" data-trix-method="removeAttribute" />
            </div>
          </div>
        </div>
      </div>
    </trix-toolbar>
    <trix-editor :toolbar="toolbarId" :contenteditable="!disabledEditor" :class="['trix-content']" ref="trix" :input="computedId" :placeholder="placeholder" @trix-change="handleContentChange" @trix-initialize="handleInitialize" @trix-focus="processTrixFocus" @trix-blur="processTrixBlur" @trix-attachment-add="handleAttachmentAdd" />
    <input type="hidden" :name="inputName" :id="computedId" :value="editorContent" />
  </div>
</template>

<script>
/*
  ORIGINAL SOURCE: https://github.com/hanhdt/vue-trix

  modified for audiobookshelf
*/
import Trix from 'trix'
import '@/assets/trix.css'

function enableBreakParagraphOnReturn() {
  // Trix works with divs by default, we want paragraphs instead
  Trix.config.blockAttributes.default.tagName = 'p'
  // Enable break paragraph on Enter (Shift + Enter will still create a line break)
  Trix.config.blockAttributes.default.breakOnReturn = true

  // Hack to fix buggy paragraph breaks
  // Copied from https://github.com/basecamp/trix/issues/680#issuecomment-735742942
  Trix.Block.prototype.breaksOnReturn = function () {
    const attr = this.getLastAttribute()
    const config = Trix.getBlockConfig(attr ? attr : 'default')
    return config ? config.breakOnReturn : false
  }
  Trix.LineBreakInsertion.prototype.shouldInsertBlockBreak = function () {
    if (this.block.hasAttributes() && this.block.isListItem() && !this.block.isEmpty()) {
      return this.startLocation.offset > 0
    } else {
      return !this.shouldBreakFormattedBlock() ? this.breaksOnReturn : false
    }
  }
}

enableBreakParagraphOnReturn()

export default {
  name: 'vue-trix',
  model: {
    prop: 'srcContent',
    event: 'update'
  },
  props: {
    /**
     * This prop will put the editor in read-only mode
     */
    disabledEditor: {
      type: Boolean,
      required: false,
      default() {
        return false
      }
    },
    /**
     * This is referenced `id` of the hidden input field defined.
     * It is optional and will be a random string by default.
     */
    inputId: {
      type: String,
      required: false,
      default() {
        return ''
      }
    },
    /**
     * This is referenced `name` of the hidden input field defined,
     * default value is `content`.
     */
    inputName: {
      type: String,
      required: false,
      default() {
        return 'content'
      }
    },
    /**
     * The placeholder attribute specifies a short hint
     * that describes the expected value of a editor.
     */
    placeholder: {
      type: String,
      required: false,
      default() {
        return ''
      }
    },
    /**
     * The source content is associcated to v-model directive.
     */
    srcContent: {
      type: String,
      required: false,
      default() {
        return ''
      }
    },
    /**
     * The boolean attribute allows saving editor state into browser's localStorage
     * (optional, default is `false`).
     */
    localStorage: {
      type: Boolean,
      required: false,
      default() {
        return false
      }
    },
    /**
     * Focuses cursor in the editor when attached to the DOM
     * (optional, default is `false`).
     */
    autofocus: {
      type: Boolean,
      required: false,
      default() {
        return false
      }
    },
    /**
     * Object to override default editor configuration
     */
    config: {
      type: Object,
      required: false,
      default() {
        return {}
      }
    }
  },
  data() {
    return {
      editorContent: this.srcContent,
      isActived: null
    }
  },
  watch: {
    editorContent: {
      handler: 'emitEditorState'
    },
    initialContent: {
      handler: 'handleInitialContentChange'
    },
    isDisabled: {
      handler: 'decorateDisabledEditor'
    },
    config: {
      handler: 'overrideConfig',
      immediate: true,
      deep: true
    }
  },
  computed: {
    /**
     * Compute a random id of hidden input
     * when it haven't been specified.
     */
    toolbarId() {
      return `trix-toolbar-${this.generateId}`
    },
    generateId() {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        var r = (Math.random() * 16) | 0
        var v = c === 'x' ? r : (r & 0x3) | 0x8
        return v.toString(16)
      })
    },
    computedId() {
      return this.inputId || this.generateId
    },
    initialContent() {
      return this.srcContent
    },
    isDisabled() {
      return this.disabledEditor
    }
  },
  methods: {
    processTrixFocus(event) {
      if (this.$refs.trix) {
        this.isActived = true
        this.$emit('trix-focus', this.$refs.trix.editor, event)
      }
    },
    processTrixBlur(event) {
      if (this.$refs.trix) {
        this.isActived = false
        this.$emit('trix-blur', this.$refs.trix.editor, event)
      }
    },
    handleContentChange(event) {
      this.editorContent = event.srcElement ? event.srcElement.value : event.target.value
      this.$emit('input', this.editorContent)
    },
    handleInitialize(event) {
      /**
       * If autofocus is true, manually set focus to
       * beginning of content (consistent with Trix behavior)
       */
      if (this.autofocus) {
        this.$refs.trix.editor.setSelectedRange(0)
      }
      this.$emit('trix-initialize', this.emitInitialize)
    },
    handleInitialContentChange(newContent, oldContent) {
      newContent = newContent === undefined ? '' : newContent
      if (this.$refs.trix.editor && this.$refs.trix.editor.innerHTML !== newContent) {
        /* Update editor's content when initial content changed */
        this.editorContent = newContent
        /**
         *  If user are typing, then don't reload the editor,
         *  hence keep cursor's position after typing.
         */
        if (!this.isActived) {
          this.reloadEditorContent(this.editorContent)
        }
      }
    },
    emitEditorState(value) {
      /**
       * If localStorage is enabled,
       * then save editor's content into storage
       */
      if (this.localStorage) {
        localStorage.setItem(this.storageId('VueTrix'), JSON.stringify(this.$refs.trix.editor))
      }
      this.$emit('update', this.editorContent)
    },
    storageId(component) {
      if (this.inputId) {
        return `${component}.${this.inputId}.content`
      } else {
        return `${component}.content`
      }
    },
    reloadEditorContent(newContent) {
      // Reload HTML content
      this.$refs.trix.editor.loadHTML(newContent)
      // Move cursor to end of new content updated
      if (this.autofocus) {
        this.$refs.trix.editor.setSelectedRange(this.getContentEndPosition())
      }
    },
    getContentEndPosition() {
      return this.$refs.trix.editor.getDocument().toString().length - 1
    },
    decorateDisabledEditor(editorState) {
      /** Disable toolbar and editor by pointer events styling */
      if (editorState) {
        this.$refs.trix.disabled = true
        this.$refs.trix.contentEditable = false
        this.$refs.trix.style['pointer-events'] = 'none'
        this.$refs.trix.style['background-color'] = '#444'
        this.$refs.trix.style['color'] = '#bbb'
      } else {
        this.$refs.trix.disabled = false
        this.$refs.trix.contentEditable = true
        this.$refs.trix.style['pointer-events'] = 'unset'
        this.$refs.trix.style['background-color'] = ''
        this.$refs.trix.style['color'] = ''
      }
    },
    overrideConfig(config) {
      Trix.config = this.deepMerge(Trix.config, config)
    },
    deepMerge(target, override) {
      // deep merge the object into the target object
      for (let prop in override) {
        if (override.hasOwnProperty(prop)) {
          if (Object.prototype.toString.call(override[prop]) === '[object Object]') {
            // if the property is a nested object
            target[prop] = this.deepMerge(target[prop], override[prop])
          } else {
            // for regular property
            target[prop] = override[prop]
          }
        }
      }
      return target
    },
    blur() {
      if (this.$refs.trix && this.$refs.trix.blur) {
        this.$refs.trix.blur()
      }
    },
    handleAttachmentAdd(event) {
      // Prevent pasting in images/any files from the browser
      event.attachment.remove()
    }
  },
  mounted() {
    /** Override editor configuration */
    this.overrideConfig(this.config)
    /** Check if editor read-only mode is required */
    this.decorateDisabledEditor(this.disabledEditor)
    this.$nextTick(() => {
      /**
       *  If localStorage is enabled,
       *  then load editor's content from the beginning.
       */
      if (this.localStorage) {
        const savedValue = localStorage.getItem(this.storageId('VueTrix'))
        if (savedValue && !this.srcContent) {
          this.$refs.trix.editor.loadJSON(JSON.parse(savedValue))
        }
      }
    })
  }
}
</script>

<style lang="css" module>
.trix_container {
  max-width: 100%;
  height: auto;
}
.trix_container .trix-button-group {
  background-color: white;
}
.trix_container .trix-content {
  background-color: white;
}
trix-editor {
  height: calc(4 * 1lh);
  min-height: calc(4 * 1lh);
  overflow-y: auto;
  resize: vertical;
}

trix-editor * {
  pointer-events: inherit;
}
</style>

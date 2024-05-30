<template>
  <div ref="wrapper" class="modal modal-bg w-full h-full fixed top-0 left-0 bg-primary bg-opacity-75 flex items-center justify-center z-60 opacity-0">
    <div class="absolute top-0 left-0 right-0 w-full h-36 bg-gradient-to-t from-transparent via-black-500 to-black-700 opacity-90 pointer-events-none" />
    <div ref="content" class="relative text-white" :style="{ height: modalHeight, width: modalWidth }" v-click-outside="clickedOutside">
      <div class="px-4 w-full text-sm py-6 rounded-lg bg-bg shadow-lg border border-black-300">
        <p id="confirm-prompt-message" class="text-lg mb-6 mt-2 px-1" v-html="message" />

        <ui-checkbox v-if="checkboxLabel" v-model="checkboxValue" checkbox-bg="bg" :label="checkboxLabel" label-class="pl-2 text-base" class="mb-6 px-1" />

        <div class="flex px-1 items-center">
          <ui-btn v-if="isYesNo" color="primary" @click="nevermind">{{ $strings.ButtonCancel }}</ui-btn>
          <div class="flex-grow" />
          <ui-btn v-if="isYesNo" :color="yesButtonColor" @click="confirm">{{ yesButtonText }}</ui-btn>
          <ui-btn v-else color="primary" @click="confirm">{{ $strings.ButtonOk }}</ui-btn>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: {},
  data() {
    return {
      el: null,
      content: null,
      checkboxValue: false
    }
  },
  watch: {
    show(newVal) {
      if (newVal) {
        this.setShow()
      } else {
        this.setHide()
      }
    }
  },
  computed: {
    show: {
      get() {
        return this.$store.state.globals.showConfirmPrompt
      },
      set(val) {
        this.$store.commit('globals/setShowConfirmPrompt', val)
      }
    },
    confirmPromptOptions() {
      return this.$store.state.globals.confirmPromptOptions || {}
    },
    message() {
      return this.confirmPromptOptions.message || ''
    },
    callback() {
      return this.confirmPromptOptions.callback
    },
    type() {
      return this.confirmPromptOptions.type || 'ok'
    },
    persistent() {
      return !!this.confirmPromptOptions.persistent
    },
    checkboxLabel() {
      return this.confirmPromptOptions.checkboxLabel
    },
    yesButtonText() {
      return this.confirmPromptOptions.yesButtonText || this.$strings.ButtonYes
    },
    yesButtonColor() {
      return this.confirmPromptOptions.yesButtonColor || 'success'
    },
    checkboxDefaultValue() {
      return !!this.confirmPromptOptions.checkboxDefaultValue
    },
    isYesNo() {
      return this.type === 'yesNo'
    },
    modalHeight() {
      return 'unset'
    },
    modalWidth() {
      return '500px'
    }
  },
  methods: {
    clickedOutside(evt) {
      if (!this.show) return
      if (evt) {
        evt.stopPropagation()
        evt.preventDefault()
      }

      if (this.persistent) return
      if (this.callback) this.callback(false)
      this.show = false
    },
    nevermind() {
      if (this.callback) this.callback(false)
      this.show = false
    },
    confirm() {
      if (this.callback) this.callback(true, this.checkboxValue)
      this.show = false
    },
    setShow() {
      this.checkboxValue = this.checkboxDefaultValue
      this.$eventBus.$emit('showing-prompt', true)
      document.body.appendChild(this.el)
      setTimeout(() => {
        this.content.style.transform = 'scale(1)'
      }, 10)
    },
    setHide() {
      this.$eventBus.$emit('showing-prompt', false)
      this.content.style.transform = 'scale(0)'
      this.el.remove()
    }
  },
  mounted() {
    this.el = this.$refs.wrapper
    this.content = this.$refs.content
    this.content.style.transform = 'scale(0)'
    this.content.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
    this.el.style.opacity = 1
    this.el.remove()
  },
  beforeDestroy() {
    if (this.show) {
      this.$eventBus.$emit('showing-prompt', false)
    }
  }
}
</script>

<style>
#confirm-prompt-message code {
  font-size: 1rem;
  border-radius: 6px;
  background-color: rgb(82, 82, 82);
  color: white;
  padding: 2px 4px;
}
</style>

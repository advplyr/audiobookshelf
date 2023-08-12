<template>
  <modals-modal ref="modal" v-model="show" name="ereader-device-edit" :width="800" :height="'unset'" :processing="processing">
    <template #outer>
      <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden">
        <p class="text-3xl text-white truncate">{{ title }}</p>
      </div>
    </template>
    <form @submit.prevent="submitForm">
      <div class="w-full text-sm rounded-lg bg-bg shadow-lg border border-black-300">
        <div class="w-full px-3 py-5 md:p-12">
          <div class="flex items-center -mx-1 mb-2">
            <div class="w-full md:w-1/2 px-1">
              <ui-text-input-with-label ref="ereaderNameInput" v-model="newDevice.name" :disabled="processing" :label="$strings.LabelName" />
            </div>
            <div class="w-full md:w-1/2 px-1">
              <ui-text-input-with-label ref="ereaderEmailInput" v-model="newDevice.email" :disabled="processing" :label="$strings.LabelEmail" />
            </div>
          </div>

          <div class="flex items-center pt-4">
            <div class="flex-grow" />
            <ui-btn color="success" type="submit">{{ $strings.ButtonSubmit }}</ui-btn>
          </div>
        </div>
      </div>
    </form>
  </modals-modal>
</template>

<script>
export default {
  props: {
    value: Boolean,
    existingDevices: {
      type: Array,
      default: () => []
    },
    ereaderDevice: {
      type: Object,
      default: () => null
    }
  },
  data() {
    return {
      processing: false,
      newDevice: {
        name: '',
        email: ''
      }
    }
  },
  watch: {
    show: {
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
    title() {
      return this.ereaderDevice ? 'Create Device' : 'Update Device'
    }
  },
  methods: {
    submitForm() {
      this.$refs.ereaderNameInput.blur()
      this.$refs.ereaderEmailInput.blur()

      if (!this.newDevice.name?.trim() || !this.newDevice.email?.trim()) {
        this.$toast.error('Name and email required')
        return
      }

      this.newDevice.name = this.newDevice.name.trim()
      this.newDevice.email = this.newDevice.email.trim()

      if (!this.ereaderDevice) {
        if (this.existingDevices.some((d) => d.name === this.newDevice.name)) {
          this.$toast.error('EReader device with that name already exists')
          return
        }

        this.submitCreate()
      } else {
        if (this.ereaderDevice.name !== this.newDevice.name && this.existingDevices.some((d) => d.name === this.newDevice.name)) {
          this.$toast.error('EReader device with that name already exists')
          return
        }

        this.submitUpdate()
      }
    },
    submitUpdate() {
      this.processing = true

      const existingDevicesWithoutThisOne = this.existingDevices.filter((d) => d.name !== this.ereaderDevice.name)

      const payload = {
        ereaderDevices: [
          ...existingDevicesWithoutThisOne,
          {
            ...this.newDevice
          }
        ]
      }

      this.$axios
        .$post(`/api/emails/ereader-devices`, payload)
        .then((data) => {
          this.$emit('update', data.ereaderDevices)
          this.$toast.success('Device updated')
          this.show = false
        })
        .catch((error) => {
          console.error('Failed to update device', error)
          this.$toast.error('Failed to update device')
        })
        .finally(() => {
          this.processing = false
        })
    },
    submitCreate() {
      this.processing = true

      const payload = {
        ereaderDevices: [
          ...this.existingDevices,
          {
            ...this.newDevice
          }
        ]
      }

      this.$axios
        .$post('/api/emails/ereader-devices', payload)
        .then((data) => {
          this.$emit('update', data.ereaderDevices || [])
          this.$toast.success('Device added')
          this.show = false
        })
        .catch((error) => {
          console.error('Failed to add device', error)
          this.$toast.error('Failed to add device')
        })
        .finally(() => {
          this.processing = false
        })
    },
    init() {
      if (this.ereaderDevice) {
        this.newDevice.name = this.ereaderDevice.name
        this.newDevice.email = this.ereaderDevice.email
      } else {
        this.newDevice.name = ''
        this.newDevice.email = ''
      }
    }
  },
  mounted() {}
}
</script>

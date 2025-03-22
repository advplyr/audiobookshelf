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
          <div class="flex items-center -mx-1 mb-4">
            <div class="w-full md:w-1/2 px-1">
              <ui-text-input-with-label ref="ereaderNameInput" v-model="newDevice.name" :disabled="processing" :label="$strings.LabelName" />
            </div>
            <div class="w-full md:w-1/2 px-1">
              <ui-text-input-with-label ref="ereaderEmailInput" v-model="newDevice.email" :disabled="processing" :label="$strings.LabelEmail" />
            </div>
          </div>

          <div class="flex items-center pt-4">
            <div class="grow" />
            <ui-btn color="bg-success" type="submit">{{ $strings.ButtonSubmit }}</ui-btn>
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
        email: '',
        availabilityOption: 'adminAndUp',
        users: []
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
    user() {
      return this.$store.state.user.user
    },
    title() {
      return !this.ereaderDevice ? 'Create Device' : 'Update Device'
    }
  },
  methods: {
    submitForm() {
      this.$refs.ereaderNameInput.blur()
      this.$refs.ereaderEmailInput.blur()

      if (!this.newDevice.name?.trim() || !this.newDevice.email?.trim()) {
        this.$toast.error(this.$strings.ToastNameEmailRequired)
        return
      }

      this.newDevice.name = this.newDevice.name.trim()
      this.newDevice.email = this.newDevice.email.trim()

      // Only catches duplicate names for the current user
      // Duplicates with other users caught on server side
      if (!this.ereaderDevice) {
        if (this.existingDevices.some((d) => d.name === this.newDevice.name)) {
          this.$toast.error(this.$strings.ToastDeviceNameAlreadyExists)
          return
        }

        this.submitCreate()
      } else {
        if (this.ereaderDevice.name !== this.newDevice.name && this.existingDevices.some((d) => d.name === this.newDevice.name)) {
          this.$toast.error(this.$strings.ToastDeviceNameAlreadyExists)
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
        .$post(`/api/me/ereader-devices`, payload)
        .then((data) => {
          this.$emit('update', data.ereaderDevices)
          this.show = false
        })
        .catch((error) => {
          console.error('Failed to update device', error)
          if (error.response?.data?.toLowerCase().includes('duplicate')) {
            this.$toast.error(this.$strings.ToastDeviceNameAlreadyExists)
          } else {
            this.$toast.error(this.$strings.ToastDeviceAddFailed)
          }
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
        .$post('/api/me/ereader-devices', payload)
        .then((data) => {
          this.$emit('update', data.ereaderDevices || [])
          this.show = false
        })
        .catch((error) => {
          console.error('Failed to add device', error)
          if (error.response?.data?.toLowerCase().includes('duplicate')) {
            this.$toast.error(this.$strings.ToastDeviceNameAlreadyExists)
          } else {
            this.$toast.error(this.$strings.ToastDeviceAddFailed)
          }
        })
        .finally(() => {
          this.processing = false
        })
    },
    init() {
      if (this.ereaderDevice) {
        this.newDevice.name = this.ereaderDevice.name
        this.newDevice.email = this.ereaderDevice.email
        this.newDevice.availabilityOption = this.ereaderDevice.availabilityOption || 'specificUsers'
        this.newDevice.users = this.ereaderDevice.users || [this.user.id]
      } else {
        this.newDevice.name = ''
        this.newDevice.email = ''
        this.newDevice.availabilityOption = 'specificUsers'
        this.newDevice.users = [this.user.id]
      }
    }
  },
  mounted() {}
}
</script>

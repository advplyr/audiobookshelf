<template>
  <div class="max-w-52" v-click-outside="clickOutsideObj" v-if="has_devices">
    <button type="button" :disabled="disabled" aria-haspopup="listbox" :aria-expanded="showMenu" @click.stop.prevent="clickShowMenu">
      <div class="flex">
        <span class="hidden sm:block truncate">
          <span v-show="has_devices" class="material-icons-outlined text-2xl text-opacity-50" v-bind:class="{ 'icon-blue': has_device }"> cast </span>
        </span>
      </div>
    </button>

    <transition name="menu">
      <ul v-show="showMenu" class="absolute z-10 -mt-px w-full min-w-48 bg-primary border border-black-200 shadow-lg rounded-b-md py-1 overflow-auto focus:outline-none sm:text-sm DlnaDropdownMenu" tabindex="-1" role="listbox">
        <template v-for="device in get_devices">
          <li :key="device.host" class="text-gray-400 hover:text-white relative py-2 cursor-pointer hover:bg-black-400" v-bind:class="{ 'bg-black-600': get_device == device.UDN }" role="option" tabindex="0" @keydown.enter="selectDevice(device.host)" @click="selectDevice(device.UDN)">
            <div class="flex items-center px-2">
              <span class="font-normal block truncate font-sans text-sm">{{ device.name }}</span>
            </div>
          </li>
        </template>
      </ul>
    </transition>
  </div>
</template>

<script>
import { ref, computed } from 'vue'
export default {
  data() {
    return {
      clickOutsideObj: {
        handler: this.clickedOutside,
        events: ['mousedown'],
        isActive: true
      },
      showMenu: false,
      disabled: false
    }
  },
  methods: {
    clickShowMenu() {
      if (this.disabled) return
      this.showMenu = !this.showMenu
    },
    clickedOutside() {
      this.showMenu = false
    },
    selectDevice(device) {
      if (this.selectedDevice == device) {
        this.$store.commit('globals/setDlnaDevice', '')
        this.selectedDevice = ''
      } else {
        this.selectedDevice = device
        this.$store.commit('globals/setDlnaDevice', device)
        this.$root.socket.emit('test')
      }
      this.showMenu = false
    }
  },
  computed: {
    has_device() {
      return Boolean(this.$store.getters['globals/getDLNAdevice'])
    },
    has_devices() {
      return Boolean(this.$store.getters['globals/getDLNAdevices'])
    },
    get_device() {
      return this.$store.getters['globals/getDLNAdevice']
    },
    get_devices() {
      return this.$store.getters['globals/getDLNAdevices']
    }
  },
  mounted() {
    this.$axios
      .$get('/api/dlna/devices')
      .catch((error) => {
        console.error('failed to fetch DLNA devices', error)
        return null
      })
      .then((response) => {
        this.$store.commit('globals/setDlnaDevices', response)
      })
  }
}
</script>

<style scoped>
.DlnaDropdownMenu {
  max-height: calc(100vh - 75px);
  max-width: 100pt;
}
.icon-blue {
  color: blue;
}
</style>

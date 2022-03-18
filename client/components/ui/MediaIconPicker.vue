<template>
  <div class="relative w-full h-9" v-click-outside="clickOutsideObj">
    <p class="text-sm font-semibold">{{ label }}</p>

    <button type="button" :disabled="disabled" class="relative h-full w-full border border-gray-600 rounded shadow-sm pl-3 pr-3 text-left focus:outline-none cursor-pointer bg-primary text-gray-100 hover:text-gray-200" aria-haspopup="listbox" aria-expanded="true" @click.stop.prevent="clickShowMenu">
      <span class="flex items-center">
        <widgets-library-icon :icon="selected" />
      </span>
    </button>

    <transition name="menu">
      <ul v-show="showMenu" class="absolute z-10 -mt-px w-full bg-primary border border-black-200 shadow-lg max-h-56 rounded-b-md py-1 ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm" tabindex="-1" role="listbox">
        <template v-for="type in types">
          <li :key="type.id" class="text-gray-100 select-none relative py-2 cursor-pointer hover:bg-black-400 flex justify-center" id="listbox-option-0" role="option" @click="select(type)">
            <widgets-library-icon :icon="type.id" />
          </li>
        </template>
      </ul>
    </transition>
  </div>
</template>

<script>
export default {
  props: {
    value: String,
    disabled: Boolean,
    label: {
      type: String,
      default: 'Icon'
    }
  },
  data() {
    return {
      clickOutsideObj: {
        handler: this.clickedOutside,
        events: ['mousedown'],
        isActive: true
      },
      showMenu: false,
      types: [
        {
          id: 'default',
          name: 'Default'
        },
        {
          id: 'audiobook',
          name: 'Audiobooks'
        },
        {
          id: 'book',
          name: 'Books'
        },
        {
          id: 'podcast',
          name: 'Podcasts'
        },
        {
          id: 'comic',
          name: 'Comics'
        }
      ]
    }
  },
  computed: {
    selected: {
      get() {
        return this.value || 'default'
      },
      set(val) {
        this.$emit('input', val)
      }
    },
    selectedItem() {
      return this.types.find((t) => t.id === this.selected)
    },
    selectedName() {
      return this.selectedItem ? this.selectedItem.name : 'Default'
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
    select(type) {
      if (this.disabled) return
      this.selected = type.id
      this.showMenu = false
    }
  },
  mounted() {}
}
</script>
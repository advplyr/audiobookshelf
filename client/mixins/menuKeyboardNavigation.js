/**
 * Mixin for keyboard navigation in dropdown menus.
 * This can be used in any component that has a dropdown menu with <li> items.
 * The following example shows how to use this mixin in your component:
 * <template>
 *   <div>
 *     <input type="text" @keydown="menuNavigationHandler">
 *     <ul ref="menu">
 *       <li v-for="(item, index) in itemsToShow" :key="index" :class="isMenuItemSelected(item) ? ... : ''" @click="clickedOption($event, item)">
 *         {{ item }}
 *       </li>
 *     </ul>
 *   </div>
 * </template>
 *
 * This mixin assumes the following are defined in your component:
 * itemsToShow: Array of items to show in the dropdown
 * clickedOption: Event handler for when an item is clicked
 * submitForm: Event handler for when the form is submitted
 *
 * It also assumes you have a ref="menu" on the menu element.
 */
export default {
  data() {
    return {
      selectedMenuItemIndex: null
    }
  },
  methods: {
    menuNavigationHandler(event) {
      let items = this.itemsToShow
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        if (!items.length) return
        if (event.key === 'ArrowDown') {
          if (this.selectedMenuItemIndex === null) {
            this.selectedMenuItemIndex = 0
          } else {
            this.selectedMenuItemIndex = Math.min(this.selectedMenuItemIndex + 1, items.length - 1)
          }
        } else if (event.key === 'ArrowUp') {
          if (this.selectedMenuItemIndex === null) {
            this.selectedMenuItemIndex = items.length - 1
          } else {
            this.selectedMenuItemIndex = Math.max(this.selectedMenuItemIndex - 1, 0)
          }
        }
        this.recalcScroll()
      } else if (event.key === 'Enter') {
        event.preventDefault()
        if (this.selectedMenuItemIndex !== null) {
          this.clickedOption(event, items[this.selectedMenuItemIndex])
        } else {
          this.submitForm()
        }
      } else {
        this.selectedMenuItemIndex = null
      }
    },
    recalcScroll() {
      const menu = this.$refs.menu
      if (!menu) return
      var menuItems = menu.querySelectorAll('li')
      if (!menuItems.length) return
      var selectedItem = menuItems[this.selectedMenuItemIndex]
      if (!selectedItem) return
      var menuHeight = menu.offsetHeight
      var itemHeight = selectedItem.offsetHeight
      var itemTop = selectedItem.offsetTop
      var itemBottom = itemTop + itemHeight
      if (itemBottom > menu.scrollTop + menuHeight) {
        let menuPaddingBottom = parseFloat(window.getComputedStyle(menu).paddingBottom)
        menu.scrollTop = itemBottom - menuHeight + menuPaddingBottom
      } else if (itemTop < menu.scrollTop) {
        let menuPaddingTop = parseFloat(window.getComputedStyle(menu).paddingTop)
        menu.scrollTop = itemTop - menuPaddingTop
      }
    },
    isMenuItemSelected(item) {
      return this.selectedMenuItemIndex !== null && this.itemsToShow[this.selectedMenuItemIndex] === item
    }
  }
}

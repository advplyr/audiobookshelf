<template>
  <div class="outer-container">
    <!-- absolute positioned container -->
    <div class="inner-container">
      <div class="relative h-10">
        <div class="table-header" id="headerdiv">
          <table id="headertable" width="100%" cellpadding="0" cellspacing="0">
            <thead>
              <tr>
                <th class="header-cell min-w-12 max-w-12"></th>
                <th class="header-cell min-w-6 max-w-6"></th>
                <th class="header-cell min-w-64 max-w-64 px-2">Title</th>
                <th class="header-cell min-w-48 max-w-48 px-2">Author</th>
                <th class="header-cell min-w-48 max-w-48 px-2">Series</th>
                <th class="header-cell min-w-24 max-w-24 px-2">Year</th>
                <th class="header-cell min-w-80 max-w-80 px-2">Description</th>
                <th class="header-cell min-w-48 max-w-48 px-2">Narrator</th>
                <th class="header-cell min-w-48 max-w-48 px-2">Genres</th>
                <th class="header-cell min-w-48 max-w-48 px-2">Tags</th>
                <th class="header-cell min-w-24 max-w-24 px-2"></th>
              </tr>
            </thead>
          </table>
        </div>
        <div class="absolute top-0 left-0 w-full h-full pointer-events-none" :class="isScrollable ? 'header-shadow' : ''" />
      </div>

      <div ref="tableBody" class="table-body" onscroll="document.getElementById('headerdiv').scrollLeft = this.scrollLeft;" @scroll="tableScrolled">
        <table id="bodytable" width="100%" cellpadding="0" cellspacing="0">
          <tbody>
            <template v-for="book in books">
              <app-book-list-row :key="book.id" :book="book" @edit="editBook" />
            </template>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    books: {
      type: Array,
      default: () => []
    }
  },
  data() {
    return {
      isScrollable: false
    }
  },
  computed: {},
  methods: {
    checkIsScrolled() {
      if (!this.$refs.tableBody) return
      this.isScrollable = this.$refs.tableBody.scrollTop > 0
    },
    tableScrolled() {
      this.checkIsScrolled()
    },
    editBook(book) {
      var bookIds = this.books.map((e) => e.id)
      this.$store.commit('setBookshelfBookIds', bookIds)
      this.$store.commit('showEditModal', book)
    }
  },
  mounted() {
    this.checkIsScrolled()
  },
  beforeDestroy() {}
}
</script>

<style>
.outer-container {
  position: absolute;
  top: 0;
  left: 0;
  overflow: visible;
  height: calc(100% - 50px);
  width: calc(100% - 10px);
  margin: 10px;
}
.inner-container {
  width: 100%;
  height: 100%;
  position: relative;
}
.table-header {
  float: left;
  overflow: hidden;
  width: 100%;
}
.header-shadow {
  box-shadow: 3px 8px 3px #11111155;
}
.table-body {
  float: left;
  height: 100%;
  width: inherit;
  overflow-y: scroll;
  padding-right: 0px;
}
.header-cell {
  background-color: #22222288;
  padding: 0px 4px;
  text-align: left;
  height: 40px;
  font-size: 0.9rem;
  font-weight: semi-bold;
}
.body-cell {
  text-align: left;
  font-size: 0.9rem;
}
.book-row {
  background-color: #22222288;
}
.book-row:nth-child(odd) {
  background-color: #333;
}
.book-row.selected {
  background-color: rgba(0, 255, 0, 0.05);
}
</style>
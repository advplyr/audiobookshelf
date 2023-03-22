<template>
  <div class="h-full w-full">
    <div class="h-full flex items-center">
      <div style="width: 100px; max-width: 100px" class="h-full flex items-center overflow-x-hidden justify-center">
        <span v-if="hasPrev"
          class="material-icons text-white text-opacity-50 hover:text-opacity-80 cursor-pointer text-6xl"
          @mousedown.prevent @click="prev">chevron_left</span>
      </div>
      <div id="frame" class="w-full" style="height: 80%">
        <div id="viewer" class="shadow-md"></div>
      </div>
      <div style="width: 100px; max-width: 100px" class="h-full flex items-center justify-center overflow-x-hidden">
        <span v-if="hasNext"
          class="material-icons text-white text-opacity-50 hover:text-opacity-80 cursor-pointer text-6xl"
          @mousedown.prevent @click="next">chevron_right</span>
      </div>
    </div>
  </div>
</template>

<script>
import ePub from "epubjs";

/** 
 * @typedef {object} EpubReader
 * @property {ePub.Book} book
 * @property {ePub.Rendition} rendition
 */
export default {
  props: {
    url: String,
    libraryItem: {
      type: Object,
      default: () => { }
    }
  },
  data() {
    return {
      /** @type {ePub.Book} */
      book: null,
      /** @type {ePub.Rendition} */
      rendition: null,
    };
  },
  computed: {
    /** @returns {string} */
    libraryItemId() { return this.libraryItem?.id },
    hasPrev() { return !this.rendition?.location?.atStart },
    hasNext() { return !this.rendition?.location?.atEnd },
    /** @returns {Array<ePub.NavItem>} */
    chapters() { return this.book ? this.book.navigation.toc : [] },
    userMediaProgress() {
      if (!this.libraryItemId) return
      return this.$store.getters['user/getUserMediaProgress'](this.libraryItemId)
    },
  },
  methods: {
    prev() { return this.rendition?.prev() },
    next() { return this.rendition?.next() },
    goToChapter(href) { return this.rendition?.display(href) },
    keyUp(e) {
      const rtl = this.book.package.metadata.direction === 'rtl'
      if ((e.keyCode || e.which) == 37) {
        return rtl ? this.next() : this.prev();
      } else if ((e.keyCode || e.which) == 39) {
        return rtl ? this.prev() : this.next();
      }
    },
    /**
     * @param {object} payload
     * @param {string} payload.ebookLocation - CFI of the current location
     * @param {string} payload.ebookLocations - list of CFI tags
     * @param {number} payload.progress - Progress Percentage
     */
    updateProgress(payload) {
      this.$axios.$patch(`/api/me/progress/${this.libraryItemId}`, payload).catch((error) => {
        console.error('EpubReader.updateProgress failed:', error)
      })
    },
    /** @param {string} location - CFI of the new location */
    relocated(location) {
      if (location.end.percentage) {
        this.updateProgress({
          ebookLocation: location.start.cfi,
          progress: location.end.percentage,
        });
      } else {
        this.updateProgress({
          ebookLocation: location.start.cfi,
        });
      }
    },
    initEpub() {
      /** @type {EpubReader} */
      var reader = this;

      /** @type {ePub.Book} */
      reader.book = new ePub(reader.url, {
        width: window.innerWidth - 200,
        height: window.innerHeight - 50,
      });

      /** @type {ePub.Rendition} */
      reader.rendition = reader.book.renderTo("viewer", {
        width: window.innerWidth - 200,
        height: window.innerHeight * 0.8
      });

      // load saved progress
      reader.rendition.display(this.userMediaProgress?.ebookLocation || reader.book.locations.start);

      // load style
      reader.rendition.themes.default({ "*": { "color": "#fff!important" } });

      reader.book.ready.then(() => {
        // set up event listeners
        reader.rendition.on('relocated', reader.relocated);
        reader.rendition.on('keydown', reader.keyUp)
        document.addEventListener('keydown', reader.keyUp, false);

        // load ebook cfi locations
        if (this.userMediaProgress?.ebookLocations) {
          reader.book.locations.load(this.userMediaProgress?.ebookLocations)
        } else {
          reader.book.locations.generate().then(() => {
            this.updateProgress({
              ebookLocations: reader.book.locations.save(),
            });
          });
        }
      });
    },
  },
  mounted() {
    this.initEpub();
  },
};
</script>

<template>
  <div class="h-full w-full">
    <div class="h-full flex items-center">
      <div style="width: 100px; max-width: 100px" class="h-full flex items-center overflow-x-hidden justify-center">
        <span id="prev"
          class="material-icons text-white text-opacity-50 hover:text-opacity-80 cursor-pointer text-6xl"
          @mousedown.prevent @click="prev">chevron_left</span>
      </div>
      <div id="frame" class="w-full" style="height: 90%">
        <div id="viewer" class="border border-gray-100 bg-white shadow-md"></div>
      </div>
      <div style="width: 100px; max-width: 100px" class="h-full flex items-center justify-center overflow-x-hidden">
        <span id="next" class="material-icons text-white text-opacity-50 hover:text-opacity-80 cursor-pointer text-6xl"
          @mousedown.prevent @click="next">chevron_right</span>
      </div>
    </div>
  </div>
</template>

<script>
import ePub from "epubjs";

/** 
 * @typedef {EpubReader}
 * @property {ePub.Book} book
 * @property {ePub.Rendition} rendition
 */
export default {
  props: {
    url: String,
    libraryItem: {
      type: Object,
      default: () => {}
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
    libraryItemId() { return this.libraryItem ? this.libraryItem.id : null },
    hasPrev() { return !this.rendition?.location.atStart },
    hasNext() { return !this.rendition?.location.atEnd },
    chapters() { return this.book ? this.book.navigation.toc : [] },
    title() { return this.book ? this.book.metadata.title : "" },
    author() { return this.book ? this.book.metadata.creator : "" },
    userMediaProgress() {
      if (!this.libraryItemId) return
      return this.$store.getters['user/getUserMediaProgress'](this.libraryItemId)
    },
  },
  methods: {
    changedChapter() { this.rendition?.display(this.selectedChapter) },
    prev() { this.rendition?.prev() },
    next() { this.rendition?.next() },
    keyUp(e) {
      if ((e.keyCode || e.which) == 37) {
        this.prev();
      } else if ((e.keyCode || e.which) == 39) {
        this.next();
      }
    },
    relocated(location) {
      var cfi = location.start.cfi;
      var cfiFragment = "#" + cfi;

      if(window.location.hash != cfiFragment) {
        const url = new URL(window.location);
        url.hash = cfiFragment;
        history.pushState({}, '', url);
      
        var updatePayload = {
          currentTime: cfi,
        }

        var percentage = this.book.locations.percentageFromCfi(cfi);
        if (percentage) {
          updatePayload.progress = percentage
        }

        this.$axios.$patch(`/api/me/progress/${this.libraryItemId}`, updatePayload).catch((error) => {
          console.error('Failed', error)
        })
      }
    },
    initEpub(cfi) {
      var reader = this;

      /** @type {ePub.Book} */
      reader.book = new ePub(reader.url, {
        storage: false,
        worker: false,
        manager: "continuous",
        flow: "scrolled",
        spreads: false,
        width: window.innerWidth - 200,
        height: window.innerHeight - 50,
      });

      /** @type {ePub.Rendition} */
      reader.rendition = reader.book.renderTo("viewer", {
        width: window.innerWidth - 200,
        height: window.innerHeight * 0.9
      });

      reader.rendition.display(cfi);
      reader.book.ready.then(() => {
        reader.rendition.on('relocated', reader.relocated);
        reader.rendition.on('keydown', reader.keyUp)
        document.addEventListener('keydown', reader.keyUp, false);

        reader.book.locations.generate();
      });
    },
  },
  mounted() {
    this.initEpub(this.userMediaProgress?.currentTime);
  },
};
</script>

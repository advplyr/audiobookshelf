<template>
  <div ref="wrapper" class="relative pointer-events-none" :style="{ width: standardWidth * 0.8 * 1.1 * scale + 'px', height: standardHeight * 1.1 * scale + 'px', marginBottom: 20 + 'px', marginTop: 15 + 'px' }">
    <div ref="card" class="wrap absolute origin-center transform duration-200" :style="{ transform: `scale(${scale * scaleMultiplier}) translateY(${hover2 ? '-40%' : '-50%'})` }">
      <div class="perspective">
        <div class="book-wrap transform duration-100 pointer-events-auto" :class="hover2 ? 'z-80' : 'rotate'" @mouseover="hover = true" @mouseout="hover = false">
          <div class="book book-1 box-shadow-book3d" ref="front"></div>
          <div class="title book-1 pointer-events-none" ref="left"></div>
          <div class="bottom book-1 pointer-events-none" ref="bottom"></div>
          <div class="book-back book-1 pointer-events-none">
            <div class="text pointer-events-none">
              <h3 class="mb-4">Book Back</h3>
              <p>
                <span>Lorem ipsum dolor sit amet, consectetur adipisicing elit. Sunt earum doloremque aliquam culpa dolor nostrum consequatur quas dicta? Molestias repellendus minima pariatur libero vel, reiciendis optio magnam rerum, labore corporis.</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    src: String,
    width: {
      type: Number,
      default: 200
    }
  },
  data() {
    return {
      hover: false,
      hover2: false,
      standardWidth: 200,
      standardHeight: 320,
      isAttached: true,
      pageX: 0,
      pageY: 0
    }
  },
  watch: {
    src(newVal) {
      this.setCover()
    },
    width(newVal) {
      this.init()
    },
    hover(newVal) {
      if (newVal) {
        this.unattach()
      } else {
        this.attach()
      }
      setTimeout(() => {
        this.hover2 = newVal
      }, 100)
    }
  },
  computed: {
    scaleMultiplier() {
      return this.hover2 ? 1.25 : 1
    },
    scale() {
      var scale = this.width / this.standardWidth
      return scale
    }
  },
  methods: {
    unattach() {
      if (this.$refs.card && this.isAttached) {
        var bookshelf = document.getElementById('bookshelf')
        if (bookshelf) {
          var pos = this.$refs.wrapper.getBoundingClientRect()

          this.pageX = pos.x
          this.pageY = pos.y
          document.body.appendChild(this.$refs.card)
          this.$refs.card.style.left = this.pageX + 'px'
          this.$refs.card.style.top = this.pageY + 'px'
          this.$refs.card.style.zIndex = 50
          this.isAttached = false
        } else if (bookshelf) {
          console.log(this.pageX, this.pageY)
          this.isAttached = false
        }
      }
    },
    attach() {
      if (this.$refs.card && !this.isAttached) {
        if (this.$refs.wrapper) {
          this.isAttached = true

          this.$refs.wrapper.appendChild(this.$refs.card)
          this.$refs.card.style.left = '0px'
          this.$refs.card.style.top = '0px'
        }
      } else {
        console.log('Is attached already', this.isAttached)
      }
    },
    init() {
      var standardWidth = this.standardWidth
      document.documentElement.style.setProperty('--book-w', standardWidth + 'px')
      document.documentElement.style.setProperty('--book-wx', standardWidth + 1 + 'px')
      document.documentElement.style.setProperty('--book-h', standardWidth * 1.6 + 'px')
      document.documentElement.style.setProperty('--book-d', 40 + 'px')
    },
    setElBg(el) {
      el.style.backgroundImage = `url("${this.src}")`
      el.style.backgroundSize = 'cover'
      el.style.backgroundPosition = 'center center'
      el.style.backgroundRepeat = 'no-repeat'
    },
    setCover() {
      if (this.$refs.front) {
        this.setElBg(this.$refs.front)
      }
      if (this.$refs.bottom) {
        this.setElBg(this.$refs.bottom)
        this.$refs.bottom.style.backgroundSize = '2000%'
        this.$refs.bottom.style.filter = 'blur(1px)'
      }
      if (this.$refs.left) {
        this.setElBg(this.$refs.left)
        this.$refs.left.style.backgroundSize = '2000%'
        this.$refs.left.style.filter = 'blur(1px)'
      }
    }
  },
  mounted() {
    this.setCover()
    this.init()
  }
}
</script>

<style>
/* :root {
  --book-w: 200px;
  --book-h: 320px;
  --book-d: 30px;
  --book-wx: 201px;
} */
/* 
.wrap {
  width: calc(1.1 * var(--book-w));
  height: calc(1.1 * var(--book-h));
  margin: 0 auto;
}
.perspective {
  position: relative;
  width: 100%;
  height: 100%;

  perspective: 600px;
  transform-style: preserve-3d;
  overflow: hidden;
}

.book-wrap {
  height: 100%;
  width: 100%;
  transform-style: preserve-3d;
  transition: 'all ease-out 0.6s';
}

.book {
  width: var(--book-w);
  height: var(--book-h);
  background: url(https://covers.openlibrary.org/b/id/8303020-L.jpg) no-repeat center center;
  background-size: cover;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  margin: auto;
  cursor: pointer;
}
.title {
  content: '';
  height: var(--book-h);
  width: var(--book-d);
  position: absolute;
  right: 0;
  left: calc(var(--book-wx) * -1);
  top: 0;
  bottom: 0;
  margin: auto;
  background: #444;
  transform: rotateY(-80deg) translateX(-14px);

  background: url(https://covers.openlibrary.org/b/id/8303020-L.jpg) no-repeat center center;
  background-size: 5000%;
  filter: blur(1px);
}

.bottom {
  content: '';
  height: var(--book-d);
  width: var(--book-w);
  position: absolute;
  right: 0;
  bottom: var(--book-h);
  top: 0;
  left: 0;
  margin: auto;
  background: #444;
  transform: rotateY(0deg) rotateX(90deg) translateY(-15px) translateX(-2.5px) skewX(10deg);

  background: url(https://covers.openlibrary.org/b/id/8303020-L.jpg) no-repeat center center;
  background-size: 5000%;
  filter: blur(1px);
}

.book-back {
  width: var(--book-w);
  height: var(--book-h);
  background-color: #444;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  margin: auto;
  cursor: pointer;
  transform: rotate(180deg) translateZ(-30px) translateX(5px);
}
.book-back .text {
  transform: rotateX(180deg);
  position: absolute;
  bottom: 0px;
  padding: 20px;
  text-align: left;
  font-size: 12px;
}
.book-back .text h3 {
  color: #fff;
}
.book-back .text span {
  display: block;
  margin-bottom: 20px;
  color: #fff;
}

.book-wrap.rotate {
  transform: rotateY(30deg) rotateX(0deg);
}
.book-wrap.flip {
  transform: rotateY(180deg);
} */
</style>
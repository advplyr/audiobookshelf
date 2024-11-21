<template>
  <div id="heatmap" class="w-full">
    <div class="mx-auto" :style="{ height: innerHeight + 160 + 'px', width: innerWidth + 52 + 'px' }" style="background-color: rgba(13, 17, 23, 0)">
      <p class="mb-2 px-1 text-sm text-gray-200">{{ $getString('MessageListeningSessionsInTheLastYear', [Object.values(daysListening).length]) }}</p>
      <div class="border border-white border-opacity-25 rounded py-2 w-full" style="background-color: #232323" :style="{ height: innerHeight + 80 + 'px' }">
        <div :style="{ width: innerWidth + 'px', height: innerHeight + 'px' }" class="ml-10 mt-5 absolute" @mouseover="mouseover" @mouseout="mouseout">
          <div v-for="dayLabel in dayLabels" :key="dayLabel.label" :style="dayLabel.style" class="absolute top-0 left-0 text-gray-300">{{ dayLabel.label }}</div>

          <div v-for="monthLabel in monthLabels" :key="monthLabel.id" :style="monthLabel.style" class="absolute top-0 left-0 text-gray-300">{{ monthLabel.label }}</div>

          <div v-for="(block, index) in data" :key="block.dateString" :style="block.style" :data-index="index" class="absolute top-0 left-0 h-2.5 w-2.5 rounded-sm" />

          <div class="flex py-2 px-4" :style="{ marginTop: innerHeight + 'px' }">
            <div class="flex-grow" />
            <p style="font-size: 10px; line-height: 10px" class="text-gray-400 px-1">{{ $strings.LabelLess }}</p>
            <div v-for="block in legendBlocks" :key="block.id" :style="block.style" class="h-2.5 w-2.5 rounded-sm" style="margin-left: 1.5px; margin-right: 1.5px" />
            <p style="font-size: 10px; line-height: 10px" class="text-gray-400 px-1">{{ $strings.LabelMore }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    daysListening: {
      type: Object,
      default: () => {}
    }
  },
  data() {
    return {
      contentWidth: 0,
      maxInnerWidth: 0,
      innerHeight: 13 * 7,
      blockWidth: 13,
      data: [],
      monthLabels: [],
      tooltipEl: null,
      tooltipTextEl: null,
      tooltipArrowEl: null,
      showingTooltipIndex: -1,
      outlineColors: ['rgba(27, 31, 35, 0.06)', 'rgba(255,255,255,0.03)'],
      bgColors: ['rgb(45,45,45)', 'rgb(14, 68, 41)', 'rgb(0, 109, 50)', 'rgb(38, 166, 65)', 'rgb(57, 211, 83)']
      // GH Colors
      // outlineColors: ['rgba(27, 31, 35, 0.06)', 'rgba(255,255,255,0.05)'],
      // bgColors: ['rgb(22, 27, 34)', 'rgb(14, 68, 41)', 'rgb(0, 109, 50)', 'rgb(38, 166, 65)', 'rgb(57, 211, 83)']
    }
  },
  computed: {
    weeksToShow() {
      return Math.min(52, Math.floor(this.maxInnerWidth / this.blockWidth) - 1)
    },
    innerWidth() {
      return (this.weeksToShow + 1) * 13
    },
    daysToShow() {
      return this.weeksToShow * 7 + this.dayOfWeekToday
    },
    dayOfWeekToday() {
      return new Date().getDay()
    },
    firstWeekStart() {
      return this.$addDaysToToday(-this.daysToShow)
    },
    dayLabels() {
      return [
        {
          label: this.$formatJsDate(new Date(2023, 0, 2), 'EEE'),
          style: {
            transform: `translate(${-25}px, ${13}px)`,
            lineHeight: '10px',
            fontSize: '10px'
          }
        },
        {
          label: this.$formatJsDate(new Date(2023, 0, 4), 'EEE'),
          style: {
            transform: `translate(${-25}px, ${13 * 3}px)`,
            lineHeight: '10px',
            fontSize: '10px'
          }
        },
        {
          label: this.$formatJsDate(new Date(2023, 0, 6), 'EEE'),
          style: {
            transform: `translate(${-25}px, ${13 * 5}px)`,
            lineHeight: '10px',
            fontSize: '10px'
          }
        }
      ]
    },
    legendBlocks() {
      return [
        {
          id: 'legend-0',
          style: `background-color:${this.bgColors[0]};outline:1px solid ${this.outlineColors[0]};outline-offset:-1px;`
        },
        {
          id: 'legend-1',
          style: `background-color:${this.bgColors[1]};outline:1px solid ${this.outlineColors[1]};outline-offset:-1px;`
        },
        {
          id: 'legend-2',
          style: `background-color:${this.bgColors[2]};outline:1px solid ${this.outlineColors[1]};outline-offset:-1px;`
        },
        {
          id: 'legend-3',
          style: `background-color:${this.bgColors[3]};outline:1px solid ${this.outlineColors[1]};outline-offset:-1px;`
        },
        {
          id: 'legend-4',
          style: `background-color:${this.bgColors[4]};outline:1px solid ${this.outlineColors[1]};outline-offset:-1px;`
        }
      ]
    }
  },
  methods: {
    destroyTooltip() {
      if (this.tooltipEl) this.tooltipEl.remove()
      this.tooltipEl = null
      this.showingTooltipIndex = -1
    },
    createTooltip() {
      const tooltip = document.createElement('div')
      tooltip.className = 'absolute top-0 left-0 rounded bg-gray-500 text-white p-2 text-white max-w-xs pointer-events-none'
      tooltip.style.display = 'none'
      tooltip.id = 'heatmap-tooltip'

      const tooltipText = document.createElement('p')
      tooltipText.innerText = 'Tooltip'
      tooltipText.style.fontSize = '10px'
      tooltipText.style.lineHeight = '10px'
      tooltip.appendChild(tooltipText)

      const tooltipArrow = document.createElement('div')
      tooltipArrow.className = 'text-gray-500 arrow-down-small absolute -bottom-1 left-0 right-0 mx-auto'
      tooltip.appendChild(tooltipArrow)

      this.tooltipEl = tooltip
      this.tooltipTextEl = tooltipText
      this.tooltipArrowEl = tooltipArrow

      document.body.appendChild(this.tooltipEl)
    },
    showTooltip(index, block, rect) {
      if (this.tooltipEl && this.showingTooltipIndex === index) return
      if (!this.tooltipEl) {
        this.createTooltip()
      }

      this.showingTooltipIndex = index
      this.tooltipEl.style.display = 'block'
      this.tooltipTextEl.innerHTML = block.value ? `<strong>${this.$elapsedPretty(block.value, true)} listening</strong> on ${block.datePretty}` : `No listening sessions on ${block.datePretty}`

      const calculateRect = this.tooltipEl.getBoundingClientRect()

      const w = calculateRect.width / 2
      var left = rect.x - w
      var offsetX = 0
      if (left < 0) {
        offsetX = Math.abs(left)
        left = 0
      } else if (rect.x + w > window.innerWidth - 10) {
        offsetX = window.innerWidth - 10 - (rect.x + w)
        left += offsetX
      }

      this.tooltipEl.style.transform = `translate(${left}px, ${rect.y - 32}px)`
      this.tooltipArrowEl.style.transform = `translate(${5 - offsetX}px, 0px)`
    },
    hideTooltip() {
      if (this.showingTooltipIndex >= 0 && this.tooltipEl) {
        this.tooltipEl.style.display = 'none'
        this.showingTooltipIndex = -1
      }
    },
    mouseover(e) {
      if (isNaN(e.target.dataset.index)) {
        this.hideTooltip()
        return
      }
      var block = this.data[e.target.dataset.index]
      var rect = e.target.getBoundingClientRect()
      this.showTooltip(e.target.dataset.index, block, rect)
    },
    mouseout(e) {
      this.hideTooltip()
    },
    buildData() {
      this.data = []

      var maxValue = 0
      var minValue = 0
      Object.values(this.daysListening).forEach((val) => {
        if (val > maxValue) maxValue = val
        if (!minValue || val < minValue) minValue = val
      })
      const range = maxValue - minValue + 0.01

      for (let i = 0; i < this.daysToShow + 1; i++) {
        const col = Math.floor(i / 7)
        const row = i % 7

        const date = i === 0 ? this.firstWeekStart : this.$addDaysToDate(this.firstWeekStart, i)
        const dateString = this.$formatJsDate(date, 'yyyy-MM-dd')
        const datePretty = this.$formatJsDate(date, 'MMM d, yyyy')
        const monthString = this.$formatJsDate(date, 'MMM')
        const value = this.daysListening[dateString] || 0
        const x = col * 13
        const y = row * 13

        var bgColor = this.bgColors[0]
        var outlineColor = this.outlineColors[0]
        if (value) {
          outlineColor = this.outlineColors[1]
          var percentOfAvg = (value - minValue) / range
          var bgIndex = Math.floor(percentOfAvg * 4) + 1
          bgColor = this.bgColors[bgIndex] || 'red'
        }

        this.data.push({
          date,
          dateString,
          datePretty,
          monthString,
          dayOfMonth: Number(dateString.split('-').pop()),
          yearString: dateString.split('-').shift(),
          value,
          col,
          row,
          style: `transform:translate(${x}px,${y}px);background-color:${bgColor};outline:1px solid ${outlineColor};outline-offset:-1px;`
        })
      }

      this.monthLabels = []
      var lastMonth = null
      for (let i = 0; i < this.data.length; i++) {
        if (this.data[i].monthString !== lastMonth) {
          const weekOfMonth = Math.floor(this.data[i].dayOfMonth / 7)
          if (weekOfMonth <= 2) {
            this.monthLabels.push({
              id: this.data[i].dateString + '-ml',
              label: this.data[i].monthString,
              style: {
                transform: `translate(${this.data[i].col * 13}px, -15px)`,
                lineHeight: '10px',
                fontSize: '10px'
              }
            })
            lastMonth = this.data[i].monthString
          }
        }
      }
    },
    init() {
      const heatmapEl = document.getElementById('heatmap')
      this.contentWidth = heatmapEl.clientWidth
      this.maxInnerWidth = this.contentWidth - 52
      this.buildData()
    }
  },
  updated() {},
  mounted() {
    this.init()
  },
  beforeDestroy() {}
}
</script>

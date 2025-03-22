<template>
  <div class="w-96 my-6 mx-auto">
    <h1 class="text-2xl mb-4">{{ $strings.HeaderStatsMinutesListeningChart }}</h1>
    <div class="relative w-96 h-72">
      <div class="absolute top-0 left-0">
        <template v-for="lbl in yAxisLabels">
          <div :key="lbl" :style="{ height: lineSpacing + 'px' }" class="flex items-center justify-end">
            <p class="text-xs font-semibold">{{ lbl }}</p>
          </div>
        </template>
      </div>

      <template v-for="n in 7">
        <div :key="n" class="absolute pointer-events-none left-0 h-px bg-white/10" :style="{ top: n * lineSpacing - lineSpacing / 2 + 'px', width: '360px', marginLeft: '24px' }" />

        <div :key="`dot-${n}`" class="absolute z-10" :style="{ left: points[n - 1].x + 'px', bottom: points[n - 1].y + 'px' }">
          <ui-tooltip :text="last7DaysOfListening[n - 1].minutesListening" direction="top">
            <div class="h-2 w-2 bg-yellow-400 hover:bg-yellow-300 rounded-full transform duration-150 transition-transform hover:scale-125" />
          </ui-tooltip>
        </div>
      </template>

      <template v-for="(line, index) in pointLines">
        <div :key="`line-${index}`" class="absolute h-0.5 bg-yellow-400 origin-bottom-left pointer-events-none" :style="{ width: line.width + 'px', left: line.x + 'px', bottom: line.y + 'px', transform: `rotate(${line.angle}deg)` }" />
      </template>

      <div class="absolute -bottom-2 left-0 flex ml-6">
        <template v-for="dayObj in last7Days">
          <div :key="dayObj.date" :style="{ width: daySpacing + daySpacing / 14 + 'px' }">
            <p class="text-sm">{{ dayObj.dayOfWeekAbbr }}</p>
          </div>
        </template>
      </div>
    </div>
    <div class="flex justify-between pt-12">
      <div>
        <p class="text-sm text-center">{{ $strings.LabelStatsWeekListening }}</p>
        <p class="text-5xl font-semibold text-center" style="line-height: 0.85">{{ $formatNumber(totalMinutesListeningThisWeek) }}</p>
        <p class="text-sm text-center">{{ $strings.LabelStatsMinutes }}</p>
      </div>
      <div>
        <p class="text-sm text-center">{{ $strings.LabelStatsDailyAverage }}</p>
        <p class="text-5xl font-semibold text-center" style="line-height: 0.85">{{ $formatNumber(averageMinutesPerDay) }}</p>
        <p class="text-sm text-center">{{ $strings.LabelStatsMinutes }}</p>
      </div>
      <div>
        <p class="text-sm text-center">{{ $strings.LabelStatsBestDay }}</p>
        <p class="text-5xl font-semibold text-center" style="line-height: 0.85">{{ $formatNumber(mostListenedDay) }}</p>
        <p class="text-sm text-center">{{ $strings.LabelStatsMinutes }}</p>
      </div>
      <div>
        <p class="text-sm text-center">{{ $strings.LabelStatsDays }}</p>
        <p class="text-5xl font-semibold text-center" style="line-height: 0.85">{{ $formatNumber(daysInARow) }}</p>
        <p class="text-sm text-center">{{ $strings.LabelStatsInARow }}</p>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    listeningStats: {
      type: Object,
      default: () => {}
    }
  },
  data() {
    return {
      // test: [111, 120, 4, 156, 273, 76, 12],
      chartHeight: 288,
      chartWidth: 384,
      chartContentWidth: 360,
      chartContentHeight: 268
    }
  },
  computed: {
    yAxisLabels() {
      var lbls = []
      for (let i = 6; i >= 0; i--) {
        lbls.push(i * this.yAxisFactor)
      }
      return lbls
    },
    chartContentMarginLeft() {
      return this.chartWidth - this.chartContentWidth
    },
    chartContentMarginBottom() {
      return this.chartHeight - this.chartContentHeight
    },
    lineSpacing() {
      return this.chartHeight / 7
    },
    daySpacing() {
      return this.chartContentWidth / 7
    },
    linePositions() {
      var poses = []
      for (let i = 7; i > 0; i--) {
        poses.push(i * this.lineSpacing)
      }
      poses.push(0)
      return poses
    },
    last7Days() {
      var days = []
      for (let i = 6; i >= 0; i--) {
        var _date = this.$addDaysToToday(i * -1)
        days.push({
          dayOfWeek: this.$formatJsDate(_date, 'EEEE'),
          dayOfWeekAbbr: this.$formatJsDate(_date, 'EEE'),
          date: this.$formatJsDate(_date, 'yyyy-MM-dd')
        })
      }
      return days
    },
    last7DaysOfListening() {
      var listeningDays = {}
      var _index = 0
      this.last7Days.forEach((dayObj) => {
        listeningDays[_index++] = {
          dayOfWeek: dayObj.dayOfWeek,
          // minutesListening: this.test[_index - 1]
          minutesListening: this.getMinutesListeningForDate(dayObj.date)
        }
      })
      return listeningDays
    },
    mostListenedDay() {
      var sorted = Object.values(this.last7DaysOfListening)
        .map((dl) => ({ ...dl }))
        .sort((a, b) => b.minutesListening - a.minutesListening)
      return sorted[0].minutesListening
    },
    yAxisFactor() {
      var factor = Math.ceil(this.mostListenedDay / 5)

      if (factor > 25) {
        // Use nearest multiple of 5
        return Math.ceil(factor / 5) * 5
      }

      return Math.max(1, factor)
    },
    points() {
      var data = []
      for (let i = 0; i < 7; i++) {
        var listeningObj = this.last7DaysOfListening[String(i)]
        var minutesListening = listeningObj.minutesListening || 0
        var yPercent = minutesListening / (this.yAxisFactor * 7)
        data.push({
          x: 4 + this.chartContentMarginLeft + (this.daySpacing + this.daySpacing / 14) * i,
          y: this.chartContentMarginBottom + this.chartHeight * yPercent - 2
        })
      }
      return data
    },
    pointLines() {
      var lines = []
      for (let i = 1; i < 7; i++) {
        var lastPoint = this.points[i - 1]
        var nextPoint = this.points[i]

        var x1 = lastPoint.x
        var x2 = nextPoint.x
        var y1 = lastPoint.y
        var y2 = nextPoint.y

        lines.push({
          x: x1 + 4,
          y: y1 + 2,
          angle: this.getAngleBetweenPoints(x1, y1, x2, y2),
          width: Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2)) - 2
        })
      }
      return lines
    },
    totalMinutesListeningThisWeek() {
      var _total = 0
      Object.values(this.last7DaysOfListening).forEach((listeningObj) => (_total += listeningObj.minutesListening))
      return _total
    },
    averageMinutesPerDay() {
      return Math.round(this.totalMinutesListeningThisWeek / 7)
    },
    daysInARow() {
      var count = 0
      while (true) {
        var _date = this.$addDaysToToday(count * -1)
        var datestr = this.$formatJsDate(_date, 'yyyy-MM-dd')

        if (!this.listeningStatsDays[datestr] || this.listeningStatsDays[datestr] === 0) {
          return count
        }
        count++

        if (count > 9999) {
          console.error('Overflow protection')
          return 0
        }
      }
    },
    listeningStatsDays() {
      return this.listeningStats ? this.listeningStats.days || [] : []
    }
  },
  methods: {
    getAngleBetweenPoints(cx, cy, ex, ey) {
      var dy = ey - cy
      var dx = ex - cx
      var theta = Math.atan2(dy, dx)
      theta *= 180 / Math.PI // convert to degrees
      return theta * -1
    },
    getMinutesListeningForDate(date) {
      if (!this.listeningStats || !this.listeningStats.days) return 0
      return Math.round((this.listeningStats.days[date] || 0) / 60)
    }
  },
  mounted() {}
}
</script>

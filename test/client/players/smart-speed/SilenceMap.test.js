const chai = require('chai')
const expect = chai.expect
const SilenceMap = require('../../../../client/players/smart-speed/SilenceMap')

describe('SilenceMap', () => {
  let map

  beforeEach(() => {
    map = new SilenceMap()
  })

  describe('Basic operations', () => {
    it('1. Empty map returns 0 regions', () => {
      expect(map.regionCount).to.equal(0)
      expect(map.getRegions()).to.deep.equal([])
    })

    it('2. Single region add/get', () => {
      map.addRegion(100, 300)
      expect(map.regionCount).to.equal(1)
      expect(map.getRegions()).to.deep.equal([{ start: 100, end: 300 }])
    })

    it('3. Overlapping regions merge correctly', () => {
      map.addRegion(100, 300)
      map.addRegion(200, 400)
      expect(map.regionCount).to.equal(1)
      expect(map.getRegions()).to.deep.equal([{ start: 100, end: 400 }])
    })

    it('4. Non-overlapping regions stay separate', () => {
      map.addRegion(100, 200)
      map.addRegion(300, 400)
      expect(map.regionCount).to.equal(2)
      expect(map.getRegions()).to.deep.equal([
        { start: 100, end: 200 },
        { start: 300, end: 400 }
      ])
    })

    it('5. Adjacent regions (gap < 10ms) merge', () => {
      map.addRegion(100, 200)
      map.addRegion(205, 300)
      expect(map.regionCount).to.equal(1)
      expect(map.getRegions()).to.deep.equal([{ start: 100, end: 300 }])
    })

    it('6. Three+ overlapping regions merge into one', () => {
      map.addRegion(100, 300)
      map.addRegion(200, 400)
      map.addRegion(350, 500)
      expect(map.regionCount).to.equal(1)
      expect(map.getRegions()).to.deep.equal([{ start: 100, end: 500 }])
    })
  })

  describe('getCompressedOffset', () => {
    it('7. getCompressedOffset(0) returns 0', () => {
      map.addRegion(100, 300)
      expect(map.getCompressedOffset(0, 2)).to.equal(0)
    })

    it('8. getCompressedOffset at region boundary', () => {
      map.addRegion(100, 300)
      // At time 100ms (start of region), no compression has happened yet
      expect(map.getCompressedOffset(100, 2)).to.equal(0)
    })

    it('9. getCompressedOffset inside region', () => {
      map.addRegion(100, 300)
      // At time 200ms (100ms into a 200ms region), with ratio 2x:
      // 100ms of silence consumed, compressed to 50ms, saving 50ms
      expect(map.getCompressedOffset(200, 2)).to.equal(50)
    })

    it('10. getCompressedOffset after region with ratio 2x', () => {
      map.addRegion(100, 300)
      // At time 500ms (after the 200ms region), with ratio 2x:
      // 200ms of silence, compressed to 100ms, saving 100ms
      expect(map.getCompressedOffset(500, 2)).to.equal(100)
    })

    it('11. getCompressedOffset with multiple regions', () => {
      map.addRegion(100, 200) // 100ms region
      map.addRegion(400, 600) // 200ms region
      // At time 700ms, with ratio 2x:
      // Region 1: 100ms silence → 50ms, saving 50ms
      // Region 2: 200ms silence → 100ms, saving 100ms
      // Total saved: 150ms
      expect(map.getCompressedOffset(700, 2)).to.equal(150)
    })
  })

  describe('Reset and state', () => {
    it('12. reset() clears everything', () => {
      map.addRegion(100, 300)
      map.addRegion(400, 600)
      map.reset()
      expect(map.regionCount).to.equal(0)
      expect(map.getRegions()).to.deep.equal([])
    })

    it('13. Regions always sorted by start time', () => {
      map.addRegion(500, 600)
      map.addRegion(100, 200)
      map.addRegion(300, 400)
      const regions = map.getRegions()
      expect(regions[0].start).to.equal(100)
      expect(regions[1].start).to.equal(300)
      expect(regions[2].start).to.equal(500)
    })
  })

  describe('Validation', () => {
    it('14. Invalid region (end <= start) is rejected', () => {
      map.addRegion(300, 100)
      expect(map.regionCount).to.equal(0)
    })

    it('15. Region at time 0', () => {
      map.addRegion(0, 100)
      expect(map.regionCount).to.equal(1)
      expect(map.getRegions()).to.deep.equal([{ start: 0, end: 100 }])
    })

    it('16. Very large time values (24 hours)', () => {
      map.addRegion(86400000, 86401000)
      expect(map.regionCount).to.equal(1)
      expect(map.getRegions()).to.deep.equal([{ start: 86400000, end: 86401000 }])
      expect(map.getCompressedOffset(86402000, 2)).to.equal(500)
    })
  })

  describe('Edge cases', () => {
    it('17. Rapid addRegion calls (1000 regions)', () => {
      for (let i = 0; i < 1000; i++) {
        map.addRegion(i * 100, i * 100 + 50)
      }
      expect(map.regionCount).to.equal(1000)
    })

    it('18. Region with identical start and end is rejected', () => {
      map.addRegion(100, 100)
      expect(map.regionCount).to.equal(0)
    })

    it('19. Region with negative values is rejected', () => {
      map.addRegion(-100, 100)
      expect(map.regionCount).to.equal(0)
    })

    it('20. Multiple resets do not error', () => {
      map.addRegion(100, 300)
      map.reset()
      map.reset()
      map.reset()
      expect(map.regionCount).to.equal(0)
    })

    it('21. getCompressedOffset with ratio 1.0 (no compression)', () => {
      map.addRegion(100, 300)
      // ratio 1.0 means no speedup, so no time saved
      expect(map.getCompressedOffset(500, 1.0)).to.equal(0)
    })

    it('22. getCompressedOffset with ratio 5.0 (aggressive)', () => {
      map.addRegion(100, 300)
      // 200ms region at 5x: compressed to 40ms, saving 160ms
      expect(map.getCompressedOffset(500, 5.0)).to.equal(160)
    })
  })
})

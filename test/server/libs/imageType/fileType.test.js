const chai = require('chai')
const expect = chai.expect
const imageType = require('../../../../server/libs/imageType')

describe('imageType', () => {
  for (const brand of ['avif', 'avis']) {
    it(`detects the ${brand} AVIF brand`, () => {
      const buffer = Buffer.from([0x00, 0x00, 0x00, 0x1c, ...Buffer.from('ftyp'), ...Buffer.from(brand)])

      expect(imageType(buffer)).to.deep.equal({
        ext: 'avif',
        mime: 'image/avif'
      })
    })
  }
})

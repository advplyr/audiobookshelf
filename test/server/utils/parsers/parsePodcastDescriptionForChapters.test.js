const chai = require('chai')
const expect = chai.expect
const parsePodcastDescriptionForChapters = require('../../../../server/utils/parsers/parsePodcastDescriptionForChapters')
const sinon = require('sinon')
const Logger = require('../../../../server/Logger')

describe('parsePodcastDescriptionForChapters', () => {
  it("should early out if description doens't contain timestamps", () => {
    let loggerDebugStub = sinon.stub(Logger, 'debug')
    let description = '<p>Introduction text paragraph 1</p><p>Introduction text paragraph 2</p>'
    let chapters = parsePodcastDescriptionForChapters.parse(description, 1000)

    expect(chapters).to.be.empty
    expect(loggerDebugStub.calledWith('No timestamps found in description, bailing out early')).to.be.true

    sinon.restore()
  })

  var testCasesTestingSuccess = [
    {
      testName: 'Should handle descriptions using html paragraphs',
      description: '<p>Introduction text paragraph 1</p><p>Introduction text paragraph 2</p><p>00:48 Chatper 1  </p><p>12:14 Chapter 2 </p><p>20:56 Chapter 3  </p><p>27:34 Chapter 4  </p><p>32:00 Chapter 5  </p><p>35:16 Chapter 6  </p><p>41:32 Chapter 7  </p><p>46:43 Chapter 8</p>',
      audioDuration: 3060,
      expectedChapters: [
        { title: 'Chatper 1', id: 1, start: 48, end: 734 },
        { title: 'Chapter 2', id: 2, start: 734, end: 1256 },
        { title: 'Chapter 3', id: 3, start: 1256, end: 1654 },
        { title: 'Chapter 4', id: 4, start: 1654, end: 1920 },
        { title: 'Chapter 5', id: 5, start: 1920, end: 2116 },
        { title: 'Chapter 6', id: 6, start: 2116, end: 2492 },
        { title: 'Chapter 7', id: 7, start: 2492, end: 2803 },
        { title: 'Chapter 8', id: 8, start: 2803, end: 3060 }
      ]
    },
    {
      // Example: https://podcasts.apple.com/us/podcast/giant-bombcast-931-bleepbloop-remote/id274450056?i=1000754550540
      testName: 'Should handle descriptions using html line breaks',
      description: '<br>Introduction text paragraph 1<br /><br>Introduction text paragraph 2<br /><br />0:00:00 Chapter 1<br />0:17:05 Chapter 2<br />0:33:58 Chapter 3<br />0:40:35 Chapter 4<br />Unrelated outro line<br />',
      audioDuration: 2700,
      expectedChapters: [
        { title: 'Chapter 1', id: 1, start: 0, end: 1025 },
        { title: 'Chapter 2', id: 2, start: 1025, end: 2038 },
        { title: 'Chapter 3', id: 3, start: 2038, end: 2435 },
        { title: 'Chapter 4', id: 4, start: 2435, end: 2700 }
      ]
    },
    {
      // Example: https://podcasts.apple.com/us/podcast/xboxs-big-helix-reveal-witcher-4-path-tracing-crimson/id1596728253?i=1000755411491
      testName: 'Should handle descriptions using unix new lines',
      description: `Introduction text paragraph 1
        Introduction text paragraph 2
        0:00:00 Chapter 1
        0:17:05 Chapter 2
        0:33:58 Chapter 3
        0:40:35 Chapter 4
        Unrelated outro line`,
      audioDuration: 2700,
      expectedChapters: [
        { title: 'Chapter 1', id: 1, start: 0, end: 1025 },
        { title: 'Chapter 2', id: 2, start: 1025, end: 2038 },
        { title: 'Chapter 3', id: 3, start: 2038, end: 2435 },
        { title: 'Chapter 4', id: 4, start: 2435, end: 2700 }
      ]
    },
    {
      testName: 'Should handle descriptions with no timestamps',
      description: 'Lorem ipsum dolor sit amet consectetur adipiscing elit quisque faucibus ex sapien vitae pellentesque sem placerat in id cursus mi pretium tellus duis convallis tempus leo eu aenean sed diam urna tempor pulvinar vivamus fringilla lacus nec metus bibendum egestas.',
      audioDuration: 2700,
      expectedChapters: []
    },
    {
      testName: 'Should handle timestampes in parentheses',
      description: '<p>Introduction text paragraph 1</p><p>Introduction text paragraph 2</p><p>(00:48) Chatper 1  </p><p>(12:14) Chapter 2 </p><p>(20:56) Chapter 3  </p><p>(27:34) Chapter 4  </p><p>(32:00) Chapter 5  </p><p>(35:16) Chapter 6  </p><p>(41:32) Chapter 7  </p><p>(46:43) Chapter 8</p>',
      audioDuration: 3060,
      expectedChapters: [
        { title: 'Chatper 1', id: 1, start: 48, end: 734 },
        { title: 'Chapter 2', id: 2, start: 734, end: 1256 },
        { title: 'Chapter 3', id: 3, start: 1256, end: 1654 },
        { title: 'Chapter 4', id: 4, start: 1654, end: 1920 },
        { title: 'Chapter 5', id: 5, start: 1920, end: 2116 },
        { title: 'Chapter 6', id: 6, start: 2116, end: 2492 },
        { title: 'Chapter 7', id: 7, start: 2492, end: 2803 },
        { title: 'Chapter 8', id: 8, start: 2803, end: 3060 }
      ]
    },
    {
      // Example here: https://podcasts.apple.com/gb/podcast/daniel-priestley-plumbers-will-earn-more-than-lawyers/id1291423644?i=1000755513967
      testName: 'Should handle html lists and chapters with html tags in the title',
      description: '<p>Introduction</p><p><br /></p><p><br /></p>Chapters<ul><li><strong>00:00:00</strong> Intro</li><li><strong>00:03:55</strong> Chapter 1</li><li><strong>00:09:52</strong> Chapter 2    </li><li><strong>00:16:11</strong> Chapter 3</li><li><strong>00:20:03</strong> Chapter 4</li><li><strong>00:24:08</strong> Chapter 5</li>',
      audioDuration: 4000,
      expectedChapters: [
        { title: 'Intro', id: 1, start: 0, end: 235 },
        { title: 'Chapter 1', id: 2, start: 235, end: 592 },
        { title: 'Chapter 2', id: 3, start: 592, end: 971 },
        { title: 'Chapter 3', id: 4, start: 971, end: 1203 },
        { title: 'Chapter 4', id: 5, start: 1203, end: 1448 },
        { title: 'Chapter 5', id: 6, start: 1448, end: 4000 }
      ]
    }
  ]
  testCasesTestingSuccess.forEach(function (testCase) {
    it(testCase.testName, () => {
      var chapters = parsePodcastDescriptionForChapters.parse(testCase.description, testCase.audioDuration)
      expect(chapters).to.be.deep.equal(testCase.expectedChapters)
    })
  })

  var testCasesTestingFailure = [
    {
      testName: 'Should throw if only one chapter found',
      description: '<p>Introduction text paragraph 1</p><p>Introduction text paragraph 2</p><p>00:48 Chatper 1  </p>',
      audioDuration: 1000,
      expectedError: 'Only one chapter found, treating as invalid description'
    },
    {
      testName: 'Should throw if invalid minutes',
      description: '<p>Introduction text paragraph 1</p><p>Introduction text paragraph 2</p><p>75:48 Chatper 1  </p>',
      audioDuration: 1000,
      expectedError: "Timestamp contains invalid minutes or seconds field '75::48'"
    },
    {
      testName: 'Should throw if invalid minutes',
      description: '<p>Introduction text paragraph 1</p><p>Introduction text paragraph 2</p><p>00:90 Chatper 1  </p>',
      audioDuration: 1000,
      expectedError: "Timestamp contains invalid minutes or seconds field '0::90'"
    },
    {
      testName: 'Should throw if chapter goes over lenght of audio file',
      description: '<p>Introduction text paragraph 1</p><p>Introduction text paragraph 2</p><p>00:48 Chatper 1  </p><p>01:00:01 Chatper 2  </p>',
      audioDuration: 3600,
      expectedError: 'Chapter found that starts after over audio duration'
    },
    {
      testName: 'Should throw if description is null',
      description: null,
      audioDuration: 1000,
      expectedError: 'Description must not be null'
    },
    {
      testName: 'Should throw if audio duration is null',
      description: '',
      audioDuration: null,
      expectedError: 'Audio duration must not be null'
    },
    {
      testName: 'Should throw if chapter has no title',
      description: '<p>Introduction text paragraph 1</p><p>Introduction text paragraph 2</p><p>00:48 Chatper 1  </p><p>00:30:00</p>',
      audioDuration: 3600,
      expectedError: 'Unable to get chapter title from description'
    },
    {
      // Example here: https://podcasts.apple.com/us/podcast/is-your-personal-finance-indecision-costing-you-plus/id1256091892?i=1000636624926
      testName: 'Should throw if chapter is too long',
      description: '<p>01:19 Chapter 1</p><p>10:00 Chapter 2: Lorem ipsum dolor sit amet consectetur adipiscing elit quisque faucibus ex sapien vitae pellentesque sem placerat in id cursus mi pretium tellus duis convallis tempus leo eu aenean sed diam urna tempor pulvinar vivamus fringilla></p>',
      audioDuration: 3600,
      expectedError: 'Chapter title too long, possible parsing falure'
    }
  ]
  testCasesTestingFailure.forEach(function (testCase) {
    it(testCase.testName, () => {
      expect(() => {
        parsePodcastDescriptionForChapters.parse(testCase.description, testCase.audioDuration)
      }).to.throw(testCase.expectedError)
    })
  })
})

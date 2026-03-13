const chai = require('chai')
const PodcastEpisode = require('./PodcastEpisode')
const Logger = require('../Logger')
const expect = chai.expect

describe('PodcastEpisode', () => {
  describe('autoGenerateChaptersFromTimestamps', () => {
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
        description: `Introduction text paragraph 1
        Introduction text paragraph 2`,
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
      }
    ]
    testCasesTestingSuccess.forEach(function (testCase) {
      it(testCase.testName, () => {
        var chapters = PodcastEpisode.autoGenerateChaptersFromTimestamps(testCase.description, testCase.audioDuration)
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
        description: '<p>Introduction text paragraph 1</p><p>Introduction text paragraph 2</p><p>00:48 Chatper 1  </p><p>00:60:12</p>',
        audioDuration: 1000,
        expectedError: 'Unable to get chapter title from description'
      }
    ]
    testCasesTestingFailure.forEach(function (testCase) {
      it(testCase.testName, () => {
        expect(() => {
          var chapters = PodcastEpisode.autoGenerateChaptersFromTimestamps(testCase.description, testCase.audioDuration)
          Logger.debug('Chapters', chapters)
        }).to.throw(testCase.expectedError)
      })
    })
  })
})

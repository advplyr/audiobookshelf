import ChaptersCueImportModal from '@/components/modals/ChaptersCueImportModal.vue'

const cueStrings = {
  HeaderImportCue: 'Import .cue',
  MessageCueSelectFile: 'Select a .cue file to preview chapters',
  LabelChaptersFound: 'Chapters found',
  LabelStart: 'Start',
  LabelTitle: 'Title',
  ButtonCancel: 'Cancel',
  ButtonApplyChapters: 'Apply Chapters',
  ToastCueParseFailed: 'Failed to parse .cue file',
  MessageCueNoChaptersFound: 'No chapters found in .cue file'
}

function buildMountOptions(onApply, props = {}, toastError = null) {
  const stubs = {
    'ui-btn': {
      template: '<button type="button" @click="$emit(\'click\', $event)"><slot /></button>'
    },
    'modals-modal': {
      props: ['value'],
      template: '<div v-if="value"><slot name="outer" /><slot /></div>'
    }
  }

  const mocks = {
    $store: {
      state: {
        streamLibraryItem: null
      },
      getters: {
        'user/getToken': 'token'
      },
      commit: () => {},
      dispatch: () => {}
    },
    $toast: {
      error: toastError || (() => {}),
      info: () => {},
      success: () => {},
      warning: () => {}
    },
    $strings: cueStrings,
    $getString: (value) => value
  }

  return {
    stubs,
    mocks,
    propsData: {
      value: true,
      ...props
    },
    listeners: {
      apply: onApply
    }
  }
}

describe('Chapters cue import', () => {
  it('imports chapters from a cue file', () => {
    const cueText = [
      'PERFORMER "Author"',
      'TITLE "Test Book"',
      'FILE "test.mp3" MP3',
      '  TRACK 01 AUDIO',
      '    TITLE "Intro"',
      '    INDEX 01 00:00:00',
      '  TRACK 02 AUDIO',
      '    TITLE "Chapter 1"',
      '    INDEX 01 00:10:00',
      '  TRACK 03 AUDIO',
      '    INDEX 01 00:20:00'
    ].join('\n')

    const onApply = cy.spy().as('onApply')
    const cueFile = new File([cueText], 'chapters.cue', { type: 'text/plain' })
    cy.mount(ChaptersCueImportModal, buildMountOptions(onApply)).then(({ wrapper }) => {
      wrapper.setProps({ cueFile })
    })

    cy.contains('Intro').should('be.visible')
    cy.contains('Chapter 1').should('be.visible')
    cy.contains('Track 3').should('be.visible')

    cy.contains(cueStrings.ButtonApplyChapters).click()

    cy.get('@onApply').should('have.been.calledOnce')
    cy.get('@onApply')
      .its('firstCall.args.0')
      .should((chapters) => {
        expect(chapters).to.have.length(3)
        expect(chapters[0]).to.include({ title: 'Intro' })
        expect(chapters[1]).to.include({ title: 'Chapter 1' })
        expect(chapters[2]).to.include({ title: 'Track 3' })
      })
  })

  it('shows an error for invalid cue content', () => {
    const onApply = cy.spy().as('onApply')
    const toastError = cy.spy().as('toastError')
    const cueFile = new File([''], 'invalid.cue', { type: 'text/plain' })

    cy.mount(ChaptersCueImportModal, buildMountOptions(onApply, {}, toastError)).then(({ wrapper }) => {
      wrapper.setProps({ cueFile })
    })

    cy.contains(cueStrings.MessageCueNoChaptersFound).should('be.visible')
    cy.contains(cueStrings.ButtonApplyChapters).should('be.disabled')
    cy.get('@onApply').should('not.have.been.called')
    cy.get('@toastError').should('have.been.calledOnceWith', cueStrings.ToastCueParseFailed)
  })

  it('shows an error for malformed cue content', () => {
    const cueText = [
      'FILE "test.mp3" MP3',
      '  TRACK 01 AUDIO',
      '    TITLE "Intro"',
      '    INDEX 01 00:00:AA'
    ].join('\n')

    const onApply = cy.spy().as('onApply')
    const toastError = cy.spy().as('toastError')
    const cueFile = new File([cueText], 'malformed.cue', { type: 'text/plain' })

    cy.mount(ChaptersCueImportModal, buildMountOptions(onApply, {}, toastError)).then(({ wrapper }) => {
      wrapper.setProps({ cueFile })
    })

    cy.contains(cueStrings.MessageCueNoChaptersFound).should('be.visible')
    cy.contains(cueStrings.ButtonApplyChapters).should('be.disabled')
    cy.get('@onApply').should('not.have.been.called')
    cy.get('@toastError').should('have.been.calledOnceWith', cueStrings.ToastCueParseFailed)
  })

  it('shows an error for non-cue file content', () => {
    const cueText = [
      '{ "not": "a cue file" }',
      'lorem ipsum',
      'just some text'
    ].join('\n')

    const onApply = cy.spy().as('onApply')
    const toastError = cy.spy().as('toastError')
    const cueFile = new File([cueText], 'random.txt', { type: 'text/plain' })

    cy.mount(ChaptersCueImportModal, buildMountOptions(onApply, {}, toastError)).then(({ wrapper }) => {
      wrapper.setProps({ cueFile })
    })

    cy.contains(cueStrings.MessageCueNoChaptersFound).should('be.visible')
    cy.contains(cueStrings.ButtonApplyChapters).should('be.disabled')
    cy.get('@onApply').should('not.have.been.called')
    cy.get('@toastError').should('have.been.calledOnceWith', cueStrings.ToastCueParseFailed)
  })

})

const { expect } = require('chai')
const sinon = require('sinon')
const EmailManager = require('../../../server/managers/EmailManager')
const Database = require('../../../server/Database')
const nodemailer = require('nodemailer')

describe('EmailManager compatibility', () => {
  let settings, transporter, res
  beforeEach(() => {
    settings = Database.emailSettings
    Database.emailSettings = { fromAddress: 'from', testAddress: null, getTransportObject: () => ({ host: 'unused' }) }
    transporter = { verify: sinon.stub().resolves(true), sendMail: sinon.stub().resolves({}) }
    sinon.stub(nodemailer, 'createTransport').returns(transporter)
    res = { status: sinon.stub().returnsThis(), send: sinon.spy(), sendStatus: sinon.spy() }
  })
  afterEach(() => { sinon.restore(); Database.emailSettings = settings })
  it('keeps constructor export and stops on failed SMTP verification', async () => {
    transporter.verify.rejects(new Error('failed'))
    await new EmailManager().sendTest(res)
    expect(transporter.sendMail.called).to.equal(false)
    expect(res.status.calledWithExactly(400)).to.equal(true)
    expect(res.send.calledWithExactly('Failed to verify SMTP connection configuration')).to.equal(true)
  })
  it('uses sender as fallback recipient and sends success after transport completion', async () => {
    await new EmailManager().sendTest(res)
    await Promise.resolve()
    expect(transporter.sendMail.firstCall.args[0]).to.deep.equal({ from: 'from', to: 'from', subject: 'Test email from Audiobookshelf', text: 'Success!' })
    expect(res.sendStatus.calledWithExactly(200)).to.equal(true)
  })
  it('retains ebook attachment path and reports send errors', async () => {
    transporter.sendMail.rejects(new Error('send failed'))
    await new EmailManager().sendEBookToDevice({ metadata: { filename: 'book.epub', path: '/temporary/book.epub' } }, { name: 'reader', email: 'to' }, res)
    await Promise.resolve()
    expect(transporter.sendMail.firstCall.args[0].attachments).to.deep.equal([{ filename: 'book.epub', path: '/temporary/book.epub' }])
    expect(res.send.calledWithExactly('send failed')).to.equal(true)
  })
})

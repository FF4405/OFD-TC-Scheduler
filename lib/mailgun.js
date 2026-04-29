const Mailgun = require('mailgun.js');
const FormData = require('form-data');

let _client = null;

function getMailgunClient() {
  if (!_client) {
    const apiKey = process.env.MAILGUN_API_KEY;
    if (!apiKey) throw new Error('MAILGUN_API_KEY environment variable is not set');
    _client = new Mailgun(FormData).client({ username: 'api', key: apiKey });
  }
  return _client;
}

const MAILGUN_DOMAIN = () => {
  const d = process.env.MAILGUN_DOMAIN;
  if (!d) throw new Error('MAILGUN_DOMAIN environment variable is not set');
  return d;
};

const MAILGUN_FROM = () =>
  process.env.MAILGUN_FROM || 'OFD Checks <checks@oradellfire.org>';

const isMailgunConfigured = () =>
  !!(process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN);

module.exports = { getMailgunClient, MAILGUN_DOMAIN, MAILGUN_FROM, isMailgunConfigured };

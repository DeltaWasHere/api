const { authenticate } = require('@xboxreplay/xboxlive-auth');

let xboxHeaders = {
    'x-xbl-contract-version': 2
  };
async function initXboxToken() {
    await authenticate(process.env.MAIL, process.env.PASSWORD).then((value) => { xboxHeaders['Authorization'] = 'XBL3.0 x=' + value.user_hash + '; ' + value.xsts_token + ';' }).catch(console.error);

}

initXboxToken();

module.exports = xboxHeaders;
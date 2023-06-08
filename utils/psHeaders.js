let psHeaders = {
}
async function initializePSNToken() {
    let authorization, myNpsso, accesCode;
  
    myNpsso = process.env.PSTOKEN; // Assuming PSTOKEN is an environment variable containing the PSN token
    accesCode = await exchangeNpssoForCode(myNpsso);
    authorization = await exchangeCodeForAccessToken(accesCode);
    psHeaders['Authorization'] = 'Bearer ' + authorization.accessToken;
    console.log("PSN token ready");
  }
  
  initializePSNToken();
module.exports = psHeaders;
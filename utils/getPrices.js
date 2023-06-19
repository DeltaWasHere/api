const connection = require('../utils/connection');
const puppeteer = require('puppeteer')
async function getPrices(platform, gameId, title) {
    if (title == undefined) {
      title = await getStoredGameTitle(gameId);
    }
    let itemData = [];
    //#region scrap page
  
    const pagesMap = new Map();
    pagesMap.set("steam", "https://store.steampowered.com/search/?term=" + title);
    pagesMap.set("xbox", "https://www.xbox.com/en-us/games/all-games?cat=all");
    pagesMap.set("ps", "https://store.playstation.com/es-mx/search/" + title + " ps4");
    pagesMap.set("g2a", "https://www.g2a.com/es/category/gaming-c1?f[drm][0]=1&query=" + (title.replace(/ *\([^)]*\) */g, "")));
    pagesMap.set("cdKeys", "https://www.cdkeys.com/es_es/catalogsearch/result/?q=" + title + "&platforms=Steam&region=Mundialmente");
  
    const itemPath = new Map();
    itemPath.set("steam", "#search_resultsRows a");
    itemPath.set("ps", ".psw-grid-list.psw-l-grid li div a");
    itemPath.set("g2a", ".indexes__StyledListMobile-wklrsw-101.kSqeJg.cuaXWm li");
    itemPath.set("cdKeys", ".ais-InfiniteHits-list li");
  
    let browser = await (await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'], ignoreDefaultArgs: ['--disable-extensions'] })).createIncognitoBrowserContext();
    let page = await browser.newPage();
    console.log("searching: price for: " + title);
  
    await page.goto(pagesMap.get(platform), { "waitUntil": "load" });
  
    if (platform == "xbox") {
      //wait for the first games to appear
      try {

    
        //wait for the input and write on it
        await page.waitForSelector('.c-search.xghsearch input');
        await page.type('.c-search.xghsearch input', title);
  
        //wait for the search button
        await page.waitForSelector('.c-search.xghsearch button');
  
        //wait 5 secs after clicking
        await page.click('.c-search.xghsearch button');       
        await page.waitForSelector('.gameDivsWrapper.gdSorting');
        await page.waitForSelector('.gameDivsWrapper');

       
        console.log(await page.$eval('.gameDivsWrapper div', element => element))
        
        itemData[0] = await page.evaluate(() => {
          let firstItem = document.querySelector('.m-product-placement-item.f-size-medium.context-game.gameDiv');
          let anchorLink = firstItem.querySelector(".gameDivLink");
          return {
            price: firstItem.getAttribute("data-listprice"),
            link: anchorLink.getAttribute("href")
          }
        });
      } catch (error) {
        console.log("Error while getting the price for  platform: " + platform)
        console.log(error);
        itemData.push({
          price: "Unknown",
          link: pagesMap.get(platform)
        })
      }
    } else {
      if (platform == "ps") {
        try {
          await page.waitForSelector(itemPath.get(platform));
  
          itemData[0] = await page.evaluate((itemPath) => {
  
            let psList = document.querySelectorAll(itemPath);
            for (let i = 0; i < psList.length; i++) {
              if (psList[i].querySelector('div section > span.psw-product-tile__product-type.psw-t-bold.psw-t-size-1.psw-t-truncate-1.psw-c-t-2.psw-t-uppercase.psw-m-b-1') == null) {
                return {
                  link: 'https://store.playstation.com' + psList[i].getAttribute('href'),
                  price: (psList[i].querySelector('.psw-m-r-3').textContent.substring(3)=="disponible"?"unknown": psList[i].querySelector('.psw-m-r-3').textContent.substring(3))
                }
              }
            }
            return "NI";
          }, itemPath.get(platform));
        } catch (error) {
          console.log("Error while getting the price for platform: " + platform);
          console.log(error);
          itemData.push({
            price: "unknown",
            link: pagesMap.get(platform)
          })
        }
  
      } else {
        console.log("Searching price for steam");
        try {
          await page.waitForSelector(itemPath.get(platform));
          itemData[0] = await page.evaluate((itemPath) => {
            let element = document.querySelector(itemPath);
            return {
              link: element.getAttribute('href'),
              price: ((element.getElementsByClassName('col search_price responsive_secondrow')[0]).textContent).replace(/[^0-9.,]/g, "")
            }
          }, itemPath.get(platform));
        } catch (error) {
          console.log("Error getting the price in: " + error);
          itemData[0] = {
            price: "unknown",
            "link": pagesMap.get(platform)
          }
        }
        //go to g2a
        try {
          console.log("Searching price for g2a" + pagesMap.get("g2a"));
          await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/73.0.3683.75 Safari/537.36');
          await page.goto(pagesMap.get("g2a"), { "waitUntil": "load" });
          await page.waitForSelector(itemPath.get("g2a"));
  
          itemData[1] = await page.evaluate((itemPath) => {
  
            let element = document.querySelector(itemPath);
            return {
              link: "https://www.g2a.com" + element.querySelector('.sc-iqAclL.sc-dIsUp.dJFpVb.eHDAgC.sc-kHWWYL.kfrcst a').getAttribute("href"),
              price: (element.querySelector('.sc-iqAclL.sc-crzoAE.dJFpVb.eqnGHx.sc-bqGGPW.fIHClq').textContent).replace(/[^0-9.,]/g, "")
            }
          }, itemPath.get("g2a"));
        } catch (error) {
          console.log("Error geting g2 price");
          console.log(error);
          itemData[1] = {
            price: "unknown",
            link: pagesMap.get("g2a")
          }
        }
  
        //go to cdKeys
        try {
          console.log("Searching price for cdkeys");
          await page.goto(pagesMap.get("cdKeys", { "waitUntil": "load" }));
  
          await page.waitForSelector(itemPath.get("cdKeys"));
  
          itemData[2] = await page.evaluate((itemPath) => {
            let element = document.querySelector(itemPath);
            let price = (element.querySelector('.price-wrapper div span').textContent).replace(/[^0-9.,]/g, "");
            return {
              link: element.querySelector('.result-thumbnail a').getAttribute("href"),
              price: price
            }
          }, itemPath.get("cdKeys"));
        } catch (error) {
          console.log("Error getting cdKeys")
          itemData[2] = {
            price: "unknown",
            link: pagesMap.get("cdKeys")
          }
        }
      }
    }
    await browser.close();
    return itemData;
  }
  function getStoredGameTitle(gameId) {
    console.log(gameId);
    return new Promise((resolve, reject) => {
      connection.query("SELECT name from games where gameId = '" + gameId + "'", (err, result) => {
        if (err) throw err;
        console.log(result);
        resolve(result[0].name);
  
      });
    });
  }
  function delay(time) {
    return new Promise(function (resolve) {
      setTimeout(resolve, time)
    });
  }
  module.exports = {
    getPrices
  }


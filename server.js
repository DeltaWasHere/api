var express = require('express');
var fs = require('fs');
var app = express();
var request = require('request');
var mysql = require('mysql');
var bodyParser = require('body-parser');
var SteamAuth = require("node-steam-openid");
var cors = require('cors');
var puppeteer = require('puppeteer');
const multer = require('multer');
const { authenticate } = require('@xboxreplay/xboxlive-auth');
const { exchangeCodeForAccessToken, exchangeNpssoForCode, makeUniversalSearch } = require('psn-api');
//#region headers and BDConnection setup
var xboxHeaders = {
  'x-xbl-contract-version': 2
};
var psHeaders = {
}
var xblHeaders = {
  'X-Contract': '2',
  'X-Authorization': 'kos4gk0cwgowc84o8c88cg8sgs8c8gsk0oc'
}
var authorization, myNpsso, accesCode;
var connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'completionist_guild'
});
const upload = multer({ dest: "uploads/" });
//#endregion

app.use(cors());

app.use(function (err, req, res, next) {
  console.error(err.stack);
  res.type('plain/text');
  res.status(500);
  res.send('500 - Server Error');
});
connection.connect(error => {
  if (error) throw error;
  console.log('Conected!');
})
app.set('port', 3000);

//function to get the apikeys that needs to be shceduled every 50 minutes aprox
async function main() {
  myNpsso = "F9jWkt2ChEN0BCxxuK38VOT7tgbcSrwefvi5euap8wiQoN1uOCDiWv0seXqms0D4";//mypsnpassword
  accesCode = await exchangeNpssoForCode(myNpsso);
  authorization = await exchangeCodeForAccessToken(accesCode);
  psHeaders['Authorization'] = 'Bearer ' + authorization.accessToken;
  console.log("psn token ready");

  /*
    request({
      headers: {
        'Authorization': 'Bearer ' + authorization.accessToken
      }, uri: 'https://m.np.playstation.net/api/trophy/v1/users/6816621795220976068/titles/trophyTitles?npTitleIds=CUSA15010_00%2CPPSA01628_00%2CCUSA24892_00%2CCUSA20047_00'
    }, function (err, res, body) {
      var repsosneparsed = JSON.parse(body);
      console.log(repsosneparsed);
      for (var i = 0; i < repsosneparsed.titles.length; i++) {
        console.log(repsosneparsed.titles[i].trophyTitles);
      }
      console.log(res.statusCode);
      console.log(res.headers);
      //fs.writeFileSync("all titles LOL.json",JSON.stringify(JSON.parse(body)));
    });
  */
  await authenticate("jegmontalvo@gmail.com", "tacoguapo12").then((value) => { xboxHeaders['Authorization'] = 'XBL3.0 x=' + value.user_hash + '; ' + value.xsts_token + ';' }).catch(console.error);
  //console.log(xboxHeaders.Authorization);
}

const steam = new SteamAuth({
  realm: "http://localhost:3000", // Site name displayed to users on logon
  returnUrl: "http://localhost:3000/auth/steam/authenticate", // Your return route
  apiKey: "B180F37955BEBCD1CFA8DF8E32ECC03E" // Steam API key
});

app.get("/steam/auth", async (req, res) => {
  const redirectUrl = await steam.getRedirectUrl();
  return res.redirect(redirectUrl);
});

app.get("/auth/steam/authenticate", async (req, res) => {
  try {
    //retreieve user auth data
    const user = await steam.authenticate(req);
    console.log(user.username)
    userauthinfo = {
      userId: user.steamid,
      name: user.username,
      avatar: user.avatar.large
    };

    //Record user function
    await addUser(userauthinfo)
    res.send(JSON.stringify(userauthinfo));

    uploadUserStats(user.steamid, "steam");

  } catch (error) {
    console.error(error);
  }
});

app.get("/xbox/auth/grant", async (req, res) => {
  var code = req.query.code;
  console.log(code);
  request.post({
    headers: {
      'X-Contract': '2'
    },
    url: 'https://xbl.io/app/claim',
    body: {
      code: code,
      app_key: '8cd2a5fd-60b6-493a-944b-678eb528d32f'
    },
    json: true
  }, function (error, response, body) {
    if (error) throw error;
    var userId = body.xuid;
    var avatar = body.avatar;
    for (var i = 0; i < avatar.length; i++) {
      if (avatar[i] == "&") {
        avatar = avatar.substring(0, i);
        break;
      }
    }
    avatar = avatar + "&format=png"
    var name = body.gamertag;
    res.send(json.stringify({
      userId: userId,
      name: name,
      avatar: avatar
    }));
    uploadUserStats(userId, "xbox");
  });

});
/*
app.use(function(req,res){
  res.type('text/plain');
  res.status(404);
  res.send('404 - Not Found');
});
*/
//this one here should be to watch the achiveements of the ganmme
app.get('/tests/shit', async function (req, res) {
  uploadUserStats(res, "76561198213357323", "steam", 0, 0);
});


//when you search a game the only think u want is the title, comp, rate, img and genre thus this shit should be stores in the database
app.get('/search/game', function (req, res) {

  var platform = req.get('platform');
  var sql;
  if (!req.query.game) {
    //todos los titulos de la plataforma
    sql = "select * from games where platform = ?";
    connection.query(sql, platform, (error, result) => {
      //parse each genre
      for (var i = 0; i < result.length; i++) {
        result[i].genres = JSON.parse(result[i].genres);
        delete result[i].platform;
      }
      res.send(result);
    });
  } else {
    var info = req.query.game;

    //search games stores currently ya tienews esto solo copealo y pegalo
    //(busca el jeugo q pide)
    sql = "select * from games where name like '%" + info + "%' AND platform = '" + platform + "'";
    connection.query(sql, (error, result) => {
      if (error) throw error;
      if (result && result.length > 0) {

        for (var i = 0; i < result.length; i++) {
          result[i].genres = JSON.parse(result[i].genres);
          delete result[i].platform;
        }

        res.send(result);

      } else {
        sql = "select * from games where gameid = '" + info + "' AND platform = '" + platform + "'";
        connection.query(sql, (error, result1) => {
          if (error) throw error;
          if (result1 && result1.length > 0) {
            result1[0].genres = JSON.parse(result1[0].genres);
            delete result1[0].platform;
            res.send(result1);
          } else {
            console.log("no se pudo encontrar el juego");//intentar añadir
            addNonRecordeddGame(res, info, platform);
          }
        });
      }
    });
  }


});

app.get('/view/game/:gameid', function (req, res) {

  if (req.params.gameid) {
    var gameid = req.params.gameid;
    var userid = req.get('userid');
    var platform = req.get('platform');
    var language = req.get('language');
    getGameAchievements(res, gameid, platform, language, userid);
  } else {
    res.send("error");
  }

});

app.post('/guide/:transaction', bodyParser.json(), function (req, res) {
  var transaction = req.params.transaction;
  var gameId = req.get('gameId');
  var achievementId = req.get('achievementId');
  var userId = req.get('userId');
  var content = req.body.content;
  console.log(content);
  var guideId;
  if (req.get('guideId')) {
    guideId = req.get('guideId');
  } else {
    guideId = null;
  }
  guides(res, gameId, userId, achievementId, transaction, content, guideId);
});

app.get('/vote/:vote', function (req, res) {
  var userId = req.get('userId');
  var guideId = req.get('guideId');
  var vote = (req.params.vote == "true") ? true : false;
  console.log();
  var aux = [userId, guideId, +vote];
  var sql = 'insert into votes (userId, guideId, vote) VALUES (?) on duplicate Key update vote = VALUES(vote)';
  connection.query(sql, [aux], (error, result) => {
    if (error) {
      console.log(error);
      res.send({ status: false });
    } else {
      res.send({ status: true });
    }
  });
});

app.post('/thread/:transaction', bodyParser.json(), function (req, res) {
  var transaction = req.params.transaction;
  var userId = req.get('userId');
  var threadId = req.get('threadId');
  var issue = req.body.issue;
  var content = req.body.content;
  var file;
  if (req.body.file) {
    file = req.body.file;
  } else {
    file = null
  }

  threads(res, userId, threadId, transaction, issue, content, file);
});

app.get('/tag/:tag', function (req, res) {
  const gameId = req.get('gameId');
  const userId = req.get('userId');
  const achievementId = req.get('achievementId');
  const type = req.get('type');
  var col, table;
  if (type == "dlc") {
    col = "link";
    table = "dlcTags";
  } else {
    col = "tag";
    table = "tag";
  }
  const tag = req.params.tag;

  var sql = "insert into " + tablename + " (gameId, userId, achievementId, " + col + ") values (?) on duplicate key update tag = VALUES(" + col + ")"
  const array = [gameId, userId, achievementId, tag];
  connection.query(sql, [array], (error, result) => {
    if (error) {
      res.send({ status: false });
    } else {
      res.send({ status: true });
    }
  });
})

app.post('/road/:transaction', bodyParser.json(), function (req, res) {
  const transaction = req.params.transaction;
  const gameId = req.get('gameId');
  const userId = req.get('userId');
  const roadId = req.get('roadId');
  const rate = parseInt(req.get('rate'));
  var spoilers = req.get('spoilers');
  spoilers = (spoilers == "true") ? true : false;
  const steps = req.body.steps;
  road(res, transaction, gameId, userId, roadId, steps, spoilers, rate);

});

app.listen(app.get('port'), function () {
  console.log('Express started on http://localhost:' + app.get('port') + '; press Ctrl-C to terminate.');
  main();
});



async function getGameAchievements(response, gameid, platform, language, userid) {
  //1-get game achievements 
  var achievements = [];
  achievements = await getAchievementsForGameId(gameid, platform, language);
  var owned = await checkIfOwned(userid, gameid);
  if (owned) {
    //check if owned the game if not send the prices
    var unlockedAchievements = await getUnlockedAchievementsRecorded(userid, gameid);
    for (var i = 0; i < achievements.length; i++) {
      // console.log(achievements[i]);
      achievements[i]['achieved'] = 0;
      for (var j = 0; j < unlockedAchievements.length; j++) {
        if (achievements[i].id == unlockedAchievements[j].achievementId) {
          achievements[i]['achieved'] = 1;
          break;
        }
      }
    }
  } else {
    var title = await getGameTitle(gameid, platform);
    //console.log(title);

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
    itemPath.set("g2a", ".indexes__StyledList1-wklrsw-184.indexes__StyledListDesktopList-wklrsw-186.hPfEeW.hgwvsl li");
    itemPath.set("cdKeys", ".ais-InfiniteHits-list li");

    var browser = await (await puppeteer.launch({ headless: true })).createIncognitoBrowserContext();
    var page = await browser.newPage();
    console.log("searching: price for: " + title);
    await page.goto(pagesMap.get(platform), { "waitUntil": "load" });
    var itemData = [];
    if (platform == "xbox") {
      //wait for the first games to appear

      await page.waitForSelector('.m-product-placement-item.f-size-medium.context-game.gameDiv');

      //wait for the input and write on it
      await page.waitForSelector('.c-search.xghsearch input');
      await page.type('.c-search.xghsearch input', title);

      //wait for the search button
      await page.waitForSelector('.c-search.xghsearch button');

      //wait 5 secs after clicking
      await page.click('.c-search.xghsearch button');
      await delay(5000);
      await page.screenshot({ path: 'webos.jpg' });
      //await page.waitForSelector('.m-product-placement-item.f-size-medium.context-game.gameDiv', { visible: true });

      itemData = await page.evaluate(() => {
        var firstItem = document.querySelector('.m-product-placement-item.f-size-medium.context-game.gameDiv');
        var anchorLink = firstItem.querySelector(".gameDivLink");
        return {
          price: firstItem.getAttribute("data-listprice"),
          link: anchorLink.getAttribute("href")
        }
      });
    } else {
      if (platform == "ps") {
        await page.waitForSelector(itemPath.get(platform));

        itemData = await page.evaluate((itemPath) => {

          var psList = document.querySelectorAll(itemPath);
          for (var i = 0; i < psList.length; i++) {
            if (psList[i].querySelector('div section > span.psw-product-tile__product-type.psw-t-bold.psw-t-size-1.psw-t-truncate-1.psw-c-t-2.psw-t-uppercase.psw-m-b-1') == null) {
              return {
                link: 'https://store.playstation.com/' + psList[i].getAttribute('href'),
                price: psList[i].querySelector('.psw-m-r-3').textContent.substring(3)
              }
            }
          }
          return "NI";
        }, itemPath.get(platform));

      } else {

        await page.waitForSelector(itemPath.get(platform));

        itemData[0] = await page.evaluate((itemPath) => {
          var element = document.querySelector(itemPath);
          return {
            link: element.getAttribute('href'),
            price: ((parseFloat(element.querySelector('.col.search_price_discount_combined.responsive_secondrow').getAttribute("data-price-final")) / 100) / 21).toFixed(2)
          }
        }, itemPath.get(platform));

        //go to g2a
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/73.0.3683.75 Safari/537.36');
        await page.goto(pagesMap.get("g2a"), { "waitUntil": "load" });
        await page.screenshot({ path: 'webos.jpg' });
        //console.log(pagesMap.get("g2a"));
        await page.waitForSelector(itemPath.get("g2a"));

        itemData[1] = await page.evaluate((itemPath) => {
          var element = document.querySelector(itemPath);
          return {
            link: "https://www.g2a.com" + element.getAttribute("href"),
            price: element.querySelector('.indexes__StyledBaseTypography1-wklrsw-89.indexes__StyledTypographyHeader1-wklrsw-90.bLMgYD.hurdWr.indexes__StyledTypography11-wklrsw-92.iWHXli').textContent.substring(2)
          }
        }, itemPath.get("g2a"));
        //go to cdKeys
        await page.goto(pagesMap.get("cdKeys", { "waitUntil": "load" }));

        await page.waitForSelector(itemPath.get("cdKeys"));

        itemData[2] = await page.evaluate((itemPath) => {
          var element = document.querySelector(itemPath);
          var price = element.querySelector('.price-wrapper div span').textContent;
          return {
            link: element.querySelector('.result-thumbnail a').getAttribute("href"),
            price: (parseFloat(price.substring(0, price.length - 4)) / 21).toFixed(2)
          }
        }, itemPath.get("cdKeys"));
      }
    }

    await page.close();

    //#endregion scrap page
  }


  response.send({
    product: itemData,
    achievements: achievements
  });



  //2-get game prices in the corresponding platform ( check if the user is authenticated and in that case check if he already owns it)
  //3- if the user is authenticated and owns the game check if he has achievements unlocked and mark the acheivements sended as unlocked in the respective ahcievements
}

function delay(time) {
  return new Promise(function (resolve) {
    setTimeout(resolve, time)
  });
}


function checkIfOwned(userId, gameId) {
  return new Promise((resolve, reject) => {

    var sql = "select * from usersgame where gameId='" + gameId + "' and userId ='" + userId + "'";
    connection.query(sql, (error, result) => {
      if (result.length > 0) {
        resolve(true);
      } else {
        resolve(false);
      }
    });
  });
}

function getUnlockedAchievementsRecorded(userId, gameId) {
  return new Promise((resolve, reject) => {
    var sql = 'select achievementId from achievements where gameId="' + gameId + '" and userId ="' + userId + '"';
    // console.log(sql);
    connection.query(sql, function (err, result) {
      if (err) throw err;
      if (result && result.length > 0) {
        resolve(result);
      } else {
        console.log(result)
        resolve("none");
      }

    });


  });
}

function getAchievementsForGameId(gameId, platform, language) {
  return new Promise((resolve, reject) => {
    var urlSteam = 'https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/?key=B180F37955BEBCD1CFA8DF8E32ECC03E&appid=' + gameId + "&l=" + language;
    var urlXbox = 'https://xbl.io/api/v2/achievements/title/' + gameId;
    var urlPs = "https://m.np.playstation.net/api/trophy/v1/npCommunicationIds/" + gameId + "/trophyGroups/all/trophies?npServiceName=trophy";
    var url, icon, id, description;
    var headers;
    switch (platform) {
      case "steam":
        url = urlSteam;
        headers = {};
        break;
      case "ps":
        url = urlPs;
        headers = psHeaders
        break;
      case "xbox":
        url = urlXbox;
        headers = xblHeaders;
        break;
    }
    if (platform != "steam") {
      console.log(headers['Accept-language'] = language.substring(0, 2) + "-" + language.substring(0, 2));

    } else {
      if (language == "deutsch") {
        language = "german";
        url = 'https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/?key=B180F37955BEBCD1CFA8DF8E32ECC03E&appid=' + gameId + "&l=" + language;
      }
      if (language == "español") {
        language = "spanish";
        url = 'https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/?key=B180F37955BEBCD1CFA8DF8E32ECC03E&appid=' + gameId + "&l=" + language;
      }
    }
    //console.log(url);
    request({ headers: headers, uri: url }, function (err, res, body) {
      if (err) throw err;
      parsedResponse = JSON.parse(body);
      var achievements, pathIcon, pathDescription, pathId, pathName, achievementsData = [];
      switch (platform) {
        case "steam":
          achievements = parsedResponse.game.availableGameStats.achievements;
          pathId = 'name';
          pathIcon = 'icon';
          pathName = 'displayName';
          pathDescription = 'description';
          break;
        case "ps":
          achievements = parsedResponse.trophies;
          pathId = 'trophyId';
          pathIcon = 'trophyIconUrl';
          pathName = 'trophyName';
          pathDescription = 'trophyDetail';
          break;
        case "xbox":
          achievements = parsedResponse.achievements
          pathId = 'id';
          //pathIcon = 'trophyIconUrl';
          pathName = 'name';
          pathDescription = 'description';
          break;
      }
      // console.log(body);
      for (var i = 0; i < achievements.length; i++) {
        achievementsData.push({
          id: (platform == "ps") ? achievements[i][pathId].toString() : achievements[i][pathId],
          name: achievements[i][pathName],
          description: achievements[i][pathDescription],
          icon: (platform == "xbox") ? achievements[i].mediaAssets[0].url : achievements[i][pathIcon],
          achieved: 0
        });
      }
      resolve(achievementsData);
    });
  });
}

async function addNonRecordeddGame(response, gameId, platform) {
  var title = await getGameTitle(gameId, platform);
  if (title == 'error') {
    response.send("Error");
    return;
  }
  gameToAdd = [];

  gameToAdd[0] = gameId;
  gameToAdd[1] = title;

  //#region generalScrap
  var browser = await puppeteer.launch();
  var page = await browser.newPage();
  console.log("searching: " + title);
  await page.goto("https://www.igdb.com/search?type=1&q=" + title, { "waitUntil": "load" });

  const button = await page.waitForSelector('.game_cover > a');

  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2' }),
    button.evaluate(b => b.click())
  ]);

  await page.waitForSelector('.gamepage-cover .cover_big', { visible: true });

  const gameCover = await page.evaluate(() => {
    const el = document.querySelector('.gamepage-cover .cover_big');
    return el.getAttribute('src');
  });

  var genres = await page.evaluate(() => {
    var elements = document.querySelectorAll('a.block');
    var info = [];
    for (var element of elements) {
      if (element.href.includes('themes') || element.href.includes('genres')) {
        info.push(element.textContent);
      }
    }
    return info;
  });
  gameToAdd[2] = JSON.stringify(genres);
  gameToAdd[3] = platform;
  gameToAdd[4] = gameCover;

  await page.close();
  //#endregion 
  await addGames([gameToAdd]);
  response.redirect("/search/game?game=" + gameId);

}

function getGameTitle(gameId, platform) {
  return new Promise((resolve, reject) => {
    var urlXbox = 'https://xbl.io/api/v2/achievements/title/' + gameId;
    var urlPs = 'https://m.np.playstation.net/api/trophy/v1/npCommunicationIds/' + gameId + '/trophyGroups?npServiceName=trophy';
    var urlSteam = 'https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/?key=B180F37955BEBCD1CFA8DF8E32ECC03E&appid=' + gameId;
    var url = 'dasfuq';
    var headers = {};

    switch (platform) {
      case "steam":
        url = urlSteam;
        break;
      case "ps":
        url = urlPs;
        headers = psHeaders;
        break;
      case "xbox":
        url = urlXbox;
        headers = xblHeaders;
        break;
    }
    //console.log(url);
    headers['Accept-Language'] = "en-en";
    request({ headers: headers, uri: url }, function (err, res, body) {
      var parsedResponse;
      parsedResponse = JSON.parse(body);

      if (err || res.statusCode >= 400 || 'error' in parsedResponse || 'code' in parsedResponse || Object.keys(parsedResponse).length === 0) {
        //  console.log(body)
        // console.log("general error");
        resolve("error");
        return;
      }
      if (platform == "xbox" && parsedResponse.achievements.length == 0) {
        // console.log("xbox error");
        resolve("error");
        return;
      }
      if (platform == "ps" && parsedResponse.trophyTitlePlatform != "PS4") {
        //console.log("ps error");
        resolve("error");
        return;
      }

      if (platform == "steam" && Object.keys(parsedResponse.game).length == 0) {
        resolve("error");
        return;
      }

      var title;
      switch (platform) {
        case "steam":
          request('https://api.steampowered.com/ISteamApps/GetAppList/v2/', function (err, res, body) {
            appsResponse = JSON.parse(body);
            appsResponse = appsResponse.applist.apps;
            for (var i = 0; i < appsResponse.length; i++) {
              if (appsResponse[i].appid == gameId) {
                title = appsResponse[i].name;
                resolve(title);
                return;
              }

            }
          })
          break;
        case "ps":
          title = parsedResponse.trophyTitleName;
          resolve(title);
          break;
        case "xbox":
          title = parsedResponse.achievements[0].titleAssociations[0].name;
          resolve(title);
          break;
      }
    });

  });
}


function getUnlockedAchievementsForGameId(userId, gameId, platform) {
  //create promise
  //attributes that i will need are 
  return new Promise((resolve, reject) => {
    //urls for quering
    var urlPs = "https://m.np.playstation.net/api/trophy/v1/users/" + userId + "/npCommunicationIds/" + gameId + "/trophyGroups/all/trophies?npServiceName=trophy"
    var xboxUrl = "https://achievements.xboxlive.com/users/xuid(" + userId + ")/achievements?maxItems=100000&titleId=" + gameId;
    var urlSteam = "http://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v0001/?appid=" + gameId + "&key=B180F37955BEBCD1CFA8DF8E32ECC03E&steamid=" + userId;
    var url, headers;

    //paths for the required data

    switch (platform) {
      case "xbox":
        url = xboxUrl;
        headers = xboxHeaders;
        break;

      case "ps":
        url = urlPs;
        headers = psHeaders
        break;

      case "steam":
        url = urlSteam
        break;

    }
    //request to get the achievements of certain gameId
    request({ headers: headers, uri: url }, function (err, response, body) {
      responseParsed = JSON.parse(body);

      var achievements = [], unlocktime, id, achieved, achievedCondition;
      switch (platform) {
        case "xbox":
          achievements = responseParsed.achievements;
          unlocktime = "timeUnlocked";
          id = "id";
          achieved = "progressState";
          achievedCondition = "Achieved";
          break;

        case "ps":
          achievements = responseParsed.trophies;
          unlocktime = "earnedDateTime";
          id = "id";
          achieved = "earned";
          achievedCondition = true;
          break;

        case "steam":
          if (responseParsed.playerstats.success == false || !('achievements' in responseParsed.playerstats)) {
            resolve();
            return;
          } else {
            achievements = responseParsed.playerstats.achievements;
            unlocktime = "unlocktime";
            id = "apiname"
            achieved = "achieved";
            achievedCondition = 1;
          }
          break;
      }
      var count = 0;
      var earnedCount = 0;
      var mostRecentDate = new Date('01 Jan 1970 00:00:00 GMT');
      var achievementsUnlocked = [];
      var currentUnlockDate = new Date();
      //console.log("achievements for: " + gameId);
      if ('error' in responseParsed) {
        console.log("achievements undefined for app : " + gameId);
      }
      for (var i = 0; i < achievements.length; i++) {
        if (achievements[i][achieved] == achievedCondition) {
          count++;
          earnedCount++;
          if (platform == "steam") {
            currentUnlockDate = new Date(achievements[i][unlocktime] * 1000);
          }
          if (platform == "ps") {
            currentUnlockDate = new Date(achievements[i][unlocktime]);
          }
          if (platform == "xbox") {
            currentUnlockDate = new Date(achievements[i]['progression'][unlocktime]);
          }
          //console.log(currentUnlockDate.getTime());
          if (currentUnlockDate.getTime() > mostRecentDate.getTime()) {
            mostRecentDate = currentUnlockDate;
          }
          achievementsUnlocked.push([((platform == "ps" || platform == "steam") ? achievements[i][id] : achievements[i][id]), gameId, userId, (currentUnlockDate.getTime() / 1000)]);
        } else {
          count++;
        }
      }
      if (count == earnedCount) {
        console.log(mostRecentDate.getTime());
      }
      resolve(
        {
          "gameId": gameId,
          "userId": userId,
          'achieved': (count == earnedCount) ? true : false,
          'lastAchieved': mostRecentDate.getTime() / 1000,
          'achievementsUnlocked': achievementsUnlocked
        }
      );

    });
  });
}

function addOrUpdateGamesOwned(userOwnedGames) {
  return new Promise((resolve, reject) => {
    var sql = 'Insert into usersGame (userId, gameId, time, rate) values ? on duplicate Key update time = VALUES(time)';
    connection.query(sql, [userOwnedGames], error => {
      if (error) throw error;
      console.log("games owned added added");
      resolve();
    });
  });
}

function updateCompletedDate(userOwnedGames) {
  return new Promise((resolve, reject) => {
    var sql = 'Insert into usersgame (userId, gameId, completedDate) values ? on duplicate Key update completedDate = VALUES(completedDate)';
    connection.query(sql, [userOwnedGames], error => {
      if (error) throw error;
      console.log("games owned added added");
      resolve();
    });
  });
}

function saveUnlockedAchievements(achievements) {
  return new Promise((resolve, reject) => {
    var sql = 'insert ignore into achievements (achievementId, gameId, userId, dateAchieved) values ? ';
    connection.query(sql, [achievements], error => {
      if (error) throw error;
      console.log("achievementsRecorded");
      connection.query("CALL achievementsUpdate()", error => {
        if (error) throw error;
        console.log("achievementsupdated");
        resolve();
      });

    });
  });
}

function getPsIds(gameIds) {
  return new Promise((resolve, reject) => {
    var url = 'https://m.np.playstation.com/api/trophy/v1/users/6816621795220976068/titles/trophyTitles?npTitleIds=' + gameIds;
    request({ headers: psHeaders, uri: url }, function (err, res, body) {
      var parsedResponse = JSON.parse(body);

      var toResolve = [];
      for (var i = 0; i < parsedResponse.titles.length; i++) {
        if (parsedResponse.titles[i].trophyTitles.length == 0) {
          toResolve.push({
            titleId: parsedResponse.titles[i].npTitleId
            , gameId: 0
          });
        } else {
          toResolve.push({
            titleId: parsedResponse.titles[i].npTitleId
            , gameId: parsedResponse.titles[i].trophyTitles[0].npCommunicationId
          });
        }
      }
      resolve(toResolve);
    })
  });
}

//get the games that have compelted date that means its achivements are full recorded and score calculated
function getUserCompletedGames(userId) {
  return new Promise((resolve, reject) => {
    var sql = "select gameId from usersGame where userId = ? and completedDate is not null";
    connection.query(sql, userId, (error, result) => {
      if (error) throw error;
      if (result.length > 0) {
        resolve(result);
      } else {
        resolve(null);
      }
    });
  });
}

function getStoredApps(platform) {
  return new Promise((resolve, reject) => {
    var sql = "select gameId from games where platform = ?";
    connection.query(sql, platform, (error, result) => {
      if (error) throw error;
      resolve(result);
    });
  });
}

//function to get the user avatar id and name
function getUserInfo(userid, platform) {
  return new Promise((resolve, reject) => {
    var xboxUrl = "https://profile.xboxlive.com/users/batch/profile/settings";
    var psUrl = 'https://m.np.playstation.net/api/userProfile/v1/internal/users/' + userid + "/profiles";
    var steamUrl = "http://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=B180F37955BEBCD1CFA8DF8E32ECC03E&steamids=" + userid;
    var url;
    var userInfo = {};
    var headers;

    switch (platform) {
      case "xbox":
        url = xboxUrl;
        headers = xboxHeaders;
        break;

      case "ps":
        url = psUrl;
        headers = psHeaders;
        break;

      case "steam":
        url = steamUrl;
        break;
    }
    // console.log(url);
    if (platform == "xbox") {
      request.post({
        headers: headers, uri: url, body: {
          "userIds": [
            userid
          ],
          "settings": [
            "GameDisplayName",
            "GameDisplayPicRaw",
            "Gamerscore",
            "Gamertag"
          ]
        },
        json: true
      }, function (err, res, body) {
        if (err) throw err;
        parseResponse = body;

        userInfo['userId'] = userid;
        userInfo['name'] = parseResponse.profileUsers[0].settings[0].value;
        userInfo['avatar'] = parseResponse.profileUsers[0].settings[1].value;
        userInfo['score'] = 0;
        userInfo['platform'] = platform;

        resolve(userInfo);
      });

    } else {
      request({ headers: headers, uri: url }, function (err, res, body) {
        if (err) throw err;
        // console.log(body);
        parseResponse = JSON.parse(body);

        //  console.log(parseResponse);
        switch (platform) {
          case "ps":
            userInfo['userId'] = userid;
            userInfo['name'] = parseResponse.onlineId;
            userInfo['avatar'] = parseResponse.avatars[1].url;
            //   console.log(userInfo['avatar']);
            break;

          case "steam":
            userInfo['userId'] = userid;
            userInfo['name'] = parseResponse.response.players[0].personaname;
            userInfo['avatar'] = parseResponse.response.players[0].avatarfull;
            break;
        }
        userInfo['score'] = 0;
        userInfo['platform'] = platform;

        resolve(userInfo);
      });
    }

  });
}
//main async fucntion that record the users stats  for his respective platform(games and achievements) in ps case it needs to get swap the product id for the npwid and in steanm case it needs to filter the games with no achievements
//this funciton us used for the schedules updates and for the manual users input or auth's
async function uploadUserStats(userid, platform) {

  //tenemso que sacar el avatarname y iod del usuario de otra manera solo lo añadimos
  var userInfo = await getUserInfo(userid, platform);


  // console.log(userInfo);

  //primer paso registrar al usuario a la base de datos con los datos que tenemos de el
  await addUser(userInfo);
  //segundo paso conseguir los juegos del usuario y conseguir los datos de estos 1 sola request :D
  var gamesOwned = await getOwnedGames(userid, platform);

  //if p´latform is steam  get the fuck off the no ahciewvements ones
  if (platform == "steam") {
    var checkNoAchievements = [];
    for (var i = 0; i < gamesOwned.length; i++) {
      checkNoAchievements.push(getNoAchievementGame(gamesOwned[i]));
    }

    var gamesOwned = await Promise.all(checkNoAchievements).then(function (values) {
      return values.filter(function (value) {
        return typeof value !== 'undefined';
      });
    });
  }

  //ps ids needes to the api calls are different from their true id's
  if (platform == "ps") {
    var baseUrl = '';//base url to do the request
    var tempUrl = ''//temp url that will be refreshed each 5 titles
    var psPromises = [];
    var iteration = Math.trunc(gamesOwned.length / 5);;
    var remained = gamesOwned.length % 5;

    for (var i = 1; i < iteration + 1; i++) {
      psPromises.push(getPsIds(
        gamesOwned[(i * 5) - 5].gameId + "%2C" + gamesOwned[(i * 5) - 4].gameId + "%2C" + gamesOwned[(i * 5) - 3].gameId + "%2C" + gamesOwned[(i * 5) - 2].gameId + "%2C" + gamesOwned[(i * 5) - 1].gameId
      ));
    }

    if (remained > 0) {
      if (remained == 1) {
        psPromises.push(gamesOwned[(((iteration + 1) * 5) - 5)].gameId);
      } else {
        var temp = '';
        for (var i = 1; i < remained + 1; i++) {
          temp = temp + gamesOwned[(((iteration + 1) * 5) - 1) - (5 - I)].gameId + "%2C";
        }
        temp = temp.substring(0, (temp.length - 3));
        psPromises.push(getPsIds(temp));
      }
    }
    var auxPsIds = await Promise.all(psPromises);

    auxPsIds = auxPsIds.flat();
    for (var i = 0; i < gamesOwned.length; i++) {
      for (var j = 0; j < auxPsIds.length; j++) {
        if (gamesOwned[i].gameId == auxPsIds[j].titleId) {
          gamesOwned[i].gameId = auxPsIds[j].gameId
        }
      }
    }


    gamesOwned = gamesOwned.filter(function (obj) {
      return obj.gameId !== 0;
    });
  }

  var gamesStoredAppids = await getStoredApps(platform);

  var gamesToAdd = [];

  var match = false;

  for (var i = 0; i < gamesOwned.length; i++) {
    for (var j = 0; j < gamesStoredAppids.length; j++) {
      if (gamesOwned[i].gameId == gamesStoredAppids[j].gameId) {
        match = true;
      }
    }
    if (match == false) {
      gamesToAdd.push(gamesOwned[i]);
    } else {
      match = false;
    }
  }

  var browser = await puppeteer.launch();

  for (var i = 0; i < gamesToAdd.length; i++) {

    var page = await browser.newPage();
    console.log("searching: " + gamesToAdd[i].name);
    await page.goto("https://www.igdb.com/search?type=1&q=" + gamesToAdd[i].name, { "waitUntil": "load" });

    const button = await page.waitForSelector('.game_cover > a');

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2' }),
      button.evaluate(b => b.click())
    ]);

    await page.waitForSelector('.gamepage-cover .cover_big', { visible: true });

    const gameCover = await page.evaluate(() => {
      const el = document.querySelector('.gamepage-cover .cover_big');
      return el.getAttribute('src');
    });

    var genres = await page.evaluate(() => {
      var elements = document.querySelectorAll('a.block');
      var info = [];
      for (var element of elements) {
        if (element.href.includes('themes') || element.href.includes('genres')) {
          info.push(element.textContent);
        }
      }
      return info;
    });

    gamesToAdd[i].front = gameCover;
    gamesToAdd[i].genres = JSON.stringify(genres);
    await page.close();
  }

  gamesData = [];

  ownedGamesData = [];

  for (var i = 0; i < gamesToAdd.length; i++) {
    gamesData.push([
      gamesToAdd[i].gameId,
      gamesToAdd[i].name,
      gamesToAdd[i].genres,
      platform,
      gamesToAdd[i].front
    ]);
  }

  if (gamesToAdd.length > 0) { await addGames(gamesData); }


  for (var i = 0; i < gamesOwned.length; i++) {
    ownedGamesData.push([
      userid,
      gamesOwned[i].gameId,
      gamesOwned[i].timeplayed,
      0
    ]);
  }

  await addOrUpdateGamesOwned(ownedGamesData);

  var gamesCompleted = await getUserCompletedGames(userid);

  var match = false;

  var removalIndexes = [];

  if (gamesCompleted != null) {
    for (var i = 0; i < ownedGamesData.length; i++) {
      for (var j = 0; j < gamesCompleted.length; j++) {
        if (ownedGamesData[i].gameId == gamesCompleted[j].gameId) {
          removalIndexes.push(i);
        }
      }
    }
  }

  for (var i = removalIndexes.length - 1; i >= 0; i--) {
    ownedGamesData.splice(removalIndexes[i], 1);
  }
  var achievementsPromises = [];
  for (var i = 0; i < ownedGamesData.length; i++) {
    achievementsPromises.push(getUnlockedAchievementsForGameId(userid, ownedGamesData[i][1], platform));
  }
  var achievements = await Promise.all(achievementsPromises).then(function (values) {
    return values.filter(function (value) {
      return typeof value !== 'undefined';
    });
  });



  //opt get the gamesalreadycompleted and save the date 
  var achievementsToAdd = [];
  var datesToAdd = []

  for (var i = 0; i < achievements.length; i++) {
    if (achievements[i]['achieved'] == true) {
      datesToAdd.push([achievements[i]['userId'], achievements[i]['gameId'], achievements[i]['lastAchieved']]);
    }
    if (achievements[i]['achievementsUnlocked'].length > 0) {
      achievementsToAdd.push(achievements[i]['achievementsUnlocked']);
    }
  }

  await saveUnlockedAchievements(achievementsToAdd.flat());
  if (datesToAdd.length > 0) {
    await updateCompletedDate(datesToAdd);
  }
}

//function/promsie that adds a user and if its already recorded it doesnt add or update anything
function addUser(userauthinfo) {
  return new Promise((resolve, reject) => {
    var sql = 'Insert ignore into users set ?';
    connection.query(sql, userauthinfo, error => {
      if (error) throw error;
      console.log("usuario añadido");
      resolve();
    });
  });
}
//function/promise that returns the owned games for each platform in playstation case it needs to break down a string that cannot be parsed as date and in the case of xbox needs to make an additional request
function getOwnedGames(userid, platform) {
  return new Promise((resolve, reject) => {
    var urlSteam = 'https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=B180F37955BEBCD1CFA8DF8E32ECC03E&steamid=' + userid + '&include_appinfo=true&include_played_free_games=true'
    var urlXbox = 'https://achievements.xboxlive.com/users/xuid(' + userid + ')/history/titles?maxItems=1000';
    var urlPs = 'https://m.np.playstation.net/api/gamelist/v2/users/' + userid + '/titles?categories=ps4_game&limit=1000&offset=0';
    var url, headers;
    switch (platform) {
      case "xbox":
        url = urlXbox;
        headers = xboxHeaders;
        break;

      case "ps":
        url = urlPs;
        headers = psHeaders;
        break;

      case "steam":
        url = urlSteam;
        break;
    }

    request({ headers: headers, uri: url }, function (err, response, body) {
      if (!err) {
        var gamesOwned = JSON.parse(body);

        var gamesResponseArray;
        var timePath, idPath;
        var appsarray = [];

        switch (platform) {
          case "xbox":
            gamesResponseArray = gamesOwned.titles;
            idPath = "titleId";
            break;

          case "ps":
            gamesResponseArray = gamesOwned.titles;
            timePath = "playDuration";
            idPath = "titleId";
            break;

          case "steam":
            gamesResponseArray = gamesOwned.response.games;
            timePath = "playtime_forever";
            idPath = "appid";
            break;
        }

        //Save the appid+hours in each game of the user if the game is from ps or steam xbox only save titles then get time
        for (var i = 0; i < gamesResponseArray.length; i++) {
          if (platform != "xbox") {
            if (platform == "ps") {
              var timeplayed, seconds, hours, minutes, c = 0;
              var stringTime = '';
              stringTime = gamesResponseArray[i][timePath];
              stringTime = stringTime.slice(2, stringTime.length);
              //frist count letters
              for (var k = 0; k < stringTime.length; k++) {
                if (isNaN(stringTime[k])) {
                  c++;
                }
              }
              for (var k = 0; k < c; k++) {
                for (var j = 0; j < stringTime.length; j++) {
                  if (isNaN(stringTime[j])) {
                    switch (stringTime[j]) {
                      case "H":
                        hours = parseInt(stringTime.slice(0, j), 10);
                        break;
                      case "M":
                        minutes = parseInt(stringTime.slice(0, j), 10);
                        break;
                      case "S":
                        seconds = parseFloat(stringTime.slice(0, j));
                        break;
                    }
                    stringTime = stringTime.slice(j + 1, stringTime.length);
                    break;
                  }
                }
              }
              timeplayed = ((hours == undefined) ? 0 : (hours * 60)) + ((minutes == undefined) ? 0 : minutes) + ((seconds == undefined) ? 0 : ((1 / 60) * seconds));

            }
            appsarray.push({
              gameId: gamesResponseArray[i][idPath],
              name: gamesResponseArray[i].name,
              timeplayed: (platform == "ps") ? timeplayed : gamesResponseArray[i][timePath]
            });

          } else {
            appsarray.push({
              gameId: gamesResponseArray[i][idPath],
              name: gamesResponseArray[i].name
            });
          }
        }

        if (platform == "xbox") {
          var postBody = {
            "arrangebyfield": "xuid",
            "xuids": [
              userid
            ],
            "stats": [

            ]

          }
          for (var i = 0; i < appsarray.length; i++) {
            postBody["stats"].push({ "name": "MinutesPlayed", "titleId": appsarray[i].gameId });
          }
          var url = "https://userstats.xboxlive.com/batch";

          request.post({ headers: headers, uri: url, body: postBody, json: true }, function (err, response, body) {

            var parsedResponse = body;

            for (var i = 0; i < appsarray.length; i++) {
              appsarray[i].timeplayed = parseFloat(parseInt(parsedResponse.statlistscollection[0].stats[i].value)).toFixed(1);
            }

            resolve(appsarray);
          });

        } else {
          resolve(appsarray);
        }

      } else {
        console.log(url);
        console.log('Error: ' + err);
      }
    });
  });
}

//function/promise that adds a game if is already recorded it doesnt add or update anything
function addGames(gamesData) {
  return new Promise((resolve, reject) => {
    var sql = 'Insert ignore into games (gameId, name, genres, platform, front) values ?';
    connection.query(sql, [gamesData], error => {
      if (error) throw error;
      console.log("games added");
      resolve();
    });
  });
}

//funciton/promise that returns that returns the games with no achievements with unidentified or the object in the positive case
function getNoAchievementGame(ownedGame) {
  return new Promise((resolve, reject) => {
    var url = 'https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/?key=B180F37955BEBCD1CFA8DF8E32ECC03E&appid=' + ownedGame.gameId;
    request(url, (err, res, body) => {
      var parsedResponse = JSON.parse(body);
      if (Object.keys(parsedResponse.game).length == 0) {
        resolve();
      } else {
        resolve(ownedGame);
      }
    });
  });
}
async function guides(response, gameId, userId, achievementId, transaction, content, guideId) {
  var status = false;
  //console.log(gameId+userId+achievementId+transaction+content);
  switch (transaction) {
    case "add":
      status = await addGuide(gameId, userId, achievementId, content);
      //send the request to handle the guide by a mod
      break;
    case "edit":
      status = await updateGuide(guideId, content);
      break;
    case "read":
      var guides = [];
      guides = await readGuide(gameId, achievementId);
      status = true;
      break;
    case "delete":
      status = await deleteGuide(guideId);
      break;
    case "publish":
      //this is the option that the bot will do to publish guides aproved by the moderators
      status = await publishGuide(guideId);
      break;
  }
  response.send({ status: status, guides: (transaction == "read") ? guides : 0 });
}

function addGuide(gameId, userId, achievementId, content) {
  return new Promise((resolve, reject) => {
    var sql = 'insert into achievementGuides (gameId, userId, achievementId, content, date) VALUES (?)';
    var array = [gameId, userId, achievementId, content, Math.floor(Date.now() / 1000)];
    connection.query(sql, [array], (error, result) => {
      if (error) {
        console.log(error);
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

function updateGuide(guideId, content) {
  return new Promise((resolve, reject) => {
    var sql = 'update achievementGuides set content = "' + content + '", public=0 , date = ' + Math.floor(Date.now() / 1000) + ' where guideId = ' + guideId;
    connection.query(sql, (error, result) => {
      if (error) {
        console.log(error);
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

function readGuide(gameId, achievementId) {
  return new Promise((resolve, reject) => {
    var sql = 'select * from achievementGuides where gameId = ' + gameId + ' AND achievementId = "' + achievementId + '" AND public = 1';
    connection.query(sql, (error, result) => {
      if (error) {
        console.log(error)
        resolve();
      } else {
        resolve(result);
      }
    });
  });
}

function deleteGuide(guideId) {
  return new Promise((resolve, reject) => {
    var sql = 'delete from achievementGuides where guideId=' + guideId;
    connection.query(sql, (error, result) => {
      if (error) {
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

function publishGuide(guideId) {
  return new Promise((resolve, reject) => {
    var sql = 'update achievementGuides set public = 1 where guideId=' + guideId;
    connection.query(sql, (error, result) => {
      if (error) {
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

function addGuide(gameId, userId, achievementId, content) {
  return new Promise((resolve, reject) => {
    var sql = 'insert into achievementGuides (gameId, userId, achievementId, content, date) VALUES (?)';
    var array = [gameId, userId, achievementId, content, Math.floor(Date.now() / 1000)];
    connection.query(sql, [array], (error, result) => {
      if (error) {
        console.log(error);
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

async function threads(response, userId, threadId, transaction, issue, content, file) {
  var status = false;
  switch (transaction) {
    case "create":
      status = await addThread(userId, issue, content, file);
      //send bot request to handle the thread by a mod
      break;

    case "respond":
      //this is the path the bot will take to respond a thread
      status = await addThreadResponse(threadId, content);
      break;

    case "read":
      status = true;
      var threadInfo = [];
      threadInfo = await readThread(threadId);
      var responseInfo = [];
      responseInfo = await readThreadResponse(threadId);
      response.send({
        status: status,
        threadInfo: threadInfo,
        threadResponse: responseInfo
      });
      break;
    case "readAll":
      var threads = [];
      threads = await readAllThreads(userId);
      response.send({
        status: true,
        threads: threads
      });
      break;

  }
  try {
    response.send({
      status: status,
    });
  } catch {
    console.log("lmao");
  }
}

function addThread(userId, issue, content, media) {
  return new Promise((resolve, reject) => {
    var sql = 'insert into thread (userId, issue, content, media) VALUES (?)';
    var array = [userId, issue, content, media];
    connection.query(sql, [array], (error, result) => {
      if (error) {
        console.log(error);
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

function addThreadResponse(threadId, content) {
  return new Promise((resolve, reject) => {
    var sql = 'insert into threadResponse (threadId, content) VALUES (?)';
    var array = [threadId, content];
    connection.query(sql, [array], (error, result) => {
      if (error) {
        console.log(error);
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

function readAllThreads(userId) {
  return new Promise((resolve, reject) => {
    var sql = 'select threadId, issue from thread where userId = "' + userId + '"';
    connection.query(sql, (error, result) => {
      if (error) {
        console.log(error);
        resolve();
      } else {
        resolve(result);
      }
    });
  });
}

function readThread(threadId) {
  return new Promise((resolve, reject) => {
    var sql = 'select * from thread where threadId = "' + threadId + '"';
    connection.query(sql, (error, result) => {
      if (error) {
        console.log(error);
        resolve();
      } else {
        resolve(result);
      }
    });
  });
}

function readThreadResponse(threadId) {
  return new Promise((resolve, reject) => {
    var sql = 'select * from threadResponse where threadId = "' + threadId + '"';
    connection.query(sql, (error, result) => {
      if (error) {
        console.log(error);
        resolve();
      } else {
        resolve(result);
      }
    });
  });
}


async function road(res, transaction, gameId, userId, roadId, steps, spoilers, rate) {
  var status = false;
  switch (transaction) {
    case "add":
      status = await addRoad(userId, gameId, JSON.stringify(steps), spoilers);
      //handle the reuqest to the bot
      break;
    case "edit":
      status = await editRoad(roadId, JSON.stringify(steps), spoilers);
      break;
    case "delete":
      status = await deleteRoad(roadId);
      break;
    case "readAll":
      var roads = [];
      roads = await readAllRoads(gameId);
      status = true;
      res.send({
        status: true,
        roads: roads
      });
      break;
    case "read":
      //multiple roads single
      break;
    case "rate":
      status = await rateRoad(userId, roadId, rate);
      break;
    case "publish":
      status = await publishRoad(roadId);
      break;
  }
  try {
    res.send({ status: status });
  } catch {
    console.log("lmao");
  }
}

function addRoad(userId, gameId, roadSteps, spoilers) {
  return new Promise((resolve, reject) => {
    var sql = 'insert into road (userId, gameId, roadSteps, spoilers , date) values (?)';
    var array = [userId, gameId, roadSteps, +spoilers, Math.floor(Date.now() / 1000)];
    connection.query(sql, [array], (error, result) => {
      if (error) {
        console.log(error);
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

function editRoad(roadId, content, spoilers) {
  return new Promise((resolve, reject) => {
    var sql = 'update road set roadSteps = ?, spoilers = ' + +spoilers + ' where roadId = ' + roadId;
    connection.query(sql, content, (error, result) => {
      if (error) {
        console.log(error);
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

function deleteRoad(roadId) {
  return new Promise((resolve, reject) => {
    var sql = 'delete from road where roadId = ' + roadId;
    connection.query(sql, (error, result) => {
      if (error) {
        console.log(error);
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

function publishRoad(roadId) {
  return new Promise((resolve, reject) => {
    var sql = 'update road set public = 1 where roadId = ' + roadId;
    connection.query(sql, (error, result) => {
      if (error) {
        console.log(error);
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

function rateRoad(userId, roadId, rate) {
  return new Promise((resolve, reject) => {
    var sql = 'insert into userroad (userId, roadId, rate) values (?) on duplicate Key update rate = VALUES(rate)';
    connection.query(sql, [[userId, roadId, rate]], (error, result) => {
      if (error) {
        console.log(error);
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

function readAllRoads(gameId) {
  return new Promise((resolve, reject) => {
    var sql = 'select * from road where gameId = "' + gameId + '" order by rate DESC';
    connection.query(sql, (error, result) => {
      if (error) {
        console.log(error);
        resolve();
      } else {
        resolve(result);
      }
    });
  });
}

function readRelevantRoad(gameId) {
  return new Promise((resolve, reject) => {
    var sql = 'select * from road where gameId = "' + gameId + '" ordered by rate DESC LIMIT 1';
    connection.query(sql, (error, result) => {
      if (error) {
        console.log(error);
        resolve(result);
      } else {
        resolve();
      }
    });
  });
}

app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});
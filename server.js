let express = require('express');
require('dotenv').config();
let fs = require('fs');
const schedule = require('node-schedule');
const app = express();
let request = require('request');
let bodyParser = require('body-parser');
let SteamAuth = require("node-steam-openid");
const cors = require('cors');
let puppeteer = require('puppeteer');
const multer = require('multer');
const { createProxyMiddleware } = require('http-proxy-middleware')
const { authenticate } = require('@xboxreplay/xboxlive-auth');
const { exchangeCodeForAccessToken, exchangeNpssoForCode, makeUniversalSearch } = require('psn-api');
const { resolve } = require('path');
const path = require('path');
const { platform, userInfo } = require('os');
const { throws } = require('assert');
const { response } = require('express');
const { error } = require('console');
const  connection = require('./utils/connection');
const {uploadUserStats} = require('./utils/uploadUserStats')
const {addGames} = require('./utils/addGames')
const { initializeApp } = require('firebase/app');
const xboxHeaders = require('./utils/xboxHeaders')
const psHeaders = require('./utils/psHeaders')
const {getPrices} = require('./utils/getPrices');
const {getGamesCoverAndGenres} = require('./utils/gameCoversAndGenres');
const { uploadBytes, ref, getDownloadURL, getStorage } = require('firebase/storage')
//#region headers and BDConnection setup


let xblHeaders = {
  'X-Contract': '2',
  'X-Authorization': 'kos4gk0cwgowc84o8c88cg8sgs8c8gsk0oc'
}



app.use(
  '/api',
  createProxyMiddleware({
    target: 'https//api-production-827a.up.railway.app',
    changeOrigin: true,
  })
);

app.use(cors());

app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

const firebaseConfig = {
  apiKey: process.env.APIKEY,
  authDomain: process.env.AUTHDOMAIN,
  projectId: process.env.PROJECTID,
  storageBucket: process.env.STORAGEBUCKET,
  messagingSenderId: process.env.MESSAGINGSENDERID,
  appId: process.env.APPID
}

initializeApp(firebaseConfig);
const storage = getStorage();

//#endregion

app.use(function (err, req, res, next) {
  console.error(err.stack);
  res.type('plain/text');
  res.status(500);
  res.send('500 - Server Error');
});

app.set('port', 3000);

const steam = new SteamAuth({
  realm: "https://api-production-827a.up.railway.app", // Site name displayed to users on logon
  returnUrl: "https://api-production-827a.up.railway.app/auth/steam/authenticate", // Your return route
  apiKey: "B180F37955BEBCD1CFA8DF8E32ECC03E" // Steam API key
});

const trades = require('./routes/trades');
app.use('/trade', trades(connection, storage))


const leaderboard = require('./routes/leaderboard')
app.use("/leaderboard", leaderboard(connection));


const profile = require('./routes/profile');
app.get("/profile", profile(connection))

const guides = require('./routes/guides');
app.use('/guide', guides(connection));

const threads = require('./routes/threads')
app.use("/thread", threads(connection, storage));

const road = require("./routes/road");

app.use('/road', bodyParser.json(), road(connection));


//#region Auth's
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
    console.log(user.steamid);
    res.redirect(`https://web-app-a17c6.web.app/auth/${user.steamid}`);

    uploadUserStats(user.steamid, "steam");

  } catch (error) {
    console.error(error);
  }
});

app.get("/auth/:userId", async (req, res) => {
  let userId = req.params.userId;
  console.log(userId);
  connection.query(`select * from users where userId =${userId}`, (err, response) => {
    if (err) throw err;
    console.log(response[0]);
    res.send(response[0]);
  })
});

app.get("/xbox/auth/grant", async (req, res) => {
  let code = req.query.code;
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
    let userId = body.xuid;
    let avatar = body.avatar;
    console.log(avatar);
    for (let i = 0; i < avatar.length; i++) {
      if (avatar[i] == "&") {
        avatar = avatar.substring(0, i);
        break;
      }
    }
    avatar = avatar + "&format=png"
    let name = body.gamertag;
    res.redirect(`https://web-app-a17c6.web.app/auth/${userId}`);


    uploadUserStats(userId, "xbox");
  });

});

//#endregion

//when you search a game the only think u want is the title, comp, rate, img and genre thus this shit should be stores in the database
app.get('/search/game', function (req, res) {
  console.log("Searching for : " + req.query.game);
  let platform = req.get('platform');
  let sql;
  if (!req.query.game) {
    //todos los titulos de la plataforma
    sql = "select * from games where platform = ?";
    connection.query(sql, platform, (error, result) => {
      //parse each genre
      for (let i = 0; i < result.length; i++) {
        result[i].genres = JSON.parse(result[i].genres);
        delete result[i].platform;
      }
      res.send(result);
    });
  } else {
    let info = req.query.game;

    //search games stores currently ya tienews esto solo copealo y pegalo
    //(busca el jeugo q pide)
    sql = "select * from games where name like '%" + info + "%' AND platform = '" + platform + "'";
    console.log(sql)
    connection.query(sql, (error, result) => {
      if (error) throw error;
      if (result && result.length > 0) {

        for (let i = 0; i < result.length; i++) {
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
            try {
              addNonRecordeddGame(res, info, platform);
            } catch (error) {
              res.send([]);
            }
          }
        });
      }
    });
  }


});

const viewGame = require('./routes/viewGame')
app.use('/view/game', viewGame(connection));


app.get('/rate/:gameid', function (req, res) {
  let gameId = req.params.gameid;
  let rate = req.get('rate');
  let userId = req.get('userId');
  res.end();
  let sql = 'update usersgame set rate = ' + rate + ' where userId=' + userId + ' and gameId = ' + gameId;
  connection.query(sql);
});

app.get('/pin/:userId', function (req, res) {
  let userId = req.params.userId;
  let gameId = req.get('gameId')

  let sqlSelec = 'select * from pin where userId = ' + userId + ' and gameId = ' + gameId;
  let sqlIn = 'insert into pin (userId, gameId) values (?)';
  let sqlDelete = 'delete from pin where userId = ' + userId + ' and gameId = ' + gameId;

  connection.query(sqlSelec, (error, result) => {
    if (error) throw error;
    if (result.length > 0) {
      //quitarlo y mandar que se quito
      connection.query(sqlDelete, (error) => { res.send({ status: false }) });
    } else {
      //añadirlo
      connection.query(sqlIn, [[userId, gameId]], (error) => { if (error) throw error; res.send({ status: true }) });
    }
  });
});


app.get('/vote/:vote', function (req, res) {
  let userId = req.get('userId');
  let guideId = req.get('guideId');
  let vote = (req.params.vote == "true") ? true : false;
  console.log();
  let aux = [userId, guideId, +vote];
  let sql = 'insert into votes (userId, guideId, vote) VALUES (?) on duplicate Key update vote = VALUES(vote)';
  connection.query(sql, [aux], (error, result) => {
    if (error) {
      console.log(error);
      res.send({ status: false });
    } else {
      res.send({ status: true });
    }
  });
});

app.get('/tag/:transaction', function (req, res) {
  const gameId = req.get('gameId');
  const userId = req.get('userId');
  const achievementId = req.get('achievementId');
  const type = req.get('type');
  const tag = req.get('tag');

  if (req.params.transaction == "add") {
    addTag(res, gameId, userId, achievementId, type, tag);
  } else {
    readTag(res, gameId, achievementId);
  }
});

function addTag(res, gameId, userId, achievementId, type, tag) {
  let col, table;
  if (type == "dlc") {
    col = "link";
    table = "dlcTags";
  } else {
    col = "tag";
    table = "tags";
  }


  let sql = "insert into " + table + " (gameId, userId, achievementId, " + col + ") values (?) on duplicate key update " + col + " = VALUES(" + col + ")"
  const array = [gameId, userId, achievementId, tag];
  connection.query(sql, [array], (error, result) => {
    if (error) {
      res.send({ status: false });
      console.log(error)
    } else {

      res.send({ status: true });
    }
  });
}

function readTag(res, gameId, achievementId) {
  const sql = "SELECT count(userId) AS users, tag from tags  WHERE achievementId= '" + achievementId + "' AND gameId = '" + gameId + "' GROUP by tag HAVING users>0 LIMIT 2;";
  const sqldlc = "SELECT count(userId) AS users, link from dlctags  WHERE achievementId= '" + achievementId + "' AND gameId = '" + gameId + "' GROUP by link HAVING users>0 LIMIT 1;";
  connection.query(sql, (error, result1) => {
    if (error) {
      console.log(error);
      res.send({ status: false });
    } else {

      connection.query(sqldlc, (error, result2) => {
        if (error) {
          res.send({ status: false });
          console.log(error);
        } else {
          console.log(result1);
          console.log(result2);
          res.send({
            tags: result1,
            dlcTags: result2
          });
        }
      });
    }
  });
}

app.listen(process.env.PORT || app.get('port'), function () {
  console.log('Express started on http://localhost:' + app.get('port') + '; press Ctrl-C to terminate.');
});

function delay(time) {
  return new Promise(function (resolve) {
    setTimeout(resolve, time)
  });
}

async function addNonRecordeddGame(response, gameId, platform) {
  let title = await getGameTitle(gameId, platform);
  if (title == 'error' || null) {
    response.send("Error");
    return;
  }
  gameToAdd = [];

  gameToAdd[0] = gameId;
  gameToAdd[1] = title;

  //#region generalScrap
  console.log("searching: " + title);
  gamesExtraInfo = await getGamesCoverAndGenres(title);
  gameToAdd[2] = JSON.stringify(gamesExtraInfo[1]);
  gameToAdd[3] = platform;
  gameToAdd[4] = gamesExtraInfo[0];
  await addGames([gameToAdd]);
  response.redirect("/search/game?game=" + gameId);
  await delay(400);

}

function getGameTitle(gameId, platform) {
  return new Promise((resolve, reject) => {
    let urlXbox = 'https://xbl.io/api/v2/achievements/title/' + gameId;
    let urlPs = 'https://m.np.playstation.com/api/trophy/v1/npCommunicationIds/' + gameId + '/trophyGroups?npServiceName=trophy';
    let urlSteam = 'https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/?key=B180F37955BEBCD1CFA8DF8E32ECC03E&appid=' + gameId;
    let url = 'dasfuq';
    let headers = {};

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
      if (err) throw err
      console.log(body)
      let parsedResponse;
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

      let title;
      switch (platform) {
        case "steam":
          request('https://api.steampowered.com/ISteamApps/GetAppList/v2/', function (err, res, body) {
            if (err) { throw err }
            appsResponse = JSON.parse(body);
            appsResponse = appsResponse.applist.apps;
            for (let i = 0; i < appsResponse.length; i++) {
              if (appsResponse[i].appid == gameId) {
                title = appsResponse[i].name;
                console.log("eeeee");
                resolve(title);
                return;
              }

            }
            resolve(null);
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




app.get("/price/:title", async (req, res) => {

  const title = req.params.title;
  ("Getting price for : " + title)
  const platform = req.get('platform')
  const prices = await getPrices(platform, null, title)
  res.send(prices);
});

app.get("/ban/:userId", async (req, res) => {
  const userId = req.params.userId;
  const reason = req.get('reason');
  const sql = `update users set ban = 7 where userId =${userId} `
  connection.query(sql, (err, result) => {
    if (err) throw err;
    const sql2 = `insert ignore into ban (userId, reason) values (${userId}, '${reason}')`
    connection.query(sql2, (err, result2) => {
      if (err) throw err;
      res.send(true)
    })
  });
});

app.get("/unban/:userId", async (req, res) => {
  const userId = req.params.userId;
  const sql = `delete from ban where userId = ${userId}`
  connection.query(sql, (err, result) => {
    if (err) throw err;
    const sql2 = `update users set ban = NULL where userId = ${userId}`
    connection.query(sql2, (err, result2)=>{
      res.send(true)
    });
    
  });
})


const job = schedule.scheduleJob('*/5 * * * *', async (req, res) => {
  console.log("Running daily schedule");

  //1 get thte users
  let users = await getUsers();

  //2 check the ban clocks 
  let ban = []; //people to ban
  let banAwait = []; //people to reduce one of their clock
  for (let i = 0; i < users.length; i++) {
    if (users[i].ban != null) {
      if (((users[i].ban) - 1) == 0) {
        ban.push(users[i].userId)
      } else {
        users[i].ban = users[i].ban - 1;
        banAwait.push([users[i].userId, users[i].ban])
      }
    }
  }

  //3 ban the users needed cascade fk should delete their things too
  if (ban.length > 0) {
    await banUsers(ban);
  }
  if (banAwait.length > 0) {
    await moveDeathClock(banAwait);
  }

  //4 upload temainign users stats
  for (let i = 0; i < users.length; i++) {
    if (users[i].ban == null) {
      console.log("uploading stats of: "+ users[i].userId)
      uploadUserStats(users[i].userId, users[i].platform);
    }
  }
  //5 recalculate the global score
  try {
    connection.query("CALL calculateGlobalScore", (err) => {
      if (err) throw err;
      console.log("global score recalculated");
    });
  } catch (error) {
    console.error("Error calling stored procedure:", error);
  }
});

function getUsers() {
  return new Promise((resolve) => {
    const sql = "select * from users"
    connection.query(sql, (err, res) => {
      if (err) throw err;
      resolve(res);
    })
  })
}
function banUsers(banIds) {
  return new Promise((resolve) => {
    const sql = "delete from users where userId IN  (?)"
    connection.query(sql, [banIds], (err, res) => {
      if (err) { resolve(false); throw err };
        resolve(true);
    });
  });
}

function moveDeathClock(deathIds) {
  return new Promise((resolve) => {
    const sql = "insert into users (userId, ban) values ? ON duplicate key update ban = VALUES(ban)"
    connection.query(sql, [deathIds], (err, res) => {
      if (err) throw err;
      resolve(true)
    })
  });
}
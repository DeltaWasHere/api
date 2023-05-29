let express = require('express');
require('dotenv').config();
let fs = require('fs');
const app = express();
let request = require('request');
let mysql = require('mysql');
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

const { initializeApp } = require('firebase/app');
const { uploadBytes, ref, getDownloadURL, getStorage } = require('firebase/storage')
//#region headers and BDConnection setup
let xboxHeaders = {
  'x-xbl-contract-version': 2
};
let psHeaders = {
}
let xblHeaders = {
  'X-Contract': '2',
  'X-Authorization': 'kos4gk0cwgowc84o8c88cg8sgs8c8gsk0oc'
}
let authorization, myNpsso, accesCode;
let connection = mysql.createConnection({
  host: 'bzdpujn96e42tugmzkmi-mysql.services.clever-cloud.com',
  user: 'uyn2j8jm7hyaezaf',
  port: "20492",
  password: 'JLimZouexH0P10Kcalk',
  database: 'bzdpujn96e42tugmzkmi',
  sql_mode: ''
});


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

const storageTrade = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './uploads')
  },
  filename: function (req, file, cb) {
    let split = file.originalname.split(".");
    console.log(file);
    cb(null, req.body.userId.replace(/['"]+/g, '') + req.body.gameId.replace(/['"]+/g, '') + "-" + Date.now() + "." + split[split.length - 1])
  }
})

const uploadTrade = multer({ storage: multer.memoryStorage() });

const storageThread = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './uploads')
  },
  filename: function (req, file, cb) {
    let split = file.originalname.split(".");
    console.log(file);
    cb(null, split[0] + "-" + Date.now() + "." + split[split.length - 1])
  }
})

const uploadThread = multer({ storage: multer.memoryStorage() });



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
  myNpsso = "JOF1OzyCRWa04dqBJN7J0nQXztk7iLfp44vbpPrP5KheoR3197mpRLmiFKQhiRmB";//mypsnpassword
  //accesCode = await exchangeNpssoForCode(myNpsso);
  authorization = await exchangeCodeForAccessToken(accesCode);
  psHeaders['Authorization'] = 'Bearer ' + authorization.accessToken;
  console.log("psn token ready");

  //xd
  /*
    request({
      headers: {
        'Authorization': 'Bearer ' + authorization.accessToken
      }, uri: 'https://m.np.playstation.net/api/trophy/v1/users/6816621795220976068/titles/trophyTitles?npTitleIds=CUSA15010_00%2CPPSA01628_00%2CCUSA24892_00%2CCUSA20047_00'
    }, function (err, res, body) {
      let repsosneparsed = JSON.parse(body);
      console.log(repsosneparsed);
      for (let i = 0; i < repsosneparsed.titles.length; i++) {
        console.log(repsosneparsed.titles[i].trophyTitles);
      }
      console.log(res.statusCode);
      console.log(res.headers);
      //fs.writeFileSync("all titles LOL.json",JSON.stringify(JSON.parse(body)));
    });
  */
  await authenticate(process.env.MAIL, process.env.PASSWORD).then((value) => { xboxHeaders['Authorization'] = 'XBL3.0 x=' + value.user_hash + '; ' + value.xsts_token + ';' }).catch(console.error);
  //console.log(xboxHeaders.Authorization);
}


const steam = new SteamAuth({
  realm: "https://api-production-827a.up.railway.app", // Site name displayed to users on logon
  returnUrl: "https://api-production-827a.up.railway.app/auth/steam/authenticate", // Your return route
  apiKey: "B180F37955BEBCD1CFA8DF8E32ECC03E" // Steam API key
});

app.post('/trade/:transaction', bodyParser.json(), uploadTrade.single('validation'), async (req, res) => {
  let transaction = req.params.transaction;
  let userId = req.get("userId");
  let gameId = req.get("gameId");
  let tradeId = req.get("tradeId");
  let status
  switch (transaction) {
    //search trades for a specific gameID
    //required: gameId
    case "searchTrades":
      let trades = await searchTrades(gameId);
      //console.log(trades);

      for (let i = 0; i < trades.length; i++) {
        trades[i].interestedGames = await getInterestedGames(trades[i].interestedgameId1, trades[i].interestedgameId2, trades[i].interestedgameId3);
        for (let j = 0; j < trades[i].interestedGames.length; j++) {
          trades[i].interestedGames[j].genres = JSON.parse(trades[i].interestedGames[j].genres);
        }

      }
      res.send(trades);
      break;

    //get the trades publiushed by an user and trades offered to others
    //required: userId
    case "tradeHistory":
      let history = await tradeHistory(userId);
      console.log(history);
      for (let i = 0; i < history.length; i++) {
        history[i].interestedGames = await getInterestedGames(history[i].interestedgameId1, history[i].interestedgameId2, history[i].interestedgameId3);
        for (let j = 0; j < history[i].interestedGames.length; j++) {
          history[i].interestedGames[j].genres = JSON.parse(history[i].interestedGames[j].genres);
        }
      }
      console.log(history);
      res.send(history);
      break;

    //get the trades offered to certain trade
    //required: tradeId
    case "tradesOffered":
      let offers = await getOffers(tradeId);
      res.send(offers);
      break;

    //this adds an offer either public or as an offer
    //needs a body with: userId(autor), gameId(gamepublished), key(the key of the trade), media(validation archieve), interestedGame1,interestedGame2,interestedGame3
    case "addOffer":
      if (req.file === undefined) {
        req.body.media = "NULL";
        status = await addOffer(req.body);
      } else {
        const split = req.file.originalname.split(".");
        const storageRef = ref(storage, req.body.userId.replace(/['"]+/g, '') + req.body.gameId.replace(/['"]+/g, '') + "-" + Date.now() + "." + split[split.length - 1]);
        const metadata = {
          contentType: 'video/mp4'
        }
        await uploadBytes(storageRef, req.file.buffer, metadata);
        const mediaPath = await getDownloadURL(storageRef);


        req.body.media = mediaPath;
        req.body.media = req.body.media.replace("\\", "\\\\");
        status = await addOffer(req.body);
      }
      res.send(status);
      break;

    case "addTrade":
      console.log(req.body);
      if (req.file === undefined) { //no file to storage
        req.body.media = "NULL";
        status = await addTrade(req.body);
      } else {
        const split = req.file.originalname.split(".");
        const storageRef = ref(storage, req.body.userId.replace(/['"]+/g, '') + req.body.gameId.replace(/['"]+/g, '') + "-" + Date.now() + "." + split[split.length - 1]);
        const metadata = {
          contentType: 'video/mp4'
        }
        await uploadBytes(storageRef, req.file.buffer, metadata);
        const mediaPath = await getDownloadURL(storageRef);


        req.body.media = mediaPath;
        req.body.media = req.body.media.replace("\\", "\\\\");
        status = await addTrade(req.body);
      }


      res.send(status);
      break;

    //adds a rate to a succesfull trade
    //requires: userId(who rates), destinedUser(user who get rated)
    case "rate":
      console.log("user " + userId + "added " + req.body.rate + "of rate to the trade " + tradeId)
      status = await addRate(tradeId, userId, req.body.rate);
      res.send(status);
      break;

    //accept or decline trade, just adds the destinedTrade
    //required: tradeId(the id of the trade which has the offer), offerId(the id of the trade offered)
    case "tradeTransaction":
      let tradeTransaction = req.body.tradeTransaction;
      let destinedId = req.body.destinedId;
      status = await makeTradeTransaction(tradeId, tradeTransaction, destinedId);
      res.send(status);
      break;

    //claim the key of game accepted
    //required: tradeId
    case "getOffer":
      let trade = await getOffer(tradeId);
      res.send(trade);
      break;

    case "getMedia":
      console.log("Getting media to: " + req.body.media);
      const storageRef = ref(storage, req.body.media);

      const fileUrl = await getDownloadURL(storageRef)
      res.redirect(fileUrl);
      break;

    case "getKey":
      let key = await getKey(tradeId);
      res.send(key);
      break;
    //view offer maybe?
  }
});

function getKey(tradeId) {
  return new Promise((resolve, reject) => {
    let sql = `SELECT gameKey FROM trade WHERE tradeId = ${tradeId}`;
    connection.query(sql, (err, res) => {
      if (err) throw err;
      console.log(res[0].gameKey);
      resolve(res[0].gameKey);

    });
  });
}

function getOffer(targetId) {
  return new Promise((resolve, reject) => {
    let sql = `SELECT trade.tradeId, users.avatar, users.Name as userName, users.tradeRate, trade.restriction, trade.gameId, trade.acceptedId, trade.date, trade.gameKey, games.front, games.name as interestedGames FROM trade JOIN users ON users.userId = trade.userId JOIN games ON games.gameId=trade.gameId where trade.tradeId=${targetId};`;
    connection.query(sql, (err, res) => {
      if (err) { resolve(false); throw err }
      resolve(res[0]);
    });
  })
};

function makeTradeTransaction(tradeId, tradeTransaction, destinedId) {
  return new Promise((resolve, reject) => {
    let sql, sql1;
    console.log("transactioon: " + tradeTransaction);
    if (tradeTransaction === "1") {//accept
      sql = `UPDATE trade SET acceptedId = ${destinedId}, public = 0 WHERE tradeId = ${tradeId};`;
      sql1 = `UPDATE trade SET acceptedId = ${tradeId} WHERE tradeId = ${destinedId};`;
    } else {//decline
      sql = `delete FROM trade where tradeId=${destinedId}`;
    }
    console.log(sql);
    connection.query(sql, (err) => {
      if (err) { throw err; }
      if (sql1 != undefined) {
        connection.query(sql1, (err) => {
          if (err) { throw err }
          resolve(true);
        });
      } else {
        resolve(false);
      }
    });
  });
}

function addRate(tradeId, userId, rate) {
  return new Promise((resolve, reject) => {
    let sql = `INSERT INTO traderate (userId, tradeId, rate) VALUES (${userId}, ${tradeId}, ${rate}) ON DUPLICATE KEY UPDATE rate = VALUES(rate);`;
    connection.query(sql, (err) => {
      if (err) { resolve("false"); throw err; }
      resolve("true");
    });
  });
}

function addTrade(body) {

  // console.log(media);
  return new Promise((resolve, reject) => {
    let sql = `insert into trade (userId, gameId, media, interestedGameId1, interestedGameId2, interestedGameId3, date, restriction, gameKey, public) VALUES (${body.userId}, ${body.gameId}, "${body.media}", ${body.interestedGameId1 === "" || body.interestedGameId1 === undefined ? "NULL" : body.interestedGameId1}, ${body.interestedGameId2 === "" || body.interestedGameId2 === undefined ? "NULL" : body.interestedGameId2}, ${body.interestedGameId3 === "" || body.interestedGameId3 === undefined ? "NULL" : body.interestedGameId3}, ${body.date}, ${body.restriction}, ${"'" + body.gameKey + "'"}, 1) ON DUPLICATE KEY UPDATE gameKey = VALUES(gameKey), gameId = VALUES(gameID), date = VALUES(date), interestedGameId1 = VALUES(interestedGameId1), interestedGameId2 = VALUES(interestedGameId2), interestedGameId3 = VALUES(interestedGameId3);`;
    console.log(sql);
    connection.query(sql, (err) => {
      if (err) { resolve("false"); throw err; }
      resolve("true");
    });
  });
}

function addOffer(body) {

  return new Promise((resolve, reject) => {
    let sql = `insert into trade (userId, gameId, media, interestedGameId1, interestedGameId2, interestedGameId3, date, restriction, gameKey, public, destinedId) VALUES (${body.userId}, ${body.gameId}, "${body.media}", ${body.interestedGameId1 === "" || body.interestedGameId1 === undefined ? "NULL" : body.interestedGameId1}, ${body.interestedGameId2 === "" || body.interestedGameId2 === undefined ? "NULL" : body.interestedGameId2}, ${body.interestedGameId3 === "" || body.interestedGameId3 === undefined ? "NULL" : body.interestedGameId3}, ${body.date}, ${body.restriction}, ${"'" + body.gameKey + "'"}, 0, ${"'" + body.destinedId + "'"}) ON DUPLICATE KEY UPDATE gameKey = VALUES(gameKey), gameId = VALUES(gameID), date = VALUES(date), interestedGameId1 = VALUES(interestedGameId1), interestedGameId2 = VALUES(interestedGameId2), interestedGameId3 = VALUES(interestedGameId3);`;
    console.log(sql); connection.query(sql, (err) => {
      if (err) { resolve("false"); throw err; }
      resolve("true");
    });
  });
}

function getOffers(tradeId) {
  return new Promise((resolve, reject) => {
    let sql = `SELECT ${tradeId} as offerId, trade.tradeId, users.avatar, users.name as userName, users.tradeRate, trade.tradeId, trade.restriction, trade.gameId, trade.acceptedId, trade.media, trade.date, trade.acceptedId, games.front, games.name FROM trade JOIN users ON users.userId = trade.userId JOIN games ON games.gameId=trade.gameId where trade.destinedId=${tradeId};`;
    console.log(sql);
    connection.query(sql, (err, result) => {
      if (err) { throw err }
      resolve(result);
    });
  });
}

function searchTrades(gameId) {
  return new Promise((resolve, reject) => {
    let sql = `SELECT trade.tradeId, trade.acceptedId, users.avatar, users.tradeRate, users.userId, trade.tradeId, users.name as userName, trade.restriction, trade.gameId, trade.date, trade.interestedgameId1, trade.interestedgameId2, trade.interestedgameId3, trade.media, games.front, games.name FROM trade JOIN users ON users.userId = trade.userId JOIN games ON games.gameId = trade.gameId where trade.gameId = ${gameId} AND public = 1;`;
    connection.query(sql, (err, result) => {
      if (err) { throw err; }

      resolve(result);


    });
  });
}
function getInterestedGames(interestedGameId1, interestedGameId2, interestedGameId3) {
  return new Promise((resolve, reject) => {
    let sql2 = `SELECT * FROM games WHERE gameId IN(${interestedGameId1 == "" ? "NULL" : interestedGameId1}, ${interestedGameId2 === "" ? "NULL" : interestedGameId2}, ${interestedGameId3 === "" ? "NULL" : interestedGameId3});`;
    connection.query(sql2, (err, result1) => {
      if (err) { throw err; }
      console.log(sql2);
      resolve(result1);
    });
  });
}

function tradeHistory(userId) {
  return new Promise((resolve, reject) => {
    let sql1 = `SELECT NULL as offerId, a.tradeId, users.avatar, users.name as userName, users.tradeRate, a.restriction, a.gameId, a.date, a.interestedgameId1, a.interestedgameId2, a.interestedgameId3, a.media, games.front, games.name, (select count(*) from trade where destinedId=a.tradeId) as tradeNumbers , a.acceptedId, a.destinedId  FROM trade as a JOIN users ON users.userId = a.userId JOIN games ON games.gameId=a.gameId where a.userId=${userId} and destinedId IS NULL;`; //trades publicadas por x usuario ya esten o no respondidas

    let sql2 = `SELECT a.tradeId as offerId, b.tradeId, users.avatar, users.name as userName, users.tradeRate, b.restriction, b.gameId, b.date, b.interestedgameId1, b.interestedgameId2, b.interestedgameId3, b.media, games.front, games.name, 0 as tradeNumbers, b.acceptedId, a.destinedId FROM trade AS a JOIN trade AS b ON a.destinedId = b.tradeId JOIN users ON users.userId = b.userId JOIN games ON games.gameId=b.gameId where a.userId=${userId} and a.destinedId IS NOT NULL;`; //ofertas publicadas por x usuario ya esten o no respondidas
    connection.query(sql1, (err, result1) => {
      if (err) { throw err }
      connection.query(sql2, (err, result2) => {
        if (err) { throw err };
        resolve(result1.concat(result2));
      });
    });
  });
}

app.get("/leaderboard/:type", async (req, res) => {
  let leader = req.params.type;
  console.log("sending leader: ")
  switch (leader) {
    case 0:
      break;
    case 1:
      break;
    case 2:
      break;
  }
  let gameId = req.get("gameId");
  let achievementId = req.get("achievementId");
  let platform = req.get("platform");

  let sql = ["SELECT users.avatar, users.name, achievements.dateAchieved as score FROM achievements INNER JOIN users ON achievements.userId = users.userId WHERE achievements.achievementId = '" + achievementId + "' ORDER BY achievements.dateAchieved ASC",
  "SELECT users.avatar, users.name, usersgame.completedDate as score FROM usersgame INNER JOIN users ON users.userId = usersgame.userId WHERE usersgame.gameId = " + gameId + " AND  usersgame.completedDate IS NOT null ORDER BY completedDate ASC",
  "SELECT avatar, name, score FROM users where platform = '" + platform + "' order by score ASC"];
  console.log(leader)

  let leaderboard = connection.query(sql[leader], (error, result) => {
    console.log(sql[leader]);
    if (error) {
      console.log(error);
    } else {
      console.log(result);
      res.send(result)
    }

  });
});

app.get("/profile/:transaction", async function (req, res) {
  let transaction = req.params.transaction;
  let userId = req.get("userId");
  let platform = req.get("platform");
  let language = req.get("language");
  let sql;
  switch (transaction) {
    case "preview":
      let gamesToCheck = [];

      let profilePreview = await getProfilePreview(userId, platform);
      let valuableAchievements = profilePreview.valuableAchievements;
      let recentAchievements = profilePreview.recentAchievements;



      for (let i = 0; i < recentAchievements.length; i++) {
        if (!gamesToCheck.includes(recentAchievements[i].gameId)) {
          gamesToCheck.push(recentAchievements[i].gameId);
        }
        if (!gamesToCheck.includes(valuableAchievements[i].gameId)) {
          gamesToCheck.push(valuableAchievements[i].gameId);
        }
      }

      //console.log(gamesToCheck);

      let achievements, rarity, totalAchievements = [];
      for (let gameId of gamesToCheck) {
        achievements = await getAchievementsForGameId(gameId, platform, language);
        rarity = await getRatity(gameId);
        for (let i = 0; i < achievements.length; i++) {
          achievements[i]['rarity'] = 0.0;
          achievements[i]['achieved'] = 1;
          for (let j = 0; j < rarity.length; j++) {
            if (achievements[i].achievementId == rarity[j].achievementId) {
              achievements[i].rarity = rarity[j].rarity;
              break;
            }
          }
        }
        totalAchievements = totalAchievements.concat(achievements);
      }

      //console.log(totalAchievements);

      for (let i = 0; i < profilePreview.valuableAchievements.length; i++) {
        for (let j = 0; j < totalAchievements.length; j++) {
          if (totalAchievements[j].achievementId == profilePreview.valuableAchievements[i].achievementId) {
            profilePreview.valuableAchievements[i] = Object.assign({}, profilePreview.valuableAchievements[i], totalAchievements[j]);
            // delete profilePreview.valuableAchievements[i].gameId;
            break;
          }
        }
      }

      for (let i = 0; i < profilePreview.recentAchievements.length; i++) {
        for (let j = 0; j < totalAchievements.length; j++) {
          if (totalAchievements[j].achievementId == profilePreview.recentAchievements[i].achievementId) {
            profilePreview.recentAchievements[i] = Object.assign({}, profilePreview.recentAchievements[i], totalAchievements[j]);
            // delete profilePreview.recentAchievements[i].gameId;
            break;
          }
        }
      }

      res.send(profilePreview);
      break;
    case "pins":
      sql = "select games.gameId, games.front, games.name, games.rate, games.completion_time, games.genres from pin join games where pin.userId = '" + userId + "' AND pin.gameId=games.gameId;"
      connection.query(sql, (err, response) => {
        if (err) throw err;
        for (let i = 0; i < response.length; i++) {
          response[i].genres = JSON.parse(response[i].genres);
        }
        res.send(response);
      });
      break;
    case "ownedGames":
      sql = "select games.gameId, games.front, games.name, games.rate, games.completion_time, games.genres from usersgame join games where usersgame.userId = '" + userId + "' AND usersgame.gameId=games.gameId;"
      connection.query(sql, (err, response) => {
        if (err) throw err;
        for (let i = 0; i < response.length; i++) {
          response[i].genres = JSON.parse(response[i].genres);
        }
        res.send(response);
      });
      break;
    case "guidesWrited":
      sql = 'select achievementGuides.guideId, achievementGuides.gameId, achievementGuides.content, achievementGuides.votes, achievementGuides.date, users.name, users.avatar, users.userId from achievementGuides INNER JOIN users ON achievementGuides.userId = users.userId AND   achievementGuides.userId = "' + userId + '" AND achievementGuides.public = 1;'
      connection.query(sql, (err, response) => {
        if (err) throw err;
        res.send(response);
      });
      break;
    case "threads":
      sql = "select * from threads where userId=" + userId + ";"
      connection.query(sql, (err, response) => {
        if (err) throw err;
        res.send(response);
      });
      break;

    case "check":
      console.log(userId)
      let status = await checkUserExitance(userId);
      console.log(status)
      if (status === true) {
        res.send(status);
      } else {
        res.send(status);
        try {
          await uploadUserStats(userId, platform);
        } catch (err) {
          throw err;
        }
      }
      break;
    default:


      break;
  }
});

function checkUserExitance(userId) {
  return new Promise((resolve, reject) => {
    sql = `select * from users where userId = ${userId}`
    connection.query(sql, (err, response) => {
      if (err) throw err;
      if (response.length > 0) {
        resolve(true);
      } else {
        resolve(false);
      }
    });
  });
}

function getProfilePreview(userId, platform) {
  return new Promise((resolve, reject) => {
    let sql = ["select t.userId, t.name, t.score, t.avatar, (select count(*) from users x where x.score>=t.score and x.platform = '" + platform + "' order by x.score DESC) as position from users t where userId = '" + userId + "';",
    "select achievementId, gameId, dateAchieved, rarity from achievements where userId = '" + userId + "' order by rarity ASC limit 5",
    "select achievementId, gameId, dateAchieved, rarity from achievements where userId = '" + userId + "' order by dateAchieved DESC limit 5"];
    connection.query(sql[0], (err1, res1) => {
      connection.query(sql[1], (err2, res2) => {
        connection.query(sql[2], (err3, res3) => {
          profileData = {
            userId: userId,
            position: res1[0].position,
            score: res1[0].score,
            avatar: res1[0].avatar,
            name: res1[0].name,
            valuableAchievements: res2,
            recentAchievements: res3
          }
          resolve(profileData);
        });
      });
    });
  });
}

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
    //await addUser(userauthinfo)
    console.log(user.steamid);
    res.redirect(`https://web-app-a17c6.web.app//auth/${user.steamid}`);

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
    for (let i = 0; i < avatar.length; i++) {
      if (avatar[i] == "&") {
        avatar = avatar.substring(0, i);
        break;
      }
    }
    avatar = avatar + "&format=png"
    let name = body.gamertag;
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
            addNonRecordeddGame(res, info, platform);
          }
        });
      }
    });
  }


});

app.get('/view/game/:gameid', function (req, res) {

  if (req.params.gameid) {
    let gameid = req.params.gameid;
    let userid = req.get('userid');
    let platform = req.get('platform');
    let language = req.get('language');
    getGameAchievements(res, gameid, platform, language, userid);
  } else {
    res.send("error");
  }

});

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
app.post('/guide/:transaction', bodyParser.json(), function (req, res) {
  console.log("AAAAA");
  let transaction = req.params.transaction;
  let gameId = req.get('gameId');
  let achievementId = req.get('achievementId');
  let userId = req.get('userId');
  let content = req.body.content;
  console.log("Body: ");
  console.log(req.body);
  let guideId;
  if (req.get('guideId')) {
    guideId = req.get('guideId');
  } else {
    guideId = null;
  }

  guides(res, gameId, userId, achievementId, transaction, content, guideId);
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

app.post("/thread/:transaction", bodyParser.json(), uploadThread.single('validation'), async function (req, res) {
  console.log("a")
  console.log(req.body);
  const transaction = req.params.transaction;
  const userId = req.get('userId');
  const threadId = req.get('threadId') || req.query.threadId;
  const issue = req.body && req.body.issue ? req.body.issue : "";
  const media = null;
  const title = req.body && req.body.title ? req.body.title : "";
  const content = req.body && req.body.content ? req.body.content : "";
  let file;
  if (req.file === undefined) {
    file = "NULL";
  } else {
    file = req.file;

  }

  threads(res, userId, threadId, transaction, issue, title, content, file, media);
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

app.post('/road/:transaction', bodyParser.json(), function (req, res) {
  const transaction = req.params.transaction;
  const gameId = req.get('gameId');
  const userId = req.get('userId');
  const roadId = req.get('roadId');
  const rate = parseInt(req.get('rate'));
  let spoilers = req.get('spoilers');
  spoilers = (spoilers == "true") ? true : false;
  const steps = req.body.roadSteps;
  console.log(req.body);
  road(res, transaction, gameId, userId, roadId, steps, spoilers, rate);

});



app.listen(process.env.PORT || app.get('port'), function () {
  console.log('Express started on http://localhost:' + app.get('port') + '; press Ctrl-C to terminate.');
  main();
});



async function getGameAchievements(response, gameid, platform, language, userid) {
  //1-get game achievements 
  let achievements = [], rarity = [];

  achievements = await getAchievementsForGameId(gameid, platform, language);
  rarity = await getRatity(gameid);
  //console.log(achievements);
  for (let i = 0; i < achievements.length; i++) {
    achievements[i]['rarity'] = 0.0;

    for (let j = 0; j < rarity.length; j++) {
      if (achievements[i].achievementId == rarity[j].achievementId) {

        achievements[i].rarity = rarity[j].rarity;

        break;
      }
    }
  }

  //check for unlocked ahcievements or prices
  let owned = await checkIfOwned(userid, gameid);
  let itemData
  if (owned) {
    //check if owned the game if not send the prices
    let unlockedAchievements = await getUnlockedAchievementsRecorded(userid, gameid);
    for (let i = 0; i < achievements.length; i++) {
      // console.log(achievements[i]);
      achievements[i]['achieved'] = 0;
      for (let j = 0; j < unlockedAchievements.length; j++) {
        if (achievements[i].achievementId == unlockedAchievements[j].achievementId) {
          achievements[i]['achieved'] = 1;
          achievements[i]['dateAchieved'] = unlockedAchievements[j].dateAchieved;
          break;
        }
      }
    }
  } else {
    //console.log(title);
    itemData = await getPrices(platform, gameid);
  }


  //get theacheivement tags if they exist

  const tags = await getAchievementTags(gameid);
  console.log(itemData);

  //push into thge achievements tgas attribute the tags they had
  for (let i = 0; i < achievements.length; i++) {
    achievements[i].tags = [];
    for (let j = 0; j < tags.length; j++) {
      if (tags[j].achievementId == achievements[i].achievementId) {
        achievements[i].tags.push({
          tag: tags[j].tag,
          count: tags[j]['count(userId)']
        });
      }
    }
  }


  response.send({
    product: itemData,
    achievements: achievements
  });



  //2-get game prices in the corresponding platform ( check if the user is authenticated and in that case check if he already owns it)
  //3- if the user is authenticated and owns the game check if he has achievements unlocked and mark the acheivements sended as unlocked in the respective ahcievements
}

function getAchievementTags(gameId) {
  return (new Promise((resolve, reject) => {
    const sql = 'select count(userId), achievementId, tag from tags where gameId="' + gameId + '" group by achievementId';
    connection.query(sql, function (err, result) {
      if (err) throw err;
      resolve(result);
    })

  }))
}


app.get('/POOOOOWEEEEEEER/:gameId', async function (req, res) {

  const gameId = req.params.gameId;
  const platform = req.get('platform')
  /*const itemData = await getPrices(platform, gameId);
  */


  const tags = await getAchievementTags(gameId);
  res.send(tags);
});


async function getPrices(platform, gameId, title) {
  if(title==undefined){
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
        let firstItem = document.querySelector('.m-product-placement-item.f-size-medium.context-game.gameDiv');
        let anchorLink = firstItem.querySelector(".gameDivLink");
        return {
          price: firstItem.getAttribute("data-listprice"),
          link: anchorLink.getAttribute("href")
        }
      });
    } catch (error) {
      console.log("Error while getting the price for  platform: " + platform)
      itemData.push({
        price: "Unknown",
        link: pagesMap.get(platform)
      })
    }
  } else {
    if (platform == "ps") {
      try {
        await page.waitForSelector(itemPath.get(platform));

        itemData = await page.evaluate((itemPath) => {

          let psList = document.querySelectorAll(itemPath);
          for (let i = 0; i < psList.length; i++) {
            if (psList[i].querySelector('div section > span.psw-product-tile__product-type.psw-t-bold.psw-t-size-1.psw-t-truncate-1.psw-c-t-2.psw-t-uppercase.psw-m-b-1') == null) {
              return {
                link: 'https://store.playstation.com/' + psList[i].getAttribute('href'),
                price: psList[i].querySelector('.psw-m-r-3').textContent.substring(3)
              }
            }
          }
          return "NI";
        }, itemPath.get(platform));
      } catch (error) {
        console.log("Error while getting the price for platform: " + platform);
        itemData.push({
          price: "Unknown",
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

function delay(time) {
  return new Promise(function (resolve) {
    setTimeout(resolve, time)
  });
}


function checkIfOwned(userId, gameId) {
  return new Promise((resolve, reject) => {

    let sql = "select * from usersgame where gameId='" + gameId + "' and userId ='" + userId + "'";
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
    let sql = 'select * from achievements where gameId="' + gameId + '" and userId ="' + userId + '"';
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
    let urlSteam = 'https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/?key=B180F37955BEBCD1CFA8DF8E32ECC03E&appid=' + gameId + "&l=" + language;
    let urlXbox = 'https://xbl.io/api/v2/achievements/title/' + gameId;
    let urlPs = "https://m.np.playstation.net/api/trophy/v1/npCommunicationIds/" + gameId + "/trophyGroups/all/trophies?npServiceName=trophy";
    let url, icon, id, description;
    let headers;
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
      if (language == "espanol" || language == "espa\u00F1ol") {
        language = "spanish";
        url = 'https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/?key=B180F37955BEBCD1CFA8DF8E32ECC03E&appid=' + gameId + "&l=" + language;
      }
    }
    console.log("url: " + url);
    request({ headers: headers, uri: url }, function (err, res, body) {
      if (err) throw err;
      parsedResponse = JSON.parse(body);
      let achievements, pathIcon, pathDescription, pathId, pathName, achievementsData = [];
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
      for (let i = 0; i < achievements.length; i++) {
        achievementsData.push({
          achievementId: (platform == "ps") ? achievements[i][pathId].toString() : achievements[i][pathId],
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
    let urlPs = 'https://m.np.playstation.net/api/trophy/v1/npCommunicationIds/' + gameId + '/trophyGroups?npServiceName=trophy';
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

function getUnlockedAchievementsForGameId(userId, gameId, platform) {
  //create promise
  //attributes that i will need are 
  return new Promise((resolve, reject) => {
    //urls for quering
    let urlPs = "https://m.np.playstation.net/api/trophy/v1/users/" + userId + "/npCommunicationIds/" + gameId + "/trophyGroups/all/trophies?npServiceName=trophy"
    let xboxUrl = "https://achievements.xboxlive.com/users/xuid(" + userId + ")/achievements?maxItems=100000&titleId=" + gameId;
    let urlSteam = "http://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v0001/?appid=" + gameId + "&key=B180F37955BEBCD1CFA8DF8E32ECC03E&steamid=" + userId;
    let url, headers;

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

      let achievements = [], unlocktime, id, achieved, achievedCondition;
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
      let count = 0;
      let earnedCount = 0;
      let mostRecentDate = new Date('01 Jan 1970 00:00:00 GMT');
      let achievementsUnlocked = [];
      let currentUnlockDate = new Date();
      //console.log("achievements for: " + gameId);
      if ('error' in responseParsed) {
        console.log("achievements undefined for app : " + gameId);
      }
      for (let i = 0; i < achievements.length; i++) {
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
    let sql = 'Insert into usersgame (userId, gameId, time, rate) values ? on duplicate Key update time = VALUES(time)';
    connection.query(sql, [userOwnedGames], error => {
      if (error) throw error;
      console.log("games owned added added");
      resolve();
    });
  });
}

function updateCompletedDate(userOwnedGames) {
  return new Promise((resolve, reject) => {
    let sql = 'Insert into usersgame (userId, gameId, completedDate) values ? on duplicate Key update completedDate = VALUES(completedDate)';
    connection.query(sql, [userOwnedGames], error => {
      if (error) throw error;
      console.log("games owned added added");
      resolve();
    });
  });
}

function saveUnlockedAchievements(achievements) {
  return new Promise((resolve, reject) => {
    let sql = 'insert ignore into achievements (achievementId, gameId, userId, dateAchieved) values ? ';
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
    let url = 'https://m.np.playstation.com/api/trophy/v1/users/6816621795220976068/titles/trophyTitles?npTitleIds=' + gameIds;
    request({ headers: psHeaders, uri: url }, function (err, res, body) {
      let parsedResponse = JSON.parse(body);

      let toResolve = [];
      for (let i = 0; i < parsedResponse.titles.length; i++) {
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
    let sql = "select gameId from usersgame where userId = ? and completedDate is not null";
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
    let sql = "select gameId from games where platform = ?";
    connection.query(sql, platform, (error, result) => {
      if (error) throw error;
      resolve(result);
    });
  });
}

function getRatity(gameId) {
  return new Promise((resolve, reject) => {
    let sql = "SELECT DISTINCT achievementId, rarity FROM achievements WHERE gameId=?";
    connection.query(sql, gameId, (error, result) => {
      if (error) throw error;
      resolve(result);
    });
  });
}

//function to get the user avatar id and name
function getUserInfo(userid, platform) {
  return new Promise((resolve, reject) => {
    let xboxUrl = "https://profile.xboxlive.com/users/batch/profile/settings";
    let psUrl = 'https://m.np.playstation.net/api/userProfile/v1/internal/users/' + userid + "/profiles";
    let steamUrl = "http://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=B180F37955BEBCD1CFA8DF8E32ECC03E&steamids=" + userid;
    let url;
    let userInfo = {};
    let headers;

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
  let userInfo = await getUserInfo(userid, platform);


  // console.log(userInfo);

  //primer paso registrar al usuario a la base de datos con los datos que tenemos de el
  await addUser(userInfo);
  //segundo paso conseguir los juegos del usuario y conseguir los datos de estos 1 sola request :D
  let gamesOwned = await getOwnedGames(userid, platform);

  //if p´latform is steam  get the fuck off the no ahciewvements ones
  if (platform == "steam") {
    let checkNoAchievements = [];
    for (let i = 0; i < gamesOwned.length; i++) {
      checkNoAchievements.push(getNoAchievementGame(gamesOwned[i]));
    }

    gamesOwned = await Promise.all(checkNoAchievements).then(function (values) {
      return values.filter(function (value) {
        return typeof value !== 'undefined';
      });
    });
  }

  //ps ids needes to the api calls are different from their true id's
  if (platform == "ps") {
    let baseUrl = '';//base url to do the request
    let tempUrl = ''//temp url that will be refreshed each 5 titles
    let psPromises = [];
    let iteration = Math.trunc(gamesOwned.length / 5);;
    let remained = gamesOwned.length % 5;

    for (let i = 1; i < iteration + 1; i++) {
      psPromises.push(getPsIds(
        gamesOwned[(i * 5) - 5].gameId + "%2C" + gamesOwned[(i * 5) - 4].gameId + "%2C" + gamesOwned[(i * 5) - 3].gameId + "%2C" + gamesOwned[(i * 5) - 2].gameId + "%2C" + gamesOwned[(i * 5) - 1].gameId
      ));
    }

    if (remained > 0) {
      if (remained == 1) {
        psPromises.push(gamesOwned[(((iteration + 1) * 5) - 5)].gameId);
      } else {
        let temp = '';
        for (let i = 1; i < remained + 1; i++) {
          temp = temp + gamesOwned[(((iteration + 1) * 5) - 1) - (5 - I)].gameId + "%2C";
        }
        temp = temp.substring(0, (temp.length - 3));
        psPromises.push(getPsIds(temp));
      }
    }
    let auxPsIds = await Promise.all(psPromises);

    auxPsIds = auxPsIds.flat();
    for (let i = 0; i < gamesOwned.length; i++) {
      for (let j = 0; j < auxPsIds.length; j++) {
        if (gamesOwned[i].gameId == auxPsIds[j].titleId) {
          gamesOwned[i].gameId = auxPsIds[j].gameId
        }
      }
    }


    gamesOwned = gamesOwned.filter(function (obj) {
      return obj.gameId !== 0;
    });
  }

  let gamesStoredAppids = await getStoredApps(platform);

  let gamesToAdd = [];

  let match = false;

  for (let i = 0; i < gamesOwned.length; i++) {
    for (let j = 0; j < gamesStoredAppids.length; j++) {
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
  if (platform == "steam") {
    let gameTitles = await getGameTitles();
    console.log(gameTitles);
    for (let i = 0; i < gamesToAdd.length; i++) {
      for (let j = 0; j < gameTitles.length; j++) {
        if (gamesToAdd[i].gameId == gameTitles[j].appId) {
          gamesToAdd[i].name = gameTitles[j].name;
        }
      }
    }
  }

  let gamesExtraInfo;
  for (let i = 0; i < gamesToAdd.length; i++) {
    console.log("añadiendo: " + gamesToAdd[i].name);
    gamesExtraInfo = await getGamesCoverAndGenres(gamesToAdd[i].name);

    gamesToAdd[i].front = gamesExtraInfo[0];
    gamesToAdd[i].genres = JSON.stringify(gamesExtraInfo[1]);
    await delay(500);
  }

  gamesData = [];

  ownedGamesData = [];

  for (let i = 0; i < gamesToAdd.length; i++) {
    gamesData.push([
      gamesToAdd[i].gameId,
      gamesToAdd[i].name,
      gamesToAdd[i].genres,
      platform,
      gamesToAdd[i].front
    ]);
  }

  if (gamesToAdd.length > 0) { await addGames(gamesData); }


  for (let i = 0; i < gamesOwned.length; i++) {
    ownedGamesData.push([
      userid,
      gamesOwned[i].gameId,
      gamesOwned[i].timeplayed,
      0
    ]);
  }

  await addOrUpdateGamesOwned(ownedGamesData);

  let gamesCompleted = await getUserCompletedGames(userid);

  match = false;

  let removalIndexes = [];

  if (gamesCompleted != null) {
    for (let i = 0; i < ownedGamesData.length; i++) {
      for (let j = 0; j < gamesCompleted.length; j++) {
        if (ownedGamesData[i].gameId == gamesCompleted[j].gameId) {
          removalIndexes.push(i);
        }
      }
    }
  }

  for (let i = removalIndexes.length - 1; i >= 0; i--) {
    ownedGamesData.splice(removalIndexes[i], 1);
  }
  let achievementsPromises = [];
  for (let i = 0; i < ownedGamesData.length; i++) {
    achievementsPromises.push(getUnlockedAchievementsForGameId(userid, ownedGamesData[i][1], platform));
  }
  let achievements = await Promise.all(achievementsPromises).then(function (values) {
    return values.filter(function (value) {
      return typeof value !== 'undefined';
    });
  });



  //opt get the gamesalreadycompleted and save the date 
  let achievementsToAdd = [];
  let datesToAdd = []

  for (let i = 0; i < achievements.length; i++) {
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
function getGamesCoverAndGenres(title) {
  title = title.replace(/\([^)]+\)|[^\w\d: ü\-]|(multiplayer|zombies|playable teaser|public test|test server|goty edition|goty|enhanced edition)$/gi, "")
  title = title.replace(/([:\-])/g, " $1 ")
  title = title.replace(/ {2,}/g, " ")
  title = title.replace(/^[^\w\d]*|[^\w\d]*$/g, "")
  let extraGameInfo = [];
  console.log(title);
  return new Promise((resolve, reject) => {
    request.post({
      url: 'https://api.igdb.com/v4/games',
      headers: { "Client-ID": "w9sztpgnr7iygjteswbh40n3iboa9t", "Authorization": "Bearer lapn9y1ui98jgvxosp0801pid70byk" },
      body: `search "${title}"; fields name, cover.url, genres.name, category; where category = (0,3,4,8,9,11); limit 10;`,
      json: false
    }, function (error, response, body) {
      if (response.statusCode > 399) throw ("LIMITE ALCANZADO ERROR: " + response.statusCode);
      if (error) throw error;
      body = JSON.parse(body);
      console.log(body);
      let game = body[0];
      for (let i = 0; i < body.length; i++) {
        if ((((body[i].name.toUpperCase()).replaceAll(" ", "") == (title.toUpperCase()).replaceAll(" ", "") && 'cover' in body[i] && 'genres' in body[i])) || (body[i].category == 0 && 'cover' in body[i] && 'genres' in body[i])) {
          game = body[i];
          break;
        }
      }

      game.cover.url = game.cover.url.replace("//", "https://");
      game.cover.url = game.cover.url.replace("thumb", "cover_big");
      extraGameInfo.push(game.cover.url);
      let gameGenres = [];
      if (!(game.genres === undefined)) {
        for (let i = 0; i < game.genres.length; i++) {
          gameGenres.push(game.genres[i].name);
        }
      }
      extraGameInfo.push(gameGenres);
      console.log(extraGameInfo)
      resolve(extraGameInfo);
    })
  })
}

//function/promsie that adds a user and if its already recorded it doesnt add or update anything
function addUser(userInfo) {
  console.log(userInfo);
  return new Promise((resolve, reject) => {
    let sql = 'Insert ignore into users set ?';
    connection.query(sql, userInfo, error => {
      if (error) throw error;
      console.log("usuario añadido");
      resolve();
    });
  });
}

function getGameTitles() {
  return new Promise((resolve, reject) => {
    let url = "https://api.steampowered.com/ISteamApps/GetAppList/v2/";
    request(url, function (err, res, body) {
      let response = JSON.parse(body);
      response = response.applist.apps;
      resolve(response);
    });
  });
}

//function/promise that returns the owned games for each platform in playstation case it needs to break down a string that cannot be parsed as date and in the case of xbox needs to make an additional request
function getOwnedGames(userid, platform) {
  return new Promise((resolve, reject) => {
    let urlSteam = 'https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=B180F37955BEBCD1CFA8DF8E32ECC03E&steamid=' + userid + '&include_appinfo=true&include_played_free_games=true'
    let urlXbox = 'https://achievements.xboxlive.com/users/xuid(' + userid + ')/history/titles?maxItems=1000';
    let urlPs = 'https://m.np.playstation.net/api/gamelist/v2/users/' + userid + '/titles?categories=ps4_game&limit=1000&offset=0';
    let url, headers;
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
        let gamesOwned = JSON.parse(body);

        let gamesResponseArray;
        let timePath, idPath;
        let appsarray = [];

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
        for (let i = 0; i < gamesResponseArray.length; i++) {
          if (platform != "xbox") {
            if (platform == "ps") {
              let timeplayed, seconds, hours, minutes, c = 0;
              let stringTime = '';
              stringTime = gamesResponseArray[i][timePath];
              stringTime = stringTime.slice(2, stringTime.length);
              //frist count letters
              for (let k = 0; k < stringTime.length; k++) {
                if (isNaN(stringTime[k])) {
                  c++;
                }
              }
              for (let k = 0; k < c; k++) {
                for (let j = 0; j < stringTime.length; j++) {
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
            if (!((gamesResponseArray[i][idPath] == 431960 || gamesResponseArray[i][idPath] == 1325860) && platform == "steam")) {
              appsarray.push({
                gameId: gamesResponseArray[i][idPath],
                name: gamesResponseArray[i].name,
                timeplayed: (platform == "ps") ? timeplayed : gamesResponseArray[i][timePath] / 60
              });
            }

          } else {
            appsarray.push({
              gameId: gamesResponseArray[i][idPath],
              name: gamesResponseArray[i].name
            });
          }
        }

        if (platform == "xbox") {
          let postBody = {
            "arrangebyfield": "xuid",
            "xuids": [
              userid
            ],
            "stats": [

            ]

          }
          for (let i = 0; i < appsarray.length; i++) {
            postBody["stats"].push({ "name": "MinutesPlayed", "titleId": appsarray[i].gameId });
          }
          let url = "https://userstats.xboxlive.com/batch";

          request.post({ headers: headers, uri: url, body: postBody, json: true }, function (err, response, body) {

            let parsedResponse = body;

            for (let i = 0; i < appsarray.length; i++) {
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
    let sql = 'Insert ignore into games (gameId, name, genres, platform, front) values ?';
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
    let url = 'https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/?key=B180F37955BEBCD1CFA8DF8E32ECC03E&appid=' + ownedGame.gameId;
    request(url, (err, res, body) => {
      let parsedResponse = JSON.parse(body);
      if (Object.keys(parsedResponse.game).length == 0) {
        resolve();
      } else {
        resolve(ownedGame);
      }
    });
  });
}
async function guides(response, gameId, userId, achievementId, transaction, content, guideId) {
  let status = false;
  let guides = [];
  //console.log(gameId+userId+achievementId+transaction+content);
  switch (transaction) {
    case "add":
      guideId = await addGuide(gameId, userId, achievementId, content);
      if (guideId != null) {
        status = true
        request.post({
          uri: "https://discord-bot-production-4915.up.railway.app/guides",
          body: {
            "guideId": guideId,
            "userid": userId,
            "achievementId": achievementId,
            "gameId": gameId,
            "content": content
          },
          json: true
        }, function (err, res, body) {
          if (err) throw err;
          if (body.status == 1) {
            console.log("guide sended");
          } else {
            console.log("soemthign went wrong !!!")
          }
        });
      }
      break;
    case "edit":
      status = await updateGuide(guideId, content);
      break;
    case "read":
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
  console.log(guides);
  response.send((transaction === "read" ? guides : { "status": status }));
}

function addGuide(gameId, userId, achievementId, content) {
  return new Promise((resolve, reject) => {
    let sql = 'insert into achievementGuides (gameId, userId, achievementId, content, date) VALUES (?) ON DUPLICATE KEY update content = VALUES(content), date = VALUES(date), public=0 ';
    let array = [gameId, userId, achievementId, content, Math.floor(Date.now() / 1000)];
    connection.query(sql, [array], (error, result) => {
      if (error) {
        console.log(error);
        resolve(null);
      } else {
        resolve(result.insertId);
      }
    });
  });
}

function updateGuide(guideId, content) {
  return new Promise((resolve, reject) => {
    let sql = 'update achievementGuides set content = "' + content + '", public=0 , date = ' + Math.floor(Date.now() / 1000) + ' where guideId = ' + guideId;
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
    let sql = 'select achievementGuides.guideId, achievementGuides.gameId, achievementGuides.content, achievementGuides.votes, achievementGuides.date, users.name, users.avatar, users.userId from achievementGuides INNER JOIN users ON achievementGuides.userId = users.userId AND  achievementGuides.gameId = "' + gameId + '"   AND achievementGuides.achievementId = "' + achievementId + '" AND achievementGuides.public = 1;';
    console.log(sql);
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
    let sql = 'delete from achievementGuides where guideId=' + guideId;
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
    let sql = 'update achievementGuides set public = 1 where guideId=' + guideId;
    connection.query(sql, (error, result) => {
      if (error) {
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

async function threads(response, userId, threadId, transaction, issue, title, content, file, media) {
  console.log("hererhere")
  let status = false;
  switch (transaction) {
    case "create":
      if (file != "NULL") {
        const split = file.originalname.split(".");
        const storageRef = ref(storage, split[0] + "-" + Date.now() + "." + split[split.length - 1]);
        const metadata = {};
        await uploadBytes(storageRef, file.buffer, metadata);
        const mediaPath = await getDownloadURL(storageRef);
        mediaURL = mediaPath;
        mediaURL = mediaURL.replace("\\", "\\\\");
        threadId = await addThread(userId, issue, title, content, mediaURL);
      } else {
        mediaURL = null
        threadId = await addThread(userId, issue, title, content, null);
      }

      try {
        if (threadId != null) {
          status = true
          request.post({
            uri: "https://discord-bot-production-4915.up.railway.app/threads",
            body: {
              "threadId": threadId,
              "userid": userId,
              "title": title,
              "issue": issue,
              "content": content,
              "media": mediaURL
            },
            json: true
          }, function (err, res, body) {
            if (err) throw err;
            if (body.status == 1) {
              console.log("thread sended sended");
            } else {
              console.log("soemthign went wrong !!!")
              console.log(body);
            }
          });
        }
      } catch (error) {
        console.log(error);
      }
      //send bot request to handle the thread by a mod
      break;

    case "respond":
      //this is the path the bot will take to respond a thread
      status = await addThreadResponse(threadId, content);
      break;

    case "readAll":
      let threads = [];
      threads = await readAllThreads(userId);
      console.log(threads);
      response.send(threads);
      break;

  }
  try {
    if (transaction != "getMedia") {
      response.send(status);
    }
  } catch (error) {
    console.log("erorr with this transaction: " + transaction)
    console.log(error);
  }
}

function addThread(userId, issue, title, content, media) {
  return new Promise((resolve, reject) => {
    let sql = 'insert into thread (userId, issue,title, content, media) VALUES (?)';
    let array = [userId, issue, title, content, media];
    connection.query(sql, [array], (error, result) => {
      if (error) {
        console.log(error);
        resolve(null);
      } else {
        resolve(result.insertId);
      }
    });
  });
}

function addThreadResponse(threadId, content) {
  return new Promise((resolve, reject) => {
    let sql = 'insert into threadResponse (threadId, content) VALUES (?)';
    let array = [threadId, content];
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

    let sql = 'select thread.threadId, thread.issue, thread.title, thread.content, thread.media, threadresponse.content as response from thread LEFT JOIN threadresponse ON thread.threadId=threadresponse.threadId where thread.userId = "' + userId + '" ';
    console.log(sql);
    connection.query(sql, (error, result) => {
      if (error) {
        resolve();
        throw error

      } else {
        resolve(result);
      }
    });
  });
}

function readThread(threadId) {
  return new Promise((resolve, reject) => {
    let sql = 'select * from thread where threadId = "' + threadId + '"';
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
    let sql = 'select * from threadResponse where threadId = "' + threadId + '"';
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
  let status = false;
  console.log("doing: " + transaction)
  switch (transaction) {
    case "add":
      roadId = await addRoad(userId, gameId, JSON.stringify(steps), spoilers);
      if (roadId != null) {

        status = true
        request.post({
          uri: "http://discord-bot-production-4915.up.railway.app/roads",
          body: {
            "roadId": roadId,
            "userid": userId,
            "gameId": gameId,
            "spoilers": spoilers,
            "roadSteps": steps
          },
          json: true
        }, function (err, res, body) {
          if (err) throw err;
          if (body.status == 1) {
            console.log("road sended");
          } else {
            console.log("soemthign went wrong !!!")
          }
        });
      }
      break;
    case "edit":
      status = await editRoad(roadId, JSON.stringify(steps), spoilers);
      break;
    case "delete":
      status = await deleteRoad(roadId);
      break;
    case "readAll":
      let roads = [];
      roads = await readAllRoads(gameId);
      status = true;
      res.send(roads);
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
    let sql = 'insert into road (userId, gameId, roadSteps, spoilers , date) values (?) on duplicate key update roadSteps=VALUES(roadSteps), date = VALUES(date), spoilers = VALUES(spoilers), public=0';
    let array = [userId, gameId, roadSteps, +spoilers, Math.floor(Date.now() / 1000)];
    connection.query(sql, [array], (error, result) => {
      if (error) throw (error)
      resolve(result.insertId);

    });
  });
}

function editRoad(roadId, content, spoilers) {
  return new Promise((resolve, reject) => {
    let sql = 'update road set roadSteps = ?, spoilers = ' + +spoilers + ' where roadId = ' + roadId;
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
    let sql = 'delete from road where roadId = ' + roadId;
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
    let sql = 'update road set public = 1 where roadId = ' + roadId;
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
    let sql = 'insert into userroad (userId, roadId, rate) values (?) on duplicate Key update rate = VALUES(rate)';
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
    let sql = 'select r.*, g.name, g.front, u.avatar, u.name as userName from road r join games g on r.gameId = g.gameId join users u ON r.userId = u.userId where r.gameId = "' + gameId + '" and public = 1 order by rate DESC';
    connection.query(sql, (error, result) => {
      if (error) throw error

      console.log(result)
      resolve(result);

    });
  });
}

function readRelevantRoad(gameId) {
  return new Promise((resolve, reject) => {
    let sql = 'select r*, g.name, g.cover from road r join game g on r.gameId = g.gameIdwhere t.gameId = "' + gameId + '" ordered by rate DESC LIMIT 1';
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

app.get("/price/:title", async (req, res) => {
 
  const title = req.params.title;
   ("Getting price for : "+ title)
  const platform = req.get('platform')
  const prices = getPrices(title)
})

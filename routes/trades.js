const express = require('express');
let bodyParser = require('body-parser');
const router = express.Router();
const { checkIfBan, checkIfBanAppeal } = require("../utils/checkIfBan");

const request = require('request');
const multer = require('multer');
const { uploadBytes, ref, getDownloadURL } = require('firebase/storage')

module.exports = (connection, storage) => {
  const uploadTrade = multer({ storage: multer.memoryStorage() });
  router.post('/:transaction', bodyParser.json(), uploadTrade.single('validation'), async (req, res) => {
    console.log(req.body);
    let transaction = req.params.transaction;
    let userId = req.get("userId");
    let gameId = req.get("gameId");
    let tradeId = req.get("tradeId");
    let status;
    let ban, banAppeal;
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
        ban = await checkIfBan(userId);
        banAppeal = await checkIfBanAppeal(userId);
        if (banAppeal) {
          res.status(401).end();
          return;
        }
        if (ban) {
          res.status(403).end();
          return;
        }
        if (!(await checkIfGamesExists([req.body.gameId]))) {
          res.status(406).end();
          return;
        }

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
        ban = await checkIfBan(userId);
        banAppeal = await checkIfBanAppeal(userId);
        if (banAppeal) {
          res.status(401).end();
          return;
        }
        if (ban) {
          res.status(403).end();
          return;
        }
        let gamesToCkeck = [];
        gamesToCkeck.push(req.body.gameId);
        if (req.body.interestedGameId1 !== "" && req.body.interestedGameId1 != undefined && req.body.interestedGameId1 != "null") {
          gamesToCkeck.push(req.body.interestedGameId1)
        }
        if (req.body.interestedGameId2 !== "" && req.body.interestedGameId2 != undefined && req.body.interestedGameId2 != "null") {
          gamesToCkeck.push(req.body.interestedGameId2)
        }
        if (req.body.interestedGameId3 !== "" && req.body.interestedGameId3 != undefined && req.body.interestedGameId3 != "null") {
          gamesToCkeck.push(req.body.interestedGameId3)
        }
        if (!(await checkIfGamesExists(gamesToCkeck))) {
          res.status(406).end();
          return;
        }

        console.log(req.body);
        if (req.file === undefined) { //no file to storage
          req.body.media = "NULL";
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
        }
       

        status = await addTrade(req.body);

        res.send(status);
        break;

      //adds a rate to a succesfull trade
      //requires: userId(who rates), destinedUser(user who get rated)
      case "rate":
        ban = await checkIfBan(userId);
        banAppeal = await checkIfBanAppeal(userId);
        if (banAppeal) {
          res.status(401).end();
          return;
        }
        if (ban) {
          res.status(403).end();
          return;
        }
        console.log("user " + userId + "added " + req.body.rate + "of rate to the trade " + tradeId)
        status = await addRate(tradeId, userId, req.body.rate);
        res.send(status);
        break;

      //accept or decline trade, just adds the destinedTrade
      //required: tradeId(the id of the trade which has the offer), offerId(the id of the trade offered)
      case "tradeTransaction":
        ban = await checkIfBan(userId);
        banAppeal = await checkIfBanAppeal(userId);
        if (banAppeal) {
          res.status(401).end();
          return;
        }
        if (ban) {
          res.status(403).end();
          return;
        }
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
      let sql, sql1, sql2;
      console.log("transactioon: " + tradeTransaction);
      if (tradeTransaction === "1") {//accept
        sql = `UPDATE trade SET acceptedId = ${destinedId}, public = 0 WHERE tradeId = ${tradeId};`;
        sql1 = `UPDATE trade SET acceptedId = ${tradeId} WHERE tradeId = ${destinedId};`;
        sql2 = `delete from trade where destinedId =${tradeId} and tradeId!=${destinedId} `
      } else {//decline
        sql = `delete FROM trade where tradeId=${destinedId}`;
      }
      console.log(sql);
      connection.query(sql, (err) => {
        if (err) { throw err; }
        if (sql1 != undefined) {
          connection.query(sql1, (err1) => {
            if (err1) { throw err1 }
            connection.query(sql2, (err2)=>{
              if (err2) throw err2;
              resolve(true);
            })
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


  function checkIfGamesExists(gamesIds) {
    return new Promise((resolve, reject) => {
      const sql = "select * from games WHERE gameId IN(?)"
      connection.query(sql,[gamesIds], (err, result) => {
        if (err) throw err;
        if (gamesIds.length == result.length) {
          resolve(true);
        } else {
          resolve(false);
        }
      })
    })
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
  return router;
}
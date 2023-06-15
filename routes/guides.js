const express = require('express');
let bodyParser = require('body-parser');
const router = express.Router();
const { checkIfBan, checkIfBanAppeal } = require("../utils/checkIfBan");
const request = require('request');


module.exports = (connection) => {

  router.post('/:transaction', bodyParser.json(), function (req, res) {
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

  async function guides(response, gameId, userId, achievementId, transaction, content, guideId) {
    let status = false;
    let guides = [];
    //console.log(gameId+userId+achievementId+transaction+content);
    switch (transaction) {
      case "add":
        const ban = await checkIfBan(userId);
        const banAppeal = await checkIfBanAppeal(userId);
        if (banAppeal) {
          response.status(401).end();
          return;
        }
        if (ban) {
          response.status(403).end();
          return;
        }

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
      console.log("Adding guide for ahcievement: " + achievementId)
      let sql = 'insert into achievementguides (gameId, userId, achievementId, content, date) VALUES (?) ON DUPLICATE KEY update content = VALUES(content), date = VALUES(date), public=0 ';
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
      let sql = 'update achievementguides set content = "' + content + '", public=0 , date = ' + Math.floor(Date.now() / 1000) + ' where guideId = ' + guideId;
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
      let sql = 'select achievementguides.guideId, achievementguides.gameId, achievementguides.content, achievementguides.votes, achievementguides.date, users.name, users.avatar, users.userId from achievementguides INNER JOIN users ON achievementguides.userId = users.userId AND  achievementguides.gameId = "' + gameId + '"   AND achievementguides.achievementId = "' + achievementId + '" AND achievementguides.public = 1;';
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
      let sql = 'delete from achievementguides where guideId=' + guideId;
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
      let sql = 'update achievementguides set public = 1 where guideId=' + guideId;
      connection.query(sql, (error, result) => {
        if (error) {
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }

  return router
}
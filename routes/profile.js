const express = require('express');
let bodyParser = require('body-parser');
const router = express.Router();
const request = require('request');
const {uploadUserStats} = require('../utils/uploadUserStats');

module.exports = (connection)=>{
    router.get("/:transaction", async function (req, res) {
        let transaction = req.params.transaction;
        let userId = req.get("userId");
        let platform = req.get("platform");
        let language = req.get("language");
        let sql;
      
        let status = await checkUserExitance(userId);
        console.log(status)
        if (status !== true) {
          res.send(status);
          try {
            await uploadUserStats(userId, platform);
          } catch (err) {
            throw err;
          }
        } 
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
            sql = 'select achievementguides.guideId, achievementguides.gameId, achievementguides.content, achievementguides.votes, achievementguides.date, users.name, users.avatar, users.userId from achievementguides INNER JOIN users ON achievementguides.userId = users.userId AND   achievementguides.userId = "' + userId + '" AND achievementguides.public = 1;'
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
    return router;
}
const express = require('express');
let bodyParser = require('body-parser');
const { checkIfBan, checkIfBanAppeal } = require("../utils/checkIfBan");

let xblHeaders = {
  'X-Contract': '2',
  'X-Authorization': 'kos4gk0cwgowc84o8c88cg8sgs8c8gsk0oc'
}
const router = express.Router();
const request = require('request');
const { uploadUserStats } = require('../utils/uploadUserStats');
const psHeaders = require('../utils/psHeaders');

module.exports = (connection) => {
  router.get("/:transaction", async function (req, res) {
    let transaction = req.params.transaction;
    let userId = req.get("userId");
    let platform = req.get("platform");
    let language = req.get("language");
    let sql;

    let status = await checkUserExitance(userId);
    console.log(status)
    if (status !== true) {
      
      const ban = await checkIfBan(userId);
      const banAppeal = await checkIfBanAppeal(userId);
      if (banAppeal) {
        res.status(401).end();
        return;
      }
      if (ban) {
        res.status(403).end();
        return;
      }
      
      try {
        res.send(status);
        await uploadUserStats(userId, platform);
        return;
      } catch (err) {
        throw err;
        return;

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
  function getAchievementsForGameId(gameId, platform, language) {
    return new Promise((resolve, reject) => {
      let urlSteam = 'https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/?key=B180F37955BEBCD1CFA8DF8E32ECC03E&appid=' + gameId + "&l=" + language;
      let urlXbox = 'https://xbl.io/api/v2/achievements/title/' + gameId;
      let urlPs = "https://m.np.playstation.com/api/trophy/v1/npCommunicationIds/" + gameId + "/trophyGroups/all/trophies?npServiceName=trophy";
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
      console.log(body);
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

  function getRatity(gameId) {
    return new Promise((resolve, reject) => {
      let sql = "SELECT DISTINCT achievementId, rarity FROM achievements WHERE gameId=?";
      connection.query(sql, gameId, (error, result) => {
        if (error) throw error;
        resolve(result);
      });
    });
  }
  return router;
}
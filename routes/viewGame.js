const express = require('express');
let bodyParser = require('body-parser');
const router = express.Router();
const request = require('request');
const {getPrices} = require('../utils/getPrices');
const psHeaders = require('../utils/psHeaders');
let xblHeaders = {
    'X-Contract': '2',
    'X-Authorization': 'kos4gk0cwgowc84o8c88cg8sgs8c8gsk0oc'
  }

module.exports = (connection) => {

  router.get("/", function (req,res){
    console.log("gameview root");
  });
    router.get('/:gameid', function (req, res) {
      console.log("gameview  gameId entered");
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

      function getAchievementTags(gameId) {
        return (new Promise((resolve, reject) => {
          const sql = 'select count(userId), achievementId, tag from tags where gameId="' + gameId + '" group by achievementId, tag';
          connection.query(sql, function (err, result) {
            if (err) throw err;
            resolve(result);
          })
      
        }))
      }
      
    return router;
}
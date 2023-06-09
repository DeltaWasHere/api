const request = require('request')
const connection = require('./connection');
const {addGames} = require('./addGames');
const {getGamesCoverAndGenres} = require('./gameCoversAndGenres');
const psHeaders = require("../utils/psHeaders");
const xboxHeaders = require("./xboxHeaders");

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
                    temp = temp + gamesOwned[(((iteration + 1) * 5) - 1) - (5 - i)].gameId + "%2C";
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

//function to get the user avatar id and name
function getUserInfo(userid, platform) {
    return new Promise((resolve, reject) => {
      let xboxUrl = "https://profile.xboxlive.com/users/batch/profile/settings";
      let psUrl = 'https://m.np.playstation.com/api/userProfile/v1/internal/users/' + userid + "/profiles";
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
          let aux = parseResponse.profileUsers[0].settings[1].value;
          for (let i = 0; i < aux.length; i++) {
            if (aux[i] == "&") {
              aux = aux.substring(0, i);
              break;
            }
          }
          aux = aux + "&format=png"
          userInfo['userId'] = userid;
          userInfo['name'] = parseResponse.profileUsers[0].settings[0].value;
          userInfo['avatar'] = aux;
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

  function delay(time) {
    return new Promise(function (resolve) {
      setTimeout(resolve, time)
    });
  }
  //function/promise that returns the owned games for each platform in playstation case it needs to break down a string that cannot be parsed as date and in the case of xbox needs to make an additional request
function getOwnedGames(userid, platform) {
    return new Promise((resolve, reject) => {
      let urlSteam = 'https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=B180F37955BEBCD1CFA8DF8E32ECC03E&steamid=' + userid + '&include_appinfo=true&include_played_free_games=true'
      let urlXbox = 'https://achievements.xboxlive.com/users/xuid(' + userid + ')/history/titles?maxItems=1000';
      let urlPs = 'https://m.np.playstation.com/api/gamelist/v2/users/' + userid + '/titles?categories=ps4_game&limit=200&offset=0';
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
              let timeplayed;
              if (platform == "ps") {
                let  seconds, hours, minutes, c = 0;
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
                console.log(timeplayed);
  
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
                appsarray[i].timeplayed = (parseFloat(parseInt(parsedResponse.statlistscollection[0].stats[i].value)).toFixed(1)) / 60;
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
  function getUnlockedAchievementsForGameId(userId, gameId, platform) {
    //create promise
    //attributes that i will need are 
    return new Promise((resolve, reject) => {
      //urls for quering
      let urlPs = "https://m.np.playstation.com/api/trophy/v1/users/" + userId + "/npCommunicationIds/" + gameId + "/trophyGroups/all/trophies?npServiceName=trophy"
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
  
  
module.exports = {
    uploadUserStats
}
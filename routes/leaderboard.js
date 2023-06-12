const express = require('express');
let bodyParser = require('body-parser');
const router = express.Router();
const request = require('request');

module.exports = (connection)=>{
    router.get("/:type", async (req, res) => {
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
      
        let sql = ["SELECT users.avatar, users.name, achievements.dateAchieved as score FROM achievements INNER JOIN users ON achievements.userId = users.userId WHERE achievements.achievementId = '" + achievementId + "' AND achievements.gameId = '"+gameId+"'ORDER BY achievements.dateAchieved ASC",
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
    return router;
}
const connection = require("./connection");
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
  module.exports= {
    addGames
  }
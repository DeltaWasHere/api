const request = require('request');

function getGamesCoverAndGenres(title) {
    title = title.replace(/\([^)]+\)|[^\w\d: ü\-]|(multiplayer|zombies|playable teaser|public test|test server|goty edition|goty|enhanced edition|: End of Dream| - Season 4| Series| : Ultimate Knockout|Mod: Defence Alliance 2)$/gi, "")
    title = title.replace(/([:\-])/g, " $1 ")
    title = title.replace(/ {2,}/g, " ")
    title = title.replace(/^[^\w\d]*|[^\w\d]*$/g, "")
    title = title.replace("Ragnark", "Ragnarok")
    title = title.replace ("Persona5", "Persona 5");
    title = title.replace("Fall Guys : Ultimate Knockout", "Fall Guys")
    let extraGameInfo = [];
    console.log(title);
    return new Promise((resolve, reject) => {
      request.post({
        url: 'https://api.igdb.com/v4/games',
        headers: { "Client-ID": "w9sztpgnr7iygjteswbh40n3iboa9t", "Authorization": "Bearer lapn9y1ui98jgvxosp0801pid70byk" },
        body: `search "${title}"; fields name, cover.url, genres.name, category; where category = (0,3,4,8,9,11, 10); limit 10;`,
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

  module.exports = {
    getGamesCoverAndGenres
  }
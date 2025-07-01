This API is part of the backend for my Technician Career which featured a 700 pages of documentation (document is private; PM me if you want to see it).
Refer here for the [web app](https://github.com/DeltaWasHere/web-app), [desktop app](https://github.com/DeltaWasHere/desktop-app), [android app](https://github.com/DeltaWasHere/grad-mobile-app) and [discord bot](https://github.com/DeltaWasHere/discord-bot)

The API revolves around fetching achievements and game data from Steam, Xbox, and PlayStation, as well as permitting users to upload achievement guides, leaderboards with points based on rarity, catalog achievements with tags, etc.

# $\color{red}{\textsf{By no means is this project perfect; in fact, there are several bad practices and improvements that could have been made.}}$	

## War crime level mistakes
### API keys are hardcoded instead of being stored in an .env file:
`
let urlSteam = 'https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/?key=B180F37955BEBCD1CFA8DF8E32ECC03E&appid=' + gameId + "&l=" + language;
`
Of course these API keys are no longer working, this was a huge rookie mistake

### The lack of prepared statements could lead to SQL injection:
`
let sql = 'select * from achievements where gameId="' + gameId + '" and userId ="' + userId + '"';
`
Some routes use interpolation instead of prepared statements.

## Bad practices mistakes: 
### Lack of REST principles in some routes:
`
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
        //this is the option that the bot will do to publish guides approved by the moderators
        status = await publishGuide(guideId);
`
Some routes take a URL parameter that is then passed to a switch; this should be decoupled into different routes using their corresponding methods.

### The code is not fully decoupled into their respective files: 
By this, I mean that there are files containing methods that shouldn't be there and should be separated into their own module/file. This respects the SOLID principle of dependency and provides a hierarchical structure

## Scalability and Technical:
### TypeScript should be the way:
![image](https://github.com/user-attachments/assets/464a2dab-361d-45c1-86de-edc348dac7eb)

TypeScript could have helped prevent the use of magic strings or properties and provided a more robust structure for the models.

### Horizontal and microservices: 
Node runs as a single-threaded application; therefore, we cannot block the thread it uses, and scaling with raw CPU speed would eventually hit a ceiling. Instead, heavy services like Web Scraping and the achievements rarity calculator should be in their own application. Finally, a load balancer should be implemented to distribute traffic between different instances of the main API and the Web Scraping service. Of course, this only applies if we need to scale the application to handle a large amount of users.

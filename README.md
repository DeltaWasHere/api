![image](https://github.com/user-attachments/assets/6783d648-a1e1-47d1-9955-9b896d45004a)
This API is part of the backend for my Technician Career which featured a 700 pages of documentation(document is in private, pm me if you want to see it).

The API revolved around fetching achievements and games data from the Steam, Xbox and PS as well as well as permit the users upload guides for achievements, leaderboards with points according to the rarity of an achievenets, catalog acheivements with tags, etc. 

$\color{red}{\textsf{By no means this project is perfect, in fact there are several bad practices and improvements that could've been made.}}$	

War crime level mistakes
-API keys are inlined rather than in an .env file:
`
let urlSteam = 'https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/?key=B180F37955BEBCD1CFA8DF8E32ECC03E&appid=' + gameId + "&l=" + language;
`
Of curse thise API keys are no longer working, this was a huge noob mistake

-No use of prepared statements could lead to SQL Inyection:
`
let sql = 'select * from achievements where gameId="' + gameId + '" and userId ="' + userId + '"';
`
There are some routes where instead of prepared staements they use interpolation.

Bad practices mistakes: 
-Lack of REST principles on some routes:
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
        //this is the option that the bot will do to publish guides aproved by the moderators
        status = await publishGuide(guideId);
`
Some routes take a url parameter that then os being passed to a swtich, this should be decoupled into different routes using their corresponding methods.

-The code is not decoupled in their respective files entirely: by this I mean that there are files that contain methods that shouln'd be there and be separated into their own module/file, with this we respect the solid principle o depdenency and give them a hierarchical structure

Scalability and technical:


-Typescript should be the way:
![image](https://github.com/user-attachments/assets/464a2dab-361d-45c1-86de-edc348dac7eb)
Typescript could've helped a lot to prevent the usage of magic strings or properties and have a more robust structure of the models.


-Horizontal and microservices: Node runs as an STA, therefore, we cannot block the thread it uses and scaling into raw CPU speed would eventually hit the roof. Instead of that, heavy services like the Web Scrap and the acheivements rarity calculator should be in their own application. Finally, a load balancer should be implemented to distribute the traffic between different instances of the main API and the Web Scrapp service. Of curse, this is only applies if we need to scale the application with a large ammount of users



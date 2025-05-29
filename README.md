
This API is part of the backend for my Technician Career which featured a 700 pages of documentation.

The API revolved around fetching achievements and games data from the Steam, Xbox and PS as well as well as permit the users upload guides for achievements, leaderboards with points according to the rarity of an achievenets, catalog acheivements with tags, etc. 

$\Huge{\textsf{By no means this project is perfect, in fact there are several bad practices and improvements that could've been made.
}}$	

War crime level mistakes
-API keys are inlined rather than in an .env file

Of curse thise API keys are no longer working, this was a huge noob mistake

-No use of prepared statements could lead to SQL Inyection:

There are some routes where instead of prepared staements 

Bad practices mistakes: 
-Lack of REST principles on some routes:

Some routes take a url parameter that then os being passed to a swtich, this should be decoupled into different routes using their corresponding methods
-The code is not decoupled in their respective files entirely: by this I mean that there are files that contain methods that shouln'd be there and be separated into their own module/file, with this we respect the solid principle o depdenency and give them a hierarchical structure

Scalability and technical:
-Typescript should be the way:

Typescript could've helped a lot to prevent the usage of magic strings or properties and have a more robust structure of the models.
-Horizontal and microservices:

Node runs as an STA, therefore, we cannot block the thread that it uses and scaling into raw CPU speed would eventually hit the roof. Instead of that heavy services like the Web Scrap and the acheivements rarity calculator should be in their own application. Also, a load balancer should be implemented to distribute the traffic between different instances of the main API and the Web Scrapp service.



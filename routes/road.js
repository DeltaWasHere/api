const express = require('express');
let bodyParser = require('body-parser');
const router = express.Router();
const request = require('request');
const { checkIfBan, checkIfBanAppeal } = require("../utils/checkIfBan");


module.exports = (connection) => {
    router.post('/:transaction', bodyParser.json(), function (req, res) {
        const transaction = req.params.transaction;
        const gameId = req.get('gameId');
        const userId = req.get('userId');
        const roadId = req.get('roadId');
        const rate = parseInt(req.get('rate'));
        let spoilers = req.get('spoilers');
        spoilers = (spoilers == "true") ? true : false;
        const steps = req.body.roadSteps;
        console.log(req.body);
        console.log(userId);
        road(res, transaction, gameId, userId, roadId, steps, spoilers, rate);

    });

    async function road(res, transaction, gameId, userId, roadId, steps, spoilers, rate) {
        let status = false;
        let ban, banAppeal;
        console.log("doing: " + transaction)
        switch (transaction) {
            case "add":
                ban = await checkIfBan(userId);
                banAppeal = await checkIfBanAppeal(userId);
                if (banAppeal) {
                    res.status(401)
                }
                if (ban) {
                    res.status(403)
                }


                roadId = await addRoad(userId, gameId, JSON.stringify(steps), spoilers);
                if (roadId != null) {

                    status = true
                    request.post({
                        uri: "https://discord-bot-production-4915.up.railway.app/roads",
                        body: {
                            "roadId": roadId,
                            "userid": userId,
                            "gameId": gameId,
                            "spoilers": spoilers,
                            "roadSteps": steps
                        },
                        json: true
                    }, function (err, res, body) {
                        if (err) throw err;

                        if (body.status == 1) {
                            console.log("road sended");
                        } else {
                            console.log("soemthign went wrong !!!")
                        }
                    });
                }
                break;
            case "edit":
                status = await editRoad(roadId, JSON.stringify(steps), spoilers);
                break;
            case "delete":
                status = await deleteRoad(roadId);
                break;
            case "readAll":
                let roads = [];
                roads = await readAllRoads(gameId);
                status = true;
                res.send(roads);
                break;
            case "read":
                //multiple roads single
                break;
            case "rate":
                ban = await checkIfBan(userId);
                banAppeal = await checkIfBanAppeal(userId);
                if (banAppeal) {
                    res.status(401)
                }
                if (ban) {
                    res.status(403)
                }


                status = await rateRoad(userId, roadId, rate);
                break;
            case "publish":
                status = await publishRoad(roadId);
                break;
            case "readRelevant":
                let roadsRelevant = [];
                roadsRelevant = await readRelevantRoads(userId);
                res.send(roadsRelevant);
                break;
        }
        try {
            res.send({ status: status });
        } catch {
            console.log("lmao");
        }
    }

    function addRoad(userId, gameId, roadSteps, spoilers) {
        return new Promise((resolve, reject) => {
            let sql = 'insert into road (userId, gameId, roadSteps, spoilers , date) values (?) on duplicate key update roadSteps=VALUES(roadSteps), date = VALUES(date), spoilers = VALUES(spoilers), public=0';
            let array = [userId, gameId, roadSteps, +spoilers, Math.floor(Date.now() / 1000)];
            connection.query(sql, [array], (error, result) => {
                if (error) throw (error)
                resolve(result.insertId);

            });
        });
    }

    function editRoad(roadId, content, spoilers) {
        return new Promise((resolve, reject) => {
            let sql = 'update road set roadSteps = ?, spoilers = ' + +spoilers + ' where roadId = ' + roadId;
            connection.query(sql, content, (error, result) => {
                if (error) {
                    console.log(error);
                    resolve(false);
                } else {
                    resolve(true);
                }
            });
        });
    }

    function deleteRoad(roadId) {
        return new Promise((resolve, reject) => {
            let sql = 'delete from road where roadId = ' + roadId;
            connection.query(sql, (error, result) => {
                if (error) {
                    console.log(error);
                    resolve(false);
                } else {
                    resolve(true);
                }
            });
        });
    }

    function publishRoad(roadId) {
        return new Promise((resolve, reject) => {
            let sql = 'update road set public = 1 where roadId = ' + roadId;
            connection.query(sql, (error, result) => {
                if (error) {
                    console.log(error);
                    resolve(false);
                } else {
                    resolve(true);
                }
            });
        });
    }

    function rateRoad(userId, roadId, rate) {
        return new Promise((resolve, reject) => {
            let sql = 'insert into userroad (userId, roadId, rate) values (?) on duplicate Key update rate = VALUES(rate)';
            connection.query(sql, [[userId, roadId, rate]], (error, result) => {
                if (error) {
                    console.log(error);
                    resolve(false);
                } else {
                    resolve(true);
                }
            });
        });
    }

    function readAllRoads(gameId) {
        return new Promise((resolve, reject) => {
            let sql = 'select r.*, g.name, g.front, u.avatar, u.name as userName from road r join games g on r.gameId = g.gameId join users u ON r.userId = u.userId where r.gameId = "' + gameId + '" and public = 1 order by rate DESC';
            connection.query(sql, (error, result) => {
                if (error) throw error

                console.log(result)
                resolve(result);

            });
        });
    }

    function readRelevantRoads(userId) {
        return new Promise((resolve, reject) => {
            console.log(userId);
            const sql1 = `select gameId from usersgame where userId = ? and completedDate is null`;

            connection.query(sql1, [userId], (error, result) => {
                if (error) throw error;
                console.log(result);
                const aux = result.map((value) => value.gameId);
                const sql2 = `select r.*, g.name, g.front from road r join games g on r.gameId = g.gameId where r.gameId in (?) GROUP BY r.gameId ORDER BY r.rate DESC LIMIT 1`;
                const query = connection.format(sql2, [aux]);
                console.log(query); // Print the formatted SQL query
                connection.query(sql2, [aux], (error, result2) => {
                    if (error) throw error;
                    resolve(result2);
                });
            });
        });
    }

    return router
};

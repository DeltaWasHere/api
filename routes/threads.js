const express = require('express');
let bodyParser = require('body-parser');
const router = express.Router();
const request = require('request');
const multer = require ('multer');
const { uploadBytes, ref, getDownloadURL } = require('firebase/storage')




module.exports = (connection, storage) =>{
    const uploadThread = multer({ storage: multer.memoryStorage() });
    router.post("/:transaction", bodyParser.json(), uploadThread.single('validation'), async function (req, res) {
        console.log("a")
        console.log(req.body);
        const transaction = req.params.transaction;
        const userId = req.get('userId');
        const threadId = req.get('threadId') || req.query.threadId;
        const issue = req.body && req.body.issue ? req.body.issue : "";
        const media = null;
        const title = req.body && req.body.title ? req.body.title : "";
        const content = req.body && req.body.content ? req.body.content : "";
        let file;
        if (req.file === undefined) {
          file = "NULL";
        } else {
          file = req.file;
      
        }
      
        threads(res, userId, threadId, transaction, issue, title, content, file, media);
      });

      async function threads(response, userId, threadId, transaction, issue, title, content, file, media) {
        console.log("hererhere")
        let status = false;
        switch (transaction) {
          case "create":
            if (file != "NULL") {
              const split = file.originalname.split(".");
              const storageRef = ref(storage, split[0] + "-" + Date.now() + "." + split[split.length - 1]);
              const metadata = {};
              await uploadBytes(storageRef, file.buffer, metadata);
              const mediaPath = await getDownloadURL(storageRef);
              mediaURL = mediaPath;
              mediaURL = mediaURL.replace("\\", "\\\\");
              threadId = await addThread(userId, issue, title, content, mediaURL);
            } else {
              mediaURL = null
              threadId = await addThread(userId, issue, title, content, null);
            }
      
            try {
              if (threadId != null) {
                status = true
                request.post({
                  uri: "https://discord-bot-production-4915.up.railway.app/threads",
                  body: {
                    "threadId": threadId,
                    "userid": userId,
                    "title": title,
                    "issue": issue,
                    "content": content,
                    "media": mediaURL
                  },
                  json: true
                }, function (err, res, body) {
                  if (err) throw err;
                  if (body.status == 1) {
                    console.log("thread sended sended");
                  } else {
                    console.log("soemthign went wrong !!!")
                    console.log(body);
                  }
                });
              }
            } catch (error) {
              console.log(error);
            }
            //send bot request to handle the thread by a mod
            break;
      
          case "respond":
            //this is the path the bot will take to respond a thread
            status = await addThreadResponse(threadId, content);
            break;
      
          case "readAll":
            let threads = [];
            threads = await readAllThreads(userId);
            console.log(threads);
            response.send(threads);
            break;
      
        }
        try {
          if (transaction != "getMedia") {
            response.send(status);
          }
        } catch (error) {
          console.log("erorr with this transaction: " + transaction)
          console.log(error);
        }
      }
      
      function addThread(userId, issue, title, content, media) {
        return new Promise((resolve, reject) => {
          let sql = 'insert into thread (userId, issue,title, content, media) VALUES (?)';
          let array = [userId, issue, title, content, media];
          connection.query(sql, [array], (error, result) => {
            if (error) {
              console.log(error);
              resolve(null);
            } else {
              resolve(result.insertId);
            }
          });
        });
      }
      
      function addThreadResponse(threadId, content) {
        return new Promise((resolve, reject) => {
          let sql = 'insert into threadResponse (threadId, content) VALUES (?)';
          let array = [threadId, content];
          connection.query(sql, [array], (error, result) => {
            if (error) {
              console.log(error);
              resolve(false);
            } else {
              resolve(true);
            }
          });
        });
      }
      
      function readAllThreads(userId) {
        return new Promise((resolve, reject) => {
      
          let sql = 'select thread.threadId, thread.issue, thread.title, thread.content, thread.media, threadresponse.content as response from thread LEFT JOIN threadresponse ON thread.threadId=threadresponse.threadId where thread.userId = "' + userId + '" ';
          console.log(sql);
          connection.query(sql, (error, result) => {
            if (error) {
              resolve();
              throw error
      
            } else {
              resolve(result);
            }
          });
        });
      }
      
      function readThread(threadId) {
        return new Promise((resolve, reject) => {
          let sql = 'select * from thread where threadId = "' + threadId + '"';
          connection.query(sql, (error, result) => {
            if (error) {
              console.log(error);
              resolve();
            } else {
              resolve(result);
            }
          });
        });
      }
      
      function readThreadResponse(threadId) {
        return new Promise((resolve, reject) => {
          let sql = 'select * from threadResponse where threadId = "' + threadId + '"';
          connection.query(sql, (error, result) => {
            if (error) {
              console.log(error);
              resolve();
            } else {
              resolve(result);
            }
          });
        });
      }
    return router;
}
const connection = require("./connection");
function checkIfBan(userId) {
    return new Promise((resolve) => {
        const sql = "select * from ban where userId=" + userId
        connection.query(sql, (err, result) => {
            if (err) throw err;
            //usser id foudn in ban table
            if (result.length > 0) {
                resolve(true)
            } else {
                resolve(false);
            }
        });

    })
}
function checkIfBanAppeal() {
    return new Promise((resolve) => {
        const sql = "select from users where userId=" + userId+" AND ban is not null"
        connection.query(sql, (err, result) => {
            if (err) throw err;
            //userid with ban not null found in the users
            if (result.length > 0) {
                resolve(true)
            } else {
                resolve(false);
            }
        });

    })
}
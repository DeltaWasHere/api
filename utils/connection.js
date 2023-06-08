let connection = mysql.createConnection({
    host: 'bzdpujn96e42tugmzkmi-mysql.services.clever-cloud.com',
    user: 'uyn2j8jm7hyaezaf',
    port: "20492",
    password: 'JLimZouexH0P10Kcalk',
    database: 'bzdpujn96e42tugmzkmi',
    sql_mode: ''
  });

  connection.connect(error => {
    if (error) throw error;
    console.log('Conected!');
  })
  module.exports = connection;
import mysql from 'mysql2';
import dotenv from 'dotenv';
import colors from 'colors';

dotenv.config();

const conn = async () => {
  try {

    const pool = mysql.createPool({
      host: process.env.NODE_ENV === 'development' ? process.env.MY_SQL_HOST_LOCAL : process.env.MY_SQL_HOST,
      user: process.env.NODE_ENV === 'development' ? process.env.MY_SQL_USER_LOCAL : process.env.MY_SQL_USER,
      password: process.env.NODE_ENV === 'development' ? process.env.MY_SQL_PASSWORD_LOCAL : process.env.MY_SQL_PASSWORD,
      database: process.env.NODE_ENV === 'development' ? process.env.MY_SQL_DATABASE_LOCAL : process.env.MY_SQL_DATABASE,
      waitForConnections: true,
      connectionLimit: process.env.NODE_ENV === 'development' ? parseInt(process.env.CONNECTION_LIMIT_LOCAL) : parseInt(process.env.CONNECTION_LIMIT),
      queueLimit: 0,
      ssl: {
        rejectUnauthorized: false,
      },
      port: process.env.NODE_ENV === 'development' ? parseInt(process.env.PORT_LOCAL) : parseInt(process.env.PORT),
      timezone: 'Z'
    }).promise();

    await pool.getConnection();
    if (process.env.NODE_ENV === 'development') {
      console.log(colors.bold.yellow('Database is connected locally...'));
    } else {
      console.log(colors.bold.yellow('Database is connected on live...'));
    }

    return pool;
  } catch (error) {
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error(colors.red('Invalid MySQL credentials. Please check your username and password.'));
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.error(colors.red('Database does not exist. Please verify the database name.'));
    } else if (error.code === 'ECONNREFUSED') {
      console.error(colors.red('Connection refused. Check if your MySQL server is running.'));
    } else {
      console.error(colors.red(`Error connecting to the database: ${error.message}`));
    }
    throw new Error(error.message);
  }
};

export default conn;
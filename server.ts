const pgPromise = require("pg-promise");
const R = require("ramda");
const request = require("request-promise");

// Limit the amount of debugging of SQL expressions
const trimLogsSize: number = 200;

// Database interface
interface DBOptions {
  host: string;
  database: string;
  user?: string;
  password?: string;
  port?: number;
}

// Actual database options
const options: DBOptions = {
  host: "localhost",
  database: "lovelystay_test",
};

console.info(
  "Connecting to the database:",
  `${options.user}@${options.host}:${options.port}/${options.database}`
);

const pgpDefaultConfig = {
  promiseLib: require("bluebird"),
  // Log all querys
  query(query) {
    console.log("[SQL   ]", R.take(trimLogsSize, query.query));
  },
  // On error, please show me the SQL
  error(err, e) {
    if (e.cn) {
      console.error("[CONN ERROR   ]", R.take(trimLogsSize, e.cn), err);
    } else if (e.query) {
      console.error("[SQL ERROR  ]", R.take(trimLogsSize, e.query), err);
    } else {
      console.error("[ERROR   ]", R.take(trimLogsSize, e.message), err);
    }
  },
  connect(client) {
    const cp = client.connectionParameters;
    console.log("Connected to database:", cp.database);
  },
};

interface GithubUsers {
  id: number;
  login: string;
  location: string;
}

const pgp = pgPromise(pgpDefaultConfig);
const db = pgp(options);
db.one(
  "SELECT EXISTS ( SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename  = 'github_users' )"
)
  .then(
    ({ exists }) =>
      !exists &&
      db.none(
        "CREATE TABLE github_users (id BIGSERIAL, login TEXT UNIQUE, name TEXT, company TEXT, location TEXT)"
      )
  )
  .then(() => {
    const location = process.env.LOCATION;
    let query = `SELECT * FROM github_users`;
    if (location) query += ` WHERE location = '${location}'`;
    return db.many(query);
  })
  .then(res => console.log("res", res))
  // .then(() => {
  //   return request({
  //     uri: `https://api.github.com/users/${process.env.USER_NAME}`,
  //     headers: {
  //       "User-Agent": "Request-Promise",
  //     },
  //     json: true,
  //   });
  // })
  // .then((data: GithubUsers) => {
  //   return db.one(
  //     "INSERT INTO github_users (login, location) VALUES ($[login],$[location]) RETURNING id",
  //     data
  //   );
  // })
  // .then(({ id }) => console.log(id))
  .then(() => process.exit(0));

const pgPromise = require("pg-promise");
const R = require("ramda");
const request = require("request-promise");

// Limit the amount of debugging of SQL expressions
const trimLogsSize: number = 200;

// db interface
interface DBOptions {
  host: string;
  db: string;
  user?: string;
  password?: string;
  port?: number;
}

// Actual db options
const options: DBOptions = {
  host: "localhost",
  db: "lovelystay_test",
};

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
    console.log("Connected to db:", cp.db);
  },
};

interface GithubUsers {
  id: number;
  login: string;
  location: string;
}
interface LanguageI {
  id: number;
  name: string;
}
interface LikeI {
  user_id: number;
  language_id: number;
}

const mapFilters = (str: string) => {
  const strArr = str.split(",");
  let query = "";
  const length = strArr.length;
  if (length) query = " WHERE";
  for (let i = 0; i < length; i++) {
    const [key, value] = strArr[i].split(":");
    if (key && value) {
      if (i > 0) query += " AND ";
      query += ` ${key} = '${value}'`;
    }
  }
  return query;
};

const pgp = pgPromise(pgpDefaultConfig);
const db = pgp(options);

const checkIfTableExists = (tablename: string) =>
  db.one(
    `SELECT EXISTS ( SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename  = '${tablename}' )`
  );

const createTable = (query: string) => db.none(query);

const findOrCreateTable = (tablename: string, fields: string) =>
  checkIfTableExists(tablename).then(
    ({ exists }) =>
      !exists && createTable(`CREATE TABLE ${tablename} ${fields}`)
  );

const getGithubUser = (userName: string) =>
  request({
    uri: `https://api.github.com/users/${userName}`,
    headers: {
      "User-Agent": "Request-Promise",
    },
    json: true,
  });

const createUser = (data: GithubUsers) =>
  db.one(
    "INSERT INTO github_users (login, location) VALUES ($[login],$[location]) RETURNING id",
    data
  );

const getLanguage = (name: string) =>
  db.one(`SELECT * FROM languages WHERE name = '${name}'`);

const createLanguage = (name: string) =>
  db.one("INSERT INTO languages (name) VALUES ($[name]) RETURNING id, name", {
    name,
  });

const getOrCreateLanguage = (language: string) =>
  getLanguage(language)
    .then(data => data)
    .catch(() => createLanguage(language));

const getUsers = (filter: string) => {
  let query = `SELECT * FROM github_users`;
  if (filter?.length) query += mapFilters(filter);
  return db.any(query);
};

const getAndCreateUser = (userName: string) =>
  getUsers(userName)
    .then(res => {
      return res;
    })
    .catch(() =>
      getGithubUser(userName).then((data: GithubUsers) => createUser(data))
    );

const alreadyLiked = (data: LikeI) =>
  db.one(
    `SELECT * FROM user_languages WHERE user_id = '${data.user_id}' AND  language_id = '${data.language_id}'`
  );

const like = (data: LikeI) =>
  alreadyLiked(data).catch(() =>
    db.one(
      "INSERT INTO user_languages (user_id, language_id) VALUES ($[user_id],$[language_id]) RETURNING user_id, language_id",
      data
    )
  );

const likeLanguage = (userName: string, language: string) =>
  findOrCreateTable(
    "user_languages",
    "(user_id int REFERENCES github_users (id) ON UPDATE CASCADE ON DELETE CASCADE,language_id int REFERENCES languages (id) ON UPDATE CASCADE ON DELETE CASCADE)"
  ).then(() =>
    getAndCreateUser(userName).then(users =>
      getOrCreateLanguage(language).then(res =>
        like({ user_id: users[0].id, language_id: res.id })
      )
    )
  );

const getUserLanguages = (userName: string) =>
  db.many(
    `SELECT languages.name FROM user_languages JOIN github_users ON github_users.id = user_languages.user_id JOIN languages ON languages.id = user_languages.language_id WHERE github_users.login = '${userName}'`
  );

findOrCreateTable(
  "github_users",
  "(id BIGSERIAL PRIMARY KEY, login TEXT UNIQUE, name TEXT, company TEXT, location TEXT)"
)
  .then(() => {
    return findOrCreateTable(
      "languages",
      "(id BIGSERIAL PRIMARY KEY, name TEXT UNIQUE)"
    );
  })
  .then(() => {
    const { USER_NAME, LANGUAGE, FILTERS } = process.env;

    return USER_NAME && LANGUAGE
      ? likeLanguage(USER_NAME, LANGUAGE)
      : USER_NAME
      ? getUserLanguages(USER_NAME)
      : getUsers(FILTERS);
  })
  .then(res => console.log("res", res))
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(0);
  });

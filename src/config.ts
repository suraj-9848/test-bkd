import dotenv from "dotenv";
dotenv.config();

export const config = {
  CORS_ORIGIN:
    process.env.NODE_ENV === "production"
      ? "to be deployed"
      : "http://localhost:4000",

  PORT: process.env.PORT || 3000,
  MONGO_DB_CONNECTION_STRING: process.env.MONGO_KEY,
  MYSQL_DATABASE_URL:
    process.env.NODE_ENV === "production"
      ? "mysql://trailbliz:trailbliz@prod-host:3306/prod-db"
      : "mysql://trailbliz:trailbliz@localhost/trailbliz",
  REDIS_URL:
    process.env.NODE_ENV === "production"
      ? process.env.REDIS_URL_PROD
      : process.env.REDIS_URL_DEV,

  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,

  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "10d",
  JWT_COOKIE_EXPIRES_IN:
    parseInt(process.env.JWT_COOKIE_EXPIRES_IN ?? "864000000") || 864000000,
  JWT_SECRET: process.env.JWT_SECRET,

  PAYLOAD_LIMIT: process.env.PAYLOAD_LIMIT || "10mb",
  LOG_LEVEL: process.env.LOG_LEVEL || "info",

  STATIC_CACHE_TIME: {
    etag: true,
    index: false,
    maxAge: "600000",
    redirect: false,
    setHeaders(res, path, stat) {
      res.set("x-timestamp", Date.now());
    },
  },

  AXIOS_MAX_CONTENT_LENGTH:
    parseInt(process.env.AXIOS_MAX_CONTENT_LENGTH) || 100000000,
  AXIOS_MAX_BODY_LENGTH:
    parseInt(process.env.AXIOS_MAX_BODY_LENGTH) || 100000000,
  TRIM_CHARACTERS_LIMIT: 100000,
};

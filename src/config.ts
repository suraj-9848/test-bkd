export const config = {
    CORS_ORIGIN: process.env.NODE_ENV === "production" ? 'to be deployed' : 'http://localhost:3001', // MANDATORY
    // Tells on what environment it is running

    // Tells on what port it is running
    PORT: process.env.PORT || 3000, // NOT MANDATORY
    // Connection string of MongoDB
    MONGO_DB_CONNECTION_STRING: process.env.MONGO_KEY, // MANDATORY
    // Connection url of MySql
    MYSQL_DATABASE_URL:
    process.env.NODE_ENV === "production"
      ? "mysql://trailbliz:trailbliz@prod-host:3306/prod-db"
      : "mysql://trailbliz:trailbliz@localhost/trailbliz", // MANDATORY
      
    // redis not currently in use
    REDIS_URL: process.env.NODE_ENV === "production" ? process.env.REDIS_URL_PROD : process.env.REDIS_URL_DEV, // MANDATORY

    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET, 

    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "10d", 
    JWT_COOKIE_EXPIRES_IN: parseInt(process.env.JWT_COOKIE_EXPIRES_IN ?? "864000000") || 864000000,
    JWT_SECRET: process.env.JWT_SECRET, // MANDATORY
    //JWT Token for Mobile Users

    // // AWS access key id
    // AWS_ID: process.env.AWS_ID, // MANDATORY
    // // AWS Secret access key
    // AWS_SECRET_KEY: process.env.AWS_SECRET_KEY, // MANDATORY
    // // AWS Bucket
    // AWS_TESTCASE_BUCKET: process.env.AWS_TESTCASE_BUCKET, // MANDATORY

    // AWS_IMAGE_BUCKET : process.env.AWS_IMAGE_BUCKET,

    // dafault value set to 10mb use to set the payload limit of express
    PAYLOAD_LIMIT: process.env.PAYLOAD_LIMIT || "10mb",
    // default log level will be info
    LOG_LEVEL : process.env.LOG_LEVEL || "info",
    // default set to 1024 , Limit size of files created (or modified) by the program in kilobytes
    STATIC_CACHE_TIME: {
        etag: true,
        index: false,
        maxAge: "600000", // earlier this was 1d, instead now made it as 10 mins.
        redirect: false,
        setHeaders(res, path, stat) {
            res.set("x-timestamp", Date.now())
        },
    }, 

    AXIOS_MAX_CONTENT_LENGTH : parseInt(process.env.AXIOS_MAX_CONTENT_LENGTH) || 100000000,
    AXIOS_MAX_BODY_LENGTH : parseInt(process.env.AXIOS_MAX_BODY_LENGTH) || 100000000,
    TRIM_CHARACTERS_LIMIT: 100000,
}

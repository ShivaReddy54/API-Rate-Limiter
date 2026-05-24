
require('dotenv').config();
const redis = require('redis');

const redisHost = process.env.REDIS_HOST;
const redisPort = Number(process.env.REDIS_PORT);
const redisUsername = process.env.REDIS_USERNAME || 'default';
const redisPassword = process.env.REDIS_PASSWORD;

if (!redisHost || Number.isNaN(redisPort)) {
    console.error('Redis configuration error: REDIS_HOST and REDIS_PORT must be set in .env');
    process.exit(1);
}

const redisClient = redis.createClient({
    username: redisUsername,
    password: redisPassword,
    socket: {
        host: redisHost,
        port: redisPort,
    }
});

const connectRedis = async () => {
    try {
        await redisClient.connect();
        console.log("Redis connected successfully");
    } catch (err) {
        console.error("Redis connection failed:", err);
    }
};

connectRedis();

module.exports = redisClient;
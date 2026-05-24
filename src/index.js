const express = require('express');
const cors = require('cors');
require('dotenv').config();

const redisClient = require('./config/redis');
const rateLimiter = require('./logic/ratelimiter')

const app = express();

app.use(cors());
app.use(express.json());

// middleware
app.use(rateLimiter);

app.get('/', async (req, res) => {

    console.log("Request processing...");

    // simulate expensive operation
    await new Promise((resolve) => setTimeout(resolve, 3000));

    return res.status(200).json({
        success: true,
        message: "Hello from server"
    });
});

app.get('/health', (req, res) => {
    return res.status(200).json({
        status: "OK"
    });
});

if (require.main === module) {
    app.listen(3001, () => {
        console.log("Server running on port 3001");
    });
}

module.exports = app;
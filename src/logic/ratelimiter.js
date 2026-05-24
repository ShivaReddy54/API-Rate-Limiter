const redisClient = require('../config/redis');

const WINDOW_SIZE = 1 * 60 * 1000; // 1 min
const MAX_REQUESTS = 5;
const MAX_CONCURRENT_REQUESTS = 3;

const rateLimiter = async (req, res, next) => {
    if (req.path === '/health') {
        return next();
    }

    const ip = req.ip;

    const slidingKey = `SLIDING_WINDOW:${ip}`;
    const concurrentKey = `CONCURRENT_REQUESTS:${ip}`;
    const totalKey = `TOTAL_REQUESTS:${ip}`;
    const blockedKey = `BLOCKED_REQUESTS:${ip}`;

    const currentTime = Date.now();
    const windowStart = currentTime - WINDOW_SIZE;

    let concurrencyReserved = false;

    const releaseConcurrency = async () => {
        if (concurrencyReserved) {
            try {
                await redisClient.decr(concurrentKey);
            } catch (err) {
                console.error("Concurrency cleanup failed:", err);
            }
        }
    };

    try {
        // -------------------------------
        // 1. TOTAL REQUEST COUNT (analytics)
        // -------------------------------
        await redisClient.incr(totalKey);
        await redisClient.expire(totalKey, Math.ceil(WINDOW_SIZE / 1000));

        // -------------------------------
        // 2. CONCURRENCY RESERVATION (ATOMIC)
        // -------------------------------
        const concurrentCount = await redisClient.incr(concurrentKey);

        if (concurrentCount > MAX_CONCURRENT_REQUESTS) {
            await redisClient.decr(concurrentKey);

            await redisClient.incr(blockedKey);
            await redisClient.expire(blockedKey, Math.ceil(WINDOW_SIZE / 1000));

            return res.status(503).json({
                success: false,
                error: "Server busy. Too many concurrent requests."
            });
        }

        concurrencyReserved = true;

        // -------------------------------
        // 3. SLIDING WINDOW CLEANUP
        // -------------------------------
        await redisClient.zRemRangeByScore(slidingKey, 0, windowStart);

        // -------------------------------
        // 4. RATE LIMIT CHECK
        // -------------------------------
        const requestCount = await redisClient.zCard(slidingKey);

        const remaining = Math.max(0, MAX_REQUESTS - requestCount);

        res.setHeader("X-RateLimit-Limit", MAX_REQUESTS);
        res.setHeader("X-RateLimit-Remaining", remaining);

        if (requestCount >= MAX_REQUESTS) {
            await redisClient.incr(blockedKey);
            await redisClient.expire(blockedKey, Math.ceil(WINDOW_SIZE / 1000));

            // rollback concurrency BEFORE exit
            await releaseConcurrency();

            return res.status(429).json({
                success: false,
                error: "Too many requests"
            });
        }

        // -------------------------------
        // 5. RECORD REQUEST (ONLY AFTER PASS)
        // -------------------------------
        await redisClient.zAdd(slidingKey, [{
            score: currentTime,
            value: `${currentTime}-${Math.random()}`
        }]);

        await redisClient.expire(slidingKey, Math.ceil(WINDOW_SIZE / 1000));

        // -------------------------------
        // 6. CLEANUP
        // -------------------------------
        res.on('finish', releaseConcurrency);
        res.on('close', releaseConcurrency);

        next();

    } catch (err) {
        console.error("Rate limiter error:", err);

        await releaseConcurrency();

        return res.status(500).json({
            success: false,
            error: "Internal limiter error"
        });
    }
};

module.exports = rateLimiter;





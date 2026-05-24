const request = require('supertest');
const redisClient = require('../config/redis');
const app = require('../index'); // your express app

// -----------------------------
// CLEAN REDIS BEFORE EACH TEST
// -----------------------------
const clearRedis = async () => {
    const keys = await redisClient.keys('*');
    if (keys.length > 0) {
        await redisClient.del(keys);
    }
};

describe('API Rate Limiter System Tests', () => {

    beforeAll(async () => {
        if (!redisClient.isOpen) {
            await redisClient.connect();
        }
    });

    beforeEach(async () => {
        await clearRedis();
    });

    afterAll(async () => {
        await redisClient.quit();
    });

    // ---------------------------------------------------
    // 1. BASIC FUNCTIONAL TEST
    // ---------------------------------------------------
    test('should allow a single request successfully', async () => {
        const res = await request(app).get('/');

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
    }, 10000);

    // ---------------------------------------------------
    // 2. RATE LIMIT TEST (5 req per 1 min)
    // ---------------------------------------------------
    test('should block requests after 5 requests', async () => {
        const responses = [];

        for (let i = 0; i < 7; i++) {
            responses.push(await request(app).get('/'));
        }

        const success = responses.filter(r => r.statusCode === 200);
        const blocked = responses.filter(r => r.statusCode === 429);

        expect(success.length).toBeLessThanOrEqual(5);
        expect(blocked.length).toBeGreaterThan(0);
    }, 35000);

    // ---------------------------------------------------
    // 3. CONCURRENCY TEST (3 max active requests)
    // ---------------------------------------------------
    test('should block requests beyond concurrency limit', async () => {

        const slowRequests = Array.from({ length: 6 }, () =>
            request(app).get('/')
        );

        const results = await Promise.all(slowRequests);

        const rejected = results.filter(r => r.statusCode === 503);

        expect(rejected.length).toBeGreaterThan(0);
    }, 15000);

    // ---------------------------------------------------
    // 4. SLIDING WINDOW RESET TEST
    // ---------------------------------------------------
    test('should allow requests after window reset', async () => {

        // hit limit
        for (let i = 0; i < 5; i++) {
            await request(app).get('/');
        }

        // wait for 61 sec (window expiry)
        await new Promise(r => setTimeout(r, 61000));

        const res = await request(app).get('/');

        expect(res.statusCode).toBe(200);
    }, 130000);

    // ---------------------------------------------------
    // 5. BURST STRESS TEST (REAL WORLD SCENARIO)
    // ---------------------------------------------------
    test('should handle burst traffic safely', async () => {

        const requests = Array.from({ length: 20 }, () =>
            request(app).get('/')
        );

        const results = await Promise.all(requests);

        const success = results.filter(r => r.statusCode === 200);

        expect(success.length).toBeLessThanOrEqual(5);
    });

    // ---------------------------------------------------
    // 6. HEALTH ROUTE SHOULD NOT BE RATE LIMITED
    // ---------------------------------------------------
    test('health route should always work', async () => {

        const requests = Array.from({ length: 10 }, () =>
            request(app).get('/health')
        );

        const results = await Promise.all(requests);

        results.forEach(res => {
            expect(res.statusCode).toBe(200);
            expect(res.body.status).toBe('OK');
        });
    });

});
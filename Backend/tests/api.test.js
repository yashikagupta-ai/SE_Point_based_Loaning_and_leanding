// tests/api.test.js
const request = require('supertest');
const app = require('../server');
const mongoose = require('mongoose');
const User = require('../models/User');

describe('Authentication API', () => {
    beforeAll(async () => {
        // Connect to test database
        await mongoose.connect(process.env.MONGODB_URI_TEST);
    });

    afterAll(async () => {
        // Clean up and disconnect
        await User.deleteMany({});
        await mongoose.connection.close();
    });

    describe('POST /api/auth/register', () => {
        it('should register a new user', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    name: 'Test User',
                    email: 'test@mahindrauniversity.edu.in',
                    password: 'password123'
                });
            
            expect(res.statusCode).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveProperty('email', 'test@mahindrauniversity.edu.in');
        });

        it('should not register with invalid email domain', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    name: 'Test User',
                    email: 'test@gmail.com',
                    password: 'password123'
                });
            
            expect(res.statusCode).toBe(400);
            expect(res.body.success).toBe(false);
        });
    });

    describe('POST /api/auth/login', () => {
        it('should login existing user', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'test@mahindrauniversity.edu.in',
                    password: 'password123'
                });
            
            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body).toHaveProperty('token');
        });

        it('should not login with wrong password', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'test@mahindrauniversity.edu.in',
                    password: 'wrongpassword'
                });
            
            expect(res.statusCode).toBe(401);
            expect(res.body.success).toBe(false);
        });
    });
});
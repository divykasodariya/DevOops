import express from 'express'
import dotenv from 'dotenv'
import connectDB from './config/database.js';

import cookieParser from 'cookie-parser';
import cors from 'cors'
import http from 'http'
dotenv.config({});


const PORT = process.env.PORT || 6969;

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
const corsOptions = {
    origin: [
        'http://localhost:3000',
        'http://localhost:5173'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}
app.use(cors(corsOptions));


const server = http.createServer(app);

server.listen(PORT, () => {
    connectDB();
    console.log(`Server is listening at port ${PORT}`);
});
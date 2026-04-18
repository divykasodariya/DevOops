import express from 'express'
import dotenv from 'dotenv'
import connectDB from './config/database.js';

import cookieParser from 'cookie-parser';
import cors from 'cors'
import http from 'http'

import authRoutes from './routes/auth.js';
import professorRoutes from './routes/professor.js';
import requestRoutes from './routes/request.js';
import scheduleRoutes from './routes/schedule.js';
import attendanceRoutes from './routes/attendance.js';
import notificationRoutes from './routes/notification.js';
import issueRoutes from './routes/issue.js';
import materialRoutes from './routes/material.js';
import path from 'path';
import { fileURLToPath } from 'url';
import aiRoutes from './routes/ai.js';

dotenv.config({});


const PORT = process.env.PORT || 6969;

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
// const corsOptions = {
//     origin: [
//         'http://localhost:3000',
//         'http://localhost:5173',
//         'http://localhost:8081',
//         'http://localhost:8080',
//         // 'http://10.10.70.134:8081',
//     ],
//     credentials: true,
//     methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
//     allowedHeaders: ['Content-Type', 'Authorization']
// }
// app.use(cors(corsOptions));
app.use(cors({
    origin: true,
    credentials: true
}));
app.use('/auth', authRoutes);
app.use('/prof', professorRoutes);
app.use('/request', requestRoutes);
app.use('/schedule', scheduleRoutes);
app.use('/attendance', attendanceRoutes);
app.use('/notifications', notificationRoutes);
app.use('/issues', issueRoutes);
app.use('/materials', materialRoutes);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/ai', aiRoutes);

const server = http.createServer(app);

server.listen(PORT, '0.0.0.0', () => {
    connectDB();
    console.log(`Server is listening at port ${PORT}`);
});
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

// Import routes
import authRoutes from './src/routes/auth.routes.js';
import patientRoutes from './src/routes/patient.routes.js';
import doctorRoutes from './src/routes/doctor.routes.js'; // Doctor registration (public)
import doctorPortalRoutes from './src/routes/doctor.portal.routes.js'; // Doctor portal (authenticated)
import doctorPracticeRoutes from './src/routes/doctor.practice.routes.js'; // Doctor practice RBAC
import hospitalRoutes from './src/routes/hospital.routes.js';
import diagnosticCenterRoutes from './src/routes/diagnosticCenter.routes.js';
import adminRoutes from './src/routes/admin.routes.js';
import sharedRoutes from './src/routes/shared.routes.js';
import notificationRoutes from './src/routes/notification.routes.js';
import userRoutes from './src/routes/user.routes.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Socket.IO for real-time notifications
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('join-room', (userId) => {
    socket.join(`user-${userId}`);
    console.log(`User ${userId} joined their room`);
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Make io accessible to routes
app.set('io', io);

// Debug route - test if Express routing works at all
app.get('/api/debug', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'API debug route works',
    routes_loaded: {
      auth: !!authRoutes,
      patient: !!patientRoutes,
      doctor: !!doctorRoutes,
      doctorPortal: !!doctorPortalRoutes,
      doctorPractice: !!doctorPracticeRoutes,
      hospital: !!hospitalRoutes,
      diagnosticCenter: !!diagnosticCenterRoutes,
      admin: !!adminRoutes,
      user: !!userRoutes,
      shared: !!sharedRoutes,
      notification: !!notificationRoutes
    }
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/patient', patientRoutes);
app.use('/api/doctors', doctorRoutes); // Doctor registration endpoints (public)
app.use('/api/doctor', doctorPortalRoutes); // Doctor portal endpoints (authenticated)
app.use('/api/doctor-practice', doctorPracticeRoutes); // Doctor team & permissions
app.use('/api/hospitals', hospitalRoutes); // Hospital registration and management
app.use('/api/diagnostic-centers', diagnosticCenterRoutes); // Diagnostic center registration and management
app.use('/api/admin', adminRoutes);
app.use('/api/users', userRoutes); // User profile endpoints
app.use('/api/shared', sharedRoutes);
app.use('/api/notifications', notificationRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Medify247 API is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.stack : {}
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Database connection
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/medify247';
    
    // For MongoDB Atlas, ensure proper connection options
    const options = {
      serverSelectionTimeoutMS: 30000, // Increased timeout
      socketTimeoutMS: 45000,
      // SSL/TLS options for MongoDB Atlas
      // Note: mongodb+srv:// automatically uses SSL, but we can be explicit
      retryWrites: true,
    };

    // For mongodb+srv:// connections, SSL is automatic
    // If using standard connection, uncomment these:
    // if (!mongoURI.includes('mongodb+srv://')) {
    //   options.ssl = true;
    //   options.sslValidate = true;
    // }

    await mongoose.connect(mongoURI, options);
    console.log('✅ MongoDB connected');
    
    const PORT = process.env.PORT || 5000;
    httpServer.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📱 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    console.error('Error details:', {
      name: err.name,
      message: err.message,
      reason: err.reason?.message || err.reason
    });
    
    // Don't exit immediately - allow retry
    console.log('⏳ Retrying connection in 5 seconds...');
    setTimeout(connectDB, 5000);
  }
};

// Handle connection events
mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected. Attempting to reconnect...');
});

mongoose.connection.on('reconnected', () => {
  console.log('✅ MongoDB reconnected');
});

// Start connection
connectDB();

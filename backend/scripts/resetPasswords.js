import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import User from '../src/models/User.model.js';

dotenv.config();

const resetAllPasswords = async () => {
  try {
    const mongoOptions = {
      ssl: true,
      tlsAllowInvalidCertificates: true
    };
    
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/medify247', mongoOptions);
    console.log('Connected to MongoDB');

    const newPassword = 'password123';
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update all users with new password and activate/verify them for immediate access
    await User.updateMany({}, {
      password: hashedPassword,
      isActive: true,
      isVerified: true
    });

    // Super admin password set to admin123
    const superAdminHashed = await bcrypt.hash('admin123', 10);
    await User.updateOne({ email: 'admin@medify247.com' }, {
      password: superAdminHashed,
      isActive: true,
      isVerified: true
    });

    const users = await User.find({}, 'name email role phone').lean();
    console.log(JSON.stringify(users, null, 2));

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

resetAllPasswords();

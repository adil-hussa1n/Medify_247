import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../src/models/User.model.js';

dotenv.config();

const createCustomSuperAdmin = async () => {
  try {
    const mongoOptions = {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      retryWrites: true,
    };
    
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/medify247', mongoOptions);
    console.log('✅ Connected to MongoDB');

    const email = 'medify@gmail.com';
    const password = 'medify247';
    const name = 'Medify Super Admin';

    // Check if user with this email already exists
    let existingUser = await User.findOne({ email });
    
    if (existingUser) {
      existingUser.role = 'super_admin';
      existingUser.password = password;
      existingUser.isVerified = true;
      existingUser.isActive = true;
      await existingUser.save();
      console.log('✅ Existing user updated to Super Admin with new password!');
    } else {
      await User.create({
        name,
        email,
        phone: '01700000000',
        password,
        role: 'super_admin',
        isVerified: true,
        isActive: true
      });
      console.log('✅ New Super Admin created successfully!');
    }

    console.log(`📧 Email: ${email}`);
    console.log(`🔑 Password: ${password}`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating Super Admin:', error);
    process.exit(1);
  }
};

createCustomSuperAdmin();

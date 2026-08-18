import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import User from '../src/models/User.model.js';
import Doctor from '../src/models/Doctor.model.js';

dotenv.config();

const testCredentials = async () => {
  try {
    const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/medify247';
    console.log('Connecting to MongoURI:', mongoURI.substring(0, 30) + '...');
    await mongoose.connect(mongoURI);
    console.log('Connected.');

    const emails = [
      { email: 'medify@gmail.com', pass: 'medify247', isDoc: false },
      { email: 'patient@gmail.com', pass: 'patient2026', isDoc: false },
      { email: 'mountadora@gmail.com', pass: 'mountadora2026', isDoc: false },
      { email: 'emon@gmail.com', pass: 'emon2026', isDoc: true }
    ];

    for (const item of emails) {
      if (item.isDoc) {
        const doc = await Doctor.findOne({ email: item.email }).select('+password');
        if (!doc) {
          console.log(`Doctor not found: ${item.email}`);
        } else {
          const match = await doc.comparePassword(item.pass);
          console.log(`Doctor [${item.email}] match with '${item.pass}':`, match);
        }
      } else {
        const u = await User.findOne({ email: item.email }).select('+password');
        if (!u) {
          console.log(`User not found: ${item.email}`);
        } else {
          const match = await u.comparePassword(item.pass);
          console.log(`User [${item.email}] match with '${item.pass}':`, match, `(Role: ${u.role}, Active: ${u.isActive})`);
        }
      }
    }

    process.exit(0);
  } catch (err) {
    console.error('Error testing:', err);
    process.exit(1);
  }
};

testCredentials();

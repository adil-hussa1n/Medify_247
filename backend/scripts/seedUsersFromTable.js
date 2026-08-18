import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import User from '../src/models/User.model.js';
import Doctor from '../src/models/Doctor.model.js';
import Hospital from '../src/models/Hospital.model.js';
import DiagnosticCenter from '../src/models/DiagnosticCenter.model.js';

dotenv.config();

const usersToSeed = [
  {
    role: 'super_admin',
    name: 'Super Admin',
    email: 'Medify@gmail.com',
    phone: '01700000001',
    password: 'medify247',
  },
  {
    role: 'hospital_admin',
    name: 'Mount Adora Hospital',
    email: 'mountadora@gmail.com',
    phone: '01700000002',
    password: 'mountadora2026',
    institutionName: 'Mount Adora Hospital',
    registrationNumber: 'HOSP-MA-2026',
    address: 'Nayasarak, Sylhet, Bangladesh'
  },
  {
    role: 'diagnostic_center_admin',
    name: 'Labaid Diagnostic',
    email: 'labaidgmail.com', // As specified in user prompt table
    phone: '01700000003',
    password: 'labaid2026',
    institutionName: 'Labaid Diagnostic Center',
    tradeLicenseNumber: 'TRAD-LAB-2026',
    address: 'Dhanmondi, Dhaka, Bangladesh'
  },
  {
    role: 'doctor',
    name: 'Dr. Emon',
    email: 'emon@gmail.com',
    phone: '01700000004',
    password: 'emon2026',
    specialization: ['Cardiology', 'General Medicine'],
    medicalLicenseNumber: 'BMDC-2026-EMON',
    experienceYears: 8,
    consultationFee: 800
  },
  {
    role: 'patient',
    name: 'Test Patient',
    email: 'patient@gmail.com',
    phone: '01700000005',
    password: 'patient2026',
  }
];

const seedUsers = async () => {
  try {
    const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/medify247';
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB successfully.');

    for (const item of usersToSeed) {
      console.log(`\n👤 Processing [${item.role}]: ${item.email}`);
      const hashedPassword = await bcrypt.hash(item.password, 12);

      if (item.role === 'doctor') {
        // Doctor model
        let doctor = await Doctor.findOne({ email: item.email.toLowerCase().trim() });
        if (!doctor) {
          doctor = await Doctor.create({
            name: item.name,
            email: item.email.toLowerCase().trim(),
            phone: item.phone,
            password: hashedPassword,
            specialization: item.specialization,
            medicalLicenseNumber: item.medicalLicenseNumber,
            experienceYears: item.experienceYears,
            consultationFee: item.consultationFee,
            status: 'approved',
            qualifications: 'MBBS, FCPS',
            bio: 'Experienced doctor in Medify247 platform',
            chamber: {
              name: 'City Medical Chamber',
              address: 'Dhaka, Bangladesh',
              daysOpen: ['Monday', 'Wednesday', 'Friday'],
              hours: '18:00 - 21:00'
            }
          });
          console.log(`   ✅ Doctor created: ${item.email} (Password: ${item.password})`);
        } else {
          doctor.password = hashedPassword;
          doctor.status = 'approved';
          await doctor.save();
          console.log(`   🔄 Doctor updated password & status: ${item.email}`);
        }
      } else {
        // User model
        let user = await User.findOne({ email: item.email.toLowerCase().trim() });
        if (!user) {
          user = await User.create({
            name: item.name,
            email: item.email.toLowerCase().trim(),
            phone: item.phone,
            password: hashedPassword,
            role: item.role,
            isVerified: true,
            isActive: true
          });
          console.log(`   ✅ User created: ${item.email} (Role: ${item.role}, Password: ${item.password})`);
        } else {
          user.password = hashedPassword;
          user.role = item.role;
          user.isActive = true;
          user.isVerified = true;
          await user.save();
          console.log(`   🔄 User updated password & role: ${item.email}`);
        }

        // Create Hospital entity if hospital_admin
        if (item.role === 'hospital_admin') {
          let hospital = await Hospital.findOne({ userId: user._id });
          if (!hospital) {
            await Hospital.create({
              userId: user._id,
              name: item.institutionName,
              registrationNumber: item.registrationNumber,
              address: item.address,
              status: 'approved',
              contactInfo: {
                phone: [item.phone],
                email: item.email
              }
            });
            console.log(`   🏥 Hospital profile created: ${item.institutionName}`);
          } else {
            hospital.status = 'approved';
            await hospital.save();
            console.log(`   🏥 Hospital profile verified & approved`);
          }
        }

        // Create DiagnosticCenter entity if diagnostic_center_admin
        if (item.role === 'diagnostic_center_admin') {
          let center = await DiagnosticCenter.findOne({ userId: user._id });
          if (!center) {
            await DiagnosticCenter.create({
              userId: user._id,
              name: item.institutionName,
              phone: item.phone,
              email: item.email,
              address: item.address,
              ownerName: item.name,
              ownerPhone: item.phone,
              tradeLicenseNumber: item.tradeLicenseNumber,
              status: 'approved'
            });
            console.log(`   🔬 Diagnostic Center profile created: ${item.institutionName}`);
          } else {
            center.status = 'approved';
            await center.save();
            console.log(`   🔬 Diagnostic Center profile verified & approved`);
          }
        }
      }
    }

    console.log('\n=========================================');
    console.log('🎉 All users seeded / updated successfully!');
    console.log('=========================================\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding users:', error);
    process.exit(1);
  }
};

seedUsers();

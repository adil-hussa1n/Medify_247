import User from '../models/User.model.js';
import Doctor from '../models/Doctor.model.js';
import Chamber from '../models/Chamber.model.js';
import Hospital from '../models/Hospital.model.js';
import DiagnosticCenter from '../models/DiagnosticCenter.model.js';
import Appointment from '../models/Appointment.model.js';
import Prescription from '../models/Prescription.model.js';
import Test from '../models/Test.model.js';
import Order from '../models/Order.model.js';
import Specialization from '../models/Specialization.model.js';
import Schedule from '../models/Schedule.model.js';
import SerialSettings from '../models/SerialSettings.model.js';
import DateSerialSettings from '../models/DateSerialSettings.model.js';
import HomeService from '../models/HomeService.model.js';
import HomeServiceRequest from '../models/HomeServiceRequest.model.js';
import TestSerialSettings from '../models/TestSerialSettings.model.js';
import TestSerialBooking from '../models/TestSerialBooking.model.js';
import HomeServiceSerialSettings from '../models/HomeServiceSerialSettings.model.js';
import HomeServiceSerialBooking from '../models/HomeServiceSerialBooking.model.js';
import { buildAvailableSerials, calculateSerialTimeSlot, buildSerialBookingSummary } from '../utils/homeServiceSerial.util.js';
import { applyHomeServiceSerialBookingFields } from '../services/homeServiceSerialBooking.service.js';
import { generateAvailableSlots, lockSlot } from '../utils/slotGenerator.util.js';
import { createAndSendNotification } from '../services/notification.service.js';
import { generatePrescriptionPDF } from '../utils/pdfGenerator.util.js';
import moment from 'moment';
import mongoose from 'mongoose';
import { validationResult } from 'express-validator';

// Get patient profile
export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    res.json({
      success: true,
      data: { user }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile',
      error: error.message
    });
  }
};

// Update patient profile
export const updateProfile = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { name, dateOfBirth, gender, address } = req.body;
    
    const updateData = {};
    if (name) updateData.name = name;
    if (dateOfBirth) updateData.dateOfBirth = dateOfBirth;
    if (gender) updateData.gender = gender;
    if (address) updateData.address = address;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { user }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      error: error.message
    });
  }
};

// Search doctors with multiple search options
export const searchDoctors = async (req, res) => {
  try {
    const { 
      hospitalName,
      doctorName,
      department,
      specialization,
      page = 1,
      limit = 20
    } = req.query;

    let doctorIds = new Set();
    let hospitalIds = [];

    // Step 1: Find hospitals if hospitalName is provided
    if (hospitalName) {
      const hospitals = await Hospital.find({
        name: { $regex: hospitalName, $options: 'i' },
        status: 'approved'
      }).select('_id name departments associatedDoctors');
      
      hospitalIds = hospitals.map(h => h._id);

      if (hospitalIds.length === 0) {
        // No hospitals found, return empty results
        return res.json({
          success: true,
          data: {
            doctors: [],
            total: 0,
            page: parseInt(page),
            limit: parseInt(limit),
            pagination: {
              page: parseInt(page),
              limit: parseInt(limit),
              total: 0,
              pages: 0
            }
          }
        });
      }

      // Get doctors from hospital associations and chambers
      // From associatedDoctors
      hospitals.forEach(hospital => {
        if (hospital.associatedDoctors && hospital.associatedDoctors.length > 0) {
          hospital.associatedDoctors.forEach(assoc => {
            if (assoc.doctor) {
              doctorIds.add(assoc.doctor.toString());
            }
          });
        }
      });

      // From chambers
      const chambers = await Chamber.find({ 
        hospitalId: { $in: hospitalIds },
        isActive: true
      }).select('doctorId');
      
      chambers.forEach(c => {
        if (c.doctorId) {
          doctorIds.add(c.doctorId.toString());
        }
      });
    }

    // Step 2: Filter by department if provided
    if (department) {
      const deptDoctorIds = new Set();
      
      if (hospitalIds.length > 0) {
        // Search within specific hospitals
        const hospitalsWithDept = await Hospital.find({
          _id: { $in: hospitalIds },
          status: 'approved'
        }).populate('associatedDoctors.doctor');

        hospitalsWithDept.forEach(hospital => {
          // Check if hospital has this department
          const hasDept = hospital.departments && hospital.departments.some(dept => 
            dept.toLowerCase().includes(department.toLowerCase())
          );

          if (hasDept) {
            // Add all doctors from this hospital
            if (hospital.associatedDoctors) {
              hospital.associatedDoctors.forEach(assoc => {
                if (assoc.doctor && assoc.doctor._id) {
                  deptDoctorIds.add(assoc.doctor._id.toString());
                }
              });
            }
          } else {
            // Check individual doctor departments
            if (hospital.associatedDoctors) {
              hospital.associatedDoctors.forEach(assoc => {
                if (assoc.department && 
                    assoc.department.toLowerCase().includes(department.toLowerCase()) &&
                    assoc.doctor && assoc.doctor._id) {
                  deptDoctorIds.add(assoc.doctor._id.toString());
                }
              });
            }
          }
        });

        // Also check chambers
        const chambersWithDept = await Chamber.find({
          hospitalId: { $in: hospitalIds },
          isActive: true
        }).populate('doctorId');
        
        chambersWithDept.forEach(c => {
          if (c.doctorId && c.doctorId._id) {
            deptDoctorIds.add(c.doctorId._id.toString());
          }
        });
      } else {
        // Search all hospitals by department
        const hospitalsWithDept = await Hospital.find({
          status: 'approved',
          $or: [
            { departments: { $regex: department, $options: 'i' } },
            { 'associatedDoctors.department': { $regex: department, $options: 'i' } }
          ]
        }).populate('associatedDoctors.doctor');

        hospitalsWithDept.forEach(hospital => {
          const hasDept = hospital.departments && hospital.departments.some(dept => 
            dept.toLowerCase().includes(department.toLowerCase())
          );

          if (hasDept) {
            if (hospital.associatedDoctors) {
              hospital.associatedDoctors.forEach(assoc => {
                if (assoc.doctor && assoc.doctor._id) {
                  deptDoctorIds.add(assoc.doctor._id.toString());
                }
              });
            }
          } else {
            if (hospital.associatedDoctors) {
              hospital.associatedDoctors.forEach(assoc => {
                if (assoc.department && 
                    assoc.department.toLowerCase().includes(department.toLowerCase()) &&
                    assoc.doctor && assoc.doctor._id) {
                  deptDoctorIds.add(assoc.doctor._id.toString());
                }
              });
            }
          }
        });
      }

      // Intersect with existing doctorIds if hospital was specified
      if (doctorIds.size > 0) {
        const intersection = new Set([...doctorIds].filter(id => deptDoctorIds.has(id)));
        doctorIds = intersection;
      } else {
        doctorIds = deptDoctorIds;
      }
    }

    // Step 3: Build doctor query
    const doctorQuery = {
      status: 'approved' // Only show approved doctors
    };

    // Filter by doctor IDs if we have any
    if (doctorIds.size > 0) {
      doctorQuery._id = { $in: Array.from(doctorIds) };
    }

    // Filter by doctor name
    if (doctorName) {
      doctorQuery.name = { $regex: doctorName, $options: 'i' };
    }

    // Filter by specialization
    if (specialization) {
      doctorQuery.specialization = { $in: [specialization] };
    }

    // Step 4: Find doctors matching the query
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const doctors = await Doctor.find(doctorQuery)
      .select('-password') // Exclude password
      .sort({ name: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Doctor.countDocuments(doctorQuery);

    // Step 5: Enrich doctor data with hospital and chamber information
    const enrichedDoctors = await Promise.all(doctors.map(async (doctor) => {
      // Get hospital associations
      const hospitals = await Hospital.find({
        status: 'approved',
        $or: [
          { 'associatedDoctors.doctor': doctor._id },
          { _id: doctor.hospitalId }
        ]
      }).select('name address departments associatedDoctors logo');

      // Get chambers for this doctor
      const chambers = await Chamber.find({ 
        doctorId: doctor._id,
        isActive: true
      }).populate('hospitalId', 'name address logo');

      // Get department info from hospital associations
      const hospitalInfo = hospitals.map(hospital => {
        const assoc = hospital.associatedDoctors.find(
          ad => ad.doctor && ad.doctor.toString() === doctor._id.toString()
        );
        return {
          hospitalId: hospital._id,
          hospitalName: hospital.name,
          address: hospital.address,
          logo: hospital.logo,
          department: assoc ? assoc.department : null,
          designation: assoc ? assoc.designation : null
        };
      });

      return {
        ...doctor.toObject(),
        hospitals: hospitalInfo,
        chambers: chambers.map(c => ({
          chamberId: c._id,
          name: c.name,
          address: c.address,
          consultationFee: c.consultationFee,
          followUpFee: c.followUpFee,
          hospital: c.hospitalId ? {
            hospitalId: c.hospitalId._id,
            name: c.hospitalId.name,
            address: c.hospitalId.address,
            logo: c.hospitalId.logo
          } : null
        }))
      };
    }));

    res.json({
      success: true,
      data: {
        doctors: enrichedDoctors,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Search doctors error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search doctors',
      error: error.message
    });
  }
};

// Get doctor details with complete information
export const getDoctorDetails = async (req, res) => {
  try {
    const { doctorId } = req.params;

    const doctor = await Doctor.findById(doctorId)
      .select('-password'); // Exclude password

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    // Only show approved doctors to public
    if (doctor.status !== 'approved') {
      return res.status(403).json({
        success: false,
        message: 'Doctor profile is not available'
      });
    }

    // Get hospital associations with department info
    const hospitals = await Hospital.find({
      status: 'approved',
      $or: [
        { 'associatedDoctors.doctor': doctor._id },
        { _id: doctor.hospitalId }
      ]
    }).select('name address departments associatedDoctors logo contactInfo');

    // Get chambers for this doctor with hospital info
    const chambers = await Chamber.find({ 
      doctorId: doctor._id,
      isActive: true
    }).populate('hospitalId', 'name address logo contactInfo');

    // Get schedules for each chamber
    const schedules = await Schedule.find({
      doctorId: doctor._id,
      isActive: true
    }).populate('chamberId', 'name hospitalId');

    // Build hospital info with department
    const hospitalInfo = hospitals.map(hospital => {
      const assoc = hospital.associatedDoctors.find(
        ad => ad.doctor && ad.doctor.toString() === doctor._id.toString()
      );
      return {
        hospitalId: hospital._id,
        hospitalName: hospital.name,
        address: hospital.address,
        logo: hospital.logo,
        contactInfo: hospital.contactInfo,
        departments: hospital.departments,
        department: assoc ? assoc.department : null,
        designation: assoc ? assoc.designation : null,
        joinedAt: assoc ? assoc.joinedAt : null
      };
    });

    // Build chamber info with fees and schedule
    const chamberInfo = chambers.map(chamber => {
      const chamberSchedules = schedules.filter(
        s => s.chamberId && s.chamberId._id.toString() === chamber._id.toString()
      );
      
      return {
        chamberId: chamber._id,
        name: chamber.name,
        address: chamber.address,
        consultationFee: chamber.consultationFee,
        followUpFee: chamber.followUpFee,
        contactInfo: chamber.contactInfo,
        hospital: chamber.hospitalId ? {
          hospitalId: chamber.hospitalId._id,
          name: chamber.hospitalId.name,
          address: chamber.hospitalId.address,
          logo: chamber.hospitalId.logo,
          contactInfo: chamber.hospitalId.contactInfo
        } : null,
        schedules: chamberSchedules.map(s => ({
          scheduleId: s._id,
          dayOfWeek: s.dayOfWeek,
          timeSlots: s.timeSlots,
          isActive: s.isActive
        }))
      };
    });

    // Build complete doctor response
    const doctorDetails = {
      doctorId: doctor._id,
      name: doctor.name,
      email: doctor.email,
      phone: doctor.phone,
      bio: doctor.bio,
      description: doctor.description,
      profilePhotoUrl: doctor.profilePhotoUrl,
      specialization: doctor.specialization,
      qualifications: doctor.qualifications,
      experienceYears: doctor.experienceYears,
      medicalLicenseNumber: doctor.medicalLicenseNumber,
      consultationFee: doctor.consultationFee,
      followUpFee: doctor.followUpFee,
      reportFee: doctor.reportFee,
      visitingDays: doctor.visitingDays,
      chamber: doctor.chamber,
      emergencyAvailability: doctor.emergencyAvailability,
      socialLinks: doctor.socialLinks,
      rating: doctor.rating,
      holidays: doctor.holidays,
      hospitals: hospitalInfo,
      chambers: chamberInfo,
      createdAt: doctor.createdAt,
      updatedAt: doctor.updatedAt
    };

    res.json({
      success: true,
      data: {
        doctor: doctorDetails
      }
    });
  } catch (error) {
    console.error('Get doctor details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch doctor details',
      error: error.message
    });
  }
};

// Get available slots
export const getAvailableSlots = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { chamberId, date } = req.query;

    if (!doctorId || !chamberId || !date) {
      return res.status(400).json({
        success: false,
        message: 'Doctor ID, Chamber ID, and Date are required'
      });
    }

    const slots = await generateAvailableSlots(doctorId, chamberId, date);

    res.json({
      success: true,
      data: { slots }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch available slots',
      error: error.message
    });
  }
};

// Book appointment
export const bookAppointment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { doctorId, chamberId, appointmentDate, startTime, endTime, reason, consultationType } = req.body;

    // Check slot availability
    const isAvailable = await lockSlot(doctorId, chamberId, appointmentDate, startTime, endTime);
    
    if (!isAvailable) {
      return res.status(400).json({
        success: false,
        message: 'This slot is no longer available'
      });
    }

    // Get chamber to get fee
    const chamber = await Chamber.findById(chamberId);
    if (!chamber) {
      return res.status(404).json({
        success: false,
        message: 'Chamber not found'
      });
    }

    const fee = consultationType === 'follow_up' ? chamber.followUpFee : chamber.consultationFee;

    // Generate appointment number
    const appointmentNumber = `APT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Create appointment
    const appointment = await Appointment.create({
      patientId: req.user._id,
      doctorId,
      chamberId,
      appointmentDate,
      timeSlot: {
        startTime,
        endTime,
        sessionDuration: 15
      },
      appointmentNumber,
      consultationType: consultationType || 'new',
      fee,
      reason,
      status: 'pending'
    });

    const io = req.app.get('io');
    
    // Send notification to doctor
    const doctor = await Doctor.findById(doctorId).populate('userId');
    if (doctor && doctor.userId) {
      await createAndSendNotification(
        io,
        doctor.userId._id,
        'appointment_created',
        'New Appointment Request',
        `You have a new appointment request from ${req.user.name}`,
        appointment._id,
        'appointment'
      );
    }

    // Send notification to patient
    await createAndSendNotification(
      io,
      req.user._id,
      'appointment_created',
      'Appointment Booked',
      `Your appointment is booked. Appointment #${appointmentNumber}`,
      appointment._id,
      'appointment'
    );

    res.status(201).json({
      success: true,
      message: 'Appointment booked successfully',
      data: { appointment }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to book appointment',
      error: error.message
    });
  }
};

// Get patient appointments
export const getMyAppointments = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = { patientId: req.user._id };
    if (status) {
      query.status = status;
    }

    const appointments = await Appointment.find(query)
      .populate('doctorId')
      .populate({
        path: 'doctorId',
        populate: { path: 'userId', select: 'name profileImage' }
      })
      .populate('chamberId')
      .populate({
        path: 'chamberId',
        populate: { path: 'hospitalId', select: 'facilityName address' }
      })
      .sort({ createdAt: -1, appointmentDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Appointment.countDocuments(query);

    res.json({
      success: true,
      data: {
        appointments,
        total,
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch appointments',
      error: error.message
    });
  }
};

// Cancel appointment
export const cancelAppointment = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { reason } = req.body;

    const appointment = await Appointment.findOne({
      _id: appointmentId,
      patientId: req.user._id
    });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    if (['cancelled', 'completed', 'no_show'].includes(appointment.status)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel this appointment'
      });
    }

    appointment.status = 'cancelled';
    appointment.cancelledBy = 'patient';
    appointment.cancellationReason = reason;
    appointment.cancelledAt = new Date();
    await appointment.save();

    const io = req.app.get('io');
    
    // Notify doctor
    const doctor = await Doctor.findById(appointment.doctorId).populate('userId');
    if (doctor && doctor.userId) {
      await createAndSendNotification(
        io,
        doctor.userId._id,
        'appointment_cancelled',
        'Appointment Cancelled',
        `Appointment #${appointment.appointmentNumber} has been cancelled by patient`,
        appointment._id,
        'appointment'
      );
    }

    res.json({
      success: true,
      message: 'Appointment cancelled successfully',
      data: { appointment }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to cancel appointment',
      error: error.message
    });
  }
};

// Get medical records
export const getMedicalRecords = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const appointments = await Appointment.find({
      patientId: req.user._id,
      status: 'completed'
    })
      .populate('doctorId')
      .populate({
        path: 'doctorId',
        populate: { path: 'userId', select: 'name' }
      })
      .populate('prescription')
      .sort({ appointmentDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Appointment.countDocuments({
      patientId: req.user._id,
      status: 'completed'
    });

    res.json({
      success: true,
      data: {
        records: appointments,
        total,
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch medical records',
      error: error.message
    });
  }
};

// Download prescription
export const downloadPrescription = async (req, res) => {
  try {
    const { appointmentId } = req.params;

    const appointment = await Appointment.findOne({
      _id: appointmentId,
      patientId: req.user._id,
      status: 'completed'
    }).populate('prescription');

    if (!appointment || !appointment.prescription) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found'
      });
    }

    const prescription = await Prescription.findById(appointment.prescription)
      .populate('patientId')
      .populate({
        path: 'doctorId',
        populate: { path: 'userId', select: 'name' }
      });

    if (!prescription.pdfPath) {
      // Generate PDF if not exists
      const pdfResult = await generatePrescriptionPDF(
        prescription,
        appointment,
        prescription.patientId,
        prescription.doctorId
      );
      
      prescription.pdfPath = pdfResult.filepath;
      await prescription.save();
    }

    res.json({
      success: true,
      data: {
        pdfPath: prescription.pdfPath
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch prescription',
      error: error.message
    });
  }
};

// Get diagnostic tests
export const getDiagnosticTests = async (req, res) => {
  try {
    const { hospitalId, diagnosticCenterId, category, search, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = { isActive: true };
    
    // Support both hospital and diagnostic center
    if (hospitalId) {
      query.hospitalId = hospitalId;
    } else if (diagnosticCenterId) {
      query.diagnosticCenterId = diagnosticCenterId;
    }
    
    if (category) query.category = category;
    if (search) {
      query.$or = [
        { name: new RegExp(search, 'i') },
        { code: new RegExp(search, 'i') }
      ];
    }

    const tests = await Test.find(query)
      .populate('hospitalId', 'name address')
      .populate('diagnosticCenterId', 'name address')
      .sort({ name: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Test.countDocuments(query);

    res.json({
      success: true,
      data: {
        tests: tests.map((test) => {
          const obj = test.toObject();
          const hRef = test.hospitalId;
          const cRef = test.diagnosticCenterId;
          return {
            ...obj,
            hospitalId: hRef?._id?.toString() || hRef?.toString() || obj.hospitalId,
            diagnosticCenterId: cRef?._id?.toString() || cRef?.toString() || obj.diagnosticCenterId,
            hospital: hRef?._id ? { id: hRef._id, name: hRef.name, address: hRef.address } : null,
            diagnosticCenter: cRef?._id ? { id: cRef._id, name: cRef.name, address: cRef.address } : null
          };
        }),
        total,
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch diagnostic tests',
      error: error.message
    });
  }
};

// Create diagnostic order
export const createOrder = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { hospitalId, diagnosticCenterId, tests, collectionType, appointmentDate, appointmentTime, address, discount = 0 } = req.body;

    // Validate that either hospitalId or diagnosticCenterId is provided
    if (!hospitalId && !diagnosticCenterId) {
      return res.status(400).json({
        success: false,
        message: 'Either hospitalId or diagnosticCenterId is required'
      });
    }

    if (hospitalId && diagnosticCenterId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot specify both hospitalId and diagnosticCenterId'
      });
    }

    // Build query for tests
    const testQuery = {
      _id: { $in: tests.map(t => t.testId) }
    };
    
    if (hospitalId) {
      testQuery.hospitalId = hospitalId;
    } else {
      testQuery.diagnosticCenterId = diagnosticCenterId;
    }

    // Calculate total
    const testDetails = await Test.find(testQuery);

    let totalAmount = 0;
    const orderTests = tests.map(testOrder => {
      const test = testDetails.find(t => t._id.toString() === testOrder.testId.toString());
      if (!test) {
        throw new Error(`Test ${testOrder.testId} not found`);
      }
      const subtotal = test.price * (testOrder.quantity || 1);
      totalAmount += subtotal;
      return {
        testId: test._id,
        testName: test.name,
        price: test.price,
        quantity: testOrder.quantity || 1
      };
    });

    const finalAmount = totalAmount - discount;

    // Generate order number
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    const order = await Order.create({
      patientId: req.user._id,
      hospitalId: hospitalId || null,
      diagnosticCenterId: diagnosticCenterId || null,
      orderNumber,
      tests: orderTests,
      totalAmount,
      discount,
      finalAmount,
      collectionType,
      appointmentDate: collectionType === 'home_collection' ? appointmentDate : undefined,
      appointmentTime: collectionType === 'home_collection' ? appointmentTime : undefined,
      address: collectionType === 'home_collection' ? address : undefined,
      status: 'pending'
    });

    const io = req.app.get('io');
    
    // Notify patient
    await createAndSendNotification(
      io,
      req.user._id,
      'order_created',
      'Order Placed',
      `Your diagnostic order #${orderNumber} has been placed successfully`,
      order._id,
      'order'
    );

    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      data: { order }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create order',
      error: error.message
    });
  }
};

// Get patient orders
export const getMyOrders = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = { patientId: req.user._id };
    if (status) query.status = status;

    const orders = await Order.find(query)
      .populate('hospitalId', 'name address contactInfo')
      .populate('diagnosticCenterId', 'name address contactInfo')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Order.countDocuments(query);

    res.json({
      success: true,
      data: {
        orders,
        total,
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders',
      error: error.message
    });
  }
};

// Get specializations
export const getSpecializations = async (req, res) => {
  try {
    const specializations = await Specialization.find({ isActive: true })
      .sort({ name: 1 });

    res.json({
      success: true,
      data: { specializations }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch specializations',
      error: error.message
    });
  }
};

// Get doctor serial settings with chamber info
export const getDoctorSerialSettings = async (req, res) => {
  try {
    const { doctorId } = req.params;

    // Get doctor
    const doctor = await Doctor.findById(doctorId);
    if (!doctor || doctor.status !== 'approved') {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found or not available'
      });
    }

    // Check if doctor is associated with a hospital or diagnostic center
    const hospital = doctor.hospitalId 
      ? await Hospital.findById(doctor.hospitalId)
      : null;
    
    const diagnosticCenter = doctor.diagnosticCenterId 
      ? await DiagnosticCenter.findById(doctor.diagnosticCenterId)
      : null;

    // Get serial settings
    let serialSettings;
    if (hospital && hospital.status === 'approved') {
      serialSettings = await SerialSettings.findOne({
        doctorId,
        hospitalId: hospital._id,
        isActive: true
      });
    } else if (diagnosticCenter && diagnosticCenter.status === 'approved') {
      serialSettings = await SerialSettings.findOne({
        doctorId,
        diagnosticCenterId: diagnosticCenter._id,
        isActive: true
      });
    } else {
      serialSettings = await SerialSettings.findOne({
        doctorId,
        hospitalId: null,
        diagnosticCenterId: null,
        isActive: true
      });
    }

    if (!serialSettings) {
      return res.status(404).json({
        success: false,
        message: 'Serial settings not found for this doctor'
      });
    }

    // Get chamber info if chamberId exists
    let chamberInfo = null;
    if (serialSettings.chamberId) {
      const chamber = await Chamber.findById(serialSettings.chamberId);
      if (chamber) {
        chamberInfo = {
          chamberId: chamber._id,
          name: chamber.name,
          address: chamber.address,
          consultationFee: chamber.consultationFee,
          followUpFee: chamber.followUpFee,
          contactInfo: chamber.contactInfo,
          hospital: chamber.hospitalId ? await Hospital.findById(chamber.hospitalId).select('name address logo') : null
        };
      }
    }

    res.json({
      success: true,
      data: {
        doctor: {
          id: doctor._id,
          name: doctor.name,
          profilePhotoUrl: doctor.profilePhotoUrl,
          specialization: doctor.specialization
        },
        hospital: hospital ? {
          id: hospital._id,
          name: hospital.name
        } : null,
        diagnosticCenter: diagnosticCenter ? {
          id: diagnosticCenter._id,
          name: diagnosticCenter.name
        } : null,
        serialSettings: {
          totalSerialsPerDay: serialSettings.totalSerialsPerDay,
          appointmentPrice: serialSettings.appointmentPrice,
          timeRange: serialSettings.serialTimeRange,
          availableDays: serialSettings.availableDays || [],
          chamberId: serialSettings.chamberId
        },
        chamber: chamberInfo
      }
    });
  } catch (error) {
    console.error('Get doctor serial settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get doctor serial settings',
      error: error.message
    });
  }
};

// Get available serials for a doctor
export const getAvailableSerials = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Date is required (format: YYYY-MM-DD)'
      });
    }

    // Parse date string (YYYY-MM-DD) as UTC to avoid timezone shifts
    // This ensures the date matches exactly what admin selected
    const dateMoment = moment.utc(date, 'YYYY-MM-DD', true);
    if (!dateMoment.isValid()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Please use YYYY-MM-DD format'
      });
    }
    
    const appointmentDate = dateMoment.startOf('day').toDate();
    const dayOfWeek = dateMoment.day(); // 0 = Sunday, 6 = Saturday

    // Get doctor
    const doctor = await Doctor.findById(doctorId);
    if (!doctor || doctor.status !== 'approved') {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found or not available'
      });
    }

    // Check if doctor is associated with a hospital or diagnostic center
    const hospital = doctor.hospitalId 
      ? await Hospital.findById(doctor.hospitalId)
      : null;
    
    const diagnosticCenter = doctor.diagnosticCenterId 
      ? await DiagnosticCenter.findById(doctor.diagnosticCenterId)
      : null;

    // Get serial settings
    let serialSettings;
    if (hospital && hospital.status === 'approved') {
      // Hospital-based doctor
      serialSettings = await SerialSettings.findOne({
        doctorId,
        hospitalId: hospital._id,
        isActive: true
      });
    } else if (diagnosticCenter && diagnosticCenter.status === 'approved') {
      // Diagnostic center-based doctor
      serialSettings = await SerialSettings.findOne({
        doctorId,
        diagnosticCenterId: diagnosticCenter._id,
        isActive: true
      });
    } else {
      // Individual doctor
      serialSettings = await SerialSettings.findOne({
        doctorId,
        hospitalId: null,
        diagnosticCenterId: null,
        isActive: true
      });
    }

    if (!serialSettings) {
      return res.status(404).json({
        success: false,
        message: 'Serial settings not found for this doctor'
      });
    }

    // Check for date-specific settings
    // Use the same date parsing to ensure we match exactly
    const dateStart = dateMoment.startOf('day').toDate();
    const dateEnd = dateMoment.endOf('day').toDate();
    
    let dateSpecificSettings = null;
    if (hospital && hospital.status === 'approved') {
      dateSpecificSettings = await DateSerialSettings.findOne({
        serialSettingsId: serialSettings._id,
        date: {
          $gte: dateStart,
          $lte: dateEnd
        },
        isEnabled: true
      });
    } else if (diagnosticCenter && diagnosticCenter.status === 'approved') {
      dateSpecificSettings = await DateSerialSettings.findOne({
        serialSettingsId: serialSettings._id,
        date: {
          $gte: dateStart,
          $lte: dateEnd
        },
        isEnabled: true
      });
    } else {
      dateSpecificSettings = await DateSerialSettings.findOne({
        serialSettingsId: serialSettings._id,
        date: {
          $gte: dateStart,
          $lte: dateEnd
        },
        isEnabled: true
      });
    }

    // Determine effective settings and if date is enabled
    let effectiveTotalSerials, effectiveTimeRange, effectivePrice, adminNote;
    let isDateEnabled = false;

    if (dateSpecificSettings) {
      // Date-specific settings exist and are enabled
      isDateEnabled = true;
      effectiveTotalSerials = dateSpecificSettings.totalSerialsPerDay;
      // Use date-specific time range if available, otherwise fall back to base settings
      effectiveTimeRange = (dateSpecificSettings.serialTimeRange && 
                            dateSpecificSettings.serialTimeRange.startTime && 
                            dateSpecificSettings.serialTimeRange.endTime) 
                          ? dateSpecificSettings.serialTimeRange 
                          : serialSettings.serialTimeRange;
      effectivePrice = dateSpecificSettings.appointmentPrice || serialSettings.appointmentPrice;
      adminNote = dateSpecificSettings.adminNote || null;
    } else {
      // Check if there's a disabled date-specific setting (explicitly disabled)
      const disabledDateSetting = await DateSerialSettings.findOne({
        serialSettingsId: serialSettings._id,
        date: {
          $gte: dateStart,
          $lte: dateEnd
        },
        isEnabled: false
      });

      if (disabledDateSetting) {
        return res.json({
          success: true,
          data: {
            doctor: {
              id: doctor._id,
              name: doctor.name
            },
            date: date,
            availableSerials: [],
            totalSerials: serialSettings.totalSerialsPerDay,
            message: 'Serial booking is not available for this date',
            adminNote: disabledDateSetting.adminNote || null,
            isDateEnabled: false
          }
        });
      }

      // Check if admin has configured ANY date-specific settings
      const hasAnyDateSettings = await DateSerialSettings.exists({
        serialSettingsId: serialSettings._id
      });

      if (hasAnyDateSettings) {
        // Admin has configured date-specific settings, but this date is not enabled
        return res.json({
          success: true,
          data: {
            doctor: {
              id: doctor._id,
              name: doctor.name
            },
            date: date,
            availableSerials: [],
            totalSerials: serialSettings.totalSerialsPerDay,
            message: 'This date is not available for serial booking. Please select an enabled date.',
            adminNote: null,
            isDateEnabled: false
          }
        });
      }

      // No date-specific settings configured
      // IMPORTANT: Only admin-selected dates should be active
      // If no date-specific settings exist, this date is NOT enabled
      return res.json({
        success: true,
        data: {
          doctor: {
            id: doctor._id,
            name: doctor.name
          },
          date: date,
          availableSerials: [],
          totalSerials: serialSettings.totalSerialsPerDay,
          message: 'This date is not available for serial booking. Please select an enabled date.',
          adminNote: null,
          isDateEnabled: false
        }
      });
    }

    // Get booked serials for this date
    const bookedAppointments = await Appointment.find({
      doctorId,
      appointmentDate: {
        $gte: moment(date).startOf('day').toDate(),
        $lte: moment(date).endOf('day').toDate()
      },
      status: { $in: ['pending', 'accepted'] }
    }).select('timeSlot');

    // Extract booked serial times
    const bookedTimes = bookedAppointments.map(apt => apt.timeSlot?.startTime).filter(Boolean);

    // Generate available serials (only even numbers) using effective settings
    // Validate effective settings before proceeding
    if (!effectiveTotalSerials || effectiveTotalSerials <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Serial settings are not configured properly. Total serials per day is missing or invalid.'
      });
    }
    
    if (!effectiveTimeRange || !effectiveTimeRange.startTime || !effectiveTimeRange.endTime) {
      return res.status(400).json({
        success: false,
        message: 'Serial time range is not configured properly. Please contact the administrator.'
      });
    }
    
    const totalSerials = effectiveTotalSerials;
    const availableSerials = [];
    
    // Calculate time slot duration using effective time range
    const [startHour, startMin] = effectiveTimeRange.startTime.split(':').map(Number);
    const [endHour, endMin] = effectiveTimeRange.endTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    const totalMinutes = endMinutes - startMinutes;
    const slotDuration = Math.floor(totalMinutes / totalSerials);

    for (let i = 1; i <= totalSerials; i++) {
      // Only include even-numbered serials
      if (i % 2 === 0) {
        const slotMinutes = startMinutes + (i - 1) * slotDuration;
        const slotHour = Math.floor(slotMinutes / 60);
        const slotMin = slotMinutes % 60;
        const timeString = `${String(slotHour).padStart(2, '0')}:${String(slotMin).padStart(2, '0')}`;
        
        const endSlotMinutes = slotMinutes + slotDuration;
        const endSlotHour = Math.floor(endSlotMinutes / 60);
        const endSlotMin = endSlotMinutes % 60;
        const endTimeString = `${String(endSlotHour).padStart(2, '0')}:${String(endSlotMin).padStart(2, '0')}`;

        // Check if this time slot is already booked
        const isBooked = bookedTimes.some(bt => bt === timeString);

        if (!isBooked) {
          availableSerials.push({
            serialNumber: i,
            time: timeString,
            endTime: endTimeString,
            available: true
          });
        }
      }
    }
    
    // Sort serials by serial number (ascending - lower numbers first)
    availableSerials.sort((a, b) => a.serialNumber - b.serialNumber);

    res.json({
      success: true,
      data: {
        doctor: {
          id: doctor._id,
          name: doctor.name,
          profilePhotoUrl: doctor.profilePhotoUrl,
          specialization: doctor.specialization,
          qualifications: doctor.qualifications
        },
        hospital: hospital ? {
          id: hospital._id,
          name: hospital.name
        } : null,
        diagnosticCenter: diagnosticCenter ? {
          id: diagnosticCenter._id,
          name: diagnosticCenter.name
        } : null,
        date: date,
        availableSerials,
        totalSerials: effectiveTotalSerials,
        appointmentPrice: effectivePrice,
        timeRange: effectiveTimeRange,
        bookedCount: bookedAppointments.length,
        availableCount: availableSerials.length,
        adminNote: adminNote,
        isDateEnabled: isDateEnabled
      }
    });
  } catch (error) {
    console.error('Get available serials error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get available serials',
      error: error.message
    });
  }
};

// Book a serial (appointment)
export const bookSerial = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { doctorId, serialNumber, date } = req.body;

    if (!serialNumber || serialNumber % 2 !== 0) {
      return res.status(400).json({
        success: false,
        message: 'Only even-numbered serials can be booked online'
      });
    }

    // Parse date string (YYYY-MM-DD) as UTC to avoid timezone shifts
    // This ensures the date matches exactly what admin selected
    const dateMoment = moment.utc(date, 'YYYY-MM-DD', true);
    if (!dateMoment.isValid()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Please use YYYY-MM-DD format'
      });
    }
    
    const appointmentDate = dateMoment.startOf('day').toDate();
    const dayOfWeek = dateMoment.day();

    // Get doctor
    const doctor = await Doctor.findById(doctorId);
    if (!doctor || doctor.status !== 'approved') {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found or not available'
      });
    }

    // Check if doctor is associated with a hospital or diagnostic center
    const hospital = doctor.hospitalId 
      ? await Hospital.findById(doctor.hospitalId).populate('admins', 'email name phone')
      : null;
    
    const diagnosticCenter = doctor.diagnosticCenterId 
      ? await DiagnosticCenter.findById(doctor.diagnosticCenterId).populate('admins', 'email name phone')
      : null;

    // Get serial settings
    let serialSettings;
    if (hospital && hospital.status === 'approved') {
      serialSettings = await SerialSettings.findOne({
        doctorId,
        hospitalId: hospital._id,
        isActive: true
      });
    } else if (diagnosticCenter && diagnosticCenter.status === 'approved') {
      serialSettings = await SerialSettings.findOne({
        doctorId,
        diagnosticCenterId: diagnosticCenter._id,
        isActive: true
      });
    } else {
      serialSettings = await SerialSettings.findOne({
        doctorId,
        hospitalId: null,
        diagnosticCenterId: null,
        isActive: true
      });
    }

    if (!serialSettings) {
      return res.status(404).json({
        success: false,
        message: 'Serial settings not found for this doctor'
      });
    }

    // Check for date-specific settings
    // Use the same date parsing to ensure we match exactly
    const dateStart = dateMoment.startOf('day').toDate();
    const dateEnd = dateMoment.endOf('day').toDate();
    
    let dateSpecificSettings = null;
    if (hospital && hospital.status === 'approved') {
      dateSpecificSettings = await DateSerialSettings.findOne({
        serialSettingsId: serialSettings._id,
        date: {
          $gte: dateStart,
          $lte: dateEnd
        },
        isEnabled: true
      });
    } else if (diagnosticCenter && diagnosticCenter.status === 'approved') {
      dateSpecificSettings = await DateSerialSettings.findOne({
        serialSettingsId: serialSettings._id,
        date: {
          $gte: dateStart,
          $lte: dateEnd
        },
        isEnabled: true
      });
    } else {
      dateSpecificSettings = await DateSerialSettings.findOne({
        serialSettingsId: serialSettings._id,
        date: {
          $gte: dateStart,
          $lte: dateEnd
        },
        isEnabled: true
      });
    }

    // If date-specific settings exist, date must be enabled
    // If no date-specific settings exist, check if we should only allow admin-selected dates
    if (!dateSpecificSettings) {
      const disabledDateSetting = await DateSerialSettings.findOne({
        serialSettingsId: serialSettings._id,
        date: {
          $gte: dateStart,
          $lte: dateEnd
        },
        isEnabled: false
      });

      if (disabledDateSetting) {
        return res.status(400).json({
          success: false,
          message: disabledDateSetting.adminNote || 'Serial booking is not available for this date'
        });
      }

      // Check if admin has configured any date-specific settings
      const hasAnyDateSettings = await DateSerialSettings.exists({
        serialSettingsId: serialSettings._id
      });

      if (hasAnyDateSettings) {
        return res.status(400).json({
          success: false,
          message: 'This date is not available for serial booking. Please select an enabled date.'
        });
      }

      // No date-specific settings exist
      // IMPORTANT: Only admin-selected dates should be active
      // If no date-specific settings exist, this date is NOT enabled
      return res.status(400).json({
        success: false,
        message: 'This date is not available for serial booking. Please select an enabled date.'
      });
    }

    // Use date-specific settings if available, otherwise use base settings
    const effectiveTotalSerials = dateSpecificSettings?.totalSerialsPerDay || serialSettings.totalSerialsPerDay;
    const effectiveTimeRange = (dateSpecificSettings?.serialTimeRange?.startTime && dateSpecificSettings?.serialTimeRange?.endTime)
      ? dateSpecificSettings.serialTimeRange
      : serialSettings.serialTimeRange;
    const effectivePrice = dateSpecificSettings?.appointmentPrice || serialSettings.appointmentPrice;
    const adminNote = dateSpecificSettings?.adminNote || null;

    // Validate effective settings
    if (!effectiveTotalSerials || effectiveTotalSerials <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Serial settings are not configured properly. Total serials per day is missing or invalid.'
      });
    }

    if (!effectiveTimeRange || !effectiveTimeRange.startTime || !effectiveTimeRange.endTime) {
      return res.status(400).json({
        success: false,
        message: 'Serial time range is not configured properly. Please contact the administrator.'
      });
    }

    // Check if serial number is valid
    if (serialNumber < 1 || serialNumber > effectiveTotalSerials) {
      return res.status(400).json({
        success: false,
        message: 'Invalid serial number'
      });
    }

    // Calculate time slot for this serial number
    const [startHour, startMin] = effectiveTimeRange.startTime.split(':').map(Number);
    const [endHour, endMin] = effectiveTimeRange.endTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    const totalMinutes = endMinutes - startMinutes;
    const slotDuration = Math.floor(totalMinutes / effectiveTotalSerials);
    
    const slotMinutes = startMinutes + (serialNumber - 1) * slotDuration;
    const slotHour = Math.floor(slotMinutes / 60);
    const slotMin = slotMinutes % 60;
    const startTime = `${String(slotHour).padStart(2, '0')}:${String(slotMin).padStart(2, '0')}`;
    
    const endSlotMinutes = slotMinutes + slotDuration;
    const endSlotHour = Math.floor(endSlotMinutes / 60);
    const endSlotMin = endSlotMinutes % 60;
    const endTime = `${String(endSlotHour).padStart(2, '0')}:${String(endSlotMin).padStart(2, '0')}`;

    // Check if this time slot is already booked
    // Use the same date parsing to ensure consistency
    const existingAppointment = await Appointment.findOne({
      doctorId,
      appointmentDate: {
        $gte: dateStart,
        $lte: dateEnd
      },
      'timeSlot.startTime': startTime,
      status: { $in: ['pending', 'accepted'] }
    });

    if (existingAppointment) {
      return res.status(400).json({
        success: false,
        message: 'This serial is already booked'
      });
    }

    // Get or create a chamber for the doctor
    let chamber = await Chamber.findOne({ doctorId, isActive: true });
    if (!chamber) {
      // Create a default chamber if none exists
      chamber = await Chamber.create({
        doctorId,
        hospitalId: hospital ? hospital._id : null,
        name: `${doctor.name}'s Chamber`,
        consultationFee: serialSettings.appointmentPrice,
        followUpFee: serialSettings.appointmentPrice,
        isActive: true
      });
    }

    // Generate appointment number
    const appointmentNumber = `SR-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Create appointment
    const appointment = await Appointment.create({
      patientId: req.user._id,
      doctorId,
      chamberId: chamber._id,
      appointmentDate,
      timeSlot: {
        startTime,
        endTime,
        sessionDuration: slotDuration
      },
      appointmentNumber,
      consultationType: 'new',
      fee: effectivePrice,
      status: 'pending',
      paymentStatus: 'pending',
      notes: adminNote 
        ? `Serial #${serialNumber} | Admin Note: ${adminNote}`
        : `Serial #${serialNumber}`
    });

    const io = req.app.get('io');

    // Get patient information
    const patient = await User.findById(req.user._id);
    const patientInfo = {
      name: patient.name,
      email: patient.email,
      phone: patient.phone,
      appointmentNumber: appointmentNumber,
      serialNumber: serialNumber,
      date: moment(date).format('YYYY-MM-DD'),
      time: startTime,
      doctorName: doctor.name
    };

    // Send notification to doctor
    if (doctor.userId) {
      await createAndSendNotification(
        io,
        doctor.userId,
        'appointment_created',
        'New Serial Booking',
        `You have a new serial booking (Serial #${serialNumber}) from ${patient.name}`,
        appointment._id,
        'appointment'
      );
    }

    // Send patient information to hospital admin, diagnostic center admin, or doctor
    if (hospital && hospital.admins && hospital.admins.length > 0) {
      // Send to all hospital admins
      for (const admin of hospital.admins) {
        if (admin._id) {
          await createAndSendNotification(
            io,
            admin._id,
            'appointment_created',
            'New Serial Booking',
            `New serial booking for Dr. ${doctor.name}: ${patient.name} (${patient.email}, ${patient.phone}) - Serial #${serialNumber}`,
            appointment._id,
            'appointment'
          );
        }
      }
    } else if (diagnosticCenter && diagnosticCenter.admins && diagnosticCenter.admins.length > 0) {
      // Send to all diagnostic center admins
      for (const admin of diagnosticCenter.admins) {
        if (admin._id) {
          await createAndSendNotification(
            io,
            admin._id,
            'appointment_created',
            'New Serial Booking',
            `New serial booking for Dr. ${doctor.name}: ${patient.name} (${patient.email}, ${patient.phone}) - Serial #${serialNumber}`,
            appointment._id,
            'appointment'
          );
        }
      }
    } else {
      // Send to doctor directly (already sent above, but include patient info)
      if (doctor.userId) {
        await createAndSendNotification(
          io,
          doctor.userId,
          'appointment_created',
          'New Serial Booking - Patient Info',
          `Patient: ${patient.name}, Email: ${patient.email}, Phone: ${patient.phone}, Serial #${serialNumber}`,
          appointment._id,
          'appointment'
        );
      }
    }

    // Send notification to patient
    await createAndSendNotification(
      io,
      req.user._id,
      'appointment_created',
      'Serial Booked Successfully',
      `Your serial #${serialNumber} is booked for ${moment(date).format('MMMM DD, YYYY')} at ${startTime}`,
      appointment._id,
      'appointment'
    );

    res.status(201).json({
      success: true,
      message: 'Serial booked successfully',
      data: {
        appointment: {
          ...appointment.toObject(),
          serialNumber,
          patientInfo
        },
        doctor: {
          id: doctor._id,
          name: doctor.name,
          specialization: doctor.specialization
        },
        hospital: hospital ? {
          id: hospital._id,
          name: hospital.name
        } : null
      }
    });
  } catch (error) {
    console.error('Book serial error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to book serial',
      error: error.message
    });
  }
};

// Get all home services (public - can be accessed without auth or with patient auth)
export const getAllHomeServices = async (req, res) => {
  try {
    const { hospitalId, diagnosticCenterId, serviceType, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build query
    const query = { isActive: true };

    if (hospitalId) {
      // Verify hospital exists and is approved
      const hospital = await Hospital.findById(hospitalId);
      if (!hospital || hospital.status !== 'approved') {
        return res.status(404).json({
          success: false,
          message: 'Hospital not found or not approved'
        });
      }
      query.hospitalId = hospitalId;
      query.diagnosticCenterId = null;
    } else if (diagnosticCenterId) {
      // Verify diagnostic center exists and is approved
      const DiagnosticCenter = (await import('../models/DiagnosticCenter.model.js')).default;
      const diagnosticCenter = await DiagnosticCenter.findById(diagnosticCenterId);
      if (!diagnosticCenter || diagnosticCenter.status !== 'approved') {
        return res.status(404).json({
          success: false,
          message: 'Diagnostic center not found or not approved'
        });
      }
      query.diagnosticCenterId = diagnosticCenterId;
      query.hospitalId = null;
    }

    if (serviceType) {
      query.serviceType = { $regex: serviceType, $options: 'i' };
    }

    // Get home services
    const homeServices = await HomeService.find(query)
      .populate('hospitalId', 'name address logo contactInfo')
      .populate('diagnosticCenterId', 'name address logo contactInfo')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await HomeService.countDocuments(query);

    res.json({
      success: true,
      data: {
        homeServices: homeServices.map(service => {
          const obj = service.toObject();
          const hospitalRef = service.hospitalId;
          const centerRef = service.diagnosticCenterId;
          return {
            ...obj,
            hospitalId: hospitalRef?._id?.toString() || hospitalRef?.toString() || obj.hospitalId,
            diagnosticCenterId: centerRef?._id?.toString() || centerRef?.toString() || obj.diagnosticCenterId,
            hospital: hospitalRef ? {
              id: hospitalRef._id,
              name: hospitalRef.name,
              address: hospitalRef.address,
              logo: hospitalRef.logo,
              contactInfo: hospitalRef.contactInfo
            } : null,
            diagnosticCenter: centerRef ? {
              id: centerRef._id,
              name: centerRef.name,
              address: centerRef.address,
              logo: centerRef.logo,
              contactInfo: centerRef.contactInfo
            } : null
          };
        }),
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get all home services error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch home services',
      error: error.message
    });
  }
};

// Get home service details
export const getHomeServiceDetails = async (req, res) => {
  try {
    const { serviceId } = req.params;

    const homeService = await HomeService.findById(serviceId)
      .populate('hospitalId', 'name address logo contactInfo departments')
      .populate('diagnosticCenterId', 'name address logo contactInfo departments');

    if (!homeService || !homeService.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Home service not found'
      });
    }

    const hospitalRefId = homeService.hospitalId?._id || homeService.hospitalId;
    const centerRefId = homeService.diagnosticCenterId?._id || homeService.diagnosticCenterId;

    // Verify hospital or diagnostic center is approved
    if (hospitalRefId) {
      const hospital = await Hospital.findById(hospitalRefId);
      if (hospital && hospital.status !== 'approved') {
        return res.status(404).json({
          success: false,
          message: 'Home service not available'
        });
      }
    } else if (centerRefId) {
      const DiagnosticCenter = (await import('../models/DiagnosticCenter.model.js')).default;
      const diagnosticCenter = await DiagnosticCenter.findById(centerRefId);
      if (diagnosticCenter && diagnosticCenter.status !== 'approved') {
        return res.status(404).json({
          success: false,
          message: 'Home service not available'
        });
      }
    }

    const hospitalPop = homeService.hospitalId?._id ? homeService.hospitalId : null;
    const centerPop = homeService.diagnosticCenterId?._id ? homeService.diagnosticCenterId : null;
    const obj = homeService.toObject();

    const serialQuery = { homeServiceId: serviceId };
    if (hospitalRefId) serialQuery.hospitalId = hospitalRefId;
    else if (centerRefId) serialQuery.diagnosticCenterId = centerRefId;

    const serialSettings = await HomeServiceSerialSettings.findOne(serialQuery);
    const serialBooking = buildSerialBookingSummary(serialSettings, homeService);

    res.json({
      success: true,
      data: {
        homeService: {
          ...obj,
          hospitalId: hospitalRefId?.toString() || obj.hospitalId,
          diagnosticCenterId: centerRefId?.toString() || obj.diagnosticCenterId,
          serialBooking,
          hospital: hospitalPop ? {
            id: hospitalPop._id,
            name: hospitalPop.name,
            address: hospitalPop.address,
            logo: hospitalPop.logo,
            contactInfo: hospitalPop.contactInfo,
            departments: hospitalPop.departments
          } : null,
          diagnosticCenter: centerPop ? {
            id: centerPop._id,
            name: centerPop.name,
            address: centerPop.address,
            logo: centerPop.logo,
            contactInfo: centerPop.contactInfo,
            departments: centerPop.departments
          } : null
        }
      }
    });
  } catch (error) {
    console.error('Get home service details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch home service details',
      error: error.message
    });
  }
};

// Submit home service request
export const submitHomeServiceRequest = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      hospitalId,
      diagnosticCenterId,
      homeServiceId,
      patientName,
      patientAge,
      patientGender,
      homeAddress,
      phoneNumber,
      requestedDate,
      requestedTime,
      notes
    } = req.body;

    // Validate that either hospitalId or diagnosticCenterId is provided
    if (!hospitalId && !diagnosticCenterId) {
      return res.status(400).json({
        success: false,
        message: 'Either hospitalId or diagnosticCenterId is required'
      });
    }

    if (hospitalId && !mongoose.Types.ObjectId.isValid(hospitalId)) {
      return res.status(400).json({ success: false, message: 'Invalid hospital ID' });
    }
    if (diagnosticCenterId && !mongoose.Types.ObjectId.isValid(diagnosticCenterId)) {
      return res.status(400).json({ success: false, message: 'Invalid diagnostic center ID' });
    }
    if (!mongoose.Types.ObjectId.isValid(homeServiceId)) {
      return res.status(400).json({ success: false, message: 'Invalid home service ID' });
    }

    if (hospitalId && diagnosticCenterId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot specify both hospitalId and diagnosticCenterId'
      });
    }

    let hospital = null;
    let diagnosticCenter = null;
    let homeService = null;

    if (hospitalId) {
      // Verify hospital exists and is approved
      hospital = await Hospital.findById(hospitalId).populate('admins', 'email name phone');
      if (!hospital || hospital.status !== 'approved') {
        return res.status(404).json({
          success: false,
          message: 'Hospital not found or not approved'
        });
      }

      // Verify home service exists and is active
      homeService = await HomeService.findOne({
        _id: homeServiceId,
        hospitalId,
        isActive: true
      });
    } else {
      // Verify diagnostic center exists and is approved
      const DiagnosticCenter = (await import('../models/DiagnosticCenter.model.js')).default;
      diagnosticCenter = await DiagnosticCenter.findById(diagnosticCenterId).populate('admins', 'email name phone');
      if (!diagnosticCenter || diagnosticCenter.status !== 'approved') {
        return res.status(404).json({
          success: false,
          message: 'Diagnostic center not found or not approved'
        });
      }

      // Verify home service exists and is active
      homeService = await HomeService.findOne({
        _id: homeServiceId,
        diagnosticCenterId,
        isActive: true
      });
    }

    if (!homeService) {
      return res.status(404).json({
        success: false,
        message: 'Home service not found or not available'
      });
    }

    // Generate request number
    const requestNumber = `HSR-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Create home service request
    const request = await HomeServiceRequest.create({
      patientId: req.user._id,
      hospitalId: hospitalId || null,
      diagnosticCenterId: diagnosticCenterId || null,
      homeServiceId,
      requestNumber,
      patientName,
      patientAge,
      patientGender,
      homeAddress,
      phoneNumber,
      serviceType: homeService.serviceType,
      servicePrice: homeService.price,
      serviceNote: homeService.note,
      requestedDate: requestedDate ? new Date(requestedDate) : null,
      requestedTime: requestedTime || null,
      notes: notes || '',
      status: 'pending'
    });

    const io = req.app.get('io');

    // Send notification to hospital admins or diagnostic center admins
    if (hospital && hospital.admins && hospital.admins.length > 0) {
      for (const admin of hospital.admins) {
        if (admin._id) {
          await createAndSendNotification(
            io,
            admin._id,
            'order_created',
            'New Home Service Request',
            `New home service request: ${patientName} (${phoneNumber}) - ${homeService.serviceType}`,
            request._id,
            'order'
          );
        }
      }
    } else if (diagnosticCenter && diagnosticCenter.admins && diagnosticCenter.admins.length > 0) {
      for (const admin of diagnosticCenter.admins) {
        if (admin._id) {
          await createAndSendNotification(
            io,
            admin._id,
            'order_created',
            'New Home Service Request',
            `New diagnostic home service request: ${patientName} (${phoneNumber}) - ${homeService.serviceType}`,
            request._id,
            'order'
          );
        }
      }
    }

    // Send notification to patient
    await createAndSendNotification(
      io,
      req.user._id,
      'order_created',
      'Home Service Request Submitted',
      `Your home service request (${homeService.serviceType}) has been submitted. Request #${requestNumber}`,
      request._id,
      'order'
    );

    res.status(201).json({
      success: true,
      message: 'Home service request submitted successfully',
      data: {
        request: {
          ...request.toObject(),
          hospital: hospital ? {
            id: hospital._id,
            name: hospital.name
          } : null,
          diagnosticCenter: diagnosticCenter ? {
            id: diagnosticCenter._id,
            name: diagnosticCenter.name
          } : null,
          service: {
            id: homeService._id,
            serviceType: homeService.serviceType,
            price: homeService.price
          }
        }
      }
    });
  } catch (error) {
    console.error('Submit home service request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit home service request',
      error: error.message
    });
  }
};

// Get user's complete history (serials + home service requests)
export const getMyHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20, type } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const patientId = req.user._id;
    const history = [];

    // Get serials/appointments if type is 'serials' or 'all'
    if (!type || type === 'serials' || type === 'all') {
      const appointments = await Appointment.find({ patientId })
        .populate('doctorId', 'name specialization profilePhotoUrl')
        .populate('chamberId', 'name address')
        .populate({
          path: 'chamberId',
          populate: {
            path: 'hospitalId',
            select: 'name address logo'
          }
        })
        .sort({ createdAt: -1, appointmentDate: -1 })
        .skip(type === 'serials' ? skip : 0)
        .limit(type === 'serials' ? parseInt(limit) : 1000);

      appointments.forEach(apt => {
        const serialMatch = apt.notes ? apt.notes.match(/Serial #(\d+)/) : null;
        history.push({
          type: 'serial',
          id: apt._id,
          requestNumber: apt.appointmentNumber,
          serialNumber: serialMatch ? serialMatch[1] : null,
          doctor: apt.doctorId ? {
            id: apt.doctorId._id,
            name: apt.doctorId.name,
            specialization: apt.doctorId.specialization,
            profilePhotoUrl: apt.doctorId.profilePhotoUrl
          } : null,
          hospital: apt.chamberId?.hospitalId ? {
            id: apt.chamberId.hospitalId._id,
            name: apt.chamberId.hospitalId.name,
            address: apt.chamberId.hospitalId.address,
            logo: apt.chamberId.hospitalId.logo
          } : null,
          chamber: apt.chamberId ? {
            id: apt.chamberId._id,
            name: apt.chamberId.name,
            address: apt.chamberId.address
          } : null,
          date: apt.appointmentDate,
          time: apt.timeSlot?.startTime,
          endTime: apt.timeSlot?.endTime,
          fee: apt.fee,
          status: apt.status,
          paymentStatus: apt.paymentStatus,
          createdAt: apt.createdAt,
          updatedAt: apt.updatedAt
        });
      });
    }

    // Get home service serial bookings if type is 'home_service_serials' or 'all'
    if (!type || type === 'home_service_serials' || type === 'all') {
      const serialBookings = await HomeServiceSerialBooking.find({ patientId })
        .populate('hospitalId', 'name address logo contactInfo')
        .populate('diagnosticCenterId', 'name address logo contactInfo')
        .populate('homeServiceId', 'serviceType price note')
        .sort({ appointmentDate: -1, createdAt: -1 })
        .skip(type === 'home_service_serials' ? skip : 0)
        .limit(type === 'home_service_serials' ? parseInt(limit) : 1000);

      serialBookings.forEach((booking) => {
        history.push({
          type: 'home_service_serial',
          id: booking._id,
          bookingNumber: booking.bookingNumber,
          serialNumber: booking.serialNumber,
          hospital: booking.hospitalId ? {
            id: booking.hospitalId._id,
            name: booking.hospitalId.name,
            address: booking.hospitalId.address,
            logo: booking.hospitalId.logo
          } : null,
          diagnosticCenter: booking.diagnosticCenterId ? {
            id: booking.diagnosticCenterId._id,
            name: booking.diagnosticCenterId.name,
            address: booking.diagnosticCenterId.address,
            logo: booking.diagnosticCenterId.logo
          } : null,
          service: booking.homeServiceId ? {
            id: booking.homeServiceId._id,
            serviceType: booking.homeServiceId.serviceType,
            price: booking.servicePrice
          } : null,
          patientName: booking.patientName,
          patientAge: booking.patientAge,
          patientGender: booking.patientGender,
          homeAddress: booking.homeAddress,
          phoneNumber: booking.patientPhone,
          date: booking.appointmentDate,
          time: booking.timeSlot?.startTime,
          endTime: booking.timeSlot?.endTime,
          status: booking.status,
          notes: booking.notes,
          createdAt: booking.createdAt,
          updatedAt: booking.updatedAt,
          completedAt: booking.completedAt
        });
      });
    }

    // Get test serial bookings if type is 'test_serials' or 'all'
    if (!type || type === 'test_serials' || type === 'all') {
      const testSerialBookings = await TestSerialBooking.find({ patientId })
        .populate('hospitalId', 'name address logo')
        .populate('diagnosticCenterId', 'name address logo')
        .populate('testId', 'name code category')
        .sort({ appointmentDate: -1, createdAt: -1 })
        .skip(type === 'test_serials' ? skip : 0)
        .limit(type === 'test_serials' ? parseInt(limit) : 1000);

      testSerialBookings.forEach((booking) => {
        history.push({
          type: 'test_serial',
          id: booking._id,
          bookingNumber: booking.bookingNumber,
          serialNumber: booking.serialNumber,
          hospital: booking.hospitalId ? {
            id: booking.hospitalId._id,
            name: booking.hospitalId.name,
            address: booking.hospitalId.address,
            logo: booking.hospitalId.logo
          } : null,
          diagnosticCenter: booking.diagnosticCenterId ? {
            id: booking.diagnosticCenterId._id,
            name: booking.diagnosticCenterId.name,
            address: booking.diagnosticCenterId.address,
            logo: booking.diagnosticCenterId.logo
          } : null,
          test: booking.testId ? {
            id: booking.testId._id,
            name: booking.testName || booking.testId.name,
            code: booking.testId.code,
            category: booking.testId.category
          } : { name: booking.testName },
          testPrice: booking.testPrice,
          patientName: booking.patientName,
          patientPhone: booking.patientPhone,
          date: booking.appointmentDate,
          time: booking.timeSlot?.startTime,
          endTime: booking.timeSlot?.endTime,
          status: booking.status,
          notes: booking.notes,
          createdAt: booking.createdAt,
          updatedAt: booking.updatedAt,
          completedAt: booking.completedAt
        });
      });
    }

    // Get home service requests if type is 'home_services' or 'all'
    if (!type || type === 'home_services' || type === 'all') {
      const DiagnosticCenter = (await import('../models/DiagnosticCenter.model.js')).default;
      const homeServiceRequests = await HomeServiceRequest.find({ patientId })
        .populate('hospitalId', 'name address logo contactInfo')
        .populate('diagnosticCenterId', 'name address logo contactInfo')
        .populate('homeServiceId', 'serviceType price note availableTime')
        .sort({ createdAt: -1 })
        .skip(type === 'home_services' ? skip : 0)
        .limit(type === 'home_services' ? parseInt(limit) : 1000);

      homeServiceRequests.forEach(req => {
        history.push({
          type: 'home_service',
          id: req._id,
          requestNumber: req.requestNumber,
          hospital: req.hospitalId ? {
            id: req.hospitalId._id,
            name: req.hospitalId.name,
            address: req.hospitalId.address,
            logo: req.hospitalId.logo,
            contactInfo: req.hospitalId.contactInfo
          } : null,
          diagnosticCenter: req.diagnosticCenterId ? {
            id: req.diagnosticCenterId._id,
            name: req.diagnosticCenterId.name,
            address: req.diagnosticCenterId.address,
            logo: req.diagnosticCenterId.logo,
            contactInfo: req.diagnosticCenterId.contactInfo
          } : null,
          service: req.homeServiceId ? {
            id: req.homeServiceId._id,
            serviceType: req.homeServiceId.serviceType,
            price: req.homeServiceId.price,
            note: req.homeServiceId.note,
            availableTime: req.homeServiceId.availableTime
          } : null,
          patientName: req.patientName,
          patientAge: req.patientAge,
          patientGender: req.patientGender,
          homeAddress: req.homeAddress,
          phoneNumber: req.phoneNumber,
          requestedDate: req.requestedDate,
          requestedTime: req.requestedTime,
          status: req.status,
          rejectionReason: req.rejectionReason,
          notes: req.notes,
          createdAt: req.createdAt,
          updatedAt: req.updatedAt,
          acceptedAt: req.acceptedAt,
          rejectedAt: req.rejectedAt,
          completedAt: req.completedAt
        });
      });
    }

    // Sort by creation date (most recent first)
    history.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Apply pagination if type is 'all'
    let paginatedHistory = history;
    let total = history.length;
    if (type === 'all') {
      paginatedHistory = history.slice(skip, skip + parseInt(limit));
      total = history.length;
    } else if (type === 'serials') {
      total = await Appointment.countDocuments({ patientId });
    } else if (type === 'home_services') {
      total = await HomeServiceRequest.countDocuments({ patientId });
    } else if (type === 'home_service_serials') {
      total = await HomeServiceSerialBooking.countDocuments({ patientId });
    } else if (type === 'test_serials') {
      total = await TestSerialBooking.countDocuments({ patientId });
    }

    res.json({
      success: true,
      data: {
        history: paginatedHistory,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get my history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch history',
      error: error.message
    });
  }
};

// Get available test serials for a diagnostic center test
export const getAvailableTestSerials = async (req, res) => {
  try {
    const { testId, hospitalId, diagnosticCenterId } = req.params;
    const { date } = req.query;

    const providerId = hospitalId || diagnosticCenterId;
    if (!mongoose.Types.ObjectId.isValid(testId) || !mongoose.Types.ObjectId.isValid(providerId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid test or provider ID'
      });
    }

    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Date is required (format: YYYY-MM-DD)'
      });
    }

    const appointmentDate = moment(date).startOf('day').toDate();
    const dayOfWeek = moment(date).day(); // 0 = Sunday, 6 = Saturday

    let hospital = null;
    let diagnosticCenter = null;
    let serialSettings = null;

    // Check if it's a hospital or diagnostic center
    if (hospitalId) {
      hospital = await Hospital.findById(hospitalId);
      if (!hospital || hospital.status !== 'approved') {
        return res.status(404).json({
          success: false,
          message: 'Hospital not found or not approved'
        });
      }

      // Verify test exists and belongs to this hospital
      const test = await Test.findById(testId);
      if (!test || !test.isActive) {
        return res.status(404).json({
          success: false,
          message: 'Test not found or not available'
        });
      }

      if (test.hospitalId?.toString() !== hospitalId) {
        return res.status(400).json({
          success: false,
          message: 'Test does not belong to this hospital'
        });
      }

      // Get serial settings
      serialSettings = await TestSerialSettings.findOne({
        testId,
        hospitalId: hospitalId,
        isActive: true
      });
    } else if (diagnosticCenterId) {
      diagnosticCenter = await DiagnosticCenter.findById(diagnosticCenterId);
      if (!diagnosticCenter || diagnosticCenter.status !== 'approved') {
        return res.status(404).json({
          success: false,
          message: 'Diagnostic center not found or not approved'
        });
      }

      // Verify test exists and belongs to this diagnostic center
      const test = await Test.findById(testId);
      if (!test || !test.isActive) {
        return res.status(404).json({
          success: false,
          message: 'Test not found or not available'
        });
      }

      if (test.diagnosticCenterId?.toString() !== diagnosticCenterId) {
        return res.status(400).json({
          success: false,
          message: 'Test does not belong to this diagnostic center'
        });
      }

      // Get serial settings
      serialSettings = await TestSerialSettings.findOne({
        testId,
        diagnosticCenterId,
        isActive: true
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Either hospitalId or diagnosticCenterId must be provided'
      });
    }

    const test = await Test.findById(testId);

    if (!serialSettings) {
      return res.status(404).json({
        success: false,
        message: 'Test serial settings not found for this test'
      });
    }

    // Check if serials are available on this day
    if (serialSettings.availableDays && serialSettings.availableDays.length > 0) {
      if (!serialSettings.availableDays.includes(dayOfWeek)) {
        return res.json({
          success: true,
          data: {
            test: {
              id: test._id,
              name: test.name,
              code: test.code,
              category: test.category
            },
            diagnosticCenter: {
              id: diagnosticCenter._id,
              name: diagnosticCenter.name
            },
            date: date,
            availableSerials: [],
            totalSerials: serialSettings.totalSerialsPerDay,
            message: 'No serials available on this day'
          }
        });
      }
    }

    // Get booked serials for this date
    const bookingQuery = {
      testId,
      appointmentDate: {
        $gte: moment(date).startOf('day').toDate(),
        $lte: moment(date).endOf('day').toDate()
      },
      status: { $in: ['pending', 'confirmed'] }
    };
    
    if (hospitalId) {
      bookingQuery.hospitalId = hospitalId;
    } else {
      bookingQuery.diagnosticCenterId = diagnosticCenterId;
    }

    const bookedBookings = await TestSerialBooking.find(bookingQuery).select('serialNumber timeSlot');

    // Extract booked serial numbers
    const bookedSerialNumbers = bookedBookings.map(booking => booking.serialNumber);

    // Generate available serials (only even numbers)
    const totalSerials = serialSettings.totalSerialsPerDay;
    const availableSerials = [];
    
    // Calculate time slot duration
    const [startHour, startMin] = serialSettings.serialTimeRange.startTime.split(':').map(Number);
    const [endHour, endMin] = serialSettings.serialTimeRange.endTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    const totalMinutes = endMinutes - startMinutes;
    const slotDuration = Math.floor(totalMinutes / totalSerials);

    for (let i = 1; i <= totalSerials; i++) {
      // Only include even-numbered serials
      if (i % 2 === 0) {
        const slotMinutes = startMinutes + (i - 1) * slotDuration;
        const slotHour = Math.floor(slotMinutes / 60);
        const slotMin = slotMinutes % 60;
        const timeString = `${String(slotHour).padStart(2, '0')}:${String(slotMin).padStart(2, '0')}`;
        
        const endSlotMinutes = slotMinutes + slotDuration;
        const endSlotHour = Math.floor(endSlotMinutes / 60);
        const endSlotMin = endSlotMinutes % 60;
        const endTimeString = `${String(endSlotHour).padStart(2, '0')}:${String(endSlotMin).padStart(2, '0')}`;

        // Check if this serial number is already booked
        const isBooked = bookedSerialNumbers.includes(i);

        if (!isBooked) {
          availableSerials.push({
            serialNumber: i,
            time: timeString,
            endTime: endTimeString,
            available: true
          });
        }
      }
    }

    res.json({
      success: true,
      data: {
        test: {
          id: test._id,
          name: test.name,
          code: test.code,
          category: test.category,
          description: test.description,
          preparation: test.preparation
        },
        hospital: hospital ? {
          id: hospital._id,
          name: hospital.name
        } : null,
        diagnosticCenter: diagnosticCenter ? {
          id: diagnosticCenter._id,
          name: diagnosticCenter.name
        } : null,
        date: date,
        availableSerials,
        totalSerials: serialSettings.totalSerialsPerDay,
        testPrice: serialSettings.testPrice,
        timeRange: serialSettings.serialTimeRange,
        bookedCount: bookedBookings.length,
        availableCount: availableSerials.length
      }
    });
  } catch (error) {
    console.error('Get available test serials error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get available test serials',
      error: error.message
    });
  }
};

// Book a test serial
export const bookTestSerial = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { testId, hospitalId, diagnosticCenterId, serialNumber, date } = req.body;

    if (!mongoose.Types.ObjectId.isValid(testId)) {
      return res.status(400).json({ success: false, message: 'Invalid test ID' });
    }
    if (hospitalId && !mongoose.Types.ObjectId.isValid(hospitalId)) {
      return res.status(400).json({ success: false, message: 'Invalid hospital ID' });
    }
    if (diagnosticCenterId && !mongoose.Types.ObjectId.isValid(diagnosticCenterId)) {
      return res.status(400).json({ success: false, message: 'Invalid diagnostic center ID' });
    }

    if (!serialNumber || serialNumber % 2 !== 0) {
      return res.status(400).json({
        success: false,
        message: 'Only even-numbered serials can be booked online'
      });
    }

    const appointmentDate = moment(date).startOf('day').toDate();
    const dayOfWeek = moment(date).day();

    let hospital = null;
    let diagnosticCenter = null;
    let serialSettings = null;

    // Check if it's a hospital or diagnostic center
    if (hospitalId) {
      hospital = await Hospital.findById(hospitalId).populate('admins', 'email name phone');
      if (!hospital || hospital.status !== 'approved') {
        return res.status(404).json({
          success: false,
          message: 'Hospital not found or not approved'
        });
      }

      // Verify test exists and belongs to this hospital
      const test = await Test.findById(testId);
      if (!test || !test.isActive) {
        return res.status(404).json({
          success: false,
          message: 'Test not found or not available'
        });
      }

      if (test.hospitalId?.toString() !== hospitalId) {
        return res.status(400).json({
          success: false,
          message: 'Test does not belong to this hospital'
        });
      }

      // Get serial settings
      serialSettings = await TestSerialSettings.findOne({
        testId,
        hospitalId: hospitalId,
        isActive: true
      });
    } else if (diagnosticCenterId) {
      diagnosticCenter = await DiagnosticCenter.findById(diagnosticCenterId).populate('admins', 'email name phone');
      if (!diagnosticCenter || diagnosticCenter.status !== 'approved') {
        return res.status(404).json({
          success: false,
          message: 'Diagnostic center not found or not approved'
        });
      }

      // Verify test exists and belongs to this diagnostic center
      const test = await Test.findById(testId);
      if (!test || !test.isActive) {
        return res.status(404).json({
          success: false,
          message: 'Test not found or not available'
        });
      }

      if (test.diagnosticCenterId?.toString() !== diagnosticCenterId) {
        return res.status(400).json({
          success: false,
          message: 'Test does not belong to this diagnostic center'
        });
      }

      // Get serial settings
      serialSettings = await TestSerialSettings.findOne({
        testId,
        diagnosticCenterId,
        isActive: true
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Either hospitalId or diagnosticCenterId must be provided'
      });
    }

    const test = await Test.findById(testId);

    if (!serialSettings) {
      return res.status(404).json({
        success: false,
        message: 'Test serial settings not found for this test'
      });
    }

    // Check if serials are available on this day
    if (serialSettings.availableDays && serialSettings.availableDays.length > 0) {
      if (!serialSettings.availableDays.includes(dayOfWeek)) {
        return res.status(400).json({
          success: false,
          message: 'Serials are not available on this day'
        });
      }
    }

    // Check if serial is already booked
    const bookingQuery = {
      testId,
      appointmentDate: {
        $gte: moment(date).startOf('day').toDate(),
        $lte: moment(date).endOf('day').toDate()
      },
      serialNumber,
      status: { $in: ['pending', 'confirmed'] }
    };

    if (hospitalId) {
      bookingQuery.hospitalId = hospitalId;
    } else {
      bookingQuery.diagnosticCenterId = diagnosticCenterId;
    }

    const existingBooking = await TestSerialBooking.findOne(bookingQuery);

    if (existingBooking) {
      return res.status(400).json({
        success: false,
        message: 'This serial is already booked'
      });
    }

    // Calculate time slot
    const [startHour, startMin] = serialSettings.serialTimeRange.startTime.split(':').map(Number);
    const [endHour, endMin] = serialSettings.serialTimeRange.endTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    const totalMinutes = endMinutes - startMinutes;
    const slotDuration = Math.floor(totalMinutes / serialSettings.totalSerialsPerDay);

    const slotMinutes = startMinutes + (serialNumber - 1) * slotDuration;
    const slotHour = Math.floor(slotMinutes / 60);
    const slotMin = slotMinutes % 60;
    const timeString = `${String(slotHour).padStart(2, '0')}:${String(slotMin).padStart(2, '0')}`;
    
    const endSlotMinutes = slotMinutes + slotDuration;
    const endSlotHour = Math.floor(endSlotMinutes / 60);
    const endSlotMin = endSlotMinutes % 60;
    const endTimeString = `${String(endSlotHour).padStart(2, '0')}:${String(endSlotMin).padStart(2, '0')}`;

    // Get patient info
    const patient = await User.findById(req.user._id);
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient profile not found'
      });
    }

    if (!test) {
      return res.status(404).json({
        success: false,
        message: 'Test not found'
      });
    }

    // Generate booking number
    const bookingNumber = `TSB-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Create booking
    const bookingData = {
      patientId: req.user._id,
      testId,
      bookingNumber,
      serialNumber,
      appointmentDate,
      timeSlot: {
        startTime: timeString,
        endTime: endTimeString
      },
      testPrice: serialSettings.testPrice,
      testName: test.name,
      patientName: patient.name,
      patientEmail: patient.email,
      patientPhone: patient.phone,
      status: 'pending'
    };

    if (hospitalId) {
      bookingData.hospitalId = hospitalId;
    } else {
      bookingData.diagnosticCenterId = diagnosticCenterId;
    }

    const booking = await TestSerialBooking.create(bookingData);

    const io = req.app.get('io');

    // Send notification to hospital admins or diagnostic center admins (non-blocking)
    if (hospital && hospital.admins && hospital.admins.length > 0) {
      for (const admin of hospital.admins) {
        if (admin._id) {
          try {
            await createAndSendNotification(
              io,
              admin._id,
              'test_serial_booking',
              'New Test Serial Booking',
              `New test serial booking for ${test.name}: ${patient.name} (${patient.email}, ${patient.phone}) - Serial #${serialNumber}`,
              booking._id,
              'test_booking'
            );
          } catch (notifError) {
            console.error('Failed to send notification to hospital admin:', notifError);
          }
        }
      }
    } else if (diagnosticCenter && diagnosticCenter.admins && diagnosticCenter.admins.length > 0) {
      for (const admin of diagnosticCenter.admins) {
        if (admin._id) {
          try {
            await createAndSendNotification(
              io,
              admin._id,
              'test_serial_booking',
              'New Test Serial Booking',
              `New test serial booking for ${test.name}: ${patient.name} (${patient.email}, ${patient.phone}) - Serial #${serialNumber}`,
              booking._id,
              'test_booking'
            );
          } catch (notifError) {
            console.error('Failed to send notification to diagnostic center admin:', notifError);
          }
        }
      }
    }

    // Send notification to patient (non-blocking)
    try {
      await createAndSendNotification(
        io,
        req.user._id,
        'test_serial_booking',
        'Test Serial Booked',
        `Your test serial for ${test.name} has been booked. Serial #${serialNumber}, Date: ${date}, Time: ${timeString}`,
        booking._id,
        'test_booking'
      );
    } catch (notifError) {
      console.error('Failed to send notification to patient:', notifError);
      // Continue even if notification fails
    }

    res.status(201).json({
      success: true,
      message: 'Test serial booked successfully',
      data: {
        booking: {
          ...booking.toObject(),
          test: {
            id: test._id,
            name: test.name,
            code: test.code,
            category: test.category
          },
          hospital: hospital ? {
            id: hospital._id,
            name: hospital.name
          } : null,
          diagnosticCenter: diagnosticCenter ? {
            id: diagnosticCenter._id,
            name: diagnosticCenter.name
          } : null
        }
      }
    });
  } catch (error) {
    console.error('Book test serial error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to book test serial',
      error: error.message
    });
  }
};

/**
 * GET /api/patient/hospitals/:hospitalId/home-services/:serviceId/serials
 * GET /api/patient/diagnostic-centers/:diagnosticCenterId/home-services/:serviceId/serials
 */
export const getAvailableHomeServiceSerials = async (req, res) => {
  try {
    const { hospitalId, diagnosticCenterId, serviceId } = req.params;
    const { date } = req.query;
    const providerId = hospitalId || diagnosticCenterId;

    if (!mongoose.Types.ObjectId.isValid(providerId) || !mongoose.Types.ObjectId.isValid(serviceId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid provider or service ID'
      });
    }

    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Date is required (format: YYYY-MM-DD)'
      });
    }

    let hospital = null;
    let diagnosticCenter = null;
    let serialSettings = null;

    const homeService = await HomeService.findById(serviceId);
    if (!homeService || !homeService.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Home service not found or not available'
      });
    }

    if (hospitalId) {
      hospital = await Hospital.findById(hospitalId);
      if (!hospital || hospital.status !== 'approved') {
        return res.status(404).json({
          success: false,
          message: 'Hospital not found or not approved'
        });
      }
      if (homeService.hospitalId?.toString() !== hospitalId) {
        return res.status(400).json({
          success: false,
          message: 'Home service does not belong to this hospital'
        });
      }
      serialSettings = await HomeServiceSerialSettings.findOne({
        homeServiceId: serviceId,
        hospitalId,
        isActive: true
      });
    } else if (diagnosticCenterId) {
      diagnosticCenter = await DiagnosticCenter.findById(diagnosticCenterId);
      if (!diagnosticCenter || diagnosticCenter.status !== 'approved') {
        return res.status(404).json({
          success: false,
          message: 'Diagnostic center not found or not approved'
        });
      }
      if (homeService.diagnosticCenterId?.toString() !== diagnosticCenterId) {
        return res.status(400).json({
          success: false,
          message: 'Home service does not belong to this diagnostic center'
        });
      }
      serialSettings = await HomeServiceSerialSettings.findOne({
        homeServiceId: serviceId,
        diagnosticCenterId,
        isActive: true
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Either hospitalId or diagnosticCenterId must be provided'
      });
    }

    if (!serialSettings) {
      return res.status(404).json({
        success: false,
        message: 'Serial booking is not enabled for this home service'
      });
    }

    const dayOfWeek = moment(date).day();
    if (serialSettings.availableDays?.length > 0 && !serialSettings.availableDays.includes(dayOfWeek)) {
      return res.json({
        success: true,
        data: {
          homeService: {
            id: homeService._id,
            serviceType: homeService.serviceType
          },
          hospital: hospital ? { id: hospital._id, name: hospital.name } : null,
          diagnosticCenter: diagnosticCenter ? { id: diagnosticCenter._id, name: diagnosticCenter.name } : null,
          date,
          availableSerials: [],
          totalSerials: serialSettings.totalSerialsPerDay,
          message: 'No serials available on this day'
        }
      });
    }

    const bookingQuery = {
      homeServiceId: serviceId,
      appointmentDate: {
        $gte: moment(date).startOf('day').toDate(),
        $lte: moment(date).endOf('day').toDate()
      },
      status: { $in: ['pending', 'confirmed'] }
    };
    if (hospitalId) {
      bookingQuery.hospitalId = hospitalId;
    } else {
      bookingQuery.diagnosticCenterId = diagnosticCenterId;
    }

    const bookedBookings = await HomeServiceSerialBooking.find(bookingQuery).select('serialNumber');
    const bookedSerialNumbers = bookedBookings.map((b) => b.serialNumber);
    const { availableSerials } = buildAvailableSerials(serialSettings, bookedSerialNumbers);

    res.json({
      success: true,
      data: {
        homeService: {
          id: homeService._id,
          serviceType: homeService.serviceType,
          note: homeService.note
        },
        hospital: hospital ? { id: hospital._id, name: hospital.name } : null,
        diagnosticCenter: diagnosticCenter ? { id: diagnosticCenter._id, name: diagnosticCenter.name } : null,
        date,
        availableSerials,
        totalSerials: serialSettings.totalSerialsPerDay,
        servicePrice: serialSettings.servicePrice,
        timeRange: serialSettings.serialTimeRange,
        bookedCount: bookedBookings.length,
        availableCount: availableSerials.length
      }
    });
  } catch (error) {
    console.error('Get available home service serials error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get available home service serials',
      error: error.message
    });
  }
};

/**
 * POST /api/patient/home-service-serials/book
 */
export const bookHomeServiceSerial = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      hospitalId,
      diagnosticCenterId,
      homeServiceId,
      serialNumber,
      date,
      patientName,
      patientAge,
      patientGender,
      phoneNumber,
      homeAddress,
      notes
    } = req.body;

    if (!hospitalId && !diagnosticCenterId) {
      return res.status(400).json({
        success: false,
        message: 'Either hospitalId or diagnosticCenterId is required'
      });
    }
    if (hospitalId && diagnosticCenterId) {
      return res.status(400).json({
        success: false,
        message: 'Provide either hospitalId or diagnosticCenterId, not both'
      });
    }
    if (!mongoose.Types.ObjectId.isValid(homeServiceId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid home service ID'
      });
    }

    if (!serialNumber || serialNumber % 2 !== 0) {
      return res.status(400).json({
        success: false,
        message: 'Only even-numbered serials can be booked online'
      });
    }

    const appointmentDate = moment(date).startOf('day').toDate();
    const dayOfWeek = moment(date).day();

    let hospital = null;
    let diagnosticCenter = null;
    let serialSettings = null;
    let settingsQuery = { homeServiceId, isActive: true };
    let bookingProviderQuery = {};

    const homeService = await HomeService.findById(homeServiceId);
    if (!homeService || !homeService.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Home service not found or not available'
      });
    }

    if (hospitalId) {
      if (!mongoose.Types.ObjectId.isValid(hospitalId)) {
        return res.status(400).json({ success: false, message: 'Invalid hospital ID' });
      }
      hospital = await Hospital.findById(hospitalId).populate('admins', 'email name phone');
      if (!hospital || hospital.status !== 'approved') {
        return res.status(404).json({
          success: false,
          message: 'Hospital not found or not approved'
        });
      }
      if (homeService.hospitalId?.toString() !== hospitalId) {
        return res.status(400).json({
          success: false,
          message: 'Home service does not belong to this hospital'
        });
      }
      settingsQuery.hospitalId = hospitalId;
      bookingProviderQuery.hospitalId = hospitalId;
    } else {
      if (!mongoose.Types.ObjectId.isValid(diagnosticCenterId)) {
        return res.status(400).json({ success: false, message: 'Invalid diagnostic center ID' });
      }
      diagnosticCenter = await DiagnosticCenter.findById(diagnosticCenterId);
      if (!diagnosticCenter || diagnosticCenter.status !== 'approved') {
        return res.status(404).json({
          success: false,
          message: 'Diagnostic center not found or not approved'
        });
      }
      if (homeService.diagnosticCenterId?.toString() !== diagnosticCenterId) {
        return res.status(400).json({
          success: false,
          message: 'Home service does not belong to this diagnostic center'
        });
      }
      settingsQuery.diagnosticCenterId = diagnosticCenterId;
      bookingProviderQuery.diagnosticCenterId = diagnosticCenterId;
    }

    serialSettings = await HomeServiceSerialSettings.findOne(settingsQuery);

    if (!serialSettings) {
      return res.status(404).json({
        success: false,
        message: 'Serial booking is not enabled for this home service'
      });
    }

    if (serialSettings.availableDays?.length > 0 && !serialSettings.availableDays.includes(dayOfWeek)) {
      return res.status(400).json({
        success: false,
        message: 'Serials are not available on this day'
      });
    }

    const existingBooking = await HomeServiceSerialBooking.findOne({
      homeServiceId,
      ...bookingProviderQuery,
      appointmentDate: {
        $gte: moment(date).startOf('day').toDate(),
        $lte: moment(date).endOf('day').toDate()
      },
      serialNumber,
      status: { $in: ['pending', 'confirmed'] }
    });

    if (existingBooking) {
      return res.status(400).json({
        success: false,
        message: 'This serial is already booked'
      });
    }

    const timeSlot = calculateSerialTimeSlot(serialSettings, serialNumber);
    const patient = await User.findById(req.user._id);
    const bookingNumber = `HSB-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    const bookingData = {
      patientId: req.user._id,
      homeServiceId,
      bookingNumber,
      serialNumber,
      appointmentDate,
      timeSlot,
      servicePrice: serialSettings.servicePrice,
      serviceType: homeService.serviceType,
      patientName,
      patientAge,
      patientGender,
      patientEmail: patient.email,
      patientPhone: phoneNumber || patient.phone,
      homeAddress,
      notes,
      status: 'pending'
    };
    if (hospitalId) {
      bookingData.hospitalId = hospitalId;
    } else {
      bookingData.diagnosticCenterId = diagnosticCenterId;
    }

    const booking = await HomeServiceSerialBooking.create(bookingData);

    const io = req.app.get('io');

    if (hospital?.admins?.length > 0) {
      for (const admin of hospital.admins) {
        if (admin._id) {
          try {
            await createAndSendNotification(
              io,
              admin._id,
              'home_service_serial_booking',
              'New Home Service Serial Booking',
              `New booking for ${homeService.serviceType}: ${patientName} - Serial #${serialNumber} on ${date}`,
              booking._id,
              'home_service_booking'
            );
          } catch (notifError) {
            console.error('Failed to send notification to hospital admin:', notifError);
          }
        }
      }
    }

    if (diagnosticCenter?.userId) {
      try {
        await createAndSendNotification(
          io,
          diagnosticCenter.userId,
          'home_service_serial_booking',
          'New Home Service Serial Booking',
          `New booking for ${homeService.serviceType}: ${patientName} - Serial #${serialNumber} on ${date}`,
          booking._id,
          'home_service_booking'
        );
      } catch (notifError) {
        console.error('Failed to send notification to diagnostic center admin:', notifError);
      }
    }

    if (diagnosticCenter?.admins?.length > 0) {
      for (const adminId of diagnosticCenter.admins) {
        try {
          await createAndSendNotification(
            io,
            adminId,
            'home_service_serial_booking',
            'New Home Service Serial Booking',
            `New booking for ${homeService.serviceType}: ${patientName} - Serial #${serialNumber} on ${date}`,
            booking._id,
            'home_service_booking'
          );
        } catch (notifError) {
          console.error('Failed to send notification to diagnostic center admin:', notifError);
        }
      }
    }

    try {
      await createAndSendNotification(
        io,
        req.user._id,
        'home_service_serial_booking',
        'Home Service Serial Booked',
        `Your home service serial for ${homeService.serviceType} is confirmed. Serial #${serialNumber}, Date: ${date}, Time: ${timeSlot.startTime}`,
        booking._id,
        'home_service_booking'
      );
    } catch (notifError) {
      console.error('Failed to send notification to patient:', notifError);
    }

    res.status(201).json({
      success: true,
      message: 'Home service serial booked successfully',
      data: {
        booking: {
          ...booking.toObject(),
          homeService: {
            id: homeService._id,
            serviceType: homeService.serviceType
          },
          hospital: hospital ? {
            id: hospital._id,
            name: hospital.name
          } : null,
          diagnosticCenter: diagnosticCenter ? {
            id: diagnosticCenter._id,
            name: diagnosticCenter.name
          } : null
        }
      }
    });
  } catch (error) {
    console.error('Book home service serial error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to book home service serial',
      error: error.message
    });
  }
};

/**
 * GET /api/patient/home-service-serials/my-bookings
 */
/**
 * GET /api/patient/test-serials/my-bookings
 */
export const getMyTestSerialBookings = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = { patientId: req.user._id };
    if (status) query.status = status;

    const bookings = await TestSerialBooking.find(query)
      .populate('hospitalId', 'name address logo')
      .populate('diagnosticCenterId', 'name address logo')
      .populate('testId', 'name code category')
      .sort({ appointmentDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await TestSerialBooking.countDocuments(query);

    res.json({
      success: true,
      data: {
        bookings,
        total,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get my test serial bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch test serial bookings',
      error: error.message
    });
  }
};

/**
 * PUT /api/patient/home-service-serials/:bookingId
 */
export const updateMyHomeServiceSerialBooking = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { bookingId } = req.params;
    const booking = await HomeServiceSerialBooking.findOne({
      _id: bookingId,
      patientId: req.user._id
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (['completed', 'cancelled'].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot update a completed or cancelled booking'
      });
    }

    const { status, ...rest } = req.body;
    const updates = { ...rest };
    if (status === 'cancelled') {
      updates.status = 'cancelled';
    } else if (status !== undefined) {
      return res.status(400).json({
        success: false,
        message: 'Patients can only cancel bookings or update booking details'
      });
    }

    const result = await applyHomeServiceSerialBookingFields(booking, updates, {
      cancelledBy: 'patient'
    });

    if (!result.ok) {
      return res.status(400).json({ success: false, message: result.message });
    }

    res.json({
      success: true,
      message: 'Serial booking updated successfully',
      data: { booking: result.booking }
    });
  } catch (error) {
    console.error('Update my home service serial booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update serial booking',
      error: error.message
    });
  }
};

export const getMyHomeServiceSerialBookings = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = { patientId: req.user._id };
    if (status) query.status = status;

    const bookings = await HomeServiceSerialBooking.find(query)
      .populate('hospitalId', 'name address logo contactInfo')
      .populate('diagnosticCenterId', 'name address logo contactInfo')
      .populate('homeServiceId', 'serviceType price note')
      .sort({ appointmentDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await HomeServiceSerialBooking.countDocuments(query);

    res.json({
      success: true,
      data: {
        bookings,
        total,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get my home service serial bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch home service serial bookings',
      error: error.message
    });
  }
};



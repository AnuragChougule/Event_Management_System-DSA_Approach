// server.js

import express from 'express';
import mongoose from 'mongoose';
import bodyParser from 'body-parser';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import Razorpay from 'razorpay';
import nodemailer from 'nodemailer';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true,
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch(err => console.error('MongoDB connection error:', err));

// Schemas
const bookingSchema = new mongoose.Schema({
  fullName: String,
  aadharNumber: String,
  phoneNumber: String,
  gender: String,
  address: String,
  age: Number,
  email: String,
  eventDate: Date,
  event: String,
  hall: String,
  BID: String,
  paymentId: String,
});
const userSchema = new mongoose.Schema({
  email: String,
  username: String,
  password: String,
});
const otpSchema = new mongoose.Schema({
  email: String,
  otp: String,
  expiresAt: Date,
});

// Models
const Booking = mongoose.model('Booking', bookingSchema);
const User = mongoose.model('User', userSchema);
const OTP = mongoose.model('OTP', otpSchema);

// Razorpay setup
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Email setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USERNAME,
    pass: process.env.EMAIL_PASSWORD,
  },
});

let loggedInUserEmail = null;

// Middleware: Log user email for debugging
app.use((req, res, next) => {
  console.log("Logged-in user email:", loggedInUserEmail);
  next();
});

// Helper
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// ──────── ROUTES ───────────────────────────────────────────────

// Send OTP
app.post('/send-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

  try {
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await OTP.findOneAndUpdate({ email }, { otp, expiresAt }, { upsert: true, new: true });

    await transporter.sendMail({
      from: process.env.EMAIL_USERNAME,
      to: email,
      subject: 'Your OTP for Signup',
      html: `<p>Your OTP is <b>${otp}</b>. It expires in 10 minutes.</p>`,
    });

    res.json({ success: true, message: 'OTP sent successfully' });
  } catch (err) {
    console.error('Error in /send-otp:', err);
    res.status(500).json({ success: false, message: 'Failed to send OTP' });
  }
});

// Signup
app.post('/submit-signup', async (req, res) => {
  const { email, username, password, otp } = req.body;
  if (!email || !username || !password || !otp) {
    return res.status(400).json({ success: false, message: 'All fields are required' });
  }

  try {
    const record = await OTP.findOne({ email });
    if (!record) return res.status(400).json({ success: false, message: 'No OTP requested' });
    if (record.expiresAt < new Date()) {
      await OTP.deleteOne({ email });
      return res.status(400).json({ success: false, message: 'OTP expired' });
    }
    if (record.otp !== otp) return res.status(400).json({ success: false, message: 'Invalid OTP' });

    await OTP.deleteOne({ email });

    if (await User.exists({ email })) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    const hashed = await bcrypt.hash(password, 10);
    await new User({ email, username, password: hashed }).save();

    res.json({ success: true, message: 'Signup successful' });
  } catch (err) {
    console.error('Error in /submit-signup:', err);
    res.status(500).json({ success: false, message: 'Server error during signup' });
  }
});

// Login
app.post('/submit-login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ success: false, message: 'Invalid credentials' });
    }
    loggedInUserEmail = email;
    res.json({ success: true, message: 'Login successful' });
  } catch {
    res.status(500).json({ success: false, message: 'Error in login' });
  }
});

// Logout
app.post('/logout', (_req, res) => {
  loggedInUserEmail = null;
  res.json({ message: 'Logged out' });
});

// Get user info
app.get('/get-user-info', async (req, res) => {
  try {
    if (!loggedInUserEmail) {
      return res.json({ success: false, message: "Not logged in" });
    }
    const user = await User.findOne({ email: loggedInUserEmail });
    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }
    res.json({ success: true, email: user.email, username: user.username });
  } catch (err) {
    console.error('Error in /get-user-info:', err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ✨ Update user info
app.post('/update-user-info', async (req, res) => {
  const { username } = req.body;

  if (!loggedInUserEmail) {
    return res.status(401).json({ success: false, message: 'Not logged in' });
  }

  try {
    const updated = await User.findOneAndUpdate(
      { email: loggedInUserEmail },
      { username },
      { new: true }
    );
    if (!updated) return res.status(404).json({ success: false, message: 'User not found' });

    res.json({ success: true, message: 'Profile updated', user: updated });
  } catch (err) {
    console.error('Error in /update-user-info:', err);
    res.status(500).json({ success: false, message: 'Update failed' });
  }
});

// Create Razorpay order
app.post('/create-order', async (req, res) => {
  try {
    const { amount } = req.body;
    const order = await razorpay.orders.create({ amount, currency: 'INR', receipt: `receipt_${Date.now()}` });
    res.json(order);
  } catch {
    res.status(500).json({ message: 'Failed to create Razorpay order' });
  }
});

// Submit booking
app.post('/submit-form', async (req, res) => {
  try {
    await new Booking(req.body).save();
    res.json({ ok: true, message: 'Booking registered successfully' });
  } catch {
    res.status(500).json({ ok: false, message: 'Error in registration' });
  }
});

// 🔁 Get bookings for logged-in user
app.post('/bookings', async (req, res) => {
  const { email } = req.body;

  if (!email || email !== loggedInUserEmail) {
    return res.status(403).json({ success: false, message: 'Unauthorized or email missing' });
  }

  try {
    const userBookings = await Booking.find({ email });
    res.json(userBookings);
  } catch (err) {
    console.error('Error fetching bookings:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve bookings' });
  }
});

// Admin - get all bookings
app.get('/admin/bookings', async (_req, res) => {
  try {
    res.json(await Booking.find({}));
  } catch {
    res.status(500).json({ message: 'Failed to retrieve bookings' });
  }
});

// Hotel-specific dynamic model
const getHotelBookingModel = (hotelName) => {
  const modelName = `${hotelName.replace(/\s+/g, '')}Bookings`;
  if (mongoose.models[modelName]) return mongoose.models[modelName];
  return mongoose.model(modelName, new mongoose.Schema({
    name: String,
    email: String,
    selectedDate: Date,
    event: String,
  }));
};

// Hotel book date
app.post('/hotel/:hotelName/book-date', async (req, res) => {
  const { hotelName } = req.params;
  const { name, email, selectedDate, event } = req.body;

  if (!name || !email || !selectedDate || !event) {
    return res.status(400).json({ success: false, message: 'All fields are required' });
  }

  try {
    const HotelBooking = getHotelBookingModel(hotelName);
    const alreadyBooked = await HotelBooking.findOne({ selectedDate: new Date(selectedDate) });
    if (alreadyBooked) {
      return res.status(400).json({ success: false, message: 'Date already booked' });
    }

    await new HotelBooking({ name, email, selectedDate, event }).save();
    res.json({ success: true, message: 'Booking successful' });
  } catch (err) {
    console.error('Error booking hotel date:', err);
    res.status(500).json({ success: false, message: 'Booking error' });
  }
});

// Get hotel booked dates
app.get('/hotel/:hotelName/booked-dates', async (req, res) => {
  const { hotelName } = req.params;
  try {
    const HotelBooking = getHotelBookingModel(hotelName);
    const bookings = await HotelBooking.find({});
    const dates = bookings.map(b => b.selectedDate);
    res.json(dates);
  } catch (err) {
    console.error('Error fetching booked dates:', err);
    res.status(500).json({ message: 'Failed to fetch booked dates' });
  }
});

// Login check
app.get('/is-logged-in', (req, res) => {
  if (loggedInUserEmail != null) {
    res.json({ loggedIn: true, email: loggedInUserEmail });
  } else {
    res.json({ loggedIn: false });
  }
});

// Serve React build
const buildPath = path.join(__dirname, '../frontend/emsys/build');
app.use(express.static(buildPath));
app.get('*', (_, res) => res.sendFile(path.join(buildPath, 'index.html')));

// Start server
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

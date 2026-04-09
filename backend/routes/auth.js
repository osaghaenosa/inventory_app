const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const router = express.Router();

// Auto-create admin if none exists
async function ensureAdminExists() {
  try {
    const existing = await User.findOne({ role: 'admin' });
    if (!existing) {
      console.log('No admin found — creating default admin account...');
      const hashed = await bcrypt.hash('admin1234', 10);
      await User.create({
        name: 'Admin',
        email: 'admin@inventory.com',
        password: hashed,
        role: 'admin'
      });
      console.log('✓ Default admin created: admin@inventory.com / admin1234');
    }
  } catch (err) {
    console.error('Auto-seed error:', err.message);
  }
}

// Admin login with password gate
router.post('/admin-login', async (req, res) => {
  try {
    const { adminPassword, email, password } = req.body;

    if (!adminPassword || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Validate admin gate password
    if (adminPassword !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ message: 'Invalid admin password' });
    }

    // Ensure admin exists (auto-seed if needed)
    await ensureAdminExists();

    const user = await User.findOne({ email: email.toLowerCase().trim(), role: 'admin' });
    if (!user) {
      return res.status(401).json({ message: 'Admin account not found. Use admin@inventory.com' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error('Admin login error:', err.message);
    res.status(500).json({ message: 'Server error: ' + err.message });
  }
});

// Worker login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ message: 'Server error: ' + err.message });
  }
});

// Setup endpoint - visit http://localhost:5000/api/auth/setup in browser to create admin
router.get('/setup', async (req, res) => {
  try {
    await ensureAdminExists();
    const admin = await User.findOne({ role: 'admin' }).select('-password');
    res.json({ message: 'Setup complete', admin });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

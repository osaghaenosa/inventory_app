const path = require('path');
// Load .env from the backend folder regardless of where node is run from
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

// Validate required env vars
const requiredEnv = ['MONGO_URI', 'JWT_SECRET', 'ADMIN_PASSWORD'];
const missing = requiredEnv.filter(k => !process.env[k]);
if (missing.length > 0) {
  console.error('❌ Missing required env vars:', missing.join(', '));
  console.error('   Check that backend/.env exists and contains these values.');
  process.exit(1);
}

console.log('✓ Environment loaded from', path.join(__dirname, '.env'));
console.log('  MONGO_URI:', process.env.MONGO_URI);

const authRoutes = require('./routes/auth');
const inventoryRoutes = require('./routes/inventory');
const activityRoutes = require('./routes/activity');
const userRoutes = require('./routes/users');
const aiRoutes = require('./routes/ai');
const tableRoutes = require('./routes/tables');
const uploadRoutes = require('./routes/upload');


const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] }
});

global.io = io; // Make io globally available for mongoose hooks
app.set('io', io);
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/users', userRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/tables', tableRoutes);
app.use('/api/upload', uploadRoutes);

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ message: err.message });
});

io.on('connection', (socket) => {
  socket.on('join-admin', () => socket.join('admin-room'));
});

async function seedAdmin() {
  try {
    const User = require('./models/User');
    const bcrypt = require('bcryptjs');
    const existing = await User.findOne({ role: 'admin' });
    if (!existing) {
      const hashed = await bcrypt.hash('admin1234', 10);
      await User.create({ name: 'Admin', email: 'admin@inventory.com', password: hashed, role: 'admin' });
      console.log('✓ Admin created: admin@inventory.com / admin1234');
    } else {
      console.log('✓ Admin exists:', existing.email);
    }
  } catch (err) {
    console.error('Seed error:', err.message);
  }
}

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('✓ Connected to MongoDB');
    await seedAdmin();
    server.listen(process.env.PORT || 5000, () => {
      console.log(`✓ Server running on http://localhost:${process.env.PORT || 5000}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB error:', err.message);
    process.exit(1);
  });

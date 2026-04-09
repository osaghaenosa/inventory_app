const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  role: { type: String, default: 'worker' }
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);

async function seed() {
  if (!process.env.MONGO_URI) {
    console.error('❌ MONGO_URI not found. Check backend/.env');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log('✓ Connected to MongoDB');

  const existing = await User.findOne({ role: 'admin' });
  if (existing) {
    console.log('✓ Admin already exists:', existing.email);
    process.exit(0);
  }

  const hashed = await bcrypt.hash('admin1234', 10);
  await User.create({ name: 'Admin', email: 'admin@inventory.com', password: hashed, role: 'admin' });
  console.log('✓ Admin created: admin@inventory.com / admin1234');

  try {
    const workerHash = await bcrypt.hash('worker123', 10);
    await User.create({ name: 'John Worker', email: 'john@inventory.com', password: workerHash, role: 'worker' });
    console.log('✓ Sample worker created: john@inventory.com / worker123');
  } catch (e) {
    console.log('  (Sample worker already exists)');
  }

  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });

# InventoryOS — Mini Inventory Web App

A full-stack inventory management system with:
- 🔒 Admin access behind a password gate
- 👷 Worker accounts managed by admin
- 📊 Spreadsheet-style daily inventory tracking
- 🔔 Real-time admin notifications via WebSockets
- 📋 Complete activity/audit logs
- 🤖 AI-powered inventory analysis
- 🔐 Daily edit lock (workers can only edit today's records)

---

## Prerequisites

Make sure you have these installed:
- **Node.js** v16 or later → https://nodejs.org
- **MongoDB** (local) → https://www.mongodb.com/try/download/community
  - OR use **MongoDB Atlas** (free cloud) → https://www.mongodb.com/cloud/atlas

---

## Quick Setup (3 steps)

### Step 1 — Install dependencies

Open a terminal in the project folder and run:

```bash
npm install
npm run install-all
```

This installs packages for both the backend and frontend.

---

### Step 2 — Configure environment

Open `backend/.env` and check/edit the values:

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/inventory_db
JWT_SECRET=your_super_secret_jwt_key_change_in_production
ADMIN_PASSWORD=admin1234
ANTHROPIC_API_KEY=your_key_here   ← optional, for AI analysis
```

**Using MongoDB Atlas (cloud)?**
Replace `MONGO_URI` with your Atlas connection string:
```
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/inventory_db
```

**Want AI-powered analysis?**
Add your Anthropic API key to `ANTHROPIC_API_KEY`. Without it, a local summary is generated instead.

---

### Step 3 — Seed the database & start

```bash
# Create admin account + sample worker
npm run seed

# Start the app (opens both backend + frontend)
npm run dev
```

Then open your browser: **http://localhost:3000**

---

## Login Credentials

### Admin Login
- URL: http://localhost:3000/admin-login
- **Step 1 — Admin Gate Password:** `admin1234`
- **Step 2 — Email:** `admin@inventory.com`
- **Step 2 — Password:** `admin1234`

### Sample Worker Login
- URL: http://localhost:3000/login
- **Email:** `john@inventory.com`
- **Password:** `worker123`

---

## How It Works

### Admin can:
- ✅ Log in through a 2-step secure gate (admin password + credentials)
- ✅ Create and delete worker accounts
- ✅ View ALL inventory records from all workers
- ✅ Edit any record regardless of date
- ✅ Delete any record
- ✅ View all activity logs with timestamps
- ✅ Receive live notifications when workers update inventory
- ✅ Run AI analysis reports on any date

### Workers can:
- ✅ Log in to their personal dashboard
- ✅ Add inventory records for **today only**
- ✅ Edit their own records for **today only**
- ✅ View all past records in read-only mode
- ✅ View their own activity log

### Daily Lock System:
Records from previous dates are automatically locked for workers. Only admins can edit past records.

---

## Running in Production

### Backend only:
```bash
npm run start-backend
```

### Frontend only (separate terminal):
```bash
npm run start-frontend
```

### Build frontend for production:
```bash
cd frontend && npm run build
```
Then serve the `frontend/build` folder with a static file server or configure Express to serve it.

---

## Project Structure

```
inventory-app/
├── backend/
│   ├── models/
│   │   ├── User.js           # User schema (admin/worker)
│   │   ├── Inventory.js      # Inventory records schema
│   │   └── ActivityLog.js    # Audit trail schema
│   ├── routes/
│   │   ├── auth.js           # Login endpoints + admin gate
│   │   ├── inventory.js      # CRUD for inventory
│   │   ├── users.js          # Worker management
│   │   ├── activity.js       # Activity log endpoint
│   │   └── ai.js             # AI analysis endpoint
│   ├── middleware/
│   │   └── auth.js           # JWT auth + admin-only guard
│   ├── seed.js               # Creates admin + sample worker
│   ├── server.js             # Express + Socket.io server
│   └── .env                  # Environment config
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── Login.js          # Worker login
│       │   ├── AdminLogin.js     # Admin 2-step login
│       │   ├── WorkerDashboard.js
│       │   └── AdminDashboard.js
│       ├── components/
│       │   ├── Sidebar.js
│       │   ├── InventoryTable.js  # Main spreadsheet-style table
│       │   ├── ActivityLog.js
│       │   ├── WorkerManagement.js
│       │   ├── AIAnalysis.js
│       │   └── AdminStats.js
│       ├── context/AuthContext.js # Auth state management
│       └── utils/api.js           # Axios instance
├── package.json              # Root scripts
└── README.md
```

---

## Troubleshooting

**MongoDB connection error?**
- Make sure MongoDB is running: `mongod` (macOS/Linux) or start it via Windows Services
- Or switch to MongoDB Atlas and update `MONGO_URI`

**Port already in use?**
- Backend: Change `PORT` in `backend/.env`
- Frontend: Set `PORT=3001` before running, e.g. `PORT=3001 npm start`

**Admin login not working?**
- Run `npm run seed` first to create the admin account
- Gate password is `admin1234` (set in `backend/.env` as `ADMIN_PASSWORD`)

**AI analysis shows "local" instead of "AI"?**
- Add a valid `ANTHROPIC_API_KEY` to `backend/.env`

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, React Router, Axios |
| Styling | Custom CSS (dark theme, Space Mono + DM Sans) |
| Backend | Node.js, Express |
| Database | MongoDB + Mongoose |
| Real-time | Socket.io (WebSockets) |
| Auth | JWT (JSON Web Tokens) + bcrypt |
| AI | Anthropic Claude API (optional) |

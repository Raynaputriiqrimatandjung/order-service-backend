// FILE: order-service/api/index.js
const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const cors = require('cors');
const bcrypt = require('bcryptjs'); // Untuk hash password
const jwt = require('jsonwebtoken'); // Untuk token login
const app = express();

require('dotenv').config();

app.use(express.json());
app.use(cors());

// --- KONFIGURASI DATABASE ---
mongoose.connect(process.env.MONGO_URL, { serverSelectionTimeoutMS: 5000 })
    .then(() => console.log('✅ Order & Auth DB Connected...'))
    .catch(err => console.error('❌ DB Error:', err));

const JWT_SECRET = process.env.JWT_SECRET || "rahasia_negara_api_123"; // Ganti nanti di Vercel env

// --- 1. MODEL USER (BARU) ---
const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['admin', 'customer'], default: 'customer' },
    createdAt: { type: Date, default: Date.now }
});
const User = mongoose.models.User || mongoose.model('User', UserSchema);

// --- 2. MODEL TRANSAKSI (UPDATE) ---
const TransactionSchema = new mongoose.Schema({
    user_id: String,       // Siapa yang beli
    user_name: String,
    items: [{              // Bisa beli banyak barang sekaligus
        product_id: String,
        product_name: String,
        quantity: Number,
        price: Number,
        image: String
    }],
    total_price: Number,
    status: { type: String, enum: ['pending', 'process', 'completed', 'cancelled'], default: 'pending' },
    date: { type: Date, default: Date.now }
});
const Transaction = mongoose.models.Transaction || mongoose.model('Transaction', TransactionSchema);


// --- ROUTES: AUTHENTICATION (LOGIN & REGISTER) ---

// REGISTER
app.post('/auth/register', async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        
        // Cek email kembar
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ message: "Email sudah terdaftar!" });

        // Enkripsi password
        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({ 
            name, 
            email, 
            password: hashedPassword, 
            role: role || 'customer' // Default customer
        });
        
        await newUser.save();
        res.status(201).json({ message: "Registrasi Berhasil! Silakan Login." });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// LOGIN
app.post('/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        
        if (!user) return res.status(400).json({ message: "User tidak ditemukan" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: "Password salah!" });

        // Buat Token (KTP Digital)
        const token = jwt.sign({ id: user._id, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '1d' });

        res.json({ 
            token, 
            user: { id: user._id, name: user.name, email: user.email, role: user.role } 
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


// --- ROUTES: TRANSAKSI ---

// BUAT PESANAN (Checkout)
app.post('/transactions', async (req, res) => {
    try {
        // req.body harus berisi: { user_id, items: [{product_id, qty...}] }
        const { user_id, user_name, items, total_price } = req.body;

        const newTx = new Transaction({
            user_id,
            user_name,
            items,
            total_price,
            status: 'pending'
        });

        await newTx.save();
        res.status(201).json(newTx);
    } catch (err) {
        res.status(500).json({ message: "Gagal memproses pesanan", error: err.message });
    }
});

// AMBIL SEMUA ORDER (Untuk Admin / Riwayat)
app.get('/transactions', async (req, res) => {
    try {
        const { user_id } = req.query;
        let filter = {};
        
        // Jika ada user_id, ambil punya user itu saja
        if (user_id) filter = { user_id };

        const history = await Transaction.find(filter).sort({ date: -1 });
        res.json(history);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// UPDATE STATUS PESANAN (Untuk Admin)
app.put('/transactions/:id', async (req, res) => {
    try {
        const { status } = req.body;
        const updated = await Transaction.findByIdAndUpdate(req.params.id, { status }, { new: true });
        res.json(updated);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.get('/', (req, res) => res.json({ message: "Order & Auth Service Ready 🚀" }));

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => console.log(`Order Service running on ${PORT}`));

module.exports = app;
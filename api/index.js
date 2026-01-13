// FILE: order-service/index.js
const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const cors = require('cors');
const app = express();

require('dotenv').config(); 

app.use(express.json());
app.use(cors());

// ==========================================
// 1. TAMBAHAN RUTE HALAMAN DEPAN (ROOT)
// ==========================================
// Ini agar saat link utama dibuka tidak 404
app.get('/', (req, res) => {
    res.json({
        message: "Order Service is Running... 🚀",
        status: "Active",
        routes: {
            transactions: "/transactions"
        }
    });
});

// ==========================================
// 2. KONEKSI DATABASE
// ==========================================
const mongoURI = process.env.MONGO_URL;

// Cek apakah env variable ada (untuk debugging)
if (!mongoURI) {
    console.error("❌ FATAL ERROR: MONGO_URL tidak ditemukan di Environment Variables!");
}

mongoose.connect(mongoURI, {
    serverSelectionTimeoutMS: 5000
})
    .then(() => console.log('Transaction DB Connected... ✅'))
    .catch(err => console.error('DB Connection Error: ❌', err));

// Model Schema
const Transaction = mongoose.model('Transaction', {
    product_id: String,
    product_name: String,
    quantity: Number,
    total_price: Number,
    date: { type: Date, default: Date.now }
});

// ==========================================
// 3. RUTE TRANSAKSI
// ==========================================

// CREATE TRANSACTION
app.post('/transactions', async (req, res) => {
    try {
        const { product_id, quantity } = req.body;

        const PRODUCT_URL = process.env.PRODUCT_SERVICE_URL; 
        
        if (!PRODUCT_URL) {
            throw new Error("PRODUCT_SERVICE_URL belum disetting di Vercel!");
        }

        // Panggil Product Service
        const response = await axios.get(`${PRODUCT_URL}/products/${product_id}`);
        const productData = response.data;

        if (!productData) {
            return res.status(404).json({ message: "Produk tidak ditemukan di katalog" });
        }

        // Hitung total
        const total_price = productData.price * quantity;

        const newTransaction = new Transaction({
            product_id: product_id,
            product_name: productData.name,
            quantity: quantity,
            total_price: total_price
        });

        await newTransaction.save();
        res.status(201).json(newTransaction);

    } catch (err) {
        console.error("Error Transaksi:", err.message);
        res.status(500).json({ 
            message: "Gagal transaksi. Pastikan Product Service aktif.",
            error: err.message 
        });
    }
});

// READ ALL TRANSACTIONS
app.get('/transactions', async (req, res) => {
    try {
        const history = await Transaction.find().sort({ date: -1 });
        res.json(history);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Listener
const PORT = process.env.PORT || 3002;
app.listen(PORT, () => console.log(`Transaction Service running on port ${PORT}`));

module.exports = app;
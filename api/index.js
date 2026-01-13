// FILE: order-service/index.js (atau transaction-service)
const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const cors = require('cors');
const app = express();

require('dotenv').config(); // Pastikan baris ini ada

app.use(express.json());
app.use(cors());

// --- PERUBAHAN 1: DATABASE ---
const mongoURI = process.env.MONGO_URL;

mongoose.connect(mongoURI, {
    serverSelectionTimeoutMS: 5000
})
    .then(() => console.log('Transaction DB Connected... ✅'))
    .catch(err => console.error('DB Connection Error: ❌', err));

const Transaction = mongoose.model('Transaction', {
    product_id: String,
    product_name: String,
    quantity: Number,
    total_price: Number,
    date: { type: Date, default: Date.now }
});

// CREATE TRANSACTION
app.post('/transactions', async (req, res) => {
    try {
        const { product_id, quantity } = req.body;

        // --- PERUBAHAN 2: URL PRODUK DINAMIS ---
        // Kita ambil URL Product Service dari Environment Variable
        // Contoh nanti di Vercel diisi: https://product-service-kappa.vercel.app
        const PRODUCT_URL = process.env.PRODUCT_SERVICE_URL; 
        
        if (!PRODUCT_URL) {
            throw new Error("PRODUCT_SERVICE_URL belum disetting di Vercel!");
        }

        // Panggil Product Service yang sudah online
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
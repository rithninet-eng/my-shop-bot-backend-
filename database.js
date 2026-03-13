const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;
if (!uri) {
    throw new Error('MONGODB_URI is not set in environment variables. The bot cannot connect to the database.');
}
const client = new MongoClient(uri);

let db;

async function connect() {
    if (db) return;
    await client.connect();
    db = client.db("myShopBotDb"); // You can name your database
    console.log("Successfully connected to MongoDB.");
}

const getCollection = (name) => db.collection(name);

async function loadDoc(collectionName, docId, defaultValue) {
    const collection = getCollection(collectionName);
    const doc = await collection.findOne({ _id: docId });
    if (!doc) {
        await collection.insertOne({ _id: docId, data: defaultValue });
        return defaultValue;
    }
    return doc.data;
}

async function saveDoc(collectionName, docId, data) {
    const collection = getCollection(collectionName);
    await collection.updateOne({ _id: docId }, { $set: { data: data } }, { upsert: true });
}

module.exports = {
    connect,

    loadSettings: () => loadDoc('app_data', 'userSettings', {}),
    saveSettings: (settings) => saveDoc('app_data', 'userSettings', settings),

    async loadUsers() {
        const usersCollection = getCollection('users');
        const users = await usersCollection.find().toArray();
        return new Set(users.map(u => u.userId));
    },

    async addUser(userId) {
        const usersCollection = getCollection('users');
        await usersCollection.updateOne({ userId }, { $set: { userId } }, { upsert: true });
    },

    loadProducts: () => loadDoc('app_data', 'products', {
        "💎 Premium": [
            { name: "CapCut Pro 1 Year", description: "Edit វីដេអូគ្មាន Watermark", price: "5.00", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/CapCut_logo.svg/1200px-CapCut_logo.svg.png" },
            { name: "YouTube Premium", description: "មើលគ្មានពាណិជ្ជកម្ម", price: "3.00", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/e/ef/Youtube_logo.png" },
            { name: "Netflix (4K)", description: "មើលរឿងកម្រិត 4K", price: "4.00", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/0/08/Netflix_2015_logo.svg" }
        ],
        "🎮 Games": []
    }),
    saveProducts: (products) => saveDoc('app_data', 'products', products),

    loadStock: () => loadDoc('app_data', 'productStock', {
        'CapCut Pro 1 Year': [],
        'YouTube Premium': [],
        'Netflix 4K': []
    }),
    saveStock: (stock) => saveDoc('app_data', 'productStock', stock),

    async loadSales() {
        const salesCollection = getCollection('sales');
        return await salesCollection.find().toArray();
    },

    async saveSale(saleRecord) {
        const salesCollection = getCollection('sales');
        await salesCollection.insertOne(saleRecord);
    },
};
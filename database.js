const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
}

const usersPath = path.join(dataDir, 'users.json');
const productsPath = path.join(dataDir, 'products.json');
const stockPath = path.join(dataDir, 'stock.json');
const salesPath = path.join(dataDir, 'sales.json');
const settingsPath = path.join(dataDir, 'settings.json');

const defaultData = {
    users: [],
    products: {
        "💎 Premium": [
            { name: "CapCut Pro 1 Year", description: "Edit វីដេអូគ្មាន Watermark", price: "5.00", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/CapCut_logo.svg/1200px-CapCut_logo.svg.png" },
            { name: "YouTube Premium", description: "មើលគ្មានពាណិជ្ជកម្ម", price: "3.00", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/e/ef/Youtube_logo.png" },
            { name: "Netflix (4K)", description: "មើលរឿងកម្រិត 4K", price: "4.00", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/0/08/Netflix_2015_logo.svg" }
        ],
        "🎮 Games": []
    },
    stock: {
        'CapCut Pro 1 Year': [],
        'YouTube Premium': [],
        'Netflix 4K': []
    },
    sales: [],
    settings: {} // { userId: { lang: 'km' } }
};

function loadData(filePath, defaultValue) {
    try {
        if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            return JSON.parse(fileContent);
        }
        fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2), 'utf-8');
        return defaultValue;
    } catch (error) {
        console.error(`Error loading ${filePath}:`, error);
        return defaultValue;
    }
}

function saveData(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
        console.error(`Error saving ${filePath}:`, error);
    }
}

module.exports = {
    loadUsers: () => new Set(loadData(usersPath, defaultData.users)),
    saveUsers: (usersSet) => saveData(usersPath, Array.from(usersSet)),
    loadProducts: () => loadData(productsPath, defaultData.products),
    saveProducts: (products) => saveData(productsPath, products),
    loadStock: () => loadData(stockPath, defaultData.stock),
    saveStock: (stock) => saveData(stockPath, stock),
    loadSales: () => loadData(salesPath, defaultData.sales),
    saveSales: (sales) => saveData(salesPath, sales),
    loadSettings: () => loadData(settingsPath, defaultData.settings),
    saveSettings: (settings) => saveData(settingsPath, settings),
};
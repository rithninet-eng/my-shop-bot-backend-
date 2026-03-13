const fs = require('fs');
const path = require('path');

const locales = {};
const localesDir = path.join(__dirname, 'locales');

try {
    // Check if the 'locales' directory exists before trying to read it
    if (fs.existsSync(localesDir)) {
        // Load all language files from the 'locales' directory
        fs.readdirSync(localesDir).forEach(file => {
            if (file.endsWith('.json')) {
                const lang = file.split('.')[0];
                const content = fs.readFileSync(path.join(localesDir, file), 'utf-8');
                locales[lang] = JSON.parse(content);
            }
        });
    }
} catch (error) {
    console.error('Critical error: Could not load language files. Bot might not respond correctly.', error);
}

const t = (lang, key) => {
    // Default to Khmer if language not found or key not found in the language
    return locales[lang]?.[key] || locales['km']?.[key] || key;
};

module.exports = { t };
const { Telegraf, Markup, Scenes, session } = require('telegraf');
const http = require('http');
const axios = require('axios'); // នាំចូល axios
const db = require('./database.js'); // នាំចូល database helper
const { t } = require('./i18n.js'); // នាំចូល i18n helper
require('dotenv').config(); // ហៅ dotenv មកប្រើ

// ជំនួស 'YOUR_BOT_TOKEN' ជាមួយ Token ដែលបានពី BotFather
const bot = new Telegraf(process.env.BOT_TOKEN);

// ដាក់ ID របស់ Admin នៅទីនេះ (ដើម្បីទទួលសារជូនដំណឹង)
const ADMIN_ID = process.env.ADMIN_ID; 

// យក Token សម្រាប់ប្រព័ន្ធទូទាត់ប្រាក់ពី BotFather
const PAYMENT_PROVIDER_TOKEN = process.env.PAYMENT_PROVIDER_TOKEN;

// Global variables for data
let userIds;
let productStock;
let products;
let salesHistory;
let userSettings;

// Helper function to get user language
const getUserLang = (ctx) => {
  return userSettings[ctx.from?.id]?.lang || 'km'; // Default to Khmer
};

bot.use(session()); // បើកដំណើរការ session

// ២. Middleware ដើម្បីចាប់យក ID អ្នកប្រើប្រាស់គ្រប់គ្នាដែលឆាតមក
bot.use((ctx, next) => {
  if (ctx.from) {
    if (!userIds.has(ctx.from.id)) {
      userIds.add(ctx.from.id);
      db.addUser(ctx.from.id); // រក្សាទុក User ID ថ្មី
    }
    // Set default language for new users
    if (!userSettings[ctx.from.id]) {
      userSettings[ctx.from.id] = { lang: 'km' };
      db.saveSettings(userSettings);
    }
  }
  return next();
});

// ៣. Command សម្រាប់ Admin ផ្ញើសារ Broadcast
bot.command('broadcast', async (ctx) => {
  // ឆែកមើលថាអ្នកផ្ញើជា Admin ឬអត់
  const lang = getUserLang(ctx);
  if (String(ctx.from.id) !== ADMIN_ID) return ctx.reply(t(lang, 'no_permission'));

  // យកសារដែល Admin បានសរសេរ (កាត់ពាក្យ /broadcast ចេញ)
  const message = ctx.payload; 
  if (!message) return ctx.reply(t(lang, 'broadcast_usage'));

  let sentCount = 0;
  for (const id of userIds) {
    try {
      await bot.telegram.sendMessage(id, `${t(getUserLang({ from: { id } }), 'broadcast_header')}\n\n${message}`, { parse_mode: 'HTML' });
      sentCount++;
    } catch (e) {
      // រំលងចោល បើផ្ញើមិនចេញ (ករណីគេ Block Bot)
    }
  }
  ctx.reply(`✅ បានផ្ញើសារជោគជ័យទៅកាន់ ${sentCount} នាក់។`);
});

// កំណត់បញ្ជី Command សម្រាប់អ្នកប្រើប្រាស់ទូទៅ និង Admin
const defaultCommands = [
  { command: 'start', description: 'Start the bot' },
  { command: 'help', description: 'Get help' }
];

const adminCommands = [
  ...defaultCommands,
  { command: 'admin_help', description: '📋 បង្ហាញ Command សម្រាប់ Admin' }
];

// កំណត់ Menu Button (បញ្ជី Command ដែលបង្ហាញក្នុងប៊ូតុង Menu)
// សម្រាប់អ្នកប្រើប្រាស់ទូទៅ
bot.telegram.setMyCommands(defaultCommands);

// កំណត់ Description (អក្សរដែលបង្ហាញធំៗមុនពេលចុច Start)
bot.telegram.setMyDescription('សួស្ដី! នេះគឺជា Bot ដែលមាន Mini App សម្រាប់សាកល្បង។ សូមចុច Start ដើម្បីចាប់ផ្តើម។');

// កំណត់ Short Description (អក្សរដែលបង្ហាញក្នុង Profile និងពេល Share Link)
bot.telegram.setMyShortDescription('Mini App Bot ដោយប្រើ Node.js');

// ដាក់ Link វេបសាយរបស់អ្នកនៅទីនេះ (ត្រូវតែជា HTTPS)
// ឧទាហរណ៍៖ https://yourusername.github.io/your-repo/
const webAppUrl = process.env.WEB_APP_URL || 'https://rithninet-eng.github.io/my-mini-app-frontend/';

// កំណត់ Menu Button ឱ្យជាប់នៅខាងឆ្វេងកន្លែងវាយអក្សរ (ជំនួសឱ្យប៊ូតុង Menu ធម្មតា)
bot.telegram.setChatMenuButton({
  menuButton: {
    type: 'web_app',
    text: '🛒 ហាង', // អក្សរដែលបង្ហាញលើប៊ូតុង
    web_app: { url: webAppUrl }
  }
});

bot.command('start', async (ctx) => {
  // ពិនិត្យមើលថាតើអ្នកប្រើប្រាស់ជា Admin ឬអត់
  if (String(ctx.from.id) === ADMIN_ID) {
    const lang = getUserLang(ctx);
    // កំណត់ Command ពិសេសសម្រាប់ Admin
    await bot.telegram.setMyCommands(adminCommands, { scope: { type: 'chat', chat_id: ctx.from.id } });
    await ctx.reply(t(lang, 'welcome_admin'));
  }

  ctx.reply(
    t(getUserLang(ctx), 'welcome_user'),
    Markup.keyboard([
      [Markup.button.webApp('🛒 បើកហាង', webAppUrl)],
      ['ទាក់ទងមកពួកយើង 📞', 'ចូល Channel 📢'],
      ['🌐 ភាសា/Language'] // បន្ថែមប៊ូតុងភាសា
    ]).resize()
  );
});

// ឆ្លើយតបពេលចុច "ទាក់ទងមកពួកយើង 📞"
bot.hears('ទាក់ទងមកពួកយើង 📞', (ctx) => {
  ctx.reply(t(getUserLang(ctx), 'contact_us_info'));
});

// ឆ្លើយតបពេលចុច "ចូល Channel 📢"
bot.hears('ចូល Channel 📢', (ctx) => {
  ctx.reply(t(getUserLang(ctx), 'join_channel_prompt'));
});

// Handler សម្រាប់ប៊ូតុងប្តូរភាសា
bot.hears('🌐 ភាសា/Language', (ctx) => {
  ctx.reply(
      t(getUserLang(ctx), 'language_select_prompt'),
      Markup.inlineKeyboard([
          Markup.button.callback('English 🇬🇧', 'set_lang_en'),
          Markup.button.callback('ខ្មែរ 🇰🇭', 'set_lang_km')
      ])
  );
});
 
// Action សម្រាប់ប៊ូតុងប្តូរភាសា
bot.action(/set_lang_(.+)/, async (ctx) => {
    const langCode = ctx.match[1];
    if (langCode === 'en' || langCode === 'km') {
        userSettings[ctx.from.id] = { ...userSettings[ctx.from.id], lang: langCode };
        await db.saveSettings(userSettings);
        ctx.answerCbQuery(t(langCode, `language_set_to_${langCode}`));
        ctx.editMessageText(t(langCode, 'language_changed'));
    }
});

// --- ផ្នែកគ្រប់គ្រងការបន្ថែម និងកែប្រែផលិតផល (Scenes) ---
const addProductScene = new Scenes.BaseScene('addProductScene');

addProductScene.enter((ctx) => ctx.reply('សូមបញ្ចូលឈ្មោះ Category:'));

addProductScene.on('text', async (ctx) => {
  const sceneState = ctx.scene.state;
  const text = ctx.message.text;

  if (!sceneState.category) {
    sceneState.category = text;
    return ctx.reply('សូមបញ្ចូលឈ្មោះផលិតផល:');
  }
  if (!sceneState.name) {
    sceneState.name = text;
    return ctx.reply('សូមបញ្ចូលការពិពណ៌នា (Description):');
  }
  if (!sceneState.description) {
    sceneState.description = text;
    return ctx.reply('សូមបញ្ចូលតម្លៃ (ឧទាហរណ៍: 5.00):');
  }
  if (!sceneState.price) {
    // Validate price
    if (isNaN(parseFloat(text))) {
      return ctx.reply('តម្លៃមិនត្រឹមត្រូវ! សូមបញ្ចូលជាលេខ (ឧទាហរណ៍: 5.00):');
    }
    sceneState.price = text;
    return ctx.reply('សូមផ្ញើរូបភាពសម្រាប់ផលិតផល:');
  }
});

addProductScene.on('photo', async (ctx) => {
    const sceneState = ctx.scene.state;

    if (!sceneState.price) {
        return ctx.reply('សូមបំពេញព័ត៌មានមុននឹងផ្ញើរូបភាព។');
    }

    await ctx.reply('កំពុង Upload រូបភាព...');

    try {
        const photo = ctx.message.photo.pop(); // Get the largest photo
        const fileDetails = await ctx.telegram.getFile(photo.file_id);
        const imageUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${fileDetails.file_path}`;

        const { category, name, description, price } = sceneState;

        // បង្កើត Category បើមិនទាន់មាន
        if (!products[category]) {
            products[category] = [];
        }

        products[category].push({ name, description, price, imageUrl });
        await db.saveProducts(products); // រក្សាទុកផលិតផលទៅកាន់ Database

        await ctx.reply(`✅ បានបន្ថែមផលិតផល "${name}" ទៅក្នុង Category "${category}" ដោយជោគជ័យ!`);

    } catch (error) {
        console.error('Error uploading photo:', error);
        await ctx.reply('❌ មានបញ្ហាក្នុងការ Upload រូបភាព។ សូមព្យាយាមម្តងទៀត។');
    }

    return ctx.scene.leave();
});

addProductScene.command('cancel', (ctx) => {
    ctx.reply('បានបោះបង់ការបន្ថែមផលិតផល។');
    return ctx.scene.leave();
});

addProductScene.on('message', (ctx) => {
    if (ctx.scene.state.price) {
        return ctx.reply('សូមផ្ញើរូបភាពសម្រាប់ផលិតផល ឬវាយ /cancel ដើម្បីបោះបង់។');
    }
    return ctx.reply('សូមបញ្ចូលព័ត៌មានតាមលំដាប់។');
});

const editProductScene = new Scenes.BaseScene('editProductScene');

editProductScene.enter((ctx) => ctx.reply('សូមបញ្ចូលឈ្មោះផលិតផលដែលអ្នកចង់កែប្រែ: (ឬវាយ /cancel ដើម្បីបោះបង់)'));

editProductScene.on('text', async (ctx) => {
    const state = ctx.scene.state;
    const text = ctx.message.text;

    if (!state.product) {
        let foundProduct = null;
        let categoryOfProduct = null;
        for (const category in products) {
            const p = products[category].find(prod => prod.name.toLowerCase() === text.toLowerCase());
            if (p) {
                foundProduct = p;
                categoryOfProduct = category;
                break;
            }
        }

        if (foundProduct) {
            state.product = { ...foundProduct };
            state.originalName = foundProduct.name;
            state.category = categoryOfProduct;
            await ctx.replyWithHTML(
                `<b>ផលិតផល:</b> ${foundProduct.name}\n` +
                `<b>តម្លៃ:</b> $${foundProduct.price}\n` +
                `<b>ការពិពណ៌នា:</b> ${foundProduct.description}`
            );
            return ctx.reply('តើអ្នកចង់កែប្រែអ្វី?', Markup.inlineKeyboard([
                [Markup.button.callback('✏️ ការពិពណ៌នា', 'edit_description')],
                [Markup.button.callback('💰 តម្លៃ', 'edit_price')],
                [Markup.button.callback('🖼️ រូបភាព', 'edit_imageUrl')]
            ]));
        } else {
            await ctx.reply(`❌ រកមិនឃើញផលិតផលឈ្មោះ "${text}" ទេ។`);
            return ctx.scene.leave();
        }
    }

    if (state.editing && state.editing !== 'imageUrl') {
        const fieldToEdit = state.editing;
        if (fieldToEdit === 'price' && isNaN(parseFloat(text))) {
            return ctx.reply('តម្លៃមិនត្រឹមត្រូវ! សូមបញ្ចូលជាលេខ (ឧទាហរណ៍: 5.00):');
        }
        state.product[fieldToEdit] = text;
        const productIndex = products[state.category].findIndex(p => p.name === state.originalName);
        if (productIndex !== -1) {
            products[state.category][productIndex] = state.product;
            await db.saveProducts(products); // រក្សាទុកការផ្លាស់ប្តូរ
        }
        await ctx.reply(`✅ បានកែប្រែ "${fieldToEdit}" សម្រាប់ផលិតផល "${state.product.name}" ដោយជោគជ័យ!`);
        return ctx.scene.leave();
    }
});

editProductScene.action('edit_description', (ctx) => {
    ctx.scene.state.editing = 'description';
    ctx.answerCbQuery();
    return ctx.editMessageText('សូមបញ្ចូលការពិពណ៌នាថ្មី:');
});

editProductScene.action('edit_price', (ctx) => {
    ctx.scene.state.editing = 'price';
    ctx.answerCbQuery();
    return ctx.editMessageText('សូមបញ្ចូលតម្លៃថ្មី:');
});

editProductScene.action('edit_imageUrl', (ctx) => {
    ctx.scene.state.editing = 'imageUrl';
    ctx.answerCbQuery();
    return ctx.editMessageText('សូមផ្ញើរូបភាពថ្មី:');
});

editProductScene.on('photo', async (ctx) => {
    const state = ctx.scene.state;
    if (!state.product || state.editing !== 'imageUrl') {
        return; // Not expecting a photo right now
    }

    await ctx.reply('កំពុង Upload រូបភាពថ្មី...');

    try {
        const photo = ctx.message.photo.pop();
        const fileDetails = await ctx.telegram.getFile(photo.file_id);
        const newImageUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${fileDetails.file_path}`;

        // Update the product
        state.product.imageUrl = newImageUrl;
        const productIndex = products[state.category].findIndex(p => p.name === state.originalName);
        if (productIndex !== -1) {
            products[state.category][productIndex] = state.product;
        }
        await db.saveProducts(products); // រក្សាទុកការផ្លាស់ប្តូរ

        await ctx.reply(`✅ បានកែប្រែរូបភាពសម្រាប់ផលិតផល "${state.product.name}" ដោយជោគជ័យ!`);
    } catch (error) {
        console.error('Error uploading new photo:', error);
        await ctx.reply('❌ មានបញ្ហាក្នុងការ Upload រូបភាពថ្មី។ សូមព្យាយាមម្តងទៀត។');
    }

    return ctx.scene.leave();
});

editProductScene.command('cancel', (ctx) => ctx.scene.leave(ctx.reply('បានបោះបង់ការកែប្រែ។')));

const addStockScene = new Scenes.BaseScene('addStockScene');

addStockScene.enter(async (ctx) => {
    const allProducts = Object.values(products).flat();
    if (allProducts.length === 0) {
        await ctx.reply('❌ មិនមានផលិតផលសម្រាប់បន្ថែមស្តុកទេ។ សូមបន្ថែមផលិតផលជាមុនសិន។');
        return ctx.scene.leave();
    }

    const productButtons = allProducts.map(p => Markup.button.callback(p.name, `select_stock_product_${p.name.replace(/ /g, '_')}`));

    const rows = [];
    for (let i = 0; i < productButtons.length; i += 2) {
        rows.push(productButtons.slice(i, i + 2));
    }

    await ctx.reply('សូមជ្រើសរើសផលិតផលដែលអ្នកចង់បន្ថែមស្តុក:', Markup.inlineKeyboard(rows));
});

addStockScene.action(/select_stock_product_(.+)/, async (ctx) => {
    const productName = ctx.match[1].replace(/_/g, ' ');
    ctx.scene.state.productName = productName;
    await ctx.answerCbQuery();
    await ctx.editMessageText(`✅ បានជ្រើសរើស៖ ${productName}`);
    return ctx.replyWithHTML(
        `សូមបញ្ចូលព័ត៌មានគណនីសម្រាប់ <b>${productName}</b>។\n\n` +
        'អ្នកអាចបន្ថែមច្រើនគណនីក្នុងពេលតែមួយ ដោយដាក់មួយបន្ទាត់មួយគណនី។\n\n' +
        '<b>ទម្រង់៖</b> <code>email|password</code>'
    );
});

addStockScene.on('text', async (ctx) => {
    const { productName } = ctx.scene.state;
    if (!productName) {
        await ctx.reply('សូមជ្រើសរើសផលិតផលជាមុនសិន។');
        return ctx.scene.reenter();
    }

    const newAccounts = ctx.message.text.split('\n').map(line => line.trim()).filter(line => line);
    if (newAccounts.length === 0) {
        await ctx.reply('អ្នកមិនបានបញ្ចូលព័ត៌មានគណនីទេ។ សូមព្យាយាមម្តងទៀត ឬវាយ /cancel ។');
        return;
    }

    if (!productStock[productName]) {
        productStock[productName] = [];
    }

    productStock[productName].push(...newAccounts);
    await db.saveStock(productStock);

    await ctx.reply(`✅ បានបន្ថែម ${newAccounts.length} គណនីថ្មីទៅ "${productName}" ដោយជោគជ័យ។\n📦 ស្តុកសរុបឥឡូវនេះគឺ៖ ${productStock[productName].length}`);

    return ctx.scene.leave();
});

addStockScene.command('cancel', (ctx) => {
    ctx.reply('បានបោះបង់ការបន្ថែមស្តុក។');
    return ctx.scene.leave();
});

const editStockScene = new Scenes.BaseScene('editStockScene');

editStockScene.enter(async (ctx) => {
    const lang = getUserLang(ctx);
    const productsWithStock = Object.keys(productStock).filter(p => productStock[p] && productStock[p].length > 0);

    if (productsWithStock.length === 0) {
        await ctx.reply('❌ មិនមានផលិតផលណាមួយមានស្តុកសម្រាប់កែប្រែទេ។');
        return ctx.scene.leave();
    }

    const productButtons = productsWithStock.map(p => Markup.button.callback(p, `select_edit_stock_${p.replace(/ /g, '_')}`));

    const rows = [];
    for (let i = 0; i < productButtons.length; i += 2) {
        rows.push(productButtons.slice(i, i + 2));
    }

    await ctx.reply('សូមជ្រើសរើសផលិតផលដែលអ្នកចង់កែប្រែស្តុក:', Markup.inlineKeyboard(rows));
});

editStockScene.action(/select_edit_stock_(.+)/, async (ctx) => {
    const productName = ctx.match[1].replace(/_/g, ' ');
    ctx.scene.state.productName = productName;
    const stockList = productStock[productName];

    if (!stockList || stockList.length === 0) {
        await ctx.answerCbQuery();
        await ctx.editMessageText(`❌ ផលិតផល "${productName}" នេះអស់ពីស្តុកហើយ។`);
        return ctx.scene.leave();
    }

    ctx.scene.state.accounts = stockList;

    const accountButtons = stockList.map((account, index) => {
        const displayText = `${index + 1}. ${account.substring(0, 20)}...`;
        return Markup.button.callback(displayText, `edit_stock_account_${index}`);
    });

    const rows = accountButtons.map(btn => [btn]); // One button per row

    await ctx.answerCbQuery();
    await ctx.editMessageText(`សូមជ្រើសរើសគណនីសម្រាប់ "${productName}" ដែលអ្នកចង់កែប្រែ:`, Markup.inlineKeyboard(rows));
});

editStockScene.action(/edit_stock_account_(.+)/, async (ctx) => {
    const accountIndex = parseInt(ctx.match[1], 10);
    ctx.scene.state.accountIndex = accountIndex;
    const oldAccount = ctx.scene.state.accounts[accountIndex];

    await ctx.answerCbQuery();
    await ctx.editMessageText(`គណនីបច្ចុប្បន្ន៖\n<code>${oldAccount}</code>\n\nសូមបញ្ចូលព័ត៌មានគណនីថ្មី (ទម្រង់: email|password):`, { parse_mode: 'HTML' });
});

editStockScene.on('text', async (ctx) => {
    const { productName, accountIndex } = ctx.scene.state;
    if (productName === undefined || accountIndex === undefined) return;

    const newAccountInfo = ctx.message.text.trim();
    const oldAccountInfo = productStock[productName][accountIndex];
    productStock[productName][accountIndex] = newAccountInfo;
    await db.saveStock(productStock);

    await ctx.replyWithHTML(`✅ បានកែប្រែព័ត៌មានគណនីដោយជោគជ័យ។\n\n<b>ពី:</b> <code>${oldAccountInfo}</code>\n<b>ទៅ:</b> <code>${newAccountInfo}</code>`);
    return ctx.scene.leave();
});

editStockScene.command('cancel', (ctx) => {
    ctx.reply('បានបោះបង់ការកែប្រែស្តុក។');
    return ctx.scene.leave();
});

editStockScene.on('message', (ctx) => {
    ctx.reply('សូមធ្វើតាមការណែនាំ ឬវាយ /cancel ដើម្បីបោះបង់។');
});

const stage = new Scenes.Stage([addProductScene, editProductScene, addStockScene, editStockScene]);
bot.use(stage.middleware());

// Command សម្រាប់ Admin លុបផលិតផល
bot.command('delete_product', async (ctx) => {
  if (String(ctx.from.id) !== ADMIN_ID) return ctx.reply(t(getUserLang(ctx), 'no_permission'));

  const productNameToDelete = ctx.payload.trim();
  if (!productNameToDelete) {
    return ctx.reply('⚠️ របៀបប្រើ៖ /delete_product [ឈ្មោះផលិតផល]');
  }

  let productFound = false;
  for (const category in products) {
    const productIndex = products[category].findIndex(p => p.name.toLowerCase() === productNameToDelete.toLowerCase());
    if (productIndex !== -1) {
      products[category].splice(productIndex, 1);
      await db.saveProducts(products); // រក្សាទុកការផ្លាស់ប្តូរ
      productFound = true;
      break; // បញ្ឈប់ការស្វែងរកពេលរកឃើញ និងលុបរួច
    }
  }

  if (productFound) {
    ctx.reply(`✅ បានលុបផលិតផល "${productNameToDelete}" ចេញដោយជោគជ័យ!`);
  } else {
    ctx.reply(`❌ រកមិនឃើញផលិតផលឈ្មោះ "${productNameToDelete}" ទេ។`);
  }
});

// Command សម្រាប់ Admin ប្តូរឈ្មោះ Category
bot.command('rename_category', async (ctx) => {
  if (String(ctx.from.id) !== ADMIN_ID) return ctx.reply(t(getUserLang(ctx), 'no_permission'));

  const args = ctx.payload.split(';').map(arg => arg.trim());
  if (args.length !== 2) {
    return ctx.replyWithHTML(
      '⚠️ <b>របៀបប្រើមិនត្រឹមត្រូវ</b>\n\n' +
      'សូមប្រើទម្រង់៖\n' +
      '<code>/rename_category &lt;ឈ្មោះចាស់&gt;; &lt;ឈ្មោះថ្មី&gt;</code>\n\n' +
      '<b>ឧទាហរណ៍៖</b>\n' +
      '<code>/rename_category 💎 Premium; ✨ Premium Accounts</code>'
    );
  }

  const [oldName, newName] = args;

  if (oldName === newName) {
    return ctx.reply('⚠️ ឈ្មោះថ្មី និងឈ្មោះចាស់ដូចគ្នា។');
  }

  if (products.hasOwnProperty(oldName)) {
    if (products.hasOwnProperty(newName)) {
      return ctx.reply(`❌ Category ឈ្មោះ "${newName}" មានរួចហើយ។`);
    }
    products[newName] = products[oldName];
    delete products[oldName];
    await db.saveProducts(products); // រក្សាទុកការផ្លាស់ប្តូរ
    ctx.reply(`✅ បានប្តូរឈ្មោះ Category ពី "${oldName}" ទៅជា "${newName}" ដោយជោគជ័យ!`);
  } else {
    ctx.reply(`❌ រកមិនឃើញ Category ឈ្មោះ "${oldName}" ទេ។`);
  }
});

// Command សម្រាប់ Admin លុប Category ទាំងមូល
bot.command('delete_category', async (ctx) => {
  if (String(ctx.from.id) !== ADMIN_ID) return ctx.reply(t(getUserLang(ctx), 'no_permission'));

  const categoryToDelete = ctx.payload.trim();
  if (!categoryToDelete) {
    return ctx.replyWithHTML(
      '⚠️ <b>របៀបប្រើមិនត្រឹមត្រូវ</b>\n\n' +
      'សូមប្រើទម្រង់៖\n' +
      '<code>/delete_category &lt;ឈ្មោះ Category&gt;</code>'
    );
  }

  if (products.hasOwnProperty(categoryToDelete)) {
    delete products[categoryToDelete];
    await db.saveProducts(products); // រក្សាទុកការផ្លាស់ប្តូរ
    ctx.reply(`✅ បានលុប Category "${categoryToDelete}" ដោយជោគជ័យ!`);
  } else {
    ctx.reply(`❌ រកមិនឃើញ Category ឈ្មោះ "${categoryToDelete}" ទេ។`);
  }
});

// Command សម្រាប់សរុប Command របស់ Admin
bot.command('admin_help', (ctx) => {
  const lang = getUserLang(ctx);
  if (String(ctx.from.id) !== ADMIN_ID) return ctx.reply(t(lang, 'no_permission'));

  return ctx.reply(
    t(lang, 'admin_panel_title'), 
    {
      parse_mode: 'HTML',
      ...Markup.keyboard([
        [t(lang, 'check_stock_button'), t(lang, 'broadcast_button')],
        [t(lang, 'add_product_button'), t(lang, 'edit_product_button'), t(lang, 'delete_product_button')],
        [t(lang, 'add_stock_button'), t(lang, 'edit_stock_button'), t(lang, 'sales_report_button')],
        [t(lang, 'rename_category_button'), t(lang, 'delete_category_button')],
        [t(lang, 'close_panel_button')]
      ]).resize()
    }
  );
});

// Handlers សម្រាប់ប៊ូតុងរបស់ Admin
bot.hears('📊 ឆែកស្តុក', (ctx) => {
  const lang = getUserLang(ctx);
  if (String(ctx.from.id) !== ADMIN_ID || (ctx.message && ctx.message.text !== t(lang, 'check_stock_button'))) return;
  // Reuse the logic from checkstock command
  let message = '📦 <b>ស្ថានភាពស្តុកបច្ចុប្បន្ន:</b>\n\n';
  for (const [item, stock] of Object.entries(productStock)) {
    message += `- <b>${item}</b>: ${stock ? stock.length : 0}\n`;
  }
  ctx.reply(message, { parse_mode: 'HTML' });
});

bot.hears('📢 បញ្ជូនសារ (Broadcast)', (ctx) => {
  const lang = getUserLang(ctx);
  if (String(ctx.from.id) !== ADMIN_ID || (ctx.message && ctx.message.text !== t(lang, 'broadcast_button'))) return;
  ctx.replyWithHTML('របៀបប្រើ៖ <code>/broadcast [សារដែលចង់ផ្ញើ]</code>');
});

bot.hears('➕ បន្ថែមផលិតផល', (ctx) => {
  const lang = getUserLang(ctx);
  if (String(ctx.from.id) !== ADMIN_ID || (ctx.message && ctx.message.text !== t(lang, 'add_product_button'))) return;
  // Enter the add product scene
  ctx.scene.enter('addProductScene');
});

bot.hears('✏️ កែផលិតផល', (ctx) => {
  const lang = getUserLang(ctx);
  if (String(ctx.from.id) !== ADMIN_ID || (ctx.message && ctx.message.text !== t(lang, 'edit_product_button'))) return;
  ctx.scene.enter('editProductScene');
});

bot.hears('🗑️ លុបផលិតផល', (ctx) => {
  const lang = getUserLang(ctx);
  if (String(ctx.from.id) !== ADMIN_ID || (ctx.message && ctx.message.text !== t(lang, 'delete_product_button'))) return;
  ctx.replyWithHTML('របៀបប្រើ៖ <code>/delete_product [Name]</code>');
});

bot.hears('📈 ប្រវត្តិលក់', (ctx) => {
  const lang = getUserLang(ctx);
  if (String(ctx.from.id) !== ADMIN_ID || (ctx.message && ctx.message.text !== t(lang, 'sales_report_button'))) return;

  const today = new Date().toISOString().slice(0, 10); // Get YYYY-MM-DD

  const todaysSales = salesHistory.filter(sale => sale.date.startsWith(today));

  if (todaysSales.length === 0) {
    return ctx.reply(t(lang, 'no_sales_today'));
  }

  const totalRevenue = todaysSales.reduce((sum, sale) => sum + sale.price, 0);
  const totalItemsSold = todaysSales.length;

  const salesByItem = todaysSales.reduce((acc, sale) => {
    acc[sale.item] = (acc[sale.item] || 0) + 1;
    return acc;
  }, {});

  let report = t(lang, 'sales_report_header').replace('{date}', today) + '\n\n';
  report += t(lang, 'total_revenue').replace('{amount}', totalRevenue.toFixed(2)) + '\n';
  report += t(lang, 'total_items_sold').replace('{count}', totalItemsSold) + '\n\n';
  report += t(lang, 'sales_details_header') + '\n';

  for (const [item, count] of Object.entries(salesByItem)) {
    report += `- ${item}: ${count} ដង\n`;
  }

  ctx.replyWithHTML(report);
});

bot.hears('✏️ កែស្តុក', (ctx) => {
  const lang = getUserLang(ctx);
  if (String(ctx.from.id) !== ADMIN_ID || (ctx.message && ctx.message.text !== t(lang, 'edit_stock_button'))) return;
  ctx.scene.enter('editStockScene');
});

bot.hears('➕ បន្ថែមស្តុក', (ctx) => {
  const lang = getUserLang(ctx);
  if (String(ctx.from.id) !== ADMIN_ID || (ctx.message && ctx.message.text !== t(lang, 'add_stock_button'))) return;
  ctx.scene.enter('addStockScene');
});

bot.hears('🔄 ប្តូរឈ្មោះ Category', (ctx) => {
  const lang = getUserLang(ctx);
  if (String(ctx.from.id) !== ADMIN_ID || (ctx.message && ctx.message.text !== t(lang, 'rename_category_button'))) return;
  ctx.replyWithHTML('របៀបប្រើ៖ <code>/rename_category [Old Name]; [New Name]</code>');
});

bot.hears('🗑️ លុប Category', (ctx) => {
  const lang = getUserLang(ctx);
  if (String(ctx.from.id) !== ADMIN_ID || (ctx.message && ctx.message.text !== t(lang, 'delete_category_button'))) return;
  ctx.replyWithHTML('របៀបប្រើ៖ <code>/delete_category &lt;ឈ្មោះ Category&gt;</code>');
});

bot.hears('⬅️ បិទផ្ទាំងបញ្ជា', (ctx) => {
  const lang = getUserLang(ctx);
  if (String(ctx.from.id) !== ADMIN_ID || (ctx.message && ctx.message.text !== t(lang, 'close_panel_button'))) return;
  ctx.reply(t(lang, 'panel_closed'), Markup.removeKeyboard());
});

// Command សម្រាប់ Admin ឆែកមើលស្តុកទាំងអស់
bot.command('checkstock', (ctx) => {
  // ឆែកសិទ្ធិ Admin
  if (String(ctx.from.id) !== ADMIN_ID) return ctx.reply(t(getUserLang(ctx), 'no_permission'));

  let message = '📦 <b>ស្ថានភាពស្តុកបច្ចុប្បន្ន:</b>\n\n';
  for (const [item, stock] of Object.entries(productStock)) {
    message += `- <b>${item}</b>: ${stock ? stock.length : 0}\n`;
  }

  ctx.reply(message, { parse_mode: 'HTML' });
});

// Command សម្រាប់ Admin មើលប្រវត្តិលក់
bot.command('sales_report', (ctx) => {
  if (String(ctx.from.id) !== ADMIN_ID) return; // Auth is handled inside the hears handler
  // បញ្ជូនទៅកាន់ handler របស់ប៊ូតុង
  return bot.hears('📈 ប្រវត្តិលក់')(ctx);
});

// --- ប្រព័ន្ធទូទាត់ប្រាក់ស្វ័យប្រវត្តិ አማራጭ (Webhook Method) ---

// ជំហានទី១៖ ឆ្លើយតបពេលអតិថិជនចុច "ទិញ" ពីក្នុង Mini App
bot.on('web_app_data', async (ctx) => {
  const lang = getUserLang(ctx);
  try {
    const data = ctx.webAppData.data.json(); // ទាញយកទិន្នន័យ JSON
    const user = ctx.from;

    // ពិនិត្យមើល Stock ជាមុន
    const stockList = productStock[data.item];
    if (!stockList || stockList.length === 0) {
      return ctx.reply(t(lang, 'out_of_stock_error'));
    }

    // 1. បង្កើត "លេខយោង" (Reference Code) ដែលមិនជាន់គ្នា
    const refCode = `SALE-${user.id}-${Date.now().toString().slice(-6)}`;

    // 2. រក្សាទុកព័ត៌មានការបញ្ជាទិញជាមួយ refCode ក្នុង Database
    // ចំណាំ៖ ត្រូវប្រាកដថា function createPendingOrder របស់អ្នកអាចរក្សាទុក refCode បាន
    await db.createPendingOrder(refCode, {
      userId: user.id,
      itemName: data.item,
      price: data.price,
      status: 'pending'
    });
    
    // 3. បង្ហាញ Static QR និងការណែនាំ
    // *** ចំណុចសំខាន់ ***
    // សូម Upload រូបភាព KHQR របស់អ្នកទៅកាន់សេវាកម្មដូចជា Imgur (https://imgur.com/upload) ដើម្បីទទួលបាន Link
    // បន្ទាប់មក យក Link នោះមកដាក់ជំនួស URL ខាងក្រោមនេះ។
    const staticQrUrl = 'https://imgur.com/a/z0G6b1p'; // << ដាក់ URL នៃរូបភាព KHQR របស់អ្នកនៅទីនេះ
    const instructionText = `✅ <b>ការបញ្ជាទិញរបស់អ្នកត្រូវបានបង្កើត</b>\n\n` +
                            `<b>ទំនិញ៖</b> ${data.item}\n` +
                            `<b>តម្លៃ៖</b> $${data.price.toFixed(2)}\n\n` +
                            `<b><u>ការណែនាំសំខាន់៖</u></b>\n` +
                            `1️⃣ សូមស្កេន QR Code ខាងក្រោម។\n` +
                            `2️⃣ នៅក្នុង App ធនាគាររបស់អ្នក សូមប្រាកដថាអ្នកបានវាយបញ្ចូល "<b>លេខយោង</b>" ខាងក្រោមនេះ នៅក្នុងช่อง <b>Remark</b> ឬ <b>Note</b>៖\n\n` +
                            `<code>${refCode}</code>\n\n` +
                            `🙏 បន្ទាប់ពីទូទាត់สำเร็จ អ្នកនឹងទទួលបានគណនីដោយស្វ័យប្រវត្តិ។`;

    await ctx.replyWithPhoto(staticQrUrl, { caption: instructionText, parse_mode: 'HTML' });

  } catch (e) {
    console.error("Error processing web_app_data for custom payment:", e);
    ctx.reply(t(lang, 'error_processing_data'));
  }
});

// ឆ្លើយតបសារដោយស្វ័យប្រវត្តិពេលគេផ្ញើរូបភាពមក
bot.on('photo', (ctx) => {
  ctx.reply('បានទទួលរូបភាពហើយ! 📸 អរគុណសម្រាប់ការផ្ញើរូបភាពមក។');
});

async function start() {
    // Connect to the database and load initial data
    try {
        await db.connect();
        userIds = await db.loadUsers();
        productStock = await db.loadStock();
        products = await db.loadProducts();
        salesHistory = await db.loadSales();
        userSettings = await db.loadSettings();
    } catch (e) {
        console.error('Failed to connect to database and load data!', e);
        process.exit(1); // Exit if cannot connect to DB
    }

    // បង្កើត HTTP Server សាមញ្ញមួយដើម្បីឱ្យ Cloud Hosting ដឹងថា Bot កំពុងដើរ
    const PORT = process.env.PORT || 3003;
    http.createServer((req, res) => {
      // បន្ថែមការ Log សម្រាប់រាល់ Request ដែលចូលមក ដើម្បីងាយស្រួល Debug
      console.log(`Received request: ${req.method} ${req.url}`);

      // Endpoint សម្រាប់ទទួលការបញ្ជាក់ការទូទាត់ពី Python service
      if (req.url === '/payment-complete' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', async () => {
            try {
                // ជំហានទី២៖ ទទួល និងដំណើរការ Webhook
                const paymentData = JSON.parse(body); // ឥឡូវនេះ paymentData នឹងមាន refCode
                const refCode = paymentData.refCode;
                const paymentStatus = paymentData.status;

                if (paymentStatus === 'completed') {
                    const order = await db.getPendingOrder(refCode); // ស្វែងរក Order តាម refCode
                    if (order && order.status === 'pending') {
                        const { userId, itemName, price } = order;
                        const lang = getUserLang({ from: { id: userId } });

                        const stockList = productStock[itemName];
                        if (stockList?.length > 0) {
                            const account = stockList.shift();
                            await db.saveStock(productStock);

                            const saleRecord = { item: itemName, price: price, date: new Date().toISOString(), userId: userId };
                            await db.saveSale(saleRecord);
                            salesHistory.push(saleRecord);

                            await bot.telegram.sendMessage(userId, `✅ ការទូទាត់ជោគជ័យ!\n\n🚀 <b>${t(lang, 'account_delivery_header')}</b>\n\n<code>${account}</code>\n\n🙏 ${t(lang, 'thank_you_message')}`, { parse_mode: 'HTML' });
                            await bot.telegram.sendMessage(ADMIN_ID, `✅ (Bakong) លក់สำเร็จ!\n\nទំនិញ៖ ${itemName}\nតម្លៃ៖ $${price}\nអ្នកប្រើ៖ ${userId}`);

                            await db.updatePendingOrderStatus(refCode, 'completed');
                        } else {
                           await bot.telegram.sendMessage(ADMIN_ID, `🚨 (Bakong) កំហុសធ្ងន់ធ្ងរ៖ បានទទួលការទូទាត់ប្រាក់សម្រាប់ ${itemName} ប៉ុន្តែអស់ពីស្តុក! សូមទាក់ទងអ្នកប្រើ ${userId} ជាបន្ទាន់។`);
                        }
                    }
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'received' }));
            } catch (e) {
                console.error('Payment completion processing error:', e);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'error' }));
            }
        });
        return;
      }

      if (req.url === '/products' && req.method === 'GET') {
        const productsWithStock = {};
        for (const category in products) {
            productsWithStock[category] = products[category].map(product => {
                const stockCount = productStock[product.name] ? productStock[product.name].length : 0;
                return {
                    ...product,
                    stockCount: stockCount
                };
            });
        }
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(JSON.stringify(productsWithStock));
        return;
      }

      // ចម្លើយ Default
      res.setHeader('Content-Type', 'text/plain');
      res.end('Bot is running...');
    }).listen(PORT, () => console.log(`Server listening on port ${PORT}`));

    // Launch the bot
    bot.launch();
    console.log('Bot កំពុងដំណើរការ...');
}

start();

// បិទ Bot ដោយសុវត្ថិភាព
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

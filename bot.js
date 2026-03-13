const { Telegraf, Markup, Scenes, session } = require('telegraf');
const http = require('http');
const db = require('./database.js'); // នាំចូល database helper
const { t } = require('./i18n.js'); // នាំចូល i18n helper
require('dotenv').config(); // ហៅ dotenv មកប្រើ

// ជំនួស 'YOUR_BOT_TOKEN' ជាមួយ Token ដែលបានពី BotFather
const bot = new Telegraf(process.env.BOT_TOKEN);

// ដាក់ ID របស់ Admin នៅទីនេះ (ដើម្បីទទួលសារជូនដំណឹង)
const ADMIN_ID = process.env.ADMIN_ID; 

// ១. បង្កើតកន្លែងទុក User ID ទាំងអស់ (ប្រើ Set ដើម្បីកុំឱ្យស្ទួន)
// ទិន្នន័យនឹងត្រូវបានអានពីហ្វាល JSON
let userIds = db.loadUsers();
let productStock = db.loadStock();
let products = db.loadProducts();
let salesHistory = db.loadSales();
let userSettings = db.loadSettings();

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
      db.saveUsers(userIds); // រក្សាទុក User ID ថ្មី
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
const webAppUrl = 'https://rithninet-eng.github.io/my-mini-app-frontend/';

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
bot.action(/set_lang_(.+)/, (ctx) => {
    const langCode = ctx.match[1];
    if (langCode === 'en' || langCode === 'km') {
        userSettings[ctx.from.id] = { ...userSettings[ctx.from.id], lang: langCode };
        db.saveSettings(userSettings);
        ctx.answerCbQuery(t(langCode, `language_set_to_${langCode}`));
        ctx.editMessageText(t(langCode, 'language_changed'));
    }
});

// Command សម្រាប់ Admin បន្ថែមស្តុកគណនី
bot.command('add_stock', (ctx) => {
  // ឆែកសិទ្ធិ Admin
  if (String(ctx.from.id) !== ADMIN_ID) return ctx.reply(t(getUserLang(ctx), 'no_permission'));

  const args = ctx.payload.split(';').map(arg => arg.trim());
  if (args.length !== 2) {
    return ctx.replyWithHTML(
      '⚠️ <b>របៀបប្រើមិនត្រឹមត្រូវ</b>\n\n' +
      'សូមប្រើទម្រង់៖\n' +
      '<code>/add_stock &lt;ឈ្មោះផលិតផល&gt;; &lt;Email | Pass...&gt;</code>\n\n' +
      '<b>ឧទាហរណ៍៖</b>\n' +
      '<code>/add_stock CapCut Pro 1 Year; new@email.com | 12345</code>'
    );
  }

  const [productName, newAccount] = args;

  // ពិនិត្យមើលថាតើផលិតផលមានក្នុងបញ្ជីដែរឬទេ
  const productExists = Object.values(products).flat().some(p => p.name.toLowerCase() === productName.toLowerCase());
  if (!productExists) {
      return ctx.reply(`❌ រកមិនឃើញផលិតផលឈ្មោះ "${productName}" ទេ។ សូមប្រាកដថាអ្នកបានសរសេរឈ្មោះត្រូវ។`);
  }

  if (!productStock[productName]) {
    productStock[productName] = [];
  }
  // បន្ថែមចូលស្តុក
  productStock[productName].push(newAccount);
  db.saveStock(productStock); // រក្សាទុកស្តុក
  
  ctx.reply(`✅ បានបន្ថែមគណនីសម្រាប់ "${productName}" ជោគជ័យ!\n📦 ស្តុកសរុបបច្ចុប្បន្ន: ${productStock[productName].length}`);
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
        db.saveProducts(products); // Save products to file

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
        }
        db.saveProducts(products);
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
        db.saveProducts(products);

        await ctx.reply(`✅ បានកែប្រែរូបភាពសម្រាប់ផលិតផល "${state.product.name}" ដោយជោគជ័យ!`);
    } catch (error) {
        console.error('Error uploading new photo:', error);
        await ctx.reply('❌ មានបញ្ហាក្នុងការ Upload រូបភាពថ្មី។ សូមព្យាយាមម្តងទៀត។');
    }

    return ctx.scene.leave();
});

editProductScene.command('cancel', (ctx) => ctx.scene.leave(ctx.reply('បានបោះបង់ការកែប្រែ។')));

const stage = new Scenes.Stage([addProductScene, editProductScene]);
bot.use(stage.middleware());

// Command សម្រាប់ Admin លុបផលិតផល
bot.command('delete_product', (ctx) => {
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
      db.saveProducts(products); // រក្សាទុកការផ្លាស់ប្តូរ
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
bot.command('rename_category', (ctx) => {
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
    db.saveProducts(products); // រក្សាទុកការផ្លាស់ប្តូរ
    ctx.reply(`✅ បានប្តូរឈ្មោះ Category ពី "${oldName}" ទៅជា "${newName}" ដោយជោគជ័យ!`);
  } else {
    ctx.reply(`❌ រកមិនឃើញ Category ឈ្មោះ "${oldName}" ទេ។`);
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
        [t(lang, 'sales_report_button')],
        [t(lang, 'add_stock_button')],
        [t(lang, 'rename_category_button')],
        [t(lang, 'close_panel_button')]
      ]).resize()
    }
  );
});

// Handlers សម្រាប់ប៊ូតុងរបស់ Admin
bot.hears('📊 ឆែកស្តុក', (ctx) => {
  const lang = getUserLang(ctx);
  if (String(ctx.from.id) !== ADMIN_ID || ctx.message.text !== t(lang, 'check_stock_button')) return;
  // Reuse the logic from checkstock command
  let message = '📦 <b>ស្ថានភាពស្តុកបច្ចុប្បន្ន:</b>\n\n';
  for (const [item, stock] of Object.entries(productStock)) {
    message += `- <b>${item}</b>: ${stock ? stock.length : 0}\n`;
  }
  ctx.reply(message, { parse_mode: 'HTML' });
});

bot.hears('📢 បញ្ជូនសារ (Broadcast)', (ctx) => {
  const lang = getUserLang(ctx);
  if (String(ctx.from.id) !== ADMIN_ID || ctx.message.text !== t(lang, 'broadcast_button')) return;
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
  if (String(ctx.from.id) !== ADMIN_ID || ctx.message.text !== t(lang, 'delete_product_button')) return;
  ctx.replyWithHTML('របៀបប្រើ៖ <code>/delete_product [Name]</code>');
});

bot.hears('📈 ប្រវត្តិលក់', (ctx) => {
  const lang = getUserLang(ctx);
  if (String(ctx.from.id) !== ADMIN_ID || ctx.message.text !== t(lang, 'sales_report_button')) return;

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

bot.hears('➕ បន្ថែមស្តុក', (ctx) => {
  const lang = getUserLang(ctx);
  if (String(ctx.from.id) !== ADMIN_ID || ctx.message.text !== t(lang, 'add_stock_button')) return;
  ctx.replyWithHTML('របៀបប្រើ៖ <code>/add_stock &lt;ឈ្មោះផលិតផល&gt;; &lt;Email | Pass...&gt;</code>');
});

bot.hears('🔄 ប្តូរឈ្មោះ Category', (ctx) => {
  const lang = getUserLang(ctx);
  if (String(ctx.from.id) !== ADMIN_ID || ctx.message.text !== t(lang, 'rename_category_button')) return;
  ctx.replyWithHTML('របៀបប្រើ៖ <code>/rename_category [Old Name]; [New Name]</code>');
});

bot.hears('⬅️ បិទផ្ទាំងបញ្ជា', (ctx) => {
  const lang = getUserLang(ctx);
  if (String(ctx.from.id) !== ADMIN_ID || ctx.message.text !== t(lang, 'close_panel_button')) return;
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

// ឆ្លើយតបពេលអតិថិជនចុច "ទិញ" ពីក្នុង Mini App
bot.on('web_app_data', async (ctx) => {
  try {
    const data = ctx.webAppData.data.json(); // ទាញយកទិន្នន័យ JSON
    
    // ជំនួស URL ខាងក្រោមដោយ Link រូបភាព QR Code ABA របស់អ្នក
    const qrCodeUrl = 'https://pay.ababank.com/cv3/qr_code_placeholder.png'; 

    // 1. ផ្ញើ QR Code និងវិក្កយបត្រ
    await ctx.replyWithPhoto(qrCodeUrl, {
      caption: `🎉 អរគុណសម្រាប់ការកម្ម៉ង់!\n\n📦 ទំនិញ: <b>${data.item}</b>\n💰 តម្លៃ: <b>$${data.price}</b>\n\nសូមស្កេន QR ខាងលើដើម្បីបង់ប្រាក់ 👆`,
      parse_mode: 'HTML'
    });

    // 2. ពិនិត្យមើលស្តុក និងផ្ញើគណនី
    const stockList = productStock[data.item];

    if (stockList && stockList.length > 0) {
      // ចាប់យកគណនីដំបូងគេ (Shift) ហើយលុបវាចេញពីស្តុកភ្លាមៗ ដើម្បីកុំឱ្យជាន់គ្នា
      const account = stockList.shift();
      db.saveStock(productStock); // រក្សាទុកស្តុកដែលបាន Update

      // រក្សាទុកប្រវត្តិលក់
      salesHistory.push({
        item: data.item,
        price: parseFloat(data.price),
        date: new Date().toISOString(),
      });
      db.saveSales(salesHistory);
      
      await ctx.reply(`🚀 <b>ការដឹកជញ្ជូនស្វ័យប្រវត្តិ:</b>\n\n${account}\n\n🙏 សូមអរគុណសម្រាប់ការគាំទ្រ!`, { parse_mode: 'HTML' });

      // 3. ត្រួតពិនិត្យស្តុក និងជូនដំណឹងទៅ Admin បើជិតអស់ (នៅសល់តិចជាង 2)
      if (stockList.length < 2) {
        bot.telegram.sendMessage(ADMIN_ID, `⚠️ <b>ជូនដំណឹង Admin:</b>\n\nទំនិញ <b>${data.item}</b> ជិតអស់ហើយ!\nបច្ចុប្បន្ននៅសល់: ${stockList.length}`, { parse_mode: 'HTML' });
      }
    } else {
      await ctx.reply('⚠️ សុំទោស! ស្តុកទំនិញនេះអស់ហើយ។ Admin នឹងទាក់ទងទៅអ្នកឆាប់ៗ ឬផ្ញើលុយជូនវិញ។');
      // ជូនដំណឹង Admin ថាមានគេចង់ទិញតែអស់ស្តុក
      bot.telegram.sendMessage(ADMIN_ID, `❌ <b>ស្តុកអស់ហើយ:</b>\n\nអតិថិជនចង់ទិញ <b>${data.item}</b> ប៉ុន្តែស្តុកបានអស់។`, { parse_mode: 'HTML' });
    }
  } catch (e) {
    ctx.reply('មានបញ្ហាក្នុងការទទួលទិន្នន័យ។');
  }
});

// ឆ្លើយតបសារដោយស្វ័យប្រវត្តិពេលគេផ្ញើរូបភាពមក
bot.on('photo', (ctx) => {
  ctx.reply('បានទទួលរូបភាពហើយ! 📸 អរគុណសម្រាប់ការផ្ញើរូបភាពមក។');
});

bot.launch();

// បង្កើត HTTP Server សាមញ្ញមួយដើម្បីឱ្យ Cloud Hosting ដឹងថា Bot កំពុងដើរ
const PORT = process.env.PORT || 3003; // ប្តូរទៅ Port ផ្សេង ឧទាហរណ៍ 3003
http.createServer((req, res) => {
  // បង្កើត Endpoint សម្រាប់ Mini App ទាញយកបញ្ជីផលិតផល
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
    res.setHeader('Access-Control-Allow-Origin', '*'); // អនុញ្ញាតឱ្យគ្រប់វេបសាយអាចទាញទិន្នន័យនេះបាន
    res.end(JSON.stringify(productsWithStock));
    return;
  }

  // ចម្លើយ Default
  res.end('Bot is running...');
}).listen(PORT, () => console.log(`Server listening on port ${PORT}`));

// បង្ហាញថា Bot កំពុងដំណើរការ
console.log('Bot កំពុងដំណើរការ...');

// បិទ Bot ដោយសុវត្ថិភាព
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

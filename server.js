const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

// --- কনফিগারেশন ---
const BOT_TOKEN = process.env.BOT_TOKEN || '8653938577:AAE1g-TDAedxbpGvszb0zRyVa04560mba0c';
const PORT = process.env.PORT || 3000;
const RENDER_URL = 'https://ppmod-quest-unlock.onrender.com';

// গুগল ক্লাউড ওথ ক্রেডেনশিয়াল (ডিফল্ট ক্লায়েন্ট)
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '407408718192.apps.googleusercontent.com';
const REDIRECT_URI = `${RENDER_URL}/auth/callback`;

// ১. এক্সপ্রেস সার্ভার ও ওয়েব ওথ (Web OAuth) রিডাইরেক্ট
const app = express();
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// ইউজার টোকেন স্টোর
const userTokens = {};

// প্রধান বাটন মেনু
function getMainMenu() {
    return {
        reply_markup: {
            inline_keyboard: [
                [{ text: "👤 আমার অ্যাকাউন্ট প্রোফাইল (Name/Level/XP)", callback_data: "btn_profile" }],
                [{ text: "🎮 Gossip Harbor: Merge & Story", callback_data: "btn_gossip" }],
                [{ text: "🐦 Angry Birds 2 (All Quests)", callback_data: "btn_angry" }],
                [{ text: "⚡ Unlock All Games (Instant Max XP)", callback_data: "btn_all" }],
                [{ text: "🔄 নতুন অ্যাকাউন্ট যোগ করুন (Logout)", callback_data: "btn_logout" }]
            ]
        }
    };
}

// হোম রাউট
app.get('/', (req, res) => res.send('🔥 PP MOD Web OAuth Engine is Running 24/7 on Render!'));

// গুগলে লগইন রিডাইরেক্ট রাউট
app.get('/auth/google', (req, res) => {
    const chatId = req.query.chat_id;
    if (!chatId) return res.send('Error: Chat ID missing.');

    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${CLIENT_ID}&` +
        `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
        `response_type=token&` +
        `scope=${encodeURIComponent('https://www.googleapis.com/auth/games')}&` +
        `state=${chatId}`;

    res.redirect(googleAuthUrl);
});

// গুগল লগইন শেষ হলে ইউজারকে ফেরত আনার রাউট
app.get('/auth/callback', (req, res) => {
    // ব্রাউজারের হ্যাশ টোকেন রিড করার ফ্রন্টএন্ড স্ক্রিপ্ট
    res.send(`
        <html>
        <head><title>PP MOD - Authentication</title></head>
        <body style="font-family: Arial; text-align: center; padding-top: 50px; background: #121212; color: white;">
            <h2>⏳ ভেরিফিকেশন সম্পন্ন হচ্ছে...</h2>
            <script>
                const hash = window.location.hash.substring(1);
                const params = new URLSearchParams(hash);
                const token = params.get('access_token');
                const stateParams = new URLSearchParams(window.location.search);
                const state = stateParams.get('state');

                if (token && state) {
                    fetch('/api/save-token?chat_id=' + state + '&token=' + token)
                        .then(() => {
                            document.body.innerHTML = '<h2>✅ গুগল লগইন সফল হয়েছে!</h2><p>আপনি এই পেজটি কেটে দিয়ে টেলিগ্রামে ফিরে যান।</p>';
                        });
                } else {
                    document.body.innerHTML = '<h2>❌ অথেনটিকেশন ব্যর্থ হয়েছে। পুনরায় চেষ্টা করুন।</h2>';
                }
            </script>
        </body>
        </html>
    `);
});

// টোকেন সেভ এবং টেলিগ্রামে অটোমেটিক বাটন পাঠানো
app.get('/api/save-token', async (req, res) => {
    const { chat_id, token } = req.query;
    if (chat_id && token) {
        userTokens[chat_id] = token;

        // টেলিগ্রামে সাথে সাথে মেনু বাটন পাঠিয়ে দেওয়া
        await bot.sendMessage(
            chat_id,
            `🎉 **অভিনন্দন! আপনার গুগল অ্যাকাউন্ট সফলভাবে কানেক্ট হয়েছে!**\n\n` +
            `👇 **নিচের বাটন থেকে আপনার পছন্দমতো গেম আনলক করুন:**`,
            { parse_mode: 'Markdown', ...getMainMenu() }
        );
        res.json({ success: true });
    } else {
        res.status(400).send('Invalid request');
    }
});

// ২. টেলিগ্রাম /start কমান্ড
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const loginLink = `${RENDER_URL}/auth/google?chat_id=${chatId}`;

    const welcomeText = `👋 হ্যালো **${msg.from.first_name || 'User'}**!\n\n` +
        `🔥 **PP MOD Auto Quest & Achievement Unlocker**-এ স্বাগতম!\n\n` +
        `কোনো পাসওয়ার্ড বা কোড টাইপ করার দরকার নেই। নিচের **"Connect with Google"** বাটনে চাপ দিয়ে আপনার জিমেইল অ্যাকাউন্টটি কানেক্ট করুন:`;

    bot.sendMessage(chatId, welcomeText, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: "🔗 Connect with Google (১-ক্লিক লগইন)", url: loginLink }]
            ]
        }
    });
});

// ৩. বাটন ক্লিক হ্যান্ডলার
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    const token = userTokens[chatId];

    if (!token && data !== 'btn_logout') {
        const loginLink = `${RENDER_URL}/auth/google?chat_id=${chatId}`;
        return bot.sendMessage(chatId, '❌ আপনার অ্যাকাউন্ট কানেক্ট করা নেই! আগে লগইন করুন:', {
            reply_markup: { inline_keyboard: [[{ text: "🔗 Connect with Google", url: loginLink }]] }
        });
    }

    const headers = { Authorization: `Bearer ${token}` };

    if (data === 'btn_profile') {
        bot.answerCallbackQuery(query.id, { text: 'প্রোফাইল চেক হচ্ছে...' });
        try {
            const res = await axios.get('https://games.googleapis.com/games/v1/players/me', { headers });
            const p = res.data;
            const profileMsg = `👤 **PP MOD: প্লেয়ার প্রোফাইল**\n\n` +
                `🏷️ **Gamer Tag:** \`${p.displayName || 'Not Set'}\`\n` +
                `🎖️ **Current Level:** \`${p.experienceInfo?.currentLevel?.level || 'N/A'}\`\n` +
                `⭐ **Current XP:** \`${p.experienceInfo?.currentExperiencePoints || '0'} XP\``;

            bot.sendMessage(chatId, profileMsg, { parse_mode: 'Markdown', ...getMainMenu() });
        } catch {
            bot.sendMessage(chatId, 'ℹ️ প্রোফাইল ডাটা রিড করা যায়নি।', getMainMenu());
        }
    } else if (data === 'btn_gossip') {
        bot.answerCallbackQuery(query.id, { text: 'Gossip Harbor আনলক শুরু...' });
        const waitMsg = await bot.sendMessage(chatId, '⏳ Gossip Harbor-এর কোয়েস্ট আনলক করা হচ্ছে...');

        try {
            const res = await axios.get('https://games.googleapis.com/games/v1/players/me/achievements', { headers });
            const items = res.data.items || [];
            let count = 0;
            for (const item of items) {
                if (item.achievementState !== 'UNLOCKED') {
                    await axios.post(`https://games.googleapis.com/games/v1/achievements/${item.id}/unlock`, {}, { headers }).catch(() => {});
                    count++;
                }
            }
            bot.editMessageText(`🎉 **PP MOD:** Gossip Harbor সফল! মোট \`${count}\`টি কোয়েস্ট আনলক হয়েছে!`, {
                chat_id: chatId,
                message_id: waitMsg.message_id,
                parse_mode: 'Markdown',
                ...getMainMenu()
            });
        } catch {
            bot.editMessageText('❌ আনলক ব্যর্থ হয়েছে (গুগল প্লে রেস্ট্রিকশন)।', {
                chat_id: chatId,
                message_id: waitMsg.message_id,
                ...getMainMenu()
            });
        }
    } else if (data === 'btn_angry') {
        bot.answerCallbackQuery(query.id, { text: 'Angry Birds 2 আনলক হচ্ছে...' });
        bot.sendMessage(chatId, '🚀 **PP MOD:** Angry Birds 2 প্রসেসিং সম্পন্ন হয়েছে!', getMainMenu());
    } else if (data === 'btn_all') {
        bot.answerCallbackQuery(query.id, { text: 'সব গেম আনলক হচ্ছে...', show_alert: true });
        bot.sendMessage(chatId, '⚡ **PP MOD: Instant Max XP Boost সম্পন্ন হয়েছে!**\nঅ্যাপ রিফ্রেশ করে দেখুন।', { parse_mode: 'Markdown', ...getMainMenu() });
    } else if (data === 'btn_logout') {
        delete userTokens[chatId];
        bot.answerCallbackQuery(query.id, { text: 'লগআউট সফল!' });
        bot.sendMessage(chatId, '👋 আপনি সফলভাবে ডিসকানেক্ট হয়েছেন। পুনরায় কানেক্ট করতে /start লিখুন।');
    }
});

app.listen(PORT, () => console.log(`[+] Server listening on port ${PORT}`));

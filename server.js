const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

// --- কনফিগারেশন ---
const BOT_TOKEN = process.env.BOT_TOKEN || '8653938577:AAE1g-TDAedxbpGvszb0zRyVa04560mba0c';
const PORT = process.env.PORT || 3000;
const RENDER_URL = 'https://ppmod-quest-unlock.onrender.com';

const CLIENT_ID = '1022873197627-h0pa915p9gt3mh19lemh0lo1nclojarn.apps.googleusercontent.com';
const REDIRECT_URI = `${RENDER_URL}/auth/callback`;

const app = express();
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// মেমোরিতে টোকেন রাখা (Render স্লিপ মোডে গেলে এটি রিসেট হতে পারে)
const userTokens = {};

console.log('🔥 PP MOD Web OAuth Bot Started!');

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

app.get('/', (req, res) => res.send('🔥 PP MOD Web OAuth Engine is Running 24/7 on Render!'));

// গুগলে ১-ক্লিক লগইন রিডাইরেক্ট (Scopes আপডেট করা হয়েছে)
app.get('/auth/google', (req, res) => {
    const chatId = req.query.chat_id;
    if (!chatId) return res.send('Error: Chat ID missing.');

    const scopes = [
        'https://www.googleapis.com/auth/games',
        'https://www.googleapis.com/auth/userinfo.profile'
    ].join(' ');

    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${CLIENT_ID}&` +
        `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
        `response_type=token&` +
        `scope=${encodeURIComponent(scopes)}&` +
        `state=${chatId}`;

    res.redirect(googleAuthUrl);
});

// গুগল লগইন সফল হলে কলব্যাক পেজ
app.get('/auth/callback', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>PP MOD - Authentication</title>
            <style>
                body { font-family: sans-serif; background: #0f172a; color: white; text-align: center; padding: 40px 20px; }
                .card { background: #1e293b; border-radius: 16px; padding: 30px; max-width: 400px; margin: auto; }
                h2 { color: #38bdf8; }
            </style>
        </head>
        <body>
            <div class="card">
                <h2 id="title">⏳ ভেরিফিকেশন সম্পন্ন হচ্ছে...</h2>
                <p id="desc">অনুগ্রহ করে কয়েক সেকেন্ড অপেক্ষা করুন।</p>
            </div>
            <script>
                const hash = window.location.hash.substring(1);
                const hashParams = new URLSearchParams(hash);
                const token = hashParams.get('access_token');
                const state = hashParams.get('state');

                if (token && state) {
                    fetch('/api/save-token?chat_id=' + state + '&token=' + token)
                        .then(r => r.json())
                        .then(() => {
                            document.getElementById('title').innerHTML = '✅ লগইন সফল হয়েছে!';
                            document.getElementById('title').style.color = '#4ade80';
                            document.getElementById('desc').innerHTML = 'টেলিগ্রাম অ্যাপে ফিরে যান!';
                        })
                        .catch(() => {
                            document.getElementById('title').innerHTML = '❌ এরর হয়েছে!';
                        });
                } else {
                    document.getElementById('title').innerHTML = '❌ অনুমোদন পাওয়া যায়নি!';
                }
            </script>
        </body>
        </html>
    `);
});

// টোকেন সেভ
app.get('/api/save-token', async (req, res) => {
    const { chat_id, token } = req.query;
    if (chat_id && token) {
        userTokens[chat_id] = token;

        await bot.sendMessage(
            chat_id,
            `🎉 **আপনার গুগল অ্যাকাউন্ট কানেক্ট হয়েছে!**\n\n👇 **নিচের বাটন দিয়ে প্রোফাইল চেক করুন:**`,
            { parse_mode: 'Markdown', ...getMainMenu() }
        );
        res.json({ success: true });
    } else {
        res.status(400).send('Invalid request');
    }
});

// টেলিগ্রাম /start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const loginLink = `${RENDER_URL}/auth/google?chat_id=${chatId}`;

    bot.sendMessage(chatId, `👋 হ্যালো **${msg.from.first_name || 'User'}**!\n\nগুগল কানেক্ট করতে নিচে চাপুন:`, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [[{ text: "🔗 Connect with Google", url: loginLink }]]
        }
    });
});

// বাটন হ্যান্ডলার
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
        bot.answerCallbackQuery(query.id, { text: 'প্রোফাইল লোড হচ্ছে...' });
        try {
            const res = await axios.get('https://games.googleapis.com/games/v1/players/me', { headers });
            const p = res.data;
            const profileMsg = `👤 **প্লেয়ার প্রোফাইল**\n\n` +
                `🏷️ **Gamer Tag:** \`${p.displayName || 'Not Set'}\`\n` +
                `🎖️ **Current Level:** \`${p.experienceInfo?.currentLevel?.level || 'N/A'}\`\n` +
                `⭐ **Current XP:** \`${p.experienceInfo?.currentExperiencePoints || '0'} XP\``;

            bot.sendMessage(chatId, profileMsg, { parse_mode: 'Markdown', ...getMainMenu() });
        } catch (error) {
            console.error("Profile Fetch Error:", error.response?.data || error.message);
            const errDetail = error.response?.data?.error?.message || error.message;
            bot.sendMessage(chatId, `❌ প্রোফাইল আনা যায়নি!\nError: \`${errDetail}\``, { parse_mode: 'Markdown', ...getMainMenu() });
        }
    } else if (data === 'btn_logout') {
        delete userTokens[chatId];
        bot.answerCallbackQuery(query.id, { text: 'লগআউট সফল!' });
        bot.sendMessage(chatId, '👋 লগআউট সম্পন্ন হয়েছে। পুনরায় কানেক্ট করতে /start চাপুন।');
    } else {
        bot.answerCallbackQuery(query.id, { text: 'কাজ চলছে না...' });
        bot.sendMessage(chatId, '⚠️ এই গেমটির অ্যাচিভমেন্ট আনলক ফিচারটি স্ক্রিপ্টে কনফিগার করা নেই।', getMainMenu());
    }
});

app.listen(PORT, () => console.log(`[+] Server running on port ${PORT}`));

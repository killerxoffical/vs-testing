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

// Polling সেটিংস ঠিক করা
const bot = new TelegramBot(BOT_TOKEN, { 
    polling: {
        autoStart: true,
        params: { timeout: 10 }
    } 
});

// কোনো Polling এরর আসলে যাতে কনসোলে দেখা যায়
bot.on('polling_error', (error) => {
    console.error('Polling Error:', error.code, error.message);
});

// ইউজারের টোকেন স্টোর
const userTokens = {};

console.log('🔥 PP MOD Web OAuth Bot Started!');

// প্রধান বাটন মেনু
function getMainMenu() {
    return {
        reply_markup: {
            inline_keyboard: [
                [{ text: "👤 আমার অ্যাকাউন্ট প্রোফাইল (Name/Level/XP)", callback_data: "btn_profile" }],
                [{ text: "🔄 নতুন অ্যাকাউন্ট যোগ করুন (Logout)", callback_data: "btn_logout" }]
            ]
        }
    };
}

// লগইন লিংক জেনারেটর (prompt=select_account যোগ করা হয়েছে যাতে প্রতিবার নতুন অ্যাকাউন্ট বেছে নেওয়া যায়)
function getLoginUrl(chatId) {
    const scopes = [
        'https://www.googleapis.com/auth/games',
        'https://www.googleapis.com/auth/userinfo.profile'
    ].join(' ');

    return `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${CLIENT_ID}&` +
        `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
        `response_type=token&` +
        `scope=${encodeURIComponent(scopes)}&` +
        `prompt=select_account&` +  // <-- এটি দিলে প্রতিবার জিমেইল চুজ করতে বলবে
        `state=${chatId}`;
}

app.get('/', (req, res) => res.send('🔥 PP MOD Web OAuth Engine is Running 24/7 on Render!'));

// গুগলে ১-ক্লিক লগইন রিডাইরেক্ট
app.get('/auth/google', (req, res) => {
    const chatId = req.query.chat_id;
    if (!chatId) return res.send('Error: Chat ID missing.');
    res.redirect(getLoginUrl(chatId));
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
                body { font-family: -apple-system, sans-serif; background: #0f172a; color: white; text-align: center; padding: 40px 20px; }
                .card { background: #1e293b; border-radius: 16px; padding: 30px; max-width: 400px; margin: auto; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
                h2 { color: #38bdf8; margin-bottom: 10px; }
                p { color: #94a3b8; font-size: 15px; }
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
                            document.getElementById('desc').innerHTML = 'আপনার গুগল অ্যাকাউন্ট কানেক্ট হয়েছে। <b>টেলিগ্রাম অ্যাপে ফিরে যান!</b>';
                        })
                        .catch(() => {
                            document.getElementById('title').innerHTML = '❌ এরর হয়েছে!';
                        });
                } else {
                    document.getElementById('title').innerHTML = '❌ অনুমোদন পাওয়া যায়নি!';
                    document.getElementById('desc').innerHTML = 'দয়া করে আবার বটে গিয়ে চেষ্টা করুন।';
                }
            </script>
        </body>
        </html>
    `);
});

// টোকেন সেভ করা
app.get('/api/save-token', async (req, res) => {
    const { chat_id, token } = req.query;
    if (chat_id && token) {
        userTokens[chat_id] = token;

        await bot.sendMessage(
            chat_id,
            `🎉 **আপনার গুগল অ্যাকাউন্ট কানেক্ট হয়েছে!**\n\n👇 **প্রোফাইল দেখতে নিচের বাটনে চাপ দিন:**`,
            { parse_mode: 'Markdown', ...getMainMenu() }
        );
        res.json({ success: true });
    } else {
        res.status(400).send('Invalid request');
    }
});

// মেসেজ রিসিভ হ্যান্ডলার (/start কাজ না করার সমস্যার ফিক্স)
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text ? msg.text.trim() : '';

    if (text.startsWith('/start') || text.toLowerCase() === 'start') {
        const loginLink = getLoginUrl(chatId);
        const welcomeText = `👋 হ্যালো **${msg.from.first_name || 'User'}**!\n\n` +
            `🔥 **PP MOD Auto Quest & Achievement Unlocker**-এ স্বাগতম!\n\n` +
            `নতুন বা অন্য যেকোনো জিমেইল দিয়ে কানেক্ট করতে নিচের বাটনে চাপ দিন:`;

        bot.sendMessage(chatId, welcomeText, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: "🔗 Connect with Google (অ্যাকাউন্ট সিলেক্ট করুন)", url: loginLink }]
                ]
            }
        });
    }
});

// বাটন ক্লিক হ্যান্ডলার
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    const token = userTokens[chatId];

    // লগআউট হ্যান্ডলার (যাতে একই আইডি বারবার না আসে)
    if (data === 'btn_logout') {
        delete userTokens[chatId];
        await bot.answerCallbackQuery(query.id, { text: 'অ্যাকাউন্ট রিমুভ করা হয়েছে!' });
        
        const newLoginLink = getLoginUrl(chatId);
        return bot.sendMessage(
            chatId,
            '👋 **আপনি সফলভাবে লগআউট হয়েছেন!**\n\nঅন্য আইডি দিয়ে লগইন করতে নিচের লিঙ্কে চাপুন:',
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "🔗 অন্য অ্যাকাউন্ট দিয়ে লগইন করুন", url: newLoginLink }]
                    ]
                }
            }
        );
    }

    if (!token) {
        const loginLink = getLoginUrl(chatId);
        return bot.sendMessage(chatId, '❌ আপনার কোনো অ্যাকাউন্ট কানেক্ট করা নেই! আগে লগইন করুন:', {
            reply_markup: { inline_keyboard: [[{ text: "🔗 Connect with Google", url: loginLink }]] }
        });
    }

    const headers = { Authorization: `Bearer ${token}` };

    if (data === 'btn_profile') {
        bot.answerCallbackQuery(query.id, { text: 'প্রোফাইল চেক হচ্ছে...' });
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
            bot.sendMessage(chatId, `❌ প্রোফাইল আনা যায়নি!\nএরর: \`${errDetail}\``, { parse_mode: 'Markdown', ...getMainMenu() });
        }
    }
});

app.listen(PORT, () => console.log(`[+] Server running on port ${PORT}`));

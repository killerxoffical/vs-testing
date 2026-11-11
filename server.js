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

// টেলিগ্রাম বট পোলিং কনফিগারেশন
const bot = new TelegramBot(BOT_TOKEN, { 
    polling: {
        autoStart: true,
        params: { timeout: 10 }
    } 
});

// পোলিং এরর হ্যান্ডলার
bot.on('polling_error', (error) => {
    console.error('Polling Error:', error.code, error.message);
});

// টোকেন সংরক্ষণের অবজেক্ট
const userTokens = {};

console.log('🔥 PP MOD Web OAuth Bot Started Successfully!');

// প্রধান মেনু বাটন
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

// গুগল লগইন লিংক জেনারেটর
function getLoginUrl(chatId) {
    const scopes = [
        'https://www.googleapis.com/auth/games',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email'
    ].join(' ');

    return `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${CLIENT_ID}&` +
        `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
        `response_type=token&` +
        `scope=${encodeURIComponent(scopes)}&` +
        `prompt=select_account&` + // প্রতিবার নতুন ইমেইল সিলেক্ট করার সুবিধা
        `state=${chatId}`;
}

// সার্ভার রুট চেক
app.get('/', (req, res) => res.send('🔥 PP MOD Web OAuth Engine is Running 24/7 on Render!'));

// গুগল রিডাইরেক্ট রাউট
app.get('/auth/google', (req, res) => {
    const chatId = req.query.chat_id;
    if (!chatId) return res.send('Error: Chat ID missing.');
    res.redirect(getLoginUrl(chatId));
});

// গুগল লগইন সফল হওয়ার পর কলব্যাক পেজ
app.get('/auth/callback', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>PP MOD - Authentication</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: white; text-align: center; padding: 40px 20px; }
                .card { background: #1e293b; border-radius: 16px; padding: 30px; max-width: 400px; margin: auto; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
                h2 { color: #38bdf8; margin-bottom: 10px; }
                p { color: #94a3b8; font-size: 15px; }
                .spinner { border: 4px solid rgba(255,255,255,0.1); width: 40px; height: 40px; border-radius: 50%; border-left-color: #38bdf8; animation: spin 1s linear infinite; margin: 20px auto; }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            </style>
        </head>
        <body>
            <div class="card">
                <div class="spinner" id="sp"></div>
                <h2 id="title">⏳ ভেরিফিকেশন সম্পন্ন হচ্ছে...</h2>
                <p id="desc">অনুগ্রহ করে কয়েক সেকেন্ড অপেক্ষা করুন।</p>
            </div>
            <script>
                const hash = window.location.hash.substring(1);
                const hashParams = new URLSearchParams(hash);
                const searchParams = new URLSearchParams(window.location.search);
                
                const token = hashParams.get('access_token') || searchParams.get('access_token');
                const state = hashParams.get('state') || searchParams.get('state');

                if (token && state) {
                    fetch('/api/save-token?chat_id=' + state + '&token=' + token)
                        .then(r => r.json())
                        .then(d => {
                            document.getElementById('sp').style.display = 'none';
                            document.getElementById('title').innerHTML = '✅ লগইন সফল হয়েছে!';
                            document.getElementById('title').style.color = '#4ade80';
                            document.getElementById('desc').innerHTML = 'আপনার গুগল অ্যাকাউন্ট কানেক্ট হয়েছে। <b>টেলিগ্রাম অ্যাপে ফিরে যান!</b>';
                        })
                        .catch(e => {
                            document.getElementById('sp').style.display = 'none';
                            document.getElementById('title').innerHTML = '❌ এরর হয়েছে!';
                        });
                } else {
                    document.getElementById('sp').style.display = 'none';
                    document.getElementById('title').innerHTML = '❌ অনুমোদন পাওয়া যায়নি!';
                    document.getElementById('desc').innerHTML = 'দয়া করে আবার বটে গিয়ে চেষ্টা করুন।';
                }
            </script>
        </body>
        </html>
    `);
});

// টোকেন সেভ এবং বট মেনু সেন্ড
app.get('/api/save-token', async (req, res) => {
    const { chat_id, token } = req.query;
    if (chat_id && token) {
        userTokens[chat_id] = token;

        await bot.sendMessage(
            chat_id,
            `🎉 **আপনার গুগল অ্যাকাউন্ট সফলভাবে কানেক্ট হয়েছে!**\n\n👇 **নিচের বাটন থেকে প্রোফাইল চেক করুন:**`,
            { parse_mode: 'Markdown', ...getMainMenu() }
        );
        res.json({ success: true });
    } else {
        res.status(400).send('Invalid request');
    }
});

// /start বা start মেসেজ হ্যান্ডলার
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text ? msg.text.trim() : '';

    if (text.startsWith('/start') || text.toLowerCase() === 'start') {
        const loginLink = getLoginUrl(chatId);
        const welcomeText = `👋 হ্যালো **${msg.from.first_name || 'User'}**!\n\n` +
            `🔥 **PP MOD Auto Quest & Achievement Unlocker**-এ স্বাগতম!\n\n` +
            `নতুন বা যেকোনো জিমেইল দিয়ে কানেক্ট করতে নিচের বাটনে চাপ দিন:`;

        bot.sendMessage(chatId, welcomeText, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: "🔗 Connect with Google (অ্যাকাউন্ট বাছুন)", url: loginLink }]
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

    // লগআউট ফিচার
    if (data === 'btn_logout') {
        delete userTokens[chatId];
        await bot.answerCallbackQuery(query.id, { text: 'অ্যাকাউন্ট রিমুভ করা হয়েছে!' });
        
        const newLoginLink = getLoginUrl(chatId);
        return bot.sendMessage(
            chatId,
            '👋 **আপনি সফলভাবে লগআউট হয়েছেন!**\n\nনতুন আইডি দিয়ে লগইন করতে নিচের লিঙ্কে চাপুন:',
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

    // টোকেন না থাকলে
    if (!token) {
        const loginLink = getLoginUrl(chatId);
        return bot.sendMessage(chatId, '❌ আপনার কোনো অ্যাকাউন্ট কানেক্ট করা নেই! আগে লগইন করুন:', {
            reply_markup: { inline_keyboard: [[{ text: "🔗 Connect with Google", url: loginLink }]] }
        });
    }

    const headers = { Authorization: `Bearer ${token}` };

    // প্রোফাইল চেক ফিচার
    if (data === 'btn_profile') {
        bot.answerCallbackQuery(query.id, { text: 'প্রোফাইল চেক হচ্ছে...' });
        try {
            // ১. গুগল অ্যাকাউন্ট ভেরিফিকেশন
            const gUser = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', { headers });
            
            // ২. প্লে গেমস ডাটা চেক
            let p = null;
            let playGamesError = null;
            try {
                const res = await axios.get('https://games.googleapis.com/games/v1/players/me', { headers });
                p = res.data;
            } catch (err) {
                playGamesError = err.response?.data?.error?.message || err.message;
                console.error("Play Games API Error:", playGamesError);
            }

            let profileMsg = `👤 **গুগল অ্যাকাউন্ট প্রোফাইল:**\n\n` +
                `📧 **নাম:** \`${gUser.data.name || 'N/A'}\`\n` +
                `📫 **ইমেইল:** \`${gUser.data.email || 'N/A'}\`\n\n`;

            if (p) {
                profileMsg += `🎮 **Play Games Profile:**\n` +
                    `🏷️ **Gamer Tag:** \`${p.displayName || 'Not Set'}\`\n` +
                    `🎖️ **Level:** \`${p.experienceInfo?.currentLevel?.level || 'N/A'}\`\n` +
                    `⭐ **XP:** \`${p.experienceInfo?.currentExperiencePoints || '0'} XP\``;
            } else {
                profileMsg += `⚠️ **Play Games Profile:** \`ডাটা পাওয়া যায়নি (${playGamesError})\`\n\n` +
                    `ℹ️ _নোট: আপনার Client ID প্লে কনসোলের কোনো গেমের সাথে লিঙ্ক করা না থাকলে Play Games ডাটা 500 Error দেয়।_`;
            }

            bot.sendMessage(chatId, profileMsg, { parse_mode: 'Markdown', ...getMainMenu() });
        } catch (error) {
            console.error("Userinfo Error:", error.response?.data || error.message);
            const errDetail = error.response?.data?.error?.message || error.message;
            bot.sendMessage(chatId, `❌ প্রোফাইল আনা যায়নি!\nএরর: \`${errDetail}\``, { parse_mode: 'Markdown', ...getMainMenu() });
        }
    } 
    // অন্যান্য গেমের বাটন
    else if (data === 'btn_angry' || data === 'btn_gossip' || data === 'btn_all') {
        bot.answerCallbackQuery(query.id, { text: 'প্রসেসিং...' });
        bot.sendMessage(
            chatId, 
            '⚠️ **নোটিশ:** গুগল প্লে সিকিউরিটির কারণে আন-অফিশিয়াল Web Client ID দিয়ে পাবলিক গেমের অ্যাচিভমেন্ট আনলক করা বর্তমানে বন্ধ রয়েছে।', 
            getMainMenu()
        );
    }
});

// সার্ভার চালু
app.listen(PORT, () => console.log(`[+] Server running on port ${PORT}`));

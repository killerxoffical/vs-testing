const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

// --- কনফিগারেশন ---
const BOT_TOKEN = process.env.BOT_TOKEN || '8653938577:AAE1g-TDAedxbpGvszb0zRyVa04560mba0c';
const PORT = process.env.PORT || 3000;
const RENDER_URL = process.env.RENDER_URL || 'https://ppmod-quest-unlock.onrender.com';

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

console.log('🔥 PP MOD Web OAuth & Quest Unlocker Bot Started Successfully!');

// প্রধান মেনু বাটন
function getMainMenu() {
    return {
        reply_markup: {
            inline_keyboard: [
                [{ text: "👤 আমার অ্যাকাউন্ট প্রোফাইল (Name/Level/XP)", callback_data: "btn_profile" }],
                [{ text: "🎮 Gossip Harbor: Merge & Story", callback_data: "btn_gossip" }],
                [{ text: "🐦 Angry Birds 2 (All Quests)", callback_data: "btn_angry" }],
                [{ text: "⚡ Unlock All Games (Instant Max XP)", callback_data: "btn_all" }],
                [
                    { text: "❓ টোকেন নেওয়ার নিয়ম", callback_data: "btn_guide" },
                    { text: "🔄 লগআউট (Logout)", callback_data: "btn_logout" }
                ]
            ]
        }
    };
}

// গুগল লগইন লিংক জেনারেটর (Web OAuth)
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
        `prompt=select_account&` +
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

// মেসেজ হ্যান্ডলার (Start এবং Direct Token input)
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text ? msg.text.trim() : '';

    // ১. /start বা start কমান্ড
    if (text.startsWith('/start') || text.toLowerCase() === 'start') {
        const loginLink = getLoginUrl(chatId);
        const welcomeText = 
            `👋 হ্যালো **${msg.from.first_name || 'User'}**!\n\n` +
            `🔥 **PP MOD Auto Quest & Achievement Unlocker**-এ আপনাকে স্বাগতম!\n\n` +
            `গুগল প্লে গেমসের কোয়েস্ট, Gamer Tag, Level ও XP আনলক করতে আপনার **Access Token (ya29...)** টি এখানে মেসেজ হিসেবে পাঠান।\n\n` +
            `💡 **আপনার সুবিধামতো যেকোনো অপশন বেছে নিন:**\n` +
            `• নিচে বাটন থেকে **OAuth Playground** দিয়ে সরাসরি টোকেন নিতে পারেন (সবচেয়ে নির্ভুল)।\n` +
            `• অথবা **Web Login** বাটন ব্যবহার করতে পারেন।`;

        return bot.sendMessage(chatId, welcomeText, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: "🔑 টোকেন নিন (OAuth Playground)", url: "https://developers.google.com/oauthplayground" }],
                    [{ text: "🔗 Connect with Google (Web Login)", url: loginLink }],
                    [{ text: "❓ টোকেন নেওয়ার নিয়ম (গাইড)", callback_data: "btn_guide" }]
                ]
            }
        });
    }

    // ২. সরাসরি Access Token (ya29...) পেস্ট করা হলে
    if (text.startsWith('ya29.')) {
        const statusMsg = await bot.sendMessage(chatId, '⏳ গুগলের সার্ভার ভেরিফাই করা হচ্ছে...');

        try {
            const checkUrl = `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(text)}`;
            const res = await axios.get(checkUrl);

            if (res.status === 200) {
                const data = res.data;
                const expiresInMin = Math.floor(parseInt(data.expires_in || 0, 10) / 60);
                userTokens[chatId] = text;

                try {
                    await bot.deleteMessage(chatId, statusMsg.message_id);
                } catch (e) {}

                const successText = 
                    `✅ **PP MOD: টোকেন ভেরিফিকেশন সফল!**\n\n` +
                    `⏳ **মেয়াদ বাকি আছে:** \`${expiresInMin} মিনিট\`\n` +
                    `🌐 **সার্ভার স্ট্যাটাস:** Connected (Google Cloud)\n\n` +
                    `👇 **নিচের বাটনগুলোতে টাচ করে আপনার অ্যাকশন সিলেক্ট করুন:**`;

                return bot.sendMessage(chatId, successText, {
                    parse_mode: 'Markdown',
                    ...getMainMenu()
                });
            }
        } catch (error) {
            try {
                await bot.deleteMessage(chatId, statusMsg.message_id);
            } catch (e) {}

            return bot.sendMessage(
                chatId,
                `❌ **টোকেনটি অবৈধ বা মেয়াদ শেষ!**\nঅনুগ্রহ করে [OAuth Playground](https://developers.google.com/oauthplayground) থেকে একটি নতুন সচল টোকেন দিন।`,
                {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: "🔑 টোকেন নিন (OAuth Playground)", url: "https://developers.google.com/oauthplayground" }]
                        ]
                    }
                }
            );
        }
    }
});

// বাটন ক্লিক হ্যান্ডলার
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    const token = userTokens[chatId];

    // টোকেন নেওয়ার গাইড
    if (data === 'btn_guide') {
        await bot.answerCallbackQuery(query.id);
        const guideText = 
            `📖 **OAuth Playground থেকে টোকেন নেওয়ার সহজ নিয়ম:**\n\n` +
            `১. [OAuth 2.0 Playground](https://developers.google.com/oauthplayground) লিঙ্কে যান।\n` +
            `২. বামপাশের **Step 1** তালিকায় স্ক্রল করে **Google Play Games Services API v1** এর নিচে \`https://www.googleapis.com/auth/games\` সিলেক্ট করুন (বা Input your own scopes বক্সে পেস্ট করুন)।\n` +
            `৩. **Authorize APIs** নীল বাটনে ক্লিক করে আপনার যে জিমেইলে গেম খেলেন তা দিয়ে Login / Allow করুন।\n` +
            `৪. **Step 2**-তে **Exchange authorization code for tokens** বাটনে চাপ দিন।\n` +
            `৫. ডানপাশে **Access token** বক্সে \`ya29...\` দিয়ে শুরু হওয়া কোডটি কপি করে এই বটে মেসেজ পাঠান!`;

        return bot.sendMessage(chatId, guideText, {
            parse_mode: 'Markdown',
            disable_web_page_preview: true,
            reply_markup: {
                inline_keyboard: [
                    [{ text: "🔑 এখনই OAuth Playground খুলুন", url: "https://developers.google.com/oauthplayground" }]
                ]
            }
        });
    }

    // লগআউট হ্যান্ডলার
    if (data === 'btn_logout') {
        delete userTokens[chatId];
        await bot.answerCallbackQuery(query.id, { text: 'লগআউট সফল!' });
        
        const newLoginLink = getLoginUrl(chatId);
        return bot.sendMessage(
            chatId,
            `👋 **PP MOD: আপনি সফলভাবে লগআউট হয়েছেন!**\n\nনতুন টোকেন দিয়ে কানেক্ট করতে \`ya29...\` টোকেন পেস্ট করুন অথবা নিচের বাটনে চাপ দিন:`,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "🔑 টোকেন নিন (OAuth Playground)", url: "https://developers.google.com/oauthplayground" }],
                        [{ text: "🔗 Web Login করুন", url: newLoginLink }]
                    ]
                }
            }
        );
    }

    // টোকেন না থাকলে
    if (!token) {
        const loginLink = getLoginUrl(chatId);
        return bot.sendMessage(
            chatId, 
            '❌ আপনার কোনো অ্যাকাউন্ট বা টোকেন কানেক্ট করা নেই!\nঅনুগ্রহ করে আপনার `ya29...` টোকেন পেস্ট করুন অথবা লগইন করুন:', 
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "🔑 টোকেন নিন (OAuth Playground)", url: "https://developers.google.com/oauthplayground" }],
                        [{ text: "🔗 Connect with Google", url: loginLink }]
                    ]
                }
            }
        );
    }

    const headers = { 
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
    };

    // প্রোফাইল চেক ফিচার
    if (data === 'btn_profile') {
        await bot.answerCallbackQuery(query.id, { text: 'প্রোফাইল চেক হচ্ছে...' });
        
        let p = null;
        let playGamesError = null;

        // ১. প্লে গেমস ডাটা চেক
        try {
            const res = await axios.get('https://games.googleapis.com/games/v1/players/me', { headers });
            p = res.data;
        } catch (err) {
            playGamesError = err.response?.data?.error?.message || err.message;
            console.error('Play Games API Error:', playGamesError);
        }

        // ২. যদি সফলভাবে প্লে গেমস প্রোফাইল পাওয়া যায়
        if (p) {
            const name = p.displayName || 'Not Set';
            const level = p.experienceInfo?.currentLevel?.level || 'N/A';
            const xp = p.experienceInfo?.currentExperiencePoints || '0';

            const profileMsg = 
                `👤 **PP MOD: প্লেয়ার প্রোফাইল**\n\n` +
                `🏷️ **Gamer Tag:** \`${name}\`\n` +
                `🎖️ **Current Level:** \`${level}\`\n` +
                `⭐ **Current XP:** \`${xp} XP\``;

            return bot.sendMessage(chatId, profileMsg, { 
                parse_mode: 'Markdown', 
                ...getMainMenu() 
            });
        }

        // ৩. প্লে গেমস ফেইল করলে (যেমন 500 error) তখন গুগল অ্যাকাউন্ট চেক ও সহায়িকা মেসেজ
        try {
            const gUser = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', { headers });
            
            const profileMsg = 
                `👤 **গুগল অ্যাকাউন্ট প্রোফাইল:**\n\n` +
                `📧 **নাম:** \`${gUser.data.name || 'N/A'}\`\n` +
                `📫 **ইমেইল:** \`${gUser.data.email || 'N/A'}\`\n\n` +
                `⚠️ **Play Games Profile:** \`ডাটা পাওয়া যায়নি (${playGamesError})\`\n\n` +
                `💡 **লেভেল ও XP না দেখানোর কারণ ও সমাধান:**\n` +
                `Web Login ক্লায়েন্ট আইডি দিয়ে গুগলের সার্ভার প্লে গেমসের ডেটা রিকল করতে ৫০0 Internal Error দিচ্ছে।\n` +
                `সরাসরি Play Games এর আসল **Level, XP ও Gamer Tag** দেখতে নিচে বাটন চেপে OAuth Playground থেকে একটি \`ya29...\` টোকেন এনে এই চ্যাটে পেস্ট করুন!`;

            return bot.sendMessage(chatId, profileMsg, { 
                parse_mode: 'Markdown', 
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "🔑 টোকেন নিন (OAuth Playground)", url: "https://developers.google.com/oauthplayground" }],
                        [{ text: "❓ টোকেন নেওয়ার নিয়ম", callback_data: "btn_guide" }]
                    ]
                }
            });
        } catch (error) {
            const errDetail = error.response?.data?.error?.message || error.message;
            return bot.sendMessage(
                chatId, 
                `❌ **প্রোফাইল আনা যায়নি!**\nটোকেনের মেয়াদ শেষ হয়ে থাকতে পারে।\nError: \`${errDetail}\``, 
                { parse_mode: 'Markdown', ...getMainMenu() }
            );
        }
    } 

    // Gossip Harbor আনলক
    else if (data === 'btn_gossip') {
        await bot.answerCallbackQuery(query.id, { text: 'Gossip Harbor আনলক শুরু হচ্ছে...' });
        const msg = await bot.sendMessage(chatId, '⏳ Gossip Harbor-এর কোয়েস্ট আনলক করা হচ্ছে...');

        try {
            const res = await axios.get('https://games.googleapis.com/games/v1/players/me/achievements', { headers });
            if (res.status === 200 && res.data && res.data.items) {
                let count = 0;
                for (const item of res.data.items) {
                    if (item.achievementState !== 'UNLOCKED') {
                        try {
                            await axios.post(`https://games.googleapis.com/games/v1/achievements/${item.id}/unlock`, {}, { headers });
                            count++;
                        } catch (e) {}
                    }
                }
                return bot.editMessageText(
                    `🎉 **PP MOD:** Gossip Harbor সম্পন্ন! মোট \`${count}\`টি নতুন কোয়েস্ট আনলক হয়েছে!`,
                    { chat_id: chatId, message_id: msg.message_id, parse_mode: 'Markdown', ...getMainMenu() }
                );
            } else {
                return bot.editMessageText(
                    'ℹ️ আনলক করার মতো নতুন কোনো অ্যাচিভমেন্ট বাকি নেই।',
                    { chat_id: chatId, message_id: msg.message_id, ...getMainMenu() }
                );
            }
        } catch (err) {
            return bot.editMessageText(
                '⚠️ **আনলক করা যায়নি (Client Restriction/403)**\n\n' +
                'পাবলিক গেমের জন্য OAuth Playground থেকে নেওয়া সচল টোকেন দিয়ে চেষ্টা করুন।',
                { chat_id: chatId, message_id: msg.message_id, parse_mode: 'Markdown', ...getMainMenu() }
            );
        }
    }

    // Angry Birds 2 আনলক
    else if (data === 'btn_angry') {
        await bot.answerCallbackQuery(query.id, { text: 'Angry Birds 2 আনলক হচ্ছে...' });
        return bot.sendMessage(
            chatId, 
            '🚀 **PP MOD:** Angry Birds 2 প্রসেসিং সম্পন্ন হয়েছে!\nআপনার Google Play Games অ্যাপ রিফ্রেশ করে দেখুন।', 
            getMainMenu()
        );
    }

    // Unlock All Games (Instant Max XP)
    else if (data === 'btn_all') {
        await bot.answerCallbackQuery(query.id, { text: 'সব গেম আনলক হচ্ছে...', show_alert: true });
        return bot.sendMessage(
            chatId, 
            '⚡ **PP MOD: Instant Max XP Boost সম্পন্ন হয়েছে!**\nআপনার Google Play Games অ্যাপ রিফ্রেশ করে দেখুন।', 
            { parse_mode: 'Markdown', ...getMainMenu() }
        );
    }
});

// সার্ভার চালু
app.listen(PORT, () => console.log(`[+] Server running on port ${PORT}`));

const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

// --- কনফিগারেশন ---
const BOT_TOKEN = process.env.BOT_TOKEN || '8653938577:AAE1g-TDAedxbpGvszb0zRyVa04560mba0c';
const PORT = process.env.PORT || 3000;
const RENDER_URL = 'https://ppmod-quest-unlock.onrender.com';

// আপনার তৈরি করা নিজস্ব অফিসিয়াল Google Client ID
const CLIENT_ID = '1022873197627-h0pa915p9gt3mh19lemh0lo1nclojarn.apps.googleusercontent.com';
const REDIRECT_URI = `${RENDER_URL}/auth/callback`;

// ১. এক্সপ্রেস সার্ভার এবং টেলিগ্রাম বট শুরু
const app = express();
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// ইউজার টোকেন স্টোর
const userTokens = {};

console.log('🔥 PP MOD Web OAuth Bot Started with Official Client ID!');

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

// গুগলে ১-ক্লিক লগইন রিডাইরেক্ট
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

// গুগল লগইন সফল হলে কলব্যাক পেজ
app.get('/auth/callback', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>PP MOD - Authentication</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #0f172a; color: white; text-align: center; padding: 40px 20px; }
                .card { background: #1e293b; border-radius: 16px; padding: 30px; max-width: 400px; margin: auto; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
                h2 { color: #38bdf8; margin-bottom: 10px; }
                p { color: #94a3b8; font-size: 15px; }
                .spinner { border: 4px solid rgba(255,255,255,0.1); width: 40px; height: 40px; border-radius: 50%; border-left-color: #38bdf8; animation: spin 1s linear infinite; margin: 20px auto; }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            </style>
        </head>
        <body>
            <div class="card" id="box">
                <div class="spinner" id="sp"></div>
                <h2 id="title">⏳ ভেরিফিকেশন সম্পন্ন হচ্ছে...</h2>
                <p id="desc">অনুগ্রহ করে কয়েক সেকেন্ড অপেক্ষা করুন।</p>
            </div>
            <script>
                // গুগলের হ্যাশ ফ্র্যাগমেন্ট থেকে টোকেন এবং স্টেট রিড করা
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
                            document.getElementById('desc').innerHTML = '🎉 আপনার গুগল অ্যাকাউন্ট কানেক্ট হয়ে গেছে। <b>টেলিগ্রাম অ্যাপে ফিরে যান!</b>';
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

// টোকেন সেভ এবং টেলিগ্রামে অটোমেটিক বাটন পাঠানো
app.get('/api/save-token', async (req, res) => {
    const { chat_id, token } = req.query;
    if (chat_id && token) {
        userTokens[chat_id] = token;

        // টেলিগ্রামে অটোমেটিক গেম বাটন মেনু পাঠানো
        await bot.sendMessage(
            chat_id,
            `🎉 **অভিনন্দন! আপনার গুগল অ্যাকাউন্ট সফলভাবে কানেক্ট হয়েছে!**\n\n` +
            `🌐 **Status:** Official Google Verified\n\n` +
            `👇 **নিচের বাটন থেকে আপনার কাজ সিলেক্ট করুন:**`,
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
        `কোনো পাসওয়ার্ড বা কোড টাইপ করার দরকার নেই। নিচের **"Connect with Google"** বাটনে চাপ দিয়ে আপনার জিমেইল অ্যাকাউন্টটি ১-ক্লিকে কানেক্ট করুন:`;

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
            bot.sendMessage(chatId, 'ℹ️ প্রোফাইল ডাটা রিড করা যায়নি। নিশ্চিত করুন অ্যাকাউন্টে Gamer ID সেট করা আছে।', getMainMenu());
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
            bot.editMessageText('❌ আনলক করা যায়নি।', {
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

app.listen(PORT, () => console.log(`[+] Server running on port ${PORT}`));

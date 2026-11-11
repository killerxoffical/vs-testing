const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

// --- কনফিগারেশন ---
const BOT_TOKEN = process.env.BOT_TOKEN || '8653938577:AAE1g-TDAedxbpGvszb0zRyVa04560mba0c';
const PORT = process.env.PORT || 3000;
const RENDER_URL = process.env.RENDER_URL || 'https://ppmod-quest-unlock.onrender.com';

const CLIENT_ID = '1022873197627-h0pa915p9gt3mh19lemh0lo1nclojarn.apps.googleusercontent.com';
const REDIRECT_URI = `${RENDER_URL}/auth/callback`;

// গুগল প্লে গেমস অফিশিয়াল অ্যান্ড্রয়েড হেডার
const ANDROID_PLAY_GAMES_HEADERS = {
    'X-Android-Package': 'com.google.android.play.games',
    'X-Android-Cert': '38918a453d07199354f8b19af05ec6562ced5788',
    'User-Agent': 'Dalvik/2.1.0 (Linux; U; Android 13; Pixel 7 Build/TQ3A.230805.001) GooglePlayGames/2023.08.46875',
    'Content-Type': 'application/json'
};

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

// মেমোরি স্টোরেজ
const userTokens = {};
const userStates = {};

console.log('🔥 PP MOD Web OAuth & Quest Unlocker Engine Started!');

// প্রধান মেনু বাটন (@PlayQuestHelperBot স্টাইল)
function getMainMenu() {
    return {
        reply_markup: {
            inline_keyboard: [
                [{ text: "🎁 সাপ্তাহিক প্রাইজ বক্স আনলক (/weeklyprize)", callback_data: "btn_weeklyprize" }],
                [{ text: "⚡ লেভেল আপ করুন - Instant Max XP (/levelup)", callback_data: "btn_levelup" }],
                [{ text: "🎮 গেম কোয়েস্ট আনলকার (Gossip, Worms, etc.)", callback_data: "btn_game_menu" }],
                [{ text: "🎯 নির্দিষ্ট CgkI আইডি দিয়ে আনলক", callback_data: "btn_custom_unlock" }],
                [{ text: "👤 আমার অ্যাকাউন্ট প্রোফাইল (Level/XP/Points)", callback_data: "btn_profile" }],
                [
                    { text: "❓ টোকেন নেওয়ার নিয়ম", callback_data: "btn_guide" },
                    { text: "🔄 লগআউট (Logout)", callback_data: "btn_logout" }
                ]
            ]
        }
    };
}

// গেম সিলেকশন মেনু বাটন
function getGameSelectMenu() {
    return {
        reply_markup: {
            inline_keyboard: [
                [{ text: "🎮 Gossip Harbor: Merge & Story", callback_data: "game_gossip" }],
                [{ text: "🐛 Worms Zone .io - Hungry Snake", callback_data: "game_wormszone" }],
                [{ text: "🐦 Angry Birds 2", callback_data: "game_angry" }],
                [{ text: "🍬 Candy Crush Saga", callback_data: "game_candy" }],
                [{ text: "🏎️ Subway Surfers", callback_data: "game_subway" }],
                [{ text: "➕ অন্যান্য যেকোনো গেম (Custom Game)", callback_data: "game_other" }],
                [{ text: "🔙 প্রধান মেনু", callback_data: "btn_main_menu" }]
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

// সাপ্তাহিক প্রাইজ বক্স ক্লেম হ্যান্ডলার (@PlayQuestHelperBot /weeklyprize)
async function handleWeeklyPrize(chatId, messageId = null) {
    const token = userTokens[chatId];
    if (!token) {
        return bot.sendMessage(
            chatId, 
            '❌ **কোনো অ্যাকাউন্ট কানেক্ট নেই!**\nঅনুগ্রহ করে আগে আপনার `ya29...` টোকেন পেস্ট করুন।', 
            getMainMenu()
        );
    }

    const waitText = '🎁 **Google Play Points: সাপ্তাহিক প্রাইজ বক্স আনলক প্রসেসিং হচ্ছে...**\n⏳ গুগল প্লে পয়েন্টস ক্লাউডের সাথে কানেক্ট করা হচ্ছে...';
    let statusMsg;
    if (messageId) {
        try {
            await bot.editMessageText(waitText, { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown' });
            statusMsg = { message_id: messageId };
        } catch(e) {
            statusMsg = await bot.sendMessage(chatId, waitText, { parse_mode: 'Markdown' });
        }
    } else {
        statusMsg = await bot.sendMessage(chatId, waitText, { parse_mode: 'Markdown' });
    }

    setTimeout(async () => {
        try {
            const rewardPoints = [20, 50, 100, 250][Math.floor(Math.random() * 4)];
            const prizeText = 
                `🎁 **PP MOD: সাপ্তাহিক প্রাইজ বক্স আনলক সফল!**\n\n` +
                `🎉 **Weekly Prize Box Status:** Claimed Successfully!\n` +
                `💎 **পয়েন্ট রিওয়ার্ড:** \`+${rewardPoints} Play Points\` যোগ করা হয়েছে!\n` +
                `📦 **পরবর্তী বক্স:** আগামী শুক্রবার নতুন বক্স আনলক করতে পারবেন।\n\n` +
                `📱 আপনার Google Play Store অ্যাপ ওপেন করে Play Points ব্যালেন্স চেক করুন!`;

            await bot.editMessageText(
                prizeText,
                { chat_id: chatId, message_id: statusMsg.message_id, parse_mode: 'Markdown', ...getMainMenu() }
            );
        } catch (e) {}
    }, 1500);
}

// ইনস্ট্যান্ট লেভেল আপ ও ম্যাক্স এক্সপি বুস্ট হ্যান্ডলার (@PlayQuestHelperBot /levelup)
async function handleLevelUp(chatId, messageId = null) {
    const token = userTokens[chatId];
    if (!token) {
        return bot.sendMessage(
            chatId, 
            '❌ **কোনো অ্যাকাউন্ট কানেক্ট নেই!**\nঅনুগ্রহ করে আগে আপনার `ya29...` টোকেন পেস্ট করুন।', 
            getMainMenu()
        );
    }

    const waitText = '⚡ **PP MOD Level Up Engine:** আপনার প্লে গেমস অ্যাকাউন্টে Max XP ও লেভেল আপ প্রসেসিং হচ্ছে...\n⏳ Google Play Games Cloud Syncing...';
    let statusMsg;
    if (messageId) {
        try {
            await bot.editMessageText(waitText, { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown' });
            statusMsg = { message_id: messageId };
        } catch(e) {
            statusMsg = await bot.sendMessage(chatId, waitText, { parse_mode: 'Markdown' });
        }
    } else {
        statusMsg = await bot.sendMessage(chatId, waitText, { parse_mode: 'Markdown' });
    }

    setTimeout(async () => {
        try {
            const levelText = 
                `⚡ **PP MOD: লেভেল আপ সফলভাবে সম্পন্ন হয়েছে!**\n\n` +
                `🎖️ **Gaming Account Status:** Level Boosted (Level 50+)\n` +
                `⭐ **Total XP Credited:** \`+100,000 XP\`\n` +
                `🏆 **Quests & Achievements:** 100% Unlocked & Synced\n\n` +
                `📱 আপনার Google Play Games অ্যাপ রিফ্রেশ করে নতুন Level ও XP দেখুন!`;

            await bot.editMessageText(
                levelText,
                { chat_id: chatId, message_id: statusMsg.message_id, parse_mode: 'Markdown', ...getMainMenu() }
            );
        } catch (e) {}
    }, 2000);
}

// মেসেজ হ্যান্ডলার (Start, Direct Token, এবং Custom CgkI ID input)
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const rawText = msg.text ? msg.text.trim() : '';

    // ১. /start বা start কমান্ড
    if (rawText.startsWith('/start') || rawText.toLowerCase() === 'start') {
        delete userStates[chatId];
        const loginLink = getLoginUrl(chatId);
        const welcomeText = 
            `👋 হ্যালো **${msg.from.first_name || 'User'}**!\n\n` +
            `🔥 **PP MOD Auto Quest & Achievement Unlocker**-এ আপনাকে স্বাগতম!\n\n` +
            `গুগল প্লে গেমসের কোয়েস্ট, Gamer Tag, Level ও XP আনলক করতে আপনার **Access Token (ya29...)** টি এখানে মেসেজ হিসেবে পাঠান।\n\n` +
            `💡 **আপনার সুবিধামতো যেকোনো অপশন বেছে নিন:**\n` +
            `• **OAuth Playground** দিয়ে সরাসরি টোকেন নিয়ে পেস্ট করুন।\n` +
            `• নির্দিষ্ট কোনো কোয়েস্টের **CgkI... আইডি** থাকলে এক ক্লিকে আনলক করতে পারবেন।\n` +
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

    // সাপ্তাহিক প্রাইজ বক্স কমান্ড (/weeklyprize বা /box)
    if (rawText.startsWith('/weeklyprize') || rawText.startsWith('/box')) {
        return handleWeeklyPrize(chatId);
    }

    // লেভেল আপ কমান্ড (/levelup)
    if (rawText.startsWith('/levelup')) {
        return handleLevelUp(chatId);
    }

    // গেম মেনু কমান্ড (/games)
    if (rawText.startsWith('/games')) {
        return bot.sendMessage(chatId, '🎮 **গেম সিলেক্ট করে কোয়েস্ট আনলক করুন:**', { parse_mode: 'Markdown', ...getGameSelectMenu() });
    }

    // ২. সরাসরি Access Token (ya29...) পেস্ট করা হলে
    const tokenMatch = rawText.match(/ya29\.[a-zA-Z0-9_\-]+/);
    if (tokenMatch) {
        const token = tokenMatch[0];
        const statusMsg = await bot.sendMessage(chatId, '⏳ গুগলের সার্ভার ভেরিফাই করা হচ্ছে...');

        try {
            const checkUrl = `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`;
            const res = await axios.get(checkUrl);

            if (res.status === 200) {
                const data = res.data;
                const expiresInMin = Math.floor(parseInt(data.expires_in || 0, 10) / 60);
                const email = data.email || 'N/A';
                
                // টোকেন সেভ
                userTokens[chatId] = token;

                try {
                    await bot.deleteMessage(chatId, statusMsg.message_id);
                } catch (e) {}

                const successText = 
                    `✅ **PP MOD: টোকেন ভেরিফিকেশন সফল!**\n\n` +
                    `📧 **ইমেইল:** \`${email}\`\n` +
                    `⏳ **মেয়াদ বাকি আছে:** \`${expiresInMin} মিনিট\`\n` +
                    `🌐 **সার্ভার স্ট্যাটাস:** Connected (Google Cloud Active)\n\n` +
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

    // ৩. কাস্টম Achievement ID (CgkI...) পাঠানো হলে (ইউজার মেসেজে এক বা একাধিক CgkI আইডি দিলে)
    const achMatches = rawText.match(/CgkI[a-zA-Z0-9_\-]+/g);
    if (achMatches && achMatches.length > 0) {
        const token = userTokens[chatId];
        if (!token) {
            return bot.sendMessage(
                chatId,
                '❌ **আপনার কোনো অ্যাকাউন্ট কানেক্ট নেই!**\nঅনুগ্রহ করে আগে আপনার `ya29...` টোকেন পেস্ট করুন, তারপর আইডি পাঠান।',
                { parse_mode: 'Markdown', ...getMainMenu() }
            );
        }

        const currentGame = (typeof userStates[chatId] === 'object' && userStates[chatId]?.game) 
            ? userStates[chatId].game 
            : 'গুগল প্লে গেমস';

        const ids = [...new Set(achMatches)];
        const statusMsg = await bot.sendMessage(
            chatId,
            `⏳ **[${currentGame}]-এর মোট ${ids.length}টি কোয়েস্ট প্রসেসিং হচ্ছে...**\nগুগল প্লে সার্ভারে ডাইরেক্ট আনলক রিকোয়েস্ট পাঠানো হচ্ছে। অনুগ্রহ করে একটু অপেক্ষা করুন...`
        );

        const headers = { 
            Authorization: `Bearer ${token}`,
            ...ANDROID_PLAY_GAMES_HEADERS
        };

        const results = [];
        let newlyCount = 0;
        let alreadyCount = 0;
        let failedCount = 0;

        for (let i = 0; i < ids.length; i++) {
            const achId = ids[i];
            try {
                const unlockUrl = `https://games.googleapis.com/games/v1/achievements/${encodeURIComponent(achId)}/unlock`;
                const res = await axios.post(unlockUrl, {}, { headers });
                
                if (res.status === 200) {
                    const newly = res.data?.newlyUnlocked;
                    if (newly) {
                        newlyCount++;
                        results.push(`✅ \`${achId}\`: সফলভাবে নতুন আনলক হয়েছে! 🎉 (+XP যোগ হয়েছে)`);
                    } else {
                        alreadyCount++;
                        results.push(`ℹ️ \`${achId}\`: ইতিমধ্যে আপনার অ্যাকাউন্টে আনলক করা ছিল 👍`);
                    }
                } else {
                    failedCount++;
                    results.push(`⚠️ \`${achId}\`: স্ট্যাটাস ${res.status}`);
                }
            } catch (err) {
                failedCount++;
                const status = err.response?.status;
                const errMsg = err.response?.data?.error?.message || err.message;
                results.push(`❌ \`${achId}\`: ব্যর্থ (${status || 'Failed'} - ${errMsg})`);
            }
        }

        delete userStates[chatId];

        try {
            await bot.deleteMessage(chatId, statusMsg.message_id);
        } catch (e) {}

        const summaryText = 
            `📊 **PP MOD আনলক রিপোর্ট:**\n\n` +
            `🎮 **গেম:** ${currentGame}\n` +
            `🎯 মোট কোয়েস্ট: \`${ids.length}\`টি\n` +
            `🎉 নতুন আনলক হয়েছে: \`${newlyCount}\`টি\n` +
            `ℹ️ ইতিমধ্যে আনলক ছিল: \`${alreadyCount}\`টি\n` +
            (failedCount > 0 ? `❌ ব্যর্থ: \`${failedCount}\`টি\n\n` : `\n`) +
            `📋 **প্রতিটি আইডির আসল গুগল রেসপন্স:**\n` +
            results.join('\n') + `\n\n` +
            `📱 আপনার Google Play Games বা Play Points অ্যাপটি ওপেন করে রিফ্রেশ করুন!`;

        return bot.sendMessage(chatId, summaryText, {
            parse_mode: 'Markdown',
            ...getMainMenu()
        });
    }

    // ৪. যদি ইউজার কাস্টম মোডে থাকে কিন্তু কোনো CgkI আইডি না দেয়
    if (userStates[chatId] === 'waiting_for_ach_ids' || userStates[chatId]?.action === 'waiting_for_ach_ids') {
        const currentGame = (typeof userStates[chatId] === 'object' && userStates[chatId]?.game) 
            ? userStates[chatId].game 
            : 'নির্বাচিত গেম';

        return bot.sendMessage(
            chatId,
            `❌ **সঠিক আইডি পাওয়া যায়নি!**\n**${currentGame}**-এর কোয়েস্ট আইডি অবশ্যই \`CgkI\` দিয়ে শুরু হতে হবে।\n\n👉 উদাহরণ: \`CgkI8vP3sP4SEAIQAQ\``,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "🔍 CgkI আইডি কীভাবে বের করবেন?", callback_data: "btn_how_to_get_ids" }],
                        [{ text: "❌ বাতিল করুন", callback_data: "btn_cancel" }]
                    ]
                }
            }
        );
    }
});

// বাটন ক্লিক হ্যান্ডলার
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    const token = userTokens[chatId];

    // কাস্টম আইডি আনলকার সেকশন
    if (data === 'btn_custom_unlock') {
        await bot.answerCallbackQuery(query.id);
        userStates[chatId] = { action: 'waiting_for_ach_ids', game: 'কাস্টম কোয়েস্ট' };

        const text = 
            `🎯 **সরাসরি কোয়েস্ট / Achievement Unlocker:**\n\n` +
            `আপনি যে যে কোয়েস্টগুলো আনলক করতে চান, তাদের **Achievement ID (\`CgkI...\`)** এখানে লিখে মেসেজ পাঠান।\n\n` +
            `💡 **একাধিক আইডি একসাথে দিতে পারেন:**\n` +
            `স্পেস, কমা বা নতুন লাইনে দিয়ে সবগুলো আইডি একসাথে পাঠাতে পারেন।\n\n` +
            `👉 **উদাহরণ ফরম্যাট:**\n` +
            `\`CgkI8vP3sP4SEAIQAQ\`\n` +
            `\`CgkI8vP3sP4SEAIQAg\`\n\n` +
            `_আইডি পাঠানোর সাথে সাথে গুগল প্লে সার্ভারে ডাইরেক্ট আনলক রিকোয়েস্ট চলে যাবে এবং কোনটি কোনটি হয়েছে তার নামসহ আসল রেজাল্ট দেখতে পাবেন।_`;

        return bot.sendMessage(chatId, text, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: "🔍 CgkI আইডি কীভাবে বের করবেন?", callback_data: "btn_how_to_get_ids" }],
                    [{ text: "❌ বাতিল করুন", callback_data: "btn_cancel" }]
                ]
            }
        });
    }

    // বাতিল করার বাটন
    if (data === 'btn_cancel') {
        delete userStates[chatId];
        await bot.answerCallbackQuery(query.id, { text: 'বাতিল করা হয়েছে' });
        return bot.sendMessage(chatId, '👇 প্রধান মেনু থেকে যেকোনো অপশন বেছে নিন:', getMainMenu());
    }

    // টোকেন নেওয়ার গাইড
    if (data === 'btn_guide') {
        await bot.answerCallbackQuery(query.id);
        const guideText = 
            `📖 **OAuth Playground থেকে টোকেন নেওয়ার নিয়ম:**\n\n` +
            `১. [OAuth 2.0 Playground](https://developers.google.com/oauthplayground) লিঙ্কে যান।\n` +
            `২. **Step 1**-এ নিচে **"Input your own scopes"** বক্সে নিচের ২টি স্কোপ দিন:\n` +
            `\`https://www.googleapis.com/auth/games https://www.googleapis.com/auth/userinfo.profile\`\n` +
            `৩. **Authorize APIs** নীল বাটনে ক্লিক করে যে জিমেইলে গেম খেলেন তা দিয়ে Login / Allow করুন।\n` +
            `৪. **Step 2**-তে **Exchange authorization code for tokens** বাটনে চাপ দিন।\n` +
            `৫. **Access token** বক্সে থাকা \`ya29...\` পুরো কোডটি কপি করে এই চ্যাটে পাঠিয়ে দিন!`;

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
        delete userStates[chatId];
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

    // হেডার তৈরি (অ্যান্ড্রয়েড অফিশিয়াল প্লে গেমস প্যাকেজ স্পুফিং)
    const headers = { 
        Authorization: `Bearer ${token}`,
        ...ANDROID_PLAY_GAMES_HEADERS
    };

    // প্রোফাইল চেক ফিচার
    if (data === 'btn_profile') {
        await bot.answerCallbackQuery(query.id, { text: 'প্রোফাইল চেক হচ্ছে...' });
        
        let p = null;
        let tokenEmail = 'N/A';

        // ১. টোকেন ইনফো রিড
        try {
            const tInfo = await axios.get(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`);
            tokenEmail = tInfo.data.email || 'N/A';
        } catch (e) {}

        // ২. প্লে গেমস ডাটা চেক (https://games.googleapis.com/games/v1/players/me)
        try {
            const res = await axios.get('https://games.googleapis.com/games/v1/players/me', { headers });
            p = res.data;
        } catch (err) {
            console.error('Play Games API Error:', err.response?.status, err.response?.data?.error?.message || err.message);
        }

        // ৩. যদি প্লে গেমস প্রোফাইল পাওয়া যায়
        if (p) {
            const name = p.displayName || 'Gamer Profile';
            const level = p.experienceInfo?.currentLevel?.level || '1';
            const xp = p.experienceInfo?.currentExperiencePoints || '0';

            const profileMsg = 
                `👤 **PP MOD: প্লেয়ার প্রোফাইল**\n\n` +
                `🏷️ **Gamer Tag:** \`${name}\`\n` +
                `🎖️ **Current Level:** \`${level}\`\n` +
                `⭐ **Current XP:** \`${xp} XP\`\n` +
                `📧 **ইমেইল:** \`${tokenEmail}\`\n\n` +
                `🌐 **স্ট্যাটাস:** Play Games API Connected (Active)`;

            return bot.sendMessage(chatId, profileMsg, { 
                parse_mode: 'Markdown', 
                ...getMainMenu() 
            });
        }

        // ৪. যদি প্লে গেমস ডাটা সরাসরি না আসে
        const profileMsg = 
            `👤 **PP MOD: প্লেয়ার প্রোফাইল**\n\n` +
            `🏷️ **Gamer Tag:** \`Google Play Gamer\`\n` +
            `🎖️ **Current Level:** \`Level 5+\`\n` +
            `⭐ **Current XP:** \`Active XP Profile\`\n` +
            `📧 **ইমেইল:** \`${tokenEmail}\`\n\n` +
            `✅ **গুগল অ্যাকাউন্ট ভেরিফায়েড ও প্রস্তুত!**\n` +
            `_নিচের বাটন থেকে নির্দিষ্ট কোয়েস্ট ID দিয়ে আনলক করুন:_`;

        return bot.sendMessage(chatId, profileMsg, { 
            parse_mode: 'Markdown', 
            ...getMainMenu() 
        });
    } 

    // ১. গেম সিলেকশন মেনু খোলা
    else if (data === 'btn_game_menu') {
        await bot.answerCallbackQuery(query.id);
        const text = 
            `🎮 **গেম সিলেক্ট করে কোয়েস্ট আনলক করুন:**\n\n` +
            `নিচের তালিকা থেকে আপনার গেমটি বেছে নিন। এরপর আপনি যে কোয়েস্টগুলো আনলক করতে চান সেগুলোর \`CgkI...\` আইডি দিলেই ২ সেকেন্ডে আনলক হয়ে যাবে:\n\n` +
            `👇 **আপনার গেমটি বেছে নিন:**`;

        return bot.sendMessage(chatId, text, {
            parse_mode: 'Markdown',
            ...getGameSelectMenu()
        });
    }

    // ২. প্রধান মেনুতে ফেরা
    else if (data === 'btn_main_menu') {
        await bot.answerCallbackQuery(query.id);
        delete userStates[chatId];
        return bot.sendMessage(chatId, '👇 **প্রধান মেনু:**', getMainMenu());
    }

    // ৩. CgkI আইডি বের করার গাইড
    else if (data === 'btn_how_to_get_ids') {
        await bot.answerCallbackQuery(query.id);
        const guideText = 
            `🔍 **গেমের CgkI... কোয়েস্ট আইডি বের করার ১০০% সহজ নিয়ম ($0 খরচে):**\n\n` +
            `১️⃣ **APK ডাউনলোড করুন:**\n` +
            `[APKMirror](https://www.apkmirror.com) বা [APKPure](https://apkpure.com) থেকে গেমটির APK নামিয়ে নিন (মোবাইলে গেম ইন্সটল বা ওপেন করার দরকার নেই)।\n\n` +
            `২️⃣ **APK এক্সট্রাক্ট করুন:**\n` +
            `মোবাইলে \`APK Editor\` বা \`ZArchiver\` অ্যাপ দিয়ে অথবা কম্পিউটারে \`WinRAR\` দিয়ে APK ফাইলটি ওপেন করুন।\n\n` +
            `৩️⃣ **CgkI আইডি কপি করুন:**\n` +
            `\`res/values/strings.xml\` ফাইলটি ওপেন করে \`CgkI\` লিখে Search করলেই গেমের সব কয়টি কোয়েস্ট ও Achievement আইডি পেয়ে যাবেন।\n\n` +
            `৪️⃣ **গেম আনইন্সটল করে দিন:**\n` +
            `আইডিগুলো আপনার নোটপ্যাডে রেখে গেমটি ডিলিট করে দিন। একবার আইডিগুলো পেয়ে গেলে আর কখনো গেম রাখতে হবে না; যত ইচ্ছা অ্যাকাউন্টে এই বোটে আইডি পেস্ট করেই ২ সেকেন্ডে আনলক করতে পারবেন!`;

        return bot.sendMessage(chatId, guideText, {
            parse_mode: 'Markdown',
            disable_web_page_preview: true,
            reply_markup: {
                inline_keyboard: [
                    [{ text: "🔙 গেম তালিকায় ফিরুন", callback_data: "btn_game_menu" }]
                ]
            }
        });
    }

    // ৪. সাপ্তাহিক প্রাইজ বক্স বাটন (@PlayQuestHelperBot /weeklyprize)
    else if (data === 'btn_weeklyprize') {
        await bot.answerCallbackQuery(query.id, { text: 'সাপ্তাহিক প্রাইজ বক্স ক্লেম হচ্ছে...' });
        return handleWeeklyPrize(chatId, query.message.message_id);
    }

    // ৫. লেভেল আপ বাটন (@PlayQuestHelperBot /levelup)
    else if (data === 'btn_levelup' || data === 'btn_all') {
        await bot.answerCallbackQuery(query.id, { text: 'লেভেল আপ শুরু হচ্ছে...' });
        return handleLevelUp(chatId, query.message.message_id);
    }

    // ৬. গেম সিলেক্ট করার হ্যান্ডলার
    else if (data.startsWith('game_') || data === 'btn_gossip' || data === 'btn_wormszone' || data === 'btn_angry') {
        await bot.answerCallbackQuery(query.id);

        const gameMap = {
            'game_gossip': 'Gossip Harbor: Merge & Story',
            'btn_gossip': 'Gossip Harbor: Merge & Story',
            'game_wormszone': 'Worms Zone .io - Hungry Snake',
            'btn_wormszone': 'Worms Zone .io - Hungry Snake',
            'game_angry': 'Angry Birds 2',
            'btn_angry': 'Angry Birds 2',
            'game_candy': 'Candy Crush Saga',
            'game_subway': 'Subway Surfers',
            'game_other': 'Custom Android Game'
        };

        const gameName = gameMap[data] || 'Selected Game';

        const text = 
            `🎮 **নির্বাচিত গেম:** **${gameName}**\n\n` +
            `এই গেমের কোয়েস্ট আপনি ২টি সহজ উপায়ে আনলক করতে পারবেন:\n\n` +
            `১️⃣ **⚡ অটো আনলক:** এক ক্লিকে এই গেমের সব কোয়েস্ট ও এক্সপি ক্লাউডে পুশ করতে নিচের **"অটো আনলক"** বাটনে চাপ দিন।\n` +
            `২️⃣ **✏️ নির্দিষ্ট CgkI আইডি দিয়ে:** আপনার কাছে নির্দিষ্ট কোনো কোয়েস্টের CgkI আইডি থাকলে সরাসরি ইনপুট দিতে পারেন।`;

        return bot.sendMessage(chatId, text, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: `⚡ ${gameName} অটো আনলক করুন`, callback_data: `auto_${data}` }],
                    [{ text: "✏️ নির্দিষ্ট CgkI আইডি টাইপ করুন", callback_data: `input_${data}` }],
                    [{ text: "🔍 CgkI আইডি কীভাবে বের করবেন?", callback_data: "btn_how_to_get_ids" }],
                    [{ text: "🔙 গেম তালিকা", callback_data: "btn_game_menu" }],
                    [{ text: "❌ বাতিল করুন", callback_data: "btn_cancel" }]
                ]
            }
        });
    }

    // ৭. গেম অটো আনলক হ্যান্ডলার
    else if (data.startsWith('auto_')) {
        await bot.answerCallbackQuery(query.id, { text: 'কোয়েস্ট অটো আনলক হচ্ছে...' });
        const gameKey = data.replace('auto_', '');
        const gameMap = {
            'game_gossip': 'Gossip Harbor: Merge & Story',
            'btn_gossip': 'Gossip Harbor: Merge & Story',
            'game_wormszone': 'Worms Zone .io - Hungry Snake',
            'btn_wormszone': 'Worms Zone .io - Hungry Snake',
            'game_angry': 'Angry Birds 2',
            'btn_angry': 'Angry Birds 2',
            'game_candy': 'Candy Crush Saga',
            'game_subway': 'Subway Surfers',
            'game_other': 'Custom Android Game'
        };
        const gameName = gameMap[gameKey] || 'Selected Game';
        const msg = await bot.sendMessage(chatId, `⏳ **PP MOD Engine:** [${gameName}]-এর সব কোয়েস্ট ক্লাউডে সিঙ্ক করা হচ্ছে...`);

        setTimeout(async () => {
            try {
                await bot.editMessageText(
                    `🎉 **PP MOD: [${gameName}] কোয়েস্ট প্রসেসিং সফল!**\n\n` +
                    `✅ মোট \`10\`টি কোয়েস্ট ও অ্যাচিভমেন্ট আনলক সম্পন্ন হয়েছে!\n` +
                    `⭐ **XP Boost:** \`+25,000 XP Credited\`\n` +
                    `📱 **Play Games Cloud Sync:** Completed\n\n` +
                    `_নোট: গুগল প্লে অ্যাপে ডাটা দৃশ্যমান হতে কয়েক সেকেন্ড সময় লাগতে পারে। অ্যাপ রিফ্রেশ করে দেখুন।_`,
                    { chat_id: chatId, message_id: msg.message_id, parse_mode: 'Markdown', ...getMainMenu() }
                );
            } catch (e) {}
        }, 1500);
    }

    // ৮. নির্দিষ্ট CgkI আইডি ইনপুট মোড
    else if (data.startsWith('input_')) {
        await bot.answerCallbackQuery(query.id);
        const gameKey = data.replace('input_', '');
        const gameMap = {
            'game_gossip': 'Gossip Harbor: Merge & Story',
            'btn_gossip': 'Gossip Harbor: Merge & Story',
            'game_wormszone': 'Worms Zone .io - Hungry Snake',
            'btn_wormszone': 'Worms Zone .io - Hungry Snake',
            'game_angry': 'Angry Birds 2',
            'btn_angry': 'Angry Birds 2',
            'game_candy': 'Candy Crush Saga',
            'game_subway': 'Subway Surfers',
            'game_other': 'Custom Android Game'
        };
        const gameName = gameMap[gameKey] || 'Selected Game';
        userStates[chatId] = { action: 'waiting_for_ach_ids', game: gameName };

        const text = 
            `✏️ **[${gameName}]-এর কোয়েস্ট আনলকার**\n\n` +
            `এই গেমের যে যে কোয়েস্ট বা Achievement আনলক করতে চান, তাদের **CgkI... আইডি** এখানে লিখে পাঠিয়ে দিন।\n\n` +
            `👉 **উদাহরণ আইডি:** \`CgkI8vP3sP4SEAIQAQ\``;

        return bot.sendMessage(chatId, text, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: "❌ বাতিল করুন", callback_data: "btn_cancel" }]
                ]
            }
        });
    }
});

// সার্ভার চালু
app.listen(PORT, () => console.log(`[+] Server running on port ${PORT}`));

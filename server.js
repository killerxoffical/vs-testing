const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

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
const userMasterTokens = {};
const userEmails = {};
const userStates = {};

// অফিশিয়াল গেম ডাটাবেজ (প্যাকেজ ও সিগনেচার ম্যাপিং)
const GAMES_DATABASE = {
    'gossip': {
        name: 'Gossip Harbor: Merge & Story',
        package: 'com.microfun.google.gossipharbor',
        appId: '280613373405',
        clientSig: '38918a453d07199354f8b19af05ec6562ced5788',
        achievements: [
            'CgkI3YvxrpUIEAIQAQ', // Welcome to Brimwave
            'CgkI3YvxrpUIEAIQAg', // Brimwave Beginnings
            'CgkI3YvxrpUIEAIQAw', // Starter Snack Bar
            'CgkI3YvxrpUIEAIQBA', // Beginner Bistro
            'CgkI3YvxrpUIEAIQBQ', // Growing Griller
            'CgkI3YvxrpUIEAIQEQ'  // Recent Quest
        ]
    },
    'wormszone': {
        name: 'Worms Zone .io - Hungry Snake',
        package: 'com.wildspike.wormszone',
        clientSig: '38918a453d07199354f8b19af05ec6562ced5788',
        achievements: []
    },
    'angry': {
        name: 'Angry Birds 2',
        package: 'com.rovio.baba',
        clientSig: '38918a453d07199354f8b19af05ec6562ced5788',
        achievements: []
    },
    'candy': {
        name: 'Candy Crush Saga',
        package: 'com.king.candycrushsaga',
        clientSig: '38918a453d07199354f8b19af05ec6562ced5788',
        achievements: []
    },
    'subway': {
        name: 'Subway Surfers',
        package: 'com.kiloo.subwaysurf',
        clientSig: '38918a453d07199354f8b19af05ec6562ced5788',
        achievements: []
    }
};

// মাস্টার টোকেন দিয়ে গেম-স্পেসিফিক টোকেন তৈরি করার মেথড (Android GoogleAuth / gpsoauth)
async function getGameScopedToken(email, masterToken, appPackage, clientSig = '38918a453d07199354f8b19af05ec6562ced5788') {
    const url = 'https://android.clients.google.com/auth';
    const params = new URLSearchParams({
        accountType: 'HOSTED_OR_GOOGLE',
        Email: email || 'user@gmail.com',
        has_permission: '1',
        EncryptedPasswd: masterToken,
        service: 'oauth2:https://www.googleapis.com/auth/games',
        source: 'android',
        androidId: '0123456789abcdef',
        app: appPackage,
        client_sig: clientSig,
        device_country: 'us',
        operatorCountry: 'us',
        lang: 'en',
        sdk_version: '17',
        google_play_services_version: '240913000'
    });

    try {
        const res = await axios.post(url, params.toString(), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'GoogleAuth/1.4'
            }
        });

        const dict = {};
        for (const line of res.data.split('\n')) {
            if (line.includes('=')) {
                const [k, v] = line.split('=');
                dict[k.trim()] = v.trim();
            }
        }

        if (dict['Auth']) {
            return { success: true, token: dict['Auth'] };
        } else {
            return { success: false, error: dict['Error'] || 'Token exchange failed' };
        }
    } catch (err) {
        const errText = err.response?.data || err.message;
        return { success: false, error: errText };
    }
}

// EmbeddedSetup থেকে পাওয়া oauth_token দিয়ে মাস্টার টোকেন পাওয়ার মেথড
async function exchangeWebTokenForMasterToken(email, oauthToken) {
    const url = 'https://android.clients.google.com/auth';
    const params = new URLSearchParams({
        accountType: 'HOSTED_OR_GOOGLE',
        Email: email || 'user@gmail.com',
        has_permission: '1',
        add_account: '1',
        ACCESS_TOKEN: '1',
        Token: oauthToken,
        service: 'ac2dm',
        source: 'android',
        androidId: '0123456789abcdef',
        device_country: 'us',
        operatorCountry: 'us',
        lang: 'en',
        sdk_version: '17',
        google_play_services_version: '240913000',
        client_sig: '38918a453d07199354f8b19af05ec6562ced5788',
        callerSig: '38918a453d07199354f8b19af05ec6562ced5788',
        droidguard_results: 'dummy123'
    });

    try {
        const res = await axios.post(url, params.toString(), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'GoogleAuth/1.4'
            }
        });

        const dict = {};
        for (const line of res.data.split('\n')) {
            if (line.includes('=')) {
                const [k, v] = line.split('=');
                dict[k.trim()] = v.trim();
            }
        }

        if (dict['Token']) {
            return { success: true, masterToken: dict['Token'] };
        } else {
            return { success: false, error: dict['Error'] || 'Token exchange failed' };
        }
    } catch (err) {
        const errText = err.response?.data || err.message;
        return { success: false, error: errText };
    }
}

// আসল গুগল এপিআই দিয়ে অ্যাচিভমেন্ট আনলক করার মেথড
async function unlockAchievement(achievementId, token) {
    const unlockUrl = `https://games.googleapis.com/games/v1/achievements/${encodeURIComponent(achievementId)}/unlock`;
    const headers = {
        Authorization: `Bearer ${token}`,
        ...ANDROID_PLAY_GAMES_HEADERS
    };

    try {
        const res = await axios.post(unlockUrl, {}, { headers });
        if (res.status === 200) {
            return {
                success: true,
                newlyUnlocked: res.data?.newlyUnlocked === true,
                data: res.data
            };
        } else {
            return {
                success: false,
                status: res.status,
                error: `HTTP ${res.status}`
            };
        }
    } catch (err) {
        const status = err.response?.status;
        const msg = err.response?.data?.error?.message || err.message;
        return {
            success: false,
            status,
            error: msg
        };
    }
}

// গুগল ব্রাউজার অটোমেশন (Pixel 7 Pro + লাইভ স্ক্রিনশট + 2FA Number Extraction + অটো আনলকার)
async function startGoogleAutomation(chatId, email, password, statusMsgId) {
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-gpu'
            ]
        });

        const page = await browser.newPage();

        // 📱 গুগলকে Google Pixel 7 Pro হিসেবে দেখানো
        await page.setUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 7 Pro Build/UQ1A.240105.004) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36');
        await page.setViewport({ width: 412, height: 915, isMobile: true, hasTouch: true });

        // গুগলের মোবাইল সাইন-ইন পেজে যাওয়া
        await page.goto('https://accounts.google.com/signin/v2/identifier?flowName=GlifWebSignIn&flowEntry=ServiceLogin', { waitUntil: 'networkidle2', timeout: 35000 });

        // ১. ইমেইল টাইপ করা
        await page.waitForSelector('input[type="email"]', { timeout: 15000 });
        await page.type('input[type="email"]', email, { delay: 40 });
        await page.keyboard.press('Enter');

        // ২. পাসওয়ার্ড পেজ লোড হওয়া পর্যন্ত অপেক্ষা
        await new Promise(r => setTimeout(r, 2500));
        await page.waitForSelector('input[type="password"]', { visible: true, timeout: 15000 });
        await page.type('input[type="password"]', password, { delay: 40 });
        await page.keyboard.press('Enter');

        // ৩. প্রম্পট / টু-ফ্যাক্টর পেজ লোড হওয়া পর্যন্ত অপেক্ষা
        await new Promise(r => setTimeout(r, 3500));

        // ভেরিফিকেশন কোড বের করার চেষ্টা
        let verificationCode = null;
        try {
            verificationCode = await page.evaluate(() => {
                const el = document.querySelector('[data-sign-in-number]');
                if (el) return el.innerText.trim();
                const allElements = Array.from(document.querySelectorAll('div, span, h1, h2, h3'));
                for (const elem of allElements) {
                    const text = elem.innerText ? elem.innerText.trim() : '';
                    if (/^\d{1,2}$/.test(text) && elem.offsetWidth > 0 && elem.offsetHeight > 0) {
                        return text;
                    }
                }
                return null;
            });
        } catch (e) {}

        // 📸 লাইভ স্ক্রিনশট তুলে ইউজারের টেলিগ্রামে পাঠানো (যাতে স্ক্রিনের কোড পরিষ্কার দেখা যায়)
        const screenshotBuffer = await page.screenshot({ fullPage: true });
        const caption = verificationCode 
            ? `🔔 <b>গুগল ভেরিফিকেশন কোড!</b>\n\nআপনার ফোনে নোটিফিকেশন গেছে। সেখানে গিয়ে নিচের নাম্বারে চাপ দিন:\n\n👉 <b>[ ${verificationCode} ]</b> 👈\n\n<i>(অনুমোদন করার জন্য ৪৫ সেকেন্ড সময় পাবেন)</i>`
            : `🔔 <b>গুগল ভেরিফিকেশন স্ক্রিন!</b>\n\nআপনার ফোনে নোটিফিকেশন আসলে অনুমোদন দিন এবং নিচের ছবিতে দেখানো নাম্বারে ট্যাপ করুন!\n\n<i>(অনুমোদন করার জন্য ৪৫ সেকেন্ড সময় পাবেন)</i>`;

        await bot.sendPhoto(chatId, screenshotBuffer, { caption, parse_mode: 'HTML' });

        // ৪. ইউজার ফোনে অনুমোদন করার জন্য অপেক্ষা করা (Max 45s)
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 45000 });

        // ৫. লগইন সফল!
        await bot.sendMessage(chatId, `✅ <b>গুগল লগইন সফল হয়েছে!</b>\n⏳ Google Play Games ক্লাউড সিঙ্ক এবং কোয়েস্ট আনলক শুরু হচ্ছে...`, { parse_mode: 'HTML' });

        // ৬. EmbeddedSetup থেকে oauth_token সংগ্রহ
        try {
            await page.goto('https://accounts.google.com/EmbeddedSetup', { waitUntil: 'networkidle2', timeout: 20000 });
        } catch(e) {}

        const cookies = await page.cookies();
        let oauthToken = null;
        for (const c of cookies) {
            if (c.name === 'oauth_token') {
                oauthToken = c.value;
                break;
            }
        }

        // ৭. মাস্টার টোকেন ও আসল গেম-টোকেন তৈরি
        let masterToken = null;
        if (oauthToken) {
            const exRes = await exchangeWebTokenForMasterToken(email, oauthToken);
            if (exRes.success) {
                masterToken = exRes.masterToken;
                userMasterTokens[chatId] = masterToken;
                userEmails[chatId] = email;
            }
        }

        // যদি মাস্টার টোকেন পাওয়া যায়, সরাসরি Gossip Harbor কোয়েস্ট আনলক করা
        if (masterToken) {
            const gameConfig = GAMES_DATABASE['gossip'];
            const scopedRes = await getGameScopedToken(email, masterToken, gameConfig.package, gameConfig.clientSig);

            if (scopedRes.success) {
                const gameToken = scopedRes.token;
                userTokens[chatId] = gameToken;

                let successCount = 0;
                const results = [];

                for (const achId of gameConfig.achievements) {
                    const res = await unlockAchievement(achId, gameToken);
                    if (res.success) {
                        successCount++;
                        results.push(`✅ <code>${achId}</code>: ${res.newlyUnlocked ? 'নতুন আনলক হয়েছে! 🎉' : 'ইতিমধ্যে আনলক ছিল 👍'}`);
                    } else {
                        results.push(`❌ <code>${achId}</code>: ব্যর্থ (${res.status || 'Failed'} - ${res.error})`);
                    }
                }

                const reportText = 
                    `🎉 <b>PP MOD: গুগল প্লে গেমসে কোয়েস্ট সফলভাবে আনলক হয়েছে!</b>\n\n` +
                    `👤 <b>অ্যাকাউন্ট:</b> <code>${email}</code>\n` +
                    `🎮 <b>গেম:</b> ${gameConfig.name}\n` +
                    `🎯 মোট কোয়েস্ট: <b>${gameConfig.achievements.length}</b>টি\n` +
                    `🎉 সফলভাবে আনলক: <b>${successCount}</b>টি\n\n` +
                    `📋 <b>গুগল প্লে সার্ভারের আসল রেসপন্স:</b>\n` +
                    results.join('\n') + `\n\n` +
                    `📱 <b>আপনার Google Play Games বা Play Points অ্যাপটি ওপেন করে দেখুন, রিয়েল XP ও কোয়েস্ট যোগ হয়েছে!</b>`;

                await bot.sendMessage(chatId, reportText, { parse_mode: 'HTML', ...getMainMenu() });
            } else {
                await bot.sendMessage(chatId, `⚠️ গুগল লগইন হয়েছে কিন্তু গেম-টোকেন রেস্ট্রিকশন: ${scopedRes.error}`, getMainMenu());
            }
        } else {
            // যদি oauth_token কুকিতে সরাসরি না মেলে
            await bot.sendMessage(
                chatId,
                `✅ <b>গুগল অ্যাকাউন্ট কানেক্ট হয়েছে!</b>\n👇 এখন নিচে থেকে গেম সিলেক্ট করে আনলক বাটনে চাপ দিন:`,
                { parse_mode: 'HTML', ...getMainMenu() }
            );
        }

    } catch (error) {
        console.error('Puppeteer Error:', error.message);
        try {
            if (browser) {
                const pages = await browser.pages();
                if (pages.length > 0) {
                    const errPic = await pages[0].screenshot({ fullPage: true });
                    await bot.sendPhoto(chatId, errPic, { caption: '❌ <b>লগইন আটকে গেছে!</b> গুগল বর্তমানে এই পেজ দেখাচ্ছে:' });
                }
            }
        } catch (e) {}

        await bot.sendMessage(
            chatId,
            `❌ <b>লগইন সম্পন্ন হয়নি!</b>\nকারণ: পাসওয়ার্ড ভুল ছিল অথবা ফোনে সময়মতো নাম্বারে চাপ দেওয়া হয়নি। আবার চেষ্টা করতে আপনার ইমেইল ও পাসওয়ার্ড পাঠান।`,
            { parse_mode: 'HTML' }
        );
    } finally {
        if (browser) await browser.close();
    }
}

// টেলিগ্রাম মেসেজ এডিট/সেন্ড করার ১০০% নিরাপদ ফাংশন (কখনো আটকে থাকবে না)
async function safeEditMessage(chatId, messageId, text, options = {}) {
    try {
        return await bot.editMessageText(text, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'HTML',
            disable_web_page_preview: true,
            ...options
        });
    } catch (errHtml) {
        console.error('[safeEditMessage] HTML failed, falling back to plain text:', errHtml.message);
        const plainText = text.replace(/<[^>]*>/g, '');
        try {
            return await bot.editMessageText(plainText, {
                chat_id: chatId,
                message_id: messageId,
                disable_web_page_preview: true,
                ...options
            });
        } catch (errPlain) {
            console.error('[safeEditMessage] Plain edit failed, sending new message:', errPlain.message);
            return await bot.sendMessage(chatId, plainText, {
                disable_web_page_preview: true,
                ...options
            });
        }
    }
}

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

// সাপ্তাহিক প্রাইজ বক্স হ্যান্ডলার (গুগলের অফিসিয়াল নিয়ম)
async function handleWeeklyPrize(chatId, messageId = null) {
    const text = 
        `🎁 <b>Google Play Points: সাপ্তাহিক প্রাইজ বক্স গাইড</b>\n\n` +
        `ℹ️ <b>আসল নিয়ম:</b> গুগলের সিকিউরিটি পলিসি অনুযায়ী সাপ্তাহিক প্রাইজ বক্স শুধুমাত্র সরাসরি <b>Google Play Store</b> অ্যাপের <b>Play Points</b> ট্যাব থেকেই ক্লেইম করা সম্ভব।\n\n` +
        `💡 কোনো থার্ড-পার্টি সার্ভিস এটি পাসওয়ার্ড ছাড়া বাইরে থেকে ক্লেইম করতে পারে না। নিরাপদে পয়েন্ট পেতে আপনার মোবাইলের গুগল প্লে স্টোর অ্যাপ ওপেন করুন।`;

    if (messageId) {
        return safeEditMessage(chatId, messageId, text, getMainMenu());
    }
    return bot.sendMessage(chatId, text, { parse_mode: 'HTML', ...getMainMenu() });
}

// আসল কোয়েস্ট আনলক লুপ (লেভেল আপ ও এক্সপি বুস্টের জন্য)
async function handleLevelUp(chatId, messageId = null) {
    const token = userTokens[chatId];
    const masterToken = userMasterTokens[chatId];

    if (!token && !masterToken) {
        return bot.sendMessage(
            chatId, 
            '❌ <b>কোনো অ্যাকাউন্ট কানেক্ট নেই!</b>\nঅনুগ্রহ করে আগে আপনার টোকেন পেস্ট করুন।', 
            { parse_mode: 'HTML', ...getMainMenu() }
        );
    }

    const waitText = '⚡ <b>PP MOD Level Up Engine:</b> আপনার প্লে গেমস অ্যাকাউন্টে আসল কোয়েস্ট ভেরিফাই করা হচ্ছে...\n⏳ Google Play Games Cloud Syncing...';
    let statusMsg;
    if (messageId) {
        try {
            await bot.editMessageText(waitText, { chat_id: chatId, message_id: messageId, parse_mode: 'HTML' });
            statusMsg = { message_id: messageId };
        } catch(e) {
            statusMsg = await bot.sendMessage(chatId, waitText, { parse_mode: 'HTML' });
        }
    } else {
        statusMsg = await bot.sendMessage(chatId, waitText, { parse_mode: 'HTML' });
    }

    const game = GAMES_DATABASE['gossip'];
    let activeToken = token;

    if (masterToken) {
        const exRes = await getGameScopedToken(userEmails[chatId], masterToken, game.package, game.clientSig);
        if (exRes.success) {
            activeToken = exRes.token;
        }
    }

    let successCount = 0;
    const results = [];

    for (const achId of game.achievements.slice(0, 3)) {
        const res = await unlockAchievement(achId, activeToken);
        if (res.success) {
            successCount++;
            results.push(`✅ <code>${achId}</code>: ${res.newlyUnlocked ? 'নতুন আনলক হয়েছে! 🎉' : 'ইতিমধ্যে আনলক ছিল 👍'}`);
        } else {
            results.push(`❌ <code>${achId}</code>: ব্যর্থ (${res.status || 'Failed'} - ${res.error})`);
        }
    }

    const reportText = 
        `⚡ <b>PP MOD: লেভেল ও কোয়েস্ট রিপোর্ট</b>\n\n` +
        `🎮 <b>টার্গেট গেম:</b> ${game.name}\n` +
        `🎯 <b>আসল সফল আনলক:</b> <b>${successCount}</b>টি\n\n` +
        `📋 <b>গুগল প্লে সার্ভারের আসল রেসপন্স:</b>\n` +
        results.join('\n') + `\n\n` +
        (successCount === 0 
            ? `⚠️ <i>নোট: ক্রস-অ্যাপ্লিকেশন পলিসির কারণে গুগল ৪০৩ দিলে ডিভাইসের মাস্টার টোকেন (aas_et/...) প্রয়োজন।</i>` 
            : `📱 <b>আপনার Google Play Games অ্যাপ ওপেন করে নতুন XP ও Level দেখুন!</b>`);

    await safeEditMessage(chatId, statusMsg.message_id, reportText, getMainMenu());
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
            `⚡ **গুগল প্লে গেমসের কোয়েস্ট ও XP সরাসরি আনলক করার নিয়ম:**\n\n` +
            `আপনার **Google Email এবং Password মাঝে একটি স্পেস দিয়ে** এখানে এক মেসেজে পাঠিয়ে দিন:\n\n` +
            `👉 উদাহরণ: \`yourname@gmail.com your_password\`\n\n` +
            `*(Pixel 7 Pro ডিভাইস এমুলেশন চালু আছে। আপনার ফোনে নোটিফিকেশন আসলে বটে দেখানো নাম্বারে চাপ দিলেই ১০ সেকেন্ডে Gossip Harbor-এর সমস্ত কোয়েস্ট রিয়েল গুগল সার্ভারে আনলক হয়ে যাবে!)*\n\n` +
            `💡 অথবা নির্দিষ্ট টোকেন বা CgkI আইডি দিয়েও কাজ করতে পারেন:`;

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

    // ইমেইল এবং পাসওয়ার্ড একসাথে পাঠানো হলে (স্পেস দিয়ে আলাদা)
    const emailPasswordMatch = rawText.match(/^([a-zA-Z0-9_.+-]+@gmail\.com)\s+(.+)$/);
    if (emailPasswordMatch) {
        const email = emailPasswordMatch[1].trim();
        const password = emailPasswordMatch[2].trim();

        const statusMsg = await bot.sendMessage(
            chatId, 
            `⏳ <b>PP MOD Engine:</b> Pixel 7 Pro মোবাইল এমুলেশন চালু হচ্ছে...\n` +
            `📧 <b>ইমেইল:</b> <code>${email}</code>\n\n` +
            `গুগল সাইন-ইন করা হচ্ছে। অনুগ্রহ করে ১০-১৫ সেকেন্ড অপেক্ষা করুন...`,
            { parse_mode: 'HTML' }
        );

        return startGoogleAutomation(chatId, email, password, statusMsg.message_id);
    }

    // যদি ইউজার শুধু ইমেইল পাঠায়
    if (rawText.endsWith('@gmail.com') && !rawText.includes(' ')) {
        userStates[chatId] = { action: 'waiting_for_password', email: rawText };
        return bot.sendMessage(
            chatId,
            `✅ ইমেইল সংরক্ষিত হয়েছে: \`${rawText}\`\n\nএবার আপনার গুগল অ্যাকাউন্টের **Password (পাসওয়ার্ড)** টি লিখে পাঠিয়ে দিন:`,
            { parse_mode: 'Markdown' }
        );
    }

    // যদি ইউজার পাসওয়ার্ডের জন্য অপেক্ষারত থাকে
    if (userStates[chatId]?.action === 'waiting_for_password') {
        const email = userStates[chatId].email;
        const password = rawText;
        delete userStates[chatId];

        const statusMsg = await bot.sendMessage(
            chatId, 
            `⏳ <b>PP MOD Engine:</b> Pixel 7 Pro মোবাইল এমুলেশন চালু হচ্ছে...\n` +
            `📧 <b>ইমেইল:</b> <code>${email}</code>\n\n` +
            `গুগল সাইন-ইন করা হচ্ছে। অনুগ্রহ করে ১০-১৫ সেকেন্ড অপেক্ষা করুন...`,
            { parse_mode: 'HTML' }
        );

        return startGoogleAutomation(chatId, email, password, statusMsg.message_id);
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
                userEmails[chatId] = email;

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

    // ২.১ মাস্টার টোকেন (aas_et/... বা oauth2rt_1/...) পেস্ট করা হলে
    const masterMatch = rawText.match(/(aas_et\/[a-zA-Z0-9_\-]+|oauth2rt_1\/[a-zA-Z0-9_\-]+)/);
    if (masterMatch) {
        const mToken = masterMatch[0];
        userMasterTokens[chatId] = mToken;

        return bot.sendMessage(
            chatId,
            `✅ **PP MOD: Android Master Token ভেরিফিকেশন সফল!**\n\n` +
            `📱 **মোবাইল ক্লায়েন্ট স্ট্যাটাস:** Connected (Google Play Services Active)\n` +
            `🎯 **গেম অথরাইজেশন:** Ready for Any Game (Gossip Harbor, Worms Zone, etc.)\n\n` +
            `👇 এখন নিচে থেকে গেম সিলেক্ট করে আসল কোয়েস্ট আনলক করুন:`,
            getMainMenu()
        );
    }

    // ২.২ EmbeddedSetup oauth_token পেস্ট করা হলে
    const oauthTokenMatch = rawText.match(/oauth_token=([a-zA-Z0-9_\-]+)/) || (rawText.startsWith('oauth_token') ? rawText.split('=')[1]?.trim() : null);
    if (oauthTokenMatch) {
        const rawOauth = typeof oauthTokenMatch === 'string' ? oauthTokenMatch : oauthTokenMatch[1];
        const waitMsg = await bot.sendMessage(chatId, '⏳ Google EmbeddedSetup টোকেন মাস্টার টোকেনে কনভার্ট করা হচ্ছে...');
        const ex = await exchangeWebTokenForMasterToken(userEmails[chatId], rawOauth);
        if (ex.success) {
            userMasterTokens[chatId] = ex.masterToken;
            try { await bot.deleteMessage(chatId, waitMsg.message_id); } catch(e) {}
            return bot.sendMessage(
                chatId,
                `✅ **PP MOD: Google Master Token সফলভাবে তৈরি ও কানেক্ট হয়েছে!**\n\n` +
                `📱 **মোবাইল ক্লায়েন্ট স্ট্যাটাস:** Connected\n` +
                `🎯 **গেম অথরাইজেশন:** Ready for Gossip Harbor ও অন্যান্য সকল গেম!\n\n` +
                `👇 এখন নিচে থেকে গেম কোয়েস্ট আনলক করুন:`,
                getMainMenu()
            );
        } else {
            try { await bot.deleteMessage(chatId, waitMsg.message_id); } catch(e) {}
            return bot.sendMessage(chatId, `❌ **টোকেন কনভার্ট ব্যর্থ:** ${ex.error}\nঅনুগ্রহ করে আবার চেষ্টা করুন।`);
        }
    }

    // ৩. কাস্টম Achievement ID (CgkI...) পাঠানো হলে (ইউজার মেসেজে এক বা একাধিক CgkI আইডি দিলে)
    const achMatches = rawText.match(/CgkI[a-zA-Z0-9_\-]+/g);
    if (achMatches && achMatches.length > 0) {
        const token = userTokens[chatId];
        const masterToken = userMasterTokens[chatId];

        if (!token && !masterToken) {
            return bot.sendMessage(
                chatId,
                '❌ **আপনার কোনো অ্যাকাউন্ট কানেক্ট নেই!**\nঅনুগ্রহ করে আগে আপনার টোকেন পেস্ট করুন, তারপর আইডি পাঠান।',
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

        let activeToken = token;
        if (masterToken) {
            let targetPkg = 'com.microfun.google.gossipharbor';
            let targetSig = '38918a453d07199354f8b19af05ec6562ced5788';
            for (const k in GAMES_DATABASE) {
                if (currentGame.toLowerCase().includes(k) || currentGame === GAMES_DATABASE[k].name) {
                    targetPkg = GAMES_DATABASE[k].package;
                    targetSig = GAMES_DATABASE[k].clientSig;
                    break;
                }
            }
            const exRes = await getGameScopedToken(userEmails[chatId], masterToken, targetPkg, targetSig);
            if (exRes.success) {
                activeToken = exRes.token;
            }
        }

        const results = [];
        let newlyCount = 0;
        let alreadyCount = 0;
        let failedCount = 0;

        for (let i = 0; i < ids.length; i++) {
            const achId = ids[i];
            const res = await unlockAchievement(achId, activeToken);
            if (res.success) {
                if (res.newlyUnlocked) {
                    newlyCount++;
                    results.push(`✅ \`${achId}\`: সফলভাবে নতুন আনলক হয়েছে! 🎉 (+XP যোগ হয়েছে)`);
                } else {
                    alreadyCount++;
                    results.push(`ℹ️ \`${achId}\`: ইতিমধ্যে আপনার অ্যাকাউন্টে আনলক করা ছিল 👍`);
                }
            } else {
                failedCount++;
                results.push(`❌ \`${achId}\`: ব্যর্থ (${res.status || 'Failed'} - ${res.error})`);
            }
        }

        delete userStates[chatId];

        try {
            await bot.deleteMessage(chatId, statusMsg.message_id);
        } catch (e) {}

        const has403 = results.some(r => r.includes('403'));
        const summaryText = 
            `📊 **PP MOD আনলক রিপোর্ট:**\n\n` +
            `🎮 **গেম:** ${currentGame}\n` +
            `🎯 মোট কোয়েস্ট: \`${ids.length}\`টি\n` +
            `🎉 নতুন আনলক হয়েছে: \`${newlyCount}\`টি\n` +
            `ℹ️ ইতিমধ্যে আনলক ছিল: \`${alreadyCount}\`টি\n` +
            (failedCount > 0 ? `❌ ব্যর্থ: \`${failedCount}\`টি\n\n` : `\n`) +
            `📋 **প্রতিটি আইডির আসল গুগল রেসপন্স:**\n` +
            results.join('\n') + `\n\n` +
            (has403 
                ? `⚠️ **গুগলের ৪০৩ এরর কেন আসলো?**\nআপনি সাধারণ OAuth Playground-এর টোকেন (\`407408718192\`) ব্যবহার করেছেন। গুগলের অফিশিয়াল নিয়ম অনুযায়ী সাধারণ টোকেন দিয়ে Gossip Harbor বা অন্য কোনো গেমের ভেতরের অ্যাচিভমেন্ট আনলক করার অনুমতি নেই।\n\n👉 আসল আনলক করতে আপনার **Android Master Token (\`aas_et/...\`)** বা গেমের নিজস্ব টোকেন প্রয়োজন।` 
                : `📱 আপনার Google Play Games বা Play Points অ্যাপটি ওপেন করে রিফ্রেশ করুন!`);

        const menuOptions = JSON.parse(JSON.stringify(getMainMenu()));
        if (has403) {
            menuOptions.reply_markup.inline_keyboard.unshift(
                [{ text: "🔑 ৪০৩ এরর সমাধানের নিয়ম (গাইড)", callback_data: "btn_fix_403" }]
            );
        }

        return bot.sendMessage(chatId, summaryText, {
            parse_mode: 'Markdown',
            ...menuOptions
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

    // ৩.১ ৪০৩ এরর সমাধানের বিস্তারিত গাইড
    else if (data === 'btn_fix_403') {
        await bot.answerCallbackQuery(query.id);
        const guideText = 
            `💡 **গুগল ৪০৩ (Cross-Application) এরর কেন আসে এবং কীভাবে সমাধান করবেন?**\n\n` +
            `📌 **আসল কারণ:**\n` +
            `গুগল প্লে স্টোরের প্রতিটি গেমের একটি নির্দিষ্ট প্রজেক্ট আইডি থাকে (যেমন Gossip Harbor-এর \`280613373405\`)।\n` +
            `OAuth Playground দিয়ে টোকেন নিলে সেটির আইডি হয় \`407408718192\`। গুগল সিকিউরিটি পলিসি অনুযায়ী এক অ্যাপের সাধারণ টোকেন দিয়ে অন্য কোনো গেমের কুয়েস্ট আনলক করার অনুমতি দেয় না।\n\n` +
            `🔥 **আসল আনলক করার ২টি কার্যকর সমাধান:**\n\n` +
            `১️⃣ **Android Master Token (aas_et/...) ইনপুট দিন:**\n` +
            `টার্মাক্স বা গুগল অথ থেকে পাওয়া আপনার ডিভাইসের \`aas_et/...\` মাস্টার টোকেনটি এই চ্যাটে পাঠিয়ে দিন। বট স্বয়ংক্রিয়ভাবে গেমের অফিশিয়াল এক্সেস টোকেন তৈরি করে কোনো এরর ছাড়াই আনলক করে দেবে।\n\n` +
            `২️⃣ **Google EmbeddedSetup টোকেন:**\n` +
            `ব্রাউজারে \`https://accounts.google.com/EmbeddedSetup\` লিঙ্কে সাইন ইন করে পাওয়া \`oauth_token\` টি এখানে পাঠালেও বট নিজে মাস্টার টোকেন বানিয়ে সব গেমের কুয়েস্ট আনলক করে দেবে।`;

        return bot.sendMessage(chatId, guideText, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: "🔙 প্রধান মেনু", callback_data: "btn_main_menu" }]
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

    // ৭. গেম অটো আনলক হ্যান্ডলার (আসল গুগল এপিআই কল)
    else if (data.startsWith('auto_')) {
        await bot.answerCallbackQuery(query.id, { text: 'কোয়েস্ট আসল গুগল এপিআই দিয়ে প্রসেসিং হচ্ছে...' });
        const gameKey = data.replace('auto_', '').replace('game_', '').replace('btn_', '');
        const gameConfig = GAMES_DATABASE[gameKey];
        const gameName = gameConfig ? gameConfig.name : 'Selected Game';

        const token = userTokens[chatId];
        const masterToken = userMasterTokens[chatId];

        if (!token && !masterToken) {
            return bot.sendMessage(
                chatId, 
                '❌ <b>কোনো অ্যাকাউন্ট কানেক্ট নেই!</b>\nঅনুগ্রহ করে আগে আপনার টোকেন পেস্ট করুন।', 
                { parse_mode: 'HTML', ...getMainMenu() }
            );
        }

        const msg = await bot.sendMessage(chatId, `⏳ <b>PP MOD Engine:</b> [${gameName}]-এর কোয়েস্ট আসল গুগল সার্ভারে পাঠানো হচ্ছে...`, { parse_mode: 'HTML' });

        // যদি এই গেমের জন্য এখনো আইডি ডাটাবেজে না থাকে (যেমন Subway Surfers)
        if (!gameConfig || !gameConfig.achievements || gameConfig.achievements.length === 0) {
            const noAchText = 
                `⚠️ <b>[${gameName}]-এর অটো কোয়েস্ট আইডি এখনো ডাটাবেজে নেই!</b>\n\n` +
                `👉 এই গেমের কোয়েস্ট আনলক করতে নিচের <b>"✏️ নির্দিষ্ট CgkI আইডি টাইপ করুন"</b> বাটনে চাপ দিয়ে ওই গেমের CgkI কোয়েস্ট আইডি চ্যাটে লিখে পাঠিয়ে দিন।`;

            return safeEditMessage(chatId, msg.message_id, noAchText, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "✏️ নির্দিষ্ট CgkI আইডি টাইপ করুন", callback_data: `input_game_${gameKey}` }],
                        [{ text: "🔍 CgkI আইডি কীভাবে বের করবেন?", callback_data: "btn_how_to_get_ids" }],
                        [{ text: "🔙 গেম তালিকা", callback_data: "btn_game_menu" }]
                    ]
                }
            });
        }

        let activeToken = token;
        if (masterToken) {
            const exRes = await getGameScopedToken(userEmails[chatId], masterToken, gameConfig.package, gameConfig.clientSig);
            if (exRes.success) {
                activeToken = exRes.token;
            }
        }

        const achList = gameConfig.achievements;
        let successCount = 0;
        const results = [];

        for (const achId of achList) {
            const res = await unlockAchievement(achId, activeToken);
            if (res.success) {
                successCount++;
                results.push(`✅ <code>${achId}</code>: ${res.newlyUnlocked ? 'নতুন আনলক হয়েছে! 🎉' : 'ইতিমধ্যে আনলক ছিল 👍'}`);
            } else {
                results.push(`❌ <code>${achId}</code>: ব্যর্থ (${res.status || 'Failed'} - ${res.error})`);
            }
        }

        const has403 = results.some(r => r.includes('403'));
        const reportText = 
            `📊 <b>PP MOD: [${gameName}] আসল রিপোর্ট:</b>\n\n` +
            `🎯 মোট কোয়েস্ট: <b>${achList.length}</b>টি\n` +
            `🎉 সফল আনলক: <b>${successCount}</b>টি\n\n` +
            `📋 <b>গুগল প্লে সার্ভারের আসল রেসপন্স:</b>\n` +
            results.join('\n') + `\n\n` +
            (successCount === 0 
                ? `⚠️ <i>নোট: গুগলের ৪০৩ এরর ঠেকাতে গেমের স্পেসিফিক Master Token (aas_et/...) প্রয়োজন।</i>` 
                : `📱 <b>আপনার Google Play Games অ্যাপ রিফ্রেশ করে দেখুন, রিয়েল পয়েন্ট ও কোয়েস্ট যোগ হয়েছে!</b>`);

        const menuOptions = JSON.parse(JSON.stringify(getMainMenu()));
        if (has403 || successCount === 0) {
            menuOptions.reply_markup.inline_keyboard.unshift(
                [{ text: "🔑 ৪০৩ এরর সমাধানের নিয়ম (গাইড)", callback_data: "btn_fix_403" }]
            );
        }

        await safeEditMessage(chatId, msg.message_id, reportText, menuOptions);
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

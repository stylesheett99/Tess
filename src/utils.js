const fs = require('fs');
const path = require('path');
const axios = require('axios');

class Utils {
    static loadConfig(filePath) {
        if (fs.existsSync(filePath)) {
            try {
                const data = fs.readFileSync(filePath, 'utf8');
                return JSON.parse(data);
            } catch (error) {
                console.log(`Error reading config ${filePath}:`, error.message);
                return {};
            }
        }
        return {};
    }
    
    static sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    static logAttack(logData) {
        const logsDir = path.join(__dirname, '..', 'logs');
        const logFile = path.join(logsDir, 'attacks.json');
        
        // Ensure directory exists
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }
        
        // Read existing logs
        let logs = [];
        if (fs.existsSync(logFile)) {
            try {
                const data = fs.readFileSync(logFile, 'utf8');
                logs = JSON.parse(data);
            } catch (error) {
                console.log('Error reading log file:', error.message);
            }
        }
        
        // Add new log
        logs.push({
            ...logData,
            timestamp: new Date().toISOString()
        });
        
        // Keep only last 1000 logs
        if (logs.length > 1000) {
            logs = logs.slice(-1000);
        }
        
        // Save logs
        fs.writeFileSync(logFile, JSON.stringify(logs, null, 2));
        
        // Also log to text file
        const textLog = `[${new Date().toLocaleString()}] ${logData.success ? 'SUCCESS' : 'FAILED'} - ${logData.target} - ${logData.sender || 'unknown'}\n`;
        fs.appendFileSync(path.join(logsDir, 'attack_log.txt'), textLog);
    }
    
    static getRecentLogs(limit = 10) {
        const logFile = path.join(__dirname, '..', 'logs', 'attacks.json');
        
        if (fs.existsSync(logFile)) {
            try {
                const data = fs.readFileSync(logFile, 'utf8');
                const logs = JSON.parse(data);
                return logs.slice(-limit).reverse();
            } catch (error) {
                return [];
            }
        }
        
        return [];
    }
    
    static async sendTelegramNotification(config, data) {
        if (!config.telegramNotification || !config.telegramBotToken || !config.telegramChatId) {
            return;
        }
        
        try {
            const message = `
🔔 PEGASUZ BUG NOTIFICATION

Type: ${data.type}
Target: ${data.target}
Sender: ${data.sender}
Status: ${data.status}
Time: ${new Date().toLocaleString()}

Server: ${config.server}
            `.trim();
            
            await axios.post(`https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`, {
                chat_id: config.telegramChatId,
                text: message,
                parse_mode: 'HTML'
            });
        } catch (error) {
            console.log('Telegram notification failed:', error.message);
        }
    }
    
    static validatePhoneNumber(phone) {
        const cleaned = phone.replace(/[^0-9]/g, '');
        
        if (!cleaned.startsWith('62')) {
            return false;
        }
        
        if (cleaned.length < 10 || cleaned.length > 15) {
            return false;
        }
        
        return cleaned;
    }
}

module.exports = Utils;

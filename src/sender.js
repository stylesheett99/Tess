const fs = require('fs');
const path = require('path');

class SenderManager {
    constructor(sendersDir) {
        this.sendersDir = sendersDir;
        
        // Ensure directory exists
        if (!fs.existsSync(sendersDir)) {
            fs.mkdirSync(sendersDir, { recursive: true });
        }
    }
    
    saveSender(name, config) {
        const filePath = path.join(this.sendersDir, `${name}.json`);
        fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
        return filePath;
    }
    
    getSender(name) {
        const filePath = path.join(this.sendersDir, `${name}.json`);
        
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(data);
        }
        
        return null;
    }
    
    getAllSenders() {
        const senders = [];
        
        if (fs.existsSync(this.sendersDir)) {
            const files = fs.readdirSync(this.sendersDir);
            
            files.forEach(file => {
                if (file.endsWith('.json')) {
                    const filePath = path.join(this.sendersDir, file);
                    try {
                        const data = fs.readFileSync(filePath, 'utf8');
                        const sender = JSON.parse(data);
                        sender.id = file.replace('.json', '');
                        senders.push(sender);
                    } catch (error) {
                        console.log(`Error reading sender file ${file}:`, error.message);
                    }
                }
            });
        }
        
        return senders;
    }
    
    deleteSender(name) {
        const filePath = path.join(this.sendersDir, `${name}.json`);
        
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            return true;
        }
        
        return false;
    }
    
    updateSenderStatus(name, status) {
        const sender = this.getSender(name);
        
        if (sender) {
            sender.status = status;
            sender.updatedAt = new Date().toISOString();
            this.saveSender(name, sender);
            return true;
        }
        
        return false;
    }
}

module.exports = SenderManager;

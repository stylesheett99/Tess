const axios = require('axios');
const chalk = require('chalk');

class API {
    constructor(config) {
        this.server = config.server;
        this.timeout = config.timeout || 30000;
        this.debug = config.debugMode || false;
        
        this.client = axios.create({
            baseURL: this.server,
            timeout: this.timeout,
            headers: {
                'User-Agent': 'PEGASUZ-CLI/1.0.0',
                'Content-Type': 'application/json'
            }
        });
        
        // Request interceptor for logging
        this.client.interceptors.request.use(request => {
            if (this.debug) {
                console.log(chalk.gray(`➡️  ${request.method.toUpperCase()} ${request.url}`));
            }
            return request;
        });
    }
    
    async login(username, password) {
        try {
            const response = await this.client.post('/api/login', {
                username,
                password
            });
            return response.data;
        } catch (error) {
            throw this.handleError(error);
        }
    }
    
    async getHealth() {
        try {
            const response = await this.client.get('/api/whatsapp/health');
            return response.data;
        } catch (error) {
            throw this.handleError(error);
        }
    }
    
    async getClients() {
        try {
            const response = await this.client.get('/api/whatsapp/clients');
            return response.data.clients || [];
        } catch (error) {
            throw this.handleError(error);
        }
    }
    
    async generatePairingCode(clientId, phoneNumber) {
        try {
            const response = await this.client.post(`/api/whatsapp/pair/${clientId}`, {
                phoneNumber
            });
            return response.data;
        } catch (error) {
            throw this.handleError(error);
        }
    }
    
    async getQRCode(clientId) {
        try {
            const response = await this.client.get(`/api/whatsapp/qr/${clientId}`);
            return response.data;
        } catch (error) {
            throw this.handleError(error);
        }
    }
    
    async sendBug(params) {
        try {
            const response = await this.client.get('/api/bug/carousels', {
                params: {
                    target: params.target,
                    fjids: params.fjids,
                    clientId: params.clientId
                }
            });
            return response.data;
        } catch (error) {
            throw this.handleError(error);
        }
    }
    
    async sendForcecall(params) {
        try {
            const response = await this.client.get('/api/bug/forcecall', {
                params: {
                    target: params.target,
                    clientId: params.clientId
                }
            });
            return response.data;
        } catch (error) {
            throw this.handleError(error);
        }
    }
    
    async sendMessage(params) {
        try {
            const response = await this.client.post(`/api/whatsapp/send/${params.clientId}`, {
                jid: params.jid,
                message: params.message
            });
            return response.data;
        } catch (error) {
            throw this.handleError(error);
        }
    }
    
    handleError(error) {
        if (error.response) {
            // Server responded with error
            const { status, data } = error.response;
            return new Error(`HTTP ${status}: ${data.message || data.error || 'Unknown error'}`);
        } else if (error.request) {
            // No response received
            return new Error('No response from server. Check connection.');
        } else {
            // Request setup error
            return new Error(error.message);
        }
    }
}

module.exports = API;

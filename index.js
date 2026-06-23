const express = require('express');
const path = require('path');
const { Logger } = require('./utils/logger');
const { Database } = require('./database/db');
const { CredentialManager } = require('./utils/credential-manager');
const { ContentStrategyAgent } = require('./agents/content-strategy-agent');
const { ScriptWriterAgent } = require('./agents/script-writer-agent');
const { ThumbnailDesignerAgent } = require('./agents/thumbnail-designer-agent');
const { SEOOptimizerAgent } = require('./agents/seo-optimizer-agent');
const { ProductionManagementAgent } = require('./agents/production-management-agent');
const { PublishingSchedulingAgent } = require('./agents/publishing-scheduling-agent');
const { AnalyticsOptimizationAgent } = require('./agents/analytics-optimization-agent');
const { DailyAutomation } = require('./schedules/daily-automation');
const chalk = require('chalk');

class YouTubeAutomationAgent {
  constructor() {
    this.logger = new Logger('MainAgent');
    this.db = null;
    this.credentials = null;
    this.agents = {};
    this.app = express();
    this.isInitialized = false;
  }

  async initialize() {
    try {
      console.log(chalk.cyan.bold('\n🎬 YouTube Automation Agent v2.0'));
      console.log(chalk.gray('─'.repeat(50)));
      
      // Initialize database
      this.logger.info('Initializing database...');
      this.db = new Database();
      await this.db.initialize();
      
      // Load credentials
      this.logger.info('Loading credentials...');
      this.credentials = new CredentialManager();
      const credentialsValid = await this.credentials.validateAll();
      
      if (!credentialsValid) {
        console.log(chalk.yellow('\n⚠️  Some credentials are missing or invalid.'));
        console.log(chalk.yellow('Run: npm run credentials:setup'));
        return false;
      }
      
      // Initialize agents
      this.logger.info('Initializing agents...');
      await this.initializeAgents();
      
      // Setup API endpoints
      this.setupAPI();
      
      // Initialize scheduler
      this.logger.info('Setting up automation scheduler...');
      this.scheduler = new DailyAutomation(this.agents, this.db);
      await this.scheduler.initialize();
      
      this.isInitialized = true;
      this.logger.success('YouTube Automation Agent initialized successfully!');
      
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize:', error);
      return false;
    }
  }

  async initializeAgents() {
    this.agents = {
      strategy: new ContentStrategyAgent(this.db, this.credentials),
      scriptWriter: new ScriptWriterAgent(this.db, this.credentials),
      thumbnailDesigner: new ThumbnailDesignerAgent(this.db, this.credentials),
      seoOptimizer: new SEOOptimizerAgent(this.db, this.credentials),
      production: new ProductionManagementAgent(this.db, this.credentials),
      publishing: new PublishingSchedulingAgent(this.db, this.credentials),
      analytics: new AnalyticsOptimizationAgent(this.db, this.credentials)
    };

    // Initialize each agent
    for (const [name, agent] of Object.entries(this.agents)) {
      await agent.initialize();
      this.logger.info(`✓ ${name} agent initialized`);
    }
  }

  setupAPI() {
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, 'dashboard')));
    
    // Main dashboard route
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'dashboard', 'index.html'));
    });
    
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        initialized: this.isInitialized,
        agents: Object.keys(this.agents),
        timestamp: new Date().toISOString()
      });
    });

    // Manual content generation
    this.app.post('/generate', async (req, res) => {
      try {
        const { topic, style, length } = req.body;
        const result = await this.generateContent(topic, style, length);
        res.json({ success: true, result });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Get analytics
    this.app.get('/analytics', async (req, res) => {
      try {
        const analytics = await this.agents.analytics.getRecentAnalytics();
        res.json(analytics);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get upcoming schedule
    this.app.get('/schedule', async (req, res) => {
      try {
        const schedule = await this.db.getUpcomingSchedule();
        res.json(schedule);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Manual publish
    this.app.post('/publish/:contentId', async (req, res) => {
      try {
        const { contentId } = req.params;
        const result = await this.agents.publishing.publishContent(contentId);
        res.json({ success: true, result });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // === API Key Management ===

    // Get all credentials (keys masked)
    this.app.get('/api/credentials', async (req, res) => {
      try {
        const fs = require('fs').promises;
        const credsPath = path.join(__dirname, 'config', 'credentials.json');
        const raw = await fs.readFile(credsPath, 'utf8');
        const creds = JSON.parse(raw);

        // Mask API keys
        const masked = JSON.parse(JSON.stringify(creds));
        const maskKey = (key) => key ? key.substring(0, 8) + '...' + key.substring(key.length - 4) : '';

        if (masked.youtube?.client_secret) masked.youtube.client_secret = maskKey(masked.youtube.client_secret);
        if (masked.aiProvider?.apiKey) masked.aiProvider.apiKey = maskKey(masked.aiProvider.apiKey);
        if (masked.providers) {
          for (const [, p] of Object.entries(masked.providers)) {
            if (p.apiKey) p.apiKey = maskKey(p.apiKey);
          }
        }
        if (masked.videoProviders) {
          for (const [, p] of Object.entries(masked.videoProviders)) {
            if (p.apiKey) p.apiKey = maskKey(p.apiKey);
          }
        }
        if (masked.imageProviders) {
          for (const [, p] of Object.entries(masked.imageProviders)) {
            if (p.apiKey) p.apiKey = maskKey(p.apiKey);
          }
        }
        if (masked.ttsProviders) {
          for (const [, p] of Object.entries(masked.ttsProviders)) {
            if (p.apiKey) p.apiKey = maskKey(p.apiKey);
          }
        }
        if (masked.replicate?.apiKey) masked.replicate.apiKey = maskKey(masked.replicate.apiKey);
        if (masked.elevenLabs?.apiKey) masked.elevenLabs.apiKey = maskKey(masked.elevenLabs.apiKey);
        if (masked.azureSpeech?.subscriptionKey) masked.azureSpeech.subscriptionKey = maskKey(masked.azureSpeech.subscriptionKey);

        res.json(masked);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Update credentials
    this.app.put('/api/credentials', async (req, res) => {
      try {
        const fs = require('fs').promises;
        const credsPath = path.join(__dirname, 'config', 'credentials.json');
        const updates = req.body;

        let existing = {};
        try {
          const raw = await fs.readFile(credsPath, 'utf8');
          existing = JSON.parse(raw);
        } catch (e) { /* first time */ }

        // Deep merge
        const merged = this.deepMerge(existing, updates);
        await fs.writeFile(credsPath, JSON.stringify(merged, null, 2));

        res.json({ success: true, message: 'Credentials updated. Restart server to apply.' });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get provider status
    this.app.get('/api/providers', async (req, res) => {
      try {
        const { AITextService } = require('./utils/ai-text-service');
        const fs = require('fs').promises;
        const credsPath = path.join(__dirname, 'config', 'credentials.json');
        const raw = await fs.readFile(credsPath, 'utf8');
        const creds = JSON.parse(raw);
        const service = new AITextService(creds);
        res.json(service.getProviderStatus());
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Test a provider
    this.app.post('/api/providers/test', async (req, res) => {
      try {
        const { provider } = req.body;
        const { AITextService } = require('./utils/ai-text-service');
        const fs = require('fs').promises;
        const credsPath = path.join(__dirname, 'config', 'credentials.json');
        const raw = await fs.readFile(credsPath, 'utf8');
        const creds = JSON.parse(raw);
        const service = new AITextService(creds);

        const result = await service.generateWithProvider(provider, 'Say "connection successful" in exactly 3 words.', { maxTokens: 20 });
        res.json({ success: true, provider, response: result });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Get all settings
    this.app.get('/api/settings', async (req, res) => {
      try {
        const settings = await this.db.getAllSettings();
        res.json(settings);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Update a setting
    this.app.put('/api/settings', async (req, res) => {
      try {
        const { key, value } = req.body;
        await this.db.setSetting(key, value);
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get .env config
    this.app.get('/api/env', async (req, res) => {
      try {
        const fs = require('fs').promises;
        const envPath = path.join(__dirname, '.env');
        const raw = await fs.readFile(envPath, 'utf8');

        // Parse and mask
        const lines = raw.split('\n');
        const config = {};
        for (const line of lines) {
          const match = line.match(/^([A-Z_]+)=(.*)$/);
          if (match) {
            const key = match[1];
            let val = match[2];
            // Mask keys
            if (key.includes('KEY') || key.includes('SECRET') || key.includes('TOKEN')) {
              val = val ? val.substring(0, 8) + '...' + val.substring(val.length - 4) : '';
            }
            config[key] = val;
          }
        }
        res.json(config);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Update .env
    this.app.put('/api/env', async (req, res) => {
      try {
        const fs = require('fs').promises;
        const envPath = path.join(__dirname, '.env');
        const updates = req.body;

        let raw = '';
        try {
          raw = await fs.readFile(envPath, 'utf8');
        } catch (e) { /* first time */ }

        for (const [key, value] of Object.entries(updates)) {
          const regex = new RegExp(`^${key}=.*$`, 'm');
          if (regex.test(raw)) {
            raw = raw.replace(regex, `${key}=${value}`);
          } else {
            raw += `\n${key}=${value}`;
          }
        }

        await fs.writeFile(envPath, raw.trim() + '\n');
        res.json({ success: true, message: 'Environment updated. Restart server to apply.' });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Restart server
    this.app.post('/api/restart', async (req, res) => {
      res.json({ success: true, message: 'Server restarting...' });
      setTimeout(() => process.exit(0), 500);
    });
  }

  deepMerge(target, source) {
    const output = Object.assign({}, target);
    if (this.isObject(target) && this.isObject(source)) {
      Object.keys(source).forEach(key => {
        if (this.isObject(source[key])) {
          if (!(key in target)) Object.assign(output, { [key]: source[key] });
          else output[key] = this.deepMerge(target[key], source[key]);
        } else {
          Object.assign(output, { [key]: source[key] });
        }
      });
    }
    return output;
  }

  isObject(item) {
    return (item && typeof item === 'object' && !Array.isArray(item));
  }

  async generateContent(topic = null, style = null, length = 'medium') {
    this.logger.info('Starting content generation pipeline...');
    
    // Step 1: Strategy
    const strategy = await this.agents.strategy.generateContentStrategy(topic);
    this.logger.info(`Strategy generated: ${strategy.topic}`);
    
    // Step 2: Script Writing
    const script = await this.agents.scriptWriter.generateScript(strategy);
    this.logger.info(`Script generated: ${script.title}`);
    
    // Step 3: Thumbnail Design
    const thumbnail = await this.agents.thumbnailDesigner.generateThumbnail(script);
    this.logger.info('Thumbnail generated');
    
    // Step 4: SEO Optimization
    const seoData = await this.agents.seoOptimizer.optimize(script, strategy);
    this.logger.info('SEO optimization complete');
    
    // Step 5: Production Management
    const productionData = await this.agents.production.processContent({
      strategy,
      script,
      thumbnail,
      seo: seoData
    });
    this.logger.info('Production processing complete');
    
    // Step 6: Save to database
    const contentId = await this.db.saveProductionData(productionData);
    this.logger.info(`Content saved with ID: ${contentId}`);
    
    return {
      contentId,
      title: script.title,
      scheduledFor: productionData.scheduledPublishTime
    };
  }

  async start() {
    const initialized = await this.initialize();
    
    if (!initialized) {
      console.log(chalk.red('\n❌ Failed to initialize. Please check your configuration.'));
      process.exit(1);
    }
    
    const PORT = process.env.PORT || 3456;
    this.app.listen(PORT, () => {
      console.log(chalk.green(`\n✅ YouTube Automation Agent running on port ${PORT}`));
      console.log(chalk.gray('─'.repeat(50)));
      console.log(chalk.white('📊 Dashboard: ') + chalk.cyan(`http://localhost:${PORT}`));
      console.log(chalk.white('🔧 API Health: ') + chalk.cyan(`http://localhost:${PORT}/health`));
      console.log(chalk.white('📅 Schedule: ') + chalk.cyan(`http://localhost:${PORT}/schedule`));
      console.log(chalk.white('📈 Analytics: ') + chalk.cyan(`http://localhost:${PORT}/analytics`));
      console.log(chalk.gray('─'.repeat(50)));
      console.log(chalk.yellow('\n🤖 Automation is active. Content will be generated and posted daily.'));
    });
  }
}

// Start the agent
if (require.main === module) {
  const agent = new YouTubeAutomationAgent();
  agent.start().catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });
}

module.exports = { YouTubeAutomationAgent };
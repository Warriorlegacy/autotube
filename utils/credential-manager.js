const fs = require('fs').promises;
const path = require('path');
const { google } = require('googleapis');
const inquirer = require('inquirer');
const chalk = require('chalk');
const { Logger } = require('./logger');

class CredentialManager {
  constructor() {
    this.logger = new Logger('CredentialManager');
    this.credentialsPath = path.join(__dirname, '..', 'config', 'credentials.json');
    this.tokensPath = path.join(__dirname, '..', 'config', 'tokens.json');
    this.credentials = {};
    this.tokens = {};
  }

  async initialize() {
    try {
      await this.loadCredentials();
      await this.loadTokens();
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize credentials:', error);
      return false;
    }
  }

  async loadCredentials() {
    try {
      const data = await fs.readFile(this.credentialsPath, 'utf8');
      this.credentials = JSON.parse(data);
    } catch (error) {
      this.credentials = {};
    }
  }

  async loadTokens() {
    try {
      const data = await fs.readFile(this.tokensPath, 'utf8');
      this.tokens = JSON.parse(data);
    } catch (error) {
      this.tokens = {};
    }
  }

  async saveCredentials() {
    await fs.mkdir(path.dirname(this.credentialsPath), { recursive: true });
    await fs.writeFile(this.credentialsPath, JSON.stringify(this.credentials, null, 2));
  }

  async saveTokens() {
    await fs.mkdir(path.dirname(this.tokensPath), { recursive: true });
    await fs.writeFile(this.tokensPath, JSON.stringify(this.tokens, null, 2));
  }

  // YouTube API Authentication
  async setupYouTubeCredentials() {
    console.log(chalk.cyan('\n🎬 YouTube API Setup'));
    console.log(chalk.gray('You need to create a YouTube Data API project in Google Cloud Console'));
    console.log(chalk.gray('Visit: https://console.cloud.google.com/'));
    
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'clientId',
        message: 'Enter your YouTube API Client ID:',
        validate: input => input.length > 0 || 'Client ID is required'
      },
      {
        type: 'password',
        name: 'clientSecret',
        message: 'Enter your YouTube API Client Secret:',
        validate: input => input.length > 0 || 'Client Secret is required'
      },
      {
        type: 'input',
        name: 'redirectUri',
        message: 'Enter your redirect URI:',
        default: 'http://localhost:8080/oauth2callback'
      }
    ]);

    this.credentials.youtube = {
      client_id: answers.clientId,
      client_secret: answers.clientSecret,
      redirect_uris: [answers.redirectUri]
    };

    await this.saveCredentials();
    
    // Authenticate and get tokens
    await this.authenticateYouTube();
    
    console.log(chalk.green('✅ YouTube credentials configured successfully!'));
  }

  async authenticateYouTube() {
    const oauth2Client = new google.auth.OAuth2(
      this.credentials.youtube.client_id,
      this.credentials.youtube.client_secret,
      this.credentials.youtube.redirect_uris[0]
    );

    const scopes = [
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube',
      'https://www.googleapis.com/auth/youtube.readonly',
      'https://www.googleapis.com/auth/yt-analytics.readonly'
    ];

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
    });

    console.log(chalk.cyan('\n🔗 Please visit this URL to authorize the application:'));
    console.log(chalk.blue(authUrl));

    const { code } = await inquirer.prompt([
      {
        type: 'input',
        name: 'code',
        message: 'Enter the authorization code:',
        validate: input => input.length > 0 || 'Authorization code is required'
      }
    ]);

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    this.tokens.youtube = tokens;
    await this.saveTokens();

    console.log(chalk.green('✅ YouTube authentication completed!'));
  }

  getYouTubeAuth() {
    if (!this.credentials.youtube || !this.tokens.youtube) {
      throw new Error('YouTube credentials not configured');
    }

    const oauth2Client = new google.auth.OAuth2(
      this.credentials.youtube.client_id,
      this.credentials.youtube.client_secret,
      this.credentials.youtube.redirect_uris[0]
    );

    oauth2Client.setCredentials(this.tokens.youtube);
    return oauth2Client;
  }

  getYouTubeClient() {
    const auth = this.getYouTubeAuth();
    return google.youtube({ version: 'v3', auth });
  }

  // OpenAI API Setup
  async setupOpenAICredentials() {
    console.log(chalk.cyan('\n🤖 OpenAI API Setup'));
    console.log(chalk.gray('Get your API key from: https://platform.openai.com/api-keys'));
    console.log(chalk.yellow('Note: OpenAI requires paid credits. Consider using free alternatives:'));
    console.log(chalk.gray('  - Groq (free): llama-3.3-70b'));
    console.log(chalk.gray('  - Cerebras (free): llama-3.3-70b'));
    console.log(chalk.gray('  - Gemini (free): gemini-2.0-flash'));
    
    const answers = await inquirer.prompt([
      {
        type: 'password',
        name: 'apiKey',
        message: 'Enter your OpenAI API Key:',
        validate: input => input.startsWith('sk-') || 'Invalid OpenAI API key format'
      },
      {
        type: 'list',
        name: 'model',
        message: 'Select your preferred model:',
        choices: [
          'gpt-4o-mini',
          'gpt-4o',
          'gpt-4-turbo'
        ],
        default: 'gpt-4o-mini'
      }
    ]);

    this.credentials.openai = {
      apiKey: answers.apiKey,
      model: answers.model
    };

    await this.saveCredentials();
    console.log(chalk.green('✅ OpenAI credentials configured successfully!'));
  }

  // Google Gemini API Setup
  async setupGeminiCredentials() {
    console.log(chalk.cyan('\n💎 Google Gemini API Setup'));
    console.log(chalk.gray('Get your API key from: https://aistudio.google.com/apikey'));
    console.log(chalk.green('Free tier: gemini-2.0-flash (generous limits)'));

    const answers = await inquirer.prompt([
      {
        type: 'password',
        name: 'apiKey',
        message: 'Enter your Gemini API Key:',
        validate: input => input.length > 0 || 'API key is required'
      },
      {
        type: 'list',
        name: 'model',
        message: 'Select your preferred Gemini model (free tier):',
        choices: [
          'gemini-2.0-flash',
          'gemini-2.5-flash',
          'gemini-1.5-flash'
        ],
        default: 'gemini-2.0-flash'
      }
    ]);

    this.credentials.gemini = {
      apiKey: answers.apiKey,
      model: answers.model
    };

    await this.saveCredentials();
    console.log(chalk.green('✅ Gemini credentials configured successfully!'));
  }

  // OpenRouter Setup
  async setupOpenRouterCredentials() {
    console.log(chalk.cyan('\nOpenRouter Setup'));
    console.log(chalk.gray('Get your API key from: https://openrouter.ai/keys'));
    console.log(chalk.green('Free models available: gemini-2.0-flash-exp:free, llama-3.3-70b:free'));
    console.log(chalk.gray('One key gives access to 300+ models'));

    const answers = await inquirer.prompt([
      {
        type: 'password',
        name: 'apiKey',
        message: 'Enter your OpenRouter API Key:',
        validate: input => input.startsWith('sk-or-') || 'Invalid OpenRouter key format (starts with sk-or-)'
      },
      {
        type: 'list',
        name: 'model',
        message: 'Select free model:',
        choices: [
          'google/gemini-2.0-flash-exp:free',
          'meta-llama/llama-3.3-70b-instruct:free',
          'qwen/qwen-2.5-72b-instruct:free'
        ],
        default: 'google/gemini-2.0-flash-exp:free'
      }
    ]);

    this.credentials.aiProvider = {
      provider: 'openrouter',
      apiKey: answers.apiKey,
      model: answers.model
    };

    await this.saveCredentials();
    console.log(chalk.green('OpenRouter configured successfully!'));
  }

  // Groq Setup
  async setupGroqCredentials() {
    console.log(chalk.cyan('\n⚡ Groq Setup (Fastest Free Inference)'));
    console.log(chalk.gray('Get your API key from: https://console.groq.com'));
    console.log(chalk.green('Free tier: llama-3.3-70b-versatile'));

    const answers = await inquirer.prompt([
      {
        type: 'password',
        name: 'apiKey',
        message: 'Enter your Groq API Key:',
        validate: input => input.startsWith('gsk_') || 'Invalid Groq key format (starts with gsk_)'
      },
      {
        type: 'list',
        name: 'model',
        message: 'Select model:',
        choices: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
        default: 'llama-3.3-70b-versatile'
      }
    ]);

    this.credentials.aiProvider = {
      provider: 'groq',
      apiKey: answers.apiKey,
      model: answers.model
    };

    await this.saveCredentials();
    console.log(chalk.green('✅ Groq configured successfully!'));
  }

  // Cerebras Setup
  async setupCerebrasCredentials() {
    console.log(chalk.cyan('\n🚀 Cerebras Setup (Ultra-Fast Free Inference)'));
    console.log(chalk.gray('Get your API key from: https://cloud.cerebras.ai'));
    console.log(chalk.green('Free tier: llama-3.3-70b'));

    const answers = await inquirer.prompt([
      {
        type: 'password',
        name: 'apiKey',
        message: 'Enter your Cerebras API Key:',
        validate: input => input.startsWith('csk-') || 'Invalid Cerebras key format (starts with csk-)'
      },
      {
        type: 'list',
        name: 'model',
        message: 'Select model:',
        choices: ['llama-3.3-70b', 'llama-3.1-8b'],
        default: 'llama-3.3-70b'
      }
    ]);

    this.credentials.aiProvider = {
      provider: 'cerebras',
      apiKey: answers.apiKey,
      model: answers.model
    };

    await this.saveCredentials();
    console.log(chalk.green('✅ Cerebras configured successfully!'));
  }

  // Kimi (Moonshot AI) Setup
  async setupKimiCredentials() {
    console.log(chalk.cyan('\nKimi (Moonshot AI) Setup'));
    console.log(chalk.gray('Get your API key from: https://platform.kimi.ai'));

    const answers = await inquirer.prompt([
      {
        type: 'password',
        name: 'apiKey',
        message: 'Enter your Moonshot API Key:',
        validate: input => input.length > 0 || 'API key is required'
      },
      {
        type: 'list',
        name: 'model',
        message: 'Select model:',
        choices: ['kimi-k2.6', 'kimi-k2.5', 'moonshot-v1-auto'],
        default: 'kimi-k2.6'
      }
    ]);

    this.credentials.aiProvider = {
      provider: 'kimi',
      apiKey: answers.apiKey,
      model: answers.model
    };

    await this.saveCredentials();
    console.log(chalk.green('Kimi credentials configured successfully!'));
  }

  // MiMo (Xiaomi) Setup
  async setupMiMoCredentials() {
    console.log(chalk.cyan('\nMiMo (Xiaomi) Setup'));
    console.log(chalk.gray('Get your API key from: https://mimo.mi.com'));

    const answers = await inquirer.prompt([
      {
        type: 'password',
        name: 'apiKey',
        message: 'Enter your MiMo API Key:',
        validate: input => input.length > 0 || 'API key is required'
      },
      {
        type: 'list',
        name: 'model',
        message: 'Select model:',
        choices: ['mimo-v2.5-pro', 'mimo-v2.5'],
        default: 'mimo-v2.5-pro'
      }
    ]);

    this.credentials.aiProvider = {
      provider: 'mimo',
      apiKey: answers.apiKey,
      model: answers.model
    };

    await this.saveCredentials();
    console.log(chalk.green('MiMo credentials configured successfully!'));
  }

  // Mistral AI Setup
  async setupMistralCredentials() {
    console.log(chalk.cyan('\n🌀 Mistral AI Setup'));
    console.log(chalk.gray('Get your API key from: https://console.mistral.ai'));
    console.log(chalk.green('Free tier: mistral-small-latest'));

    const answers = await inquirer.prompt([
      {
        type: 'password',
        name: 'apiKey',
        message: 'Enter your Mistral API Key:',
        validate: input => input.length > 0 || 'API key is required'
      },
      {
        type: 'list',
        name: 'model',
        message: 'Select model (free tier):',
        choices: ['mistral-small-latest', 'open-mistral-nemo'],
        default: 'mistral-small-latest'
      }
    ]);

    this.credentials.aiProvider = {
      provider: 'mistral',
      apiKey: answers.apiKey,
      model: answers.model
    };

    await this.saveCredentials();
    console.log(chalk.green('✅ Mistral configured successfully!'));
  }

  // xAI Setup
  async setupXAICredentials() {
    console.log(chalk.cyan('\n🤖 xAI (Grok) Setup'));
    console.log(chalk.gray('Get your API key from: https://console.x.ai'));
    console.log(chalk.green('Free tier: grok-3-mini'));

    const answers = await inquirer.prompt([
      {
        type: 'password',
        name: 'apiKey',
        message: 'Enter your xAI API Key:',
        validate: input => input.startsWith('xai-') || 'Invalid xAI key format (starts with xai-)'
      },
      {
        type: 'list',
        name: 'model',
        message: 'Select model (free tier):',
        choices: ['grok-3-mini'],
        default: 'grok-3-mini'
      }
    ]);

    this.credentials.aiProvider = {
      provider: 'xai',
      apiKey: answers.apiKey,
      model: answers.model
    };

    await this.saveCredentials();
    console.log(chalk.green('✅ xAI configured successfully!'));
  }

  // NVIDIA NIM Setup
  async setupNVIDIACredentials() {
    console.log(chalk.cyan('\n🔮 NVIDIA NIM Setup'));
    console.log(chalk.gray('Get your API key from: https://build.nvidia.com'));
    console.log(chalk.green('Free credits available'));

    const answers = await inquirer.prompt([
      {
        type: 'password',
        name: 'apiKey',
        message: 'Enter your NVIDIA NIM API Key:',
        validate: input => input.startsWith('nvapi-') || 'Invalid NVIDIA key format (starts with nvapi-)'
      },
      {
        type: 'list',
        name: 'model',
        message: 'Select model:',
        choices: ['meta/llama-3.3-70b-instruct', 'google/gemma-2-9b-it', 'meta/llama-3.1-8b-instruct'],
        default: 'meta/llama-3.3-70b-instruct'
      }
    ]);

    this.credentials.aiProvider = {
      provider: 'nvidiaNim',
      apiKey: answers.apiKey,
      model: answers.model
    };

    await this.saveCredentials();
    console.log(chalk.green('✅ NVIDIA NIM configured successfully!'));
  }

  // Cohere Setup
  async setupCohereCredentials() {
    console.log(chalk.cyan('\n📘 Cohere Setup'));
    console.log(chalk.gray('Get your API key from: https://dashboard.cohere.com'));
    console.log(chalk.green('Free tier: command-r'));

    const answers = await inquirer.prompt([
      {
        type: 'password',
        name: 'apiKey',
        message: 'Enter your Cohere API Key:',
        validate: input => input.startsWith('Dw') || 'Invalid Cohere key format'
      },
      {
        type: 'list',
        name: 'model',
        message: 'Select model (free tier):',
        choices: ['command-r', 'command-light'],
        default: 'command-r'
      }
    ]);

    this.credentials.aiProvider = {
      provider: 'cohere',
      apiKey: answers.apiKey,
      model: answers.model
    };

    await this.saveCredentials();
    console.log(chalk.green('✅ Cohere configured successfully!'));
  }

  // Ollama Setup
  async setupOllamaCredentials() {
    console.log(chalk.cyan('\n🏠 Ollama (Local) Setup'));
    console.log(chalk.gray('Make sure Ollama is running locally on port 11434'));
    console.log(chalk.green('Always free - runs on your machine'));

    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'model',
        message: 'Select model (must be installed via ollama pull):',
        choices: ['llama3.2', 'llama3.1', 'mistral', 'codellama', 'phi3'],
        default: 'llama3.2'
      }
    ]);

    this.credentials.aiProvider = {
      provider: 'ollama',
      model: answers.model
    };

    await this.saveCredentials();
    console.log(chalk.green('✅ Ollama configured successfully!'));
  }

  // GLM (Zhipu AI) Setup
  async setupGLMCredentials() {
    console.log(chalk.cyan('\nGLM (Zhipu AI) Setup'));
    console.log(chalk.gray('Get your API key from: https://z.ai'));

    const answers = await inquirer.prompt([
      {
        type: 'password',
        name: 'apiKey',
        message: 'Enter your GLM API Key:',
        validate: input => input.length > 0 || 'API key is required'
      },
      {
        type: 'list',
        name: 'model',
        message: 'Select model:',
        choices: ['glm-5', 'glm-5.1'],
        default: 'glm-5'
      }
    ]);

    this.credentials.aiProvider = {
      provider: 'glm',
      apiKey: answers.apiKey,
      model: answers.model
    };

    await this.saveCredentials();
    console.log(chalk.green('GLM credentials configured successfully!'));
  }

  // Azure Speech Services (TTS)
  async setupAzureSpeechCredentials() {
    console.log(chalk.cyan('\n🎙️  Azure Speech Services Setup'));
    console.log(chalk.gray('Create a Speech service in Azure Portal'));
    
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'subscriptionKey',
        message: 'Enter your Azure Speech subscription key:',
        validate: input => input.length > 0 || 'Subscription key is required'
      },
      {
        type: 'input',
        name: 'region',
        message: 'Enter your Azure region:',
        default: 'eastus'
      },
      {
        type: 'list',
        name: 'voice',
        message: 'Select preferred voice:',
        choices: [
          'en-US-JennyNeural',
          'en-US-GuyNeural',
          'en-US-AriaNeural',
          'en-US-DavisNeural',
          'en-US-AmberNeural'
        ],
        default: 'en-US-JennyNeural'
      }
    ]);

    this.credentials.azureSpeech = {
      subscriptionKey: answers.subscriptionKey,
      region: answers.region,
      voice: answers.voice
    };

    await this.saveCredentials();
    console.log(chalk.green('✅ Azure Speech credentials configured successfully!'));
  }

  // Channel Configuration
  async setupChannelConfig() {
    console.log(chalk.cyan('\n📺 Channel Configuration'));
    
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'channelName',
        message: 'Enter your channel name:',
        validate: input => input.length > 0 || 'Channel name is required'
      },
      {
        type: 'input',
        name: 'channelDescription',
        message: 'Enter channel description:',
        default: 'Automated content channel'
      },
      {
        type: 'input',
        name: 'defaultCategory',
        message: 'Enter default video category ID (22 = People & Blogs):',
        default: '22'
      },
      {
        type: 'list',
        name: 'defaultPrivacy',
        message: 'Select default privacy setting:',
        choices: ['public', 'unlisted', 'private'],
        default: 'public'
      },
      {
        type: 'input',
        name: 'websiteUrl',
        message: 'Enter your website URL (optional):'
      },
      {
        type: 'input',
        name: 'businessEmail',
        message: 'Enter business email (optional):'
      }
    ]);

    this.credentials.channel = answers;
    
    // Set environment variables for the application
    process.env.CHANNEL_NAME = answers.channelName;
    process.env.DEFAULT_PRIVACY_STATUS = answers.defaultPrivacy;
    process.env.WEBSITE_URL = answers.websiteUrl;
    process.env.BUSINESS_EMAIL = answers.businessEmail;

    await this.saveCredentials();
    console.log(chalk.green('✅ Channel configuration saved successfully!'));
  }

  // Content Configuration
  async setupContentConfig() {
    console.log(chalk.cyan('\n📝 Content Configuration'));
    
    const answers = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'contentTypes',
        message: 'Select content types to generate:',
        choices: [
          { name: 'Tutorials', value: 'tutorial', checked: true },
          { name: 'Explainers', value: 'explainer', checked: true },
          { name: 'List Videos', value: 'list', checked: true },
          { name: 'Reviews', value: 'review', checked: false },
          { name: 'Stories', value: 'story', checked: false }
        ],
        validate: input => input.length > 0 || 'Select at least one content type'
      },
      {
        type: 'input',
        name: 'competitorChannels',
        message: 'Enter competitor channel IDs (comma-separated):',
        filter: input => input.split(',').map(id => id.trim()).filter(id => id)
      },
      {
        type: 'input',
        name: 'targetAudience',
        message: 'Describe your target audience:',
        default: 'General audience interested in educational content'
      },
      {
        type: 'list',
        name: 'postingFrequency',
        message: 'Select posting frequency:',
        choices: [
          { name: 'Daily', value: 'daily' },
          { name: 'Every other day', value: 'every-2-days' },
          { name: '3 times per week', value: '3-per-week' },
          { name: 'Weekly', value: 'weekly' }
        ],
        default: 'daily'
      },
      {
        type: 'input',
        name: 'preferredPostTime',
        message: 'Preferred posting time (24h format, e.g., 14:00):',
        default: '14:00'
      }
    ]);

    this.credentials.content = answers;
    
    // Set environment variables
    process.env.COMPETITOR_CHANNELS = answers.competitorChannels.join(',');
    process.env.DEFAULT_AUTHOR = answers.channelName || 'Content Creator';
    process.env.TARGET_AUDIENCE = answers.targetAudience;

    await this.saveCredentials();
    console.log(chalk.green('✅ Content configuration saved successfully!'));
  }

  // Validation methods
  async validateAll() {
    try {
      await this.loadCredentials();
      await this.loadTokens();
    } catch (error) {
      // Files might not exist yet
    }

    const missing = [];

    // YouTube is always required
    if (!this.credentials.youtube) {
      missing.push('youtube');
    }

    // AI provider: check aiProvider, openai, providers map, or env vars
    const hasAI = this.credentials.aiProvider?.apiKey ||
                  this.credentials.openai?.apiKey ||
                  this.credentials.providers ||
                  process.env.OPENROUTER_API_KEY ||
                  process.env.GROQ_API_KEY ||
                  process.env.OPENAI_API_KEY;

    if (!hasAI) {
      missing.push('ai-provider (openai, openrouter, groq, etc.)');
    }

    if (missing.length > 0) {
      console.log(chalk.yellow(`\n⚠️  Missing credentials for: ${missing.join(', ')}`));
      return false;
    }

    // Validate YouTube tokens
    if (!this.tokens.youtube) {
      console.log(chalk.yellow('\n⚠️  YouTube authentication required'));
      return false;
    }

    return true;
  }

  async testConnections() {
    console.log(chalk.cyan('\n🔍 Testing API connections...'));
    
    const results = {
      youtube: false,
      openai: false,
      azureSpeech: false
    };

    // Test YouTube API
    try {
      const youtube = this.getYouTubeClient();
      await youtube.channels.list({
        part: 'snippet',
        mine: true
      });
      results.youtube = true;
      console.log(chalk.green('✅ YouTube API connection successful'));
    } catch (error) {
      console.log(chalk.red('❌ YouTube API connection failed'));
      this.logger.error('YouTube API test failed:', error);
    }

    // Test OpenAI API
    if (this.credentials.openai) {
      try {
        const OpenAI = require('openai');
        const openai = new OpenAI({ apiKey: this.credentials.openai.apiKey });

        await openai.models.list();
        results.openai = true;
        console.log(chalk.green('✅ OpenAI API connection successful'));
      } catch (error) {
        console.log(chalk.red('❌ OpenAI API connection failed'));
        this.logger.error('OpenAI API test failed:', error);
      }
    }

    return results;
  }

  // Setup wizard
  async runSetupWizard() {
    console.log(chalk.cyan.bold('\n🚀 YouTube Automation Agent Setup Wizard'));
    console.log(chalk.gray('Let\'s configure your credentials and settings...\n'));

    const setupSteps = [
      { name: '🎬 YouTube API', action: () => this.setupYouTubeCredentials() },
      { name: '🤖 AI Service (OpenAI/Gemini)', action: () => this.setupAIService() },
      { name: '🎙️  Text-to-Speech Service', action: () => this.setupTTSService() },
      { name: '📺 Channel Configuration', action: () => this.setupChannelConfig() },
      { name: '📝 Content Configuration', action: () => this.setupContentConfig() }
    ];

    for (const step of setupSteps) {
      console.log(chalk.cyan(`\n${step.name}`));
      await step.action();
    }

    console.log(chalk.green.bold('\n🎉 Setup completed successfully!'));
    console.log(chalk.cyan('You can now run: npm start'));
    
    // Test connections
    await this.testConnections();
  }

  async setupAIService() {
    const { service } = await inquirer.prompt([
      {
        type: 'list',
        name: 'service',
        message: 'Select your preferred AI service (all free tier):',
        choices: [
          { name: '⚡ Groq (Fastest, free: llama-3.3-70b)', value: 'groq' },
          { name: '🚀 Cerebras (Ultra-fast, free: llama-3.3-70b)', value: 'cerebras' },
          { name: '💎 Google Gemini (free: gemini-2.0-flash)', value: 'gemini' },
          { name: '🔮 NVIDIA NIM (free credits)', value: 'nvidiaNim' },
          { name: '🌐 OpenRouter (free models: gemini, llama, qwen)', value: 'openrouter' },
          { name: '🌀 Mistral AI (free tier)', value: 'mistral' },
          { name: '🤖 xAI Grok (free: grok-3-mini)', value: 'xai' },
          { name: '📘 Cohere (free tier)', value: 'cohere' },
          { name: '🏠 Ollama (Local, always free)', value: 'ollama' },
          { name: '💳 OpenAI (paid)', value: 'openai' }
        ]
      }
    ]);

    switch (service) {
      case 'groq': return await this.setupGroqCredentials();
      case 'cerebras': return await this.setupCerebrasCredentials();
      case 'gemini': return await this.setupGeminiCredentials();
      case 'openrouter': return await this.setupOpenRouterCredentials();
      case 'mistral': return await this.setupMistralCredentials();
      case 'xai': return await this.setupXAICredentials();
      case 'nvidiaNim': return await this.setupNVIDIACredentials();
      case 'cohere': return await this.setupCohereCredentials();
      case 'ollama': return await this.setupOllamaCredentials();
      case 'openai': return await this.setupOpenAICredentials();
    }
  }

  async setupTTSService() {
    const { service } = await inquirer.prompt([
      {
        type: 'list',
        name: 'service',
        message: 'Select your preferred Text-to-Speech service:',
        choices: [
          { name: 'OpenAI TTS (gpt-4o-mini-tts, uses your OpenAI key)', value: 'openai-tts' },
          { name: 'ElevenLabs (highest quality)', value: 'elevenlabs' },
          { name: 'Azure Speech Services', value: 'azure' },
          { name: 'Skip TTS Setup', value: 'skip' }
        ]
      }
    ]);

    if (service === 'openai-tts') {
      console.log(chalk.green('✅ OpenAI TTS will use your existing OpenAI API key'));
    } else if (service === 'elevenlabs') {
      await this.setupElevenLabsCredentials();
    } else if (service === 'azure') {
      await this.setupAzureSpeechCredentials();
    }
  }

  async setupElevenLabsCredentials() {
    console.log(chalk.cyan('\n🎙️  ElevenLabs Setup'));
    console.log(chalk.gray('Get your API key from: https://elevenlabs.io'));

    const answers = await inquirer.prompt([
      {
        type: 'password',
        name: 'apiKey',
        message: 'Enter your ElevenLabs API Key:',
        validate: input => input.length > 0 || 'API key is required'
      },
      {
        type: 'input',
        name: 'voiceId',
        message: 'Enter your preferred Voice ID:',
        validate: input => input.length > 0 || 'Voice ID is required'
      }
    ]);

    this.credentials.elevenLabs = {
      apiKey: answers.apiKey,
      voiceId: answers.voiceId
    };

    await this.saveCredentials();
    console.log(chalk.green('✅ ElevenLabs credentials configured successfully!'));
  }

  // Video Generation Services Setup
  async setupVideoProviders() {
    console.log(chalk.cyan('\n🎬 Video Generation Services'));
    console.log(chalk.gray('Configure API keys for AI video generation'));

    const { provider } = await inquirer.prompt([
      {
        type: 'list',
        name: 'provider',
        message: 'Select a video generation provider:',
        choices: [
          { name: 'Replicate (Wan 2.7, SVD)', value: 'replicate' },
          { name: 'RunwayML (Gen-3/4)', value: 'runway' },
          { name: 'Luma AI (Dream Machine)', value: 'luma' },
          { name: 'Pika Labs', value: 'pika' },
          { name: 'fal.ai', value: 'fal' },
          { name: 'Skip', value: 'skip' }
        ]
      }
    ]);

    if (provider === 'skip') return;

    const providers = {
      replicate: { name: 'Replicate', placeholder: 'r8_...' },
      runway: { name: 'RunwayML', placeholder: 'rw_...' },
      luma: { name: 'Luma AI', placeholder: 'luma_...' },
      pika: { name: 'Pika Labs', placeholder: 'pika_...' },
      fal: { name: 'fal.ai', placeholder: 'fal_...' }
    };

    const info = providers[provider];
    const answers = await inquirer.prompt([
      {
        type: 'password',
        name: 'apiKey',
        message: `Enter your ${info.name} API Key:`,
        validate: input => input.length > 0 || 'API key is required'
      }
    ]);

    if (!this.credentials.videoProviders) this.credentials.videoProviders = {};
    this.credentials.videoProviders[provider] = { apiKey: answers.apiKey };

    await this.saveCredentials();
    console.log(chalk.green(`✅ ${info.name} configured successfully!`));
  }
}

// CLI interface for credential setup
if (require.main === module) {
  const credentialManager = new CredentialManager();
  
  const args = process.argv.slice(2);
  if (args.includes('setup')) {
    credentialManager.runSetupWizard().catch(console.error);
  } else {
    console.log('Usage: node credential-manager.js setup');
  }
}

module.exports = { CredentialManager };
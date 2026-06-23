const OpenAI = require('openai');
const { Logger } = require('./logger');

const PROVIDERS = {
  groq: {
    name: 'Groq',
    baseURL: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
    envKey: 'GROQ_API_KEY',
    type: 'openai-compatible',
    free: true
  },
  cerebras: {
    name: 'Cerebras',
    baseURL: 'https://api.cerebras.ai/v1',
    defaultModel: 'llama-3.3-70b',
    models: ['llama-3.3-70b', 'llama-3.1-8b'],
    envKey: 'CEREBRAS_API_KEY',
    type: 'openai-compatible',
    free: true
  },
  gemini: {
    name: 'Google Gemini',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    defaultModel: 'gemini-2.0-flash',
    models: ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-1.5-flash'],
    envKey: 'GEMINI_API_KEY',
    type: 'gemini',
    free: true
  },
  nvidiaNim: {
    name: 'NVIDIA NIM',
    baseURL: 'https://integrate.api.nvidia.com/v1',
    defaultModel: 'meta/llama-3.3-70b-instruct',
    models: ['meta/llama-3.3-70b-instruct', 'google/gemma-2-9b-it', 'meta/llama-3.1-8b-instruct'],
    envKey: 'NVIDIA_NIM_API_KEY',
    type: 'openai-compatible',
    free: true
  },
  openrouter: {
    name: 'OpenRouter',
    baseURL: 'https://openrouter.ai/api/v1',
    defaultModel: 'google/gemini-2.0-flash-exp:free',
    models: ['google/gemini-2.0-flash-exp:free', 'meta-llama/llama-3.3-70b-instruct:free', 'qwen/qwen-2.5-72b-instruct:free'],
    envKey: 'OPENROUTER_API_KEY',
    type: 'openai-compatible',
    free: true
  },
  mistral: {
    name: 'Mistral AI',
    baseURL: 'https://api.mistral.ai/v1',
    defaultModel: 'mistral-small-latest',
    models: ['mistral-small-latest', 'open-mistral-nemo'],
    envKey: 'MISTRAL_API_KEY',
    type: 'openai-compatible',
    free: true
  },
  xai: {
    name: 'xAI (Grok)',
    baseURL: 'https://api.x.ai/v1',
    defaultModel: 'grok-3-mini',
    models: ['grok-3-mini'],
    envKey: 'XAI_API_KEY',
    type: 'openai-compatible',
    free: true
  },
  cohere: {
    name: 'Cohere',
    baseURL: 'https://api.cohere.com/v2',
    defaultModel: 'command-r',
    models: ['command-r', 'command-light'],
    envKey: 'COHERE_API_KEY',
    type: 'cohere',
    free: true
  },
  ollama: {
    name: 'Ollama (Local)',
    baseURL: 'http://localhost:11434/v1',
    defaultModel: 'llama3.2',
    models: ['llama3.2', 'llama3.1', 'mistral', 'codellama', 'phi3'],
    envKey: 'OLLAMA_API_KEY',
    type: 'openai-compatible',
    optional: true,
    free: true
  }
};

// Fallback order: fastest/most reliable free providers first
const FALLBACK_ORDER = [
  'groq',        // Fastest inference, generous free tier
  'cerebras',    // Ultra-fast, free tier
  'gemini',      // Google free tier, excellent quality
  'nvidiaNim',   // Free credits, good models
  'openrouter',  // Free models available
  'mistral',     // Free tier available
  'xai',         // Free tier for grok-3-mini
  'cohere',      // Free tier for command-r
  'ollama'       // Local, always free
];

class AITextService {
  constructor(credentials = {}) {
    this.logger = new Logger('AITextService');
    this.clients = new Map();
    this.activeProvider = null;
    this.activeModel = null;
    this.geminiClient = null;
    this.cohereClient = null;
    this.providerHealth = new Map();

    this._init(credentials);
  }

  _init(credentials) {
    // Build provider list from credentials or env vars
    const availableProviders = [];

    for (const [key, preset] of Object.entries(PROVIDERS)) {
      let apiKey = null;

      // Check credentials object first
      if (credentials.providers && credentials.providers[key] && credentials.providers[key].apiKey) {
        apiKey = credentials.providers[key].apiKey;
      }
      // Check aiProvider match
      else if (credentials.aiProvider && credentials.aiProvider.provider === key && credentials.aiProvider.apiKey) {
        apiKey = credentials.aiProvider.apiKey;
      }
      // Fallback to env var
      else if (process.env[preset.envKey]) {
        apiKey = process.env[preset.envKey];
      }

      if (apiKey || preset.type === 'openai-compatible' && preset.optional) {
        availableProviders.push({ key, preset, apiKey });
        this.providerHealth.set(key, { success: 0, fail: 0, lastError: null });
      }
    }

    // Sort by fallback order
    availableProviders.sort((a, b) => {
      const aIdx = FALLBACK_ORDER.indexOf(a.key);
      const bIdx = FALLBACK_ORDER.indexOf(b.key);
      return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
    });

    if (availableProviders.length === 0) {
      this.logger.warn('No AI text providers configured');
      return;
    }

    // Initialize clients
    for (const { key, preset, apiKey } of availableProviders) {
      if (preset.type === 'gemini' && apiKey) {
        this._initGemini(apiKey, preset);
      } else if (preset.type === 'cohere' && apiKey) {
        this._initCohere(apiKey, preset);
      } else if (preset.type === 'openai-compatible' && apiKey) {
        this._initOpenAICompatible(key, preset, apiKey);
      }
    }

    // Set active provider to first available
    const firstKey = availableProviders[0]?.key;
    if (firstKey) {
      this.activeProvider = firstKey;
      this.activeModel = availableProviders[0].preset.defaultModel;
      this.logger.info(`Active provider: ${availableProviders[0].preset.name} (${this.activeModel})`);
    }

    this.logger.info(`${availableProviders.length} provider(s) available for fallback`);
  }

  _initOpenAICompatible(key, preset, apiKey) {
    try {
      const client = new OpenAI({
        apiKey,
        baseURL: preset.baseURL,
        timeout: 30000
      });
      this.clients.set(key, { client, preset });
      this.logger.info(`${preset.name} initialized (${preset.defaultModel})`);
    } catch (error) {
      this.logger.error(`Failed to init ${preset.name}:`, error.message);
    }
  }

  _initGemini(apiKey, preset) {
    try {
      const { GoogleGenAI } = require('@google/genai');
      this.geminiClient = new GoogleGenAI({ apiKey });
      this.clients.set('gemini', { preset, type: 'gemini' });
      this.logger.info(`${preset.name} initialized (${preset.defaultModel})`);
    } catch (error) {
      this.logger.error(`Failed to init ${preset.name}:`, error.message);
    }
  }

  _initCohere(apiKey, preset) {
    try {
      // Use OpenAI-compatible endpoint for Cohere
      const client = new OpenAI({
        apiKey,
        baseURL: 'https://api.cohere.com/compatibility/v1',
        timeout: 30000
      });
      this.clients.set('cohere', { client, preset });
      this.logger.info(`${preset.name} initialized (${preset.defaultModel})`);
    } catch (error) {
      this.logger.error(`Failed to init ${preset.name}:`, error.message);
    }
  }

  async generateText(prompt, options = {}) {
    const maxTokens = options.maxTokens || 2048;
    const temperature = options.temperature ?? 0.7;
    const requestedProvider = options.provider || null;

    // If specific provider requested, try only that one
    if (requestedProvider && this.clients.has(requestedProvider)) {
      return await this._callProvider(requestedProvider, prompt, maxTokens, temperature);
    }

    // Try providers in fallback order
    const tried = new Set();
    const errors = [];

    for (const providerKey of FALLBACK_ORDER) {
      if (!this.clients.has(providerKey) || tried.has(providerKey)) continue;
      tried.add(providerKey);

      try {
        const result = await this._callProvider(providerKey, prompt, maxTokens, temperature);
        this._recordSuccess(providerKey);
        return result;
      } catch (error) {
        this._recordFailure(providerKey, error);
        errors.push({ provider: providerKey, error: error.message });
        this.logger.warn(`${PROVIDERS[providerKey]?.name || providerKey} failed: ${error.message.substring(0, 100)}`);
      }
    }

    throw new Error(`All providers failed. Errors:\n${errors.map(e => `  ${e.provider}: ${e.error}`).join('\n')}`);
  }

  async _callProvider(providerKey, prompt, maxTokens, temperature) {
    const provider = this.clients.get(providerKey);
    if (!provider) throw new Error(`Provider ${providerKey} not available`);

    // Gemini uses native SDK
    if (providerKey === 'gemini' && this.geminiClient) {
      const response = await this.geminiClient.models.generateContent({
        model: provider.preset.defaultModel,
        contents: prompt,
        config: { maxOutputTokens: maxTokens, temperature }
      });
      return response.text;
    }

    // OpenAI-compatible providers
    if (provider.client) {
      const response = await provider.client.chat.completions.create({
        model: provider.preset.defaultModel,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature
      });
      return response.choices[0].message.content;
    }

    throw new Error(`No client for provider ${providerKey}`);
  }

  async generateWithProvider(providerKey, prompt, options = {}) {
    if (!this.clients.has(providerKey)) {
      throw new Error(`Provider ${providerKey} not available`);
    }
    return await this._callProvider(providerKey, prompt, options.maxTokens || 2048, options.temperature ?? 0.7);
  }

  _recordSuccess(providerKey) {
    const health = this.providerHealth.get(providerKey);
    if (health) {
      health.success++;
      health.lastError = null;
    }
    this.activeProvider = providerKey;
  }

  _recordFailure(providerKey, error) {
    const health = this.providerHealth.get(providerKey);
    if (health) {
      health.fail++;
      health.lastError = error.message;
    }
  }

  getProviderStatus() {
    const status = {};
    for (const [key, health] of this.providerHealth) {
      const preset = PROVIDERS[key];
      status[key] = {
        name: preset?.name || key,
        available: this.clients.has(key),
        success: health.success,
        fail: health.fail,
        lastError: health.lastError,
        isActive: key === this.activeProvider
      };
    }
    return status;
  }

  getActiveProvider() {
    return {
      key: this.activeProvider,
      name: PROVIDERS[this.activeProvider]?.name,
      model: this.activeModel
    };
  }

  isAvailable() {
    return this.clients.size > 0;
  }

  getAvailableProviders() {
    return Array.from(this.clients.keys()).map(key => ({
      key,
      name: PROVIDERS[key]?.name,
      model: PROVIDERS[key]?.defaultModel
    }));
  }
}

module.exports = { AITextService, PROVIDERS, FALLBACK_ORDER };

const { ContentStrategyAgent } = require('./content-strategy-agent');
const { Database } = require('../database/db');
const { Logger } = require('../utils/logger');

class ContentStrategyMCPServer {
  constructor() {
    this.logger = new Logger('ContentStrategyMCP');
    this.agent = null;
    this.db = null;
  }

  async initialize() {
    this.db = new Database();
    await this.db.initialize();

    const { CredentialManager } = require('../utils/credential-manager');
    const credentials = new CredentialManager();
    await credentials.initialize();

    this.agent = new ContentStrategyAgent(this.db, credentials);
    await this.agent.initialize();

    this.logger.success('Content Strategy MCP Server initialized');
  }

  async handleToolCall(toolName, args) {
    try {
      switch (toolName) {
        case 'analyze_trends':
          return await this.analyzeTrends(args);
        case 'generate_strategy':
          return await this.generateStrategy(args);
        case 'analyze_competitors':
          return await this.analyzeCompetitors(args);
        case 'predict_performance':
          return await this.predictPerformance(args);
        case 'get_content_calendar':
          return await this.getContentCalendar(args);
        default:
          return { error: `Unknown tool: ${toolName}` };
      }
    } catch (error) {
      this.logger.error(`Tool call failed: ${toolName}`, error);
      return { error: error.message };
    }
  }

  async analyzeTrends(args) {
    const { region = 'US', category = null } = args;
    await this.agent.analyzeTrends();

    return {
      trendingTopics: this.agent.trendingTopics.slice(0, 20),
      region,
      category,
      analyzedAt: new Date().toISOString()
    };
  }

  async generateStrategy(args) {
    const { topic = null, targetAudience = null } = args;
    const strategy = await this.agent.generateContentStrategy(topic);

    return {
      strategy,
      generatedAt: new Date().toISOString()
    };
  }

  async analyzeCompetitors(args) {
    const { channelIds } = args;
    const results = [];

    for (const channelId of channelIds) {
      try {
        const videos = await this.agent.getChannelVideos(channelId);
        const analysis = this.agent.analyzeVideoPerformance(videos);
        results.push({
          channelId,
          ...analysis
        });
      } catch (error) {
        results.push({
          channelId,
          error: error.message
        });
      }
    }

    return {
      competitors: results,
      analyzedAt: new Date().toISOString()
    };
  }

  async predictPerformance(args) {
    const { topic, publishTime = null } = args;
    const predictedViews = this.agent.predictViews(topic);
    const bestTime = this.agent.calculateBestPublishTime();

    return {
      topic,
      predictedViews,
      recommendedPublishTime: publishTime || bestTime,
      confidence: Math.min(0.8, predictedViews / 50000),
      factors: {
        topicScore: this.agent.trendingTopics.find(t => t.topic === topic)?.score || 0,
        seasonalMultiplier: this.agent.getSeasonalMultiplier(topic),
        audienceMultiplier: this.agent.getAudienceMultiplier(topic)
      }
    };
  }

  async getContentCalendar(args) {
    const { days = 7 } = args;
    const calendar = [];

    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);

      calendar.push({
        date: date.toISOString().split('T')[0],
        day: date.toLocaleDateString('en-US', { weekday: 'long' }),
        suggestedTopics: this.agent.trendingTopics.slice(0, 3).map(t => t.topic),
        optimalPublishTime: this.agent.calculateBestPublishTime()
      });
    }

    return {
      calendar,
      days,
      generatedAt: new Date().toISOString()
    };
  }

  async cleanup() {
    if (this.db) {
      await this.db.close();
    }
  }
}

async function main() {
  const server = new ContentStrategyMCPServer();

  try {
    await server.initialize();

    // Read tool calls from stdin (JSON-RPC style)
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.on('line', async (line) => {
      try {
        const request = JSON.parse(line);
        const { tool, args = {}, id } = request;

        const result = await server.handleToolCall(tool, args);

        const response = {
          jsonrpc: '2.0',
          id: id || null,
          result
        };

        process.stdout.write(JSON.stringify(response) + '\n');
      } catch (error) {
        const errorResponse = {
          jsonrpc: '2.0',
          id: null,
          error: {
            code: -32603,
            message: error.message
          }
        };
        process.stdout.write(JSON.stringify(errorResponse) + '\n');
      }
    });

    rl.on('close', async () => {
      await server.cleanup();
      process.exit(0);
    });
  } catch (error) {
    console.error('MCP Server failed:', error);
    await server.cleanup();
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { ContentStrategyMCPServer };

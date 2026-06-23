const { Logger } = require('../utils/logger');
const { Database } = require('../database/db');
const { ContentStrategyAgent } = require('../agents/content-strategy-agent');
const { ScriptWriterAgent } = require('../agents/script-writer-agent');
const { ThumbnailDesignerAgent } = require('../agents/thumbnail-designer-agent');
const { SEOOptimizerAgent } = require('../agents/seo-optimizer-agent');
const { ProductionManagementAgent } = require('../agents/production-management-agent');
const { PublishingSchedulingAgent } = require('../agents/publishing-scheduling-agent');
const { AnalyticsOptimizationAgent } = require('../agents/analytics-optimization-agent');
const chalk = require('chalk');

class DailyContentPipeline {
  constructor(credentials = null) {
    this.logger = new Logger('DailyPipeline');
    this.db = null;
    this.credentials = credentials;
    this.agents = {};
    this.results = {
      strategy: null,
      script: null,
      thumbnail: null,
      seo: null,
      production: null,
      scheduled: false,
      errors: []
    };
  }

  async initialize() {
    this.logger.info('Initializing Daily Content Pipeline...');

    this.db = new Database();
    await this.db.initialize();

    if (!this.credentials) {
      const { CredentialManager } = require('../utils/credential-manager');
      this.credentials = new CredentialManager();
      await this.credentials.initialize();
    }

    await this.initializeAgents();
    this.logger.success('Daily Content Pipeline ready');
    return true;
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

    for (const [name, agent] of Object.entries(this.agents)) {
      await agent.initialize();
      this.logger.info(`${name} agent initialized`);
    }
  }

  async run(topic = null, options = {}) {
    const startTime = Date.now();
    this.logger.info(chalk.cyan.bold('Starting Daily Content Pipeline...'));

    try {
      // Stage 1: Content Strategy
      await this.runStrategy(topic);

      // Stage 2: Script Writing
      await this.runScriptWriter();

      // Stage 3: Thumbnail Design
      await this.runThumbnailDesigner();

      // Stage 4: SEO Optimization
      await this.runSEOOptimizer();

      // Stage 5: Production
      await this.runProduction();

      // Stage 6: Publishing
      if (!options.skipPublish) {
        await this.runPublishing();
      }

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      this.logger.success(chalk.green.bold(`Pipeline completed in ${elapsed}s`));

      return this.getReport();
    } catch (error) {
      this.logger.error('Pipeline failed:', error);
      this.results.errors.push({ stage: 'pipeline', error: error.message });
      throw error;
    }
  }

  async runStrategy(topic) {
    this.logger.info(chalk.cyan('Stage 1/6: Content Strategy'));
    try {
      this.results.strategy = await this.agents.strategy.generateContentStrategy(topic);
      this.logger.success(`Strategy: ${this.results.strategy.topic}`);
    } catch (error) {
      this.logger.error('Strategy generation failed:', error);
      this.results.errors.push({ stage: 'strategy', error: error.message });
      throw error;
    }
  }

  async runScriptWriter() {
    this.logger.info(chalk.cyan('Stage 2/6: Script Writing'));
    try {
      this.results.script = await this.agents.scriptWriter.generateScript(this.results.strategy);
      this.logger.success(`Script: ${this.results.script.title}`);
    } catch (error) {
      this.logger.error('Script generation failed:', error);
      this.results.errors.push({ stage: 'script', error: error.message });
      throw error;
    }
  }

  async runThumbnailDesigner() {
    this.logger.info(chalk.cyan('Stage 3/6: Thumbnail Design'));
    try {
      this.results.thumbnail = await this.agents.thumbnailDesigner.generateThumbnail(this.results.script);
      this.logger.success('Thumbnail generated');
    } catch (error) {
      this.logger.error('Thumbnail generation failed:', error);
      this.results.errors.push({ stage: 'thumbnail', error: error.message });
      throw error;
    }
  }

  async runSEOOptimizer() {
    this.logger.info(chalk.cyan('Stage 4/6: SEO Optimization'));
    try {
      this.results.seo = await this.agents.seoOptimizer.optimize(this.results.script, this.results.strategy);
      this.logger.success(`SEO score: ${this.results.seo.seoScore}/100`);
    } catch (error) {
      this.logger.error('SEO optimization failed:', error);
      this.results.errors.push({ stage: 'seo', error: error.message });
      throw error;
    }
  }

  async runProduction() {
    this.logger.info(chalk.cyan('Stage 5/6: Production'));
    try {
      this.results.production = await this.agents.production.processContent({
        strategy: this.results.strategy,
        script: this.results.script,
        thumbnail: this.results.thumbnail,
        seo: this.results.seo
      });
      this.logger.success(`Production complete: ${this.results.production.id}`);
    } catch (error) {
      this.logger.error('Production failed:', error);
      this.results.errors.push({ stage: 'production', error: error.message });
      throw error;
    }
  }

  async runPublishing() {
    this.logger.info(chalk.cyan('Stage 6/6: Scheduling'));
    try {
      await this.agents.publishing.scheduleContent(this.results.production);
      this.results.scheduled = true;
      this.logger.success('Content scheduled for publishing');
    } catch (error) {
      this.logger.error('Scheduling failed:', error);
      this.results.errors.push({ stage: 'publishing', error: error.message });
      throw error;
    }
  }

  getReport() {
    return {
      success: this.results.errors.length === 0,
      contentId: this.results.production?.id || null,
      title: this.results.script?.title || null,
      topic: this.results.strategy?.topic || null,
      seoScore: this.results.seo?.seoScore || null,
      scheduledPublishTime: this.results.production?.scheduledPublishTime || null,
      scheduled: this.results.scheduled,
      errors: this.results.errors,
      summary: {
        strategy: this.results.strategy?.topic,
        script: this.results.script?.title,
        thumbnail: this.results.thumbnail?.path || 'generated',
        seo: this.results.seo?.seoScore,
        production: this.results.production?.id,
        publishing: this.results.scheduled ? 'scheduled' : 'skipped'
      }
    };
  }

  async cleanup() {
    if (this.db) {
      await this.db.close();
    }
  }
}

async function main() {
  const topic = process.argv[2] || null;
  const pipeline = new DailyContentPipeline();

  try {
    await pipeline.initialize();
    const report = await pipeline.run(topic);

    console.log(chalk.green.bold('\n=== Pipeline Report ==='));
    console.log(JSON.stringify(report, null, 2));

    if (report.errors.length > 0) {
      console.log(chalk.yellow(`\nCompleted with ${report.errors.length} error(s)`));
      process.exit(1);
    }
  } catch (error) {
    console.error(chalk.red('Pipeline failed:'), error.message);
    process.exit(1);
  } finally {
    await pipeline.cleanup();
  }
}

if (require.main === module) {
  main();
}

module.exports = { DailyContentPipeline };

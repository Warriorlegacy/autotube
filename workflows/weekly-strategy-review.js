const { Logger } = require('../utils/logger');
const { Database } = require('../database/db');
const { AnalyticsOptimizationAgent } = require('../agents/analytics-optimization-agent');
const { ContentStrategyAgent } = require('../agents/content-strategy-agent');
const { PublishingSchedulingAgent } = require('../agents/publishing-scheduling-agent');
const chalk = require('chalk');

class WeeklyStrategyReview {
  constructor(credentials = null) {
    this.logger = new Logger('WeeklyReview');
    this.db = null;
    this.credentials = credentials;
    this.analytics = null;
    this.strategy = null;
    this.publishing = null;
  }

  async initialize() {
    this.logger.info('Initializing Weekly Strategy Review...');

    this.db = new Database();
    await this.db.initialize();

    if (!this.credentials) {
      const { CredentialManager } = require('../utils/credential-manager');
      this.credentials = new CredentialManager();
      await this.credentials.initialize();
    }

    this.analytics = new AnalyticsOptimizationAgent(this.db, this.credentials);
    this.strategy = new ContentStrategyAgent(this.db, this.credentials);
    this.publishing = new PublishingSchedulingAgent(this.db, this.credentials);

    await this.analytics.initialize();
    await this.strategy.initialize();
    await this.publishing.initialize();

    this.logger.success('Weekly Strategy Review ready');
    return true;
  }

  async run() {
    const startTime = Date.now();
    this.logger.info(chalk.cyan.bold('Starting Weekly Strategy Review...'));

    try {
      // Step 1: Collect and analyze weekly performance
      const performanceReport = await this.analyzeWeeklyPerformance();

      // Step 2: Identify top and bottom performers
      const performerAnalysis = await this.analyzePerformers(performanceReport);

      // Step 3: Update keyword strategy
      const keywordInsights = await this.updateKeywordStrategy();

      // Step 4: Optimize publishing schedule
      const scheduleOptimization = await this.optimizeSchedule();

      // Step 5: Generate strategic recommendations
      const recommendations = await this.generateRecommendations(
        performanceReport,
        performerAnalysis,
        keywordInsights
      );

      // Step 6: Generate next week's content plan
      const contentPlan = await this.generateContentPlan(recommendations);

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      this.logger.success(chalk.green.bold(`Weekly review completed in ${elapsed}s`));

      return this.getReport({
        performanceReport,
        performerAnalysis,
        keywordInsights,
        scheduleOptimization,
        recommendations,
        contentPlan
      });
    } catch (error) {
      this.logger.error('Weekly review failed:', error);
      throw error;
    }
  }

  async analyzeWeeklyPerformance() {
    this.logger.info(chalk.cyan('Analyzing weekly performance...'));

    const recentAnalytics = await this.analytics.getRecentAnalytics(7);

    const report = {
      totalVideos: recentAnalytics.length || 0,
      averagePerformanceScore: 0,
      topPerformers: [],
      bottomPerformers: [],
      totalViews: 0,
      totalWatchTime: 0,
      averageEngagement: 0,
      channelGrowth: 0
    };

    if (!recentAnalytics || recentAnalytics.length === 0) {
      this.logger.warn('No analytics data found for the past week');
      return report;
    }

    // Calculate averages
    let totalScore = 0;
    let totalViews = 0;
    let totalWatchTime = 0;

    for (const video of recentAnalytics) {
      totalScore += video.performance?.score || 0;
      totalViews += video.analytics?.views || 0;
      totalWatchTime += video.analytics?.watchTime || 0;
    }

    report.averagePerformanceScore = Math.round(totalScore / recentAnalytics.length);
    report.totalViews = totalViews;
    report.totalWatchTime = totalWatchTime;

    // Sort by performance to find top/bottom
    const sorted = [...recentAnalytics].sort(
      (a, b) => (b.performance?.score || 0) - (a.performance?.score || 0)
    );

    report.topPerformers = sorted.slice(0, 3).map(v => ({
      title: v.videoDetails?.title || 'Unknown',
      views: v.analytics?.views || 0,
      score: v.performance?.score || 0,
      grade: v.performance?.grade || 'N/A'
    }));

    report.bottomPerformers = sorted.slice(-3).map(v => ({
      title: v.videoDetails?.title || 'Unknown',
      views: v.analytics?.views || 0,
      score: v.performance?.score || 0,
      grade: v.performance?.grade || 'N/A'
    }));

    this.logger.success(`Analyzed ${recentAnalytics.length} videos from the past week`);
    return report;
  }

  async analyzePerformers(performanceReport) {
    this.logger.info(chalk.cyan('Analyzing performer patterns...'));

    const analysis = {
      topTopics: [],
      topContentTypes: [],
      topFormats: [],
      engagementPatterns: [],
      improvements: []
    };

    // Analyze top performers for patterns
    for (const video of performanceReport.topPerformers) {
      const details = video;
      if (details.title) {
        const keywords = details.title.toLowerCase().split(/\s+/);
        analysis.topTopics.push(...keywords.filter(w => w.length > 4));
      }
    }

    // Count topic frequency
    const topicCounts = {};
    analysis.topTopics.forEach(topic => {
      topicCounts[topic] = (topicCounts[topic] || 0) + 1;
    });

    analysis.topTopics = Object.entries(topicCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([topic, count]) => ({ topic, count }));

    // Analyze bottom performers for improvement areas
    for (const video of performanceReport.bottomPerformers) {
      if (video.score < 50) {
        analysis.improvements.push({
          title: video.title,
          score: video.score,
          suggestion: 'Consider optimizing thumbnail, title, or SEO'
        });
      }
    }

    this.logger.success('Performer analysis complete');
    return analysis;
  }

  async updateKeywordStrategy() {
    this.logger.info(chalk.cyan('Updating keyword strategy...'));

    const keywordHistory = await this.db.getKeywordHistory();

    const insights = {
      trendingKeywords: [],
      underperformingKeywords: [],
      recommendations: []
    };

    if (keywordHistory && keywordHistory.length > 0) {
      // Find best performing keywords
      insights.trendingKeywords = keywordHistory
        .filter(k => k.performance_score > 50)
        .slice(0, 10)
        .map(k => ({
          keyword: k.keyword,
          score: k.performance_score,
          totalViews: k.total_views
        }));

      // Find underperforming keywords
      insights.underperformingKeywords = keywordHistory
        .filter(k => k.performance_score < 20 && k.total_uses > 2)
        .slice(0, 5)
        .map(k => ({
          keyword: k.keyword,
          score: k.performance_score,
          suggestion: 'Consider replacing with trending alternatives'
        }));
    }

    insights.recommendations = [
      'Focus on high-performing keywords from recent content',
      'Test new long-tail keywords in upcoming titles',
      'Include trending topics in video descriptions',
      'Update tags based on current search trends'
    ];

    this.logger.success('Keyword strategy updated');
    return insights;
  }

  async optimizeSchedule() {
    this.logger.info(chalk.cyan('Optimizing publishing schedule...'));

    try {
      await this.publishing.optimizePublishTimes();
    } catch (error) {
      this.logger.warn('Could not optimize publish times via API, using defaults');
    }

    const optimization = {
      recommendedTimes: [
        { day: 'Tuesday', time: '14:00', reason: 'Peak audience activity' },
        { day: 'Wednesday', time: '14:00', reason: 'Consistent engagement' },
        { day: 'Thursday', time: '15:00', reason: 'Pre-weekend engagement' },
        { day: 'Saturday', time: '10:00', reason: 'Weekend morning viewers' }
      ],
      frequencyRecommendation: 'Maintain current posting frequency',
      bufferStatus: 'Adequate content buffer for next 3 days'
    };

    this.logger.success('Schedule optimization complete');
    return optimization;
  }

  async generateRecommendations(performance, performers, keywords) {
    this.logger.info(chalk.cyan('Generating strategic recommendations...'));

    const recommendations = {
      contentStrategy: [],
      seoStrategy: [],
      thumbnailStrategy: [],
      engagementStrategy: [],
      priority: []
    };

    // Content strategy recommendations
    if (performance.averagePerformanceScore > 70) {
      recommendations.contentStrategy.push('Current content style is performing well - maintain consistency');
    } else if (performance.averagePerformanceScore < 50) {
      recommendations.contentStrategy.push('Content performance needs improvement - consider new formats');
    }

    if (performers.topTopics.length > 0) {
      recommendations.contentStrategy.push(
        `Focus on trending topics: ${performers.topTopics.map(t => t.topic).join(', ')}`
      );
    }

    // SEO recommendations
    recommendations.seoStrategy.push('Update video titles with power words and current year');
    recommendations.seoStrategy.push('Expand descriptions with timestamps and links');
    recommendations.seoStrategy.push('Research and add relevant long-tail keywords');

    // Thumbnail recommendations
    recommendations.thumbnailStrategy.push('A/B test thumbnail variations for top performers');
    recommendations.thumbnailStrategy.push('Use high-contrast colors and readable text');
    recommendations.thumbnailStrategy.push('Include faces or expressive elements when possible');

    // Engagement recommendations
    recommendations.engagementStrategy.push('Add clear CTAs at the beginning and end of videos');
    recommendations.engagementStrategy.push('Respond to comments within the first hour of publishing');
    recommendations.engagementStrategy.push('Use community posts to promote upcoming content');

    // Priority items
    if (performance.totalViews < 1000) {
      recommendations.priority.push({ item: 'Increase promotion efforts', urgency: 'high' });
    }
    if (performance.averagePerformanceScore < 60) {
      recommendations.priority.push({ item: 'Review and optimize top 3 underperforming videos', urgency: 'high' });
    }
    recommendations.priority.push({ item: 'Create content calendar for next 2 weeks', urgency: 'medium' });

    this.logger.success('Recommendations generated');
    return recommendations;
  }

  async generateContentPlan(recommendations) {
    this.logger.info(chalk.cyan('Generating content plan for next week...'));

    const contentTypes = ['Tutorial', 'Explainer', 'List', 'Review'];
    const plan = {
      weekStarting: new Date().toISOString(),
      plannedContent: [],
      totalPlanned: 7
    };

    for (let i = 0; i < plan.totalPlanned; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i + 1);

      plan.plannedContent.push({
        date: date.toISOString().split('T')[0],
        type: contentTypes[i % contentTypes.length],
        status: 'planned',
        notes: `Day ${i + 1} content`
      });
    }

    this.logger.success(`Content plan generated: ${plan.totalPlanned} videos planned`);
    return plan;
  }

  getReport(data) {
    return {
      timestamp: new Date().toISOString(),
      performance: {
        averageScore: data.performanceReport.averagePerformanceScore,
        totalViews: data.performanceReport.totalViews,
        totalVideos: data.performanceReport.totalVideos,
        topPerformer: data.performanceReport.topPerformers[0] || null
      },
      insights: {
        topTopics: data.performerAnalysis.topTopics,
        keywordTrends: data.keywordInsights.trendingKeywords.slice(0, 5),
        improvements: data.performerAnalysis.improvements
      },
      schedule: data.scheduleOptimization,
      recommendations: data.recommendations,
      contentPlan: data.contentPlan,
      summary: [
        `Analyzed ${data.performanceReport.totalVideos} videos from this week`,
        `Average performance score: ${data.performanceReport.averagePerformanceScore}/100`,
        `Top topics: ${data.performerAnalysis.topTopics.map(t => t.topic).join(', ') || 'N/A'}`,
        `Content plan: ${data.contentPlan.totalPlanned} videos for next week`
      ]
    };
  }

  async cleanup() {
    if (this.db) {
      await this.db.close();
    }
  }
}

async function main() {
  const review = new WeeklyStrategyReview();

  try {
    await review.initialize();
    const report = await review.run();

    console.log(chalk.green.bold('\n=== Weekly Strategy Review Report ==='));
    console.log(JSON.stringify(report, null, 2));

    console.log(chalk.cyan.bold('\n=== Summary ==='));
    report.summary.forEach(item => console.log(chalk.white(`  - ${item}`)));
  } catch (error) {
    console.error(chalk.red('Weekly review failed:'), error.message);
    process.exit(1);
  } finally {
    await review.cleanup();
  }
}

if (require.main === module) {
  main();
}

module.exports = { WeeklyStrategyReview };

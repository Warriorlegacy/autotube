const { Database } = require('./db');
const chalk = require('chalk');

async function initializeDatabase() {
  console.log(chalk.cyan.bold('Initializing YouTube Automation Database...'));

  const db = new Database();

  try {
    await db.initialize();
    console.log(chalk.green('Database initialized successfully'));

    const stats = await db.getStats();
    console.log(chalk.white('\nDatabase Statistics:'));
    console.log(chalk.gray('  Strategies: ') + chalk.yellow(stats.strategies));
    console.log(chalk.gray('  Scripts:     ') + chalk.yellow(stats.scripts));
    console.log(chalk.gray('  Productions: ') + chalk.yellow(stats.productions));
    console.log(chalk.gray('  Published:   ') + chalk.yellow(stats.published));
    console.log(chalk.gray('  Analytics:   ') + chalk.yellow(stats.analytics));
    console.log(chalk.gray('  Size:        ') + chalk.yellow(stats.dbSize));

    const settings = await db.getAllSettings();
    console.log(chalk.white('\nDefault Settings:'));
    for (const [key, value] of Object.entries(settings)) {
      console.log(chalk.gray(`  ${key}: `) + chalk.yellow(value));
    }

    console.log(chalk.green.bold('\nDatabase ready for use'));
  } catch (error) {
    console.error(chalk.red('Failed to initialize database:'), error.message);
    process.exit(1);
  } finally {
    await db.close();
  }
}

if (require.main === module) {
  initializeDatabase();
}

module.exports = { initializeDatabase };

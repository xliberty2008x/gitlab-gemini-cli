#!/usr/bin/env node

/**
 * GitLab Gemini CLI - Command Line Interface
 *
 * This CLI tool installs and configures automated AI-powered code review
 * for GitLab projects using Google's Gemini and Model Context Protocol.
 */

const { Command } = require('commander');
const chalk = require('chalk');
const { install } = require('../lib/installer');
const package = require('../package.json');

const program = new Command();

program
  .name('gitlab-gemini-cli')
  .description('Install automated AI-powered code review for GitLab projects')
  .version(package.version);

program
  .command('init')
  .description('Initialize GitLab Gemini CLI in your project')
  .option('-y, --yes', 'Skip prompts and use defaults')
  .option('--gitlab-url <url>', 'GitLab instance URL (e.g., https://gitlab.com)')
  .option('--force', 'Overwrite existing files without prompting')
  .action(async (options) => {
    try {
      console.log(chalk.bold.cyan('\n🤖 GitLab Gemini CLI Setup\n'));

      await install(options);

      console.log(chalk.bold.green('\n✅ Setup complete!\n'));
      console.log(chalk.bold('Next steps:'));
      console.log('1. Set CI/CD variables in GitLab:');
      console.log(chalk.yellow('   → GEMINI_API_KEY'));
      console.log(chalk.yellow('   → GITLAB_REVIEW_PAT'));
      console.log('2. Commit and push:');
      console.log(chalk.gray('   git add .gitlab-ci.yml .gitlab/ gitlab-mcp-server.js package.json'));
      console.log(chalk.gray('   git commit -m "Add Gemini AI code review"'));
      console.log(chalk.gray('   git push'));
      console.log('');
    } catch (error) {
      console.error(chalk.red('\n❌ Error:'), error.message);
      process.exit(1);
    }
  });

program
  .command('validate')
  .description('Validate GitLab connection and credentials')
  .option('--gitlab-url <url>', 'GitLab instance URL')
  .option('--token <token>', 'GitLab Personal Access Token')
  .action(async (options) => {
    try {
      const { validateGitLab } = require('../lib/validator');

      console.log(chalk.bold.cyan('\n🔍 Validating GitLab connection...\n'));

      const result = await validateGitLab(options.gitlabUrl, options.token);

      if (result.success) {
        console.log(chalk.green('✅ Connection successful!'));
        console.log(chalk.gray(`   GitLab version: ${result.version}`));
        console.log(chalk.gray(`   API endpoint: ${result.apiUrl}`));
      } else {
        console.log(chalk.red('❌ Connection failed:'), result.error);
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('\n❌ Error:'), error.message);
      process.exit(1);
    }
  });

program
  .command('update')
  .description('Update GitLab Gemini CLI configuration to latest version')
  .option('--gitlab-url <url>', 'Update GitLab instance URL')
  .action(async (options) => {
    try {
      const { update } = require('../lib/installer');

      console.log(chalk.bold.cyan('\n🔄 Updating GitLab Gemini CLI...\n'));

      await update(options);

      console.log(chalk.bold.green('\n✅ Update complete!\n'));
    } catch (error) {
      console.error(chalk.red('\n❌ Error:'), error.message);
      process.exit(1);
    }
  });

program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}

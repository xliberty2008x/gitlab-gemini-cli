/**
 * GitLab Gemini CLI Installer
 *
 * Handles installation, configuration, and updates of GitLab Gemini CLI
 */

const fs = require('fs').promises;
const path = require('path');
const prompts = require('prompts');
const chalk = require('chalk');
const { validateGitLab } = require('./validator');

const CONFIG_FILE = '.gitlab-gemini-cli.json';

/**
 * Get the target project directory (where user runs the command)
 */
function getProjectRoot() {
  return process.cwd();
}

/**
 * Get the templates directory from this package
 */
function getTemplatesDir() {
  return path.join(__dirname, 'templates');
}

/**
 * Check if a file exists
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Load existing configuration
 */
async function loadConfig(projectRoot) {
  const configPath = path.join(projectRoot, CONFIG_FILE);
  if (await fileExists(configPath)) {
    const content = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(content);
  }
  return null;
}

/**
 * Save configuration
 */
async function saveConfig(projectRoot, config) {
  const configPath = path.join(projectRoot, CONFIG_FILE);
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * Prompt for GitLab instance configuration
 */
async function promptForGitLabConfig(options) {
  // If URL provided via CLI option, use it
  if (options.gitlabUrl) {
    return { gitlabUrl: options.gitlabUrl };
  }

  // If --yes flag, use default
  if (options.yes) {
    return { gitlabUrl: 'https://gitlab.com/api/v4' };
  }

  // Interactive prompts
  const response = await prompts([
    {
      type: 'select',
      name: 'instanceType',
      message: 'Select your GitLab instance type:',
      choices: [
        { title: 'gitlab.com (https://gitlab.com)', value: 'gitlab.com' },
        { title: 'Self-hosted GitLab', value: 'self-hosted' },
        { title: 'Custom URL', value: 'custom' }
      ],
      initial: 0
    },
    {
      type: (prev) => prev === 'self-hosted' || prev === 'custom' ? 'text' : null,
      name: 'customUrl',
      message: 'Enter your GitLab instance URL:',
      initial: 'https://gitlab.example.com',
      validate: (value) => {
        if (!value.startsWith('http://') && !value.startsWith('https://')) {
          return 'URL must start with http:// or https://';
        }
        return true;
      }
    }
  ]);

  if (!response.instanceType) {
    throw new Error('Installation cancelled');
  }

  let gitlabUrl;
  if (response.instanceType === 'gitlab.com') {
    gitlabUrl = 'https://gitlab.com/api/v4';
  } else {
    const baseUrl = response.customUrl.replace(/\/$/, ''); // Remove trailing slash
    gitlabUrl = `${baseUrl}/api/v4`;
  }

  return { gitlabUrl };
}

/**
 * Replace template variables in file content
 */
function replaceTemplateVariables(content, variables) {
  let result = content;
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = new RegExp(`https://gitlab\\.example\\.com/api/v4`, 'g');
    result = result.replace(placeholder, value);
  }
  return result;
}

/**
 * Copy and process template file
 */
async function copyTemplate(templatePath, targetPath, variables) {
  const content = await fs.readFile(templatePath, 'utf-8');
  const processed = replaceTemplateVariables(content, variables);
  await fs.writeFile(targetPath, processed, 'utf-8');
}

/**
 * Recursively copy a directory (no templating)
 */
async function copyDirectory(sourceDir, targetDir) {
  await fs.mkdir(targetDir, { recursive: true });
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(sourceDir, entry.name);
    const destPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath);
    } else if (entry.isFile()) {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

/**
 * Check if .gitlab-ci.yml exists and needs merging
 */
async function handleExistingCIFile(projectRoot, options) {
  const targetPath = path.join(projectRoot, '.gitlab-ci.yml');

  if (!(await fileExists(targetPath))) {
    return 'create'; // No existing file, create new one
  }

  // If force flag, always overwrite
  if (options.force) {
    return 'overwrite';
  }

  // If --yes flag, skip (preserve existing)
  if (options.yes) {
    console.log(chalk.yellow('ℹ️  Existing .gitlab-ci.yml found. Skipping (use --force to overwrite).'));
    return 'skip';
  }

  // Interactive prompt
  const response = await prompts({
    type: 'select',
    name: 'action',
    message: 'Found existing .gitlab-ci.yml. What would you like to do?',
    choices: [
      { title: 'Skip (keep existing, I\'ll merge manually)', value: 'skip' },
      { title: 'Overwrite (replace with new router file)', value: 'overwrite' },
      { title: 'Cancel installation', value: 'cancel' }
    ],
    initial: 0
  });

  if (response.action === 'cancel') {
    throw new Error('Installation cancelled');
  }

  return response.action;
}

/**
 * Install GitLab Gemini CLI
 */
async function install(options = {}) {
  const projectRoot = getProjectRoot();
  const templatesDir = getTemplatesDir();

  console.log(chalk.gray(`Project root: ${projectRoot}`));
  console.log('');

  // Step 1: Prompt for GitLab configuration
  const config = await promptForGitLabConfig(options);
  console.log(chalk.green(`✓ GitLab URL: ${config.gitlabUrl}`));
  console.log('');

  // Step 2: Validate connection (optional, can be skipped with --yes)
  if (!options.yes && !options.skipValidation) {
    const validateResponse = await prompts({
      type: 'confirm',
      name: 'validate',
      message: 'Validate GitLab connection? (requires GITLAB_REVIEW_PAT env var)',
      initial: false
    });

    if (validateResponse.validate) {
      const token = process.env.GITLAB_REVIEW_PAT;
      if (!token) {
        console.log(chalk.yellow('⚠️  GITLAB_REVIEW_PAT not set. Skipping validation.'));
      } else {
        console.log(chalk.gray('Validating connection...'));
        const result = await validateGitLab(config.gitlabUrl, token);
        if (result.success) {
          console.log(chalk.green('✓ Connection successful!'));
        } else {
          console.log(chalk.red('✗ Connection failed:'), result.error);
          const continueResponse = await prompts({
            type: 'confirm',
            name: 'continue',
            message: 'Continue anyway?',
            initial: false
          });
          if (!continueResponse.continue) {
            throw new Error('Installation cancelled');
          }
        }
      }
      console.log('');
    }
  }

  // Step 3: Handle .gitlab-ci.yml
  const ciAction = await handleExistingCIFile(projectRoot, options);

  if (ciAction === 'create' || ciAction === 'overwrite') {
    const routerContent = `# GitLab CI/CD Router Configuration
# This file includes modular workflow files from .gitlab/ directory

# Global stages definition
stages:
  - dispatch    # Manual invocations
  - review      # Merge request reviews
  - triage      # Issue triage workflows

# Include workflow files
include:
  - local: '.gitlab/merge-request-review.yml'
  - local: '.gitlab/issue-triage.yml'
  - local: '.gitlab/manual-invoke.yml'
`;
    await fs.writeFile(path.join(projectRoot, '.gitlab-ci.yml'), routerContent, 'utf-8');
    console.log(chalk.green('✓ Created .gitlab-ci.yml'));
  } else if (ciAction === 'skip') {
    console.log(chalk.gray('→ Skipped .gitlab-ci.yml (existing file preserved)'));
  }

  // Step 4: Copy .gitlab/ directory
  const gitlabDir = path.join(projectRoot, '.gitlab');
  await fs.mkdir(gitlabDir, { recursive: true });

  const workflowFiles = ['merge-request-review.yml', 'issue-triage.yml', 'manual-invoke.yml'];
  for (const file of workflowFiles) {
    const templatePath = path.join(templatesDir, '.gitlab', file);
    const targetPath = path.join(gitlabDir, file);
    await copyTemplate(templatePath, targetPath, { gitlabUrl: config.gitlabUrl });
  }
  console.log(chalk.green('✓ Created .gitlab/ directory with workflow files'));

  // Step 5: Copy gitlab-mcp-server.js
  const serverTemplatePath = path.join(templatesDir, 'gitlab-mcp-server.js');
  const serverTargetPath = path.join(projectRoot, 'gitlab-mcp-server.js');
  await copyTemplate(serverTemplatePath, serverTargetPath, { gitlabUrl: config.gitlabUrl });
  console.log(chalk.green('✓ Created gitlab-mcp-server.js'));

  // Step 6: Copy skills directory
  const skillsTemplateDir = path.join(templatesDir, '.skils');
  const skillsTargetDir = path.join(projectRoot, '.skils');
  await copyDirectory(skillsTemplateDir, skillsTargetDir);
  console.log(chalk.green('✓ Installed .skils/gitlab-mr-reviewer skill bundle'));

  // Step 7: Update package.json dependencies
  const packageJsonPath = path.join(projectRoot, 'package.json');
  let packageJson;

  if (await fileExists(packageJsonPath)) {
    const content = await fs.readFile(packageJsonPath, 'utf-8');
    packageJson = JSON.parse(content);
  } else {
    packageJson = {
      name: path.basename(projectRoot),
      version: '1.0.0',
      private: true
    };
  }

  // Add dependencies
  if (!packageJson.dependencies) {
    packageJson.dependencies = {};
  }
  packageJson.dependencies['@modelcontextprotocol/sdk'] = '^0.4.0';
  packageJson.dependencies['node-fetch'] = '^2.6.11';

  // Add scripts
  if (!packageJson.scripts) {
    packageJson.scripts = {};
  }
  packageJson.scripts['mcp:serve'] = 'node gitlab-mcp-server.js';

  await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf-8');
  console.log(chalk.green('✓ Updated package.json'));

  // Step 8: Save configuration
  await saveConfig(projectRoot, {
    version: require('../package.json').version,
    gitlabUrl: config.gitlabUrl,
    installedAt: new Date().toISOString()
  });
  console.log(chalk.green('✓ Saved configuration'));

  // Step 9: Install npm dependencies
  console.log('');
  console.log(chalk.gray('Installing npm dependencies...'));
  const { execSync } = require('child_process');
  try {
    execSync('npm install', { cwd: projectRoot, stdio: 'inherit' });
  } catch (error) {
    console.log(chalk.yellow('⚠️  npm install failed. Please run it manually.'));
  }
}

/**
 * Update existing installation
 */
async function update(options = {}) {
  const projectRoot = getProjectRoot();
  const config = await loadConfig(projectRoot);

  if (!config) {
    throw new Error('No existing installation found. Run "gitlab-gemini-cli init" first.');
  }

  console.log(chalk.gray(`Current version: ${config.version}`));
  console.log(chalk.gray(`Current GitLab URL: ${config.gitlabUrl}`));
  console.log('');

  // Allow updating GitLab URL
  let newGitlabUrl = config.gitlabUrl;
  if (options.gitlabUrl) {
    newGitlabUrl = options.gitlabUrl;
    console.log(chalk.green(`✓ Updated GitLab URL: ${newGitlabUrl}`));
  }

  // Re-install with new configuration
  await install({ ...options, gitlabUrl: newGitlabUrl, force: true, skipValidation: true });

  console.log(chalk.green(`✓ Updated to version ${require('../package.json').version}`));
}

module.exports = {
  install,
  update
};

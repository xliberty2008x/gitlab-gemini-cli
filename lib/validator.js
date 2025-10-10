/**
 * GitLab Connection Validator
 *
 * Validates GitLab API connectivity and credentials
 */

const fetch = require('node-fetch');

/**
 * Validate GitLab instance connectivity and token
 *
 * @param {string} gitlabUrl - GitLab API URL (e.g., https://gitlab.com/api/v4)
 * @param {string} token - GitLab Personal Access Token
 * @returns {Promise<{success: boolean, version?: string, apiUrl?: string, error?: string}>}
 */
async function validateGitLab(gitlabUrl, token) {
  try {
    // Ensure URL ends with /api/v4
    const apiUrl = gitlabUrl.endsWith('/api/v4') ? gitlabUrl : `${gitlabUrl}/api/v4`;

    // Test connection by fetching version info
    const response = await fetch(`${apiUrl}/version`, {
      headers: {
        'PRIVATE-TOKEN': token
      },
      timeout: 10000 // 10 second timeout
    });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

      // Try to get more detailed error
      try {
        const errorData = await response.json();
        if (errorData.message) {
          errorMessage = errorData.message;
        }
      } catch {
        // Ignore JSON parsing errors
      }

      return {
        success: false,
        error: errorMessage
      };
    }

    const data = await response.json();

    return {
      success: true,
      version: data.version,
      apiUrl: apiUrl
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Connection failed'
    };
  }
}

/**
 * Validate GitLab URL format
 *
 * @param {string} url - URL to validate
 * @returns {boolean}
 */
function isValidGitLabUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

module.exports = {
  validateGitLab,
  isValidGitLabUrl
};

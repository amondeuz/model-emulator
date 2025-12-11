/**
 * Configuration loader and manager
 * Handles loading, reloading, and updating the configuration file
 */

const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', 'config', 'default.json');
const MODELS_PATH = path.join(__dirname, '..', 'config', 'models.json');

let cachedConfig = null;
let cachedModels = null;
let configMtime = null;

/**
 * Load configuration from file
 * Supports hot-reloading by checking file modification time
 */
function loadConfig(forceReload = false) {
  try {
    if (!forceReload && cachedConfig) {
      // Check if file has been modified
      const stats = fs.statSync(CONFIG_PATH);
      if (configMtime && stats.mtime.getTime() === configMtime) {
        return cachedConfig;
      }
      configMtime = stats.mtime.getTime();
    }

    const configData = fs.readFileSync(CONFIG_PATH, 'utf8');
    cachedConfig = JSON.parse(configData);

    // Set modification time
    const stats = fs.statSync(CONFIG_PATH);
    configMtime = stats.mtime.getTime();

    return cachedConfig;
  } catch (error) {
    console.error('Error loading config:', error);
    // Return default config if file doesn't exist or is invalid
    return {
      port: 11434,
      backend: 'puter',
      puterModel: 'gpt-5-nano',
      spoofedOpenAIModelId: 'gpt-4o-mini',
      enabled: true,
      logging: {
        enabled: true,
        logRequests: true,
        logErrors: true
      }
    };
  }
}

/**
 * Load model registry from file
 */
function loadModels() {
  try {
    if (cachedModels) {
      return cachedModels;
    }

    const modelsData = fs.readFileSync(MODELS_PATH, 'utf8');
    cachedModels = JSON.parse(modelsData);
    return cachedModels;
  } catch (error) {
    console.error('Error loading models registry:', error);
    return { models: [], commonSpoofedModels: [] };
  }
}

/**
 * Save configuration to file
 */
function saveConfig(config) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
    cachedConfig = config;

    // Update modification time
    const stats = fs.statSync(CONFIG_PATH);
    configMtime = stats.mtime.getTime();

    return true;
  } catch (error) {
    console.error('Error saving config:', error);
    return false;
  }
}

/**
 * Get current configuration (with hot-reload support)
 */
function getConfig() {
  return loadConfig();
}

/**
 * Update configuration
 */
function updateConfig(updates) {
  const currentConfig = loadConfig(true);
  const newConfig = { ...currentConfig, ...updates };
  return saveConfig(newConfig);
}

module.exports = {
  loadConfig,
  loadModels,
  saveConfig,
  getConfig,
  updateConfig,
  CONFIG_PATH,
  MODELS_PATH
};

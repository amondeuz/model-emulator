/**
 * Configuration loader and manager
 * Handles loading, reloading, and updating configuration files
 * Manages models cache, saved configs, and emulator state
 */

const fs = require('fs');
const path = require('path');

// File paths
const CONFIG_PATH = path.join(__dirname, '..', 'config', 'default.json');
const MODELS_CACHE_PATH = path.join(__dirname, '..', 'config', 'models-cache.json');
const SAVED_CONFIGS_PATH = path.join(__dirname, '..', 'config', 'saved-configs.json');

// In-memory cache
let cachedConfig = null;
let cachedModels = null;
let cachedSavedConfigs = null;
let configMtime = null;
let emulatorActive = false;

/**
 * Generate a simple unique ID
 */
function generateId() {
  return `cfg-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

// ============================================================================
// MAIN CONFIGURATION
// ============================================================================

/**
 * Load configuration from file
 */
function loadConfig(forceReload = false) {
  try {
    if (!forceReload && cachedConfig) {
      const stats = fs.statSync(CONFIG_PATH);
      if (configMtime && stats.mtime.getTime() === configMtime) {
        return cachedConfig;
      }
      configMtime = stats.mtime.getTime();
    }

    const configData = fs.readFileSync(CONFIG_PATH, 'utf8');
    cachedConfig = JSON.parse(configData);

    const stats = fs.statSync(CONFIG_PATH);
    configMtime = stats.mtime.getTime();

    return cachedConfig;
  } catch (error) {
    console.error('Error loading config:', error);
    return {
      port: 11434,
      backend: 'puter',
      puterModel: 'gpt-4o',
      spoofedOpenAIModelId: 'gpt-4o-mini',
      enabled: true,
      emulatorActive: false,
      lastConfig: null,
      logging: {
        enabled: true,
        logRequests: true,
        logErrors: true
      }
    };
  }
}

/**
 * Save configuration to file
 */
function saveConfig(config) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
    cachedConfig = config;
    const stats = fs.statSync(CONFIG_PATH);
    configMtime = stats.mtime.getTime();
    return true;
  } catch (error) {
    console.error('Error saving config:', error);
    return false;
  }
}

/**
 * Get current configuration
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

// ============================================================================
// EMULATOR STATE
// ============================================================================

/**
 * Check if emulator is active
 */
function isEmulatorActive() {
  return emulatorActive;
}

/**
 * Set emulator active state
 */
function setEmulatorActive(active) {
  emulatorActive = active;
  // Also persist to config
  updateConfig({ emulatorActive: active });
  return active;
}

/**
 * Start the emulator with given configuration
 */
function startEmulator(puterModelId, spoofedOpenAIModelId) {
  const success = updateConfig({
    puterModel: puterModelId,
    spoofedOpenAIModelId: spoofedOpenAIModelId || '',
    emulatorActive: true,
    lastConfig: {
      puterModelId,
      spoofedOpenAIModelId: spoofedOpenAIModelId || ''
    }
  });

  if (success) {
    emulatorActive = true;
  }

  return success;
}

/**
 * Stop the emulator
 */
function stopEmulator() {
  const success = updateConfig({ emulatorActive: false });
  if (success) {
    emulatorActive = false;
  }
  return success;
}

// ============================================================================
// MODELS CACHE
// ============================================================================

/**
 * Load models from cache file
 */
function loadModelsCache() {
  try {
    if (fs.existsSync(MODELS_CACHE_PATH)) {
      const data = fs.readFileSync(MODELS_CACHE_PATH, 'utf8');
      const cache = JSON.parse(data);
      if (cache.models && Array.isArray(cache.models)) {
        cachedModels = cache;
        return cache;
      }
    }
  } catch (error) {
    console.error('Error loading models cache:', error);
  }

  return { models: [], lastUpdated: null };
}

/**
 * Save models to cache file
 */
function saveModelsCache(models) {
  try {
    const cache = {
      lastUpdated: Date.now(),
      models: models
    };
    fs.writeFileSync(MODELS_CACHE_PATH, JSON.stringify(cache, null, 2), 'utf8');
    cachedModels = cache;
    return true;
  } catch (error) {
    console.error('Error saving models cache:', error);
    return false;
  }
}

/**
 * Get cached models
 */
function getModelsCache() {
  if (cachedModels) {
    return cachedModels;
  }
  return loadModelsCache();
}

/**
 * Check if a model ID exists in the cache
 */
function modelExistsInCache(modelId) {
  const cache = getModelsCache();
  return cache.models.some(m => m.id === modelId);
}

// ============================================================================
// SAVED CONFIGURATIONS
// ============================================================================

/**
 * Load saved configurations from file
 */
function loadSavedConfigs() {
  try {
    if (fs.existsSync(SAVED_CONFIGS_PATH)) {
      const data = fs.readFileSync(SAVED_CONFIGS_PATH, 'utf8');
      const configs = JSON.parse(data);
      if (Array.isArray(configs)) {
        cachedSavedConfigs = configs;
        return configs;
      }
    }
  } catch (error) {
    console.error('Error loading saved configs:', error);
  }

  return [];
}

/**
 * Save configurations to file
 */
function saveSavedConfigs(configs) {
  try {
    fs.writeFileSync(SAVED_CONFIGS_PATH, JSON.stringify(configs, null, 2), 'utf8');
    cachedSavedConfigs = configs;
    return true;
  } catch (error) {
    console.error('Error saving saved configs:', error);
    return false;
  }
}

/**
 * Get all saved configurations
 */
function getSavedConfigs() {
  if (cachedSavedConfigs) {
    return cachedSavedConfigs;
  }
  return loadSavedConfigs();
}

/**
 * Add a new saved configuration
 */
function addSavedConfig(name, puterModelId, spoofedOpenAIModelId) {
  const configs = getSavedConfigs();
  const newConfig = {
    id: generateId(),
    name: name,
    puterModelId: puterModelId,
    spoofedOpenAIModelId: spoofedOpenAIModelId || ''
  };
  configs.push(newConfig);
  const success = saveSavedConfigs(configs);
  return success ? newConfig : null;
}

/**
 * Update a saved configuration's name
 */
function updateSavedConfigName(configId, newName) {
  const configs = getSavedConfigs();
  const config = configs.find(c => c.id === configId);
  if (!config) {
    return false;
  }
  config.name = newName;
  return saveSavedConfigs(configs);
}

/**
 * Delete a saved configuration
 */
function deleteSavedConfig(configId) {
  let configs = getSavedConfigs();
  const initialLength = configs.length;
  configs = configs.filter(c => c.id !== configId);
  if (configs.length === initialLength) {
    return false;
  }
  return saveSavedConfigs(configs);
}

/**
 * Get a saved configuration by ID
 */
function getSavedConfigById(configId) {
  const configs = getSavedConfigs();
  return configs.find(c => c.id === configId) || null;
}

// ============================================================================
// LAST USED CONFIGURATION
// ============================================================================

/**
 * Get the last used configuration
 */
function getLastConfig() {
  const config = getConfig();
  return config.lastConfig || null;
}

/**
 * Initialize emulator state from persisted config on startup
 */
function initEmulatorState() {
  const config = getConfig();
  emulatorActive = config.emulatorActive === true;
  return emulatorActive;
}

// Initialize on module load
initEmulatorState();

module.exports = {
  // Main config
  loadConfig,
  saveConfig,
  getConfig,
  updateConfig,
  CONFIG_PATH,

  // Emulator state
  isEmulatorActive,
  setEmulatorActive,
  startEmulator,
  stopEmulator,
  initEmulatorState,

  // Models cache
  loadModelsCache,
  saveModelsCache,
  getModelsCache,
  modelExistsInCache,
  MODELS_CACHE_PATH,

  // Saved configurations
  loadSavedConfigs,
  saveSavedConfigs,
  getSavedConfigs,
  addSavedConfig,
  updateSavedConfigName,
  deleteSavedConfig,
  getSavedConfigById,
  SAVED_CONFIGS_PATH,

  // Last config
  getLastConfig
};

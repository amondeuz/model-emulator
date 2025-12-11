/**
 * Configuration manager for the model emulator
 */

const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', 'config', 'default.json');
const MODELS_CACHE_PATH = path.join(__dirname, '..', 'config', 'models-cache.json');
const SAVED_CONFIGS_PATH = path.join(__dirname, '..', 'config', 'saved-configs.json');

let cachedConfig = null;
let cachedModels = null;
let cachedSavedConfigs = null;
let configMtime = null;
let emulatorActive = false;

function generateId() {
  return `cfg-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

// Main Configuration

function getConfig() {
  try {
    if (cachedConfig) {
      const stats = fs.statSync(CONFIG_PATH);
      if (configMtime && stats.mtime.getTime() === configMtime) {
        return cachedConfig;
      }
      configMtime = stats.mtime.getTime();
    }

    cachedConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    configMtime = fs.statSync(CONFIG_PATH).mtime.getTime();
    return cachedConfig;
  } catch (error) {
    return {
      port: 11434,
      backend: 'puter',
      puterModel: 'gpt-4o',
      spoofedOpenAIModelId: 'gpt-4o-mini',
      emulatorActive: false,
      lastConfig: null,
      logging: { enabled: true, logRequests: true, logErrors: true }
    };
  }
}

function updateConfig(updates) {
  const config = { ...getConfig(), ...updates };
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
    cachedConfig = config;
    configMtime = fs.statSync(CONFIG_PATH).mtime.getTime();
    return true;
  } catch (error) {
    return false;
  }
}

// Emulator State

function isEmulatorActive() {
  return emulatorActive;
}

function startEmulator(puterModelId, spoofedOpenAIModelId) {
  const success = updateConfig({
    puterModel: puterModelId,
    spoofedOpenAIModelId: spoofedOpenAIModelId || '',
    emulatorActive: true,
    lastConfig: { puterModelId, spoofedOpenAIModelId: spoofedOpenAIModelId || '' }
  });
  if (success) emulatorActive = true;
  return success;
}

function stopEmulator() {
  const success = updateConfig({ emulatorActive: false });
  if (success) emulatorActive = false;
  return success;
}

// Models Cache

function getModelsCache() {
  if (cachedModels) return cachedModels;
  try {
    if (fs.existsSync(MODELS_CACHE_PATH)) {
      const cache = JSON.parse(fs.readFileSync(MODELS_CACHE_PATH, 'utf8'));
      if (cache.models && Array.isArray(cache.models)) {
        cachedModels = cache;
        return cache;
      }
    }
  } catch (error) {}
  return { models: [], lastUpdated: null };
}

function saveModelsCache(models) {
  try {
    const cache = { lastUpdated: Date.now(), models };
    fs.writeFileSync(MODELS_CACHE_PATH, JSON.stringify(cache, null, 2), 'utf8');
    cachedModels = cache;
    return true;
  } catch (error) {
    return false;
  }
}

// Saved Configurations

function getSavedConfigs() {
  if (cachedSavedConfigs) return cachedSavedConfigs;
  try {
    if (fs.existsSync(SAVED_CONFIGS_PATH)) {
      const configs = JSON.parse(fs.readFileSync(SAVED_CONFIGS_PATH, 'utf8'));
      if (Array.isArray(configs)) {
        cachedSavedConfigs = configs;
        return configs;
      }
    }
  } catch (error) {}
  return [];
}

function saveSavedConfigs(configs) {
  try {
    fs.writeFileSync(SAVED_CONFIGS_PATH, JSON.stringify(configs, null, 2), 'utf8');
    cachedSavedConfigs = configs;
    return true;
  } catch (error) {
    return false;
  }
}

function addSavedConfig(name, puterModelId, spoofedOpenAIModelId) {
  const configs = getSavedConfigs();
  const newConfig = {
    id: generateId(),
    name,
    puterModelId,
    spoofedOpenAIModelId: spoofedOpenAIModelId || ''
  };
  configs.push(newConfig);
  return saveSavedConfigs(configs) ? newConfig : null;
}

function updateSavedConfigName(configId, newName) {
  const configs = getSavedConfigs();
  const config = configs.find(c => c.id === configId);
  if (!config) return false;
  config.name = newName;
  return saveSavedConfigs(configs);
}

function deleteSavedConfig(configId) {
  const configs = getSavedConfigs();
  const filtered = configs.filter(c => c.id !== configId);
  if (filtered.length === configs.length) return false;
  return saveSavedConfigs(filtered);
}

function getSavedConfigById(configId) {
  return getSavedConfigs().find(c => c.id === configId) || null;
}

function getLastConfig() {
  return getConfig().lastConfig || null;
}

// Initialize emulator state on module load
emulatorActive = getConfig().emulatorActive === true;

module.exports = {
  getConfig,
  updateConfig,
  isEmulatorActive,
  startEmulator,
  stopEmulator,
  getModelsCache,
  saveModelsCache,
  getSavedConfigs,
  addSavedConfig,
  updateSavedConfigName,
  deleteSavedConfig,
  getSavedConfigById,
  getLastConfig
};

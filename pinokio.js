const fs = require('fs');
const path = require('path');
const net = require('net');

const installScript = require('./install.json');
const startScript = require('./start.json');
const stopScript = require('./stop.json');
const updateScript = require('./update.json');
const healthScript = require('./health.json');

function getConfiguredPort() {
  try {
    const configPath = path.join(__dirname, 'config', 'default.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (config.port) return config.port;
    }
  } catch (error) {
    // ignore and fall back to default
  }

  return 11434;
}

function isInstalled() {
  return fs.existsSync(path.join(__dirname, 'node_modules'));
}

function isServerRunning(port = getConfiguredPort()) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host: '127.0.0.1' }, () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('error', () => resolve(false));
  });
}

module.exports = async function pinokio({}) {
  return {
    title: 'Puter Local Model Emulator',
    description: 'Local OpenAI-compatible endpoint backed by Puter AI.',
    icon: 'icon.png',
    entry: '/config.html',

    menu: [
      { html: "<i class='fa-solid fa-robot'></i> Emulator", route: '/config.html' },
      { html: "<i class='fa-solid fa-rotate'></i> Update", script: 'update' }
    ],

    scripts: {
      install: installScript,
      start: startScript,
      stop: stopScript,
      update: updateScript,
      health: healthScript
    },

    async installed() {
      return isInstalled();
    },

    async running() {
      return isServerRunning();
    },

    async launch({ run, route }) {
      if (!(await isInstalled())) {
        await run('install');
      }

      if (!(await isServerRunning())) {
        await run('start');
      }

      return route('/config.html');
    }
  };
};

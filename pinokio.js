const fs = require('fs');
const path = require('path');
const net = require('net');

function loadJsonScript(name) {
  const jsonPath = path.join(__dirname, `${name}.json`);
  if (!fs.existsSync(jsonPath)) return null;
  return JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
}

function getConfiguredPort() {
  try {
    const configPath = path.join(__dirname, 'config', 'default.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (config.port) return config.port;
    }
  } catch (error) {
    // fall through to default
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

module.exports = ({ menu, script }) => {
  const scriptFromFile = (name) => {
    if (script && typeof script.fromFile === 'function') {
      return script.fromFile(path.join(__dirname, `${name}.json`));
    }
    return loadJsonScript(name);
  };

  const installScript = scriptFromFile('install') || {
    run: [
      { method: 'log', params: { raw: 'Installing dependencies...' } },
      { method: 'shell.run', params: { message: 'npm install' } }
    ]
  };

  const startScript = scriptFromFile('start') || {
    daemon: true,
    run: [
      { method: 'log', params: { raw: 'Starting Puter Local Model Emulator...' } },
      { method: 'shell.run', params: { message: 'node server/index.js', venv: false } }
    ]
  };

  const stopScript = scriptFromFile('stop') || {
    run: [
      { method: 'shell.run', params: { message: "{{platform === 'win32' ? 'taskkill /F /IM node.exe' : 'pkill -f \"node server/index.js\"'}}" } },
      { method: 'log', params: { raw: 'Server stopped' } }
    ]
  };

  const updateScript = scriptFromFile('update') || {
    run: [
      { method: 'log', params: { raw: 'Checking for updates from GitHub...' } },
      { method: 'shell.run', params: { message: 'node update.js' } }
    ]
  };

  return menu.Launcher({
    title: 'Puter Local Model Emulator',
    description: 'Local OpenAI-compatible endpoint backed by Puter AI.',
    icon: 'icon.png',

    menu: () => [
      { html: "<i class='fa-solid fa-robot'></i> Emulator", route: '/config.html' },
      { html: "<i class='fa-solid fa-rotate'></i> Update", script: 'update' }
    ],

    scripts: {
      install: installScript,
      start: startScript,
      stop: stopScript,
      update: updateScript
    },

    state: {
      entry: '/config.html',
      installed: async () => isInstalled(),
      running: async () => isServerRunning(),
      async launch({ run, route }) {
        if (!(await isInstalled())) {
          await run('install');
        }

        if (!(await isServerRunning())) {
          await run('start');
        }

        return route('/config.html');
      }
    }
  });
};

const fs = require('fs');
const path = require('path');
const net = require('net');

function getConfiguredPort() {
  try {
    const configPath = path.join(__dirname, 'config', 'default.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (config.port) return config.port;
    }
  } catch (error) {}

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

module.exports = ({ menu, script }) => menu.Launcher({
  title: "Puter Local Model Emulator",
  description: "Local OpenAI-compatible endpoint backed by Puter AI.",
  icon: "icon.png",

  menu: () => [
    { html: "<i class='fa-solid fa-robot'></i> Emulator", route: "/config.html" },
    { html: "<i class='fa-solid fa-rotate'></i> Update", script: "update" }
  ],

  scripts: {
    install: {
      description: "Install dependencies",
      run: [
        { method: "log", params: { raw: "Installing dependencies..." } },
        { method: "shell.run", params: { message: "npm install" } }
      ]
    },
    start: {
      description: "Start emulator server",
      daemon: true,
      run: [
        { method: "log", params: { raw: "Starting Puter Local Model Emulator..." } },
        { method: "shell.run", params: { message: "node server/index.js", venv: false } }
      ]
    },
    stop: {
      description: "Stop emulator server",
      run: [
        { method: "shell.run", params: { message: "{{platform === 'win32' ? 'taskkill /F /IM node.exe' : 'pkill -f \"node server/index.js\"'}}" } },
        { method: "log", params: { raw: "Server stopped" } }
      ]
    },
    update: {
      description: "Update this app from git",
      run: [
        { method: "log", params: { raw: "Updating repository..." } },
        { method: "shell.run", params: { message: "git pull" } }
      ]
    }
  },

  state: {
    entry: "/config.html",
    installed: async () => isInstalled(),
    running: async () => isServerRunning(),
    async launch({ run, route }) {
      if (!isInstalled()) {
        await run('install');
      }

      if (!(await isServerRunning())) {
        await run('start');
      }

      return route('/config.html');
    }
  }
});

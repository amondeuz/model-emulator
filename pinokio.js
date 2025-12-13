const title = 'Puter Local Model Emulator';
const description = 'Local OpenAI-compatible endpoint backed by Puter AI.';
const icon = 'icon.png';

module.exports = {
  version: '2.0',
  title,
  description,
  icon,
  scripts: {
    install: require('./install.json'),
    start: require('./start.json'),
    stop: require('./stop.json'),
    update: require('./update.json'),
    health: require('./health.json'),
    config: require('./config.json'),
  },
  menu: [
    // Routes directly to the emulator UI served by the local server.
    { text: 'Emulator', icon: 'fa-solid fa-robot', route: '/config.html', default: true },
    // Manual update hook for fetching the latest code.
    { text: 'Update', icon: 'fa-solid fa-rotate', href: 'update.json' },
  ],
  // Installation detection relies on the presence of node_modules created by install.json.
  installed: async (kernel, info) => info.exists('node_modules'),
  // Server health is inferred from the start.json daemon process state.
  running: async (kernel, info) => info.running('start.json'),
  // On launch, ensure dependencies are installed and the server is running, then route to the UI.
  launch: async (kernel, info) => {
    const isInstalled = await module.exports.installed(kernel, info);
    if (!isInstalled) {
      await kernel.run('install');
    }

    const isRunning = await module.exports.running(kernel, info);
    if (!isRunning) {
      await kernel.run('start');
    }

    return { route: '/config.html' };
  },
};

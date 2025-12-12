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
  menu: async (kernel, info) => {
    const installed = await info.exists('node_modules');
    const running = installed ? await info.running('start.json') : false;

    if (!installed) {
      return [
        { text: 'Install', icon: 'fa-solid fa-download', href: 'install.json', default: true },
        { text: 'Update', icon: 'fa-solid fa-rotate', href: 'update.json' },
      ];
    }

    if (!running) {
      return [
        { text: 'Start', icon: 'fa-solid fa-play', href: 'start.json', default: true },
        { text: 'Update', icon: 'fa-solid fa-rotate', href: 'update.json' },
      ];
    }

    return [
      { text: 'Emulator', icon: 'fa-solid fa-robot', href: 'config.json', default: true },
      { text: 'Update', icon: 'fa-solid fa-rotate', href: 'update.json' },
    ];
  },
};

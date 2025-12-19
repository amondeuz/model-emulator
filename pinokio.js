const title = 'Virtual Model Emulator';
const description = 'OpenAI-compatible endpoint powered by LiteLLM. Supports 100+ AI providers.';
const icon = 'icon.png';

module.exports = {
  version: '4.0',
  title,
  description,
  icon,
  menu: async (kernel, info) => {
    const updateItem = { text: 'Update', icon: 'fa-solid fa-rotate', href: 'update.json' };

    const installing = info.running('install.json');
    if (installing) {
      return [
        { text: 'Loading...', icon: 'fa-solid fa-robot', href: 'install.json' },
        updateItem
      ];
    }

    // Check if dependencies are installed (requirements.txt exists means we should try to install/run)
    const installed = info.exists('requirements.txt');
    if (!installed) {
      return [
        { text: 'Loading...', icon: 'fa-solid fa-robot', href: 'install.json', default: true },
        updateItem
      ];
    }

    const starting = info.running('start.json');
    if (!starting) {
      return [
        { text: 'Starting...', icon: 'fa-solid fa-robot', href: 'start.json', default: true },
        updateItem
      ];
    }

    const mem = info.local('start.json');
    const url = mem && mem.url;

    if (!url) {
      return [
        { text: 'Starting...', icon: 'fa-solid fa-robot', href: 'start.json' },
        updateItem
      ];
    }

    return [
      { text: 'Emulator', icon: 'fa-solid fa-robot', href: url, default: true },
      updateItem
    ];
  }
};

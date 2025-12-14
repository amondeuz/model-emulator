const title = 'Puter Local Model Emulator';
const description = 'Local OpenAI-compatible endpoint backed by Puter AI.';
const icon = 'icon.png';

module.exports = {
  version: '4.0',
  title,
  description,
  icon,
  menu: async (kernel, info) => {
    const installed = await info.exists('node_modules');
    const installing = await info.running('install.json');
    const starting = await info.running('start.json');
    const localState = await info.local('start.json');
    const uiUrl = localState && localState.uiUrl;

    if (!installed) {
      if (installing) {
        return [{ text: 'Installing', href: 'install.json' }];
      }
      return [{ text: 'Install', href: 'install.json', default: true }];
    }

    if (!starting) {
      return [
        { text: 'Start', href: 'start.json', default: true },
        { text: 'Update', href: 'update.json' },
      ];
    }

    if (starting && !uiUrl) {
      return [{ text: 'Starting', href: 'start.json' }];
    }

    return [
      { text: 'Emulator UI', href: uiUrl },
      { text: 'Terminal', href: 'start.json' },
      { text: 'Stop', href: 'stop.json' },
      { text: 'Update', href: 'update.json' },
    ];
  },
};

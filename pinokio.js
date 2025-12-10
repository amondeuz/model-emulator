/**
 * Pinokio app definition for Puter Local Model Emulator
 *
 * This app provides a local OpenAI-compatible endpoint backed by Puter AI,
 * allowing any Pinokio tool to use Puter models as if they were local models.
 */

module.exports = {
  // App metadata
  title: "Puter Local Model Emulator",
  description: "Local OpenAI-compatible endpoint backed by Puter AI. Use 500+ AI models through a local HTTP server that any Pinokio app can connect to.",

  // Icon (placeholder - add icon.png to the root directory)
  icon: "icon.png",

  // Menu items for Pinokio UI
  menu: [
    {
      html: "<i class='fa-solid fa-download'></i> Install",
      href: "install.json",
      description: "Install dependencies (npm install)"
    },
    {
      html: "<i class='fa-solid fa-play'></i> Start Server",
      href: "start.json",
      description: "Start the local model emulator server"
    },
    {
      html: "<i class='fa-solid fa-gear'></i> Configure",
      href: "config.json",
      description: "Open configuration UI in browser"
    },
    {
      html: "<i class='fa-solid fa-heart-pulse'></i> Health Check",
      href: "health.json",
      description: "Check server health and status"
    },
    {
      html: "<i class='fa-solid fa-stop'></i> Stop Server",
      href: "stop.json",
      description: "Stop the running server"
    }
  ]
};

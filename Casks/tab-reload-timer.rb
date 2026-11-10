cask "tab-reload-timer" do
  version "1.0.0"
  sha256 "7ee21862afb972757a1a9ceb4959b1a1daee153f02190f0437e23806366875ea"

  url "https://github.com/hejackson2/safari-tab-reload-timer/releases/download/v#{version}/Tab-Reload-Timer-#{version}.zip"
  name "Tab Reload Timer"
  desc "Free, open-source Safari extension for automatically reloading individual tabs"
  homepage "https://github.com/hejackson2/safari-tab-reload-timer"

  depends_on arch: :arm64
  depends_on macos: :golden_gate

  app "Tab Reload Timer.app"

  caveats <<~EOS
    Requires macOS 27.2 or newer. Homebrew's dependency check covers macOS 27
    at the major-version level; macOS 27.0 and 27.1 cannot run this app.
    This app is ad-hoc signed, not Developer ID signed or notarized.
    Open Tab Reload Timer, then enable Allow Unsigned Extensions in Safari's
    Develop menu and enable Tab Reload Timer in Safari Settings > Extensions.
    Safari resets Allow Unsigned Extensions when it quits.
    macOS may require approval in System Settings > Privacy & Security to open
    the downloaded app. Only approve a download you trust.
  EOS
end

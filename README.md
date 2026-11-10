# Tab Reload Timer for Safari

A free, open-source macOS Safari Web Extension that automatically reloads individual tabs at an interval you choose.

## Why I built this

I built Tab Reload Timer to provide a **free, open-source option** for automatically reloading Safari tabs. Anyone can inspect the code, build it locally, and contribute improvements. There is no subscription or paid feature tier.

## Features

- Independent timers for each tab, from **60 seconds to 24 hours**.
- Start, update, or stop a timer from the toolbar popup.
- An **ON** badge indicates an active timer.
- Uses Safari's alarms API; no continuously running background page.
- Skips scheduled reloads while a page is already loading.
- Clears timers when tabs close or Safari restarts.
- Works on HTTP and HTTPS pages.
- Custom Safari extension and macOS Dock/Finder icons.

**Warning:** Reloading can discard unsaved edits or interrupt work. A timer continues when you navigate the same tab to another HTTP/HTTPS page. Sleep and Safari scheduling can delay alarms. Timers do not survive a Safari restart.

## Requirements and compatibility

- macOS and Safari with Safari Web Extension / Manifest V3 support.
- Full Xcode for building the containing macOS app. Command Line Tools alone do not include the Safari extension converter.
- Node.js for the optional automated tests (no npm dependencies).

The committed Xcode project was generated with Xcode 27.2 and uses the `project.xcproj` format. Its containing app currently targets **macOS 27.2**; the extension target is set to macOS 12.0. These settings are not a claim of compatibility with older systems. Older Xcode versions may require regenerating the project and adjusting deployment targets, followed by testing.

## Build and install from source

### 1. Clone the repository

    git clone https://github.com/hejackson2/safari-tab-reload-timer.git
    cd safari-tab-reload-timer

### 2. Set up Xcode

Install Xcode, open it once, and complete its setup. If necessary, run:

    sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
    sudo xcodebuild -runFirstLaunch

### 3. Open the included project

    open "SafariApp/Tab Reload Timer/Tab Reload Timer.xcodeproj"

Select the **Tab Reload Timer** containing app scheme and **My Mac**, then build and run with **Command-R**. Configure local signing as needed for your Xcode installation. A paid Apple Developer membership is not required for the local unsigned-extension workflow.

The project references the files in `extension/` directly, so keep the repository's directory structure intact.

For an ad-hoc-signed release build without a paid certificate:

    xcodebuild \
      -project "SafariApp/Tab Reload Timer/Tab Reload Timer.xcodeproj" \
      -scheme "Tab Reload Timer" \
      -configuration Release \
      -destination "generic/platform=macOS" \
      -derivedDataPath ./build \
      CODE_SIGN_STYLE=Manual \
      CODE_SIGN_IDENTITY="-" \
      build

The resulting app is at `build/Build/Products/Release/Tab Reload Timer.app`. Ad-hoc signing does not establish a verified developer identity or notarize the app.

### 4. Enable the extension in Safari

1. Launch the containing app.
2. Enable developer features in Safari Settings → Advanced if the Develop menu is hidden.
3. Select **Develop → Allow Unsigned Extensions** (its location can vary by Safari version).
4. Open Safari Settings → Extensions and enable **Tab Reload Timer**.
5. Approve any website permissions Safari requests.

**Safari resets Allow Unsigned Extensions when it quits.** Enable it again after restarting Safari. A downloaded unnotarized app may also be blocked by macOS; if you trust the download, the system may offer **Open Anyway** under System Settings → Privacy & Security. Managed Macs may restrict these exceptions.

### Regenerating the Xcode project

If your Xcode cannot open the included project, generate a separate project rather than overwriting it:

    xcrun safari-web-extension-converter ./extension \
      --project-location ./build/GeneratedSafariApp \
      --app-name "Tab Reload Timer" \
      --macos-only

Review converter warnings and configure deployment targets and app icons in the generated project. The manifest currently includes `background.persistent: false`, which the development Safari version warned was unsupported; reload behavior worked in local testing despite that warning.

## Use

1. Open an HTTP or HTTPS webpage.
2. Click the extension's toolbar button.
3. Enter an interval in seconds and click **Start**.
4. Reopen the popup to update the interval, see the approximate next reload time, or click **Stop**.

The first reload happens after the selected interval, not immediately. Repeat in another tab for an independent timer.

## Install with Homebrew

The published **1.0.0** app requires **Apple Silicon and macOS 27.2 or newer**. You do not need Xcode to install the prebuilt app.

This source repository also serves as a Homebrew tap. Add it using the explicit repository URL:

    brew tap hejackson2/safari-tab-reload-timer https://github.com/hejackson2/safari-tab-reload-timer

If your Homebrew version requires explicit trust for third-party taps, review `Casks/tab-reload-timer.rb` before running:

    brew trust --cask hejackson2/safari-tab-reload-timer/tab-reload-timer

Older Homebrew versions may not have the `trust` command; skip it if it is unavailable. Then install:

    brew install --cask hejackson2/safari-tab-reload-timer/tab-reload-timer

Launch **Tab Reload Timer** from Applications, then follow the [Safari enablement steps](#4-enable-the-extension-in-safari) above.

**The app is ad-hoc signed, not Developer ID signed or notarized.** Homebrew does not bypass macOS Gatekeeper or Safari's unsigned-extension setting. Only approve a downloaded app if you trust its source. Safari's **Allow Unsigned Extensions** setting must be enabled again after Safari quits.

### Install or upgrade to the latest published version

A fresh install uses the version currently listed in the cask. To refresh an existing tap and upgrade:

    brew update
    brew upgrade --cask hejackson2/safari-tab-reload-timer/tab-reload-timer

Quit the containing app before upgrading and restart Safari afterward if it retains the old extension. Re-enable Allow Unsigned Extensions after restarting Safari.

Homebrew follows the cask's version, not the latest source commit. Each new release must also update `Casks/tab-reload-timer.rb` with the new version and ZIP checksum before Homebrew can offer it. Downloads use versioned release URLs and verified SHA-256 checksums rather than an unchecked moving "latest" URL.

### Uninstall

    brew uninstall --cask hejackson2/safari-tab-reload-timer/tab-reload-timer

Optionally remove the tap:

    brew untap hejackson2/safari-tab-reload-timer

### Download without Homebrew

Download the app ZIP from the [latest GitHub Release](https://github.com/hejackson2/safari-tab-reload-timer/releases/latest), extract it, and move **Tab Reload Timer.app** into Applications. The same macOS and Safari approval requirements apply.

### Publishing a new release

Build and test the app, package it, and upload the ZIP to a versioned GitHub Release. Update the cask's `version`, `sha256`, and platform requirements (if changed), then commit and push the cask changes. Do not replace a published ZIP without updating its checksum.

To package a locally built app:

    mkdir -p dist
    ditto -c -k --sequesterRsrc --keepParent \
      "build/Build/Products/Release/Tab Reload Timer.app" \
      "dist/Tab-Reload-Timer-1.0.0.zip"
    shasum -a 256 dist/Tab-Reload-Timer-1.0.0.zip

Build outputs and packaged downloads are excluded from Git. Publish final packages as release assets rather than committing binaries.

## Development and validation

    node --check extension/background.js
    node --check extension/popup.js
    node --test tests/background.test.cjs

The eight dependency-free, mocked background tests cover timer start/update/stop, interval validation, idle-page reloads, tab closure, missing tabs, replacement tabs, startup cleanup, and message sender checks. They do not replace testing in Safari.

The native app has built successfully, all eight background tests passed, and the extension has been exercised successfully in the author's local Safari installation. Icon resources were also verified in a built app. Broader macOS/Safari compatibility has not been established.

### Manual test checklist

- Confirm a 60-second timer reloads a test page after about a minute.
- Verify separate intervals and badges in two tabs.
- Update and stop timers.
- Close one timed tab and confirm the other timer continues.
- Restart Safari and confirm timers are off.
- Check light/dark appearance and extension/app icons.

## Repository layout

- `Casks/tab-reload-timer.rb`: Homebrew installation definition for the published app.
- `extension/`: manifest, background logic, popup, and generated extension icons.
- `SafariApp/`: containing macOS app, extension target, Xcode project, and app icon assets.
- `tests/`: Node.js background tests.
- `Tab_Reload_Timer.jpg`: source artwork for the generated icons.
- `LICENSE`: MIT license.

No analytics, external service calls, or content scripts are included. The extension requests `alarms` and `tabs` permissions to manage timers and reload tabs.

## Contributing

Issues and pull requests are welcome. Include your macOS, Safari, and Xcode versions when reporting compatibility or build problems. Run the tests and describe any Safari testing performed with a change.

## License

[MIT](LICENSE). Copyright © 2026 hejackson2. Provided without warranty; see the license for its full terms.

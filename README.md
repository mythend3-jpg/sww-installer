# SWW Installer

Puts **Shinobi World War** on an iPhone from a Windows PC (or Mac). No jailbreak, no Mac,
no developer account: the player signs in with an Apple ID, plugs in the phone, presses
**Install**. Free Apple accounts sign apps for 7 days, so the player plugs in again and presses
**Extend by 7 Days** once a week; nothing is lost in between (accounts live on the server).

The game itself is downloaded from `https://shinobiworldwar.com/download/ios/version.json`,
so a new game build only needs a new `.ipa` + `version.json` on the site, never a new installer.

## For players

1. Download `SWW Installer` for Windows from the Releases page and run it.
   Windows needs iTunes (from Apple's site, not the Microsoft Store) for the iPhone driver.
2. Sign in with an Apple ID (a spare one is fine), plug in the iPhone, unlock it, tap Trust.
3. Press **Install**. On the phone: Settings → General → VPN & Device Management → trust the
   Apple ID. iOS 16+: Settings → Privacy & Security → Developer Mode → on.
4. Every 7 days: plug in, press **Extend by 7 Days**.

## Building

GitHub Actions builds the Windows `.exe` and macOS `.dmg` on every push to `main`
(see the Actions tab → latest run → Artifacts). Publishing a GitHub Release attaches them to it.

Local build: install [bun](https://bun.sh) and [Rust](https://rustup.rs), then
`bun i` and `bun tauri build`. Windows also needs Strawberry Perl and `make`.

## Credits

Based on [iloader](https://iloader.app) by nab138 (MIT, source:
<https://github.com/nab138/iloader>), which does the Apple ID, signing and device work through
[idevice](https://github.com/jkcoxson/idevice) and [isideload](https://github.com/nab138/isideload).
The iloader name and logos are not used here; see `LICENSE-BRANDING`. This is a community
project, not affiliated with Apple, Bandai Namco or the iloader author.

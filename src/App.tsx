import { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";
import { AppleID } from "./AppleID";
import { Device, DeviceInfo } from "./Device";
import { invoke } from "@tauri-apps/api/core";
import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  sideloadOperation,
  Operation,
  OperationState,
  OperationUpdate,
} from "./components/operations";
import { listen } from "@tauri-apps/api/event";
import OperationView from "./components/OperationView";
import { toast } from "sonner";
import { Modal } from "./components/Modal";
import { Certificates } from "./pages/Certificates";
import { AppIds } from "./pages/AppIds";
import { Settings } from "./pages/Settings";
import { Pairing } from "./pages/Pairing";
import { Game, GameInfo, installGameOperation } from "./pages/Game";
import { getVersion } from "@tauri-apps/api/app";
import logo from "./game-icon.png";
import { GlassCard } from "./components/GlassCard";
import { useTranslation } from "react-i18next";
import { usePlatform } from "./PlatformContext";

export const WEBSITE_URL = "https://shinobiworldwar.com";
export const DISCORD_URL = "https://discord.gg/Xf7RkF2vyU";
export const ILOADER_URL = "https://iloader.app";

function App() {
  const { t } = useTranslation();

  const [operationState, setOperationState] = useState<OperationState | null>(
    null,
  );
  const [loggedInAs, setLoggedInAs] = useState<string | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<DeviceInfo | null>(null);
  const [openModal, setOpenModal] = useState<
    null | "certificates" | "appids" | "pairing"
  >(null);
  const [version, setVersion] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const refreshDevicesRef = useRef<(() => void) | null>(null);

  const [noKeyringAvailable, setNoKeyringAvailable] = useState<boolean>(false);
  const { platform } = usePlatform();

  const checkKeyring = useCallback(async () => {
    try {
      let available = await invoke<boolean>("keyring_available");
      setNoKeyringAvailable(!available);
    } catch (e) {
      console.error("Unable to check keyring availability:", e);
      setNoKeyringAvailable(true);
    }
  }, []);

  useEffect(() => {
    checkKeyring();
  }, [checkKeyring]);

  useEffect(() => {
    const fetchVersion = async () => {
      const version = await getVersion();
      setVersion(version);
    };
    fetchVersion();
  }, []);

  const shortcutLabel = useCallback(
    (mac: string, windows: string, linux?: string) => {
      if (platform === "mac") return mac;
      if (platform === "linux") return linux ?? windows;
      return windows;
    },
    [platform],
  );

  const startOperation = useCallback(
    async (
      operation: Operation,
      params: { [key: string]: any },
    ): Promise<void> => {
      setOperationState({
        current: operation,
        started: [],
        failed: [],
        completed: [],
      });
      setBusy(true);
      return new Promise<void>(async (resolve, reject) => {
        const unlistenFn = await listen<OperationUpdate>(
          "operation_" + operation.id,
          (event) => {
            setOperationState((old) => {
              if (old == null) return null;
              if (event.payload.updateType === "started") {
                return {
                  ...old,
                  started: [...old.started, event.payload.stepId],
                };
              } else if (event.payload.updateType === "finished") {
                return {
                  ...old,
                  completed: [...old.completed, event.payload.stepId],
                };
              } else if (event.payload.updateType === "failed") {
                return {
                  ...old,
                  failed: [
                    ...old.failed,
                    {
                      stepId: event.payload.stepId,
                      extraDetails: event.payload.extraDetails,
                    },
                  ],
                };
              }
              return old;
            });
          },
        );
        try {
          await invoke(operation.id + "_operation", params);
          unlistenFn();
          setBusy(false);
          resolve();
        } catch (e) {
          unlistenFn();
          setBusy(false);
          reject(e);
        }
      });
    },
    [setOperationState],
  );

  const ensuredLoggedIn = useCallback((): boolean => {
    if (loggedInAs) return true;
    toast.error(t("app.must_be_logged_in"));
    return false;
  }, [loggedInAs, t]);

  const ensureSelectedDevice = useCallback((): boolean => {
    if (selectedDevice) return true;
    toast.error(t("app.must_select_device"));
    return false;
  }, [selectedDevice, t]);

  const installGame = useCallback(
    async (info: GameInfo) => {
      if (!ensuredLoggedIn() || !ensureSelectedDevice()) {
        throw new Error("not ready");
      }
      await startOperation(installGameOperation, {
        url: info.url,
        version: info.version,
      });
    },
    [ensuredLoggedIn, ensureSelectedDevice, startOperation],
  );

  const openLink = useCallback(
    async (url: string) => {
      try {
        await openUrl(url);
      } catch (error) {
        console.error("Failed to open link", error);
        toast.error(t("app.open_github_failed"));
      }
    },
    [t],
  );

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === undefined) return;
      const key = event.key.toLowerCase();
      const primaryPressed = platform === "mac" ? event.metaKey : event.ctrlKey;
      if (!primaryPressed) return;

      if (!event.shiftKey && key === "p") {
        event.preventDefault();
        if (!ensureSelectedDevice()) return;
        setOpenModal("pairing");
      } else if (event.shiftKey && key === "c") {
        event.preventDefault();
        if (!ensuredLoggedIn()) return;
        setOpenModal("certificates");
      } else if (event.shiftKey && key === "a") {
        event.preventDefault();
        if (!ensuredLoggedIn()) return;
        setOpenModal("appids");
      } else if (!event.shiftKey && key === "r") {
        event.preventDefault();
        refreshDevicesRef.current?.();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [platform, ensureSelectedDevice, ensuredLoggedIn]);

  return (
    <main className="workspace">
      <header className="workspace-header">
        <div className="header-left">
          <div className="title-block">
            <img src={logo} alt={t("app.logo_alt")} className="logo" />
            <div>
              <h1 className="title">SWW Installer</h1>
              <p className="subtitle">{t("subtitle")}</p>
            </div>
          </div>
          <span className="version-pill">
            {t("version")} {version}
          </span>
        </div>
        <div className="header-actions">
          <button
            className="toolbar-button"
            onClick={() => openLink(DISCORD_URL)}
          >
            {t("app.discord")}
          </button>
          <button
            className="toolbar-button"
            onClick={() => openLink(WEBSITE_URL)}
          >
            {t("app.website")}
          </button>
        </div>
      </header>
      <div className="workspace-body">
        <aside className="workspace-sidebar">
          <section className="workspace-section">
            <div className="section-header">
              <p className="section-label">{t("app.section_account")}</p>
              {/* here to ensure spacing and stuff is correct */}
              <span className="section-hint placeholder" aria-hidden="true">
                Placeholder
              </span>
            </div>
            <GlassCard className="panel">
              <AppleID
                loggedInAs={loggedInAs}
                setLoggedInAs={setLoggedInAs}
                noKeyringAvailable={noKeyringAvailable}
              />
            </GlassCard>
          </section>
          <section className="workspace-section">
            <p className="section-label">{t("app.section_management")}</p>
            <div className="workspace-list">
              <button
                className="workspace-list-item"
                onClick={() => {
                  if (!ensureSelectedDevice()) return;
                  setOpenModal("pairing");
                }}
              >
                {t("app.manage_pairing_file")}{" "}
                <span aria-hidden="true">{shortcutLabel("⌘P", "Ctrl+P")}</span>
              </button>
              <button
                className="workspace-list-item"
                onClick={() => {
                  refreshDevicesRef.current?.();
                }}
              >
                {t("app.refresh_devices")}{" "}
                <span aria-hidden="true">{shortcutLabel("⌘R", "Ctrl+R")}</span>
              </button>
              <button
                className="workspace-list-item"
                onClick={() => {
                  if (!ensuredLoggedIn()) return;
                  setOpenModal("certificates");
                }}
              >
                {t("app.certificates")}{" "}
                <span aria-hidden="true">
                  {shortcutLabel("⌘⇧C", "Ctrl+Shift+C")}
                </span>
              </button>
              <button
                className="workspace-list-item"
                onClick={() => {
                  if (!ensuredLoggedIn()) return;
                  setOpenModal("appids");
                }}
              >
                {t("app.app_ids")}{" "}
                <span aria-hidden="true">
                  {shortcutLabel("⌘⇧A", "Ctrl+Shift+A")}
                </span>
              </button>
            </div>
          </section>
          <section className="workspace-section">
            <p className="section-label">{t("app.help_title")}</p>
            <GlassCard className="panel">
              <ol className="help-steps">
                <li>{t("app.help_step1")}</li>
                <li>{t("app.help_step2")}</li>
                <li>{t("app.help_step3")}</li>
                <li>{t("app.help_step4")}</li>
              </ol>
            </GlassCard>
          </section>
        </aside>
        <section className="workspace-content">
          <section className="workspace-section">
            <div className="section-header">
              <p className="section-label">{t("app.devices")}</p>
              <span className="section-hint">
                {selectedDevice
                  ? t("app.active_device", {
                      name: `${selectedDevice.name} (${selectedDevice.version})`,
                    })
                  : t("app.select_device")}
              </span>
            </div>
            <GlassCard className="panel">
              <Device
                selectedDevice={selectedDevice}
                setSelectedDevice={setSelectedDevice}
                registerRefresh={(fn) => {
                  refreshDevicesRef.current = fn ?? null;
                }}
              />
            </GlassCard>
          </section>
          <section className="workspace-section">
            <div className="section-header">
              <p className="section-label">{t("app.game")}</p>
              <span className="section-hint">{t("app.game_hint")}</span>
            </div>
            <Game
              loggedIn={!!loggedInAs}
              selectedDevice={selectedDevice}
              busy={busy}
              startInstall={installGame}
            />
          </section>
          <section className="workspace-section">
            <p className="section-label">{t("app.settings")}</p>
            <GlassCard className="panel settings-panel">
              <Settings
                ensureSelectedDevice={ensureSelectedDevice}
                setSelectedDevice={setSelectedDevice}
                platform={platform}
                shortcutLabel={shortcutLabel}
                checkKeyring={checkKeyring}
              />
              <div className="advanced-row">
                <button
                  disabled={busy}
                  onClick={async () => {
                    if (!ensuredLoggedIn() || !ensureSelectedDevice()) return;
                    let path = await openFileDialog({
                      multiple: false,
                      filters: [
                        { name: t("app.ipa_files"), extensions: ["ipa"] },
                      ],
                    });
                    if (!path) return;
                    startOperation(sideloadOperation, {
                      appPath: path as string,
                    }).catch((e) => {
                      console.log(e.type);
                      console.error(e.message);
                    });
                  }}
                >
                  {t("app.import_ipa")}
                </button>
              </div>
              <p className="text-muted credits">
                {t("app.based_on")}{" "}
                <button
                  className="header-link"
                  onClick={() => openLink(ILOADER_URL)}
                >
                  iloader
                </button>{" "}
                (MIT, nab138). {t("app.not_affiliated")}
              </p>
            </GlassCard>
          </section>
          {operationState && (
            <OperationView
              operationState={operationState}
              closeMenu={() => setOperationState(null)}
            />
          )}
        </section>
      </div>
      <Modal
        isOpen={openModal === "certificates"}
        close={() => setOpenModal(null)}
      >
        <Certificates />
      </Modal>
      <Modal isOpen={openModal === "appids"} close={() => setOpenModal(null)}>
        <AppIds />
      </Modal>
      <Modal isOpen={openModal === "pairing"} close={() => setOpenModal(null)}>
        <Pairing />
      </Modal>
    </main>
  );
}

export default App;

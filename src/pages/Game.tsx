import { useCallback, useEffect, useMemo, useState } from "react";
import "./Game.css";
import { useTranslation } from "react-i18next";
import { useStore } from "../StoreContext";
import { Operation } from "../components/operations";
import { DeviceInfo } from "../Device";
import banner from "../banner.png";
import gameIcon from "../game-icon.png";

// Published next to the IPA on the game site. Change the IPA + this file, never the .exe.
export const GAME_INFO_URL =
  "https://shinobiworldwar.com/download/ios/version.json";

export type GameInfo = {
  version: string; // e.g. "2.1.0" (shown to the player)
  url: string; // direct https link to the .ipa
  size_mb?: number;
  notes?: string;
  min_ios?: string;
};

export type InstallRecord = {
  version: string;
  installedAt: string; // ISO date
  deviceUdid: string;
  deviceName: string;
};

// Free Apple ID signatures last 7 days.
export const SIGNATURE_DAYS = 7;

export const installGameOperation: Operation = {
  id: "install_game",
  titleKey: "game.op_title",
  successTitleKey: "game.op_success_title",
  successMessageKey: "game.op_success_message",
  steps: [
    { id: "download", titleKey: "game.op_step_download" },
    { id: "install", titleKey: "game.op_step_install" },
  ],
};

export const daysLeft = (record: InstallRecord | null): number | null => {
  if (!record) return null;
  const installed = new Date(record.installedAt).getTime();
  if (Number.isNaN(installed)) return null;
  const expires = installed + SIGNATURE_DAYS * 24 * 3600 * 1000;
  return Math.ceil((expires - Date.now()) / (24 * 3600 * 1000));
};

type GameProps = {
  loggedIn: boolean;
  selectedDevice: DeviceInfo | null;
  busy: boolean;
  startInstall: (info: GameInfo) => Promise<void>;
};

export const Game = ({
  loggedIn,
  selectedDevice,
  busy,
  startInstall,
}: GameProps) => {
  const { t } = useTranslation();
  const [info, setInfo] = useState<GameInfo | null>(null);
  const [infoError, setInfoError] = useState<string | null>(null);
  const [installs, setInstalls] = useStore<InstallRecord[]>("gameInstalls", []);

  const fetchInfo = useCallback(async () => {
    setInfoError(null);
    try {
      const res = await fetch(GAME_INFO_URL + "?t=" + Date.now(), {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = (await res.json()) as GameInfo;
      if (!data.version || !data.url) throw new Error("bad version.json");
      setInfo(data);
    } catch (e) {
      console.error("game info fetch failed", e);
      setInfoError(String(e));
    }
  }, []);

  useEffect(() => {
    fetchInfo();
  }, [fetchInfo]);

  // the record for the phone that is plugged in right now
  const record = useMemo<InstallRecord | null>(() => {
    if (!selectedDevice) return null;
    return installs.find((r) => r.deviceUdid === selectedDevice.uuid) ?? null;
  }, [installs, selectedDevice]);

  const left = daysLeft(record);
  const outdated = !!(record && info && record.version !== info.version);

  const install = async () => {
    if (!info) return;
    await startInstall(info);
    if (selectedDevice) {
      const rec: InstallRecord = {
        version: info.version,
        installedAt: new Date().toISOString(),
        deviceUdid: selectedDevice.uuid,
        deviceName: selectedDevice.name,
      };
      setInstalls([
        ...installs.filter((r) => r.deviceUdid !== selectedDevice.uuid),
        rec,
      ]);
    }
  };

  let statusLine: string;
  let statusClass = "game-status";
  if (!selectedDevice) {
    statusLine = t("game.status_no_device");
  } else if (!record) {
    statusLine = t("game.status_not_installed", { name: selectedDevice.name });
  } else if (left !== null && left <= 0) {
    statusLine = t("game.status_expired");
    statusClass += " bad";
  } else {
    statusLine = t("game.status_installed", {
      days: left,
      date: new Date(record.installedAt).toLocaleDateString(),
    });
    if (left !== null && left <= 2) statusClass += " warn";
  }

  const canInstall = loggedIn && !!selectedDevice && !!info && !busy;
  const mainLabel = !record
    ? t("game.install")
    : outdated
      ? t("game.update")
      : t("game.extend");

  return (
    <div className="game-card">
      <div
        className="game-banner"
        style={{ backgroundImage: `url(${banner})` }}
      />
      <div className="game-body">
        <img src={gameIcon} alt="" className="game-icon" />
        <div className="game-text">
          <h2 className="game-title">Shinobi World War</h2>
          <p className="game-version">
            {info
              ? t("game.version_line", {
                  version: info.version,
                  size: info.size_mb ? ` · ${info.size_mb} MB` : "",
                })
              : infoError
                ? t("game.version_unavailable")
                : t("game.version_loading")}
            {outdated && (
              <span className="game-pill">{t("game.new_version")}</span>
            )}
          </p>
          <p className={statusClass}>{statusLine}</p>
          {info?.notes && <p className="game-notes">{info.notes}</p>}
        </div>
        <div className="game-actions">
          <button
            className="game-primary"
            disabled={!canInstall}
            onClick={install}
            title={
              !loggedIn
                ? t("app.must_be_logged_in")
                : !selectedDevice
                  ? t("app.must_select_device")
                  : ""
            }
          >
            {mainLabel}
          </button>
          {record && !outdated && (
            <button
              className="game-secondary"
              disabled={!canInstall}
              onClick={install}
            >
              {t("game.reinstall")}
            </button>
          )}
          {infoError && (
            <button className="game-secondary" onClick={fetchInfo}>
              {t("common.refresh")}
            </button>
          )}
        </div>
      </div>
      <div className="game-footer">
        <span>{t("game.expiry_hint", { days: SIGNATURE_DAYS })}</span>
      </div>
    </div>
  );
};

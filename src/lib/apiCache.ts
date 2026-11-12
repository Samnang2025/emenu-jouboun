import axios from "axios";
import { MenuType } from "@/types/model";

const API_BASE = "https://pos-jouboun.tsdsolution.net/api/DriverController";

export interface TableItem {
  id: string;
  name: string;
  zone: string;
  active?: string;
}

export interface SettingData {
  site_name: string;
  logo: string;
  slide_Show: string;
  symbol: any;
  slides: any[];
}

const MENU_CACHE_KEY = "emenu_cache_products_v1";
const SETTING_CACHE_KEY = "emenu_cache_setting_v1";
const TABLES_CACHE_KEY = "emenu_cache_tables_v1";
const CONFIG_CACHE_KEY = "emenu_cache_eorder_config_v1";

// In-memory cache for instant 0ms access across client navigations
let memoryMenu: { data: MenuType; timestamp: number } | null = null;
let memorySetting: { data: SettingData; timestamp: number } | null = null;
let memoryTables: { data: TableItem[]; timestamp: number } | null = null;
let memoryConfig: { data: any; timestamp: number } | null = null;

// In-flight request promises to deduplicate simultaneous calls
let inflightMenu: Promise<MenuType> | null = null;
let inflightSetting: Promise<SettingData | null> | null = null;
let inflightTables: Promise<TableItem[] | null> | null = null;
let inflightConfig: Promise<any | null> | null = null;

const MENU_TTL_MS = 5 * 60 * 1000; // 5 minutes fresh
const SETTING_TTL_MS = 10 * 60 * 1000; // 10 minutes fresh
const TABLES_TTL_MS = 15 * 1000; // 15 seconds fresh for table statuses

function readSession<T>(key: string): { data: T; timestamp: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeSession<T>(key: string, data: T): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      key,
      JSON.stringify({ data, timestamp: Date.now() })
    );
  } catch {
    // Ignore storage quota errors
  }
}

export function mapRawTables(rawTables: any[]): TableItem[] {
  return rawTables.map((t: any) => {
    let zone = "Other Zone";
    if (t.floor_id === "1") zone = "Zone A";
    else if (t.floor_id === "2") zone = "Zone B";
    else if (t.floor_id === "3") zone = "Zone C";
    else if (t.floor_id === "4") zone = "Zone K";
    else if (t.floor_id === "5") zone = "VIP / Special";
    else {
      const upperName = (t.name || "").toUpperCase();
      if (upperName.startsWith("A")) zone = "Zone A";
      else if (upperName.startsWith("B")) zone = "Zone B";
      else if (upperName.startsWith("C")) zone = "Zone C";
      else if (upperName.startsWith("K")) zone = "Zone K";
      else if (["VIP", "KTV", "BOAT"].includes(upperName)) zone = "VIP / Special";
    }
    return {
      id: String(t.id),
      name: t.name,
      zone,
      active: t.active,
    };
  });
}

export function getCachedTables(): TableItem[] | null {
  if (memoryTables) return memoryTables.data;
  const cached = readSession<TableItem[]>(TABLES_CACHE_KEY);
  if (cached?.data && Array.isArray(cached.data)) {
    memoryTables = cached;
    return cached.data;
  }
  return null;
}

export function getTableNameById(tableId: string | string[] | undefined): string {
  if (!tableId) return "";
  const idStr = Array.isArray(tableId) ? tableId[0] : String(tableId);
  const tables = getCachedTables();
  if (!tables) return "";
  const found = tables.find((t) => String(t.id) === idStr);
  return found ? found.name : "";
}

export async function fetchTables(forceRefresh = false): Promise<TableItem[] | null> {
  if (!forceRefresh && memoryTables && Date.now() - memoryTables.timestamp < TABLES_TTL_MS) {
    return memoryTables.data;
  }

  if (inflightTables) return inflightTables;

  inflightTables = axios
    .get(`${API_BASE}/tables`)
    .then((res) => {
      if (Array.isArray(res.data)) {
        const mapped = mapRawTables(res.data);
        memoryTables = { data: mapped, timestamp: Date.now() };
        writeSession(TABLES_CACHE_KEY, mapped);
        return mapped;
      }
      return null;
    })
    .catch((err) => {
      console.warn("Error fetching tables:", err);
      return getCachedTables();
    })
    .finally(() => {
      inflightTables = null;
    });

  return inflightTables;
}

export function getCachedSetting(): SettingData | null {
  if (memorySetting) return memorySetting.data;
  const cached = readSession<SettingData>(SETTING_CACHE_KEY);
  if (cached?.data) {
    memorySetting = cached;
    return cached.data;
  }
  return null;
}

export async function fetchSetting(forceRefresh = false): Promise<SettingData | null> {
  const cached = getCachedSetting();
  if (!forceRefresh && cached && memorySetting && Date.now() - memorySetting.timestamp < SETTING_TTL_MS) {
    return cached;
  }

  if (inflightSetting) return inflightSetting;

  inflightSetting = axios
    .get(`${API_BASE}/setting`)
    .then((res) => {
      const raw = res.data;
      if (!raw) return cached;
      let slides: any[] = [];
      if (typeof raw.slide_Show === "string") {
        try {
          const correctedSlideShow = raw.slide_Show.replace(/,\s*]$/, "]");
          slides = JSON.parse(correctedSlideShow);
        } catch {
          slides = [];
        }
      }
      const parsed: SettingData = {
        site_name: raw.site_name || "Tonle Coffee",
        logo: raw.logo || "",
        slide_Show: raw.slide_Show || "[]",
        symbol: raw.symbol ?? null,
        slides,
      };
      memorySetting = { data: parsed, timestamp: Date.now() };
      writeSession(SETTING_CACHE_KEY, parsed);
      if (typeof document !== "undefined" && parsed.site_name) {
        document.title = parsed.site_name;
      }
      return parsed;
    })
    .catch((err) => {
      console.warn("Error fetching setting:", err);
      return cached;
    })
    .finally(() => {
      inflightSetting = null;
    });

  return inflightSetting;
}

export function getCachedMenuProducts(): MenuType | null {
  if (memoryMenu) return memoryMenu.data;
  const cached = readSession<MenuType>(MENU_CACHE_KEY);
  if (cached?.data && Array.isArray(cached.data) && cached.data.length > 0) {
    memoryMenu = cached;
    return cached.data;
  }
  return null;
}

export async function fetchMenuProducts(forceRefresh = false): Promise<MenuType> {
  const cached = getCachedMenuProducts();
  const isFresh =
    !forceRefresh &&
    cached &&
    memoryMenu &&
    Date.now() - memoryMenu.timestamp < MENU_TTL_MS;

  if (isFresh && cached) {
    return cached;
  }

  if (inflightMenu) return inflightMenu;

  inflightMenu = axios
    .get(`${API_BASE}/GetAllProductWithCat`)
    .then((res) => {
      const dataJson: MenuType = Array.isArray(res.data) ? res.data : [];
      if (dataJson.length > 0) {
        memoryMenu = { data: dataJson, timestamp: Date.now() };
        writeSession(MENU_CACHE_KEY, dataJson);
      }
      return dataJson;
    })
    .catch((err) => {
      console.error("Error fetching menu products:", err);
      if (cached) return cached;
      throw err;
    })
    .finally(() => {
      inflightMenu = null;
    });

  return inflightMenu;
}

export function getCachedStoreConfig(): any | null {
  if (memoryConfig) return memoryConfig.data;
  const cached = readSession<any>(CONFIG_CACHE_KEY);
  if (cached?.data) {
    memoryConfig = cached;
    return cached.data;
  }
  return null;
}

export async function fetchStoreConfig(): Promise<any | null> {
  const cached = getCachedStoreConfig();
  if (cached && memoryConfig && Date.now() - memoryConfig.timestamp < SETTING_TTL_MS) {
    return cached;
  }

  if (inflightConfig) return inflightConfig;

  inflightConfig = axios
    .get(`${API_BASE}/e_orderConfig`)
    .then((res) => {
      if (res.data) {
        memoryConfig = { data: res.data, timestamp: Date.now() };
        writeSession(CONFIG_CACHE_KEY, res.data);
      }
      return res.data;
    })
    .catch((err) => {
      console.warn("Error fetching e_orderConfig:", err);
      return cached;
    })
    .finally(() => {
      inflightConfig = null;
    });

  return inflightConfig;
}

/**
 * Prefetch menu products and store settings in the background while the user
 * is viewing the table selection screen (/pos-jouboun).
 */
export function prefetchMenuAndSettings(): void {
  if (typeof window === "undefined") return;
  fetchMenuProducts(false).catch(() => {});
  fetchSetting(false).catch(() => {});
}


import { getMamToken } from "./mam-token";

export const getEnvVariable = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
};

export const getOptionalEnvVariable = (key: string): string | undefined => {
  const value = process.env[key];
  return value && value.length > 0 ? value : undefined;
};

/** Base URL of the MAM site. Overridable so tests can point at a mock. */
export const getMamBaseUrl = (): string =>
  (getOptionalEnvVariable("MAM_BASE_URL") ?? "https://www.myanonamouse.net").replace(
    /\/+$/,
    "",
  );

/** Dynamic-seedbox keepalive endpoint. Overridable so tests can point at a mock. */
export const getMamSeedboxUrl = (): string =>
  getOptionalEnvVariable("MAM_SEEDBOX_URL") ??
  "https://t.myanonamouse.net/json/dynamicSeedbox.php";

export const getServerEnvVariables = () => {
  return {
    MAM_TOKEN: getMamToken(),
    TRANSMISSION_URL: getEnvVariable("TRANSMISSION_URL"),
    AUDIOBOOK_DESTINATION_PATH: getEnvVariable("AUDIOBOOK_DESTINATION_PATH"),
    EBOOK_DESTINATION_PATH: getEnvVariable("EBOOK_DESTINATION_PATH"),
  };
};

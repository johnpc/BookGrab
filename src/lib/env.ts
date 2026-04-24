import { readFileSync } from "fs";

export const getEnvVariable = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
};

export const getOptionalEnvVariable = (key: string): string | undefined => {
  return process.env[key];
};

const getMamToken = (): string | undefined => {
  const token = getOptionalEnvVariable("MAM_TOKEN");
  if (token) return token;

  const filePath = getOptionalEnvVariable("MAM_TOKEN_FILE");
  if (filePath) {
    try {
      return readFileSync(filePath, "utf-8").trim();
    } catch {
      console.error(`Failed to read MAM token from file: ${filePath}`);
    }
  }

  return undefined;
};

export const getServerEnvVariables = () => {
  return {
    MAM_TOKEN: getMamToken(),
    TRANSMISSION_URL: getEnvVariable("TRANSMISSION_URL"),
    AUDIOBOOK_DESTINATION_PATH: getEnvVariable("AUDIOBOOK_DESTINATION_PATH"),
    EBOOK_DESTINATION_PATH: getEnvVariable("EBOOK_DESTINATION_PATH"),
  };
};

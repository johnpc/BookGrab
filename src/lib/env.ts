import { getMamToken } from "./mam-token";

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

export const getServerEnvVariables = () => {
  return {
    MAM_TOKEN: getMamToken(),
    TRANSMISSION_URL: getEnvVariable("TRANSMISSION_URL"),
    AUDIOBOOK_DESTINATION_PATH: getEnvVariable("AUDIOBOOK_DESTINATION_PATH"),
    EBOOK_DESTINATION_PATH: getEnvVariable("EBOOK_DESTINATION_PATH"),
  };
};

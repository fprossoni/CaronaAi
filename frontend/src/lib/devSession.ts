export const DEV_MOCK_TOKEN = "dev_mock_token";

export function isDevSession() {
  return import.meta.env.DEV && localStorage.getItem("access_token") === DEV_MOCK_TOKEN;
}

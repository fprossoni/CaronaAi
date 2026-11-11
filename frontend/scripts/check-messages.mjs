// Integration check of the same in-memory API used by /dev. No network calls.
import assert from "node:assert/strict";
import path from "node:path";
import { mkdtemp, writeFile, unlink, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { build } from "vite";

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
};

const bundle = await build({
  configFile: false,
  logLevel: "warn",
  resolve: { alias: { "@": path.resolve("src") } },
  define: { "import.meta.env.DEV": "true" },
  ssr: { noExternal: true },
  build: { ssr: "virtual:message-check", write: false, minify: false },
  plugins: [{
    name: "message-check-entry",
    resolveId: (id) => id.endsWith("virtual:message-check") ? "\0message-check" : undefined,
    load: (id) => id === "\0message-check" ? `
      export { handleDevRequest } from "@/api/devApi";
      export { useAuthStore } from "@/store/authStore";
      export { MOCK_DRIVER_USER, MOCK_PASSENGER_USER, MOCK_FEMALE_DRIVER_USER } from "@/data/devMocks";
    ` : undefined,
  }],
});
const scratch = await mkdtemp(path.join(tmpdir(), "carona-chat-check-"));
const entryPath = path.join(scratch, "entry.mjs");
try {
  const entry = bundle.output.find((item) => item.type === "chunk" && item.isEntry);
  await writeFile(entryPath, entry.code);
  const { handleDevRequest, useAuthStore, MOCK_DRIVER_USER, MOCK_PASSENGER_USER, MOCK_FEMALE_DRIVER_USER } =
    await import(pathToFileURL(entryPath).href);
  const as = (user) => useAuthStore.getState().setDevSession(user);
  const call = async (url, method = "get", data, params) => (await handleDevRequest({ url, method, data, params, headers: {} })).data;
  as(MOCK_PASSENGER_USER);
  await assert.rejects(call("/messages", "post", { ride_id: 501 }));
  as(MOCK_DRIVER_USER);
  await call("/matches/7001/respond", "patch", { action: "accept" });
  const group = await call("/messages", "post", { ride_id: 501 });
  assert.equal((await call("/messages", "post", { ride_id: 501 })).id, group.id);
  await call(`/messages/${group.id}/items`, "post", { body: "Vamos combinar a saída!" });
  const privateChat = await call("/messages", "post", { ride_id: 501, passenger_id: MOCK_PASSENGER_USER.id });
  await call(`/messages/${privateChat.id}/items`, "post", { body: "Estou no ponto." });
  as(MOCK_PASSENGER_USER);
  assert.equal((await call("/messages")).length, 2);
  assert.equal((await call(`/messages/${privateChat.id}/items`))[0].body, "Estou no ponto.");
  const reply = await call(`/messages/${privateChat.id}/items`, "post", { body: "Já estou chegando." });
  assert.equal((await call(`/messages/${privateChat.id}/items`, "get", undefined, { after: reply.id })).length, 0);
  as(MOCK_FEMALE_DRIVER_USER);
  assert.deepEqual(await call("/messages"), []);
  await assert.rejects(call(`/messages/${privateChat.id}/items`));
  as(MOCK_DRIVER_USER);
  await call("/rides/501/start", "patch");
  assert.equal((await call("/messages")).length, 2);
  await call("/rides/501/complete", "patch");
  assert.deepEqual(await call("/messages"), []);
  await assert.rejects(call(`/messages/${group.id}/items`, "post", { body: "Encerrada" }));
  assert.equal((await call("/rides/history"))[0].status, "completed");
  as(MOCK_PASSENGER_USER);
  assert.equal((await call("/rides/history"))[0].status, "completed");
  console.log("Messages dev integration: confirmation, group, private, permissions and closure passed.");
} finally {
  await unlink(entryPath);
  await rmdir(scratch);
}

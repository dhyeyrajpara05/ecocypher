/**
 * Encrypted storage for the browser build.
 *
 * Everything EcoCypher saves in localStorage is encrypted with AES-256-GCM. The key is generated in
 * the browser as a NON-EXTRACTABLE Web Crypto key and kept in IndexedDB: the page can use it to
 * encrypt and decrypt, but the raw key bytes can never be read out or copied to another machine.
 * Opening DevTools > Application > Local Storage shows only ciphertext.
 *
 * This stops casual snooping. It is not a substitute for a server: code running on the same page can
 * still ask the key to decrypt. Real secrecy for an event needs the Vercel backend (docs/VERCEL.md).
 */

export interface Cipher {
  seal(plain: string): Promise<string>;
  open(sealed: string): Promise<string>;
}

/** No-op cipher, used in tests and as a fallback where IndexedDB is unavailable. */
export const plainCipher: Cipher = { seal: async (s) => s, open: async (s) => s };

const DB_NAME = "ecocypher-vault";
const STORE = "keys";

function idb<T>(fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const tx = open.result.transaction(STORE, "readwrite");
      const req = fn(tx.objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    };
  });
}

function b64(bytes: Uint8Array): string {
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s);
}
function unb64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

export async function browserCipher(): Promise<Cipher> {
  if (typeof indexedDB === "undefined" || !crypto?.subtle) return plainCipher;
  let key = await idb<CryptoKey | undefined>((s) => s.get("main") as IDBRequest<CryptoKey | undefined>);
  if (!key) {
    key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    await idb((s) => s.put(key!, "main"));
  }
  const k = key;
  return {
    async seal(plain) {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, k, new TextEncoder().encode(plain)));
      return `ec1:${b64(iv)}:${b64(ct)}`;
    },
    async open(sealed) {
      if (!sealed.startsWith("ec1:")) return sealed; // older unencrypted data
      const [, iv, ct] = sealed.split(":");
      const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, k, unb64(ct));
      return new TextDecoder().decode(pt);
    },
  };
}

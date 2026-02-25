// Minimal type declarations for chrome.runtime.sendMessage used in page.evaluate() calls.
// These run in the browser context of a loaded Chrome extension, not in Node.
declare namespace chrome {
  namespace runtime {
    function sendMessage(message: unknown): Promise<unknown>;
  }
}

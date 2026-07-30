import "@testing-library/jest-dom";

// This setup file runs for every test file, including ones that opt out of
// jsdom via `// @vitest-environment node` (e.g. src/test/rls.integration.test.ts,
// which makes real network calls and has no use for a DOM). Guard the jsdom-only
// setup so it doesn't throw "window is not defined" under the node environment.
if (typeof window !== "undefined") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
    }),
  });
}

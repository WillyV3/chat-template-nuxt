// @vitest-environment happy-dom
//
// Covers the fileDownload mode's click dispatch (response.ts / response.vue).
// The React suite called the custom `a` renderer as a plain function; here the
// dispatch lives in `openFileLink` (same assertions, no DOM needed) and one
// mount test proves the real rendered `shared/x` link reaches `onOpen`.

import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import Response from "./response.vue";
import { downloadHrefToSharedPath, openFileLink, resolveFileHref } from "./response";

const AGENT_URL = "https://u-test.sontara.ai";
const TOKEN = "tok-123";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("downloadHrefToSharedPath", () => {
  it("recovers a root-level shared path from the rewritten download href", () => {
    const href = `${AGENT_URL}/api/files/report.pdf/download`;
    expect(downloadHrefToSharedPath(href)).toBe("shared/report.pdf");
  });

  it("recovers a nested shared path (round-trips the Trinity bug report's link)", () => {
    const href = `${AGENT_URL}/api/files/the_seeds_of_becoming.md/download?path=work-product`;
    expect(downloadHrefToSharedPath(href)).toBe("shared/work-product/the_seeds_of_becoming.md");
  });

  it("returns null for a non-download href", () => {
    expect(downloadHrefToSharedPath("https://example.com")).toBeNull();
  });
});

describe("resolveFileHref", () => {
  it("maps shared/x resolved against the agent origin to its download URL", () => {
    expect(resolveFileHref(`${AGENT_URL}/shared/work-product/a.md`, AGENT_URL)).toBe(
      `${AGENT_URL}/api/files/a.md/download?path=work-product`,
    );
    expect(resolveFileHref("/shared/report.pdf", AGENT_URL)).toBe(
      `${AGENT_URL}/api/files/report.pdf/download`,
    );
  });

  it("passes a download href through and ignores ordinary links", () => {
    const dl = `${AGENT_URL}/api/files/r.pdf/download`;
    expect(resolveFileHref(dl, AGENT_URL)).toBe(dl);
    expect(resolveFileHref("https://example.com/shared/x", AGENT_URL)).toBeNull();
  });
});

describe("openFileLink click dispatch", () => {
  const href = `${AGENT_URL}/api/files/report.pdf/download`;

  it("with onOpen set: calls onOpen with the shared path and never fetches", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const onOpen = vi.fn();

    openFileLink(href, TOKEN, onOpen);

    expect(onOpen).toHaveBeenCalledExactlyOnceWith("shared/report.pdf");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("without onOpen: behavior is unchanged, the authenticated download fires", () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});

    openFileLink(href, TOKEN);

    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(href, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
  });
});

describe("<Response> rendering", () => {
  it("renders a shared/ link and clicking it opens it in the viewer, not a navigation", async () => {
    const onOpen = vi.fn();
    const wrapper = mount(Response, {
      props: {
        content: "See [the report](shared/report.pdf) now.",
        fileDownload: { agentUrl: AGENT_URL, token: TOKEN, onOpen },
      },
      attachTo: document.body,
    });
    await vi.waitFor(() => expect(wrapper.find("a").exists()).toBe(true), { timeout: 4000 });
    await flushPromises();
    await wrapper.find("a").trigger("click");
    expect(onOpen).toHaveBeenCalledExactlyOnceWith("shared/report.pdf");
    wrapper.unmount();
  });

  it("blocks javascript: links", async () => {
    const wrapper = mount(Response, { props: { content: "[x](javascript:alert)" } });
    await flushPromises();
    await new Promise((r) => setTimeout(r, 300));
    expect(wrapper.find("a").exists()).toBe(false);
  });
});

/**
 * URL tool.
 *
 * Encode / decode URI components and parse a URL into its
 * constituent parts. Pure, browser + Node compatible.
 */

export interface UrlParsed {
  ok: boolean;
  protocol: string;
  username: string;
  password: string;
  host: string;
  hostname: string;
  port: string;
  pathname: string;
  search: string;
  hash: string;
  origin: string;
  query: Array<{ key: string; value: string }>;
  error: string | null;
}

const EMPTY: UrlParsed = {
  ok: false,
  protocol: "",
  username: "",
  password: "",
  host: "",
  hostname: "",
  port: "",
  pathname: "",
  search: "",
  hash: "",
  origin: "",
  query: [],
  error: null,
};

export function parseUrl(input: string): UrlParsed {
  const text = (input ?? "").trim();
  if (!text) return { ...EMPTY };
  try {
    const url = new URL(text);
    const query: Array<{ key: string; value: string }> = [];
    url.searchParams.forEach((value, key) => {
      query.push({ key, value });
    });
    return {
      ok: true,
      protocol: url.protocol,
      username: url.username,
      password: url.password,
      host: url.host,
      hostname: url.hostname,
      port: url.port,
      pathname: url.pathname,
      search: url.search,
      hash: url.hash,
      origin: url.origin,
      query,
      error: null,
    };
  } catch (err) {
    return {
      ...EMPTY,
      error: err instanceof Error ? err.message : "Invalid URL",
    };
  }
}

/** Encode the input as a URL component. */
export function encodeUrlComponent(input: string): string {
  return encodeURIComponent(input ?? "");
}

/** Decode a URL component back to a plain string. */
export function decodeUrlComponent(input: string): string {
  try {
    return decodeURIComponent(input ?? "");
  } catch (err) {
    throw err instanceof Error ? err : new Error("Failed to decode");
  }
}

/** Encode the full URL, preserving structural characters. */
export function encodeUrl(input: string): string {
  return encodeURI(input ?? "");
}

/** Decode a full URL back to its plain form. */
export function decodeUrl(input: string): string {
  try {
    return decodeURI(input ?? "");
  } catch (err) {
    throw err instanceof Error ? err : new Error("Failed to decode");
  }
}

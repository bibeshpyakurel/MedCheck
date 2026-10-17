import { describe, expect, it } from "vitest";
import {
  authErrorCode,
  capturePath,
  emailLocalPart,
  fullName,
  isEmail,
  linkErrorTarget,
  nameFromMetadata,
  normalizeOtp,
  requestOrigin,
  signInErrorMessage,
} from "./account";

describe("capturePath", () => {
  it("is the person's add-a-medicine page", () => {
    expect(capturePath("abc")).toBe("/patients/abc/add");
  });
});

describe("names", () => {
  it("joins first and last name, ignoring blanks", () => {
    expect(fullName(" Jamie ", " Rivera ")).toBe("Jamie Rivera");
    expect(fullName("Jamie", "")).toBe("Jamie");
    expect(fullName("", "Rivera")).toBe("Rivera");
    expect(fullName("  ", null)).toBeNull();
    expect(fullName(undefined, 42)).toBeNull();
  });

  it("caps the name at 120 characters", () => {
    expect(fullName("a".repeat(100), "b".repeat(100))).toHaveLength(120);
  });

  it("reads a name from sign-in metadata (Google or the email form)", () => {
    expect(nameFromMetadata({ full_name: "Jamie Rivera", name: "J R" })).toBe("Jamie Rivera");
    expect(nameFromMetadata({ name: "Jamie Rivera" })).toBe("Jamie Rivera");
    expect(nameFromMetadata({ given_name: "Jamie", family_name: "Rivera" })).toBe("Jamie Rivera");
    expect(nameFromMetadata({ first_name: "Jamie", last_name: "" })).toBe("Jamie");
    expect(nameFromMetadata({ email: "x@y.z" })).toBeNull();
    expect(nameFromMetadata(undefined)).toBeNull();
  });

  it("uses the part of an email before the @", () => {
    expect(emailLocalPart("jamie.rivera@example.com")).toBe("jamie.rivera");
    expect(emailLocalPart("nobody")).toBe("nobody");
  });
});

describe("isEmail", () => {
  it("accepts ordinary addresses and rejects the rest", () => {
    expect(isEmail("a@b.co")).toBe(true);
    expect(isEmail("medcheck.e2e+laneA@example.com")).toBe(true);
    expect(isEmail("")).toBe(false);
    expect(isEmail("a@b")).toBe(false);
    expect(isEmail("a b@c.com")).toBe(false);
  });
});

describe("normalizeOtp", () => {
  it("accepts 6 to 8 digits, ignoring spaces and dashes", () => {
    expect(normalizeOtp("123456")).toBe("123456");
    expect(normalizeOtp(" 123 456 ")).toBe("123456");
    expect(normalizeOtp("1234-5678")).toBe("12345678");
  });

  it("rejects anything else", () => {
    expect(normalizeOtp("12345")).toBeNull();
    expect(normalizeOtp("123456789")).toBeNull();
    expect(normalizeOtp("12a456")).toBeNull();
    expect(normalizeOtp("")).toBeNull();
  });
});

describe("authErrorCode", () => {
  it("maps rate limits", () => {
    expect(authErrorCode({ code: "over_email_send_rate_limit", message: "email rate limit exceeded" }, "send")).toBe("rate");
    expect(authErrorCode({ status: 429, message: "Too many requests" }, "verify")).toBe("rate");
    expect(authErrorCode({ message: "email rate limit exceeded" }, "send")).toBe("rate");
  });

  it("maps addresses the mailer refuses", () => {
    expect(
      authErrorCode({ code: "email_address_not_authorized", message: 'Email address "x" cannot be used' }, "send"),
    ).toBe("address");
    expect(authErrorCode({ code: "email_address_invalid", message: "invalid" }, "send")).toBe("email");
  });

  it("maps wrong or expired codes", () => {
    expect(authErrorCode({ code: "otp_expired", message: "Token has expired or is invalid" }, "verify")).toBe("code");
    expect(authErrorCode({ message: "Token has expired or is invalid" }, "verify")).toBe("code");
  });

  it("falls back to a generic error for the stage", () => {
    expect(authErrorCode({ message: "boom" }, "send")).toBe("send");
    expect(authErrorCode({ message: "boom" }, "verify")).toBe("verify");
  });
});

describe("signInErrorMessage", () => {
  it("has plain-English messages for known codes", () => {
    expect(signInErrorMessage("google")).toBe(
      "Google sign-in isn't available right now. Use email or continue as a guest.",
    );
    expect(signInErrorMessage("rate")).toMatch(/wait/i);
    expect(signInErrorMessage("code")).toMatch(/expired/i);
  });

  it("ignores unknown or missing codes", () => {
    expect(signInErrorMessage(undefined)).toBeNull();
    expect(signInErrorMessage("toString")).toBeNull();
    expect(signInErrorMessage(["rate"])).toBeNull();
  });
});

describe("linkErrorTarget", () => {
  it("sends email-link failures back to the email sign-in page", () => {
    expect(linkErrorTarget({ errorCode: "otp_expired" })).toBe("/sign-in?error=link");
    expect(linkErrorTarget({ message: "PKCE code verifier not found in storage" })).toBe("/sign-in?error=link");
    expect(linkErrorTarget({ message: "invalid flow state, no valid flow state found" })).toBe("/sign-in?error=link");
  });

  it("treats everything else as a Google failure", () => {
    expect(linkErrorTarget({ errorCode: "bad_oauth_state" })).toBe("/?error=google");
    expect(linkErrorTarget({})).toBe("/?error=google");
  });
});

describe("requestOrigin", () => {
  const h = (values: Record<string, string>) => ({ get: (k: string) => values[k] ?? null });

  it("prefers the Origin header", () => {
    expect(requestOrigin(h({ origin: "https://medcheck.app", host: "x" }))).toBe("https://medcheck.app");
  });

  it("falls back to forwarded host and protocol", () => {
    expect(requestOrigin(h({ "x-forwarded-host": "medcheck.app", "x-forwarded-proto": "https", host: "x" }))).toBe(
      "https://medcheck.app",
    );
    expect(requestOrigin(h({ host: "localhost:3000" }))).toBe("http://localhost:3000");
  });
});

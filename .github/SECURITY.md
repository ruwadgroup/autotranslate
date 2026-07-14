# Security policy

## Supported versions

`autotranslate` follows semver. We patch security issues on the **latest minor
of the latest major** of every package. Older majors get fixes only if the
vulnerability is exploitable in production and the fix is non-breaking.

## Reporting a vulnerability

**Do not open a public issue.** Use one of:

1. **Preferred:** GitHub's
   [private security advisory](https://github.com/ruwadgroup/autotranslate/security/advisories/new).
2. Email **tamimbinhakim.work@gmail.com** with the subject
   `[autotranslate security]`.

Include:

- Affected package(s) and version(s)
- A minimal reproduction or proof-of-concept
- Impact assessment (data leak, RCE, supply-chain, etc.)

You'll get an acknowledgement within **72 hours** and a fix or status update
within **7 days** for confirmed issues.

## What we treat as security-relevant

- Code execution from translation provider responses
- Path traversal in extractor / config loader
- Prompt injection that exfiltrates API keys
- Supply-chain risks (lockfile, dependency, install scripts)
- ESLint plugin rule bypasses that disable safety checks

Issues that are **not** security-relevant: missed translations, slow
performance, broken provider integrations — please use the regular issue
tracker.

## Coordinated disclosure

Once a fix lands, we publish a GitHub Security Advisory and credit the reporter
(unless they prefer to stay anonymous). CVEs are requested for any vulnerability
with CVSS ≥ 4.

## Provenance

Every published package on npm uses
[npm provenance](https://docs.npmjs.com/generating-provenance-statements) via
the GitHub Actions OIDC release flow. Verify with:

```bash
npm audit signatures
```

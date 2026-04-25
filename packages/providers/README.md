# @autotranslate/providers

Pluggable translation providers. AI providers wrap the
[Vercel AI SDK](https://sdk.vercel.ai/) — bring any model. MT providers offer
cheap fallbacks for short, unambiguous strings.

| Subpath   | Provider                                                          |
| --------- | ----------------------------------------------------------------- |
| `/ai`     | Vercel AI SDK (OpenAI, Anthropic, Google, Mistral, OpenRouter, …) |
| `/deepl`  | DeepL                                                             |
| `/google` | Google Cloud Translation                                          |
| `/stub`   | Identity / pseudo-localization (testing)                          |

A `custom` provider with `translateFn` is exported from
`@autotranslate/core/config` so you can plug in any HTTP API.

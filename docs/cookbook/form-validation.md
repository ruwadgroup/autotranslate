# Translating form-validation errors

Three popular form libraries, each consuming Zod errors as plain strings.
Translation flows through `@autotranslate/zod` automatically.

## Setup

Once, at app startup:

```ts
import { z } from 'zod';
import { zodErrorMap } from '@autotranslate/zod';

z.config({ customError: zodErrorMap });
```

Then bind a translator. On servers, binding is handled per-request by
`withRequestTranslator` (see [Zod integration](../integrations/zod.md)). In
SPAs, call `bindTranslator(translator)` once at boot alongside `z.config(...)`.

Add the package's source module to your `content` glob so the standard issue
keys land in your catalog:

```ts
// autotranslate.config.ts
defineConfig({
  content: ['src/**/*.{ts,tsx}', '@autotranslate/zod/source'],
  // ...
});
```

## react-hook-form

```tsx
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const schema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

type FormValues = z.infer<typeof schema>;

export function SignUpForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  return (
    <form onSubmit={handleSubmit(submit)}>
      <input {...register('email')} />
      {errors.email && <p>{errors.email.message}</p>}
      <input {...register('password')} type="password" />
      {errors.password && <p>{errors.password.message}</p>}
      <button type="submit">Sign up</button>
    </form>
  );
}
```

`errors.email.message` is already translated. No extra wiring; `zodResolver`
calls `safeParse` which goes through your `customError` map.

## TanStack Form

```tsx
import { useForm } from '@tanstack/react-form';
import { z } from 'zod';

const schema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

export function SignUpForm() {
  const form = useForm({
    defaultValues: { email: '', password: '' },
    validators: { onChange: schema },
    onSubmit: async ({ value }) => {
      /* ... */
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      <form.Field
        name="email"
        children={(field) => (
          <>
            <input
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
            />
            {field.state.meta.errors.map((err) => (
              <p key={err}>{err}</p>
            ))}
          </>
        )}
      />
      {/* ...password field... */}
    </form>
  );
}
```

TanStack Form takes a Standard Schema (which Zod v4 implements) and renders each
issue's `.message` directly.

## zod-form-data + Server Actions

```ts
// app/actions.ts
'use server';

import { withRequestTranslator } from '@autotranslate/zod/next';
import { zfd } from 'zod-form-data';
import { z } from 'zod';
import * as catalogModule from '../../.translations';

const schema = zfd.formData({
  email: zfd.text(z.email()),
  password: zfd.text(z.string().min(8)),
});

export async function signUp(formData: FormData) {
  return withRequestTranslator(
    async () => {
      const result = schema.safeParse(formData);
      if (!result.success) {
        return {
          ok: false,
          errors: result.error.flatten().fieldErrors, // already translated
        };
      }
      // ... create user
      return { ok: true };
    },
    { module: catalogModule },
  );
}
```

The error map runs inside `withRequestTranslator`, so every message in
`fieldErrors` reflects the request's locale.

## Custom error messages

Either the Zod-native API (`{ error: () => t(...) }`) or top-level
`refine`/`check` with the standalone `t()`:

```ts
import { t } from '@autotranslate/core/t';

const schema = z
  .object({
    username: z.string().refine(isAvailable, {
      error: () => t('That username is taken'),
    }),
    password: z.string().min(8, {
      error: () => t('Use at least 8 characters'),
    }),
  })
  .refine((d) => d.username !== d.password, {
    error: () => t("Username and password can't match"),
    path: ['password'],
  });
```

Every literal flows through extraction, translation, and typegen like any other
`t()` call.

## Tips

- **Don't translate field labels through Zod.** Field labels live in your JSX
  (`<label>`). Translate them with `<T>` or `useT` - Zod errors only cover the
  validation message.

- **`safeParse`, not `parse`, in form components.** You want to render errors,
  not throw.

- **Validate on submit + on blur.** `zodResolver` and TanStack Form's `onChange`
  validators run on every keystroke if you let them. Pair with `mode: 'onBlur'`
  on react-hook-form for less noisy error rendering.

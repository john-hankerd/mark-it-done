// Customizes the root HTML document for the web build. Expo's default
// template sets `html, body, #root { height: 100% }` with `overflow: hidden`
// on body — on a phone browser, `100%`/`100vh` measures the LARGEST
// possible viewport (as if the browser's own address bar / bottom toolbar
// were hidden), which is taller than what's actually visible while that
// toolbar is showing. Combined with overflow:hidden, whatever falls in that
// gap — here, the bottom tab bar — is clipped and inaccessible, not just
// scrolled off. `100dvh` (dynamic viewport height) tracks the real visible
// area instead, and `viewport-fit=cover` is what lets that value (and
// `env(safe-area-inset-*)`, used by SafeAreaView) resolve correctly at all.
import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <ScrollViewStyleReset />
        <style
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: `html, body, #root { height: 100vh; height: 100dvh; }`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

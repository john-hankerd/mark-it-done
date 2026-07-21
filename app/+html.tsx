// Customizes the root HTML document for the web build. Expo's default
// template sets `html, body, #root { height: 100% }` with `overflow: hidden`
// on body — on a phone browser, `100%`/`100vh` measures the LARGEST
// possible viewport (as if the browser's own address bar / bottom toolbar
// were hidden), which is taller than what's actually visible while that
// toolbar is showing. Combined with overflow:hidden, whatever falls in that
// gap — here, the bottom tab bar — is clipped and inaccessible, not just
// scrolled off. `100dvh` (dynamic viewport height) tracks the real visible
// area instead.
//
// Deliberately NOT setting `viewport-fit=cover` here: on Android's classic
// 3-button nav bar, that flag tells the browser to draw content edge-to-edge
// behind system UI, but Android (unlike iOS) often doesn't report that space
// back via `env(safe-area-inset-bottom)` — so nothing compensates, and the
// tab bar renders right underneath the opaque nav bar, fully hidden. Without
// `viewport-fit=cover`, the browser keeps content clear of system UI on its
// own, which is what we want.
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
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
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

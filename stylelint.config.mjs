/**
 * Styling gate — enforces the architecture in docs/standards/ui.md.
 *
 * The headline rule: colors come from design tokens, never raw hex literals in
 * components/layout/base. `tokens.css` defines the palette and `print.css`
 * intentionally hard-codes ink-on-paper, so both are exempt.
 */
export default {
  rules: {
    "color-no-hex": true,
  },
  overrides: [
    {
      files: ["**/styles/tokens.css", "**/styles/print.css"],
      rules: { "color-no-hex": null },
    },
  ],
};

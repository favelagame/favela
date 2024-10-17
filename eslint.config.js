import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";

const MAX_DEPTH = 4;

export default [
    { files: ["**/*.{js,mjs,cjs,ts}"] },
    { languageOptions: { globals: globals.browser } },
    pluginJs.configs.recommended,
    ...tseslint.configs.recommended,
    {
        rules: {
            camelcase: ["error", { properties: "always" }],
            "class-methods-use-this": "error",
            curly: ["error", "multi-line"],
            "max-depth": ["error", MAX_DEPTH],
        },
    },
];

// @ts-check
import eslint from "@eslint/js";
import paths from "eslint-plugin-paths";
import tseslint from "typescript-eslint";

export default tseslint.config(
    { ignores: ["dist"] },
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    {
        plugins: { "eslint-plugin-paths": paths },
        rules: {
            camelcase: ["error", { properties: "always" }],
            "class-methods-use-this": "error",
            curly: ["error", "multi-line"],
            "eslint-plugin-paths/alias": "error",
            "max-depth": ["error", 4],
        },
    }
);

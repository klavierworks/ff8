const {
    defineConfig,
    globalIgnores,
} = require("eslint/config");

const globals = require("globals");

const {
    fixupConfigRules,
    fixupPluginRules,
} = require("@eslint/compat");

const tsParser = require("@typescript-eslint/parser");
const reactRefresh = require("eslint-plugin-react-refresh");
const typescriptEslint = require("@typescript-eslint/eslint-plugin");
const react = require("eslint-plugin-react");
const jsxA11y = require("eslint-plugin-jsx-a11y");
const importPlugin = require("eslint-plugin-import");
const canonical = require("eslint-plugin-canonical");
const perfectionist = require("eslint-plugin-perfectionist");
const stylistic = require("@stylistic/eslint-plugin");
const reactThree = require("@react-three/eslint-plugin");
const js = require("@eslint/js");

const {
    FlatCompat,
} = require("@eslint/eslintrc");

const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

const OFF = 0;
const WARN = 1;
const ERROR = 2;

module.exports = defineConfig([{
    languageOptions: {
        globals: {
            ...globals.browser,
        },

        parser: tsParser,

        parserOptions: {
            "project": ["./tsconfig.json"],
        },
    },

    extends: fixupConfigRules(compat.extends(
        "eslint:recommended",
        "plugin:@typescript-eslint/recommended",
        "plugin:react-hooks/recommended",
        "plugin:perfectionist/recommended-natural-legacy",
        "plugin:prettier/recommended",
    )),

    plugins: {
        "react-refresh": reactRefresh,
        "@typescript-eslint": fixupPluginRules(typescriptEslint),
        "react": fixupPluginRules(react),
        "jsx-a11y": fixupPluginRules(jsxA11y),
        "import": fixupPluginRules(importPlugin),
        "canonical": fixupPluginRules(canonical),
        "perfectionist": fixupPluginRules(perfectionist),
        "@stylistic": stylistic,
        "@react-three": fixupPluginRules(reactThree),
    },

    rules: {
        "@react-three/no-clone-in-loop": ERROR,
        "@react-three/no-new-in-loop": ERROR,
        "@stylistic/brace-style": [ERROR, "1tbs"],
        // Line length is enforced by prettier (printWidth: 120); eslint max-len duplicates and isn't autofixable.
        "@stylistic/max-len": OFF,
        "@stylistic/no-tabs": OFF,
        "canonical/destructuring-property-newline": OFF,
        "canonical/export-specifier-newline": OFF,
        "canonical/filename-match-exported": OFF,
        "canonical/filename-match-regex": OFF,
        "canonical/filename-no-index": OFF,
        "canonical/id-match": OFF,
        "canonical/import-specifier-newline": OFF,
        "canonical/no-restricted-strings": OFF,
        "canonical/no-use-extend-native": OFF,
        "canonical/prefer-import-alias": OFF,
        "canonical/prefer-inline-type-import": OFF,
        "canonical/prefer-use-mount": OFF,
        curly: [ERROR, "all"],
        "import/no-extraneous-dependencies": [
            ERROR,
            {
                devDependencies: true,
                optionalDependencies: false,
                peerDependencies: false,
            },
        ],
        "import/order": OFF,
        "jsx-a11y/alt-text": OFF,
        "jsx-a11y/click-events-have-key-events": OFF,
        "jsx-a11y/control-has-associated-label": OFF,
        "jsx-a11y/html-has-lang": OFF,
        "jsx-a11y/iframe-has-title": OFF,
        "jsx-a11y/label-has-associated-label": OFF,
        "jsx-a11y/media-has-caption": OFF,
        "jsx-a11y/no-autofocus": OFF,
        "jsx-a11y/no-noninteractive-tabindex": OFF,
        "jsx-a11y/no-static-element-interactions": OFF,
        "no-console": OFF,
        "no-dupe-keys": ERROR,
        radix: [ERROR, "as-needed"],
        "react-hooks/exhaustive-deps": ERROR,
        "react-hooks/rules-of-hooks": ERROR,
        "react/forbid-prop-types": [
            ERROR,
            {
                forbid: ["any", "array"],
            },
        ],
        "react/function-component-definition": [
            ERROR,
            {
                namedComponents: "arrow-function",
            },
        ],
        "react/jsx-curly-brace-presence": [
            ERROR,
            {
                children: "ignore",
                props: "never",
            },
        ],
        "react/jsx-filename-extension": OFF,
        "react/jsx-key": [
            ERROR,
            {
                checkFragmentShorthand: true,
                checkKeyMustBeforeSpread: true,
                warnOnDuplicates: true,
            },
        ],
        "react/jsx-props-no-spreading": OFF,
        "react/jsx-sort-props": [
            ERROR,
            {
                callbacksLast: false,
                ignoreCase: false,
                noSortAlphabetically: false,
                reservedFirst: false,
                shorthandFirst: false,
                shorthandLast: false,
            },
        ],
        "react/no-danger": OFF,
        // R3F surfaces dozens of three.js properties as JSX props (position, rotation, args, attach, intensity, …);
        // enumerating them is impractical. @react-three/eslint-plugin doesn't extend the allowlist either.
        "react/no-unknown-property": OFF,
        "react/react-in-jsx-scope": OFF,
        "react/sort-comp": OFF,
        "react/state-in-constructor": OFF,
        "react/static-property-placement": OFF,
        // Handled by perfectionist sort-objects rule (autofixable); the core sort-keys is not autofixable
        "sort-keys": OFF,
        "react-refresh/only-export-components": [
            WARN,
            { allowConstantExport: true },
        ],
    },

    settings: {
        react: {
            version: "detect",
        },
    },
}, globalIgnores(["**/dist", "**/.eslintrc.js", "**/eslint.config.cjs", "src/Field/Scripts/Model/gltf/**"])]);

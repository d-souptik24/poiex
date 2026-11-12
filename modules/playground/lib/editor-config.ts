import type { Monaco } from "@monaco-editor/react";
import type { editor } from "monaco-editor";

export const getEditorLanguage = (fileExtension: string): string => {
    const extension = fileExtension.toLowerCase();
    const languageMap: Record<string, string> = {
        // JavaScript/TypeScript
        js: "javascript",
        jsx: "javascript",
        ts: "typescript",
        tsx: "typescript",
        mjs: "javascript",
        cjs: "javascript",

        // Web languages
        json: "json",
        html: "html",
        htm: "html",
        css: "css",
        scss: "scss",
        sass: "scss",
        less: "less",

        // Markup/Documentation
        md: "markdown",
        markdown: "markdown",
        xml: "xml",
        yaml: "yaml",
        yml: "yaml",

        // Programming languages
        py: "python",
        python: "python",
        java: "java",
        c: "c",
        cpp: "cpp",
        cs: "csharp",
        php: "php",
        rb: "ruby",
        go: "go",
        rs: "rust",
        sh: "shell",
        bash: "shell",
        sql: "sql",

        // Config files
        toml: "ini",
        ini: "ini",
        conf: "ini",
        dockerfile: "dockerfile",
    };

    return languageMap[extension] || "plaintext";
};

export interface EditorThemeOption {
    id: string;
    label: string;
    previewBg: string;
}

export const EDITOR_THEMES: readonly EditorThemeOption[] = [
    { id: "modern-dark", label: "Modern Dark", previewBg: "#0D1117" },
    { id: "vs-dark", label: "VS Code Dark", previewBg: "#1E1E1E" },
    { id: "modern-light", label: "Modern Light", previewBg: "#FAFBFC" },
    { id: "light", label: "VS Code Light", previewBg: "#FFFFFF" },
] as const;

export const configureMonaco = (monaco: Monaco) => {
    // Define a beautiful modern dark theme
    monaco.editor.defineTheme("modern-dark", {
        base: "vs-dark",
        inherit: true,
        rules: [
            // Comments
            { token: "comment", foreground: "7C7C7C", fontStyle: "italic" },
            { token: "comment.line", foreground: "7C7C7C", fontStyle: "italic" },
            { token: "comment.block", foreground: "7C7C7C", fontStyle: "italic" },

            // Keywords
            { token: "keyword", foreground: "C586C0", fontStyle: "bold" },
            { token: "keyword.control", foreground: "C586C0", fontStyle: "bold" },
            { token: "keyword.operator", foreground: "D4D4D4" },

            // Strings
            { token: "string", foreground: "CE9178" },
            { token: "string.quoted", foreground: "CE9178" },
            { token: "string.template", foreground: "CE9178" },

            // Numbers
            { token: "number", foreground: "B5CEA8" },
            { token: "number.hex", foreground: "B5CEA8" },
            { token: "number.float", foreground: "B5CEA8" },

            // Functions
            { token: "entity.name.function", foreground: "DCDCAA" },
            { token: "support.function", foreground: "DCDCAA" },

            // Variables
            { token: "variable", foreground: "9CDCFE" },
            { token: "variable.parameter", foreground: "9CDCFE" },
            { token: "variable.other", foreground: "9CDCFE" },

            // Types
            { token: "entity.name.type", foreground: "4EC9B0" },
            { token: "support.type", foreground: "4EC9B0" },
            { token: "storage.type", foreground: "569CD6" },

            // Classes
            { token: "entity.name.class", foreground: "4EC9B0" },
            { token: "support.class", foreground: "4EC9B0" },

            // Constants
            { token: "constant", foreground: "4FC1FF" },
            { token: "constant.language", foreground: "569CD6" },
            { token: "constant.numeric", foreground: "B5CEA8" },

            // Operators
            { token: "keyword.operator", foreground: "D4D4D4" },
            { token: "punctuation", foreground: "D4D4D4" },

            // HTML/XML
            { token: "tag", foreground: "569CD6" },
            { token: "tag.id", foreground: "9CDCFE" },
            { token: "tag.class", foreground: "92C5F8" },
            { token: "attribute.name", foreground: "9CDCFE" },
            { token: "attribute.value", foreground: "CE9178" },

            // CSS
            { token: "attribute.name.css", foreground: "9CDCFE" },
            { token: "attribute.value.css", foreground: "CE9178" },
            { token: "property-name.css", foreground: "9CDCFE" },
            { token: "property-value.css", foreground: "CE9178" },

            // JSON
            { token: "key", foreground: "9CDCFE" },
            { token: "string.key", foreground: "9CDCFE" },
            { token: "string.value", foreground: "CE9178" },

            // Error/Warning
            { token: "invalid", foreground: "F44747", fontStyle: "underline" },
            { token: "invalid.deprecated", foreground: "D4D4D4", fontStyle: "strikethrough" },
        ],
        colors: {
            // Editor background
            "editor.background": "#0D1117",
            "editor.foreground": "#E6EDF3",

            // Line numbers
            "editorLineNumber.foreground": "#7D8590",
            "editorLineNumber.activeForeground": "#F0F6FC",

            // Cursor
            "editorCursor.foreground": "#F0F6FC",

            // Selection
            "editor.selectionBackground": "#264F78",
            "editor.selectionHighlightBackground": "#ADD6FF26",
            "editor.inactiveSelectionBackground": "#3A3D41",

            // Current line
            "editor.lineHighlightBackground": "#21262D",
            "editor.lineHighlightBorder": "#30363D",

            // Gutter
            "editorGutter.background": "#0D1117",
            "editorGutter.modifiedBackground": "#BB800966",
            "editorGutter.addedBackground": "#347D3966",
            "editorGutter.deletedBackground": "#F8514966",

            // Scrollbar
            "scrollbar.shadow": "#0008",
            "scrollbarSlider.background": "#6E768166",
            "scrollbarSlider.hoverBackground": "#6E768188",
            "scrollbarSlider.activeBackground": "#6E7681BB",

            // Minimap
            "minimap.background": "#161B22",
            "minimap.selectionHighlight": "#264F78",

            // Find/Replace
            "editor.findMatchBackground": "#9E6A03",
            "editor.findMatchHighlightBackground": "#F2CC6080",
            "editor.findRangeHighlightBackground": "#3FB95040",

            // Word highlight
            "editor.wordHighlightBackground": "#575757B8",
            "editor.wordHighlightStrongBackground": "#004972B8",

            // Brackets
            "editorBracketMatch.background": "#0064001A",
            "editorBracketMatch.border": "#888888",

            // Indentation guides
            "editorIndentGuide.background": "#21262D",
            "editorIndentGuide.activeBackground": "#30363D",

            // Ruler
            "editorRuler.foreground": "#21262D",

            // Ghost text (inline AI completions - muted gray)
            "editorGhostText.foreground": "#7D8590",
            "editorGhostText.background": "transparent",
            "editorGhostText.border": "transparent",

            // Whitespace
            "editorWhitespace.foreground": "#6E7681",

            // Error/Warning squiggles
            "editorError.foreground": "#F85149",
            "editorWarning.foreground": "#D29922",
            "editorInfo.foreground": "#75BEFF",
            "editorHint.foreground": "#EEEEEE",

            // Suggest widget
            "editorSuggestWidget.background": "#161B22",
            "editorSuggestWidget.border": "#30363D",
            "editorSuggestWidget.foreground": "#E6EDF3",
            "editorSuggestWidget.selectedBackground": "#21262D",

            // Hover widget
            "editorHoverWidget.background": "#161B22",
            "editorHoverWidget.border": "#30363D",

            // Panel
            "panel.background": "#0D1117",
            "panel.border": "#30363D",

            // Activity bar
            "activityBar.background": "#0D1117",
            "activityBar.foreground": "#E6EDF3",
            "activityBar.border": "#30363D",

            // Side bar
            "sideBar.background": "#0D1117",
            "sideBar.foreground": "#E6EDF3",
            "sideBar.border": "#30363D",
        },
    });

    // Define a beautiful modern light theme (GitHub/Linear inspired, soft & non-glaring)
    const modernLightRules: editor.ITokenThemeRule[] = [
        { token: "comment", foreground: "6E7781", fontStyle: "italic" },
        { token: "comment.line", foreground: "6E7781", fontStyle: "italic" },
        { token: "comment.block", foreground: "6E7781", fontStyle: "italic" },
        { token: "keyword", foreground: "CF222E", fontStyle: "bold" },
        { token: "keyword.control", foreground: "CF222E", fontStyle: "bold" },
        { token: "keyword.operator", foreground: "0550AE" },
        { token: "string", foreground: "0A3069" },
        { token: "string.quoted", foreground: "0A3069" },
        { token: "string.template", foreground: "0A3069" },
        { token: "number", foreground: "0550AE" },
        { token: "number.hex", foreground: "0550AE" },
        { token: "number.float", foreground: "0550AE" },
        { token: "entity.name.function", foreground: "8250DF" },
        { token: "support.function", foreground: "8250DF" },
        { token: "variable", foreground: "24292F" },
        { token: "variable.parameter", foreground: "953800" },
        { token: "variable.other", foreground: "24292F" },
        { token: "entity.name.type", foreground: "953800" },
        { token: "support.type", foreground: "953800" },
        { token: "storage.type", foreground: "CF222E" },
        { token: "entity.name.class", foreground: "953800" },
        { token: "support.class", foreground: "953800" },
        { token: "constant", foreground: "0550AE" },
        { token: "constant.language", foreground: "CF222E" },
        { token: "constant.numeric", foreground: "0550AE" },
        { token: "punctuation", foreground: "57606A" },
        { token: "tag", foreground: "116329" },
        { token: "tag.id", foreground: "0550AE" },
        { token: "tag.class", foreground: "8250DF" },
        { token: "attribute.name", foreground: "0550AE" },
        { token: "attribute.value", foreground: "0A3069" },
        { token: "attribute.name.css", foreground: "0550AE" },
        { token: "attribute.value.css", foreground: "0A3069" },
        { token: "property-name.css", foreground: "0550AE" },
        { token: "property-value.css", foreground: "0A3069" },
        { token: "key", foreground: "0550AE" },
        { token: "string.key", foreground: "0550AE" },
        { token: "string.value", foreground: "0A3069" },
        { token: "invalid", foreground: "CF222E", fontStyle: "underline" },
        { token: "invalid.deprecated", foreground: "6E7781", fontStyle: "strikethrough" },
    ];

    const modernLightColors = {
        "editor.background": "#FAFBFC",
        "editor.foreground": "#24292F",
        "editorLineNumber.foreground": "#8C959F",
        "editorLineNumber.activeForeground": "#24292F",
        "editorCursor.foreground": "#24292F",
        "editor.selectionBackground": "#CCE5FF",
        "editor.selectionHighlightBackground": "#E8F2FF",
        "editor.inactiveSelectionBackground": "#EBF2FF",
        "editor.lineHighlightBackground": "#F1F3F5",
        "editor.lineHighlightBorder": "#E1E4E800",
        "editorGutter.background": "#FAFBFC",
        "editorGutter.modifiedBackground": "#D4A72C",
        "editorGutter.addedBackground": "#2DA44E",
        "editorGutter.deletedBackground": "#CF222E",
        "scrollbar.shadow": "#00000010",
        "scrollbarSlider.background": "#D0D7DE66",
        "scrollbarSlider.hoverBackground": "#D0D7DEAA",
        "scrollbarSlider.activeBackground": "#D0D7DECC",
        "minimap.background": "#F6F8FA",
        "minimap.selectionHighlight": "#CCE5FF",
        "editor.findMatchBackground": "#FFD33D",
        "editor.findMatchHighlightBackground": "#FFEAA780",
        "editor.wordHighlightBackground": "#EBF2FF",
        "editorBracketMatch.background": "#CCE5FF40",
        "editorBracketMatch.border": "#0550AE",
        "editorIndentGuide.background": "#E1E4E8",
        "editorIndentGuide.activeBackground": "#C6CBD1",
        "editorRuler.foreground": "#E1E4E8",
        "editorGhostText.foreground": "#6E7781",
        "editorGhostText.background": "transparent",
        "editorGhostText.border": "transparent",
        "editorWhitespace.foreground": "#D0D7DE",
        "editorError.foreground": "#CF222E",
        "editorWarning.foreground": "#9A6700",
        "editorInfo.foreground": "#0550AE",
        "editorSuggestWidget.background": "#FFFFFF",
        "editorSuggestWidget.border": "#D0D7DE",
        "editorSuggestWidget.foreground": "#24292F",
        "editorSuggestWidget.selectedBackground": "#EBF2FF",
        "editorHoverWidget.background": "#FFFFFF",
        "editorHoverWidget.border": "#D0D7DE",
    };

    monaco.editor.defineTheme("modern-light", {
        base: "vs",
        inherit: true,
        rules: modernLightRules,
        colors: modernLightColors,
    });

    monaco.editor.defineTheme("light", {
        base: "vs",
        inherit: true,
        rules: modernLightRules,
        colors: modernLightColors,
    });


    // Configure additional editor settings
    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: false,
        noSyntaxValidation: false,
    });

    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: false,
        noSyntaxValidation: false,
    });

    // Set compiler options for better IntelliSense
    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.Latest,
        allowNonTsExtensions: true,
        moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
        module: monaco.languages.typescript.ModuleKind.CommonJS,
        noEmit: true,
        esModuleInterop: true,
        jsx: monaco.languages.typescript.JsxEmit.React,
        reactNamespace: "React",
        allowJs: true,
        typeRoots: ["node_modules/@types"],
    });

    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.Latest,
        allowNonTsExtensions: true,
        moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
        module: monaco.languages.typescript.ModuleKind.CommonJS,
        noEmit: true,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        jsx: monaco.languages.typescript.JsxEmit.React,
        reactNamespace: "React",
        allowJs: true,
        typeRoots: ["node_modules/@types"],
    });
};

export const defaultEditorOptions: editor.IStandaloneEditorConstructionOptions = {
    // Font settings
    fontSize: 14,
    fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, 'Liberation Mono', Menlo, Courier, monospace",
    fontLigatures: true,
    fontWeight: "400",

    // Layout
    minimap: {
        enabled: true,
        size: "proportional",
        showSlider: "mouseover"
    },
    scrollBeyondLastLine: false,
    automaticLayout: true,
    padding: { top: 16, bottom: 16 },

    // Line settings
    lineNumbers: "on",
    lineHeight: 20,
    renderLineHighlight: "all",
    renderWhitespace: "selection",

    // Indentation
    tabSize: 2,
    insertSpaces: true,
    detectIndentation: true,

    // Word wrapping
    wordWrap: "on",
    wordWrapColumn: 120,
    wrappingIndent: "indent",

    // Code folding
    folding: true,
    foldingHighlight: true,
    foldingStrategy: "indentation",
    showFoldingControls: "mouseover",

    // Scrolling
    smoothScrolling: true,
    mouseWheelZoom: true,
    fastScrollSensitivity: 5,

    // Selection
    multiCursorModifier: "ctrlCmd",
    selectionHighlight: true,
    occurrencesHighlight: "singleFile",

    // Suggestions
    suggestOnTriggerCharacters: true,
    acceptSuggestionOnEnter: "on",
    tabCompletion: "on",
    wordBasedSuggestions: "currentDocument",
    quickSuggestions: {
        other: true,
        comments: false,
        strings: false
    },

    // Formatting
    formatOnPaste: true,
    formatOnType: true,

    // Bracket matching
    matchBrackets: "always",
    bracketPairColorization: {
        enabled: true
    },

    // Guides
    guides: {
        indentation: true,
        highlightActiveIndentation: true,
    },
    rulers: [80, 120],

    // Performance
    disableLayerHinting: false,
    disableMonospaceOptimizations: false,

    // Accessibility
    accessibilitySupport: "auto",

    // Cursor
    cursorBlinking: "smooth",
    cursorSmoothCaretAnimation: "on",
    cursorStyle: "line",
    cursorWidth: 2,

    // Find
    find: {
        addExtraSpaceOnTop: false,
        autoFindInSelection: "never",
        seedSearchStringFromSelection: "always"
    },

    // Hover
    hover: {
        enabled: "on",
        delay: 300,
        sticky: true
    },

    // Semantic highlighting
    "semanticHighlighting.enabled": true,

    // Sticky scroll
    stickyScroll: {
        enabled: true
    }
};
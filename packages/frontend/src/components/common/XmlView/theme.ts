import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { classHighlighter, tags } from "@lezer/highlight";

const highlightStyle = HighlightStyle.define([
  { tag: tags.angleBracket, color: "#808080" },
  { tag: tags.attributeValue, color: "#ce9178" },
  { tag: tags.blockComment, color: "#608b4e" },
  { tag: tags.className, color: "#569cd6" },
  { tag: tags.keyword, color: "#ce9178" },
  { tag: tags.labelName, color: "#569cd6" },
  { tag: tags.literal, color: "#90c191" },
  { tag: tags.name, color: "#90c191" },
  { tag: tags.null, color: "#d2a8ff" },
  { tag: tags.number, color: "#b5cea8" },
  { tag: tags.propertyName, color: "#90c191" },
  { tag: tags.tagName, color: "#569cd6" },
  { tag: tags.variableName, color: "#ce9178" },
  { tag: tags.documentMeta, color: "#a0a0a0" },
  { tag: tags.separator, color: "#a0a0a0" },
]);

const editorTheme = EditorView.theme(
  {
    "&": {
      height: "auto",
      "font-size": "var(--c-editor-font-size)",
      "-webkit-user-select": "initial",
    },

    "&.cm-focused": {
      outline: "unset",
    },

    ".cm-content": {
      flex: "1",
      "min-width": "0",
      "-webkit-user-select": "initial",
      "user-select": "text",
    },

    ".cm-lineWrapping": {
      "word-break": "break-all",
    },

    ".cm-scroller": {
      overflow: "visible",
      "font-family": "Menlo, Monaco, Consolas, monospace",
      "font-size": "0.9em",
    },

    ".cm-gutters": {
      "background-color": "rgba(0, 0, 0, 0)",
      border: "none",
    },

    ".cm-lineNumbers .cm-gutterElement": {
      color: "rgba(255, 255, 255, 0.5)",
      "user-select": "none",
      "-webkit-user-select": "none",
    },

    ".cm-scroller > .cm-selectionLayer > .cm-selectionBackground": {
      background: "rgba(255, 255, 255, 0.15)",
    },

    "&.cm-focused > .cm-scroller > .cm-selectionLayer > .cm-selectionBackground":
      {
        background: "rgba(255, 255, 255, 0.3)",
      },

    ".cm-activeLine, .cm-activeLineGutter": {
      "background-color": "rgba(0, 0, 0, 0)",
    },
  },
  { dark: true },
);

export const buildTheme = (): Extension[] => [
  editorTheme,
  syntaxHighlighting(highlightStyle),
  syntaxHighlighting(classHighlighter),
];

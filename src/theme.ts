import { EditorView } from "@codemirror/view";

export const baseTheme = EditorView.baseTheme({
  ".cm-tooltip.cm-tooltip-cursor": {
    boxShadow: 'rgba(0, 0, 0, .15) 0 1px 2px',
    border: "1px solid rgba(127, 127, 127, .2)",
    fontSize: ".85rem",
    padding: ".4rem .5rem",
    borderRadius: "4px",
    "& .cm-tooltip-arrow:before": {},
    "& .cm-tooltip-arrow:after": {
      borderTopColor: "transparent"
    },
  },
  ".cm-tooltip.cm-completionInfo, .cm-diagnostic": {
    boxShadow: "rgba(0, 0, 0, .15) 0 2px 5px",
    fontSize: ".85rem",
    padding: ".8rem !important", // Couldn't figure out other means to override https://github.com/codemirror/autocomplete/blob/6.18.1/src/theme.ts#L65
  },
  ".cm-completionDetail": {
    float: "right",
    opacity: 0.5,
    fontStyle: "inherit !important",
  },
  "code": {
    fontSize: ".8em",
    fontStyle: "monospace",
    backgroundColor: "rgba(127, 127, 127, .3)",
    display: 'inline-block',
    padding: '2px 4px',
    borderRadius: '3px',
  },
});

"use client";

import { useCallback, useReducer } from "react";
import type { RegexNode } from "@/lib/utils/regex/blocks";

interface History {
  past: RegexNode[][];
  present: RegexNode[];
  future: RegexNode[][];
}

type Action = { type: "set"; nodes: RegexNode[]; record: boolean } | { type: "undo" } | { type: "redo" };

const LIMIT = 100;

function reducer(state: History, action: Action): History {
  switch (action.type) {
    case "set":
      if (action.nodes === state.present) return state;
      return action.record
        ? { past: [...state.past, state.present].slice(-LIMIT), present: action.nodes, future: [] }
        : { ...state, present: action.nodes };
    case "undo": {
      const previous = state.past[state.past.length - 1];
      if (!previous) return state;
      return { past: state.past.slice(0, -1), present: previous, future: [state.present, ...state.future] };
    }
    case "redo": {
      const [next, ...rest] = state.future;
      if (!next) return state;
      return { past: [...state.past, state.present], present: next, future: rest };
    }
  }
}

/** Block list with undo/redo. Typing in a field can skip recording (`record: false`). */
export function useBlocksHistory(initial: () => RegexNode[]) {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({ past: [], present: initial(), future: [] }));
  const set = useCallback((nodes: RegexNode[], record = true) => dispatch({ type: "set", nodes, record }), []);
  const undo = useCallback(() => dispatch({ type: "undo" }), []);
  const redo = useCallback(() => dispatch({ type: "redo" }), []);
  return { nodes: state.present, set, undo, redo, canUndo: state.past.length > 0, canRedo: state.future.length > 0 };
}

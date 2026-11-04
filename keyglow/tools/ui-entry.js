export { h, render, Fragment, createContext, toChildArray } from 'preact';
export { useState, useEffect, useRef, useMemo, useCallback, useContext, useReducer, useLayoutEffect } from 'preact/hooks';
import htm from 'htm';
import { h } from 'preact';
export const html = htm.bind(h);

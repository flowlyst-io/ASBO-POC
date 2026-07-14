/**
 * Ambient declaration for plain (non-module) CSS side-effect imports.
 * TypeScript 6 checks side-effect imports (TS2882) and Next's bundled
 * global.d.ts only declares `*.module.css`.
 */
declare module "*.css";

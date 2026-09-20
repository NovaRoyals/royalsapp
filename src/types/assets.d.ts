declare module '*.css';
declare module '*.module.css' {
  const classes: Record<string, string>;
  export default classes;
}
declare module '*.ttf';
declare module '*.png' {
  const src: number;
  export default src;
}


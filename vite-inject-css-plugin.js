const STYLE_ELEMENT_ID = 'ff8-styles';

const createStyleInjection = (css) =>
  `(()=>{if(typeof document==="undefined"||document.getElementById(${JSON.stringify(STYLE_ELEMENT_ID)}))return;` +
  `const style=document.createElement("style");style.id=${JSON.stringify(STYLE_ELEMENT_ID)};` +
  `style.textContent=${JSON.stringify(css)};document.head.appendChild(style)})();\n`;

const isStylesheet = (file) => file.type === 'asset' && file.fileName.endsWith('.css');

// A host imports the library without our index.html, so the stylesheet travels inside the entry
// chunk rather than as a file the host would have to import.
export function injectCssPlugin() {
  return {
    name: 'inject-css',
    apply: 'build',
    enforce: 'post',

    generateBundle(_, bundle) {
      const files = Object.values(bundle);
      const stylesheets = files.filter(isStylesheet);
      const css = stylesheets.map((file) => String(file.source)).join('');
      stylesheets.forEach((file) => {
        delete bundle[file.fileName];
      });
      files
        .filter((file) => file.type === 'chunk' && file.isEntry)
        .forEach((file) => {
          file.code = `${createStyleInjection(css)}${file.code}`;
        });
    },
  };
}

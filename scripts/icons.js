// script to turn svg's in /source-icons into a font of custom icons to be used the same way as font-awesome icons
// run with `npm run icons`
// see: https://www.npmjs.com/package/svgtofont
// simple svg editor: https://boxy-svg.com/app
// passing icons through this stroke to fill converter (and possibly the optimizer) is recommended: https://iconly.io/tools/svg-convert-stroke-to-fill
// this is because strokes/rects/etc. won't render properly in the font, only fills are supported

const svgtofont = require('svgtofont');
const path = require('path');

svgtofont({
    src: path.resolve(process.cwd(), 'source-icons'), // svg path
    dist: path.resolve(process.cwd(), 'public/font-alexsome'), // output path
    fontName: 'icon', // font name
    css: {
        include: /\.css$/, // create CSS files
    },
    svgicons2svgfont: {
        normalize: true, // Normalize icons by scaling them to the height of the highest icon.
    },
}).then(() => {
    console.log('Done Creating Custom Icons!');

    // append some extra formatting classes to the css file
    const fs = require('fs');
    const css = fs.readFileSync(
        path.resolve(process.cwd(), 'public/font-alexsome/icon.css'),
        'utf8',
    );
    const newCss =
        css +
        /* css */ `

.descender {
  vertical-align: text-bottom;
  font-size: 1.2em;
}

  `;
    fs.writeFileSync(path.resolve(process.cwd(), 'public/font-alexsome/icon.css'), newCss, 'utf8');
});

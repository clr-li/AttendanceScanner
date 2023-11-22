const fs = require("fs");

const lines = fs.readFileSync("./tap.info", "utf8").split("\n")
const coverage = lines[lines.length - 3].split("|");
const linePercentage = coverage[1].trim();
const branchPercentage = coverage[2].trim();
const functionPercentage = coverage[3].trim();

const label = "Coverage";
const percentage = Math.round((parseFloat(linePercentage) + parseFloat(branchPercentage) + parseFloat(functionPercentage)) / 3);
let color = "gray";
if (percentage < 50) color = "#B12B1D";
else if (percentage < 70) color = "#B1671E";
else if (percentage < 80) color = "#B19719";
else if (percentage < 90) color = "#7BB11B";
else color = "#16B13D";

const leftWidth = 66;
const rightWidth = 48;
const totalWidth = leftWidth + rightWidth;
const svg = /*html*/`
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${totalWidth}" height="20" role="img" aria-label="${label}: ${percentage}%">
    <title>${label}: ${percentage}</title>
    <linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
    <clipPath id="r"><rect width="${totalWidth}" height="20" rx="3" fill="#fff"/></clipPath>
    <g clip-path="url(#r)">
        <rect width="${leftWidth}" height="20" fill="#555"/>
        <rect x="${leftWidth}" width="${rightWidth}" height="20" fill="${color}"/>
        <rect width="${totalWidth}" height="20" fill="url(#s)"/></g>
        <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="110">
        <text aria-hidden="true" x="${5*leftWidth}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="550">${label}</text>
        <text x="${5*leftWidth}" y="140" transform="scale(.1)" fill="#fff" textLength="550">${label}</text>
        <text aria-hidden="true" x="${5*leftWidth + 12*rightWidth}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)">${percentage}%</text>
        <text x="${5*leftWidth + 12*rightWidth}" y="140" transform="scale(.1)" fill="#fff">${percentage}%</text>
    </g>
</svg>
`;

fs.writeFileSync("./public/assets/coverage.svg", svg, "utf8");
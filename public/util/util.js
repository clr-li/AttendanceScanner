/**
 * Calculates the similatity between two strings.
 * @param {string} str1 the first sctring to compare
 * @param {string} str2 the second string to compare
 * @returns the negated Levenshtein Distance between the two strings but normalized for the string lengths.
 */
export function calcSimilarity(str1, str2) {
    return -LevenshteinDistance(str1, str2) / Math.max(str1.length, str2.length);
}

/**
 * Calculates the Levenshtein Distance between two strings using the iterative matrix algorithm.
 * @param {string} str1 the first sctring to compare
 * @param {string} str2 the second string to compare
 * @returns the Levenshtein Distance between the two strings.
 */
function LevenshteinDistance(str1, str2) {
    let matrix = Array(str1.length + 1)
        .fill()
        .map(() => Array(str2.length + 1).fill(0));

    for (let i = 1; i <= str1.length; i++) {
        matrix[i][0] = i;
    }
    for (let j = 1; j <= str2.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= str1.length; i++) {
        for (let j = 1; j <= str2.length; j++) {
            let subcost = str1.charAt(i) === str2.charAt(j) ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j - 1] + subcost,
            );
        }
    }

    return matrix[str1.length][str2.length];
}

const p = document.createElement('p');
/**
 * Removes all HTML tags from the given text.
 * @param {string} text the text to sanitize.
 * @returns the sanitized text with all HTML tags removed.
 */
export function sanitizeText(text) {
    p.innerHTML = text;
    return p.textContent;
}

/**
 * sanitizes the content of the given template string.
 */
export function html(template, ...args) {
    return template.reduce((acc, part, i) => acc + sanitizeText(args[i - 1] || '') + part);
}

export function escapeQuotes(text) {
    return text.replace(/[`'"\\]/g, '\\$&');
}

/**
 * Escapes characters with special meaning in RegEx.
 *
 * @param {string} str the string to escape characters from
 * @returns the escaped version of str
 */
export function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

/**
 * Returns a string representation of a RegEx that will match any of the provided values.
 *
 * @param {any[]} values the values to match
 * @returns a string representation of a RegEx that will match any of the provided values.
 */
export function getPattern(values) {
    return values.map(s => escapeRegExp(s)).join('|');
}

/**
 * Opens the print dialog with the given HTML content.
 * @param {string} html the HTML content to print.
 */
export function print(html) {
    const popup = window.open('blank', '_new');
    popup.document.write(html);
    popup.document.body.style = 'display: flex; flex-wrap: wrap; width: 8.5in;';
    popup.focus(); //required for IE

    // wait for any images to load before printing
    const imgs = popup.document.getElementsByTagName('img');
    let loaded = 0;
    for (const img of imgs) {
        img.onload = () => {
            loaded++;
            if (loaded === imgs.length) {
                popup.print();
                popup.close();
            }
        };
    }
    if (!imgs.length) {
        popup.print();
        popup.close();
    }
}

/**
 * Converts an arbitrary string to a hex color code.
 * @param {string | null} str the string to convert to a color code.
 * @returns the hex color code for the given string or 'transparent' if the string is null.
 */
export function stringToColor(str) {
    if (str === null) return 'transparent';
    let hash = 0;
    str.split('').forEach(char => {
        hash = char.charCodeAt(0) + ((hash << 3) - hash);
    });
    let color = '#';
    for (let i = 0; i < 3; i++) {
        const value = (hash >> (i * 8)) & 0xff;
        color += value.toString(16).padStart(2, '0');
    }
    return color;
}

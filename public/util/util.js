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
  let matrix = Array(str1.length + 1).fill().map(() => Array(str2.length + 1).fill(0));
  
  for (let i = 1; i <= str1.length; i++) {
    matrix[i][0] = i;
  }
  for (let j = 1; j <= str2.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str1.length; i++) {
    for (let j = 1; j <= str2.length; j++) {
      let subcost = str1.charAt(i) == str2.charAt(j) ? 0 : 1;
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, 
                              matrix[i][j - 1] + 1, 
                              matrix[i - 1][j - 1] + subcost);
    }
  }
  
  return matrix[str1.length][str2.length];
}

/**
* @param {string} HTML representing any number of sibling elements
* @return {NodeList} the sibling elements as nodes
*/
export function htmlToElements(html) {
   var template = document.createElement('template');
   template.innerHTML = html;
   return template.content.childNodes;
}

/**
 * Utility class to make Web Component creation simpler.
 * @link Web Components: https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_custom_elements#high-level_view
 */
export class Component extends HTMLElement {
    /**
     * Creates a basic web component.
     * @param {string} mode "open" means the internal HTML is accessible outside the component, "closed" means it is not
     */
    constructor(mode="closed") {
        super(); // initialize component (should always be called first)

        // Create the shadow root (root of the shadow DOM representing the DOM nodes of this component)
        const shadow = this.attachShadow({ mode: mode }); // sets (if mode is "open") and returns 'this.shadowRoot'
        
        // Create HTML for this component
        const html = htmlToElements(this.initialHTML());

        // Attach the created elements to the shadow DOM
        shadow.append(...html);

        // Apply JS
        this.initialJS(shadow);
    }

    /**
     * @returns a string representing the HTML that this component initialy has
     */
    initialHTML() {
        return /* html */`
            <p>Please override initialHTML() to change the default html of this component</p>
        `;
    }

    /**
     * Applies JS to the shadow root of this component
     * @param {ShadowRoot} shadowRoot the root of the shadow DOM associated with this component
     */
    initialJS(shadowRoot) {} 
}
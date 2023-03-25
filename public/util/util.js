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
 * Creates a template element from an html string.
 * @param {string} html string representing any number of sibling elements
 * @returns a template element with html is its innerHTML.
 */
function htmlToTemplate(html) {
    const template = document.createElement('template');
    template.innerHTML = html;
    return template;
}

/**
 * Converts the given html string to html elements
 * @param {string} html string representing any number of sibling elements
 * @return {NodeList} the sibling elements as nodes.
 */
export function htmlToElements(html) {
   return htmlToTemplate(html).content.childNodes;
}

/**
 * Utility class to make Web Component creation simpler.
 * @link Web Components: https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_custom_elements#high-level_view
 * @link Web Component Lifecycle: https://bignerdranch.com/blog/learn-the-lifecycle-of-a-web-component-by-building-a-custom-element/
 * @abstract
 */
export class Component extends HTMLElement {
    /**
     * Returns the template of this component (each subclass should only have one singleton template).
     * @param {*} self an instance of this component
     * @returns the template of this component if it has already been set, or uses 
     */
    static template(self) {
        if (this.hasOwnProperty('_template')) return this._template;
        this._template = htmlToTemplate(self.initialHTML());
        return this._template;
    }

    /**
     * Creates a basic web component.
     */
    constructor() {
        super(); // initialize component (should always be called first)

        // Makes sure the Component class can't be initialized, only subclasses can (i.e. this is an abstract class)
        if (this.constructor == Component) {
            throw new Error("Abstract classes can't be instantiated.");
        }
        
        // Create the shadowRoot (root of the shadow DOM representing the DOM nodes of this component)
        this.attachShadow({ mode: "open" }); // returns the shadowRoot and, if mode is "open", sets 'this.shadowRoot' (@see https://blog.revillweb.com/open-vs-closed-shadow-dom-9f3d7427d1af)

        // Attach the template elements to the shadow DOM
        this.shadowRoot.appendChild(this.constructor.template(this).content.cloneNode(true));
    }

    /**
     * Used by the Component constructor to set the template.
     * @returns a string representing the HTML that this Component initialy has.
     */
    initialHTML() {
        return '';
    }
}
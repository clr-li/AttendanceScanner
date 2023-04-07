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
     * @params sharedTemplate true if all instances should share the same HTML template (default), false otherwise)
     */
    constructor(sharedTemplate = true) {
        super(); // initialize component (should always be called first)

        // Makes sure the Component class can't be initialized, only subclasses can (i.e. this is an abstract class)
        if (this.constructor == Component) {
            throw new Error("Abstract classes can't be instantiated.");
        }
        
        // Create the shadowRoot (root of the shadow DOM representing the DOM nodes of this component)
        this.attachShadow({ mode: "open" }); // returns the shadowRoot and, if mode is "open", sets 'this.shadowRoot' (@see https://blog.revillweb.com/open-vs-closed-shadow-dom-9f3d7427d1af)

        // Attach the template elements to the shadow DOM
        if (sharedTemplate) this.shadowRoot.appendChild(this.constructor.template(this).content.cloneNode(true));
        else this.shadowRoot.append(...htmlToElements(this.initialHTML()));
    }

    /**
     * Used by the Component constructor to set the template.
     * @returns a string representing the HTML that this Component initialy has.
     */
    initialHTML() {
        return '';
    }
}
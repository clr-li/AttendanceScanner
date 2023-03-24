export function parseJwt(token) {
    return JSON.parse(window.atob(token.split('.')[1]));
}

export function calcSimilarity(str1, str2) {
  return -LevenshteinDistance(str1, str2) / Math.max(str1.length, str2.length);
}

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
* @param {String} HTML representing any number of sibling elements
* @return {NodeList} the sibling elements as nodes
*/
export function htmlToElements(html) {
   var template = document.createElement('template');
   template.innerHTML = html;
   return template.content.childNodes;
}
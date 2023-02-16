export function setCookie(cname, cvalue, exhours) {
  const d = new Date();
  d.setTime(d.getTime() + (exhours*60*60*1000));
  let expires = "expires="+ d.toUTCString();
  document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
}

export function getCookie(cname) {
  let name = cname + "=";
  let decodedCookie = decodeURIComponent(document.cookie);
  let ca = decodedCookie.split(';');
  for(let i = 0; i <ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) == ' ') {
      c = c.substring(1);
    }
    if (c.indexOf(name) == 0) {
      return c.substring(name.length, c.length);
    }
  }
  return "";
}

export async function GET(url) {
  return await fetch('https://scanner2022.glitch.me' + url, {headers:{idtoken: getCookie('idtoken')}});
}

export async function POST(url, data) {
  return await fetch('https://scanner2022.glitch.me' + url, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      idtoken: getCookie('idtoken')
    },
    body: JSON.stringify(data)
  });
}

export function parseJwt(token) {
    return JSON.parse(ethereumjs.Buffer.Buffer.from(token.split('.')[1], 'base64').toString());
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
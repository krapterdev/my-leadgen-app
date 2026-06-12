/**
 * Recursively parses and resolves spintax syntax in templates.
 * Matches outermost/innermost brackets and selects random options.
 * Example: "{Hi|Hello} {there|friend}" -> "Hi friend"
 * Supporting nested spintax like "{Hi|Hello {there|friend}}"
 */
function parseSpintax(text) {
  if (!text || typeof text !== 'string') {
    return text || '';
  }

  const spintaxRegex = /\{[^{}]+\}/g;
  let currentText = text;

  // Continue resolving innermost spintax blocks until no matches remain
  while (spintaxRegex.test(currentText)) {
    currentText = currentText.replace(spintaxRegex, (match) => {
      // Remove braces: '{Hi|Hello}' -> 'Hi|Hello'
      const optionsStr = match.substring(1, match.length - 1);
      const options = optionsStr.split('|');

      // Select random element
      const randomIndex = Math.floor(Math.random() * options.length);
      return options[randomIndex];
    });
  }

  return currentText;
}

module.exports = {
  parseSpintax
};

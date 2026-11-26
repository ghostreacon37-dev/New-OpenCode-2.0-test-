// humanized-paths.js - Modular humanized website path structure
// Personal site URLs that feel authentic and human-like

// ROOT PATHS
exports.root = {
  '/': '/welcome-to-my-corner-of-the-web',
  '/about': '/why-i-built-this-site-at-3-am',
  '/contact': '/let-s-grab-coffee-sometime',
};

// ABOUT SECTION
exports.about = {
  '/': '/my-story-so-far',
  '/purpose': '/what-this-site-is-really-about',
  '/journey': '/the-steps-that-brought-me-here',
  '/lessons': '/things-i-learned-the-hard-way',
};

// BLOG SECTION (evergreen, date-free slugs)
exports.blog = {
  '/': '/blog',
  'why-i-stopped-using-social-media': '/why-i-stopped-using-social-media',
  'the-time-i-accidentally-broke-my-keyboard': '/the-time-i-accidentally-broke-my-keyboard',
  'what-i-learned-building-my-first-pc': '/what-i-learned-building-my-first-pc',
  'why-i-value-simple-tools-over-frameworks': '/why-i-value-simple-tools-over-frameworks',
};

// PROJECT SECTION
exports.projects = {
  '/': '/things-i-built-that-i-m-proud-of',
  'the-game-i-built-in-javascript': '/the-game-i-built-in-javascript',
  'the-chrome-extension-that-helped-me-focus': '/the-chrome-extension-that-helped-me-focus',
};

// GET specific path by section and identifier
exports.get = function(section, identifier) {
  const map = { root: exports.root, about: exports.about, blog: exports.blog, projects: exports.projects }[section];
  if (!map) return null;
  if (identifier !== undefined) {
    if (map[identifier] !== undefined) return map[identifier];
    const lowerKey = Object.keys(map).find(k => k.toLowerCase() === identifier.toLowerCase());
    return lowerKey ? map[lowerKey] : null;
  }
  return map;
};

// LIST all paths
exports.list = function() {
  return { root: exports.root, about: exports.about, blog: exports.blog, projects: exports.projects };
};

// UPGRADE - add/override paths without touching core
exports.upgrade = function(updates) {
  if (updates.root) Object.assign(exports.root, updates.root);
  if (updates.about) Object.assign(exports.about, updates.about);
  if (updates.blog) Object.assign(exports.blog, updates.blog);
  if (updates.projects) Object.assign(exports.projects, updates.projects);
  return this;
};
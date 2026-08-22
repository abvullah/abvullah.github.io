#!/usr/bin/env node
/*
 * create a new blog post in one command.
 *
 *   node tools/new-post.js "my new thought"
 *   node tools/new-post.js "exam week" --tags life,school --desc "surviving finals"
 *
 * it creates posts/<slug>.md, adds it to posts.json, and regenerates
 * feed.xml + sitemap.xml. then just edit the .md file, commit, push.
 */
'use strict';

var fs = require('fs');
var path = require('path');

var root = path.resolve(__dirname, '..');
var SITE = 'https://abvullah.github.io';

/* ---------- args ---------- */

var args = process.argv.slice(2);
var title = null;
var opts = { date: null, tags: '', desc: '' };
var rebuildOnly = false;

for (var i = 0; i < args.length; i++) {
  if (args[i] === '--date') opts.date = args[++i];
  else if (args[i] === '--tags') opts.tags = args[++i];
  else if (args[i] === '--desc') opts.desc = args[++i];
  else if (args[i] === '--rebuild') rebuildOnly = true;
  else if (title === null) title = args[i];
}

if (!title && !rebuildOnly) {
  console.log('usage: node tools/new-post.js "<title>" [--tags a,b] [--desc "..."] [--date YYYY-MM-DD]');
  console.log('       node tools/new-post.js --rebuild   (regenerate feed.xml + sitemap.xml from posts.json)');
  process.exit(1);
}

function today() {
  var d = new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

var date = opts.date || today();
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  console.error('error: --date must be YYYY-MM-DD');
  process.exit(1);
}

/* ---------- helpers ---------- */

function slugify(s) {
  return String(s).toLowerCase()
    .replace(/['\u2019]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'post';
}

function escXml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { return fallback; }
}

/* ---------- create markdown file ---------- */

var slug = null;

if (!rebuildOnly) {
  var postsDir = path.join(root, 'posts');
  fs.mkdirSync(postsDir, { recursive: true });

  slug = slugify(title);
  var n = 2;
  while (fs.existsSync(path.join(postsDir, slug + '.md'))) {
    slug = slugify(title) + '-' + n++;
  }
  var file = path.join(postsDir, slug + '.md');

  var stub = [
    '---',
    'title: ' + title.toLowerCase(),
    'date: ' + date,
    'description: ' + (opts.desc || '').toLowerCase(),
    'tags: ' + (opts.tags || 'life').toLowerCase(),
    '---',
    '',
    'start writing here...',
    ''
  ].join('\n');

  fs.writeFileSync(file, stub);

  /* ---------- update manifest ---------- */

  var manifestPath = path.join(root, 'posts.json');
  var manifest = readJson(manifestPath, {});
  var existing = Array.isArray(manifest.posts) ? manifest.posts : [];

  existing.push({
    slug: slug,
    title: title.toLowerCase(),
    date: date,
    description: (opts.desc || '').toLowerCase(),
    tags: (opts.tags || 'life').toLowerCase()
  });
  existing.sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
  manifest.posts = existing;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
}

var posts = readJson(path.join(root, 'posts.json'), {}).posts || [];
posts.sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });

/* ---------- regenerate feed.xml ---------- */

var newest = posts.length ? posts[0].date : date;
var feed = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<feed xmlns="http://www.w3.org/2005/Atom">',
  '  <title>abdullah mohammad</title>',
  '  <subtitle>writing, quotes, and projects.</subtitle>',
  '  <link href="' + SITE + '/"/>',
  '  <link rel="self" href="' + SITE + '/feed.xml"/>',
  '  <id>' + SITE + '/</id>',
  '  <updated>' + newest + 'T00:00:00Z</updated>',
  '  <author><name>abdullah mohammad</name></author>'
];
posts.forEach(function (p) {
  var url = SITE + '/post.html?p=' + encodeURIComponent(p.slug);
  feed.push('  <entry>');
  feed.push('    <title>' + escXml(p.title) + '</title>');
  feed.push('    <link href="' + url + '"/>');
  feed.push('    <id>' + url + '</id>');
  feed.push('    <updated>' + p.date + 'T00:00:00Z</updated>');
  if (p.description) feed.push('    <summary>' + escXml(p.description) + '</summary>');
  feed.push('  </entry>');
});
feed.push('</feed>');
fs.writeFileSync(path.join(root, 'feed.xml'), feed.join('\n') + '\n');

/* ---------- regenerate sitemap.xml ---------- */

var pages = ['/', '/about.html', '/blog.html', '/contact.html', '/projects.html', '/quotes.html'];
var sm = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
];
pages.concat(posts.map(function (p) { return '/post.html?p=' + encodeURIComponent(p.slug); }))
  .forEach(function (u) {
    sm.push('  <url>');
    sm.push('    <loc>' + SITE + u.replace(/&/g, '&amp;') + '</loc>');
    sm.push('    <lastmod>' + newest + '</lastmod>');
    sm.push('  </url>');
  });
sm.push('</urlset>');
fs.writeFileSync(path.join(root, 'sitemap.xml'), sm.join('\n') + '\n');

/* ---------- done ---------- */

if (rebuildOnly) {
  console.log('  rebuilt feed.xml + sitemap.xml from posts.json (' + posts.length + ' posts)');
} else {
  console.log('');
  console.log('  created  posts/' + slug + '.md');
  console.log('  updated  posts.json, feed.xml, sitemap.xml');
  console.log('');
  console.log('  next steps:');
  console.log('    1. open posts/' + slug + '.md and write your thoughts');
  console.log('    2. git add -A && git commit -m "new post: ' + slug + '" && git push');
  console.log('');
  console.log('  live at ' + SITE + '/post.html?p=' + slug);
  console.log('');
}

#!/usr/bin/env node
var fs = require('fs');
var path = require('path');

var args = process.argv.slice(2);
if (args.length < 1) {
  console.log('usage: node tools/post.js <post.md> [DD/MM/YYYY] [description]');
  process.exit(1);
}

var root = path.resolve(__dirname, '..');
var md = fs.readFileSync(args[0], 'utf8');
var date = args[1] || today();
var desc = args[2] || '';

function today() {
  var d = new Date();
  return String(d.getDate()).padStart(2, '0') + '/' +
    String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
}

function inline(text) {
  return text
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/~~([^~]+)~~/g, '<s>$1</s>');
}

function toText(text) {
  return text
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function render(body) {
  var html = [];
  var block = null;
  var lines = body.split(/\r?\n/);

  function flush() {
    if (!block) return;
    if (block.type === 'para') {
      html.push('<p>' + inline(block.lines.join(' ')) + '</p>');
    } else if (block.type === 'quote') {
      html.push('<blockquote>' + block.lines.map(function (l) { return '<p>' + inline(l) + '</p>'; }).join('') + '</blockquote>');
    } else if (block.type === 'list') {
      html.push('<ul class="list">' + block.lines.map(function (l) { return '<li>' + inline(l) + '</li>'; }).join('') + '</ul>');
    } else if (block.type === 'h2' || block.type === 'h3') {
      html.push('<' + block.type + '>' + inline(block.lines[0]) + '</' + block.type + '>');
    }
    block = null;
  }

  lines.forEach(function (line) {
    var t = line.trim();
    if (t === '') { flush(); return; }
    var h = t.match(/^#{2,3}\s+/);
    if (h) { flush(); block = { type: 'h' + h[0].length, lines: [t.replace(/^#{2,3}\s+/, '')] }; return; }
    if (/^>\s?/.test(t)) {
      if (!block || block.type !== 'quote') { flush(); block = { type: 'quote', lines: [] }; }
      block.lines.push(t.replace(/^>\s?/, ''));
      return;
    }
    if (/^-\s+/.test(t)) {
      if (!block || block.type !== 'list') { flush(); block = { type: 'list', lines: [] }; }
      block.lines.push(t.replace(/^-\s+/, ''));
      return;
    }
    if (!block || block.type !== 'para') { flush(); block = { type: 'para', lines: [] }; }
    block.lines.push(t);
  });
  flush();
  return html.join('\n');
}

var titleMatch = md.match(/^#\s+(.+)$/m);
var title = titleMatch ? titleMatch[1].trim() : path.basename(args[0]).replace(/\.md$/i, '');
var slug = path.basename(args[0]).replace(/\.md$/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
var url = slug + '.html';
var body = md.replace(/^#\s+[^\n]*\n?/, '');

if (!desc) {
  var first = md.split(/\r?\n/).map(function (l) { return l.trim(); }).find(function (l) {
    return l && !/^#/.test(l) && !/^>/.test(l) && !/^-/.test(l) && l !== '---';
  });
  desc = first ? toText(first) : title;
}
if (desc.length > 160) desc = desc.slice(0, 157) + '...';

var template = fs.readFileSync(path.join(root, 'post-template.html'), 'utf8');
var html = template
  .replace(/{{TITLE}}/g, title)
  .replace(/{{DESCRIPTION}}/g, desc)
  .replace(/{{URL}}/g, url)
  .replace(/<!-- POSTBODY -->/, render(body));
fs.writeFileSync(path.join(root, slug + '.html'), html);

var postsPath = path.join(root, 'posts.html');
var postsHtml = fs.readFileSync(postsPath, 'utf8');
var li = '    <li> <a href="' + url + '">' + title + '</a> <span class="desc">— ' + date + '</span></li>';
postsHtml = postsHtml.replace('<!-- POST-LIST -->', '<!-- POST-LIST -->\n' + li);
fs.writeFileSync(postsPath, postsHtml);

var feedPath = path.join(root, 'feed.xml');
var feed = fs.readFileSync(feedPath, 'utf8');
var parts = date.split('/');
var updated = parts[2] + '-' + parts[1] + '-' + parts[0] + 'T00:00:00Z';
var entry = [
  '  <entry>',
  '    <title>' + title + '</title>',
  '    <link href="https://abvullah.github.io/' + url + '"/>',
  '    <id>https://abvullah.github.io/' + url + '</id>',
  '    <updated>' + updated + '</updated>',
  '    <summary>' + desc + '</summary>',
  '  </entry>'
].join('\n');
feed = feed.replace(/(<updated>)[^<]+(<\/updated>)/, '$1' + updated + '$2');
feed = feed.replace('  <entry>', entry + '\n  <entry>');
fs.writeFileSync(feedPath, feed);

console.log('created ' + url);
console.log('added to posts.html and feed.xml');
console.log('https://abvullah.github.io/' + url);

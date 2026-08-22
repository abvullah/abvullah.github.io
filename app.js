/* abdullah mohammad's site — markdown rendering, blog explorer, post viewer. */
(function () {
  'use strict';

  var MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

  /* ---------- utils ---------- */

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function pad2(n) { return String(n).padStart(2, '0'); }

  /* "04-aug-2026" — explorer style */
  function fmtModified(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
    if (!m) return String(iso || '');
    return m[3] + '-' + MONTHS[Number(m[2]) - 1] + '-' + m[1];
  }

  /* "8/4/26" — sign-off style */
  function fmtWritten(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
    if (!m) return '';
    return Number(m[2]) + '/' + Number(m[3]) + '/' + m[1].slice(2);
  }

  function fmtSize(bytes) {
    var kb = bytes / 1024;
    if (kb >= 10) return Math.round(kb) + ' kB';
    return (Math.round(kb * 10) / 10) + ' kB';
  }

  function fetchText(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error(r.status + ' ' + url);
      return r.text();
    });
  }

  function loadManifest() {
    return fetchText('posts.json').then(function (t) {
      var data = JSON.parse(t);
      return (data && data.posts) || [];
    });
  }

  /* ---------- frontmatter ---------- */

  function parseFrontmatter(md) {
    var meta = {};
    var body = md;
    var m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(md);
    if (m) {
      m[1].split(/\r?\n/).forEach(function (line) {
        var kv = line.match(/^([A-Za-z_-]+)\s*:\s*(.*)$/);
        if (kv) meta[kv[1].toLowerCase()] = kv[2].trim();
      });
      body = md.slice(m[0].length);
    }
    return { meta: meta, body: body };
  }

  /* ---------- markdown ---------- */

  function safeUrl(u) {
    var s = String(u || '').trim();
    return /^(https?:|mailto:|#|\/|\.\/|\.\.\/)/i.test(s) ? s : '#';
  }

  function inline(s) {
    return s
      .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, function (_, alt, src) {
        return '<img src="' + safeUrl(src) + '" alt="' + alt + '">';
      })
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (_, text, href) {
        return '<a href="' + safeUrl(href) + '">' + text + '</a>';
      })
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/__([^_]+)__/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
      .replace(/~~([^~]+)~~/g, '<del>$1</del>');
  }

  function renderMarkdown(src) {
    src = String(src || '').replace(/\r\n/g, '\n');
    var out = [];
    var i = 0;
    var lines = src.split('\n');

    while (i < lines.length) {
      var line = lines[i];

      // fenced code block
      var fence = line.match(/^```(\w*)\s*$/);
      if (fence) {
        var code = [];
        i++;
        while (i < lines.length && !/^```\s*$/.test(lines[i])) { code.push(lines[i]); i++; }
        i++;
        out.push('<pre><code>' + esc(code.join('\n')) + '</code></pre>');
        continue;
      }

      // heading
      var h = line.match(/^(#{1,3})\s+(.*)$/);
      if (h) {
        var level = h[1].length;
        out.push('<h' + level + '>' + inline(esc(h[2])) + '</h' + level + '>');
        i++;
        continue;
      }

      // horizontal rule
      if (/^\s*([-*_])\s*\1\s*\1[\s\-*_]*$/.test(line)) {
        out.push('<hr>');
        i++;
        continue;
      }

      // blockquote
      if (/^>\s?/.test(line)) {
        var quote = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) {
          quote.push(lines[i].replace(/^>\s?/, ''));
          i++;
        }
        out.push('<blockquote>' + renderMarkdown(quote.join('\n')) + '</blockquote>');
        continue;
      }

      // unordered list
      if (/^\s*[-*+]\s+/.test(line)) {
        var ul = [];
        while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
          ul.push('<li>' + inline(esc(lines[i].replace(/^\s*[-*+]\s+/, ''))) + '</li>');
          i++;
        }
        out.push('<ul>' + ul.join('') + '</ul>');
        continue;
      }

      // ordered list
      if (/^\s*\d+[.)]\s+/.test(line)) {
        var ol = [];
        while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
          ol.push('<li>' + inline(esc(lines[i].replace(/^\s*\d+[.)]\s+/, ''))) + '</li>');
          i++;
        }
        out.push('<ol>' + ol.join('') + '</ol>');
        continue;
      }

      // blank line
      if (/^\s*$/.test(line)) { i++; continue; }

      // paragraph: consume until blank line or block start; soft breaks -> <br>
      var para = [];
      while (
        i < lines.length &&
        !/^\s*$/.test(lines[i]) &&
        !/^```/.test(lines[i]) &&
        !/^(#{1,3})\s+/.test(lines[i]) &&
        !/^>\s?/.test(lines[i]) &&
        !/^\s*[-*+]\s+/.test(lines[i]) &&
        !/^\s*\d+[.)]\s+/.test(lines[i])
      ) {
        para.push(esc(lines[i].trim()));
        i++;
      }
      out.push('<p>' + inline(para.join('<br>')) + '</p>');
    }

    return out.join('\n');
  }

  /* ---------- blog explorer ---------- */

  function initExplorer() {
    var tbody = document.getElementById('listing');
    if (!tbody) return;

    loadManifest().then(function (posts) {
      posts.sort(function (a, b) { return String(a.slug).localeCompare(String(b.slug)); });

      var newest = posts.slice().sort(function (a, b) {
        return String(b.date).localeCompare(String(a.date));
      })[0];
      var lastEl = document.getElementById('last-updated');
      if (lastEl) lastEl.textContent = newest ? fmtModified(newest.date) : '';

      if (!posts.length) {
        tbody.innerHTML = '<tr><td colspan="3">no posts yet.</td></tr>';
        return;
      }

      tbody.innerHTML =
        '<tr>' +
        '<td><a href="./" class="parent"><span class="file-icon">📁</span> ..</a></td>' +
        '<td>-</td><td></td></tr>' +
        posts.map(function (p) {
          return '<tr>' +
            '<td><a href="post.html?p=' + encodeURIComponent(p.slug) + '">' +
            '<span class="file-icon">📄</span> ' + esc(p.slug) + '.md</a></td>' +
            '<td class="size" data-slug="' + esc(p.slug) + '">…</td>' +
            '<td>' + esc(fmtModified(p.date)) + '</td>' +
            '</tr>';
        }).join('');

      // fill in file sizes
      posts.forEach(function (p) {
        fetchText('posts/' + encodeURIComponent(p.slug) + '.md').then(function (text) {
          var cell = tbody.querySelector('.size[data-slug="' + p.slug + '"]');
          if (cell) cell.textContent = fmtSize(new Blob([text]).size);
        }).catch(function () {
          var cell = tbody.querySelector('.size[data-slug="' + p.slug + '"]');
          if (cell) cell.textContent = '-';
        });
      });
    }).catch(function () {
      tbody.innerHTML = '<tr><td colspan="3">could not load listing.</td></tr>';
    });
  }

  /* ---------- post viewer ---------- */

  function initPost() {
    var view = document.getElementById('post-view');
    if (!view) return;

    var params = new URLSearchParams(window.location.search);
    var slug = params.get('p');

    loadManifest().then(function (posts) {
      var entry = null;
      for (var i = 0; i < posts.length; i++) {
        if (posts[i].slug === slug) { entry = posts[i]; break; }
      }
      if (!slug || !entry) {
        document.title = 'not found — abdullah mohammad';
        view.innerHTML =
          '<h2>not found</h2>' +
          '<p>that post doesn\'t exist (yet).</p>' +
          '<p><a href="blog.html">← ../blog</a></p>';
        return;
      }

      return fetchText('posts/' + encodeURIComponent(slug) + '.md').then(function (md) {
        var parsed = parseFrontmatter(md);
        var title = parsed.meta.title || entry.title || slug;
        var desc = parsed.meta.description || entry.description || '';
        var written = parsed.meta.date || entry.date;

        document.title = title.toLowerCase() + ' — abdullah mohammad';
        var metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc && desc) metaDesc.setAttribute('content', desc.toLowerCase());

        var html = '<div class="article-body">' + renderMarkdown(parsed.body);

        if (written) {
          html += '<p class="signoff">—abdullah mohammad. written ' + fmtWritten(written) + '.</p>';
        }

        html += '</div>';
        view.innerHTML = html;
      });
    }).catch(function () {
      view.innerHTML =
        '<h2>something went wrong</h2>' +
        '<p>couldn\'t load this post.</p>' +
        '<p><a href="blog.html">← ../blog</a></p>';
    });
  }

  /* ---------- boot ---------- */

  function init() {
    try { initExplorer(); } catch (e) {}
    try { initPost(); } catch (e) {}
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }

  var App = {
    esc: esc,
    fmtModified: fmtModified,
    fmtWritten: fmtWritten,
    fmtSize: fmtSize,
    parseFrontmatter: parseFrontmatter,
    renderMarkdown: renderMarkdown,
    loadManifest: loadManifest
  };

  if (typeof window !== 'undefined') window.App = App;
  if (typeof module !== 'undefined' && module.exports) module.exports = App;
})();

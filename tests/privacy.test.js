// The privacy policy page (SF-017, SF-018): privacy.html shows docs/google-play/PRIVACY_POLICY.md's
// policy text word for word, loads nothing from another site, is linked from the welcome screen
// and the group menu, and is served, cached for offline use and shipped like the app's other files.
// The policy's time for IP addresses in the server's memory must cover the server's own.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { STATIC_FILES } from "../server/static.js";
import { GUESS_WINDOW_MS, WRITE_WINDOW_MS, SWEEP_MS } from "../server/api.js";

const read = function(name){ return readFileSync(new URL("../" + name, import.meta.url), "utf8"); };

// Markdown inline → plain text: **bold**, `code` and [text](url) keep only their text.
function mdText(s){
  return s.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/`([^`]+)`/g, "$1").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s+/g, " ").trim();
}
// HTML inline → plain text: tags dropped, the few entities the page uses decoded.
function htmlText(s){
  return s.replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}

// The policy as a list of blocks: "h:<heading>", "p:<paragraph>", "li:<list item>".
function policyFromMarkdown(md){
  const start = md.indexOf("<!-- POLICY START");
  const end = md.indexOf("<!-- POLICY END -->");
  assert.ok(start !== -1 && end > start, "PRIVACY_POLICY.md has no POLICY START/END markers");
  const body = md.slice(md.indexOf("\n", start) + 1, end);
  const blocks = [];
  body.replace(/\r\n/g, "\n").trim().split(/\n\s*\n/).forEach(function(chunk){
    const lines = chunk.split("\n");
    if(lines[0].startsWith("### ")){
      blocks.push("h:" + mdText(lines[0].slice(4)));
    }else if(lines[0].startsWith("- ")){
      let item = null;
      lines.forEach(function(l){
        if(l.startsWith("- ")){
          if(item !== null) blocks.push("li:" + mdText(item));
          item = l.slice(2);
        }else{
          item += " " + l;
        }
      });
      blocks.push("li:" + mdText(item));
    }else{
      blocks.push("p:" + mdText(lines.join(" ")));
    }
  });
  return blocks;
}
function policyFromHtml(html){
  const m = /<div id="policy">([\s\S]*?)\n\s*<\/div>/.exec(html);
  assert.ok(m, "privacy.html has no <div id=\"policy\">");
  return [...m[1].matchAll(/<(h2|p|li)\b[^>]*>([\s\S]*?)<\/\1>/g)].map(function(x){
    return (x[1] === "h2" ? "h:" : x[1] + ":") + htmlText(x[2]);
  });
}

test("privacy.html shows PRIVACY_POLICY.md's policy text word for word (SF-017, SF-018)", function(){
  const fromMd = policyFromMarkdown(read("docs/google-play/PRIVACY_POLICY.md"));
  const fromHtml = policyFromHtml(read("privacy.html"));
  assert.ok(fromMd.length > 40, fromMd.length + " blocks");
  assert.deepEqual(fromHtml, fromMd);
});

test("the policy covers the topics Play and the owner's brief ask for", function(){
  const headings = policyFromMarkdown(read("docs/google-play/PRIVACY_POLICY.md")).filter(function(b){ return b.startsWith("h:"); });
  ["Who we are", "Information you give us", "Information kept on your phone", "Technical information", "How we use information",
    "Where it is stored", "Who else receives information", "No ads, analytics, crash reporting", "How long we keep it",
    "Accounts and account deletion", "Deleting your information", "Security", "Children", "Changes to this policy", "Contact"]
    .forEach(function(topic){
      assert.ok(headings.some(function(h){ return h.includes(topic); }), topic);
    });
});

test("the policy's time for IP addresses in the server's memory covers what the server does (the T-06 review's F-16)", function(){
  const policy = policyFromMarkdown(read("docs/google-play/PRIVACY_POLICY.md")).join("\n");
  const stated = [...policy.matchAll(/for at most (\d+) minutes after the last request/g)].map(function(m){ return Number(m[1]); });
  assert.equal(stated.length, 2, "sections 5 and 10 each give the time");
  // The limiters keep an address until its last event leaves the window, and are swept every
  // SWEEP_MS; the live hub only while the stream is open, which the policy states apart.
  const longest = Math.max(GUESS_WINDOW_MS, WRITE_WINDOW_MS) + SWEEP_MS;
  stated.forEach(function(n){
    assert.ok(longest <= n * 60 * 1000, "the policy says " + n + " minutes; the server may keep an address " + longest / 60000 + " minutes");
  });
  assert.match(policy, /while a live connection from the app is open/);
  // The declarations give the owner the same time for Play Console.
  const declared = [...read("docs/google-play/PLAY_CONSOLE_DECLARATIONS.md").matchAll(/at most (\d+) minutes\s+after (?:its|the) last request/g)]
    .map(function(m){ return Number(m[1]); });
  assert.equal(declared.length, 2, "the IP row and \"IP addresses\"");
  declared.forEach(function(n){ assert.equal(n, stated[0]); });
});

test("privacy.html loads nothing from another site, and runs no script", function(){
  const html = read("privacy.html");
  assert.doesNotMatch(html, /<script\b/i);
  assert.doesNotMatch(html, /<(img|iframe|video|audio|source|object|embed)\b/i);
  assert.doesNotMatch(html, /@import|url\(/i);
  // Every <link> is one of the app's own files.
  [...html.matchAll(/<link\b[^>]*href="([^"]+)"/gi)].forEach(function(m){ assert.doesNotMatch(m[1], /^(https?:)?\/\//, m[1]); });
  // Other sites appear only as links a reader can follow.
  const withoutLinks = html.replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, "");
  assert.doesNotMatch(withoutLinks, /https?:\/\//);
  assert.match(html, /<title>Privacy policy · SplitFamilia<\/title>/);
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1/);
});

test("the welcome screen and the group menu link to the privacy policy (SF-018)", function(){
  const html = read("index.html");
  const welcome = /<main class="welcome" id="join-screen"[\s\S]*?<\/main>/.exec(html)[0];
  const menu = /<div class="panel" id="menu-panel"[\s\S]*?<!-- People: add and remove. -->/.exec(html)[0];
  // Each link sits straight in its paragraph, with nothing around it that the page hides inside
  // the Android app (.web-only, .install-btn): Play wants the policy reachable in the app.
  [[welcome, "fine-print"], [menu, "menu-note"]].forEach(function(pair){
    const p = new RegExp('<p class="' + pair[1] + '">((?:(?!</p>)[\\s\\S])*?)<a class="policy-link" href="privacy.html">Privacy policy</a></p>').exec(pair[0]);
    assert.ok(p, "no Privacy policy link at the end of a ." + pair[1] + " paragraph");
    assert.doesNotMatch(p[1], /<span|<div|web-only|install-btn|hidden/, pair[1]);
  });
});

test("privacy.html is served, cached for offline use and shipped, like the app's other files (SF-017)", function(){
  assert.equal(STATIC_FILES["/privacy.html"], "text/html; charset=utf-8");
  assert.match(read("service-worker.js"), /^\s*"\.\/privacy\.html",\r?$/m);
  assert.match(read("Dockerfile"), /^COPY [^\n]*\bprivacy\.html\b[^\n]* \/app\/\r?$/m);
  assert.match(read(".dockerignore"), /^!privacy\.html\r?$/m);
  assert.ok(JSON.parse(read("railway.json")).build.watchPatterns.includes("/privacy.html"));
});

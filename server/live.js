// Live updates (SF-034): each open page holds one stream in Server-Sent Events format for its
// group. The stream sends the group's version at once and again after every change, so a page
// knows when to fetch the group. A comment line every 25 seconds keeps proxies from closing it
// (Railway closes a response after 5 minutes with no data).
import { COMMON_HEADERS } from "./static.js";

export const HEARTBEAT_MS = 25000;
// More streams than this at once get 503: about a hundred times what a few families need.
export const MAX_STREAMS = 1000;
// And more than this from one address (the owner, D-17), so no one can hold them all: enough for
// a family's phones and tabs behind one Wi-Fi.
export const MAX_STREAMS_PER_ADDRESS = 10;

function versionEvent(version){
  return "event: version\ndata: " + JSON.stringify({ version: version }) + "\n\n";
}

// A stream closed by the page is removed on its "close" event; until then, skip it.
function send(res, text){
  if(!res.writableEnded && !res.destroyed) res.write(text);
}

export function createLiveHub(options){
  const heartbeatMs = (options && options.heartbeatMs) || HEARTBEAT_MS;
  const maxStreams = (options && options.maxStreams) || MAX_STREAMS;
  const maxPerAddress = (options && options.maxStreamsPerAddress) || MAX_STREAMS_PER_ADDRESS;
  const streams = new Map(); // group code → Set of responses
  const perAddress = new Map(); // address → how many streams it holds
  let total = 0;
  let timer = null;

  function beat(){
    streams.forEach(function(set){
      set.forEach(function(res){ send(res, ": keep-alive\n\n"); });
    });
  }

  function remove(code, res, address){
    const set = streams.get(code);
    if(!set || !set.delete(res)) return;
    total--;
    if(set.size === 0) streams.delete(code);
    const held = perAddress.get(address) - 1;
    if(held > 0) perAddress.set(address, held);
    else perAddress.delete(address);
    if(total === 0 && timer !== null){
      clearInterval(timer);
      timer = null;
    }
  }

  return {
    // No room for another stream: the server holds its most, or `address` holds its share.
    full: function(address){
      return total >= maxStreams || (perAddress.get(address) || 0) >= maxPerAddress;
    },

    // Starts a stream on `res` for group `code`, currently at `version`, from `address`. It ends
    // when the page closes it, or the server stops.
    open: function(code, res, version, address){
      res.writeHead(200, Object.assign({
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Accel-Buffering": "no",
        // The stream is the connection's last response, so ending it closes the connection.
        "Connection": "close"
      }, COMMON_HEADERS));
      res.write(versionEvent(version));
      if(!streams.has(code)) streams.set(code, new Set());
      streams.get(code).add(res);
      total++;
      perAddress.set(address, (perAddress.get(address) || 0) + 1);
      if(timer === null) timer = setInterval(beat, heartbeatMs);
      res.on("close", function(){ remove(code, res, address); });
    },

    // Tells every page showing group `code` that it is now at `version`.
    publish: function(code, version){
      const set = streams.get(code);
      if(set) set.forEach(function(res){ send(res, versionEvent(version)); });
    },

    // Open streams: for one group, or in all.
    count: function(code){
      if(code === undefined) return total;
      const set = streams.get(code);
      return set ? set.size : 0;
    },

    // Streams held by one address, and how many addresses hold any.
    countFrom: function(address){ return perAddress.get(address) || 0; },
    addresses: function(){ return perAddress.size; },

    // Groups with at least one open stream, and whether the heartbeat timer is running.
    groups: function(){ return streams.size; },
    ticking: function(){ return timer !== null; },

    // Ends every stream, for a clean shutdown. Pages reconnect to the next server.
    closeAll: function(){
      streams.forEach(function(set){ set.forEach(function(res){ res.end(); }); });
      if(timer !== null){
        clearInterval(timer);
        timer = null;
      }
    }
  };
}

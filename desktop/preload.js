'use strict';
// The address page gets `desktopAddress`; the web app gets `mediaManagerDesktop` (described for the page in
// src/client/desktopBridge.ts). main.js answers each only from the page it belongs to.
const { contextBridge, ipcRenderer } = require('electron');

const call = (channel) => (...args) => ipcRenderer.invoke(channel, ...args);

if (window.location.protocol === 'file:') {
  contextBridge.exposeInMainWorld('desktopAddress', { submit: call('address:submit') });
} else {
  const listeners = new Map();
  ipcRenderer.on('player:event', (_event, name, value) => {
    for (const listener of listeners.get(name) ?? []) listener(value);
  });
  contextBridge.exposeInMainWorld('mediaManagerDesktop', {
    load: call('player:load'),
    play: call('player:play'),
    pause: call('player:pause'),
    stop: call('player:stop'),
    seek: call('player:seek'),
    setAudio: call('player:setAudio'),
    setSubtitle: call('player:setSubtitle'),
    setSubtitleDelay: call('player:setSubtitleDelay'),
    setLoadAhead: call('player:setLoadAhead'),
    getLoadAhead: call('player:getLoadAhead'),
    setLayout: call('player:setLayout'),
    setFullscreen: call('player:setFullscreen'),
    // Events: position, duration, paused, buffering, loadedAhead, endOfFile, error, tracks, started.
    on: (name, listener) => {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(listener);
      return () => listeners.get(name).delete(listener);
    },
  });
}

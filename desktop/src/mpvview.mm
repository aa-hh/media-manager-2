// The desktop app's mpv addon (from the C0 test app, candidate 3): mpv draws with vo=gpu-next (libplacebo, Vulkan
// through MoltenVK) in its own borderless window, and the Electron window is
// attached to that window as a child, ordered above it, so the transparent
// page sits over the picture. mpv v0.41.0 never reads --wid on macOS (only the
// X11, win32 and Android code does), so the picture cannot go into our own view.
//
// Both windows always have the same frame. mpv's window leads: it is sized to
// the Electron window once when it appears, after that only mpv changes it
// (fullscreen on and off, through mpv's own fullscreen with native-fs=no), and
// the Electron window follows. When the user moves or resizes the Electron
// window, main.js calls matchFrame() once the gesture ends. The player layouts
// (full, mini, a page rectangle) are mpv's video-margin-ratio-* properties,
// set from main.js, so no window moves for them.
//
// Main-thread rule: mpv's macOS window code (video/out/mac_common.swift) runs
// DispatchQueue.main.sync on the video thread while the player core waits for
// it. Electron's JavaScript runs on the main thread, so a blocking mpv call
// from here (mpv_command, mpv_set_property, mpv_get_property, a post-init
// mpv_set_option, mpv_terminate_destroy) can deadlock while a file opens or
// closes. After mpv_initialize this addon only uses mpv's async calls, and
// destroy() keeps the main run loop turning while mpv shuts down.

#include <napi.h>
#import <Cocoa/Cocoa.h>
#include <mpv/client.h>
#include <atomic>
#include <cstdlib>
#include <map>
#include <string>
#include <thread>
#include <utility>
#include <vector>

static const uint64_t kWindowId = 1;  // reply id of the "window-id" observer

static std::string Describe(NSWindow *w) {
  if (!w) return "none";
  return [[NSString stringWithFormat:@"frame=%@ scale=%.2f visible=%d occlusionVisible=%d child=%d level=%ld key=%d style=%lu screen=%@",
                                     NSStringFromRect(w.frame), w.backingScaleFactor, w.isVisible,
                                     (w.occlusionState & NSWindowOcclusionStateVisible) != 0, w.parentWindow != nil,
                                     (long)w.level, w.isKeyWindow, (unsigned long)w.styleMask,
                                     NSStringFromRect(w.screen.frame)] UTF8String];
}

class MpvView : public Napi::ObjectWrap<MpvView> {
 public:
  static Napi::Object Init(Napi::Env env, Napi::Object exports) {
    Napi::Function fn = DefineClass(env, "MpvView", {
        InstanceMethod("setOption", &MpvView::SetOption),
        InstanceMethod("command", &MpvView::Command),
        InstanceMethod("setProperty", &MpvView::SetProperty),
        InstanceMethod("getProperty", &MpvView::GetProperty),
        InstanceMethod("observe", &MpvView::Observe),
        InstanceMethod("onEvent", &MpvView::OnEvent),
        InstanceMethod("setFullscreen", &MpvView::SetFullscreen),
        InstanceMethod("matchFrame", &MpvView::MatchFrame),
        InstanceMethod("destroy", &MpvView::Destroy),
    });
    exports.Set("MpvView", fn);
    return exports;
  }

  MpvView(const Napi::CallbackInfo &info) : Napi::ObjectWrap<MpvView>(info) {
    Napi::Env env = info.Env();
    if (!info[0].IsBuffer() || info[0].As<Napi::Buffer<uint8_t>>().Length() < sizeof(void *)) {
      Napi::TypeError::New(env, "expected the Buffer from getNativeWindowHandle()").ThrowAsJavaScriptException();
      return;
    }
    NSView *handle = (__bridge NSView *)*reinterpret_cast<void **>(info[0].As<Napi::Buffer<uint8_t>>().Data());
    win_ = handle.window;
    if (!win_) {
      Napi::Error::New(env, "the Electron view has no window yet").ThrowAsJavaScriptException();
      return;
    }

    mpv_ = mpv_create();
    if (!mpv_) {
      Napi::Error::New(env, "mpv_create failed").ThrowAsJavaScriptException();
      return;
    }
    // Warnings and errors only: main.js reads FFmpeg's "HTTP error 401" from them.
    mpv_request_log_messages(mpv_, "warn");
    // Video output and its window, set before mpv_initialize.
    // auto-window-resize=no: mpv does not resize its window for each new file.
    // native-fs=no: mpv's fullscreen fills the screen in place (window.swift setToFullScreen)
    // instead of moving to a new Space, so the attached Electron window stays with it.
    const char *vo[][2] = {
        {"vo", "gpu-next"}, {"gpu-api", "vulkan"}, {"gpu-context", "macvk"},
        {"border", "no"}, {"ontop", "no"}, {"auto-window-resize", "no"}, {"native-fs", "no"}};
    int err = 0;
    for (auto &o : vo)
      if (err >= 0) err = mpv_set_option_string(mpv_, o[0], o[1]);
    if (err >= 0) err = mpv_initialize(mpv_);
    if (err < 0) {
      Napi::Error::New(env, std::string("mpv init: ") + mpv_error_string(err)).ThrowAsJavaScriptException();
      return;
    }
    // window-id is mpv's NSWindow pointer (video/out/mac/common.swift, VOCTRL_GET_WINDOW_ID);
    // it changes on video reconfig (player/command.c), so this fires once mpv's window exists.
    mpv_observe_property(mpv_, kWindowId, "window-id", MPV_FORMAT_STRING);
  }

  ~MpvView() { Teardown(); }

 private:
  NSWindow *win_ = nil;    // Electron's window
  NSWindow *video_ = nil;  // mpv's window, parent of win_ once attached
  NSMutableArray *videoObservers_ = [NSMutableArray array];
  mpv_handle *mpv_ = nullptr;
  uint64_t nextId_ = 1000;
  std::map<uint64_t, Napi::Promise::Deferred> replies_;
  Napi::ThreadSafeFunction tsfn_;
  Napi::FunctionReference callback_;
  std::atomic<bool> pending_{false};

  bool Ready(Napi::Env env) {
    if (mpv_) return true;
    Napi::Error::New(env, "mpv is not running").ThrowAsJavaScriptException();
    return false;
  }

  // Returns a promise settled when mpv's reply event for `id` arrives in Drain().
  Napi::Value Async(Napi::Env env, uint64_t id, int err) {
    auto d = Napi::Promise::Deferred::New(env);
    if (err < 0)
      d.Reject(Napi::Error::New(env, mpv_error_string(err)).Value());
    else
      replies_.emplace(id, d);
    return d.Promise();
  }

  // Async set whose reply is not awaited (Reply() ignores unknown ids).
  int SetLater(const char *name, const std::string &value, uint64_t id = 0) {
    if (!mpv_) return MPV_ERROR_UNINITIALIZED;
    const char *v = value.c_str();
    return mpv_set_property_async(mpv_, id, name, MPV_FORMAT_STRING, &v);
  }

  // Sends an event to the JS callback from AppKit code, which runs outside any N-API call.
  void Emit(const std::string &name, const std::string &value) {
    if (!tsfn_) return;
    auto *d = new std::pair<std::string, std::string>(name, value);
    napi_status s = tsfn_.NonBlockingCall(d, [](Napi::Env env, Napi::Function cb, std::pair<std::string, std::string> *d) {
      Napi::Object o = Napi::Object::New(env);
      o.Set("event", "window");
      o.Set("name", d->first);
      o.Set("value", d->second);
      delete d;
      cb.Call({o});
    });
    if (s != napi_ok) delete d;
  }

  void Watch(NSWindow *w, NSArray<NSNotificationName> *names, std::string who, bool follow, NSMutableArray *into) {
    MpvView *self = this;
    for (NSNotificationName name in names) {
      std::string what = who + " " + [name UTF8String];
      [into addObject:[[NSNotificationCenter defaultCenter] addObserverForName:name object:w queue:nil
                                                                    usingBlock:^(NSNotification *n) {
        self->Emit(what, Describe((NSWindow *)n.object));
        if (follow) self->Follow();
      }]];
    }
  }

  static void Unwatch(NSMutableArray *list) {
    for (id o in list) [[NSNotificationCenter defaultCenter] removeObserver:o];
    [list removeAllObjects];
  }

  Napi::Value SetOption(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();
    if (!Ready(env)) return env.Undefined();
    std::string name = "options/" + info[0].ToString().Utf8Value(), value = info[1].ToString();
    uint64_t id = nextId_++;
    return Async(env, id, SetLater(name.c_str(), value, id));
  }

  Napi::Value Command(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();
    if (!Ready(env)) return env.Undefined();
    if (!info[0].IsArray()) {
      Napi::TypeError::New(env, "command expects an array").ThrowAsJavaScriptException();
      return env.Undefined();
    }
    Napi::Array arr = info[0].As<Napi::Array>();
    std::vector<std::string> args;
    for (uint32_t i = 0; i < arr.Length(); i++) args.push_back(arr.Get(i).ToString());
    std::vector<const char *> argv;
    for (auto &a : args) argv.push_back(a.c_str());
    argv.push_back(nullptr);
    uint64_t id = nextId_++;
    return Async(env, id, mpv_command_async(mpv_, id, argv.data()));
  }

  Napi::Value SetProperty(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();
    if (!Ready(env)) return env.Undefined();
    std::string name = info[0].ToString(), value = info[1].ToString();
    uint64_t id = nextId_++;
    return Async(env, id, SetLater(name.c_str(), value, id));
  }

  Napi::Value GetProperty(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();
    if (!Ready(env)) return env.Undefined();
    std::string name = info[0].ToString();
    uint64_t id = nextId_++;
    return Async(env, id, mpv_get_property_async(mpv_, id, name.c_str(), MPV_FORMAT_STRING));
  }

  Napi::Value Observe(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();
    if (!Ready(env)) return env.Undefined();
    std::string name = info[0].ToString();
    int err = mpv_observe_property(mpv_, 0, name.c_str(), MPV_FORMAT_STRING);  // client lock only, never waits on the core
    if (err < 0) Napi::Error::New(env, mpv_error_string(err)).ThrowAsJavaScriptException();
    return env.Undefined();
  }

  static void Wakeup(void *ctx) {
    MpvView *self = static_cast<MpvView *>(ctx);
    if (!self->pending_.exchange(true))
      self->tsfn_.NonBlockingCall([self](Napi::Env env, Napi::Function) { self->Drain(env); });
  }

  Napi::Value OnEvent(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();
    if (!Ready(env)) return env.Undefined();
    if (!info[0].IsFunction()) {
      Napi::TypeError::New(env, "onEvent expects a function").ThrowAsJavaScriptException();
      return env.Undefined();
    }
    callback_ = Napi::Persistent(info[0].As<Napi::Function>());
    if (!tsfn_) {
      tsfn_ = Napi::ThreadSafeFunction::New(env, info[0].As<Napi::Function>(), "mpv-events", 0, 1);
      tsfn_.Unref(env);
      mpv_set_wakeup_callback(mpv_, Wakeup, this);
    }
    Drain(env);  // events queued before the callback was registered
    return env.Undefined();
  }

  bool Reply(Napi::Env env, mpv_event *ev) {
    if (ev->event_id != MPV_EVENT_COMMAND_REPLY && ev->event_id != MPV_EVENT_SET_PROPERTY_REPLY &&
        ev->event_id != MPV_EVENT_GET_PROPERTY_REPLY)
      return false;
    auto it = replies_.find(ev->reply_userdata);
    if (it == replies_.end()) return true;
    Napi::Promise::Deferred d = it->second;
    replies_.erase(it);
    if (ev->event_id == MPV_EVENT_GET_PROPERTY_REPLY) {
      auto *p = static_cast<mpv_event_property *>(ev->data);
      if (ev->error >= 0 && p->format == MPV_FORMAT_STRING && p->data)
        d.Resolve(Napi::String::New(env, *static_cast<char **>(p->data)));
      else
        d.Resolve(env.Null());
    } else if (ev->error < 0) {
      d.Reject(Napi::Error::New(env, mpv_error_string(ev->error)).Value());
    } else {
      d.Resolve(env.Undefined());
    }
    return true;
  }

  void Drain(Napi::Env env) {
    pending_ = false;
    Napi::HandleScope scope(env);
    while (mpv_) {
      mpv_event *ev = mpv_wait_event(mpv_, 0);
      if (ev->event_id == MPV_EVENT_NONE) break;
      if (Reply(env, ev)) continue;
      Napi::Object o = Napi::Object::New(env);
      o.Set("event", mpv_event_name(ev->event_id));
      if (ev->error < 0) o.Set("error", mpv_error_string(ev->error));
      if (ev->event_id == MPV_EVENT_PROPERTY_CHANGE) {
        auto *p = static_cast<mpv_event_property *>(ev->data);
        o.Set("name", p->name);
        bool has = p->format == MPV_FORMAT_STRING && p->data;
        if (has)
          o.Set("value", *static_cast<char **>(p->data));
        else
          o.Set("value", env.Null());
        if (ev->reply_userdata == kWindowId && has)
          Attach((__bridge NSWindow *)(void *)(intptr_t)strtoll(*static_cast<char **>(p->data), nullptr, 10));
      } else if (ev->event_id == MPV_EVENT_LOG_MESSAGE) {
        auto *m = static_cast<mpv_event_log_message *>(ev->data);
        o.Set("name", m->prefix);
        o.Set("value", std::string(m->level) + ": " + m->text);
      } else if (ev->event_id == MPV_EVENT_END_FILE) {
        auto *e = static_cast<mpv_event_end_file *>(ev->data);
        std::string reason;
        switch (e->reason) {
          case MPV_END_FILE_REASON_EOF: reason = "eof"; break;
          case MPV_END_FILE_REASON_STOP: reason = "stop"; break;
          case MPV_END_FILE_REASON_QUIT: reason = "quit"; break;
          case MPV_END_FILE_REASON_ERROR: reason = std::string("error: ") + mpv_error_string(e->error); break;
          default: reason = "redirect";
        }
        o.Set("value", reason);
      }
      if (!callback_.IsEmpty()) callback_.Call({o});
      if (env.IsExceptionPending()) return;
    }
  }

  // mpv's window appeared (or was replaced): give it the Electron window's frame
  // once, then make it the Electron window's parent.
  void Attach(NSWindow *w) {
    if (!w || w == video_) return;
    Detach();
    video_ = w;
    // mpv's border=no keeps a titled window with a hidden title bar
    // (video/out/mac/title_bar.swift); borderless drops its rounded corners and shadow.
    video_.styleMask = NSWindowStyleMaskBorderless;
    video_.hasShadow = NO;
    // While not attached, so the move does not drag the Electron window. mpv's
    // windowDidResize records this as its normal-size frame (window.swift:554-558),
    // which is where fullscreen-off returns to.
    [video_ setFrame:win_.frame display:YES];
    [video_ addChildWindow:win_ ordered:NSWindowAbove];
    Watch(video_, @[NSWindowDidResizeNotification, NSWindowDidMoveNotification,
                    NSWindowDidChangeBackingPropertiesNotification, NSWindowDidChangeOcclusionStateNotification],
          "mpv", true, videoObservers_);
    MpvView *self = this;
    [videoObservers_ addObject:[[NSNotificationCenter defaultCenter] addObserverForName:NSWindowWillCloseNotification object:video_
                                                                                  queue:nil usingBlock:^(NSNotification *) { self->Detach(); }]];
    [win_ makeKeyAndOrderFront:nil];  // mpv makes its own window key when it opens it
    Emit("attached", "mpv " + Describe(video_) + " | electron " + Describe(win_));
  }

  void Detach() {
    if (!video_) return;
    Unwatch(videoObservers_);
    [video_ removeChildWindow:win_];
    video_ = nil;
  }

  // mpv's window moved or resized (fullscreen on or off): the Electron window
  // takes the same frame. Moving a child window never moves its parent.
  void Follow() {
    if (!video_ || !win_) return;
    if (!NSEqualRects(win_.frame, video_.frame)) [win_ setFrame:video_.frame display:YES];
  }

  // The user moved or resized the Electron window: mpv's window takes its frame.
  // Detached while it moves, because moving a parent drags its child window along.
  // Nothing happens when the frames already match (Follow's own moves end here too).
  Napi::Value MatchFrame(const Napi::CallbackInfo &info) {
    if (video_ && win_ && !NSEqualRects(win_.frame, video_.frame)) {
      [video_ removeChildWindow:win_];
      [video_ setFrame:win_.frame display:YES];
      [video_ addChildWindow:win_ ordered:NSWindowAbove];
    }
    return info.Env().Undefined();
  }

  // mpv's own fullscreen (native-fs=no): mpv resizes its window to the screen
  // and hides the menu bar and Dock (window.swift setToFullScreen); Follow()
  // resizes the Electron window to match.
  Napi::Value SetFullscreen(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();
    if (!Ready(env)) return env.Undefined();
    uint64_t id = nextId_++;
    return Async(env, id, SetLater("fullscreen", info[0].ToBoolean() ? "yes" : "no", id));
  }

  Napi::Value Destroy(const Napi::CallbackInfo &info) {
    Teardown();
    return info.Env().Undefined();
  }

  void Teardown() {
    Detach();
    if (mpv_) {
      mpv_set_wakeup_callback(mpv_, nullptr, nullptr);
      mpv_handle *h = mpv_;
      mpv_ = nullptr;
      // mpv closes its window through DispatchQueue.main.sync, so shut it down on
      // another thread and keep the main run loop turning until it is done.
      std::atomic<bool> done{false};
      std::thread t([h, &done] { mpv_terminate_destroy(h); done = true; });
      while (!done) CFRunLoopRunInMode(kCFRunLoopDefaultMode, 0.02, true);
      t.join();
    }
    if (tsfn_) {
      tsfn_.Release();
      tsfn_ = Napi::ThreadSafeFunction();
    }
    win_ = nil;
  }
};

Napi::Object InitAll(Napi::Env env, Napi::Object exports) { return MpvView::Init(env, exports); }

NODE_API_MODULE(mpvview, InitAll)

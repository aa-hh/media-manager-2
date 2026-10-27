{
  "targets": [
    {
      "target_name": "mpvview",
      "sources": ["src/mpvview.mm"],
      "include_dirs": [
        "/opt/homebrew/include",
        "<!(node -p \"require('node-addon-api').include_dir\")"
      ],
      "libraries": ["-L/opt/homebrew/lib", "-lmpv"],
      "defines": ["NAPI_VERSION=8", "NODE_ADDON_API_DISABLE_CPP_EXCEPTIONS"],
      "xcode_settings": {
        "OTHER_CPLUSPLUSFLAGS": ["-ObjC++", "-fobjc-arc", "-std=c++17", "-Wno-deprecated-declarations"],
        "OTHER_LDFLAGS": ["-framework Cocoa", "-Wl,-rpath,/opt/homebrew/lib"],
        "MACOSX_DEPLOYMENT_TARGET": "14.0",
        "CLANG_ENABLE_OBJC_ARC": "YES"
      }
    }
  ]
}

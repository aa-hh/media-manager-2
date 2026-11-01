plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

android {
    namespace = "io.github.aahh.mediamanager2.tv"
    compileSdk = 37

    defaultConfig {
        applicationId = "io.github.aahh.mediamanager2.tv"
        minSdk = 28
        targetSdk = 37
        // Only `android-tv.sh release` passes -PversionCode (the CI run number), so
        // debug builds stay at 1. The release title is "TV app 1.0.<versionCode>".
        versionCode = (findProperty("versionCode") as String?)?.toInt() ?: 1
        versionName = "1.0.$versionCode"
        ndk {
            // Both until box test B2 shows whether the Streamer runs 32-bit Android.
            abiFilters += listOf("arm64-v8a", "armeabi-v7a")
        }
    }

    // The release key lives only in CI secrets and this Mac's Keychain. Without
    // ANDROID_TV_KEYSTORE_PATH the release build is unsigned and debug is untouched.
    val keystorePath = System.getenv("ANDROID_TV_KEYSTORE_PATH")
    signingConfigs {
        if (!keystorePath.isNullOrEmpty()) {
            create("release") {
                storeFile = file(keystorePath)
                storeType = "PKCS12"
                storePassword = System.getenv("ANDROID_TV_KEYSTORE_PASSWORD")
                keyAlias = "release"
                keyPassword = System.getenv("ANDROID_TV_KEYSTORE_PASSWORD")
            }
        }
    }

    buildTypes {
        debug {
            applicationIdSuffix = ".debug"
        }
        release {
            if (!keystorePath.isNullOrEmpty()) signingConfig = signingConfigs.getByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        compose = true
    }
}

dependencies {
    implementation(libs.activity.compose)
    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui)
    implementation(libs.compose.foundation)
    implementation(libs.compose.ui.tooling.preview)
    debugImplementation(libs.compose.ui.tooling)
    implementation(libs.tv.material)
    implementation(libs.navigation.compose)
    implementation(libs.media3.exoplayer)
    implementation(libs.media3.ui)
    implementation(libs.media3.datasource.okhttp)
    // Built by `sh scripts/android-tv.sh ffmpeg`; not in git.
    implementation(files("../ffmpeg/out/lib-decoder-ffmpeg-release.aar"))
    implementation(libs.okhttp)
    implementation(libs.okhttp.sse)
    implementation(libs.serialization.json)
    implementation(libs.coroutines.android)
    implementation(libs.coil.compose)
    implementation(libs.coil.network.okhttp)

    testImplementation(libs.junit)
    testImplementation(libs.coroutines.test)
    testImplementation(libs.okhttp.mockwebserver)
}

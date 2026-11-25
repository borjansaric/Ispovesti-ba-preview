plugins {
    id("com.android.application")
}

android {
    namespace = "ba.ispovesti.admin"
    compileSdk = 35

    defaultConfig {
        applicationId = "ba.ispovesti.admin"
        minSdk = 24
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
    }

    buildTypes {
        debug {
            applicationIdSuffix = ".preview"
            versionNameSuffix = "-preview"
        }
        release {
            isMinifyEnabled = false
        }
    }
}

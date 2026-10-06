# 70mai Controller

This is a controller application for the Xiaomi 70mai M300 Dashcam.
It connects to the camera over Wi-Fi and provides remote control, file downloading, and configuration.

## Why 70mai M300?
Unlike standard action cameras (e.g., AKASO), the 70mai dashcam has the following benefits:
- **Always-on Wi-Fi**: You do not have to physically push a button on the camera to enable Wi-Fi.
- **Loop Recording**: Automatically overwrites old files, perfect for continuous recording.
- **No Physical Interaction**: Mount it on a fence or vehicle and leave it, it's always ready.

# Build Android local (sem Android Studio instalado):
# - JDK 21 (Temurin) e Android SDK ficam em C:\Users\felip\AppData\Local\Temp\opencode\build-tools
# - Defina JAVA_HOME=<...>\jdk21 e ANDROID_HOME=<...>\sdk antes do gradlew
# - android/local.properties aponta o sdk.dir (Capacitor 8 exige Java 21)
# - android.overridePathCheck=true no gradle.properties (pasta com acento)

## Features
- Connects automatically to the 70mai Wi-Fi (192.168.0.1)
- Mock mode for offline development
- Easy React + Vite architecture

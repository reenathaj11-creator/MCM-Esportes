# Camera Integration

Integrating the Xiaomi 70mai M300 Dashcam into our workflow has proven to be much more reliable than standard action cameras.

## Key Advantages
1. **Always-On Wi-Fi**: The biggest hurdle with other cameras was the need to press a button to turn Wi-Fi on. The 70mai stays broadcasting, making automatic sync possible.
2. **Loop Recording**: We never have to worry about the SD card filling up and stopping recordings.
3. **Dashcam Nature**: It's designed to start recording automatically on power-up.

## Integration Points
- `70maiCameraService.ts`: Handles the network requests to `192.168.0.1`.
- `70maiProtocol.ts`: Defines the endpoints and path mappings.

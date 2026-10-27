// swift-tools-version: 5.9
import PackageDescription

// Tangem SDK 5.3 needs iOS 16.4; Capacitor rounds the deployment target down to the major version for its own package,
// hence iOS 17 for the whole app (3.15, the last iOS 15 version, compiles a second main() from libsecp256k1).
let package = Package(
    name: "CapacitorTangem",
    platforms: [.iOS(.v17)],
    products: [
        .library(name: "CapacitorTangem", targets: ["TangemPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0"),
        .package(url: "https://github.com/tangem/tangem-sdk-ios.git", exact: "5.3.0")
    ],
    targets: [
        .target(
            name: "TangemPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "TangemSdk", package: "tangem-sdk-ios")
            ],
            path: "ios/Sources/TangemPlugin")
    ]
)

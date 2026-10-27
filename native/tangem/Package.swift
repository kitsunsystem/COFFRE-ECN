// swift-tools-version: 5.9
import PackageDescription

// shortcut: Tangem SDK 3.15 keeps iOS 15 (iPhone 7 and later); the 5.x line needs iOS 16.4, move to it when the app
// requires iOS 17 (Capacitor rounds the deployment target down to the major version for its package).
let package = Package(
    name: "CapacitorTangem",
    platforms: [.iOS(.v15)],
    products: [
        .library(name: "CapacitorTangem", targets: ["TangemPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0"),
        .package(url: "https://github.com/tangem/tangem-sdk-ios.git", exact: "3.15.0")
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

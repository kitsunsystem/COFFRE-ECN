import Capacitor
import Foundation
import TangemSdk

// Tangem cards in the iPhone app. The card keeps an Ed25519 key that never leaves it: the app only asks it to sign,
// and src/lib/cards.ts turns the (deterministic, RFC 8032) signature into the card's secret.
@objc(TangemPlugin)
public class TangemPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "TangemPlugin"
    public let jsName = "Tangem"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "scan", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "sign", returnType: CAPPluginReturnPromise)
    ]

    private lazy var sdk = TangemSdk()
    // Used by the SDK to check online, with Tangem, that a card is a genuine one.
    private let network = NetworkService(session: .shared, additionalHeaders: [:])

    // The card and its Ed25519 key, created at its very first use (one more tap).
    @objc func scan(_ call: CAPPluginCall) {
        sdk.scanCard(initialMessage: nil, networkService: network) { [weak self] result in
            switch result {
            case .failure(let error):
                Self.fail(call, error)
            case .success(let card):
                if let wallet = card.wallets.first(where: { $0.curve == .ed25519 }) {
                    Self.resolveKey(call, card.cardId, wallet.publicKey)
                    return
                }
                self?.sdk.createWallet(curve: .ed25519, cardId: card.cardId, initialMessage: nil) { created in
                    switch created {
                    case .failure(let error): Self.fail(call, error)
                    case .success(let response): Self.resolveKey(call, card.cardId, response.wallet.publicKey)
                    }
                }
            }
        }
    }

    // Signs a 32-byte value (base64) with the card's key; the card must be the one scanned (same id).
    @objc func sign(_ call: CAPPluginCall) {
        guard let cardId = call.getString("cardId"),
              let publicKey = call.getString("publicKey").flatMap(Self.bytes),
              let hash = call.getString("hash").flatMap({ Data(base64Encoded: $0) }) else {
            call.reject("Paramètres manquants.")
            return
        }
        sdk.sign(hashes: [hash], walletPublicKey: publicKey, cardId: cardId, derivationPath: nil, initialMessage: nil) { result in
            switch result {
            case .failure(let error): Self.fail(call, error)
            case .success(let response):
                guard let signature = response.signatures.first else { return call.reject("Aucune signature.") }
                call.resolve(["signature": signature.base64EncodedString()])
            }
        }
    }

    private static func fail(_ call: CAPPluginCall, _ error: TangemSdkError) {
        call.reject(error.localizedDescription, String(error.code))
    }

    private static func resolveKey(_ call: CAPPluginCall, _ cardId: String, _ publicKey: Data?) {
        guard let publicKey else { return call.reject("La clé de la carte est illisible.") }
        call.resolve(["cardId": cardId, "publicKey": publicKey.map { String(format: "%02x", $0) }.joined()])
    }

    private static func bytes(_ hex: String) -> Data? {
        guard hex.count % 2 == 0 else { return nil }
        var data = Data(capacity: hex.count / 2)
        var index = hex.startIndex
        while index < hex.endIndex {
            let next = hex.index(index, offsetBy: 2)
            guard let byte = UInt8(hex[index..<next], radix: 16) else { return nil }
            data.append(byte)
            index = next
        }
        return data
    }
}
